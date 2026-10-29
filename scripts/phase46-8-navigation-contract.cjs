#!/usr/bin/env node
'use strict';
/** Source and isolated-model checks only. React, TS7 and Chromium gates remain mandatory. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
// Run the real workspaceTrail model, using the existing offline TS6 loader.
require('./phase46-2-source-loader.cjs');
const {recordWorkspaceVisit,recentWorkspaceTargets,MAX_RECENT_WORKSPACES}=require('../apps/aim-next/src/workspaceTrail.ts');
let passed=0;
function check(name,fn){try{fn();passed++;}catch(e){throw Error(`${name}: ${e.message}`);}}
check('recent history bounded at six canonical screens',()=>assert.equal(MAX_RECENT_WORKSPACES,6));
check('retains canonical screen only',()=>assert.deepEqual(recordWorkspaceVisit([], 'SCR-AIR-001'),['SCR-AIR-001']));
check('rejects non-canonical path',()=>assert.deepEqual(recordWorkspaceVisit([], '#/screens/SCR-AIR-001'),[]));
check('rejects unknown target',()=>assert.deepEqual(recordWorkspaceVisit([], 'SCR-COR-999'),[]));
check('invalid visit does not mutate previous list',()=>{const x=Object.freeze(['SCR-AIR-001']);assert.equal(recordWorkspaceVisit(x, {tenant:'s'}),x);});
check('preserves most recent order',()=>assert.deepEqual(recordWorkspaceVisit(['SCR-AIR-001','SCR-COR-001'],'SCR-INS-001'),['SCR-INS-001','SCR-AIR-001','SCR-COR-001']));
check('deduplicates earlier visit',()=>assert.deepEqual(recordWorkspaceVisit(['SCR-COR-001','SCR-AIR-001'],'SCR-AIR-001'),['SCR-AIR-001','SCR-COR-001']));
check('evicts oldest after cap',()=>{let xs=[];for(const id of ['SCR-AIR-001','SCR-AIR-002','SCR-AIR-003','SCR-AIR-004','SCR-COR-001','SCR-INS-001','SCR-RBI-001']) xs=recordWorkspaceVisit(xs,id);assert.equal(xs.length,6);assert.ok(!xs.includes('SCR-AIR-001'));});
check('active screen never linked as recent',()=>assert.deepEqual(recentWorkspaceTargets(['SCR-COR-001','SCR-AIR-001'],'SCR-COR-001'),['SCR-AIR-001']));
check('recently visited screens contain no object metadata',()=>assert.deepEqual(Object.keys(recordWorkspaceVisit([],'SCR-AIR-001')),['0']));
const app=read('apps/aim-next/src/FutureAimApp.tsx');
check('ephemeral history state and visibility limited to active canonical surface',()=>{assert.ok(app.includes('const [recentScreens,setRecentScreens] = useState<readonly string[]>([])'));assert.ok(app.includes('if(area==="surface")setRecentScreens'));assert.ok(app.includes('area==="surface" && recentTargets.length>0'));});
check('history stays within scoped React remount',()=>assert.ok(app.includes('key={props.navigationScopeKey??"no-trusted-navigation-scope"}')));
check('AIR selection tied to its scope key',()=>{assert.ok(app.includes('assetSelection.scopeKey===assetScopeKey'));assert.ok(app.includes('setAssetSelection(id&&authorizedAssets.includes(id)?{id,scopeKey:assetScopeKey}:null)'));});
check('picker clears its internal query on AIR-scope rotation',()=>assert.ok(app.includes('key={`${navigationScopeKey??"no-scope"}:${assetScopeKey??"no-air-scope"}`}')));
check('history links are canonical and screen-only',()=>{assert.ok(app.includes('const target=SCREEN_BY_ID.get(id)!'));assert.ok(app.includes('openScreen(target)'));assert.ok(!read('apps/aim-next/src/workspaceTrail.ts').includes('localStorage'));});
check('a11y and responsive styling covers the trail',()=>{const css=read('apps/aim-next/src/styles.css');assert.ok(css.includes('.next-workspace-trail button:focus-visible'));assert.ok(css.includes('@media(forced-colors:active)'));assert.ok(css.includes('@media(max-width:800px){.next-workspace-trail'));});
check('no new screen IDs added to frozen catalogue',()=>assert.equal(require('../apps/aim-next/src/screenRegistry.ts').SCREEN_BY_ID.size,78));
console.log(`PASS Phase 46.8 isolated navigation and source contract: ${passed}/${passed}. NOT React/TS7/browser verification.`);
