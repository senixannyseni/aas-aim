#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const nav=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const caseUI=read('apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx');
const css=read('apps/aim-next/src/styles.css');
const model=read('apps/aim-next/src/features/investigation/engineeringEvidenceModel.ts');
const runner=read('scripts/release-validation.sh');const release=read('scripts/release-evidence.mjs');
let passed=0;function check(name,fn){try{fn();passed++}catch(e){throw new Error(name+': '+e.message)}};
const tests=[
 ['browser region exists',()=>assert(nav.includes('className="engineering-visual-browser" aria-label="Indexed evidence and source detail"'))],
 ['list pane exists',()=>assert(nav.includes('className="engineering-visual-results"'))],
 ['one browser wrapper',()=>assert.equal((nav.match(/className="engineering-visual-browser"/g)||[]).length,1)],
 ['list under pane',()=>assert(nav.indexOf('className="engineering-visual-results"')<nav.indexOf('ref={sourceListRef}'))],
 ['inspector after pane',()=>assert(nav.indexOf('className="engineering-visual-results"')<nav.indexOf('className="engineering-evidence-detail"'))],
 ['comparison external to two pane',()=>assert(nav.includes('className="engineering-evidence-comparison"'))],
 ['scope original remains',()=>assert(nav.includes('context.corrosion.state==="ready"?corrosion.entries:[]'))],
 ['scope inspection remains',()=>assert(nav.includes('context.inspection.state==="ready"?inspection.entries:[]'))],
 ['selection page bounded',()=>assert(nav.includes('const selected=page.entries.find(x=>x.key===selectedKey)??null'))],
 ['no persistent selection',()=>assert.doesNotMatch(nav,/localStorage|sessionStorage|indexedDB/)],
 ['existing keyboard still mounted',()=>assert(nav.includes('nextEvidenceFocusIndex(event.key,index,page.entries.length)'))],
 ['existing keyboard scope',()=>assert(nav.includes('ref={sourceListRef}'))],
 ['native focus modes intact',()=>assert(nav.includes('INVESTIGATION_FOCUS_OPTIONS.map'))],
 ['temporary case remains mounted',()=>assert(nav.includes('<EngineeringInvestigationCase'))],
 ['case notes remain draft',()=>assert(caseUI.includes('Engineer-written draft'))],
 ['case scratchpad limit',()=>assert(caseUI.includes('CASE_NOTE_LIMIT'))],
 ['readonly review remains',()=>assert(caseUI.includes('Read-only · temporary · not submitted'))],
 ['type annotations unchanged',()=>assert(nav.includes('EngineeringEvidence,EvidenceDomain'))],
 ['responsive split at >=1080',()=>assert(css.includes('@media(min-width:1080px){.engineering-visual-browser:has(>.engineering-evidence-detail)'))],
 ['narrow mobile single column',()=>assert(css.includes('@media(max-width:1079px){.engineering-visual-browser{grid-template-columns:minmax(0,1fr)'))],
 ['compact focus rail',()=>assert(css.includes('/* Phase 46.28 — editorial investigation layout.'))],
 ['panel emphasis for reported COR',()=>assert(css.includes('data-origin="COR"]{border-left:3px solid var(--iv-teal)'))],
 ['panel emphasis for reported INS',()=>assert(css.includes('data-origin="INS"]{border-left:3px solid var(--iv-violet)'))],
 ['source details visible',()=>assert(css.includes('>.engineering-evidence-detail dl div:nth-child(even)'))],
 ['source detail stays sticky only desktop',()=>assert(css.includes('position:sticky;top:14px;max-height:min(82vh,900px)'))],
 ['forced colors preserved',()=>assert(css.includes('@media(forced-colors:active){.engineering-visual-browser'))],
 ['reduced motion preserved',()=>assert(css.includes('@media(prefers-reduced-motion:reduce){.engineering-workspace-focus'))],
 ['case desk two column',()=>assert(css.includes('.engineering-case-desk-grid{grid-template-columns:minmax(0,.95fr)'))],
 ['case desk mobile stack',()=>assert(css.includes('@media(max-width:920px){.engineering-journey-bridge'))],
 ['review status never approval',()=>assert(nav.includes('engineering review remain with the owning systems'))],
 ['no invented API in evidence model',()=>assert.doesNotMatch(model,/fetch\s*\(|XMLHttpRequest/)],
 ['registered gate',()=>assert(release.includes("'phase46_28_visual_hierarchy'"))],
 ['invoked gate',()=>assert(runner.includes('run_gate phase46_28_visual_hierarchy node scripts/phase46-28-visual-contract.cjs'))],
];
for(const [label,fn] of tests)check(label,fn);
console.log(`PASS Phase 46.28 hierarchy contracts: ${passed}/${tests.length} (offline static checks; not React/production certification)`);
