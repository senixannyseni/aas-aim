#!/usr/bin/env node
"use strict";
/** Phase 46.11 local architecture contracts. This is NOT React/TS7/Chromium proof. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root=path.resolve(__dirname,"..");
require("./phase46-2-source-loader.cjs");
const {SCREENS,SCREEN_BY_ID}=require("../apps/aim-next/src/screenRegistry.ts");
const {searchWorkspaceRoutes,WORKSPACE_RESULT_LIMIT,WORKSPACE_QUERY_LIMIT}=require("../apps/aim-next/src/workspaceDiscovery.ts");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
let passed=0;
function check(label,fn){try{fn();passed++;}catch(error){throw Error(`FAIL ${label}: ${error.message}`);}}
check("frozen canonical route registry",()=>{assert.equal(SCREENS.length,78);assert.equal(SCREEN_BY_ID.size,78);});
check("empty input does not enumerate routes",()=>assert.equal(searchWorkspaceRoutes(" ").total,0));
check("rejects non-string queries",()=>assert.equal(searchWorkspaceRoutes({tenant:"untrusted"}).total,0));
check("screen-id target is exact and first",()=>assert.equal(searchWorkspaceRoutes("SCR-COR-004").matches[0].id,"SCR-COR-004"));
check("title match",()=>assert.equal(searchWorkspaceRoutes("inspection technical review").matches[0].id,"SCR-INS-006"));
check("capability-based match",()=>assert.ok(searchWorkspaceRoutes("COR-015").matches.some(s=>s.id==="SCR-COR-004")));
check("object-family-based match",()=>assert.ok(searchWorkspaceRoutes("CorrosionDueCandidate").matches.some(s=>s.id==="SCR-COR-004")));
check("tokens match only the canonical metadata",()=>assert.equal(searchWorkspaceRoutes("inspection nonexistent").total,0));
check("bounded results and explicit truncation",()=>{const r=searchWorkspaceRoutes("SCR",9999);assert.equal(r.total,78);assert.equal(r.matches.length,WORKSPACE_RESULT_LIMIT);assert.ok(r.truncated);});
check("input is length-bounded",()=>assert.equal(searchWorkspaceRoutes("z".repeat(WORKSPACE_QUERY_LIMIT+20)).total,0));
check("all search results are canonical routes",()=>assert.ok(searchWorkspaceRoutes("asset").matches.every(s=>SCREEN_BY_ID.has(s.id))));
const ui=read("apps/aim-next/src/WorkspaceFinder.tsx");
const shell=read("apps/aim-next/src/FutureAimApp.tsx");
const css=read("apps/aim-next/src/styles.css");
check("finder only searches frozen route metadata",()=>assert.ok(ui.includes("searchWorkspaceRoutes(query)")));
check("finder has no network or record API",()=>{assert.ok(!/(fetch\s*\(|localStorage|sessionStorage|XMLHttpRequest|navigator\.sendBeacon)/.test(ui));assert.ok(!/assetSnapshot|corrosionSnapshot|inspectionSnapshot/.test(ui));});
check("scope rotation remounts finder state",()=>assert.ok(shell.includes('key={props.navigationScopeKey??"no-trusted-navigation-scope"}')));
check("finder uses existing canonical navigation function",()=>assert.ok(shell.includes("<WorkspaceFinder") && shell.includes("openScreen(target)")));
check("finder handles failure and truncation without unbounded DOM list",()=>assert.ok(ui.includes("results.truncated") && ui.includes("results.matches.map")));
check("no new screens or capability IDs",()=>{assert.equal(SCREEN_BY_ID.size,78);assert.equal(require("../apps/aim-next/src/capabilityRegistry.ts").CAPABILITIES.length,190);});
check("keyboard/focus/forced-colors/mobile CSS exists",()=>assert.ok(css.includes(".next-workspace-finder :is(summary,input,button):focus-visible") && css.includes("@media(forced-colors:active){.next-workspace-finder") && css.includes("@media(max-width:520px){.next-workspace-finder")));
console.log(`PASS Phase 46.11 offline workspace discovery contract: ${passed}/${passed}. NOT full runtime verification.`);
