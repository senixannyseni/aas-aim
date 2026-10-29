import { describe,expect,it } from "vitest";
import {CAPABILITIES,RETIRED_IDS,DOMAINS,SCREEN_COUNTS} from "./capabilityRegistry";
import {SCREENS,SCREEN_BY_ID,SCREENS_BY_FUNCTION,TOTAL_SCREEN_TARGETS} from "./screenRegistry";
import {DEFAULT_SCREEN_ID,readScreenRoute,screenHref} from "./screenRouting";

describe("frozen Artifact 6 screen to function/object matrix",()=>{
  it("maps 74 domain screens, three HOME screens and the global shell",()=>{
    expect(TOTAL_SCREEN_TARGETS).toBe(78);
    expect(SCREENS.filter(s=>s.domain==="HOM")).toHaveLength(3);
    expect(SCREENS.filter(s=>s.domain==="GLB")).toHaveLength(1);
    for(const domain of DOMAINS) expect(SCREENS.filter(s=>s.domain===domain.code)).toHaveLength(SCREEN_COUNTS[domain.code]);
    expect(SCREEN_BY_ID.has("SCR-HOM")).toBe(false);
    expect(SCREEN_BY_ID.has("SCR-GLB")).toBe(false);
  });
  it("maps all 190 capabilities to at least one screen",()=>{
    expect(CAPABILITIES).toHaveLength(190);
    for(const cap of CAPABILITIES){
      const matches=SCREENS_BY_FUNCTION.get(cap.id);
      expect(matches?.length,cap.id).toBeGreaterThan(0);
      expect(matches?.every(s=>s.functionIds.includes(cap.id))).toBe(true);
    }
  });
  it("does not reuse retired visualization functions",()=>{
    for(const id of RETIRED_IDS){expect(SCREENS_BY_FUNCTION.has(id)).toBe(false);expect(SCREENS.some(s=>s.functionIds.includes(id))).toBe(false);}
  });
  it("keeps protected transitions on owning screens only",()=>{
    const approved:[string,string][]=[
      ["INS-012","SCR-INS-006"],["INS-020","SCR-INS-006"],
      ["COR-018","SCR-COR-004"],["RBI-018","SCR-RBI-002"],
      ["FFS-010","SCR-FFS-002"],["ACT-007","SCR-ACT-004"],
      ["VIS-008","SCR-VIS-006"]];
    for(const [f,s] of approved)expect(SCREEN_BY_ID.get(s)?.protectedFunctions).toContain(f);
    for(const s of SCREENS)if(["ANA","FLD","HOM","INT"].includes(s.domain))expect(s.protectedFunctions).toHaveLength(0);
  });
  it("retains separate due-date candidate and governing-due sources",()=>{
    expect(SCREEN_BY_ID.get("SCR-COR-004")?.functionIds).toContain("COR-015");
    expect(SCREEN_BY_ID.get("SCR-RBI-002")?.functionIds).toContain("RBI-013");
    expect(SCREEN_BY_ID.get("SCR-INS-002")?.functionIds).toContain("INS-016");
  });
  it("records object families for each screen",()=>{
    for(const screen of SCREENS){
      expect(screen.objects.length,screen.id).toBeGreaterThan(0);
      expect(screen.functionIds.length,screen.id).toBeGreaterThan(0);
    }
  });
});

describe("safe static deep links",()=>{
  it("routes each canonical screen exactly",()=>{for(const s of SCREENS)expect(readScreenRoute(screenHref(s.id))).toBe(s.id);});
  it("starts on the enterprise overview",()=>expect(DEFAULT_SCREEN_ID).toBe("SCR-HOM-001"));
  it.each(["#/screens/SCR-HOM","#/screens/SCR-GLB","#/screens/VIS-001","#/screens/SCR-VIS-001/%2E%2E","#//screens/SCR-AIR-001","#/screens/SCR-UNKNOWN-001", "#/screens/SCR-AIR-001?tenant=other", "https://evil.test/#/screens/SCR-AIR-001"])("rejects unsupported route %s",(hash:string)=>expect(readScreenRoute(hash)).toBeNull());
  it("refuses fabricated screen hyperlinks",()=>expect(()=>screenHref("SCR-FAKE-001")).toThrow("Unknown AIM screen"));
});
