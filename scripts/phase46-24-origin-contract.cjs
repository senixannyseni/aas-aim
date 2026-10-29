#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('./phase46-2-source-loader.cjs');
const {describeSourceOrigin,describeWorkingNoteOrigin}=require('../apps/aim-next/src/features/investigation/evidenceOriginPresentation.ts');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=read('apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx');
const nav=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const css=read('apps/aim-next/src/styles.css');
const model=read('apps/aim-next/src/features/investigation/evidenceOriginPresentation.ts');
const r=read('scripts/release-evidence.mjs'),v=read('scripts/release-validation.sh');
let pass=0;function test(name,fn){try{fn();pass++;}catch(e){throw Error(name+': '+e.message);}}
for(const domain of ['COR','INS'])for(const authority of ['SOURCE_REFERENCE','DUE_CANDIDATE','GOVERNING_INS_DECISION','TECHNICAL_REVIEW']){
 test(domain+' '+authority,()=>{const x=describeSourceOrigin({domain,authority});assert.equal(x.domain,domain);assert.equal(x.label,domain+' · source-reported');assert(x.authorityLabel.includes('Reported')||x.authorityLabel.includes('source'));assert(Object.isFrozen(x));});
}
for(const domain of ['COR','INS'])test('source-bound draft '+domain,()=>{const n=describeWorkingNoteOrigin({domain});assert.equal(n.label,'Engineer-written draft');assert(n.attachmentLabel.includes(domain));assert(n.attachmentLabel.includes('not verified support'));});
test('unlinked draft explicit',()=>assert.equal(describeWorkingNoteOrigin(null).attachmentLabel,'No indexed source attached'));
test('no transport/persistence/approval',()=>assert.doesNotMatch(model,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest|approved\s*:/));
test('COR no INS due inference',()=>assert(describeSourceOrigin({domain:'COR',authority:'SOURCE_REFERENCE'}).explanatoryText.includes('no INS governing date')));
test('INS authority remains owning source',()=>assert(describeSourceOrigin({domain:'INS',authority:'TECHNICAL_REVIEW'}).explanatoryText.includes('owning INS record')));
test('source tag in case reference',()=>assert(ui.includes('data-origin={item.domain}')));
test('draft tag on working note',()=>assert(ui.includes('data-note-kind={note.kind}')));
test('source index status is source reported',()=>assert(ui.includes('reported state {item.status}')));
test('draft always user entered',()=>assert(ui.includes('Engineer-written draft')));
test('case still projects against authorized entries',()=>assert(ui.includes('projectInvestigationCase(draft,assetId,entries)')));
test('case handoff uses authorized entries',()=>assert(ui.includes('stageEvidenceHandoff(draft,assetId,entries,handoffRequest)')));
test('case retains zero-trust note body',()=>assert(ui.includes('value={noteText}')));
test('source detail origin from authorized selected',()=>assert(nav.includes('describeSourceOrigin(selected)')));
test('note origins not promoted in provenance detail',()=>assert(nav.includes('Any notes drafted from this pointer remain separate')));
test('both source classes style',()=>assert(css.includes('.engineering-origin-tag[data-origin="COR"]')&&css.includes('.engineering-origin-tag[data-origin="INS"]')));
test('draft style distinct',()=>assert(css.includes('.engineering-origin-tag[data-origin="DRAFT"]')));
test('forced colors accessible',()=>assert(css.includes('@media(forced-colors:active){.engineering-origin-tag')));
test('mobile stacked legend',()=>assert(css.includes('.engineering-origin-guide{grid-template-columns:1fr}')));
test('release gate registered',()=>assert(r.includes("'phase46_24_origin_boundary'")));
test('release runner included',()=>assert(v.includes('run_gate phase46_24_origin_boundary node scripts/phase46-24-origin-contract.cjs')));
test('no new endpoints in model',()=>assert(!model.includes('http://')&&!model.includes('https://')));
console.log(`PASS Phase 46.24 source/draft distinction offline contract ${pass}/${pass} (not mounted React)`);
