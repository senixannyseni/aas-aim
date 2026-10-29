import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@bandha/aim-platform/api/apiClient";
import { ApiClientError } from "@bandha/aim-platform/api/apiClient";
import { classifyAssetDetailFailure, decodeAssetDetailResponse,
  requestAssetDetail } from "./assetDetailReadModel";

const valid = {
  asset: { id: "AST-001", tag: "V-101", name: "Synthetic vessel" },
  revision: {
    id: "rev_7", label: "7", state: "RELEASED", changedAt: "2026-10-28T13:20:00Z",
    sourceReference: "synthetic-document-7",
  },
  governingRevisionId: "rev_7",
};

describe("Stage 45.4 — independently authorized Asset Detail contract", () => {
  it("parses the exact selected asset and its reported governing revision", () => {
    const result = decodeAssetDetailResponse(valid, "AST-001");
    expect(result.asset.id).toBe("AST-001");
    expect(result.revision.state).toBe("RELEASED");
    expect(result.governingRevisionId).toBe("rev_7");
  });
  it("rejects detail returned for a different asset", () => {
    expect(() => decodeAssetDetailResponse(valid, "AST-002")).toThrow();
  });
  it("retains separate working and governing revisions", () => {
    const draft = decodeAssetDetailResponse({
      ...valid, revision: { ...valid.revision, id: "rev_8", state: "DRAFT" },
    }, "AST-001");
    expect(draft.revision.id).toBe("rev_8");
    expect(draft.governingRevisionId).toBe("rev_7");
  });
  it("rejects an unreleased revision claiming to govern itself", () => {
    expect(() => decodeAssetDetailResponse({
      ...valid, revision: { ...valid.revision, state: "DRAFT" },
    }, "AST-001")).toThrow();
  });
  it("rejects invalid timestamps, unexpected properties and malformed IDs", () => {
    expect(() => decodeAssetDetailResponse({
      ...valid, revision: { ...valid.revision, changedAt: "2026-02-30T11:00:00Z" },
    }, "AST-001")).toThrow();
    expect(() => decodeAssetDetailResponse({ ...valid, isApproved: true }, "AST-001")).toThrow();
    expect(() => decodeAssetDetailResponse(valid, "../other/asset")).toThrow();
  });
  it("requires evidence-compatible revision identifiers on both revision fields", () => {
    for (const invalid of ["rev/8", "rev.8", "rev 8", "../revision", "rev:8"]) {
      expect(() => decodeAssetDetailResponse({ ...valid,
        revision: { ...valid.revision, id: invalid }, governingRevisionId: "rev_7",
      }, "AST-001")).toThrow();
      expect(() => decodeAssetDetailResponse({ ...valid,
        governingRevisionId: invalid,
      }, "AST-001")).toThrow();
    }
    expect(decodeAssetDetailResponse({ ...valid,
      revision: { ...valid.revision, id: "rev-8", state: "DRAFT" },
    }, "AST-001").revision.id).toBe("rev-8");
  });
  it("retains omitted and explicit-null description fields distinctly", () => {
    const absent = decodeAssetDetailResponse(valid, "AST-001");
    const present = decodeAssetDetailResponse({ ...valid,
      asset: { ...valid.asset, assetType: null },
    }, "AST-001");
    expect("assetType" in absent.asset).toBe(false);
    expect(present.asset.assetType).toBeNull();
  });
  it("requests only the selected ID via an injected authenticated client", async () => {
    const request = vi.fn(async (value: { pathSegments: readonly string[];
      decode: (input: unknown) => unknown }) => value.decode(valid));
    const client = { request } as unknown as ApiClient;
    const result = await requestAssetDetail(client, "AST-001", new AbortController().signal);
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[0].pathSegments).toEqual(["v1", "assets", "AST-001"]);
    expect(result.asset.id).toBe("AST-001");
  });
  it("does not leak backend error text into presentation classification", () => {
    expect(classifyAssetDetailFailure(new ApiClientError("HTTP_ERROR", "Secret", 403)))
      .toEqual({ kind: "access_denied" });
    expect(classifyAssetDetailFailure(new ApiClientError("HTTP_ERROR", "Secret", 401)))
      .toEqual({ kind: "authentication_required" });
    expect(classifyAssetDetailFailure(new ApiClientError("TIMEOUT", "Secret")))
      .toEqual({ kind: "timeout" });
  });
});
