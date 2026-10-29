#!/usr/bin/env node
'use strict';
/** Source-bound Phase 46.6 guardrails. Not React, TS7, performance profiling or browser proof. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'..');
const source=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const appRequire=createRequire(path.join(root,'apps/aim-next/package.json'));
let ts;
try{ts=appRequire('@typescript/typescript6');}
catch{try{ts=require('typescript');}catch{throw Error('Install TypeScript 6 compatibility compiler');}}
const files=[
  'apps/aim-next/src/features/investigation/evidencePagination.ts',
  'apps/aim-next/src/features/investigation/evidencePagination.test.ts',
  'apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx',
  'apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.phase46_6.test.tsx',
  'apps/aim-next/src/features/investigation/CrossDomainInvestigation.tsx',
];
for(const rel of files){
  const file=path.join(root,rel);
  const parsed=ts.createSourceFile(file,source(rel),ts.ScriptTarget.Latest,true,rel.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,`${rel}: syntax parsing`);
}
const code=source(files[0]);
const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const compiledModule={exports:{}};
new Function('module','exports',compiled)(compiledModule,compiledModule.exports);
const {paginateEvidence,EVIDENCE_PAGE_SIZE}=compiledModule.exports;
const refs=Array.from({length:68},(_,i)=>`R${i+1}`);
let count=0;
function check(label,fn){try{fn();count++;}catch(e){throw new Error(`${label}: ${e.message}`);}}
check('uses a fixed 30 reference presentation window',()=>assert.equal(EVIDENCE_PAGE_SIZE,30));
check('first page is bounded and has Next',()=>{const p=paginateEvidence(refs,0);assert.equal(p.entries.length,30);assert.equal(p.hasNext,true);assert.equal(p.hasPrevious,false);});
check('middle page is reachable',()=>assert.equal(paginateEvidence(refs,1).entries[0],'R31'));
check('final page is reachable',()=>{const p=paginateEvidence(refs,2);assert.equal(p.entries.at(-1),'R68');assert.equal(p.hasNext,false);});
check('stale page clamps on filter change',()=>assert.equal(paginateEvidence(refs.slice(0,2),2).pageIndex,0));
check('invalid paging cannot expose expanded index',()=>assert.equal(paginateEvidence(refs,Infinity).pageIndex,0));
check('empty authorized scope remains empty',()=>assert.equal(paginateEvidence([],22).entries.length,0));
const navigator=source(files[2]);
check('native pagination control is present',()=>assert.ok(navigator.includes('aria-label="Evidence results pages"')&&navigator.includes('Previous references')&&navigator.includes('Next references')));
check('selected provenance is from currently displayed page',()=>assert.ok(navigator.includes('page.entries.find(x=>x.key===selectedKey)')));
check('page changes clear the selected record',()=>assert.ok(navigator.includes('setPageIndex(next);setSelectedKey(null)')));
check('domain changes clear pagination and selection',()=>assert.ok(navigator.includes('setFilter(domain);setPageIndex(0);setSelectedKey(null)')));
check('owning navigation remains scoped to existing callback',()=>assert.ok(navigator.includes('onOpenOwningRecord(selected)')&&!navigator.includes('window.open(')));
const css=source('apps/aim-next/src/styles.css');
check('keyboard and forced-color visibility is retained',()=>assert.ok(css.includes('.engineering-evidence-pagination')&&css.includes('@media(forced-colors:active)')));
check('reduced-motion preference respected for rail',()=>assert.ok(css.includes('@media(prefers-reduced-motion:reduce)')));
check('build pipeline executes the new bundle budget',()=>assert.ok(source('apps/aim-next/package.json').includes('phase46-6-bundle-audit.cjs')));
check('runtime release gate records new phase contracts',()=>{const runner=source('scripts/release-validation.sh');for(const phase of ['phase46_4_source_boundary','phase46_5_evidence_boundary','phase46_6_ui_contract']) assert.ok(runner.includes(`run_gate ${phase} `));});
console.log(`PASS Phase 46.6 offline UI contract: ${count}/${count}; ${files.length} TS/TSX files parsed. NOT TS7/Vitest/browser.`);
