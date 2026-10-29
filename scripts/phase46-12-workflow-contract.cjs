#!/usr/bin/env node
"use strict";
/** Offline architecture-boundary checks. Not a TS7/Vitest/browser result. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
require("./phase46-2-source-loader.cjs");
const {SCREENS,SCREEN_BY_ID}=require("../apps/aim-next/src/screenRegistry.ts");
const {CAPABILITIES,CAPABILITY_BY_ID}=require("../apps/aim-next/src/capabilityRegistry.ts");
const {screenWorkflowGuidance,functionWorkflowGuidance,MAX_GUIDANCE_OBJECTS,MAX_GUIDANCE_TARGETS}=require("../apps/aim-next/src/workflowGuidance.ts");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
let count=0;
function check(label,fn){try{fn();count++;}catch(error){throw new Error(`${label}: ${error.message}`);}}
check("frozen screens",()=>assert.equal(SCREENS.length,78));
check("frozen capabilities",()=>assert.equal(CAPABILITIES.length,190));
check("every screen produces its own bounded guidance",()=>{for(const screen of SCREENS){const g=screenWorkflowGuidance(screen);assert.equal(g.screenId,screen.id);assert.ok(g.objectFamilies.length<=MAX_GUIDANCE_OBJECTS);assert.ok(g.relatedScreens.length<=MAX_GUIDANCE_TARGETS);}});
check("only declared objects",()=>{for(const screen of SCREENS){const g=screenWorkflowGuidance(screen);assert.ok(g.objectFamilies.every(item=>screen.objects.includes(item)));}});
check("only declared capabilities",()=>{for(const screen of SCREENS){const g=screenWorkflowGuidance(screen);assert.ok(g.mappedFunctions.every(id=>screen.functionIds.includes(id)&&CAPABILITY_BY_ID.has(id)));}});
check("protected functions require mapped IDs",()=>{for(const screen of SCREENS){const g=screenWorkflowGuidance(screen);assert.ok(g.protectedFunctionIds.every(id=>screen.functionIds.includes(id)));}});
check("same domain and shared function for related screens",()=>{for(const screen of SCREENS){const g=screenWorkflowGuidance(screen);for(const related of g.relatedScreens){assert.ok(related.id!==screen.id&&SCREEN_BY_ID.get(related.id)===related);assert.equal(related.domain,screen.domain);assert.ok(related.functionIds.some(id=>screen.functionIds.includes(id)));}}});
check("no invented function target",()=>{for(const capability of CAPABILITIES){const g=functionWorkflowGuidance(capability);assert.ok(g.targetScreens.every(screen=>screen.functionIds.includes(capability.id)));}});
check("function objects from mapped screen family only",()=>{for(const capability of CAPABILITIES){const g=functionWorkflowGuidance(capability);const all=new Set(g.targetScreens.flatMap(s=>s.objects));assert.ok(g.objectFamilies.every(name=>all.has(name)));}});
check("COR due candidate authority note intact",()=>assert.match(screenWorkflowGuidance(SCREEN_BY_ID.get("SCR-COR-004")).note,/INS-016/));
check("INS governing review authority note intact",()=>assert.match(screenWorkflowGuidance(SCREEN_BY_ID.get("SCR-INS-006")).note,/credit separate/));
const ui=read("apps/aim-next/src/ScreenWorkflowGuide.tsx");const shell=read("apps/aim-next/src/FutureAimApp.tsx");const css=read("apps/aim-next/src/styles.css");
check("disclosure closed by default",()=>assert.ok(ui.includes('<details className="next-object-details next-workflow-guide"')&&!ui.includes("defaultOpen")));
check("guide does not read user records, credentials or browser storage",()=>assert.ok(!/fetch\s*\(|localStorage|sessionStorage|assetSnapshot|corrosionSnapshot|inspectionSnapshot|AuthSessionBoundary/.test(ui)));
check("guide navigation uses canonical passed-in target only",()=>assert.ok(ui.includes('onNavigate(target)')&&shell.includes('<ScreenWorkflowGuide screen={currentScreen} onNavigate={openScreen}/>')));
check("inspector uses same function guide",()=>assert.ok(shell.includes("functionWorkflowGuidance(feature)")));
check("no approval or command buttons in guide",()=>assert.ok(!/approve\(|submit\(|save\(/i.test(ui)));
check("accessible focus, mobile, forced-colors CSS",()=>assert.ok(css.includes(".next-workflow-guide :is(summary,button):focus-visible")&&css.includes("@media(forced-colors:active){.next-workflow-guide")&&css.includes("@media(max-width:640px){.next-workflow-grid")));
check("screen route ID registry untouched",()=>assert.equal(SCREEN_BY_ID.size,78));
console.log(`PASS Phase 46.12 offline workflow guidance contract: ${count}/${count}. NOT full runtime verification.`);
