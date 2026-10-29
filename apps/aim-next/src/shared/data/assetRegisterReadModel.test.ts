import { describe, expect, it } from "vitest";
import { decodeAssetRegisterPage } from
  "@bandha/aim-platform/assets/assetRegisterAdapter";
import {
  projectAssetRegisterPage, selectVisibleAsset, selectionIsVisible,
} from "./assetRegisterReadModel";

function page(items: unknown[]) {
  return decodeAssetRegisterPage({
    items,
    pageInfo: {
      page: 1, pageSize: 10, totalItems: items.length,
      totalPages: 1, hasNextPage: false,
    },
  });
}
const base = { id: "asset-a", tag: "V-101", name: "Synthetic vessel" };

describe("Stage 45.3 — Asset Register list projection", () => {
  it("does not invent missing hierarchy, revision, condition or type", () => {
    const result = projectAssetRegisterPage(page([base]));
    expect(result.items[0]).toEqual({
      assetId: "asset-a", tag: "V-101", name: "Synthetic vessel",
      reportedRisk: { kind: "not_provided" },
      reportedEvidence: { kind: "not_provided" },
    });
    expect("revision" in result.items[0]!).toBe(false);
    expect("parentId" in result.items[0]!).toBe(false);
  });
  it("preserves explicit nulls separately from absent fields", () => {
    const result = projectAssetRegisterPage(page([{
      ...base, riskClassification: null, evidenceAssessment: null,
    }]));
    expect(result.items[0]?.reportedRisk.kind).toBe("explicit_null");
    expect(result.items[0]?.reportedEvidence.kind).toBe("explicit_null");
  });
  it("preserves reported status with its provenance basis", () => {
    const result = projectAssetRegisterPage(page([{
      ...base,
      riskClassification: {
        level: "HIGH", basisRecordId: "rbi-test", assessedAt: "2026-10-20T09:00:00Z",
      },
      evidenceAssessment: {
        state: "STALE", basisRecordId: "evidence-test", evaluatedAt: "2026-10-20T08:00:00Z",
      },
    }]));
    expect(result.items[0]?.reportedRisk).toMatchObject({
      kind: "reported", status: "HIGH", basis: { basisRecordId: "rbi-test" },
    });
    expect(result.items[0]?.reportedEvidence).toMatchObject({
      kind: "reported", status: "STALE", basis: { basisRecordId: "evidence-test" },
    });
  });
  it("allows selection only from the page actually supplied", () => {
    const result = projectAssetRegisterPage(page([base]));
    expect(selectVisibleAsset(result, "asset-other", 5)).toBeNull();
    const selected = selectVisibleAsset(result, "asset-a", 5);
    expect(selected).toEqual({ assetId: "asset-a", sessionRevision: 5 });
    expect(selectionIsVisible(selected, result, 5)).toBe(true);
    expect(selectionIsVisible(selected, result, 6)).toBe(false);
    expect(selectionIsVisible(selected,
      projectAssetRegisterPage(page([])), 5)).toBe(false);
  });
});
