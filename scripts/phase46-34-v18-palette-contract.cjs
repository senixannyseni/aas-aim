#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');let n=0;
const css=fs.readFileSync(path.join(root,'apps/aim-next/src/styles.css'),'utf8');
const spec=fs.readFileSync(path.join(root,'docs/brand/BANDHA_V18_PALETTE_MAPPING_46_34.md'),'utf8');
const release=fs.readFileSync(path.join(root,'scripts/release-validation.sh'),'utf8');
const evidence=fs.readFileSync(path.join(root,'scripts/release-evidence.mjs'),'utf8');
const block=css.split('/* Phase 46.34 — verified Bandha Integrated Website v1.8 palette.')[1];
function c(s,b){assert.ok(b,s);n++;}
c('Dedicated final cascade',!!block&&block.length>3000);
for(const [key,value] of Object.entries({'ink':'#132123','deep':'#101b1d','deep-2':'#152325','deep-3':'#1b2a2b','warm':'#ebe4d8','paper':'#eee9df','paper-2':'#e2ded3','copper':'#c48e65','line':'#405050','mint':'#9baba0'})){
  c('v1.8 exact token '+key,block.includes(`--bandha-v18-${key}:${value}`));
  c('documented token '+key,spec.includes('`'+value+'`'));
}
for(const sel of ['.next-sidebar{','.next-topbar{','.next-main{','.next-domain-nav.active','.engineering-case-source-card[data-origin=COR]','.engineering-case-source-card[data-origin=INS]','.engineering-case-draft-note{','.engineering-case-compose-actions button[type=submit]',':focus-visible','@media(forced-colors:active)','@media(prefers-reduced-motion:reduce)'])c('layout/role '+sel,block.includes(sel));
c('Prior DM Sans font preserved',css.includes("--bandha-sans:'DM Sans'"));
c('Prior Instrument Serif font preserved',css.includes("--bandha-serif:'Instrument Serif'"));
c('No v1.8 imported font names',!block.includes('Iowan Old Style')&&!block.includes('Baskerville')&&!block.includes('font-family:'));
c('Spec promises no font copy',spec.includes('are not imported'));
c('Release script',release.includes('phase46_34_v18_palette')&&release.includes('phase46-34-v18-palette-contract.cjs'));
c('Release evidence gate',evidence.includes("'phase46_34_v18_palette'"));
console.log(`PASS Phase 46.34 v1.8 palette contracts ${n}/${n}`);
