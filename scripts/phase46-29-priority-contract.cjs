#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
const get=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const nav=get('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const caseUi=get('apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx');
const css=get('apps/aim-next/src/styles.css');const runner=get('scripts/release-validation.sh');const registry=get('scripts/release-evidence.mjs');
let passes=0;const check=(name,fn)=>{try{fn();passes++}catch(e){throw new Error(name+': '+e.message)}};
const checks=[
['priority section exists',()=>assert(nav.includes('aria-label="Primary reported source facts"'))],
['priority reference from selected source',()=>assert(nav.includes('className="engineering-evidence-priority-reference">{selected.reference}'))],
['priority owner',()=>assert(nav.includes('<dd>{selected.domain} · {selected.ownerRecordId}</dd>'))],
['priority source ID',()=>assert(nav.includes('<dt>Source record ID</dt><dd>{selected.sourceRecordId}</dd>'))],
['priority reported state',()=>assert(nav.includes('<dt>Reported state</dt><dd>{selected.status}</dd>'))],
['priority authority',()=>assert(nav.includes('selected.authority.replaceAll("_"," ").toLowerCase()'))],
['authority caution always visible',()=>assert(nav.includes('className="engineering-evidence-priority-caution">{authorityDescription(selected)}'))],
['additional native details',()=>assert(nav.includes('details className="engineering-evidence-secondary"'))],
['additional labeled summary',()=>assert(nav.includes('<summary>Additional provenance'))],
['supporting field preserved',()=>assert(nav.includes('selected.supportingReference??"Not supplied"'))],
['revision field preserved',()=>assert(nav.includes('selected.revision??"Not supplied"'))],
['timestamp field preserved',()=>assert(nav.includes('selected.reportedAt??"Not supplied"'))],
['time meaning preserved',()=>assert(nav.includes('Reported due-date target (not an event)'))],
['absent provenance not deficiency',()=>assert(nav.includes('does not establish that a required engineering document is missing'))],
['source permission retained',()=>assert(nav.includes('context.corrosion.state==="ready"?corrosion.entries:[]'))],
['inspection permission retained',()=>assert(nav.includes('context.inspection.state==="ready"?inspection.entries:[]'))],
['selected page-bound',()=>assert(nav.includes('const selected=page.entries.find(x=>x.key===selectedKey)??null'))],
['no client persistence',()=>assert.doesNotMatch(nav+caseUi,/localStorage|sessionStorage|indexedDB/)],
['case source handoff retained',()=>assert(nav.includes('startHandoff(selected,"QUESTION")'))],
['case scope revalidates',()=>assert(caseUi.includes('stageEvidenceHandoff(draft,assetId,entries,handoffRequest)'))],
['note guidance typed',()=>assert(caseUi.includes('className="engineering-case-compose-intent"'))],
['note intent discriminates kinds',()=>assert(caseUi.includes("noteType==='QUESTION'?"))],
['full editor height',()=>assert(caseUi.includes('ref={noteFieldRef} rows={5}'))],
['draft still session only',()=>assert(caseUi.includes('Unsaved, session only'))],
['draft text limit unchanged',()=>assert(caseUi.includes('maxLength={CASE_NOTE_LENGTH}'))],
['source note attachment optional',()=>assert(caseUi.includes('<option value="">No reference attached</option>'))],
['no approval interactions',()=>assert(!nav.includes('approveCase')&&!caseUi.includes('submitToBackend'))],
['priority responsive CSS',()=>assert(css.includes('/* Phase 46.29 — progressive disclosure'))],
['priority mobile one column',()=>assert(css.includes('.engineering-evidence-priority dl{grid-template-columns:minmax(0,1fr)}'))],
['native keyboard focus',()=>assert(css.includes('.engineering-evidence-secondary summary:focus-visible'))],
['forced colors',()=>assert(css.includes('@media(forced-colors:active){.engineering-evidence-priority'))],
['registered release gate',()=>assert(registry.includes("'phase46_29_information_priority'"))],
['release gate command',()=>assert(runner.includes('run_gate phase46_29_information_priority node scripts/phase46-29-priority-contract.cjs'))],
];checks.forEach(([name,fn])=>check(name,fn));console.log(`PASS Phase 46.29 information-priority contracts: ${passes}/${checks.length} (offline only)`);
