import { describe, expect, it } from "vitest";
import { ASSET_INVESTIGATION_HASH, canOpenAssetInvestigationRoute } from "./assetInvestigationNavigation";
import { SCREEN_BY_ID } from "../../screenRegistry";
import { readScreenRoute } from "../../screenRouting";

describe("Phase 45.8 opt-in Asset API route", () => {
  it("opens only the exact route when trusted navigation is configured", () => {
    expect(canOpenAssetInvestigationRoute(ASSET_INVESTIGATION_HASH, true)).toBe(true);
    for (const bad of ["", "#/investigate/assets/AST-001", "#/investigate/assets?token=test", "#/screens/SCR-AIR-001", "#/investigate/assets/"]) {
      expect(canOpenAssetInvestigationRoute(bad, true)).toBe(false);
    }
  });
  it("rejects deep linking when trusted navigation is absent", () => {
    expect(canOpenAssetInvestigationRoute(ASSET_INVESTIGATION_HASH, false)).toBe(false);
  });
  it("does not add or replace a canonical screen identity", () => {
    expect(SCREEN_BY_ID.size).toBe(78);
    expect(readScreenRoute(ASSET_INVESTIGATION_HASH)).toBeNull();
  });
});
