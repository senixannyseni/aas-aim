import { describe, expect, it } from "vitest";
import { MAX_RECENT_WORKSPACES, recentWorkspaceTargets, recordWorkspaceVisit } from "./workspaceTrail";

describe("Phase 46.8 — scope-local workspace trail", () => {
  it("starts empty and rejects arbitrary, invalid and retired identifiers", () => {
    const empty: readonly string[] = [];
    expect(recordWorkspaceVisit(empty, "../admin")).toBe(empty);
    expect(recordWorkspaceVisit(empty, "SCR-VIS-999")).toBe(empty);
    expect(recordWorkspaceVisit(empty, {tenant:"x"})).toBe(empty);
  });
  it("keeps only canonical screen IDs in most-recent order with deduplication", () => {
    let visits: readonly string[] = [];
    for(const id of ["SCR-AIR-001","SCR-COR-001","SCR-INS-001","SCR-COR-001"]){
      visits=recordWorkspaceVisit(visits,id);
    }
    expect(visits).toEqual(["SCR-COR-001","SCR-INS-001","SCR-AIR-001"]);
    expect(recentWorkspaceTargets(visits,"SCR-COR-001")).toEqual(["SCR-INS-001","SCR-AIR-001"]);
  });
  it("bounds retained history and does not let unknown entries through", () => {
    let visits: readonly string[] = [];
    for(const id of ["SCR-AIR-001","SCR-AIR-002","SCR-AIR-003","SCR-COR-001","SCR-COR-002","SCR-INS-001","SCR-INS-002"]){
      visits=recordWorkspaceVisit(visits,id);
    }
    expect(visits).toHaveLength(MAX_RECENT_WORKSPACES);
    expect(visits).not.toContain("SCR-AIR-001");
    expect(recentWorkspaceTargets(["invalid",...visits],"SCR-INS-002")).toHaveLength(MAX_RECENT_WORKSPACES-1);
  });
});
