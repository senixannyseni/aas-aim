#!/usr/bin/env node
'use strict';
/** Phase 46.14: source-bounded model checks only. NOT React, TS7, Vite or Chromium. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('./phase46-2-source-loader.cjs');
const {buildEvidenceChronology,entriesForChronology,reportedInstant}=require('../apps/aim-next/src/features/investigation/evidenceChronology.ts');
const {projectCrossDomainInvestigation}=require('../apps/aim-next/src/features/investigation/crossDomainInvestigationModel.ts');
const {EMPTY_CORROSION}=require('../apps/aim-next/src/features/corrosion/corrosionModel.ts');
const {inspectionFixture}=require('../apps/aim-next/src/features/inspection/inspectionFixtures.test-utils.ts');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
let passed=0;
const check=(name,fn)=>{try{fn();passed++;}catch(e){throw new Error(`${name}: ${e.message}`);}};
const row=(key,changes={})=>({key,domain:'COR',kind:'Calculation trace',sourceRecordId:key,ownerRecordId:'C1',reference:key,
  supportingReference:null,revision:null,reportedAt:null,status:'DRAFT',authority:'SOURCE_REFERENCE',...changes});
check('source UTC sorting honors timezone offsets',()=>{
  const c=buildEvidenceChronology([row('earlier',{reportedAt:'2026-01-01T08:00:00+07:00'}),row('later',{reportedAt:'2026-01-01T02:00:00Z'})]);
  assert.deepEqual(c.sourceTimes.map(x=>x.evidence.key),['later','earlier']);
});
check('due candidate target separate from INS governing decision occurrence',()=>{
  const c=buildEvidenceChronology([row('decision',{domain:'INS',authority:'GOVERNING_INS_DECISION',reportedAt:'2026-01-01T00:00:00Z'}),
    row('due',{domain:'INS',authority:'DUE_CANDIDATE',reportedAt:'2027-01-01T00:00:00Z'})]);
  assert.equal(c.sourceTimes.length,1);assert.equal(c.dueTargets.length,1);
});
check('due candidates sorted ascending, not given governing status',()=>{
  const c=buildEvidenceChronology([row('late',{authority:'DUE_CANDIDATE',reportedAt:'2027-01-01T00:00:00Z'}),row('early',{authority:'DUE_CANDIDATE',reportedAt:'2026-01-01T00:00:00Z'})]);
  assert.deepEqual(c.dueTargets.map(x=>x.evidence.key),['early','late']);
});
check('offset-less datetime withheld',()=>assert.equal(reportedInstant('2026-01-01T00:00:00'),null));
check('date-only withheld',()=>assert.equal(reportedInstant('2026-01-01'),null));
check('impossible calendar day withheld',()=>assert.equal(reportedInstant('2026-02-30T00:00:00Z'),null));
check('valid leap day accepted',()=>assert.ok(reportedInstant('2024-02-29T00:00:00Z')!==null));
check('invalid timezone offset withheld',()=>assert.equal(reportedInstant('2026-01-01T00:00:00+14:30'),null));
check('missing vs unorderable kept distinct',()=>{
  const c=buildEvidenceChronology([row('missing'),row('unorderable',{reportedAt:'2026-01-01'})]);
  assert.equal(c.coverage.timestampNotSupplied,1);assert.equal(c.coverage.timestampUnorderable,1);
});
check('revision absent is an observation, not a compliance verdict',()=>{
  const c=buildEvidenceChronology([row('blank'),row('rev',{revision:'r1'})]);
  assert.equal(c.coverage.revisionNotSupplied,1);assert.equal('approved' in c,false);
});
check('source index order unchanged by sorting',()=>{
  const c=buildEvidenceChronology([row('first',{reportedAt:'2026-01-01T00:00:00Z'}),row('second',{reportedAt:'2026-04-01T00:00:00Z'})]);
  assert.deepEqual(entriesForChronology(c,'SOURCE_INDEX').map(x=>x.key),['first','second']);
});
check('exact ties preserve original order',()=>{
  const t='2026-01-01T00:00:00Z';
  const c=buildEvidenceChronology([row('first',{reportedAt:t}),row('second',{reportedAt:t})]);
  assert.deepEqual(c.sourceTimes.map(x=>x.evidence.key),['first','second']);
});
check('withdrawn index yields no chronology data',()=>{
  const c=buildEvidenceChronology([]);
  for(const mode of ['SOURCE_INDEX','SOURCE_TIMES','DUE_TARGETS','UNPLACED'])assert.equal(entriesForChronology(c,mode).length,0);
});
const ins=inspectionFixture();
const assetSnapshot={assets:[{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'},
  {id:'A2',tag:'V-202',name:'Foreign',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]};
const cor={...EMPTY_CORROSION,loops:[{id:'L1',name:'Loop',assetId:'A1',systemReference:'SYS',basisReference:'B1'},
  {id:'L2',name:'Secret',assetId:'A2',systemReference:'SYS',basisReference:'FOREIGN-LOOP'}],
  circuits:[{id:'C1',loopId:'L1',code:'C1',name:'Circuit',assetId:'A1',revision:'1',state:'ACTIVE'},
    {id:'C2',loopId:'L2',code:'C2',name:'Other',assetId:'A2',revision:'1',state:'ACTIVE'}],
  calculations:[{id:'CAL1',circuitId:'C1',revision:'a',status:'DRAFT',basisReference:'B1',inputReadingIds:[],traceReference:'TRACE-ONE',calculatedAt:'2026-01-01T00:00:00Z'}]};
const base={navigationScopeKey:'NAV',crossDomainScopeKey:'NAV',assetScopeKey:'AIR',corrosionScopeKey:'COR',inspectionScopeKey:'INS',
  selectedAssetId:'A1',assetSnapshot,corrosionSnapshot:cor,inspectionSnapshot:{...ins,requirements:ins.requirements.map(x=>({...x,assetId:'A1'}))}};
const ready=change=>{const x=projectCrossDomainInvestigation({...base,...change});assert.equal(x.kind,'ready');return x.context;};
check('authorized selected-asset scope excludes unrelated COR entries',()=>{
  const x=ready({});const c=buildEvidenceChronology(x.evidence.corrosion.entries);
  assert.ok(!JSON.stringify(c).includes('FOREIGN-LOOP'));
});
check('rejected COR source cannot contribute chronology records',()=>{
  const x=ready({corrosionSnapshot:{malformed:'FOREIGN-SECRET'}});
  assert.equal(buildEvidenceChronology(x.evidence.corrosion.entries).coverage.indexed,0);
});
check('disconnected INS source cannot contribute chronology records',()=>{
  const x=ready({inspectionScopeKey:undefined});
  assert.equal(buildEvidenceChronology(x.evidence.inspection.entries).coverage.indexed,0);
});
check('unauthorized navigation scope cannot produce ready context',()=>{
  assert.notEqual(projectCrossDomainInvestigation({...base,crossDomainScopeKey:'OTHER'}).kind,'ready');
});
check('bounded indexes remain bounded when chronologically sorted',()=>{
  const x=ready({});const input=x.evidence.corrosion.entries;
  assert.equal(buildEvidenceChronology(input).coverage.indexed,input.length);
});
const navigator=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const rail=read('apps/aim-next/src/features/investigation/CrossDomainInvestigation.tsx');
check('navigator uses only the filtered index, not independent source fetches',()=>{
  assert.match(navigator,/buildEvidenceChronology\(scoped\)/);
  assert.match(navigator,/entriesForChronology\(chronology,chronologyMode\)/);
  assert.doesNotMatch(navigator,/(\bfetch\(|localStorage|sessionStorage|window\.open)/);
});
check('navigator does not assert a missing field is a deficiency',()=>{
  assert.match(navigator,/No gap here proves a technical deficiency/);
});
check('chronology mode navigation clears the selected record detail',()=>{
  assert.match(navigator,/setChronologyMode\(mode\);setPageIndex\(0\);setSelectedKey\(null\)/);
});
check('source filter also resets the chronology category and comparison anchors',()=>{
  assert.ok(navigator.includes('setFilter(domain);setPageIndex(0);setSelectedKey(null);setChronologyMode("SOURCE_INDEX");setComparisonA(null);setComparisonB(null)'));
});
check('parent rail remounts selected references when trusted scope changes',()=>{
  assert.match(rail,/key=\{JSON\.stringify\(\[props\.navigationScopeKey/);
});
console.log(`PASS Phase 46.14 offline chronology and source-scope contract: ${passed}/${passed}. NOT React/TS7/Vite/Chromium.`);
