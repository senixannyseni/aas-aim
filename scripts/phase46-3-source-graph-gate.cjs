#!/usr/bin/env node
'use strict';
/**
 * Phase 46.3 — static TypeScript/TSX import graph verification.
 * Requires the workspace TypeScript compiler (or a local/global compiler for
 * an OFFLINE structural audit). Does NOT replace tsc, Vitest or a real build.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');

const root = path.resolve(__dirname, '..');
const appRequire = createRequire(path.join(root, 'apps/aim-next/package.json'));
const ts = appRequire('@typescript/typescript6');
if (typeof ts.createSourceFile !== 'function' || !ts.ScriptKind) {
  throw new Error('Source graph requires the TypeScript 6 compiler API');
}
const platform = path.join(root, 'packages/aim-platform');
const exportsMap = JSON.parse(fs.readFileSync(path.join(platform, 'package.json'), 'utf8')).exports;

function isWithin(file, dir) {
  return file === dir || file.startsWith(dir + path.sep);
}
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true})
    .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
function resolveRelative(issuer, spec) {
  const bare = spec.split(/[?#]/, 1)[0];
  const target = path.resolve(path.dirname(issuer), bare);
  const variants = [target, ...['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.css','.yaml','.yml','.svg']
    .map(ext => target + ext), ...['index.ts','index.tsx','index.js'].map(name=>path.join(target,name))];
  const resolved = variants.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  assert.ok(resolved, `Unresolved relative import ${spec} in ${path.relative(root, issuer)}`);
  return resolved;
}
function importedSpecifiers(file, source) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  assert.equal(sf.parseDiagnostics.length, 0,
    `TypeScript parse failed in ${path.relative(root, file)}: ${sf.parseDiagnostics.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' ')).join(' | ')}`);
  const imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      imports.push(node.arguments[0].text);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      imports.push(node.moduleReference.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return imports;
}
function audit() {
  const sourceRoots = ['apps/web/src','apps/aim-next/src','packages/aim-platform/src'];
  let files=0, imports=0, platformImports=0, relativeImports=0;
  for (const rel of sourceRoots) {
    const dir = path.join(root, rel);
    for (const file of walk(dir).filter(p => /\.tsx?$/.test(p))) {
      files++;
      const specs = importedSpecifiers(file, fs.readFileSync(file,'utf8'));
      for (const spec of specs) {
        imports++;
        if (spec.startsWith('.')) {
          const target = resolveRelative(file, spec);
          relativeImports++;
          if (isWithin(file,path.join(root,'apps/aim-next/src')) && isWithin(target,path.join(root,'apps/web/src')) ||
              isWithin(file,path.join(root,'apps/web/src')) && isWithin(target,path.join(root,'apps/aim-next/src'))) {
            throw new Error(`Forbidden direct cross-application import: ${path.relative(root,file)} -> ${path.relative(root,target)}`);
          }
        } else if (spec.startsWith('@bandha/aim-platform')) {
          platformImports++;
          const subpath = '.' + spec.slice('@bandha/aim-platform'.length);
          const exported = exportsMap[subpath];
          assert.ok(typeof exported === 'string' && exported.startsWith('./src/'),
            `Unexported platform import ${spec} in ${path.relative(root,file)}`);
          const target = path.resolve(platform, exported);
          assert.ok(isWithin(target,path.join(platform,'src')) && fs.existsSync(target),
            `Platform export target does not exist: ${spec}`);
        } else if (spec.startsWith('apps/web/') || spec.startsWith('apps/aim-next/')) {
          throw new Error(`Forbidden cross-workspace source import ${spec} in ${path.relative(root,file)}`);
        }
      }
    }
  }
  assert.ok(files >= 100 && imports >= 100 && platformImports >= 15,
    `Unexpectedly small graph: ${files} files, ${imports} imports, ${platformImports} shared imports`);
  return {files, imports, relativeImports, platformImports, exports:Object.keys(exportsMap).length};
}
if (require.main === module) {
  try {
    const result=audit();
    console.log(`PASS — Phase 46.3 TypeScript static graph: ${result.files} files; ${result.imports} import references; ${result.relativeImports} local references; ${result.platformImports} shared references; ${result.exports} platform exports. NOT a typecheck.`);
  } catch (error) {console.error(`FAIL — Phase 46.3 source graph: ${error.message}`);process.exitCode=1;}
}
module.exports={audit,importedSpecifiers,resolveRelative};
