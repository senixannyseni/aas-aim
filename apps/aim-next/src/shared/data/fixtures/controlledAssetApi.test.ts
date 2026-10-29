import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import { decodeAssetRegisterPage } from
  "@bandha/aim-platform/assets/assetRegisterAdapter";
import { requestAssetDetail, classifyAssetDetailFailure } from "../assetDetailReadModel";
import { classifyAssetEvidenceFailure, requestAssetEvidencePage } from "../assetEvidenceReadModel";
import { createControlledAssetApi } from "./controlledAssetApi";

const sessions = new Set<AuthSessionBoundary>();
afterEach(() => { for (const boundary of sessions) boundary.dispose(); sessions.clear(); });

function setup(site: "a" | "b" = "a") {
  const fixture = createControlledAssetApi();
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: fixture.fetchImpl });
  sessions.add(boundary);
  boundary.activate({ subjectKey: "synthetic", tenantKey: `site-${site}`,
    sessionKey: "synthetic-session", getAccessToken: () => `fixture-site-${site}` });
  const client = boundary.getSnapshot().client;
  if (client === null) throw new Error("The controlled session failed to activate.");
  return { fixture, boundary, client };
}
const abort = () => new AbortController().signal;
const evidenceRequest = { assetId: "AST-001", viewRevisionId: "rev_8",
  group: "DISPLAYED_REVISION" as const };

describe("Stage 45.7 controlled Asset API contract", () => {
  it("returns only assets belonging to the current test scope", async () => {
    const { fixture, client } = setup();
    const page = await client.request({ pathSegments: ["v1", "assets"],
      query: { page: 1, pageSize: 10 }, decode: decodeAssetRegisterPage });
    expect(page.items.map(item => item.record.id)).toEqual(["AST-001", "AST-002"]);
    expect(fixture.requests()).toEqual([expect.objectContaining({
      route: "register", credentials: "omit", cache: "no-store", redirect: "error",
    })]);
  });

  it("requires independent detail authorization after register visibility", async () => {
    const { client } = setup();
    await expect(requestAssetDetail(client, "AST-002", abort())).rejects.toMatchObject({ status: 403 });
    const detail = await requestAssetDetail(client, "AST-001", abort());
    expect(detail.asset.id).toBe("AST-001");
    expect(detail.revision.state).toBe("DRAFT");
    expect(detail.governingRevisionId).toBe("rev_7");
  });

  it("does not disclose cross-scope assets or details", async () => {
    const { client } = setup("b");
    const page = await client.request({ pathSegments: ["v1", "assets"],
      decode: decodeAssetRegisterPage });
    expect(page.items.map(item => item.record.id)).toEqual(["AST-003"]);
    await expect(requestAssetDetail(client, "AST-001", abort())).rejects.toMatchObject({ status: 404 });
  });

  it("fetches current and historical revision evidence separately", async () => {
    const { client } = setup();
    const first = await requestAssetEvidencePage(client, evidenceRequest, abort());
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).toBe("c_20");
    expect(first.items.every(item => item.revisionId === "rev_8")).toBe(true);
    const second = await requestAssetEvidencePage(client, {
      ...evidenceRequest, cursor: first.nextCursor, snapshotKey: first.snapshotKey,
    }, abort());
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const historical = await requestAssetEvidencePage(client, {
      ...evidenceRequest, group: "HISTORICAL",
    }, abort());
    expect(historical.items.map(item => item.revisionId)).toEqual(["rev_7"]);
  });

  it("rejects expired source-generation cursors, then allows restarting", async () => {
    const { fixture, client } = setup();
    const first = await requestAssetEvidencePage(client, evidenceRequest, abort());
    fixture.rotateEvidenceGeneration();
    try {
      await requestAssetEvidencePage(client, {
        ...evidenceRequest, cursor: first.nextCursor, snapshotKey: first.snapshotKey,
      }, abort());
      throw new Error("Expected an expired evidence cursor");
    } catch (failure) {
      expect(classifyAssetEvidenceFailure(failure)).toEqual({ kind: "source_generation_changed" });
    }
    const restarted = await requestAssetEvidencePage(client, evidenceRequest, abort());
    expect(restarted.snapshotKey).not.toBe(first.snapshotKey);
  });

  it("rejects mismatched detail identity and inconsistent list totals", async () => {
    const { fixture, client } = setup();
    fixture.setNextFault("detail", "mismatched_detail_identity");
    await expect(requestAssetDetail(client, "AST-001", abort())).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    fixture.setNextFault("register", "invalid_register_pagination");
    await expect(client.request({ pathSegments: ["v1", "assets"],
      decode: decodeAssetRegisterPage })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects detail revisions that cannot be used by the Evidence API", async () => {
    const { fixture, client } = setup();
    fixture.setNextFault("detail", "invalid_detail_revision_identity");
    await expect(requestAssetDetail(client, "AST-001", abort()))
      .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    // A valid detail revision can be used in a subsequent evidence query.
    const detail = await requestAssetDetail(client, "AST-001", abort());
    const page = await requestAssetEvidencePage(client, {
      assetId: detail.asset.id, viewRevisionId: detail.revision.id,
      group: "DISPLAYED_REVISION",
    }, abort());
    expect(page.viewRevisionId).toBe(detail.revision.id);
  });
  it("rejects malformed evidence counts and generation mismatches", async () => {
    const { fixture, client } = setup();
    fixture.setNextFault("evidence", "oversized_evidence_page");
    await expect(requestAssetEvidencePage(client, evidenceRequest, abort())).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    const first = await requestAssetEvidencePage(client, evidenceRequest, abort());
    fixture.setNextFault("evidence", "mismatched_evidence_generation");
    await expect(requestAssetEvidencePage(client, {
      ...evidenceRequest, cursor: first.nextCursor, snapshotKey: first.snapshotKey,
    }, abort())).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("reports service failure as unavailable, never an empty success", async () => {
    const { fixture, client } = setup();
    fixture.setNextFault("detail", "http_503");
    try {
      await requestAssetDetail(client, "AST-001", abort());
      throw new Error("Expected an HTTP failure");
    } catch (failure) {
      expect(classifyAssetDetailFailure(failure)).toEqual({ kind: "service_unavailable" });
    }
  });

  it("revokes old requests immediately, including when transport ignores abort", async () => {
    const fixture = createControlledAssetApi();
    const delayed: { deliver: ((response: Response) => void) | null } = { deliver: null };
    const fetchImpl: typeof fetch = (input, init) => {
      if (String(input).endsWith("/AST-001")) {
        return new Promise<Response>(resolve => { delayed.deliver = resolve; });
      }
      return fixture.fetchImpl(input, init);
    };
    const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl });
    sessions.add(boundary);
    boundary.activate({ subjectKey: "s", tenantKey: "site-a", sessionKey: "s1",
      getAccessToken: () => "fixture-site-a" });
    const client = boundary.getSnapshot().client;
    if (client === null) throw new Error("Missing client");
    const pending = requestAssetDetail(client, "AST-001", abort());
    // Allow token acquisition and the injected fetch to start.
    for (let i = 0; i < 10 && delayed.deliver === null; i++) await Promise.resolve();
    const deliver = delayed.deliver;
    if (deliver === null) throw new Error("The delayed response did not start.");
    boundary.transition("revoked");
    deliver(new Response(JSON.stringify({ asset: { id: "AST-001" } }), {
      headers: { "content-type": "application/json" },
    }));
    await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
  });
});
