#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const nav=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const caseUi=read('apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx');
const css=read('apps/aim-next/src/styles.css');const runner=read('scripts/release-validation.sh');const evidence=read('scripts/release-evidence.mjs');
const checks=[
 ['one control deck',()=>assert.equal((nav.match(/className="engineering-workspace-control-deck"/g)||[]).length,1)],
 ['single unified scope header',()=>assert(nav.includes('aria-label="Investigation navigation and selected working context"'))],
 ['focus controls preserved',()=>assert(nav.includes('INVESTIGATION_FOCUS_OPTIONS.map'))],
 ['active focus annunciation',()=>assert(nav.includes('role="status" aria-live="polite">Viewing: {focusLabel}'))],
 ['source bridge retained',()=>assert(nav.includes('aria-label="Source to case working path"'))],
 ['source bridge cannot draft without selected',()=>assert(nav.includes('disabled={!selected} onClick={()=>{if(selected)startHandoff(selected,"QUESTION");}}'))],
 ['source index authorization COR',()=>assert(nav.includes('context.corrosion.state==="ready"?corrosion.entries:[]'))],
 ['source index authorization INS',()=>assert(nav.includes('context.inspection.state==="ready"?inspection.entries:[]'))],
 ['page-bounded selection',()=>assert(nav.includes('const selected=page.entries.find(x=>x.key===selectedKey)??null'))],
 ['advanced source disclosure',()=>assert(nav.includes('className="engineering-evidence-advanced"'))],
 ['default all-section compat',()=>assert(nav.includes('open={focusMode==="ALL"}'))],
 ['advanced summary explicit',()=>assert(nav.includes('Trace and compare references'))],
 ['trace behind disclosure',()=>assert(nav.indexOf('className="engineering-evidence-advanced"')<nav.indexOf('className="engineering-evidence-trace"'))],
 ['comparison slots preserved',()=>assert(nav.includes('Use as comparison A')&&nav.includes('Use as comparison B'))],
 ['single-source approval caveat',()=>assert(nav.includes('authorityDescription(selected)'))],
 ['direct case action retained',()=>assert(nav.includes('Add to temporary case')&&nav.includes('Propose a next step'))],
 ['owning record open outside disclosure',()=>assert(nav.indexOf('</details>\n          <button className="engineering-evidence-open"')>0)],
 ['note draft local',()=>assert(caseUi.includes('setDraft(')&&!caseUi.includes('localStorage'))],
 ['focus mode does not unmount case',()=>assert(nav.includes('<EngineeringInvestigationCase assetId={context.asset.id} entries={entries} selected={selected}'))],
 ['responsive deck',()=>assert(css.includes('/* Phase 46.30')&&css.includes('engineering-workspace-control-deck'))],
 ['mobile navigation',()=>assert(css.includes('@media(max-width:600px){.engineering-workspace-control-deck'))],
 ['focus accessible',()=>assert(css.includes('.engineering-evidence-advanced summary:focus-visible'))],
 ['forced color',()=>assert(css.includes('@media(forced-colors:active){.engineering-workspace-control-deck'))],
 ['motion restrained',()=>assert(css.includes('@media(prefers-reduced-motion:reduce){.engineering-evidence-advanced'))],
 ['release gate named',()=>assert(evidence.includes("'phase46_30_workflow_consolidation'"))],
 ['gate command wired',()=>assert(runner.includes('run_gate phase46_30_workflow_consolidation node scripts/phase46-30-consolidation-contract.cjs'))],
 ['no persistence endpoints',()=>assert.doesNotMatch(nav+caseUi,/localStorage|sessionStorage|indexedDB|fetch\(/)],
];let success=0;for(const [name,run] of checks){try{run();success++}catch(e){console.error('FAIL',name);throw e}}console.log(`PASS Phase 46.30 consolidation offline: ${success}/${checks.length}`);
