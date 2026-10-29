#!/usr/bin/env node
'use strict';
/** Report Vite's actual critical and deferred JS dependency graphs; not a network timing metric. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const manifestFile=path.resolve(__dirname,'../apps/aim-next/dist/.vite/manifest.json');
const dist=path.dirname(path.dirname(manifestFile));
function graphReport(manifest,readSize){
  const entries=Object.entries(manifest);
  const entryKeys=entries.filter(([,node])=>node.isEntry===true).map(([k])=>k);
  if(entryKeys.length!==1) throw Error(`Expected one public application entry, found ${entryKeys.length}`);
  const visit=(keys)=>{
    const seen=new Set();
    const walk=k=>{
      if(seen.has(k))return;
      const entry=manifest[k];
      if(!entry||typeof entry.file!=='string')throw Error(`Malformed Vite manifest reference: ${k}`);
      seen.add(k);
      for(const dep of entry.imports??[])walk(dep);
    };
    keys.forEach(walk);
    return seen;
  };
  const initial=visit(entryKeys);
  const deferredRootKeys=entries.filter(([,entry])=>entry.isDynamicEntry===true).map(([k])=>k);
  const all=visit([...entryKeys,...deferredRootKeys]);
  const summarize=keys=>{
    const items=[...keys].map(k=>manifest[k].file).filter(f=>/\.(?:m?js)$/.test(f));
    const unique=[...new Set(items)];
    return {chunks:unique.length,bytes:unique.reduce((sum,file)=>sum+readSize(file),0),files:unique};
  };
  const loaded=summarize(initial);
  const deferred=summarize(new Set([...all].filter(k=>!initial.has(k))));
  return {entryKeys,lazyEntries:deferredRootKeys.length,initial:loaded,deferred,total:loaded.bytes+deferred.bytes};
}
module.exports={graphReport};
if(require.main===module){
 try{
   const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
   const report=graphReport(manifest,file=>{
     const absolute=path.resolve(dist,file);
     if(!absolute.startsWith(dist+path.sep)||!fs.statSync(absolute).isFile()) throw Error(`Unsafe/missing emitted asset ${file}`);
     return fs.statSync(absolute).size;
   });
   if(report.lazyEntries<14)throw Error(`Expected at least 14 deferred domain entries; found ${report.lazyEntries}`);
   if(report.initial.chunks<1)throw Error('Missing entry JavaScript');
   console.log(`PASS Phase 46.7 manifest: ${report.initial.chunks} initial JS files (${report.initial.bytes} B); `+
     `${report.deferred.chunks} deferred JS files (${report.deferred.bytes} B); ${report.lazyEntries} async entry modules.`);
   console.log('Manifest graph only. Runtime network fetching, session isolation, startup speed and UX require independent browser checks.');
 }catch(error){console.error(`FAIL Phase 46.7 manifest graph: ${error.message}`);process.exitCode=1;}
}
