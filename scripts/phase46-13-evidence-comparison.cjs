#!/usr/bin/env node
'use strict';
/** Phase 46.13: isolated source-scope and comparison checks, NOT React/TS7/Chromium. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
require('./phase46-2-source-loader.cjs');
const {compareIndexedEvidence}=require('../apps/aim-next/src/features/investigation/evidenceComparison.ts');
const {projectCrossDomainInvestigation}=require('../apps/aim-next/src/features/investigation/crossDomainInvestigationModel.ts');
const {EMPTY_CORROSION}=require('../apps/aim-next/src/features/corrosion/corrosionModel.ts');
const {inspectionFixture}=require('../apps/aim-next/src/features/inspection/inspectionFixtures.test-utils.ts');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const at='2026-03-01T00:00:00Z';
const air={assets:[{id:'A1',tag:'V-101',name:'Synthetic Vessel',kind:'EQUIPMENT',state:'ACTIVE'},
  {id:'A2',tag:'V-202',name:'Foreign asset',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]};
const corrosion={...EMPTY_CORROSION,
  loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'S',basisReference:'BASIS-L1'},
    {id:'L2',assetId:'A2',name:'Foreign loop',systemReference:'S',basisReference:'FOREIGN-LOOP'}],
  circuits:[{id:'C1',loopId:'L1',code:'COR-1',name:'Circuit',assetId:'A1',revision:'1',state:'ACTIVE'},
    {id:'C2',loopId:'L2',code:'COR-2',name:'Foreign circuit',assetId:'A2',revision:'1',state:'ACTIVE'}],
  calculations:[{id:'CAL1',circuitId:'C1',revision:'r1',status:'DRAFT',basisReference:'CAL-BASIS',
    inputReadingIds:[],traceReference:'TRACE-A',calculatedAt:at}],
  locations:[{id:'LOC1',circuitId:'C1',tag:'TML1',componentReference:'shell',kind:'TML',sourceReference:'SOURCE-A'},
    {id:'LOC2',circuitId:'C2',tag:'TML2',componentReference:'shell',kind:'TML',sourceReference:'FOREIGN-SOURCE'}],
};
const ins=inspectionFixture();
const base={navigationScopeKey:'NAV',crossDomainScopeKey:'NAV',assetScopeKey:'AIR',
  corrosionScopeKey:'COR',inspectionScopeKey:'INS',selectedAssetId:'A1',assetSnapshot:air,
  corrosionSnapshot:corrosion,inspectionSnapshot:{...ins,requirements:ins.requirements.map(r=>({...r,assetId:'A1'}))}};
let passed=0;
function check(label,fn){try{fn();passed++;}catch(e){throw new Error(`${label}: ${e.message}`);}}
function ready(extra={}){const result=projectCrossDomainInvestigation({...base,...extra});assert.equal(result.kind,'ready');return result.context;}
const entries=()=>[...ready().evidence.corrosion.entries,...ready().evidence.inspection.entries];
check('only selected-asset evidence used',()=>assert.ok(!JSON.stringify(entries()).includes('FOREIGN-')));
check('two separate COR records can be compared',()=>{const rows=ready().evidence.corrosion.entries;
  const comparison=compareIndexedEvidence(rows,rows[0].key,rows[1].key);assert.ok(comparison);assert.equal(comparison.a.domain,'COR');});
check('same key is not a valid comparison',()=>{const x=entries()[0];assert.equal(compareIndexedEvidence(entries(),x.key,x.key),null);});
check('unselected slots cannot yield comparisons',()=>{const x=entries()[0];assert.equal(compareIndexedEvidence(entries(),null,x.key),null);});
check('removed evidence cannot remain comparable',()=>{const c=entries();assert.equal(compareIndexedEvidence([],c[0].key,c[1].key),null);});
check('cross-domain authority is retained verbatim',()=>{const a=ready().evidence.corrosion.entries[0],b=ready().evidence.inspection.entries.find(x=>x.authority==='DUE_CANDIDATE');assert.ok(b);
  const v=compareIndexedEvidence(entries(),a.key,b.key);assert.equal(v.sameOwner,false);
  assert.equal(v.rows.find(x=>x.label==='Source authority class').b,'DUE_CANDIDATE');});
check('matching reference does not produce an approval assertion',()=>{const cor=ready().evidence.corrosion.entries;
  const x={...cor[0],key:'other',sourceRecordId:'other'};
  const v=compareIndexedEvidence([cor[0],x],cor[0].key,x.key);assert.equal(v.rows.find(r=>r.label==='Reported reference').status,'SAME_REPORTED_TEXT');
  assert.ok(v.rows.every(row=>!('approved' in row)&&!('decision' in row)));});
check('two absent supporting references are labeled absent',()=>{const cor=ready().evidence.corrosion.entries;
  const v=compareIndexedEvidence(cor,cor[0].key,cor[1].key);assert.equal(v.rows.find(r=>r.label==='Supporting reference').status,'BOTH_NOT_SUPPLIED');});
check('different reported text is not normalized or coerced',()=>{const cor=ready().evidence.corrosion.entries;
  const v=compareIndexedEvidence(cor,cor[0].key,cor[1].key);assert.equal(v.rows.find(r=>r.label==='Reported reference').status,'DIFFERENT_REPORTED_TEXT');});
check('unapproved candidate remains unapproved',()=>{const e=ready().evidence.inspection.entries.find(x=>x.authority==='DUE_CANDIDATE');assert.ok(e);
  const c=compareIndexedEvidence([e,{...e,key:'other'}],e.key,'other');assert.equal(c.b.authority,'DUE_CANDIDATE');});
check('rejected COR does not disclose references',()=>{const c=ready({corrosionSnapshot:{invalid:true}});assert.equal(c.corrosion.state,'rejected');assert.equal(c.evidence.corrosion.entries.length,0);});
check('missing INS authorization does not disclose references',()=>{const c=ready({inspectionScopeKey:undefined});assert.equal(c.inspection.state,'disconnected');assert.equal(c.evidence.inspection.entries.length,0);});
check('wrong cross-domain attestation disables the view',()=>assert.equal(projectCrossDomainInvestigation({...base,crossDomainScopeKey:'FOREIGN'}).kind,'disabled'));
const component=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const parent=read('apps/aim-next/src/features/investigation/CrossDomainInvestigation.tsx');
const css=read('apps/aim-next/src/styles.css');
check('comparison slots store only local string keys',()=>assert.ok(component.includes('useState<string|null>(null)')&&component.includes('compareIndexedEvidence(scoped,comparisonA,comparisonB)')));
check('pagination does not discard comparison anchors',()=>{const part=component.match(/const movePage=[\s\S]+?\};/);assert.ok(part);assert.ok(!part[0].includes('setComparisonA')&&!part[0].includes('setComparisonB'));});
check('filter changes discard comparison anchors',()=>assert.ok(/setFilter\(domain\).*setComparisonA\(null\).*setComparisonB\(null\)/.test(component)));
check('scope-bound react remounts comparison',()=>assert.ok(parent.includes('key={JSON.stringify([props.navigationScopeKey,props.crossDomainScopeKey,props.assetScopeKey,')&&parent.includes('props.corrosionScopeKey,props.inspectionScopeKey,asset.id]')));
check('comparison preserves native table semantics and explicit disclaimer',()=>assert.ok(component.includes('<table className="engineering-evidence-comparison-table"')&&component.includes('<th scope="row">')&&component.includes('no engineering judgment')));
check('no comparison network or storage side effects',()=>{const x=read('apps/aim-next/src/features/investigation/evidenceComparison.ts');assert.ok(!/fetch\s*\(|localStorage|sessionStorage|window\.open|URL\(/.test(x+component));});
check('comparison offers keyboard focus and narrow layout',()=>assert.ok(css.includes('.engineering-evidence-compare-actions button')&&css.includes('@media(max-width:480px){.engineering-evidence-comparison-heading')&&css.includes('@media(forced-colors:active){.engineering-evidence-comparison-table')));
console.log(`PASS Phase 46.13 offline evidence-comparison contract: ${passed}/${passed}. NOT TS7/Vitest/Chromium.`);
