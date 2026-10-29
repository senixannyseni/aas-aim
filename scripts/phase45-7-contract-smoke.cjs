#!/usr/bin/env node
/** Stage 45.7 fixture transport smoke; uses shared platform source from Stage 46.2. */
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const {root: base} = require("./phase46-2-source-loader.cjs");
const { createAuthSessionBoundary } = require(path.join(base,
  "apps/web/src/shared/auth/authSession.ts"));
const { decodeAssetRegisterPage } = require(path.join(base,
  "apps/web/src/features/assets/assetRegisterAdapter.ts"));
const { requestAssetDetail, classifyAssetDetailFailure } = require(path.join(base,
  "apps/aim-next/src/shared/data/assetDetailReadModel.ts"));
const { requestAssetEvidencePage, classifyAssetEvidenceFailure } = require(path.join(base,
  "apps/aim-next/src/shared/data/assetEvidenceReadModel.ts"));
const { createControlledAssetApi } = require(path.join(base,
  "apps/aim-next/src/shared/data/fixtures/controlledAssetApi.ts"));
const abort = () => new AbortController().signal;
const evidenceReq = { assetId: "AST-001", viewRevisionId: "rev_8", group: "DISPLAYED_REVISION" };
let passed = 0;
function check(condition, label) { assert.ok(condition, label); passed++; }
function same(actual, expected, label) { assert.deepEqual(actual, expected, label); passed++; }
async function rejected(promise, key, value, label) {
  await assert.rejects(promise, error => Boolean(error && error[key] === value), label);
  passed++;
}
function setup(site = "a") {
  const fixture = createControlledAssetApi();
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: fixture.fetchImpl });
  boundary.activate({ subjectKey: "synthetic", tenantKey: `site-${site}`,
    sessionKey: "synthetic", getAccessToken: () => `fixture-site-${site}` });
  const client = boundary.getSnapshot().client;
  assert.ok(client);
  return { fixture, boundary, client };
}
(async () => {
  {
    const { fixture, boundary, client } = setup();
    const register = await client.request({ pathSegments: ["v1", "assets"],
      query: { page: 1, pageSize: 10 }, decode: decodeAssetRegisterPage });
    same(register.items.map(item => item.record.id), ["AST-001", "AST-002"], "scope-isolated register");
    check(fixture.requests()[0].credentials === "omit", "no ambient cookies");
    check(fixture.requests()[0].cache === "no-store", "no cache");
    check(fixture.requests()[0].redirect === "error", "redirects disallowed");
    await rejected(requestAssetDetail(client, "AST-002", abort()), "status", 403, "list does not grant detail");
    const notProvided = await client.request({ pathSegments: ["v1", "assets"],
      query: { risk: "NOT_PROVIDED", evidence: "NOT_PROVIDED" }, decode: decodeAssetRegisterPage });
    same(notProvided.items.length, 2, "not-provided is not UNKNOWN");
    const noHighRisk = await client.request({ pathSegments: ["v1", "assets"],
      query: { risk: "HIGH" }, decode: decodeAssetRegisterPage });
    same(noHighRisk.items.length, 0, "absent classification is not HIGH risk");
    await rejected(client.request({ pathSegments: ["v1", "assets"],
      query: { tenant: "site-b" }, decode: decodeAssetRegisterPage }), "status", 400,
      "tenant query cannot change authorization scope");
    await rejected(client.request({ pathSegments: ["v1", "evidence", "body"],
      decode: value => value }), "status", 404, "source contents are not served by fixture");
    const detail = await requestAssetDetail(client, "AST-001", abort());
    same(detail.asset.id, "AST-001", "exact ID");
    same(detail.revision.state, "DRAFT", "displayed draft");
    same(detail.governingRevisionId, "rev_7", "governing revision distinct");
    const first = await requestAssetEvidencePage(client, evidenceReq, abort());
    same(first.items.length, 20, "bounded first evidence page");
    same(first.nextCursor, "c_20", "opaque pagination cursor");
    check(first.items.every(item => item.revisionId === "rev_8"), "displayed evidence revision");
    check(first.items[1].sourceReference === null, "unavailable source metadata preserved");
    const second = await requestAssetEvidencePage(client, {
      ...evidenceReq, cursor: first.nextCursor, snapshotKey: first.snapshotKey,
    }, abort());
    same(second.items.length, 1, "last evidence page");
    same(second.nextCursor, null, "terminal cursor");
    const history = await requestAssetEvidencePage(client, {
      ...evidenceReq, group: "HISTORICAL",
    }, abort());
    same(history.items[0].revisionId, "rev_7", "historical predecessor");
    fixture.rotateEvidenceGeneration();
    try {
      await requestAssetEvidencePage(client, {
        ...evidenceReq, cursor: first.nextCursor, snapshotKey: first.snapshotKey,
      }, abort());
      assert.fail("Expected a cursor-generation conflict");
    } catch (failure) {
      same(failure.status, 409, "reject expired cursor generation");
      same(classifyAssetEvidenceFailure(failure), { kind: "source_generation_changed" },
        "expired cursor recovery is explicit");
    }
    const restarted = await requestAssetEvidencePage(client, evidenceReq, abort());
    check(restarted.snapshotKey !== first.snapshotKey, "fresh source generation");
    fixture.setNextFault("detail", "mismatched_detail_identity");
    await rejected(requestAssetDetail(client, "AST-001", abort()), "code", "INVALID_RESPONSE", "reject wrong asset detail ID");
    fixture.setNextFault("register", "invalid_register_pagination");
    await rejected(client.request({ pathSegments: ["v1", "assets"],
      decode: decodeAssetRegisterPage }), "code", "INVALID_RESPONSE", "reject pagination inconsistency");
    fixture.setNextFault("evidence", "oversized_evidence_page");
    await rejected(requestAssetEvidencePage(client, evidenceReq, abort()), "code", "INVALID_RESPONSE", "reject over-limit evidence");
    const now = await requestAssetEvidencePage(client, evidenceReq, abort());
    fixture.setNextFault("evidence", "mismatched_evidence_generation");
    await rejected(requestAssetEvidencePage(client, { ...evidenceReq,
      cursor: now.nextCursor, snapshotKey: now.snapshotKey,
    }, abort()), "code", "INVALID_RESPONSE", "reject mismatched source generation");
    fixture.setNextFault("detail", "http_503");
    try { await requestAssetDetail(client, "AST-001", abort()); assert.fail("Expected HTTP 503"); }
    catch (err) { same(classifyAssetDetailFailure(err).kind, "service_unavailable", "service error not empty result"); }
    boundary.transition("expired");
    await rejected(requestAssetDetail(client, "AST-001", abort()), "code", "ABORTED", "old client revoked");
    boundary.dispose();
  }
  {
    const { boundary, client } = setup("b");
    const register = await client.request({ pathSegments: ["v1", "assets"],
      decode: decodeAssetRegisterPage });
    same(register.items.map(item => item.record.id), ["AST-003"], "other tenant list");
    await rejected(requestAssetDetail(client, "AST-001", abort()), "status", 404, "cross-scope detail hidden");
    boundary.dispose();
  }
  {
    const fixture = createControlledAssetApi();
    const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: fixture.fetchImpl });
    boundary.activate({ subjectKey: "no-token", tenantKey: "site-a", sessionKey: "synthetic",
      getAccessToken: () => null });
    const client = boundary.getSnapshot().client;
    await rejected(requestAssetDetail(client, "AST-001", abort()), "code", "INVALID_REQUEST", "no token no access");
    same(fixture.requests().length, 0, "no token sent no network requests");
    boundary.dispose();
  }
  {
    // A late mocked response that ignores AbortSignal cannot revive revoked data.
    let deliver = null;
    const fixture = createControlledAssetApi();
    const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: (input, init) => {
      if (String(input).endsWith("/AST-001")) return new Promise(resolve => { deliver = resolve; });
      return fixture.fetchImpl(input, init);
    } });
    boundary.activate({ subjectKey: "synthetic", tenantKey: "site-a", sessionKey: "late-test",
      getAccessToken: () => "fixture-site-a" });
    const client = boundary.getSnapshot().client;
    const pending = requestAssetDetail(client, "AST-001", abort());
    for (let i = 0; i < 15 && deliver === null; i++) await Promise.resolve();
    check(deliver !== null, "in-flight authenticated fetch started");
    boundary.transition("revoked");
    deliver(new Response(JSON.stringify({ asset: { id: "AST-001" } }),
      { headers: { "content-type": "application/json" } }));
    await rejected(pending, "code", "ABORTED", "late HTTP cannot restore revoked content");
    boundary.dispose();
  }
  console.log(`PASS — ${passed}/${passed} Stage 45.7 isolated transport/contract assertions`);
})().catch(error => { console.error("FAIL —", error); process.exitCode = 1; });
