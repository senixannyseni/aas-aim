#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'apps/aim-next/src/styles.css'),'utf8');
const base=fs.readFileSync(path.join(root,'docs/brand/BANDHA_V18_PALETTE_MAPPING_46_34.md'),'utf8');
const evidence=fs.readFileSync(path.join(root,'apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx'),'utf8');
const draft=fs.readFileSync(path.join(root,'apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx'),'utf8');
const release=fs.readFileSync(path.join(root,'scripts/release-validation.sh'),'utf8');
const registry=fs.readFileSync(path.join(root,'scripts/release-evidence.mjs'),'utf8');
const phase=css.split('/* Phase 46.35 — Bandha v1.8 visual composition')[1];
assert(phase,'composition CSS section is present');
let n=0;
const ok=(c,msg)=>{assert(c,msg);n++};
for(const token of ['ink','#132123','deep','#101b1d','deep2','#152325','deep3','#1b2a2b','warm','#ebe4d8','paper','#eee9df','paper2','#e2ded3','copper','#c48e65','line','#405050','mint','#9baba0']){
 ok(base.includes(token),'v1.8 source palette contract retains '+token);
}
for(const fragment of [
 '.engineering-visual-browser{gap:0',
 '.engineering-visual-results .engineering-evidence-list{gap:0',
 'max-height:540px',
 '.engineering-visual-browser>.engineering-evidence-detail{background:#f9f6ef',
 '.engineering-evidence-priority dl div{background:transparent',
 '.engineering-workspace-control-deck>.engineering-journey-bridge{margin:0',
 '.engineering-workspace-control-deck>.engineering-workspace-focus-status{position:absolute',
 '.engineering-case-desk-grid{grid-template-columns:minmax(0,.84fr)',
 '.engineering-case-desk-evidence{border-right:1px',
 'max-height:245px',
 'max-width:920px',
 'max-width:800px',
 'max-width:600px',
 'prefers-reduced-motion:reduce',
 'forced-colors:active',
 '.engineering-visual-results .engineering-evidence-list button strong{color:#132123',
 '.engineering-workspace-control-deck .engineering-journey-actions button:nth-child(2):not(:disabled)',
 '.engineering-case-desk-review-strip{border:0',
 'overscroll-behavior:contain',
 '.next-sidebar{width:240px'
]) ok(phase.includes(fragment),'composition rule: '+fragment);
ok(!/font-family\s*:|@import\s+url\(/.test(phase),'phase does not change typography');
ok(css.includes("font-family:'DM Sans'"),'AIM font family unchanged');
ok(css.includes("'Instrument Serif'"),'AIM display font kept');
for(const phrase of ['source scope remains unchanged','source authority and engineering review remain with the owning systems','onInspect={inspectIndexedReference}','focusMode===','role="status" aria-live="polite"'])ok(evidence.includes(phrase),'evidence behavior unchanged: '+phrase);
for(const phrase of ['Editing draft note','save','read-only','removeCaseReference','withdrawnCount','role="status"'])ok(draft.toLowerCase().includes(phrase.toLowerCase()),'case behavior: '+phrase);
ok(release.includes('run_gate phase46_35_visual_composition node scripts/phase46-35-composition-contract.cjs'),'release script declares visual gate');
ok(registry.includes("'phase46_35_visual_composition'"),'release evidence list declares visual gate');
const pos=registry.indexOf("'phase46_34_v18_palette'");
ok(pos>=0 && registry.indexOf("'phase46_35_visual_composition'")>pos,'gate ordering preserves prior phase');
console.log('PASS Phase 46.35 composition and source-boundary contracts '+n+'/'+n);
