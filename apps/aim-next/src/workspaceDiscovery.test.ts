import {describe,expect,it} from "vitest";
import {SCREEN_BY_ID} from "./screenRegistry";
import {searchWorkspaceRoutes,WORKSPACE_QUERY_LIMIT,WORKSPACE_RESULT_LIMIT} from "./workspaceDiscovery";

describe("Phase 46.11 canonical workspace discovery",()=>{
  it("preserves all 78 canonical screen identities",()=>expect(SCREEN_BY_ID.size).toBe(78));
  it("requires explicit text instead of dumping the entire catalogue",()=>{
    expect(searchWorkspaceRoutes("")).toEqual({matches:[],total:0,truncated:false});
    expect(searchWorkspaceRoutes(null).matches).toEqual([]);
  });
  it("matches exact canonical screen ID first",()=>{
    const result=searchWorkspaceRoutes("SCR-COR-004");
    expect(result.matches[0]?.id).toBe("SCR-COR-004");
  });
  it("matches case-insensitive titles and domain names",()=>{
    expect(searchWorkspaceRoutes("inspection technical review").matches[0]?.id).toBe("SCR-INS-006");
    expect(searchWorkspaceRoutes("corrosion").total).toBeGreaterThan(1);
  });
  it("finds mapped capabilities even when their labels differ from the route",()=>{
    expect(searchWorkspaceRoutes("COR-015").matches.some(s=>s.id==="SCR-COR-004")).toBe(true);
  });
  it("finds canonical object names without exposing runtime records",()=>{
    expect(searchWorkspaceRoutes("CorrosionDueCandidate").matches.some(s=>s.id==="SCR-COR-004")).toBe(true);
    expect(searchWorkspaceRoutes("tenant-secret-unique").total).toBe(0);
  });
  it("matches every token without treating spaces as exact phrases",()=>{
    expect(searchWorkspaceRoutes("inspection requirement").matches.some(s=>s.id==="SCR-INS-002")).toBe(true);
    expect(searchWorkspaceRoutes("inspection nonexistent").total).toBe(0);
  });
  it("caps results, exposes truncation, and does not allow callers to override the cap",()=>{
    const result=searchWorkspaceRoutes("SCR",99999);
    expect(result.total).toBe(78);
    expect(result.matches).toHaveLength(WORKSPACE_RESULT_LIMIT);
    expect(result.truncated).toBe(true);
  });
  it("bounds search input length and never returns noncanonical targets",()=>{
    const result=searchWorkspaceRoutes("x".repeat(WORKSPACE_QUERY_LIMIT+30));
    expect(result.matches).toHaveLength(0);
    expect(searchWorkspaceRoutes("asset").matches.every(s=>SCREEN_BY_ID.has(s.id))).toBe(true);
  });
});
