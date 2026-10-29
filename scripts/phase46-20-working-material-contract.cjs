#!/usr/bin/env node
'use strict';
/** Offline syntax/source/model guard. NOT React/Vite/browser acceptance. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('./phase46-2-source-loader.cjs');
const {describeWorkingMaterial}=require('../apps/aim-next/src/features/investigation/evidenceReviewCoverage.ts');
let n=0;
const test=(name,fn)=>{try{fn();n++;}catch(err){throw new Error(`${name}: ${err.message}`);}};
const empty={assetId:'DEMO-A',references:[],observations:[],questions:[],nextSteps:[],
  unlinkedNoteCount:0,withdrawnReferenceCount:0,sources:[],limitations:[]};
const result=describeWorkingMaterial(empty);
test('five descriptive categories',()=>assert.equal(result.items.length,5));
test('no readiness score',()=>assert.equal('score' in result,false));
test('no readiness boolean',()=>assert.equal('ready' in result,false));
test('no approval flag',()=>assert.equal('approved' in result,false));
test('missing pointers not absence of records',()=>assert.match(result.items[0].description,/does not imply absence/));
test('missing notes not inferred as completeness',()=>assert.equal(result.items[1].state,'NOT_ENTERED'));
test('missing questions not inferred resolved',()=>assert.match(result.items[2].description,/cannot determine/));
test('missing next steps not inferred completion',()=>assert.equal(result.items[3].state,'NOT_ENTERED'));
test('unknown source flagged',()=>assert.equal(result.items[4].state,'SOURCE_LIMITED'));
test('external engineering decision retained',()=>assert.match(result.prompts.join(' '),/outside this preview/));
const altered={...empty,references:[{key:'A'}],questions:[{text:'Q'}],nextSteps:[{text:'N'}],
 unlinkedNoteCount:2,withdrawnReferenceCount:1,sources:[
 {domain:'COR',state:'ready',indexed:2,totalReported:10,truncated:true},
 {domain:'INS',state:'disconnected',indexed:0,totalReported:0,truncated:false}]};
const active=describeWorkingMaterial(altered);
test('present pointer entered',()=>assert.equal(active.items[0].state,'ENTERED'));
test('questions entered but not resolved',()=>assert.match(active.items[2].description,/none is marked resolved/));
test('proposed actions not authorized',()=>assert.match(active.items[3].description,/none assigned or authorized/));
test('bounded index reported',()=>assert.equal(active.items[4].state,'SOURCE_LIMITED'));
test('unlinked notes shown without verdict',()=>assert.match(active.prompts.join(' '),/2 note/));
test('withdrawn evidence still excluded',()=>assert.match(active.prompts.join(' '),/1 withdrawn/));
test('source states not overwritten',()=>assert.equal(active.sourceStates[1].state,'disconnected'));
test('freeze projected coverage',()=>assert.equal(Object.isFrozen(active.items),true));
const complete=describeWorkingMaterial({...empty,sources:[
 {domain:'COR',state:'ready',indexed:2,totalReported:2,truncated:false},
 {domain:'INS',state:'ready',indexed:2,totalReported:2,truncated:false}]});
test('connected index not technical certification',()=>assert.match(complete.items[4].description,/completeness is not certified/));
test('coverage does not fabricate record counts',()=>assert.equal(complete.sourceStates[0].indexed,2));
const root=path.resolve(__dirname,'..');const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const model=read('apps/aim-next/src/features/investigation/evidenceReviewCoverage.ts');
const ui=read('apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx');
const css=read('apps/aim-next/src/styles.css');
test('pure model no transport/storage',()=>assert.doesNotMatch(model, /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest/));
test('read-only projected input',()=>assert.match(model,/review:ReviewPreparation/));
test('UI derives from live review projection',()=>assert.match(ui,/describeWorkingMaterial\(review\)/));
test('UI has labelled coverage',()=>assert.match(ui,/aria-label="Working material coverage"/));
test('UI labels non-certification explicitly',()=>assert.match(ui,/not technical readiness/));
test('UI includes prompts without actions',()=>assert.match(ui,/Working discussion prompts/));
test('UI has responsive layout',()=>assert.match(css,/@media\(max-width:480px\)\{\.engineering-review-coverage-list/));
test('UI has keyboard focus styling',()=>assert.match(css,/\.engineering-review-coverage :is\(summary\):focus-visible/));
test('no backend fetch or persistence in case',()=>assert.doesNotMatch(ui,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest/));
test('release gate declared',()=>assert.match(read('scripts/release-evidence.mjs'),/phase46_20_working_material/));
test('release gate run',()=>assert.match(read('scripts/release-validation.sh'),/phase46_20_working_material node scripts\/phase46-20-working-material-contract\.cjs/));
console.log(`PASS Phase 46.20 working material offline contract: ${n}/${n}. NOT React/Vite/Chromium acceptance.`);
