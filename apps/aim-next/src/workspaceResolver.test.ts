import {describe,it,expect} from "vitest";
import {DOMAINS} from "./capabilityRegistry";
import {SCREENS,SCREEN_BY_ID} from "./screenRegistry";
import {workspaceForScreen} from "./workspaceResolver";

const mappedScreens=SCREENS.map(s=>[s.id,s.domain] as const);
describe("Phase 21 canonical UI dispatch",()=>{
  it("covers exactly all 78 registered screens, including shared shells",()=>{
    expect(SCREENS).toHaveLength(78);
    expect(SCREEN_BY_ID.size).toBe(78);
    expect(mappedScreens.map(([id])=>id).filter((id,i,a)=>a.indexOf(id)===i)).toHaveLength(78);
  });
  it.each(mappedScreens)("resolves %s into a safe rendering owner",(id:string,domain:string)=>{
    const kind=workspaceForScreen(id);
    expect(kind).not.toBeNull();
    if(domain!=="HOM"&&domain!=="GLB")expect(kind).toBe(domain);
  });
  it("routes all HOME surfaces to the explicitly owned analytics/search workspaces",()=>{
    expect(workspaceForScreen("SCR-HOM-001")).toBe("ANA");
    expect(workspaceForScreen("SCR-HOM-002")).toBe("ANA");
    expect(workspaceForScreen("SCR-HOM-003")).toBe("DISCOVERY");
    expect(workspaceForScreen("SCR-GLB-001")).toBe("SHELL");
  });
  it.each(DOMAINS.map(d=>[d.code,d.code] as const))("keeps %s domain screens on their own rendering path",(code:string)=>{
    for(const screen of SCREENS.filter(s=>s.domain===code))expect(workspaceForScreen(screen.id)).toBe(code);
  });
  it.each(["SCR-HOM","SCR-GLB","SCR-VIS-000","SCR-VIS-999","VIS-001","VIS-002","SCR-ADMIN-001","SCR-HOM-003/other", "SCR-RBI-001?asset=other", ""])("fails closed for unknown or malformed screen %s",(id:string)=>{
    expect(workspaceForScreen(id)).toBeNull();
  });
});
