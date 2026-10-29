// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createAuthSessionBoundary, type AuthSessionBoundary } from
  "@bandha/aim-platform/auth/authSession";
import { AuthorizedAssetEvidenceInspector } from "./AuthorizedAssetEvidenceInspector";
import type { AssetDetailReadModel } from "./assetDetailReadModel";

const boundaries = new Set<AuthSessionBoundary>();
afterEach(() => { cleanup(); for (const b of boundaries) b.dispose(); boundaries.clear(); });
const detail: AssetDetailReadModel = {
  asset: { id: "AST-001", tag: "V-101", name: "Synthetic vessel" },
  revision: { id: "rev_8", label: "8", state: "DRAFT",
    changedAt: "2026-10-28T12:00:00Z", sourceReference: "draft-source" },
  governingRevisionId: "rev_7",
};

describe("Stage 45.5 — evidence inspector", () => {
  it("identifies working and governing revisions without pretending a draft is governing", async () => {
    const b = createAuthSessionBoundary({ apiBasePath: "/api", fetchImpl: async input => {
      const group = new URL(String(input), "http://local.test").searchParams.get("group");
      const historical = group === "HISTORICAL";
      return new Response(JSON.stringify({
        assetId: "AST-001", viewRevisionId: "rev_8", group,
        snapshotKey: "synth_gen_1", nextCursor: null,
        items: [{ id: historical ? "historical-evidence" : "draft-evidence",
          revisionId: historical ? "rev_7" : "rev_8", kind: "DOCUMENT",
          association: "ASSOCIATED", availability: "AVAILABLE", quality: "UNKNOWN",
          sourceReference: "opaque-source", basisReference: null,
          recordedAt: "2026-10-28T12:00:00Z" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }});
    boundaries.add(b);
    act(() => b.activate({ subjectKey: "synthetic", tenantKey: "tenant-a",
      sessionKey: "session", getAccessToken: () => "test-token" }));
    render(<AuthorizedAssetEvidenceInspector boundary={b} detail={detail}
      sessionRevision={b.getSnapshot().revision} />);
    await waitFor(() => expect(screen.getByText(/draft-evidence/)).toBeTruthy());
    expect(screen.getByText(/Displayed revision: 8 \(DRAFT\)/)).toBeTruthy();
    expect(screen.getByText(/Governing revision ID reported: rev_7/)).toBeTruthy();
    act(() => { screen.getByLabelText("Historical predecessors").click(); });
    await waitFor(() => expect(screen.getByText(/historical-evidence/)).toBeTruthy());
    expect(screen.queryByText(/draft-evidence/)).toBeNull();
  });
});
