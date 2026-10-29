import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {assetsFromHtml, inspectBuiltDist, listEmittedFiles, probePreview} from './release-runtime-guards.mjs';

const html = '<!doctype html><html><body><div id="root"></div><script type="module" crossorigin src="/assets/index-a1b2.js"></script><link rel="stylesheet" crossorigin href="/assets/index-c3d4.css"></body></html>';
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'aim-release-guard-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), html);
  writeFileSync(join(dir, 'assets/index-a1b2.js'), 'console.log("ready")');
  writeFileSync(join(dir, 'assets/index-c3d4.css'), 'body{margin:0}');
  return dir;
}
function withFixture(fn) {
  const dir = fixture();
  try {return fn(dir);} finally {rmSync(dir, {recursive:true,force:true});}
}
test('accepts a complete emitted Vite entry and CSS asset pair', () => withFixture((dir) => {
  assert.deepEqual(inspectBuiltDist(dir).assets.map(a=>a.kind), ['js','css']);
}));
test('rejects a missing emitted JavaScript file', () => withFixture((dir) => {
  rmSync(join(dir, 'assets/index-a1b2.js'));
  assert.throws(() => inspectBuiltDist(dir), /Missing emitted asset/);
}));
test('rejects empty emitted JavaScript and CSS assets', () => withFixture((dir) => {
  writeFileSync(join(dir, 'assets/index-a1b2.js'), '');
  assert.throws(() => inspectBuiltDist(dir), /Empty or invalid emitted asset/);
}));
test('rejects a source index instead of a real production bundle', () => {
  assert.throws(() => assetsFromHtml('<div id="root"></div><script src="/src/main.tsx"></script>'), /Unexpected built asset/);
});
test('rejects external and traversal entrypoints in the build manifest', () => {
  for (const value of ['https://example.com/malware.js','/assets/../malware.js','/assets/payload.js?x=1']) {
    assert.throws(() => assetsFromHtml(`<div id="root"></div><script src="${value}"></script>`), /Unexpected built asset/);
  }
});
async function serve(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {return await run(`http://127.0.0.1:${server.address().port}`);} finally {await new Promise(resolve => server.close(resolve));}
}
test('preview probe validates byte-for-byte exact HTML, JS and CSS from this build', async () => {
  const dir = fixture();
  try {
    const built = inspectBuiltDist(dir);
    await serve((req,res) => {
      if (req.url === '/') return res.end(html);
      if (req.url === '/assets/index-a1b2.js') return res.end('console.log("ready")');
      if (req.url === '/assets/index-c3d4.css') return res.end('body{margin:0}');
      res.writeHead(404).end();
    }, async base => {
      assert.equal(await probePreview(base, built), 2);
    });
  } finally {rmSync(dir, {recursive:true,force:true});}
});
test('preview probe rejects wrong build HTML and incomplete asset responses', async () => {
  const dir = fixture();
  try {
    const built = inspectBuiltDist(dir);
    await serve((req,res) => {
      if (req.url === '/') return res.end(html.replace('index-a1b2.js','index-wrong.js'));
      res.writeHead(404).end();
    }, async base => {
      await assert.rejects(probePreview(base, built), /differs/);
    });
    await serve((req,res) => {
      if (req.url === '/') return res.end(html);
      res.writeHead(404).end();
    }, async base => {
      await assert.rejects(probePreview(base, built), /responded HTTP 404/);
    });
  } finally {rmSync(dir, {recursive:true,force:true});}
});
test('preview rejects same-path, nonempty but tampered JavaScript and CSS (old false positive)', async () => {
  const dir = fixture();
  try {
    const built = inspectBuiltDist(dir);
    for (const broken of ['js', 'css']) {
      await serve((req, res) => {
        if (req.url === '/') return res.end(html);
        if (req.url === '/assets/index-a1b2.js') {
          return res.end(broken === 'js' ? 'console.log("wrong")' : 'console.log("ready")');
        }
        if (req.url === '/assets/index-c3d4.css') {
          return res.end(broken === 'css' ? 'body{padding:0}' : 'body{margin:0}');
        }
        res.writeHead(404).end();
      }, async base => {
        await assert.rejects(probePreview(base, built), /differs from the built asset/);
      });
    }
  } finally {rmSync(dir, {recursive:true,force:true});}
});
test('preview rejects same-length tampering and missing fresh-build fingerprints', async () => {
  const dir = fixture();
  try {
    const built = inspectBuiltDist(dir);
    await serve((req,res) => {
      if (req.url === '/') return res.end(html);
      if (req.url === '/assets/index-a1b2.js') return res.end('console.log("other")');
      if (req.url === '/assets/index-c3d4.css') return res.end('body{margin:0}');
      res.writeHead(404).end();
    }, async base => {
      await assert.rejects(probePreview(base, built), /content differs from the built asset/);
      await assert.rejects(probePreview(base, {html,assets:assetsFromHtml(html)}), /Missing fresh-build fingerprint/);
    });
  } finally {rmSync(dir, {recursive:true,force:true});}
});

function extendedFixture() {
  const dir = fixture();
  mkdirSync(join(dir, 'assets', 'modules'));
  writeFileSync(join(dir, 'assets', 'modules', 'lazy-route-X1.js'), 'export const route = "Asset Register";');
  writeFileSync(join(dir, 'brand-logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  return dir;
}
function serveExtended(req, res, options = {}) {
  if (req.url === '/') return res.end(html);
  if (req.url === '/assets/index-a1b2.js') return res.end('console.log("ready")');
  if (req.url === '/assets/index-c3d4.css') return res.end('body{margin:0}');
  if (req.url === '/assets/modules/lazy-route-X1.js') {
    if (options.dropLazy) return res.writeHead(404).end();
    return res.end(options.tamperLazy ? 'export const route = "Asset Registar";' : 'export const route = "Asset Register";');
  }
  if (req.url === '/brand-logo.svg') {
    if (options.dropLogo) return res.writeHead(404).end();
    return res.end('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  }
  return res.writeHead(404).end();
}
test('inventory includes lazy route chunks and copied static files not mentioned by HTML', async () => {
  const dir = extendedFixture();
  try {
    const built = inspectBuiltDist(dir);
    assert.deepEqual(built.assets.map(a => a.url), [
      '/assets/index-a1b2.js', '/assets/index-c3d4.css',
      '/assets/modules/lazy-route-X1.js', '/brand-logo.svg',
    ]);
    assert.equal(built.entryAssets.length, 2);
    await serve((req, res) => serveExtended(req, res), async base => {
      assert.equal(await probePreview(base, built), 4);
    });
  } finally {rmSync(dir, {recursive:true, force:true});}
});
test('preview rejects tampered lazy-loaded chunks even when entry JS and CSS are correct', async () => {
  const dir = extendedFixture();
  try {
    const built = inspectBuiltDist(dir);
    await serve((req, res) => serveExtended(req, res, {tamperLazy:true}), async base => {
      await assert.rejects(probePreview(base, built), /lazy-route-X1\.js content differs/);
    });
  } finally {rmSync(dir, {recursive:true, force:true});}
});
test('preview rejects missing emitted lazy chunks or copied public assets', async () => {
  const dir = extendedFixture();
  try {
    const built = inspectBuiltDist(dir);
    for (const options of [{dropLazy:true}, {dropLogo:true}]) {
      await serve((req, res) => serveExtended(req, res, options), async base => {
        await assert.rejects(probePreview(base, built), /responded HTTP 404/);
      });
    }
  } finally {rmSync(dir, {recursive:true, force:true});}
});
test('inventory fails closed for symlinks and empty unreferenced emitted files', () => {
  const dir = extendedFixture();
  try {
    writeFileSync(join(dir, 'assets', 'empty-asset.bin'), '');
    assert.throws(() => inspectBuiltDist(dir), /Empty or invalid emitted asset/);
    rmSync(join(dir, 'assets', 'empty-asset.bin'));
    symlinkSync(join(dir, 'brand-logo.svg'), join(dir, 'assets', 'linked-logo.svg'));
    assert.throws(() => listEmittedFiles(dir), /Unexpected emitted file type or symlink/);
    assert.throws(() => inspectBuiltDist(dir), /Unexpected emitted file type or symlink/);
  } finally {rmSync(dir, {recursive:true, force:true});}
});
