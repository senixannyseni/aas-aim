#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('./phase46-2-source-loader.cjs');
const {nextEvidenceFocusIndex,shouldReturnToEvidenceRow}=require('../apps/aim-next/src/features/investigation/investigationKeyboardModel.ts');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=read('apps/aim-next/src/features/investigation/EngineeringEvidenceNavigator.tsx');
const caseUI=read('apps/aim-next/src/features/investigation/EngineeringInvestigationCase.tsx');
const css=read('apps/aim-next/src/styles.css');
const release=read('scripts/release-evidence.mjs');
const runner=read('scripts/release-validation.sh');
let n=0;function check(label,fn){try{fn();n++;}catch(error){throw new Error(label+': '+error.message);}}
for(const [label,fn] of [
 ['arrow down',()=>assert.equal(nextEvidenceFocusIndex('ArrowDown',0,3),1)],
 ['arrow up',()=>assert.equal(nextEvidenceFocusIndex('ArrowUp',2,3),1)],
 ['home',()=>assert.equal(nextEvidenceFocusIndex('Home',2,3),0)],
 ['end',()=>assert.equal(nextEvidenceFocusIndex('End',0,3),2)],
 ['upper clamp',()=>assert.equal(nextEvidenceFocusIndex('ArrowUp',0,3),0)],
 ['lower clamp',()=>assert.equal(nextEvidenceFocusIndex('ArrowDown',2,3),2)],
 ['empty page',()=>assert.equal(nextEvidenceFocusIndex('Home',0,0),null)],
 ['negative index',()=>assert.equal(nextEvidenceFocusIndex('End',-1,2),null)],
 ['overrun index',()=>assert.equal(nextEvidenceFocusIndex('ArrowDown',2,2),null)],
 ['fractional length rejected',()=>assert.equal(nextEvidenceFocusIndex('Home',0,2.2),null)],
 ['enter unaffected',()=>assert.equal(nextEvidenceFocusIndex('Enter',0,3),null)],
 ['space unaffected',()=>assert.equal(nextEvidenceFocusIndex(' ',0,3),null)],
 ['tab unaffected',()=>assert.equal(nextEvidenceFocusIndex('Tab',0,3),null)],
 ['letter unaffected',()=>assert.equal(nextEvidenceFocusIndex('a',0,3),null)],
 ['escape return only',()=>assert.equal(shouldReturnToEvidenceRow('Escape'),true)],
 ['escape not list movement',()=>assert.equal(nextEvidenceFocusIndex('Escape',0,3),null)],
 ['other keys no return',()=>assert.equal(shouldReturnToEvidenceRow('Tab'),false)],
 ['no model transport',()=>assert.doesNotMatch(read('apps/aim-next/src/features/investigation/investigationKeyboardModel.ts'),/fetch\s*\(|localStorage|sessionStorage|XMLHttpRequest|indexedDB/)],
 ['row handler local',()=>assert(ui.includes('nextEvidenceFocusIndex(event.key,index,page.entries.length)'))],
 ['row group locally scoped',()=>assert(ui.includes('ref={sourceListRef} className="engineering-evidence-list"'))],
 ['button focus only',()=>assert(ui.includes('querySelectorAll<HTMLButtonElement>("button[data-evidence-row]").item(nextIndex)?.focus()'))],
 ['activation stays explicit',()=>assert(ui.includes('onClick={()=>setSelectedKey(item.key)}'))],
 ['search has fallback ref',()=>assert(ui.includes('ref={quickFindRef}'))],
 ['source withdrawal safe',()=>assert(ui.includes('const selected=page.entries.find(x=>x.key===selectedKey)??null'))],
 ['case-to-evidence focus guarded',()=>assert(ui.includes('previousFocusMode.current==="CASE"'))],
 ['case stays mounted',()=>assert(ui.includes('<EngineeringInvestigationCase'))],
 ['inspector escape scoped',()=>assert(ui.includes('shouldReturnToEvidenceRow(event.key)'))],
 ['inspector explicit focus button',()=>assert(ui.includes('Return focus to selected reference'))],
 ['inspector one-shot focus',()=>assert(ui.includes('focusSequence<=lastFocusedInspectorSequence.current'))],
 ['case disclosure opened before editor focus',()=>assert(caseUI.indexOf('caseDisclosure.current.open=true;')<caseUI.indexOf('if(next.draftNoteKind){setNoteType'))],
 ['no global key capture',()=>assert.doesNotMatch(ui,/window\.addEventListener\(['"]key|document\.addEventListener\(['"]key/)],
 ['source instructions',()=>assert(ui.includes('Keyboard: focus a reference'))],
 ['forced colors',()=>assert(css.includes('@media(forced-colors:active){.engineering-evidence-return-focus'))],
 ['focus style',()=>assert(css.includes('.engineering-evidence-return-focus:focus-visible'))],
 ['release registered',()=>assert(release.includes("'phase46_27_keyboard_focus'"))],
 ['release invoked',()=>assert(runner.includes('run_gate phase46_27_keyboard_focus node scripts/phase46-27-keyboard-contract.cjs'))],
])check(label,fn);
console.log(`PASS Phase 46.27 keyboard and focus contracts: ${n}/${n} (offline; mounted React tests not run)`);
