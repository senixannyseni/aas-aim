// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetDetailReadModel } from "./assetDetailReadModel";
import { AuthorizedAssetEvidenceInspector } from "./AuthorizedAssetEvidenceInspector";

afterEach(cleanup);
const detail: AssetDetailReadModel = {
  asset: { id: "AST-001", tag: "V-101", name: "Synthetic vessel" },
  revision: { id: "rev_9", label: "9", state: "DRAFT",
    changedAt: "2026-10-28T10:00:00Z", sourceReference: "synthetic" },
  governingRevisionId: "rev_8",
};

describe("Stage 45.6 — evidence inspector semantics and accessibility", () => {
  it("uses unique radio group identities for separate inspector instances", () => {
    const { container } = render(<>
      <AuthorizedAssetEvidenceInspector boundary={null} detail={detail} sessionRevision={0} />
      <AuthorizedAssetEvidenceInspector boundary={null} detail={detail} sessionRevision={0} />
    </>);
    const radios = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(4);
    expect(radios[0]?.name).toBe(radios[1]?.name);
    expect(radios[2]?.name).toBe(radios[3]?.name);
    expect(radios[0]?.name).not.toBe(radios[2]?.name);
  });
  it("does not display evidence without an authenticated backend", () => {
    const { container } = render(
      <AuthorizedAssetEvidenceInspector boundary={null} detail={detail} sessionRevision={0} />
    );
    expect(container.textContent).toContain("Evidence is not connected");
    expect(container.textContent).toContain("Governing revision ID reported: rev_8");
    expect(container.querySelector('a[href]')).toBeNull();
  });
});
