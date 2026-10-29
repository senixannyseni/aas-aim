#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('./phase46-2-source-loader.cjs');
const {investigationJourney}=require('../apps/aim-next/src/features/investigation/investigationJourneyModel.ts');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const caseUI=read('apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx');
const model=read('apps/aim-next/src/features/investigation/investigationJourneyModel.ts');
const css=read('apps/aim-next/src/styles.css');
const runner=read('scripts/release-validation.sh');const release=read('scripts/release-evidence.mjs');
const source={key:'C1',domain:'COR',reference:'CALC-1',kind:'Calculation trace',ownerRecordId:'C-10',sourceRecordId:'S-1',status:'DRAFT',authority:'SOURCE_REFERENCE'};
let count=0;function check(label,fn){try{fn();count++;}catch(e){throw Error(label+': '+e.message);}}
for(const [label,fn] of [
 ['no selection',()=>assert.equal(investigationJourney([source],null).pointer,null)],
 ['missing key',()=>assert.equal(investigationJourney([source],'UNKNOWN').status,'NO_SELECTION')],
 ['current source',()=>assert.equal(investigationJourney([source],'C1').pointer.reference,'CALC-1')],
 ['owner provenance',()=>assert.equal(investigationJourney([source],'C1').pointer.ownerRecordId,'C-10')],
 ['domain provenance',()=>assert.equal(investigationJourney([source],'C1').pointer.domain,'COR')],
 ['INS source isolation',()=>assert.equal(investigationJourney([{...source,key:'I1',domain:'INS'}],'C1').pointer,null)],
 ['no invented payload',()=>assert.deepEqual(Object.keys(investigationJourney([source],'C1').pointer).sort(),['domain','key','kind','ownerRecordId','reference'])],
 ['withdrawal',()=>assert.equal(investigationJourney([],'C1').pointer,null)],
 ['no transport code',()=>assert.doesNotMatch(model,/fetch\s*\(|localStorage|sessionStorage|XMLHttpRequest|indexedDB/)],
 ['no approval in model',()=>assert.doesNotMatch(model,/setApproved|grantPermission|markReviewed/)],
 ['journey derived from current-page selected',()=>assert(ui.includes('investigationJourney(entries,selected?.key??null)'))],
 ['selected constrained to page',()=>assert(ui.includes('const selected=page.entries.find(x=>x.key===selectedKey)??null'))],
 ['journey supports evidence step',()=>assert(ui.includes('1 · Explore evidence'))],
 ['journey supports note step',()=>assert(ui.includes('2 · Draft a question'))],
 ['journey supports review step',()=>assert(ui.includes('3 · Review working material'))],
 ['note step disabled when unselected',()=>assert(ui.includes('disabled={!selected}'))],
 ['handoff rechecked',()=>assert(ui.includes('if(selected)startHandoff(selected,"QUESTION")'))],
 ['review request monotonic',()=>assert(ui.includes('setReviewRequest(current=>current+1)'))],
 ['review request forwarded',()=>assert(ui.includes('reviewRequest={reviewRequest}'))],
 ['case remains mounted inside focus panel',()=>assert(ui.includes('<EngineeringInvestigationCase'))],
 ['review focuses summary',()=>assert(caseUI.includes("reviewDisclosure.current.querySelector('summary')?.focus()"))],
 ['review does not submit notes',()=>assert(caseUI.includes('No submission, export, download'))],
 ['review only increment request',()=>assert(caseUI.includes('reviewRequest<=lastReviewRequest.current'))],
 ['case back navigation',()=>assert(caseUI.includes('Back to Evidence Explorer'))],
 ['return action passed',()=>assert(ui.includes('onReturnToEvidence={()=>setFocusMode("EVIDENCE")}'))],
 ['case keeps handoff guards',()=>assert(caseUI.includes('stageEvidenceHandoff(draft,assetId,entries,handoffRequest)'))],
 ['scope remount source',()=>assert(read('apps/aim-next/src/features/investigation/CrossDomainInvestigation.tsx').includes('key={JSON.stringify([props.navigationScopeKey'))],
 ['accessible journey',()=>assert(ui.includes('aria-label="Source to case working path"'))],
 ['responsive CSS',()=>assert(css.includes('@media(max-width:480px){.engineering-journey-bridge'))],
 ['forced color CSS',()=>assert(css.includes('@media(forced-colors:active){.engineering-journey-bridge'))],
 ['keyboard focus CSS',()=>assert(css.includes('.engineering-journey-actions button:focus-visible'))],
 ['no UI transport',()=>assert.doesNotMatch(ui,/fetch\s*\(|localStorage|sessionStorage|XMLHttpRequest|indexedDB/)],
 ['release registered',()=>assert(release.includes("'phase46_26_unified_journey'"))],
 ['release executed',()=>assert(runner.includes('run_gate phase46_26_unified_journey node scripts/phase46-26-journey-contract.cjs'))],
])check(label,fn);
console.log(`PASS Phase 46.26 unified source-to-case path: ${count}/${count} (offline; React tests not run)`);
