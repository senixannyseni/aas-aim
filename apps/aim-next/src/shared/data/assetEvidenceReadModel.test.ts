import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@bandha/aim-platform/api/apiClient";
import { decodeAssetEvidencePage, requestAssetEvidencePage, type EvidencePageRequest } from "./assetEvidenceReadModel";

const request: EvidencePageRequest = {
  assetId: "AST-001", viewRevisionId: "rev_8", group: "DISPLAYED_REVISION",
};
const baseItem = {
  id: "evidence-1", revisionId: "rev_8", kind: "MEASUREMENT",
  association: "USED_AS_BASIS", availability: "AVAILABLE", quality: "VALID",
  sourceReference: "source-document-1", basisReference: "approved-input-record-1",
  recordedAt: "2026-10-28T12:30:00Z",
};
const page = { assetId: "AST-001", viewRevisionId: "rev_8", group: "DISPLAYED_REVISION",
  snapshotKey: "server_generation_1", items: [baseItem], nextCursor: "cursor_2" };

describe("Stage 45.5 — authorized evidence response contract", () => {
  it("accepts exact-identity, revision-bound source references", () => {
    const result = decodeAssetEvidencePage(page, request);
    expect(result.items[0]?.revisionId).toBe("rev_8");
    expect(result.items[0]?.association).toBe("USED_AS_BASIS");
    expect(Object.isFrozen(result.items)).toBe(true);
  });
  it("does not accept a page returned for another asset or requested revision", () => {
    expect(() => decodeAssetEvidencePage({ ...page, assetId: "AST-002" }, request)).toThrow();
    expect(() => decodeAssetEvidencePage({ ...page, viewRevisionId: "rev_7" }, request)).toThrow();
    expect(() => decodeAssetEvidencePage({ ...page, items: [{ ...baseItem, revisionId: "rev_7" }] }, request)).toThrow();
  });
  it("accepts historical evidence only for distinct server-attested predecessor revisions", () => {
    const historic = { ...request, group: "HISTORICAL" as const };
    const result = decodeAssetEvidencePage({ ...page, group: "HISTORICAL",
      items: [{ ...baseItem, revisionId: "rev_7", association: "ASSOCIATED", basisReference: null }] }, historic);
    expect(result.items[0]?.revisionId).toBe("rev_7");
    expect(() => decodeAssetEvidencePage({ ...page, group: "HISTORICAL" }, historic)).toThrow();
  });
  it("requires USED_AS_BASIS provenance but never infers it from general association", () => {
    expect(() => decodeAssetEvidencePage({ ...page, items: [
      { ...baseItem, basisReference: null },
    ] }, request)).toThrow();
    expect(decodeAssetEvidencePage({ ...page, items: [{ ...baseItem,
      association: "ASSOCIATED", basisReference: null }] }, request).items[0]?.association)
      .toBe("ASSOCIATED");
  });
  it("keeps unavailable source records without exposing a source address", () => {
    const result = decodeAssetEvidencePage({ ...page, items: [
      { ...baseItem, availability: "UNAVAILABLE", sourceReference: null, quality: "SUSPECT" },
    ] }, request);
    expect(result.items[0]?.sourceReference).toBeNull();
    expect(() => decodeAssetEvidencePage({ ...page, items: [
      { ...baseItem, availability: "UNAVAILABLE" },
    ] }, request)).toThrow();
  });
  it("rejects excessive pages, duplicate IDs, invalid timestamps and unknown fields", () => {
    expect(() => decodeAssetEvidencePage({ ...page, items: Array.from({ length: 21 }, (_, i) =>
      ({ ...baseItem, id: `ev-${i}` })) }, request)).toThrow();
    expect(() => decodeAssetEvidencePage({ ...page, items: [baseItem, baseItem] }, request)).toThrow();
    expect(() => decodeAssetEvidencePage({ ...page, items: [{ ...baseItem,
      recordedAt: "2026-02-30T12:00:00Z" }] }, request)).toThrow();
    expect(() => decodeAssetEvidencePage({ ...page, secret: true }, request)).toThrow();
  });
  it("pins cursor pagination to an unchanged server snapshot", () => {
    const continued: EvidencePageRequest = { ...request, cursor: "cursor_2",
      snapshotKey: "server_generation_1" };
    expect(decodeAssetEvidencePage({ ...page, nextCursor: null }, continued).snapshotKey)
      .toBe("server_generation_1");
    expect(() => decodeAssetEvidencePage({ ...page, snapshotKey: "server_generation_2" }, continued)).toThrow();
    expect(() => decodeAssetEvidencePage({ ...page, nextCursor: "cursor_2" }, continued)).toThrow();
    expect(() => decodeAssetEvidencePage(page, { ...request, cursor: "cursor_2" })).toThrow();
  });
  it("rejects an empty page offering another cursor", () => {
    expect(() => decodeAssetEvidencePage({ ...page, items: [] }, request)).toThrow();
    expect(decodeAssetEvidencePage({ ...page, items: [], nextCursor: null }, request).items)
      .toHaveLength(0);
  });
  it("requests only an exact asset via authenticated transport and bounded query", async () => {
    const spy = vi.fn(async (value: { pathSegments: readonly string[];
      query?: Record<string, unknown>; decode: (input: unknown) => unknown }) => value.decode(page));
    const client = { request: spy } as unknown as ApiClient;
    const result = await requestAssetEvidencePage(client, request, new AbortController().signal);
    expect(result.items).toHaveLength(1);
    expect(spy.mock.calls[0]?.[0].pathSegments).toEqual(["v1", "assets", "AST-001", "evidence"]);
    expect(spy.mock.calls[0]?.[0].query).toEqual({ viewRevisionId: "rev_8",
      group: "DISPLAYED_REVISION", pageSize: 20 });
  });
});
