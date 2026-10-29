import {describe, expect, it} from "vitest";
import {CAPABILITY_BY_ID} from "./capabilityRegistry";
import {SCREEN_BY_ID} from "./screenRegistry";
import {functionWorkflowGuidance,screenWorkflowGuidance,MAX_GUIDANCE_OBJECTS,MAX_GUIDANCE_TARGETS} from "./workflowGuidance";

const screen = (id:string) => {
  const candidate = SCREEN_BY_ID.get(id);
  if (!candidate) throw new Error(`Missing frozen route: ${id}`);
  return candidate;
};

describe("Phase 46.12 — architecture-only workflow guidance",()=>{
  it("reads mapped COR families without claiming available evidence",()=>{
    const model=screenWorkflowGuidance(screen("SCR-COR-004"));
    expect(model.screenId).toBe("SCR-COR-004");
    expect(model.objectFamilies).toContain("CorrosionDueCandidate");
    expect(model.objectFamilies.length).toBeLessThanOrEqual(MAX_GUIDANCE_OBJECTS);
    expect(model.note).toContain("INS-016");
  });
  it("does not infer that COR due candidates govern INS dates",()=>{
    const cor=screenWorkflowGuidance(screen("SCR-COR-004"));
    expect(cor.note).toContain("due candidate");
    expect(cor.note).toContain("governing technical due date");
  });
  it("flags protected transitions without granting them",()=>{
    const model=screenWorkflowGuidance(screen("SCR-INS-006"));
    expect(model.protectedFunctionIds.every(id=>model.mappedFunctions.includes(id))).toBe(true);
    expect(model.reviewBoundary).toMatch(/owning service|approval/);
  });
  it("treats an unprotected function as requiring backend authorization",()=>{
    const capability=CAPABILITY_BY_ID.get("AIR-002")!;
    const model=functionWorkflowGuidance(capability);
    expect(model.functionId).toBe(capability.id);
    expect(model.reviewBoundary).toMatch(/backend verification|cannot execute/);
  });
  it("links only screens sharing a function in the same domain",()=>{
    const input=screen("SCR-COR-004");
    const guide=screenWorkflowGuidance(input);
    expect(guide.relatedScreens.length).toBeLessThanOrEqual(MAX_GUIDANCE_TARGETS);
    for (const target of guide.relatedScreens) {
      expect(target.id).not.toBe(input.id);
      expect(target.domain).toBe(input.domain);
      expect(target.functionIds.some(id=>input.functionIds.includes(id))).toBe(true);
    }
  });
  it("never fabricates cross-domain navigation for similar object terms",()=>{
    expect(screenWorkflowGuidance(screen("SCR-COR-004")).relatedScreens.every(s=>s.domain==="COR")).toBe(true);
  });
  it("includes exact mapped target screens for a function",()=>{
    const capability=CAPABILITY_BY_ID.get("INS-016")!;
    const guide=functionWorkflowGuidance(capability);
    expect(guide.targetScreens.some(s=>s.id==="SCR-INS-002")).toBe(true);
  });
  it("does not introduce synthetic object data",()=>{
    const guide=screenWorkflowGuidance(screen("SCR-AIR-001"));
    expect(guide.objectFamilies.every(name=>screen("SCR-AIR-001").objects.includes(name))).toBe(true);
  });
});
