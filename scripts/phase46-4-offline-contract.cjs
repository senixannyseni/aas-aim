#!/usr/bin/env node
'use strict';
/** Structural/source-bound smoke only. Not React, TypeScript typecheck or CI. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const appRequire=createRequire(path.join(root,'apps/aim-next/package.json'));
let ts;
try{ts=appRequire('@typescript/typescript6');}
catch{try{ts=require('typescript');}
  catch{throw Error('Offline structural audit needs installed @typescript/typescript6 or a syntax-only TypeScript compiler.');}}
const sourcePaths=[
  'apps/aim-next/src/features/investigation/crossDomainInvestigationModel.ts',
  'apps/aim-next/src/features/investigation/CrossDomainInvestigation.tsx',
  'apps/aim-next/src/features/investigation/crossDomainInvestigationModel.test.ts',
  'apps/aim-next/src/features/investigation/CrossDomainInvestigation.integration.test.tsx',
  'apps/aim-next/src/features/assets/assetModel.ts',
  'apps/aim-next/src/features/corrosion/corrosionModel.ts',
  'apps/aim-next/src/features/inspection/inspectionModel.ts',
  'apps/aim-next/src/features/inspection/inspectionFixtures.test-utils.ts',
  'apps/aim-next/src/FutureAimApp.tsx'
];
for(const rel of sourcePaths){
  const filename=path.join(root,rel); const code=fs.readFileSync(filename,'utf8');
  const node=ts.createSourceFile(filename,code,ts.ScriptTarget.Latest,true,filename.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(node.parseDiagnostics.length,0,`${rel} has parse errors`);
}
const memo=new Map();
function load(rel){
  const file=path.resolve(root,rel);
  if(memo.has(file))return memo.get(file).exports;
  const source=fs.readFileSync(file,'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};memo.set(file,module);
  const localRequire=(id)=>{
    assert.ok(id.startsWith('.'),`Unexpected runtime dependency ${id}`);
    return load(path.relative(root,path.resolve(path.dirname(file),id+'.ts')));
  };
  new Function('require','module','exports',js)(localRequire,module,module.exports);
  return module.exports;
}
const investigation=load('apps/aim-next/src/features/investigation/crossDomainInvestigationModel.ts');
const corrosion=load('apps/aim-next/src/features/corrosion/corrosionModel.ts');
const inspection=load('apps/aim-next/src/features/inspection/inspectionModel.ts');
const inspectionFixture=load('apps/aim-next/src/features/inspection/inspectionFixtures.test-utils.ts').inspectionFixture;
const AIR={assets:[{id:'A1',tag:'TEST-1',name:'Synthetic asset',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]};
const COR={...corrosion.EMPTY_CORROSION,loops:[{id:'L1',name:'Synthetic loop',assetId:'A1',systemReference:'SYS',basisReference:'BASIS'}],circuits:[{id:'C1',loopId:'L1',code:'C-1',name:'Synthetic circuit',assetId:'A1',revision:'r1',state:'ACTIVE'}]};
const INS={...inspection.EMPTY_INSPECTION,requirements:[{id:'R1',code:'REQ-1',assetId:'A1',revision:'r2',status:'DRAFT',basisReference:'INS-BASIS',scope:'Scope',technique:'UT',requiredCoveragePercent:50,requiredEffectiveness:'UNKNOWN',recurrence:'Period'}],candidates:[{id:'D1',requirementId:'R1',source:'COR',dueAt:'2026-08-01T00:00:00Z',basisReference:'CANDIDATE'}]};
const base={navigationScopeKey:'NAV-1',crossDomainScopeKey:'NAV-1',assetScopeKey:'AIR-1',corrosionScopeKey:'COR-1',inspectionScopeKey:'INS-1',selectedAssetId:'A1',assetSnapshot:AIR,corrosionSnapshot:COR,inspectionSnapshot:INS};
let passed=0;
function check(label,fn){fn();passed++;}
check('missing attestation',()=>assert.equal(investigation.projectCrossDomainInvestigation({...base,crossDomainScopeKey:null}).kind,'disabled'));
check('mismatched attestation',()=>assert.equal(investigation.projectCrossDomainInvestigation({...base,crossDomainScopeKey:'NAV-2'}).kind,'disabled'));
check('foreign asset',()=>assert.equal(investigation.projectCrossDomainInvestigation({...base,selectedAssetId:'OTHER'}).kind,'unselected'));
check('invalid asset',()=>assert.equal(investigation.projectCrossDomainInvestigation({...base,assetSnapshot:{assets:[{id:'token'}]}}).kind,'rejected'));
check('valid scope',()=>{const r=investigation.projectCrossDomainInvestigation(base);assert.equal(r.kind,'ready');assert.equal(r.context.corrosion.records[0].code,'C-1');assert.equal(r.context.inspection.records[0].code,'REQ-1');assert.equal(r.context.inspection.records[0].governingTechnicalDueAt,null);});
check('missing independent scope',()=>{const r=investigation.projectCrossDomainInvestigation({...base,corrosionScopeKey:null});assert.equal(r.context.corrosion.state,'disconnected');assert.equal(r.context.inspection.state,'ready');});
check('invalid independent snapshot',()=>{const r=investigation.projectCrossDomainInvestigation({...base,inspectionSnapshot:{oops:true}});assert.equal(r.context.inspection.state,'rejected');assert.equal(r.context.corrosion.state,'ready');});
check('independent INS due does not equal COR due candidate',()=>{
  const full=inspectionFixture();
  const merged={...full,requirements:full.requirements.map(r=>({...r,assetId:'A1'}))};
  const r=investigation.projectCrossDomainInvestigation({...base,inspectionSnapshot:merged});
  assert.equal(r.kind,'ready');
  assert.equal(r.context.inspection.records[0].dueCandidates[0].source,'COR');
  assert.notEqual(r.context.inspection.records[0].dueCandidates[0].dueAt,r.context.inspection.records[0].governingTechnicalDueAt);
  assert.equal(r.context.inspection.records[0].reviewedCreditCount,1);
});
check('an event alone is not a granted credit',()=>{
  const full=inspectionFixture();
  const merged={...full,reviews:[],requirements:full.requirements.map(r=>({...r,assetId:'A1'}))};
  const r=investigation.projectCrossDomainInvestigation({...base,inspectionSnapshot:merged});
  assert.equal(r.context.inspection.records[0].eventCount,1);
  assert.equal(r.context.inspection.records[0].reviewedCreditCount,0);
});
check('without INS due decision COR proposal cannot become governing',()=>{
  const full=inspectionFixture();
  const merged={...full,dueDecisions:[],requirements:full.requirements.map(r=>({...r,assetId:'A1'}))};
  const r=investigation.projectCrossDomainInvestigation({...base,inspectionSnapshot:merged});
  assert.equal(r.context.inspection.records[0].dueCandidates.length,3);
  assert.equal(r.context.inspection.records[0].governingTechnicalDueAt,null);
});
check('dev-only synthetic demo is absent from production entry',()=>{
  const main=fs.readFileSync(path.join(root,'apps/aim-next/src/main.tsx'),'utf8');
  const vite=fs.readFileSync(path.join(root,'apps/aim-next/vite.config.ts'),'utf8');
  assert.ok(!main.includes('phase46_4_demo'));
  assert.ok(!vite.includes('phase46-4-demo.html'));
  assert.ok(!vite.includes('phase46_4_demo'));
});
console.log(`PASS Phase 46.4 offline scope/data assertions ${passed}/${passed}; ${sourcePaths.length} TypeScript files syntax-parsed. NOT tsc/Vitest/browser.`);
