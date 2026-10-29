#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {root, platformRoot} = require("./phase46-2-source-loader.cjs");
const map = require(path.join(platformRoot,"package.json")).exports;
let count=0;
function check(ok,message){assert.ok(ok,message);count++;}
const rootPkg=require(path.join(root,"package.json"));
check(rootPkg.packageManager === "pnpm@12.14.0", "pinned workspace package manager");
const workspace=fs.readFileSync(path.join(root,"pnpm-workspace.yaml"),"utf8");
check(workspace.includes('"packages/aim-platform"'),"shared package listed in pnpm workspace");
for(const app of ["web","aim-next"]){
 const pkg=require(path.join(root,`apps/${app}/package.json`));
 check(pkg.dependencies["@bandha/aim-platform"] === "workspace:*", `${app} links shared package`);
}
for(const [name,target] of Object.entries(map)){
 check(name.startsWith("./") && target.startsWith("./src/") && fs.existsSync(path.join(platformRoot,target)),`export exists: ${name}`);
}
for(const file of [
 "src/shared/api/apiClient.ts", "src/shared/api/authenticatedApiClient.ts",
 "src/shared/auth/authSession.ts", "src/shared/auth/authBootstrap.ts",
 "src/shared/auth/useAuthSession.ts", "src/features/assets/ServerAssetRegister.tsx",
 "src/features/assets/assetRegisterAdapter.ts", "src/features/assets/useServerAssetRegister.ts",
]){
 const code=fs.readFileSync(path.join(root,"apps/web",file),"utf8");
 check(code.includes('export * from "@bandha/aim-platform/'),`foundation compatibility shim ${file}`);
}
function walk(folder){ return fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>
 entry.isDirectory()?walk(path.join(folder,entry.name)):[path.join(folder,entry.name)]); }
for(const name of walk(path.join(root,"apps/aim-next/src")).filter(s=>/\.tsx?$/.test(s))){
 const source=fs.readFileSync(name,"utf8");
 check(!/(?:\.\.\/)+web\/src/.test(source),`no cross-app import in ${path.relative(root,name)}`);
}
const platformClient = require("@bandha/aim-platform/api/apiClient");
const webClient = require(path.join(root,"apps/web/src/shared/api/apiClient.ts"));
const platformAuth = require("@bandha/aim-platform/auth/authSession");
const webAuth = require(path.join(root,"apps/web/src/shared/auth/authSession.ts"));
check(platformClient.ApiClientError === webClient.ApiClientError,"one shared API error constructor");
check(platformClient.createApiClient === webClient.createApiClient,"one shared API transport factory");
check(platformAuth.createAuthSessionBoundary === webAuth.createAuthSessionBoundary,"one shared session constructor");
check(typeof require("@bandha/aim-platform/assets/assetRegisterAdapter").decodeAssetRegisterPage === 'function',"shared register adapter available");
check(typeof require("@bandha/aim-platform/data/authorizedReadState").completeRead === 'function',"shared read state available");
console.log(`PASS — ${count}/${count} Phase 46.2 workspace and runtime identity checks`);
