#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');let n=0;
const css=fs.readFileSync(path.join(root,'apps/aim-next/src/styles.css'),'utf8');
const provenance=fs.readFileSync(path.join(root,'docs/brand/BANDHA_TWO_ATMOSPHERES_46_33.md'),'utf8');
const release=fs.readFileSync(path.join(root,'scripts/release-validation.sh'),'utf8');
const gates=fs.readFileSync(path.join(root,'scripts/release-evidence.mjs'),'utf8');
function c(label,yes){assert.ok(yes,label);n++}
for(const [key,val] of Object.entries({'engineering':'#102123','engineering-mid':'#1c3333','engineering-blue':'#113942','engineering-deep':'#09222e','paper':'#f3ede4','paper-2':'#eae1d4','surface':'#fffaf2','ink':'#2a211d','copper':'#b27850'}))c('Token '+key,css.includes(`--bandha-${key}:${val}`));
for(const sel of ['.next-sidebar{','.next-brand{','.next-nav-main.active','.next-topbar{','.next-primary-button','.engineering-evidence-priority{','.engineering-case-source-card[data-origin=COR]','.engineering-case-source-card[data-origin=INS]','.engineering-case-draft-note{',':focus-visible{','@media(forced-colors:active)','@media(prefers-reduced-motion:reduce)'])c('UI selector '+sel,css.slice(css.indexOf('/* Phase 46.33:')).includes(sel));
for(const value of ['Bandha Integrated Website v1.8','not present','V25/V26','#102123','#113942','#09222e','synthetic'])c('Evidence caveat '+value,provenance.toLowerCase().includes(value.toLowerCase()));
for(const value of ['phase46_33_two_atmospheres','phase46-33-two-atmospheres-contract.cjs'])c('Release integration '+value,release.includes(value));
c('Evidence gate entry',gates.includes("'phase46_33_two_atmospheres'"));
console.log(`PASS Phase 46.33 two-atmosphere contracts ${n}/${n}`);
