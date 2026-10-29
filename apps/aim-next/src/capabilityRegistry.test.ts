import { describe, expect, it } from "vitest";
import { CAPABILITIES, CAPABILITY_BY_ID, DOMAINS, RETIRED_IDS, SCREEN_COUNTS } from "./capabilityRegistry";
import { SCREEN_BY_ID, SCREENS } from "./screenRegistry";
describe("frozen 190-function architecture registry",()=>{
  it("has exactly 190 active capability IDs",()=>{expect(CAPABILITIES).toHaveLength(190);expect(new Set(CAPABILITIES.map(c=>c.id)).size).toBe(190);});
  it("keeps all 15 domains",()=>expect(DOMAINS).toHaveLength(15));
  it("has 78 primary surfaces including three home screens and the global shell",()=>{expect(SCREENS).toHaveLength(78);expect(SCREEN_BY_ID.has("SCR-HOM-001")).toBe(true);expect(SCREEN_BY_ID.has("SCR-HOM-002")).toBe(true);expect(SCREEN_BY_ID.has("SCR-HOM-003")).toBe(true);expect(SCREEN_BY_ID.has("SCR-GLB-001")).toBe(true);});
  it("keeps retired VIS IDs unavailable",()=>{for(const id of RETIRED_IDS)expect(CAPABILITY_BY_ID.has(id)).toBe(false);expect(CAPABILITY_BY_ID.get("VIS-003")?.title).toBe("P&ID Contextual Navigation");});
  it.each([["AIR",11],["DGM",12],["COR",22],["INS",20],["RBI",19],["FND",11],["REC",10],["ACT",13],["IOW",11],["FFS",11],["GOV",14],["INT",11],["ANA",10],["FLD",9],["VIS",6]] as const)("preserves %s count",(code:string,count:number)=>expect(DOMAINS.find(d=>d.code===code)?.functions).toHaveLength(count));
  it("declares exactly the frozen domain screen counts",()=>expect(Object.values(SCREEN_COUNTS).reduce((a,b)=>a+b,0)).toBe(74));
  it("never exposes any executable approve capability from frontend registry",()=>expect(CAPABILITIES.every(c=>typeof c.controlled==="boolean" && !Object.hasOwn(c,"execute"))).toBe(true));
  it("keeps governing due-date ownership in INS",()=>{expect(CAPABILITY_BY_ID.get("INS-016")?.title).toContain("Governing");expect(CAPABILITY_BY_ID.get("COR-015")?.title).toContain("Candidate");expect(CAPABILITY_BY_ID.get("RBI-013")?.title).toContain("Candidate");});
});
