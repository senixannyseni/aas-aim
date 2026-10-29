'use strict';
/** Isolated model regression runner; limited Vitest assertions, not the official Vitest suite. */
const cp=require('node:child_process');
// TypeScript 7 provides the native `tsc` CLI, but intentionally has no
// transpileModule/ModuleKind JavaScript API. Use the official TS6 compatibility
// package for this isolated, CommonJS-based offline regression runner.
function compiler(){
  if(process.env.TS_COMPILER_PATH)return require(require('node:path').resolve(process.env.TS_COMPILER_PATH));
  try{return require('@typescript/typescript6');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
  // Allow dependency-free local smoke checks using an existing TS <=6 API.
  // CI installs the explicitly pinned compatibility package above.
  try{return require('typescript');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
  const globalRoot=cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
  return require(require('node:path').join(globalRoot,'typescript'));
}
const ts=compiler();
if (typeof ts.transpileModule!=='function' || ts.ModuleKind?.CommonJS===undefined ||
    ts.ScriptTarget?.ES2022===undefined || ts.JsxEmit?.ReactJSX===undefined) {
  throw new Error('Offline regression runner needs the TypeScript 6 compiler API. Install @typescript/typescript6@6.0.2 (pnpm install), or set TS_COMPILER_PATH to an API-compatible compiler. TypeScript 7 only exposes the native CLI.');
}
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../src');
const cache=new Map(),tests=[];
let section=[];
/** Check every expected field recursively; extra actual object fields are allowed. */
function assertMatchesObject(actual,expected,location='value') {
  if (expected===null || typeof expected!=='object') {
    assert.deepStrictEqual(actual,expected,`${location}: value differs`);
    return;
  }
  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual),`${location}: expected an array`);
    assert.strictEqual(actual.length,expected.length,`${location}: array length differs`);
    for (let i=0;i<expected.length;i++) assertMatchesObject(actual[i],expected[i],`${location}[${i}]`);
    return;
  }
  if (Object.getPrototypeOf(expected)!==Object.prototype && Object.getPrototypeOf(expected)!==null) {
    assert.deepStrictEqual(actual,expected,`${location}: value differs`);
    return;
  }
  assert.ok(actual!==null && typeof actual==='object' && !Array.isArray(actual),`${location}: expected object`);
  for (const key of Reflect.ownKeys(expected)) {
    assert.ok(Object.prototype.hasOwnProperty.call(actual,key),`${location}: missing own property ${String(key)}`);
    assertMatchesObject(actual[key],expected[key],`${location}.${String(key)}`);
  }
}
function expect(actual) {
  const make=(negated=false)=>{
    const compare=(fn)=> (expected)=>{let error=null;try{fn(expected)}catch(e){error=e;};if(negated){if(!error)throw new assert.AssertionError({message:`Expected not: ${String(actual)} / ${String(expected)}`,actual,expected})}else if(error)throw error;};
    const obj={
      toBe:compare(expected=>assert.strictEqual(actual,expected)),
      toEqual:compare(expected=>assert.deepStrictEqual(actual,expected)),
      toMatchObject:compare(expected=>assertMatchesObject(actual,expected)),
      toHaveLength:compare(expected=>assert.strictEqual(actual?.length,expected)),
      toBeGreaterThan:compare(expected=>assert.ok(actual>expected,`${actual} not greater than ${expected}`)),
      toBeNull:compare(()=>assert.strictEqual(actual,null)),
      toBeUndefined:compare(()=>assert.strictEqual(actual,undefined)),
      toBeTruthy:compare(()=>assert.ok(actual)),
      toBeFalsy:compare(()=>assert.ok(!actual)),
      toContain:compare(expected=>assert.ok(actual?.includes(expected),`does not contain ${expected}`)),
      toHaveProperty:compare(expected=>assert.ok(expected.split('.').reduce((v,k)=>v?.[k],actual)!==undefined,`missing ${expected}`)),
      toThrow:compare(expected=>assert.throws(actual,typeof expected==='string'?new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')):expected)),
    };
    Object.defineProperty(obj,'not',{get:()=>make(!negated)});return obj;
  };return make();
}
function register(label,fn){tests.push([section.concat([label]).join(' > '),fn]);}
function format(s,v){return s.replace(/%[sd#]/,()=>String(v));}
const it=(label,fn)=>register(label,fn);
it.each=(cases)=>(label,fn)=>cases.forEach((val,i)=>register(format(label,val),()=>fn(...(Array.isArray(val)?val:[val]))));
const describe=(label,fn)=>{section.push(label);try{fn()}finally{section.pop()}};
describe.each=(cases)=>(label,fn)=>cases.forEach(v=>describe(format(label,v),()=>fn(...(Array.isArray(v)?v:[v]))));
const vitest={describe,it,test:it,expect};
function resolveModule(spec,owner){
 if(spec==='vitest')return vitest;
 if(!spec.startsWith('.'))return require(spec);
 const p=path.resolve(path.dirname(owner),spec);
 for(const f of [p,p+'.ts',p+'.tsx',p+'/index.ts'])if(fs.existsSync(f)&&fs.statSync(f).isFile())return load(f);
 throw Error(`Could not resolve ${spec} from ${owner}`);
}
function load(f){f=path.resolve(f);if(cache.has(f))return cache.get(f).exports;
 const source=fs.readFileSync(f,'utf8');const output=ts.transpileModule(source,{fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};cache.set(f,mod);try{new vm.Script(`(function(exports,require,module,__filename,__dirname){${output}\n})`,{filename:f}).runInThisContext()(mod.exports,(n)=>resolveModule(n,f),mod,f,path.dirname(f));}catch(e){cache.delete(f);throw e};return mod.exports;
}
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);}
// Only synchronous, dependency-free model suites belong in this lightweight
// runner. Shared-data API contract tests use real Vitest mocks and async
// assertions; they are executed by the canonical React/Vitest release gate.
// Separate Stage 45/46 transport smoke tests cover their core request paths.
const files=walk(root).filter(f=>
  /(Model\.test\.ts|capabilityRegistry\.test\.ts|screenRouting\.test\.ts|workspaceResolver\.test\.ts)$/.test(f) &&
  !f.includes(path.join("shared", "data") + path.sep)
).sort();
let loadFails=0;for(const file of files)try{load(file)}catch(e){console.error('LOAD FAILED:',path.relative(root,file),e.stack);loadFails++;}
let fails=0;const durations=[];for(const [name,fn] of tests){const started=performance.now();try{fn();}catch(e){fails++;console.error('FAIL:',name,'\n',e.stack||e.message);}durations.push(performance.now()-started);}
console.log(`Phase 21 offline model/registry/dispatch regressions (NOT Vitest): ${tests.length-fails}/${tests.length} passed; ${files.length-loadFails}/${files.length} suites loaded; ${loadFails} load failures; max time ${Math.max(...durations).toFixed(1)}ms`);
if(loadFails||fails)process.exitCode=1;
