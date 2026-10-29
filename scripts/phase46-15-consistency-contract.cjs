#!/usr/bin/env node
'use strict';
/** Phase 46.15 offline, source-scoped model checks. NOT TS7, React or Chromium. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('./phase46-2-source-loader.cjs');
const {inspectEvidenceConsistency,CONSISTENCY_VIEW_LIMIT}=require('../apps/aim-next/src/features/investigation/evidenceConsistency.ts');
const {projectCrossDomainInvestigation}=require('../apps/aim-next/src/features/investigation/crossDomainInvestigationModel.ts');
const {EMPTY_CORROSION}=require('../apps/aim-next/src/features/corrosion/corrosionModel.ts');
const {inspectionFixture}=require('../apps/aim-next/src/features/inspection/inspectionFixtures.test-utils.ts');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let passed=0;
function check(label,fn){try{fn();passed++;}catch(e){throw new Error(`${label}: ${e.message}`);}}
const row=(key,extra={})=>({key,domain:'COR',kind:'Calculation trace',sourceRecordId:key,
  ownerRecordId:'C1',reference:'REF',supportingReference:null,revision:'r1',reportedAt:'2026-01-01T00:00:00Z',
  status:'DRAFT',authority:'SOURCE_REFERENCE',...extra});
check('empty is informational only',()=>assert.deepEqual(inspectEvidenceConsistency([]).observations,[]));
check('one reported record cannot conflict with itself',()=>assert.equal(inspectEvidenceConsistency([row('a')]).counts.REVISION_VARIATION,0));
check('revision variation within one owner',()=>assert.equal(inspectEvidenceConsistency([row('a'),row('b',{revision:'r2'})]).counts.REVISION_VARIATION,1));
check('state variation within one owner',()=>assert.equal(inspectEvidenceConsistency([row('a'),row('b',{status:'REVIEWED'})]).counts.STATE_VARIATION,1));
check('no revision mismatch where one revision absent',()=>assert.equal(inspectEvidenceConsistency([row('a',{revision:null}),row('b')]).counts.REVISION_VARIATION,0));
check('different timestamps alone are not contradictions',()=>assert.equal(inspectEvidenceConsistency([row('a'),row('b',{reportedAt:'2026-02-01T00:00:00Z'})]).observations.length,0));
check('different kinds cannot create same-kind conflict',()=>assert.equal(inspectEvidenceConsistency([row('a'),row('b',{kind:'Monitoring location',status:'REVIEWED'})]).counts.STATE_VARIATION,0));
check('source owner separation',()=>assert.equal(inspectEvidenceConsistency([row('a'),row('b',{ownerRecordId:'C2',status:'REVIEWED'})]).counts.STATE_VARIATION,0));
check('cross-owner exact reference reuse only',()=>assert.equal(inspectEvidenceConsistency([row('a'),row('b',{ownerRecordId:'C2'})]).counts.REFERENCE_REUSE,1));
check('cross-domain text reuse is not an inferred join',()=>{const v=inspectEvidenceConsistency([row('a'),row('b',{domain:'INS',ownerRecordId:'I1'})]);assert.equal(v.observations[0].ownerDomain,null);assert.match(v.observations[0].summary,/does not establish/);});
check('text is compared without normalization',()=>assert.equal(inspectEvidenceConsistency([row('a'),row('b',{reference:'ref ',ownerRecordId:'C2'})]).observations.length,0));
check('same key contributes only once',()=>assert.equal(inspectEvidenceConsistency([row('a'),row('a',{revision:'r2'})]).examinedReferences,1));
check('result list stays bounded',()=>{const rows=[];for(let i=0;i<CONSISTENCY_VIEW_LIMIT+3;i++){rows.push(row(`a${i}`,{reference:`R${i}`,ownerRecordId:'X'}));rows.push(row(`b${i}`,{reference:`R${i}`,ownerRecordId:'Y'}));}const v=inspectEvidenceConsistency(rows);assert.equal(v.observations.length,CONSISTENCY_VIEW_LIMIT);assert.equal(v.counts.REFERENCE_REUSE,CONSISTENCY_VIEW_LIMIT+3);assert.equal(v.limited,true);});
check('output never declares approved engineering truth',()=>{const v=inspectEvidenceConsistency([row('a'),row('b',{revision:'r2'})]);assert.equal(Object.hasOwn(v.observations[0],'approved'),false);});
const asset={assets:[{id:'A1',tag:'V-101',name:'Selected',kind:'EQUIPMENT',state:'ACTIVE'},
  {id:'A2',tag:'V-202',name:'Other',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]};
const base={navigationScopeKey:'NAV',crossDomainScopeKey:'NAV',assetScopeKey:'AIR',corrosionScopeKey:'COR',inspectionScopeKey:'INS',selectedAssetId:'A1',assetSnapshot:asset,
  corrosionSnapshot:{...EMPTY_CORROSION,loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'SYS',basisReference:'VISIBLE'},{id:'L2',assetId:'A2',name:'Other',systemReference:'SYS',basisReference:'FOREIGN-LOOP'}],
    circuits:[{id:'C1',loopId:'L1',code:'C1',name:'Circuit',assetId:'A1',revision:'r1',state:'ACTIVE'},
      {id:'C2',loopId:'L2',code:'C2',name:'Other circuit',assetId:'A2',revision:'r1',state:'ACTIVE'}]},
  inspectionSnapshot:{...inspectionFixture(),requirements:inspectionFixture().requirements.map(r=>({...r,assetId:'A1'}))}};
function ready(extras={}){const result=projectCrossDomainInvestigation({...base,...extras});assert.equal(result.kind,'ready');return result.context;}
check('selected asset only',()=>{const context=ready();const rows=[...context.evidence.corrosion.entries,...context.evidence.inspection.entries];assert.ok(!JSON.stringify(inspectEvidenceConsistency(rows)).includes('FOREIGN-'));});
check('invalid COR snapshot cannot contribute observations',()=>{const context=ready({corrosionSnapshot:{invalid:true}});assert.equal(context.corrosion.state,'rejected');assert.ok(context.evidence.corrosion.entries.length===0);});
check('disconnected INS cannot contribute observations',()=>{const context=ready({inspectionScopeKey:undefined});assert.equal(context.inspection.state,'disconnected');assert.equal(context.evidence.inspection.entries.length,0);});
check('invalid cross-domain attestation disables context',()=>assert.equal(projectCrossDomainInvestigation({...base,crossDomainScopeKey:'OTHER'}).kind,'disabled'));
const ui=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const shell=read('apps/aim-next/src/features/investigation/CrossDomainInvestigation.tsx');
const css=read('apps/aim-next/src/styles.css');
check('no state persisted across scope changes',()=>assert.ok(shell.includes('key={JSON.stringify([props.navigationScopeKey,props.crossDomainScopeKey,props.assetScopeKey,')&&shell.includes('props.corrosionScopeKey,props.inspectionScopeKey,asset.id]')));
check('model receives already filtered authorized index',()=>assert.ok(ui.includes('inspectEvidenceConsistency(scoped)')));
check('filter state resets on source selection',()=>assert.ok(/setFilter\(domain\).*setConsistencyKind\("ALL"\);setConsistencyPage\(0\)/.test(ui)));
check('accessible native disclosure, filter, and owning record buttons',()=>assert.ok(ui.includes('aria-label="Reported evidence consistency observations"')&&ui.includes('aria-label="Filter reported consistency observations"')&&ui.includes('onOpenOwningRecord(e)')));
check('focus visible and responsive, forced colors',()=>assert.ok(css.includes('.engineering-evidence-consistency :is(summary,button):focus-visible')&&css.includes('@media(max-width:480px){.engineering-evidence-consistency')&&css.includes('@media(forced-colors:active){.engineering-evidence-consistency')));
check('no new transport, browser storage or hidden API requests',()=>{const x=read('apps/aim-next/src/features/investigation/evidenceConsistency.ts');assert.ok(!/\bfetch\s*\(|localStorage|sessionStorage|XMLHttpRequest|window\.open/.test(x));});
console.log(`PASS Phase 46.15 offline evidence consistency contract: ${passed}/${passed}. NOT TS7/Vitest/Chromium.`);
