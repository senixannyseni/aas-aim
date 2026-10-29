#!/usr/bin/env node
'use strict';
/**
 * Phase 46.6: enforce a measurable initial build-size ceiling without implying
 * faster loading, production approval, or a verified performance improvement.
 * Vite's own output and release SHA-256 checks remain separately mandatory.
 */
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');

const KiB=1024;
const LIMITS=Object.freeze({
  maximumChunkBytes:768*KiB,
  maximumChunkGzipBytes:220*KiB,
  maximumTotalJavascriptBytes:1024*KiB,
  maximumStylesBytes:192*KiB,
});
function auditBundle(distRoot,limits=LIMITS){
  if(!fs.existsSync(distRoot)||!fs.statSync(distRoot).isDirectory())throw Error('Build output is absent');
  const output=[];
  function visit(dir){
    for(const dirent of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,dirent.name);
      if(dirent.isSymbolicLink())throw Error(`Symlink in build output: ${p}`);
      if(dirent.isDirectory())visit(p);
      else if(dirent.isFile()){
        const b=fs.readFileSync(p);
        if(b.length===0)throw Error(`Empty emitted file: ${p}`);
        const rel=path.relative(distRoot,p).replaceAll(path.sep,'/');
        output.push({name:rel,bytes:b.length,gzipBytes:zlib.gzipSync(b).length});
      }else throw Error(`Non-regular output entry: ${p}`);
    }
  }
  visit(distRoot);
  if(!output.some(x=>x.name==='index.html'))throw Error('No production index.html');
  const js=output.filter(x=>/\.m?js$/.test(x.name));
  const styles=output.filter(x=>/\.css$/.test(x.name));
  if(!js.length||!styles.length)throw Error('No emitted JS/CSS bundle');
  const oversize=js.find(x=>x.bytes>limits.maximumChunkBytes||x.gzipBytes>limits.maximumChunkGzipBytes);
  if(oversize)throw Error(`AIM Next JS size budget exceeded: ${oversize.name} (${oversize.bytes} B raw, ${oversize.gzipBytes} B gzip)`);
  const totalJs=js.reduce((n,x)=>n+x.bytes,0);
  if(totalJs>limits.maximumTotalJavascriptBytes)throw Error(`Total JS exceeds budget: ${totalJs} bytes`);
  const totalCss=styles.reduce((n,x)=>n+x.bytes,0);
  if(totalCss>limits.maximumStylesBytes)throw Error(`Total CSS exceeds budget: ${totalCss} bytes`);
  return {javascript:js,styles,totalJs,totalCss};
}
module.exports={LIMITS,auditBundle};
if(require.main===module){
  try{
    const output=auditBundle(path.resolve(__dirname,'../apps/aim-next/dist'));
    const largest=output.javascript.toSorted((a,b)=>b.bytes-a.bytes)[0];
    console.log(`PASS Phase 46.6 build budget: ${output.javascript.length} JS chunks, `+
      `${output.totalJs} B total JS, ${output.totalCss} B CSS; largest ${largest.name}: `+
      `${largest.bytes} B raw / ${largest.gzipBytes} B gzip.`);
    console.log('Size gate only. Does not measure execution time, startup speed, or actual network transfer.');
  }catch(error){console.error(`FAIL Phase 46.6 build budget: ${error.message}`);process.exitCode=1;}
}
