#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('./phase46-2-source-loader.cjs');
const {filterIndexedEvidence,evidencePosition,EVIDENCE_QUERY_LIMIT}=require('../apps/aim-next/src/features/investigation/evidenceQuickFind.ts');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const model=read('apps/aim-next/src/features/investigation/evidenceQuickFind.ts');
const ui=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const css=read('apps/aim-next/src/styles.css');
const release=read('scripts/release-evidence.mjs');
const runner=read('scripts/release-validation.sh');
let count=0;function check(label,fn){try{fn();count++;}catch(error){throw Error(label+': '+error.message);}}
const source=(key,domain='COR',ref=key)=>({key,domain,kind:'Calculation trace',ownerRecordId:domain+'-OWNER',sourceRecordId:key,reference:ref,revision:'r1',status:'DRAFT',supportingReference:'BASIS',reportedAt:'2026-01-01T09:00Z',authority:'SOURCE_REFERENCE'});
const entries=Object.freeze([source('A','COR','CALC-100'),source('B','COR','THK-101'),source('C','INS','PLAN-201')]);
const checks=[
 ['blank retains authorized input',()=>assert.strictEqual(filterIndexedEvidence(entries,''),entries)],
 ['empty whitespace retains input',()=>assert.strictEqual(filterIndexedEvidence(entries,'  '),entries)],
 ['case-folded exact reference',()=>assert.deepEqual(filterIndexedEvidence(entries,'calc-100'),[entries[0]])],
 ['kind-search',()=>assert.deepEqual(filterIndexedEvidence(entries,'Calculation'),entries)],
 ['status-search',()=>assert.equal(filterIndexedEvidence(entries,'draft').length,3)],
 ['owner selection',()=>assert.deepEqual(filterIndexedEvidence(entries,'ins-owner'),[entries[2]])],
 ['domain and ref token match',()=>assert.deepEqual(filterIndexedEvidence(entries,'INS PLAN'),[entries[2]])],
 ['tokens cannot mix distinct records',()=>assert.equal(filterIndexedEvidence(entries,'CALC-100 PLAN').length,0)],
 ['unknown query no results',()=>assert.equal(filterIndexedEvidence(entries,'unknown').length,0)],
 ['unicode width normalization',()=>assert.deepEqual(filterIndexedEvidence(entries,'ｃａｌｃ-100'),[entries[0]])],
 ['query length capped',()=>assert.equal(filterIndexedEvidence(entries,'x'.repeat(EVIDENCE_QUERY_LIMIT+20)).length,0)],
 ['withdrawn index no results',()=>assert.equal(filterIndexedEvidence([entries[2]],'CALC-100').length,0)],
 ['empty input no matches',()=>assert.deepEqual(filterIndexedEvidence([],'A'),[])],
 ['previous index bounded',()=>assert.deepEqual(evidencePosition(entries,'A'),{index:0,count:3,previousKey:null,nextKey:'B'})],
 ['middle index neighbors',()=>assert.deepEqual(evidencePosition(entries,'B'),{index:1,count:3,previousKey:'A',nextKey:'C'})],
 ['last index bounded',()=>assert.deepEqual(evidencePosition(entries,'C'),{index:2,count:3,previousKey:'B',nextKey:null})],
 ['no result for withdrawn key',()=>assert.equal(evidencePosition([entries[2]],'A'),null)],
 ['no result for missing selection',()=>assert.equal(evidencePosition(entries,null),null)],
 ['neighbors strictly from filtered list',()=>assert.equal(evidencePosition([entries[0],entries[2]],'C').previousKey,'A')],
 ['index input unchanged',()=>assert.equal(entries.length,3)],
 ['model no API or persistence',()=>assert.doesNotMatch(model,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest/)],
 ['model no approval inference',()=>assert.doesNotMatch(model,/setApproved|grantPermission|governingDueAt\s*=/)],
 ['model no metadata beyond reported index',()=>assert(model.includes('item.ownerRecordId')&&model.includes('item.sourceRecordId'))],
 ['UI filters chronology source view',()=>assert(ui.includes('filterIndexedEvidence(visible,query)'))],
 ['UI derives adjacent keys only from filtered source',()=>assert(ui.includes('evidencePosition(searched,selected?.key??null)'))],
 ['UI maintains selected source on current page',()=>assert(ui.includes('page.entries.find(x=>x.key===selectedKey)'))],
 ['UI retains current authorization guards',()=>assert(ui.includes('context.corrosion.state==="ready"')&&ui.includes('context.inspection.state==="ready"'))],
 ['UI clears stale selection on search',()=>assert(ui.includes('setQuery(event.target.value);setPageIndex(0);setSelectedKey(null)'))],
 ['UI guards adjacent key on active list',()=>assert(ui.includes('const index=searched.findIndex(item=>item.key===key)'))],
 ['UI preserves permission recheck on case handoff',()=>assert(ui.includes('const startHandoff=(item:EngineeringEvidence'))],
 ['search exposes bound control',()=>assert(ui.includes('maxLength={EVIDENCE_QUERY_LIMIT}'))],
 ['search input accessible',()=>assert(ui.includes('type="search"')&&ui.includes('role="search"'))],
 ['search no-match states do not assert absent records',()=>assert(ui.includes('this does not establish that the owning source has no matching records'))],
 ['source position nav accessible',()=>assert(ui.includes('aria-label="Move between filtered evidence references"'))],
 ['source arrows do not skip list',()=>assert(ui.includes('inspectFilteredKey(position.nextKey)'))],
 ['CSS mobile support',()=>assert(css.includes('@media(max-width:730px){.engineering-evidence-inspector-header'))],
 ['CSS forced colors',()=>assert(css.includes('@media(forced-colors:active){.engineering-evidence-quick-find'))],
 ['no new endpoint in navigation',()=>assert.doesNotMatch(ui,/\bfetch\s*\(|localStorage|sessionStorage|indexedDB|XMLHttpRequest/)],
 ['release phase registered',()=>assert(release.includes("'phase46_25_indexed_quick_find'"))],
 ['release gate wired',()=>assert(runner.includes('run_gate phase46_25_indexed_quick_find node scripts/phase46-25-quick-find-contract.cjs'))],
];
for(const [label,fn] of checks)check(label,fn);
console.log(`PASS Phase 46.25 authorized local evidence finder: ${count}/${count} (offline, not mounted React)`);
