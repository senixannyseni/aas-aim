#!/usr/bin/env node
'use strict';
/** Offline source/model assertions ONLY; does not execute React, Vite or approval. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
require('./phase46-2-source-loader.cjs');
const {summarizeCaseDesk}=require('../apps/aim-next/src/features/investigation/investigationCaseDesk.ts');
const {emptyInvestigationCase,addCaseReference,addCaseNote,projectInvestigationCase}=require('../apps/aim-next/src/features/investigation/evidenceCase.ts');
const {prepareInvestigationReview}=require('../apps/aim-next/src/features/investigation/evidenceReviewPreparation.ts');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const model=read('apps/aim-next/src/features/investigation/investigationCaseDesk.ts');
const ui=read('apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx');
const css=read('apps/aim-next/src/styles.css');
const shell=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const release=read('scripts/release-evidence.mjs');
const runner=read('scripts/release-validation.sh');
let count=0;function check(label,fn){try{fn();count++;}catch(e){throw Error(label+': '+e.message);}}
const source={key:'COR:X1',domain:'COR',kind:'Calculation trace',sourceRecordId:'X1',ownerRecordId:'O1',reference:'CALC-X1',revision:null,reportedAt:null,status:null,supportingReference:null,authority:'SOURCE_REFERENCE'};
const sources=[{domain:'COR',state:'ready',indexed:1,totalReported:3,truncated:true},{domain:'INS',state:'disconnected',indexed:0,totalReported:0,truncated:false}];
let draft=emptyInvestigationCase('A1');
draft=addCaseReference(draft,'A1',source.key,[source]);
draft=addCaseNote(draft,'A1','QUESTION','Check source',source.key,[source]);
draft=addCaseNote(draft,'A1','OBSERVATION','Draft observation',null,[source]);
draft=addCaseNote(draft,'A1','NEXT_STEP','Proposed follow-up',null,[source]);
const summary=summarizeCaseDesk(prepareInvestigationReview(projectInvestigationCase(draft,'A1',[source]),sources));
for(const [field,expected] of Object.entries({referenceCount:1,noteCount:3,questionCount:1,observationCount:1,nextStepCount:1,unlinkedCount:2,limitedSourceCount:2,withdrawnReferenceCount:0})){
 check('descriptive count '+field,()=>assert.equal(summary[field],expected));
}
check('immutable overview',()=>assert(Object.isFrozen(summary)));
const withdrawn=summarizeCaseDesk(prepareInvestigationReview(projectInvestigationCase(draft,'A1',[]),sources));
check('withdrawn pointer hidden',()=>assert.equal(withdrawn.referenceCount,0));
check('anchored question hidden',()=>assert.equal(withdrawn.questionCount,0));
check('only unlinked notes retained',()=>assert.equal(withdrawn.noteCount,2));
check('withdrawn count explicit',()=>assert.equal(withdrawn.withdrawnReferenceCount,1));
check('wrong asset fails closed',()=>assert.equal(summarizeCaseDesk(prepareInvestigationReview(projectInvestigationCase(draft,'A2',[source]))).referenceCount,0));
check('source field not a readiness score',()=>assert.equal('readiness' in summary,false));
check('no technical authority produced',()=>assert.equal('approved' in summary,false));
check('no transport in summary model',()=>assert.doesNotMatch(model,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest/));
check('case uses filtered review as overview input',()=>assert(ui.includes('summarizeCaseDesk(review)')));
check('case retains original projected source scope',()=>assert(ui.includes('projectInvestigationCase(draft,assetId,entries)')));
check('case retains source handoff recheck',()=>assert(ui.includes('stageEvidenceHandoff(draft,assetId,entries,handoffRequest)')));
check('case retains source toolbar',()=>assert(ui.includes('Add selected indexed reference to case')));
check('source-specific note uses key, not source object',()=>assert(ui.includes('setAttachedKey(item.key)')));
check('source-specific focus',()=>assert(ui.includes('noteFieldRef.current?.focus()')));
check('notes stay manually entered',()=>assert(ui.includes('value={noteText}')));
check('note character limit retained',()=>assert(ui.includes('maxLength={CASE_NOTE_LENGTH}')));
check('note overflow disabled',()=>assert(ui.includes('working.notes.length>=CASE_NOTE_LIMIT')));
check('pointer withdrawal still blocks note submit',()=>assert(ui.includes('working.withdrawnCount>0')));
check('review preview stays read-only',()=>assert(ui.includes('Open read-only review preview')));
check('no new storage/network in case UI',()=>assert.doesNotMatch(ui,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest/));
check('case remains mounted in focus switches',()=>assert(shell.includes('<EngineeringInvestigationCase')));
check('2-col work area CSS',()=>assert(css.includes('.engineering-case-desk-grid{display:grid')));
check('tablet responsive stack CSS',()=>assert(css.includes('@media(max-width:980px){.engineering-case-desk-grid{grid-template-columns:1fr}')));
check('mobile composer responsive CSS',()=>assert(css.includes('.engineering-case-desk-compose-footer button{width:100%')));
check('forced colors fallback',()=>assert(css.includes('@media(forced-colors:active){.engineering-case-desk-intro')));
check('review remains clearly limited',()=>assert(ui.includes('Working-material counts only · no readiness score')));
check('gates registered',()=>assert(release.includes("'phase46_23_case_desk'")));
check('gate included runner',()=>assert(runner.includes('run_gate phase46_23_case_desk node scripts/phase46-23-case-desk-contract.cjs')));
console.log(`PASS Phase 46.23 descriptive case desk offline contract: ${count}/${count}; mounted React/Vite unrun.`);
