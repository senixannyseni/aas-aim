#!/usr/bin/env node
'use strict';
/** Source-only regression: lazy workspace imports are explicit, independent of runtime authorization. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const app=read('apps/aim-next/src/FutureAimApp.tsx');
const names=['Degradation','Corrosion','Inspection','Rbi','Findings','Recommendations','Actions','Iow','Ffs','Governance','Integrations','Analytics','Field','Visual'];
const dirs=['degradation','corrosion','inspection','rbi','findings','recommendations','actions','iow','ffs','governance','integrations','analytics','field','visualization'];
let passed=0;
function check(label,fn){try{fn();passed++;}catch(e){throw Error(`${label}: ${e.message}`);}}
check('canonical workspaces remain resolved from existing source',()=>assert.ok(app.includes('workspaceForScreen(currentScreen.id)')));
check('default AIR remains eager to preserve scope-safe initial navigation',()=>assert.match(app,/import \{ AssetDomainWorkspace \} from "\.\/features\/assets\/AssetDomainWorkspace"/));
check('search remains eager to preserve immediate source-bound context',()=>assert.match(app,/import \{ UniversalSearchWorkspace \} from "\.\/features\/discovery\/UniversalSearchWorkspace"/));
for(let i=0;i<names.length;i++){
 const ident=`${names[i]}DomainWorkspace`,from=`./features/${dirs[i]}/${ident}`;
 check(`${ident} uses one direct asynchronous chunk`,()=>{
   assert.ok(fs.existsSync(path.join(root,'apps/aim-next/src',from.slice(2)+'.tsx')));
   assert.ok(app.includes(`lazy(() => import("${from}").then(module => ({default: module.${ident}})))`));
   assert.equal(app.includes(`import { ${ident} } from "${from}"`),false);
 });
}
check('opt-in authenticated workflow loads only after trusted navigation',()=>{
 assert.match(app,/lazy\(\(\) => import\("\.\/shared\/data\/AuthenticatedAssetInvestigation"\)/);
 assert.match(app,/area==="asset-investigation" && assetInvestigationEnabled/);
});
check('auth scope and cross-domain rail validation remain separately gated',()=>{
 assert.ok(app.includes('!!assetInvestigationBoundary && !!navigationScopeKey'));
 assert.ok(app.includes('currentAssetId && (workspaceKind==="AIR"||workspaceKind==="COR"||workspaceKind==="INS")'));
 assert.ok(app.includes('crossDomainScopeKey={crossDomainScopeKey}'));
});
check('fallback is semantically announced but never claims a successful fetch',()=>{
 assert.match(app,/function WorkspaceLoading\(/);
 assert.match(app,/role="status" aria-live="polite"/);
 assert.match(app,/<Suspense fallback=\{<WorkspaceLoading/);
 assert.ok(!app.includes('Authoritative data loaded'));
 assert.ok(app.includes('WorkspaceModuleBoundary'));
 assert.ok(app.includes('No engineering record state can be inferred from this error'));
});
check('Vite emits a manifest for entry/deferred graph review',()=>assert.ok(read('apps/aim-next/vite.config.ts').includes('manifest:true')));
check('release includes a mandatory Phase 46.7 boundary gate',()=>{
 assert.match(read('scripts/release-validation.sh'),/^run_gate phase46_7_lazy_boundary /m);
 assert.match(read('scripts/release-evidence.mjs'),/'phase46_7_lazy_boundary'/);
});
check('browser validates lazy fetch and disconnected architecture',()=>{
 const source=read('apps/aim-next/scripts/browser-lazy-chunks.py');
 assert.ok(source.includes('page.on("pageerror"'));
 assert.ok(source.includes('PERMITTED_LAZY_DOMAIN'));
 assert.ok(source.includes('wait_until="domcontentloaded"'));
});
console.log(`PASS Phase 46.7 lazy-loading source contract ${passed}/${passed}. NOT build/Vitest/browser verification.`);
