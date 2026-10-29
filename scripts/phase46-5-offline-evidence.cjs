#!/usr/bin/env node
'use strict';
/** Source boundary and synthesized evidence assertions. Not tsc, Vitest or Chromium. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const appRequire=createRequire(path.join(root,'apps/aim-next/package.json'));
let ts;
try{ts=appRequire('@typescript/typescript6');}
catch{try{ts=require('typescript');}catch{throw Error('Install the pinned TypeScript 6 compatibility dependency before this check.');}}
const files=[
  'apps/aim-next/src/features/investigation/crossDomainInvestigationModel.ts',
  'apps/aim-next/src/features/investigation/engineeringEvidenceModel.ts',
  'apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx',
  'apps/aim-next/src/features/investigation/CrossDomainInvestigation.tsx',
  'apps/aim-next/src/features/investigation/engineeringEvidenceModel.test.ts',
  'apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.integration.test.tsx',
  'apps/aim-next/src/FutureAimApp.tsx',
];
for(const rel of files){
  const file=path.join(root,rel);
  const parsed=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,
    file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,`${rel}: failed TypeScript syntax parsing`);
}
const loaded=new Map();
function load(rel){
  const file=path.resolve(root,rel);
  if(loaded.has(file))return loaded.get(file).exports;
  const code=fs.readFileSync(file,'utf8');
  const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};loaded.set(file,module);
  new Function('require','module','exports',js)(id=>{
    assert.ok(id.startsWith('.'),`Unexpected module import ${id}`);
    return load(path.relative(root,path.resolve(path.dirname(file),id+'.ts')));
  },module,module.exports);
  return module.exports;
}
const project=load('apps/aim-next/src/features/investigation/crossDomainInvestigationModel.ts').projectCrossDomainInvestigation;
const emptyCor=load('apps/aim-next/src/features/corrosion/corrosionModel.ts').EMPTY_CORROSION;
const fixture=load('apps/aim-next/src/features/inspection/inspectionFixtures.test-utils.ts').inspectionFixture;
const at='2026-03-01T00:00:00Z';
const air={assets:[{id:'A1',tag:'V-101',name:'Synthetic vessel',kind:'EQUIPMENT',state:'ACTIVE'},
  {id:'A2',tag:'V-102',name:'Other vessel',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]};
const cor={...emptyCor,loops:[{id:'L1',name:'Test loop',assetId:'A1',systemReference:'SYS',basisReference:'BASIS-A'},
  {id:'L2',name:'Other loop',assetId:'A2',systemReference:'SYS',basisReference:'SECRET-LOOP'}],
  circuits:[{id:'C1',loopId:'L1',code:'C-1',name:'Circuit',assetId:'A1',revision:'r1',state:'ACTIVE'},
    {id:'C2',loopId:'L2',code:'C-2',name:'Other circuit',assetId:'A2',revision:'r2',state:'ACTIVE'}],
  calculations:[{id:'CAL1',circuitId:'C1',revision:'rc1',status:'DRAFT',basisReference:'CAL-BASIS',inputReadingIds:[],traceReference:'TRACE-COR',calculatedAt:at}]};
const ins=fixture();
const base={navigationScopeKey:'NAV',crossDomainScopeKey:'NAV',assetScopeKey:'AIR',corrosionScopeKey:'COR',inspectionScopeKey:'INS',
  selectedAssetId:'A1',assetSnapshot:air,corrosionSnapshot:cor,
  inspectionSnapshot:{...ins,requirements:ins.requirements.map(x=>({...x,assetId:'A1'}))}};
let passed=0;
function check(name,fn){fn();passed++;}
function ready(input=base){const r=project(input);assert.equal(r.kind,'ready');return r.context;}
check('requires same-epoch explicit attestation',()=>assert.equal(project({...base,crossDomainScopeKey:'bad'}).kind,'disabled'));
check('requires independently authorized AIR source',()=>assert.equal(project({...base,assetScopeKey:undefined}).kind,'disabled'));
check('rejects invalid AIR before domain records',()=>assert.equal(project({...base,assetSnapshot:{assets:[{}]}}).kind,'rejected'));
check('foreign asset not selected',()=>assert.equal(project({...base,selectedAssetId:'unknown'}).kind,'unselected'));
check('COR source references retained',()=>assert.ok(ready().evidence.corrosion.entries.some(x=>x.reference==='TRACE-COR')));
check('never includes foreign COR refs',()=>assert.ok(!JSON.stringify(ready().evidence).includes('SECRET-LOOP')));
check('INS due candidate separate from governing',()=>{const r=ready().evidence.inspection.entries;
  assert.ok(r.some(x=>x.authority==='DUE_CANDIDATE'));assert.ok(r.some(x=>x.authority==='GOVERNING_INS_DECISION'));});
check('INS technical review distinguished',()=>assert.ok(ready().evidence.inspection.entries.some(x=>x.authority==='TECHNICAL_REVIEW')));
check('no due governing inferred from candidates',()=>assert.ok(!ready({...base,inspectionSnapshot:{...base.inspectionSnapshot,dueDecisions:[]}}).evidence.inspection.entries.some(x=>x.authority==='GOVERNING_INS_DECISION')));
check('invalid COR rejected without leaking its references',()=>{const r=ready({...base,corrosionSnapshot:{invalid:true}});assert.equal(r.corrosion.state,'rejected');assert.equal(r.evidence.corrosion.total,0);assert.ok(r.evidence.inspection.total>0);});
check('missing INS key withholds independent evidence',()=>{const r=ready({...base,inspectionScopeKey:undefined});assert.equal(r.inspection.state,'disconnected');assert.equal(r.evidence.inspection.total,0);});
check('bounded evidence index reports truncation',()=>{
  const extra={...cor,locations:Array.from({length:220},(_,i)=>({id:`LOC${i}`,circuitId:'C1',tag:`TML-${i}`,componentReference:'shell',kind:'TML',sourceReference:`source-${i}`}))};
  const result=ready({...base,corrosionSnapshot:extra}).evidence.corrosion;
  assert.equal(result.entries.length,200);assert.equal(result.truncated,true);assert.ok(result.total>200);
});
check('evidence references cannot generate URLs by default',()=>assert.ok(ready().evidence.corrosion.entries.every(x=>!('url' in x))));
check('visual navigator requires an owning-domain callback',()=>{const code=fs.readFileSync(path.join(root,'apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx'),'utf8');
  assert.ok(code.includes('onOpenOwningRecord(selected)'));assert.ok(!code.includes('window.open('));});
check('canonical routes remain unchanged',()=>{const code=fs.readFileSync(path.join(root,'apps/aim-next/src/features/investigation/CrossDomainInvestigation.tsx'),'utf8');
  assert.ok(code.includes('SCR-COR-001'));assert.ok(code.includes('SCR-INS-001'));});
console.log(`PASS Phase 46.5 offline provenance/scope checks ${passed}/${passed}; ${files.length} TS/TSX files syntax-parsed. NOT tsc/Vitest/browser.`);
