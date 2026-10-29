#!/usr/bin/env node
'use strict';
/**
 * Phase 46.9: real isolated-model integration regression, not browser/typecheck.
 * Exercises the Phase 46.4→46.8 chain across scope changes, evidence pagination,
 * canonical-only route history and independent COR/INS source rejection.
 */
const assert=require('node:assert/strict');
require('./phase46-2-source-loader.cjs');
const {projectCrossDomainInvestigation}=require('../apps/aim-next/src/features/investigation/crossDomainInvestigationModel.ts');
const {paginateEvidence,EVIDENCE_PAGE_SIZE}=require('../apps/aim-next/src/features/investigation/evidencePagination.ts');
const {recordWorkspaceVisit,recentWorkspaceTargets}=require('../apps/aim-next/src/workspaceTrail.ts');
const {SCREEN_BY_ID}=require('../apps/aim-next/src/screenRegistry.ts');
const {EMPTY_CORROSION}=require('../apps/aim-next/src/features/corrosion/corrosionModel.ts');
const {inspectionFixture}=require('../apps/aim-next/src/features/inspection/inspectionFixtures.test-utils.ts');
const at='2026-03-01T00:00:00Z';
const assets={assets:[
  {id:'asset-a',tag:'V-101',name:'Synthetic vessel',kind:'EQUIPMENT',state:'ACTIVE'},
  {id:'asset-b',tag:'P-999',name:'Other scope asset',kind:'EQUIPMENT',state:'ACTIVE'},
],relationships:[],history:[]};
const corrosion={...EMPTY_CORROSION,
  loops:[{id:'loop-a',name:'Scoped loop',assetId:'asset-a',systemReference:'PLANT-A',basisReference:'COR-BASIS-A'},
    {id:'loop-b',name:'Unrelated loop',assetId:'asset-b',systemReference:'PLANT-B',basisReference:'FOREIGN-LOOP-REF'}],
  circuits:[{id:'circuit-a',loopId:'loop-a',code:'COR-A',name:'Synthetic circuit',assetId:'asset-a',revision:'REV-A',state:'ACTIVE'},
    {id:'circuit-b',loopId:'loop-b',code:'COR-B',name:'Foreign circuit',assetId:'asset-b',revision:'REV-B',state:'ACTIVE'}],
  locations:Array.from({length:68},(_,i)=>({id:`loc-${i+1}`,circuitId:'circuit-a',tag:`TML-${i+1}`,componentReference:'shell',kind:'TML',sourceReference:`SYN-REF-${i+1}`})),
  calculations:[{id:'calc-a',circuitId:'circuit-a',revision:'1',status:'DRAFT',basisReference:'BASIS-A',inputReadingIds:[],traceReference:'COR-TRACE-A',calculatedAt:at}],
};
const inspection=inspectionFixture();
const input={navigationScopeKey:'scope-a',crossDomainScopeKey:'scope-a',assetScopeKey:'air-a',
  corrosionScopeKey:'cor-a',inspectionScopeKey:'ins-a',selectedAssetId:'asset-a',
  assetSnapshot:assets,corrosionSnapshot:corrosion,
  inspectionSnapshot:{...inspection,requirements:inspection.requirements.map(r=>({...r,assetId:'asset-a'}))}};
let passed=0;
function check(name,fn){try{fn();passed++;}catch(e){console.error(`FAIL Phase 46.9 ${name}: ${e.stack||e}`);process.exit(1);}}
const project=overrides=>projectCrossDomainInvestigation({...input,...overrides});
const ready=()=>{const value=project({});assert.equal(value.kind,'ready');return value.context;};
check('single attested navigation epoch required',()=>{
  assert.equal(project({crossDomainScopeKey:'scope-b'}).kind,'disabled');
  assert.equal(project({navigationScopeKey:undefined}).kind,'disabled');
  assert.equal(project({assetScopeKey:undefined}).kind,'disabled');
});
check('missing or foreign asset never unlocks a context',()=>{
  assert.equal(project({selectedAssetId:'asset-c'}).kind,'unselected');
  assert.equal(project({assetSnapshot:{assets:[{}]}}).kind,'rejected');
});
check('selected asset projects only its own source records',()=>{
  const context=ready();
  assert.equal(context.asset.id,'asset-a');
  assert.deepEqual(context.corrosion.records.map(r=>r.id),['circuit-a']);
  assert.ok(context.inspection.records.length>0);
  assert.ok(!JSON.stringify(context).includes('FOREIGN-LOOP-REF'));
  assert.ok(!JSON.stringify(context).includes('circuit-b'));
});
check('evidence references keep provenance and owning domain',()=>{
  const {corrosion:cor,inspection:ins}=ready().evidence;
  assert.ok(cor.entries.some(item=>item.reference==='COR-TRACE-A'));
  assert.ok(cor.entries.every(item=>item.domain==='COR'&&item.ownerRecordId==='circuit-a'));
  assert.ok(ins.entries.every(item=>item.domain==='INS'));
  assert.ok(ins.entries.some(item=>item.authority==='DUE_CANDIDATE'));
  assert.ok(ins.entries.some(item=>item.authority==='GOVERNING_INS_DECISION'));
  assert.ok(cor.entries.every(item=>!('url' in item)));
});
check('evidence pagination exposes every indexed record exactly once',()=>{
  const {entries}=ready().evidence.corrosion;
  assert.ok(entries.length>2*EVIDENCE_PAGE_SIZE);
  const pages=[];
  for(let p=0;p<Math.ceil(entries.length/EVIDENCE_PAGE_SIZE);p++) {
    const page=paginateEvidence(entries,p);
    assert.equal(page.pageIndex,p);
    pages.push(...page.entries);
  }
  assert.deepEqual(pages,entries);
  assert.equal(new Set(pages.map(item=>item.key)).size,pages.length);
});
check('stale pager clamps to a newly shortened authorized index',()=>{
  const entries=ready().evidence.corrosion.entries;
  assert.equal(paginateEvidence(entries.slice(0,5),999).pageIndex,0);
  assert.equal(paginateEvidence([],999).pageCount,0);
});
check('invalid COR source cannot disclose partially parsed evidence',()=>{
  const outcome=project({corrosionSnapshot:{loops:[{id:'secret',basisReference:'DO-NOT-DISCLOSE'}]}});
  assert.equal(outcome.kind,'ready');
  assert.equal(outcome.context.corrosion.state,'rejected');
  assert.equal(outcome.context.evidence.corrosion.total,0);
  assert.ok(outcome.context.evidence.inspection.total>0);
  assert.ok(!JSON.stringify(outcome).includes('DO-NOT-DISCLOSE'));
});
check('withdrawal of INS scope hides only INS references',()=>{
  const outcome=project({inspectionScopeKey:undefined});
  assert.equal(outcome.kind,'ready');
  assert.equal(outcome.context.inspection.state,'disconnected');
  assert.equal(outcome.context.evidence.inspection.total,0);
  assert.ok(outcome.context.evidence.corrosion.total>0);
});
check('candidate due dates cannot become governing decisions',()=>{
  const snapshot=input.inspectionSnapshot;
  const outcome=project({inspectionSnapshot:{...snapshot,dueDecisions:[]}});
  assert.equal(outcome.kind,'ready');
  assert.ok(outcome.context.evidence.inspection.entries.some(item=>item.authority==='DUE_CANDIDATE'));
  assert.ok(!outcome.context.evidence.inspection.entries.some(item=>item.authority==='GOVERNING_INS_DECISION'));
});
check('recent navigation holds only known canonical screen identities',()=>{
  let visits=[];
  for(const id of ['SCR-AIR-001','SCR-COR-001','SCR-INS-001'])visits=recordWorkspaceVisit(visits,id);
  assert.deepEqual(recentWorkspaceTargets(visits,'SCR-INS-001'),['SCR-COR-001','SCR-AIR-001']);
  assert.ok(visits.every(id=>SCREEN_BY_ID.has(id)));
  assert.equal(recordWorkspaceVisit(visits,'#/screens/SCR-COR-001'),visits);
  assert.equal(JSON.stringify(visits).includes('asset-a'),false);
  assert.equal(SCREEN_BY_ID.size,78);
});
console.log(`PASS Phase 46.9 combined isolated integration assertions: ${passed}/${passed}. Not strict TS7, React, build, browser, or release approval.`);
