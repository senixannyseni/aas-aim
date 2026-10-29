'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {auditBundle,LIMITS}=require('./phase46-6-bundle-audit.cjs');
function temporary(action){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aim-bundle-audit-'));
  try{return action(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function seed(dir){
  fs.mkdirSync(path.join(dir,'assets'));
  fs.writeFileSync(path.join(dir,'index.html'),'<script src="assets/index.js"></script><link href="assets/index.css" rel="stylesheet">');
  fs.writeFileSync(path.join(dir,'assets/index.js'),'console.log("bundle");');
  fs.writeFileSync(path.join(dir,'assets/index.css'),'body{color:red}');
}
test('counts emitted JS and CSS bytes and gzip, without using file names as evidence',()=>temporary(dir=>{
  seed(dir);
  const r=auditBundle(dir);
  assert.equal(r.javascript.length,1);
  assert.equal(r.styles.length,1);
  assert.ok(r.javascript[0].gzipBytes>0);
}));
test('fails closed on absent production output and empty builds',()=>temporary(dir=>{
  assert.throws(()=>auditBundle(path.join(dir,'absent')),/absent/);
  assert.throws(()=>auditBundle(dir),/index.html/);
  seed(dir);
  fs.writeFileSync(path.join(dir,'assets/index.js'),'');
  assert.throws(()=>auditBundle(dir),/Empty/);
}));
test('fails on raw and gzip chunk budget breaches',()=>temporary(dir=>{
  seed(dir);
  const max={...LIMITS,maximumChunkBytes:3};
  assert.throws(()=>auditBundle(dir,max),/budget/);
  const gzip={...LIMITS,maximumChunkGzipBytes:1};
  assert.throws(()=>auditBundle(dir,gzip),/budget/);
}));
test('fails on aggregate JS and CSS size budget breaches',()=>temporary(dir=>{
  seed(dir);
  assert.throws(()=>auditBundle(dir,{...LIMITS,maximumTotalJavascriptBytes:5}),/Total JS/);
  assert.throws(()=>auditBundle(dir,{...LIMITS,maximumStylesBytes:5}),/Total CSS/);
}));
test('rejects emitted symlinks instead of following out-of-tree data',()=>temporary(dir=>{
  seed(dir);
  fs.symlinkSync(path.join(dir,'index.html'),path.join(dir,'assets','linked.html'));
  assert.throws(()=>auditBundle(dir),/Symlink/);
}));
