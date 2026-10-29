#!/usr/bin/env node
/** Stage 46.1 contract gate; module resolution updated by Stage 46.2. */
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const {root} = require("./phase46-2-source-loader.cjs");
const assetDetail = require(path.join(root,"apps/aim-next/src/shared/data/assetDetailReadModel.ts"));
const assetEvidence = require(path.join(root,"apps/aim-next/src/shared/data/assetEvidenceReadModel.ts"));
const { createAuthSessionBoundary } = require(path.join(root,"apps/web/src/shared/auth/authSession.ts"));
const { createControlledAssetApi } = require(path.join(root,"apps/aim-next/src/shared/data/fixtures/controlledAssetApi.ts"));

let count = 0;
const check = (predicate, label) => { assert.ok(predicate, label); count++; };
const eq = (value, expected, label) => { assert.deepEqual(value, expected, label); count++; };
const rejects = (fn, label) => { assert.throws(fn, label); count++; };
async function rejectsCode(promise, code, label) {
  await assert.rejects(promise, error => error?.code === code, label); count++;
}
const base = {
  asset: { id: "AST-001", tag: "V-101", name: "Synthetic vessel" },
  revision: { id: "rev_8", label: "8", state: "DRAFT",
    changedAt: "2026-10-28T10:00:00Z", sourceReference: "synthetic-source" },
  governingRevisionId: "rev_7",
};
const signal = () => new AbortController().signal;
(async () => {
  const good = assetDetail.decodeAssetDetailResponse(base, "AST-001");
  eq(good.revision.id, "rev_8", "valid displayed revision");
  eq(good.governingRevisionId, "rev_7", "distinct governing revision");
  assetEvidence.validateEvidenceRequest({ assetId: good.asset.id,
    viewRevisionId: good.revision.id, group: "DISPLAYED_REVISION" });
  count++;
  for (const invalid of ["rev/8", "rev.8", "rev 8", "../revision", "rev:8"]) {
    rejects(() => assetDetail.decodeAssetDetailResponse({ ...base,
      revision: { ...base.revision, id: invalid } }, "AST-001"),
      `detail must reject evidence-incompatible revision ${invalid}`);
    rejects(() => assetDetail.decodeAssetDetailResponse({ ...base,
      governingRevisionId: invalid }, "AST-001"),
      `detail must reject unsafe governing revision ${invalid}`);
    rejects(() => assetEvidence.validateEvidenceRequest({
      assetId: "AST-001", viewRevisionId: invalid, group: "DISPLAYED_REVISION",
    }), `evidence request rejects revision ${invalid}`);
  }
  for (const valid of ["rev-9", "rev_9", "R1", "rev9"]) {
    const result = assetDetail.decodeAssetDetailResponse({ ...base,
      revision: { ...base.revision, id: valid } }, "AST-001");
    assetEvidence.validateEvidenceRequest({ assetId: result.asset.id,
      viewRevisionId: result.revision.id, group: "DISPLAYED_REVISION" });
    count++;
  }
  rejects(() => assetDetail.decodeAssetDetailResponse({ ...base,
    revision: { ...base.revision, id: "rev_8" }, governingRevisionId: "rev_8",
  }, "AST-001"), "nonreleased revision cannot claim governing state");

  const fixture = createControlledAssetApi();
  const boundary = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: fixture.fetchImpl });
  try {
    boundary.activate({ subjectKey: "test", tenantKey: "site-a", sessionKey: "s1",
      getAccessToken: () => "fixture-site-a" });
    const client = boundary.getSnapshot().client;
    check(client !== null, "authenticated client provided");
    fixture.setNextFault("detail", "invalid_detail_revision_identity");
    await rejectsCode(assetDetail.requestAssetDetail(client, "AST-001", signal()),
      "INVALID_RESPONSE", "transport rejects evidence-incompatible revision");
    const detail = await assetDetail.requestAssetDetail(client, "AST-001", signal());
    eq(detail.revision.id, "rev_8", "subsequent valid detail available");
    const evidence = await assetEvidence.requestAssetEvidencePage(client, {
      assetId: detail.asset.id, viewRevisionId: detail.revision.id,
      group: "DISPLAYED_REVISION",
    }, signal());
    eq(evidence.viewRevisionId, detail.revision.id,
      "valid detail revision interoperates with evidence API");
    check(fixture.requests().filter(r => r.route === "detail").length === 2,
      "one rejected detail and one valid detail were requested");
    boundary.transition("revoked");
    await rejectsCode(assetDetail.requestAssetDetail(client, "AST-001", signal()),
      "ABORTED", "revoked client cannot request details");
  } finally {
    boundary.dispose();
  }
  console.log(`PASS — ${count}/${count} Stage 46.1 revision/API contract assertions (synthetic transport)`);
})().catch(error => { console.error("FAIL — Stage 46.1 contract gate", error); process.exitCode=1; });
