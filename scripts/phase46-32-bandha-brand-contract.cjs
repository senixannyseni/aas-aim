#!/usr/bin/env node
'use strict';
/** Phase 46.32: contractual source checks, never a mounted UI runtime claim. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const old=fs.readFileSync(path.join(base,'apps/aim-next/src/styles.css'),'utf8');
const guide=fs.readFileSync(path.join(base,'docs/brand/BANDHA_UI_SYSTEM.md'),'utf8');
let passed=0;
function check(label,predicate){assert.ok(predicate,label);passed++;}
const tokens={paper:'#f5efe6','paper-2':'#efe5d8',ink:'#35291f',copper:'#925436',walnut:'#30251f','walnut-2':'#453329',line:'#ceb9a5'};
for(const [key,value] of Object.entries(tokens)) check(`Bandha token ${key}`,old.includes(`--bandha-${key}:${value}`));
for(const key of ['--bandha-surface','--bandha-muted','--bandha-olive','--bandha-plum','--bandha-danger','--bandha-serif','--bandha-sans']) check(`semantic token ${key}`,old.includes(key+':'));
for(const marker of ["family=DM+Sans",'Instrument+Serif','font-family:var(--bandha-serif)','font-family:var(--bandha-sans)']) check(`typography ${marker}`,old.includes(marker));
for(const marker of ['.next-sidebar{background:var(--bandha-walnut)','background-image:radial-gradient','.next-topbar{background:rgba(245,239,230,.95)','.next-main{background-image:','.engineering-evidence,.engineering-investigation-case','.engineering-case-source-card[data-origin="COR"]','.engineering-case-source-card[data-origin="INS"]','.engineering-origin-tag[data-origin="DRAFT"]']) check(`component theme ${marker}`,old.includes(marker));
for(const marker of ['@media(prefers-reduced-motion:reduce)','@media(forced-colors:active)',':focus-visible{outline:3px solid var(--bandha-copper)']) check(`accessibility ${marker}`,old.includes(marker));
for(const marker of ['one identity, two expressions','Bandha','DM Sans','Instrument Serif','#925436','COR','INS'])check(`document ${marker}`,guide.includes(marker));
// Historical dark shell colors and font aren't kept in new declarations.
for(const marker of ['#0b101a','#0d1520','Manrope,sans-serif'])check(`legacy removed ${marker}`,!old.includes(marker));
// No mutation of actual evidence records or export/approval endpoints in this phase.
check('no scripts embedded in brand stylesheet',!/<script\b/i.test(old));
console.log(`PASS Phase 46.32 Bandha brand contracts ${passed}/${passed}`);
