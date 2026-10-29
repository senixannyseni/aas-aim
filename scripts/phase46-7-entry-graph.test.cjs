'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {graphReport}=require('./phase46-7-entry-graph.cjs');
const fixture={
 'src/main.tsx':{file:'assets/main.js',isEntry:true,imports:['_react.js']},
 '_react.js':{file:'assets/react.js'},
 'src/COR.tsx':{file:'assets/cor.js',isDynamicEntry:true,imports:['_react.js','_common.js']},
 'src/INS.tsx':{file:'assets/ins.js',isDynamicEntry:true,imports:['_react.js']},
 '_common.js':{file:'assets/common.js'},
};
test('entry graph excludes deferred chunks from initial download',()=>{
 const result=graphReport(fixture,()=>1024);
 assert.equal(result.initial.bytes,2048);
 assert.equal(result.deferred.bytes,3072);
 assert.equal(result.lazyEntries,2);
 assert.equal(result.total,5120);
});
test('shared deps counted once in initial graph',()=>{
 const result=graphReport(fixture,()=>10);
 assert.deepEqual(new Set(result.initial.files),new Set(['assets/main.js','assets/react.js']));
 assert.deepEqual(new Set(result.deferred.files),new Set(['assets/cor.js','assets/ins.js','assets/common.js']));
});
test('cycles in imported chunks cannot loop forever',()=>{
 const variant={...fixture, '_react.js':{file:'assets/react.js',imports:['src/main.tsx']}};
 assert.equal(graphReport(variant,()=>1).total,5);
});
test('fail closed with missing or multiple entry or unknown import',()=>{
 assert.throws(()=>graphReport({},()=>1),/one public application/);
 assert.throws(()=>graphReport({...fixture,'secondary':{file:'secondary.js',isEntry:true}},()=>1),/one public application/);
 assert.throws(()=>graphReport({...fixture,'src/COR.tsx':{file:'cor.js',isDynamicEntry:true,imports:['_absent.js']}},()=>1),/Malformed/);
});
