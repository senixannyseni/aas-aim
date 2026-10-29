#!/usr/bin/env node
/**
 * Phase 31: dependency-free protections against stale Vite bundles and a
 * preview service that responds without serving the bundle just built.
 *
 * The checks are intentionally narrow. They validate packaging/serving
 * consistency, NOT application correctness, accessibility, or approval.
 */
import { lstatSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'apps', 'aim-next', 'dist');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Extract Vite-emitted entry JS and optional stylesheet assets from HTML. */
export function assetsFromHtml(html) {
  assert(typeof html === 'string' && html.includes('id="root"'), 'Built HTML must contain the React #root mount');
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) ?? [];
  const assets = [];
  for (const tag of tags) {
    const script = /^<script\b/i.test(tag);
    if (!script && !/\brel=["']stylesheet["']/i.test(tag)) continue;
    const attr = script ? 'src' : 'href';
    const value = tag.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i'))?.[1];
    if (value) assets.push({ kind: script ? 'js' : 'css', url: value });
  }
  assert(assets.some(({kind}) => kind === 'js'), 'Built HTML must reference at least one JavaScript entry');
  for (const {kind, url} of assets) {
    assert(/^\/?assets\/[a-zA-Z0-9._-]+\.(?:js|css)$/.test(url), `Unexpected built asset path: ${url}`);
    assert(url.endsWith(kind === 'js' ? '.js' : '.css'), `Unexpected asset type for ${kind}: ${url}`);
  }
  return assets;
}

/**
 * Inventory ALL emitted files, not merely HTML entrypoints. Bundlers may
 * produce lazy route chunks, worker files, images and public assets that are
 * never mentioned in index.html. A served preview must match each one.
 */
export function listEmittedFiles(distPath, relative = '') {
  const dir = join(distPath, relative);
  const info = lstatSync(dir);
  assert(info.isDirectory() && !info.isSymbolicLink(), `Build output must be a real directory: ${dir}`);
  const files = [];
  for (const entry of readdirSync(dir, {withFileTypes:true})) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    // Reject links, sockets, FIFOs and other non-regular filesystem entries.
    // Do not follow links outside dist when computing the release inventory.
    if (entry.isDirectory()) files.push(...listEmittedFiles(distPath, name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Unexpected emitted file type or symlink: ${name}`);
  }
  return files.sort();
}

/** Verify the HTML entrypoints and fingerprint every other emitted file. */
export function inspectBuiltDist(distPath) {
  const indexPath = join(distPath, 'index.html');
  assert(existsSync(indexPath), `Missing ${indexPath}`);
  const inventory = listEmittedFiles(distPath);
  assert(inventory.includes('index.html'), 'Built index.html must be a real file');
  const htmlBuffer = readFileSync(indexPath);
  assert(htmlBuffer.byteLength > 0, 'Built index.html must be nonempty');
  const html = htmlBuffer.toString('utf8');
  const entryAssets = assetsFromHtml(html);
  const paths = new Set(inventory);
  for (const asset of entryAssets) {
    assert(paths.has(asset.url.replace(/^\//, '')), `Missing emitted asset: ${asset.url}`);
  }
  const fingerprints = new Map();
  for (const path of inventory) {
    if (path === 'index.html') continue;
    const buffer = readFileSync(join(distPath, ...path.split('/')));
    assert(buffer.byteLength > 0, `Empty or invalid emitted asset: /${path}`);
    fingerprints.set('/' + path.split('/').map(encodeURIComponent).join('/'), {
      bytes:buffer.byteLength,
      sha256:createHash('sha256').update(buffer).digest('hex'),
    });
  }
  const makeRecord = (asset) => {
    const fingerprint = fingerprints.get(asset.url);
    assert(fingerprint, `Missing emitted asset: ${asset.url}`);
    return {...asset, ...fingerprint};
  };
  const entry = entryAssets.map(makeRecord);
  const used = new Set(entry.map(a => a.url));
  const extras = [...fingerprints.keys()].filter(url => !used.has(url)).sort()
    .map(url => ({kind:'other', url, ...fingerprints.get(url)}));
  return {html, assets:[...entry,...extras], entryAssets};
}

/** Checks that a responding preview serves every emitted file from this build. */
export async function probePreview(base, built, fetcher = fetch) {
  const options = {signal: AbortSignal.timeout(2500), headers: {'cache-control': 'no-cache'}};
  const res = await fetcher(new URL('/', base), options);
  assert(res.ok, `Preview responded HTTP ${res.status}`);
  const html = await res.text();
  assert(html === built.html, 'Preview HTML differs from the freshly generated index.html');
  const servedAssets = assetsFromHtml(html);
  const expected = (built.entryAssets ?? built.assets.filter(({kind}) => kind === 'js' || kind === 'css')).map(({url}) => url).sort();
  assert(JSON.stringify(servedAssets.map(({url}) => url).sort()) === JSON.stringify(expected),
    'Preview assets do not match this build');
  for (const asset of built.assets) {
    const response = await fetcher(new URL(asset.url, base), options);
    assert(response.ok, `Preview asset ${asset.url} responded HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    assert(bytes.byteLength > 0, `Preview asset ${asset.url} is empty`);
    assert(Number.isSafeInteger(asset.bytes) && asset.bytes > 0 && /^[a-f0-9]{64}$/.test(asset.sha256 ?? ''),
      `Missing fresh-build fingerprint for ${asset.url}`);
    assert(bytes.byteLength === asset.bytes, `Preview asset ${asset.url} size differs from the built asset`);
    const digest = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
    assert(digest === asset.sha256, `Preview asset ${asset.url} content differs from the built asset`);
  }
  return built.assets.length;
}

/** This command accepts no user path, so deletion is restricted to the workspace build output. */
export function clearBuildOutput() {
  assert(dist === resolve(root, 'apps', 'aim-next', 'dist'), 'Build directory escaped workspace');
  if (existsSync(dist) || safeSymlinkExists(dist)) rmSync(dist, {recursive:true, force:true});
}
function safeSymlinkExists(path) {
  try { return lstatSync(path).isSymbolicLink(); } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

async function main() {
  const [command, extra] = process.argv.slice(2);
  if (command === 'clear-dist' && !extra) {
    clearBuildOutput();
    console.log('PASS: prior AIM Next dist output removed before production build');
  } else if (command === 'assert-dist' && !extra) {
    const built = inspectBuiltDist(dist);
    console.log(`PASS: current dist/index.html and all ${built.assets.length} nonempty emitted files fingerprinted`);
  } else if (command === 'probe-preview' && extra && !process.argv[4]) {
    const built = inspectBuiltDist(dist);
    const count = await probePreview(extra, built);
    console.log(`PASS: preview HTTP serves this build and all ${count} emitted files with exact bytes`);
  } else {
    throw new Error('Usage: release-runtime-guards.mjs clear-dist|assert-dist|probe-preview <http://127.0.0.1:4174>');
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {console.error(`FAIL: ${error.message}`); process.exitCode = 1;});
}
