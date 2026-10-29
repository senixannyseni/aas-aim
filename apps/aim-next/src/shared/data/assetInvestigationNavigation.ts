/** Phase 45.8 — opt-in read-only navigation, not a canonical engineering screen.
 * Never contains an asset ID, tenant, token, revision, or evidence reference.
 * A URL is not an authorization grant: detail/evidence access is rechecked by API.
 */
export const ASSET_INVESTIGATION_HASH = "#/investigate/assets" as const;

/** A boundary and a non-empty trusted scope must already have been supplied. */
export function canOpenAssetInvestigationRoute(
  hash: string,
  authorizedNavigationConfigured: boolean,
): boolean {
  return authorizedNavigationConfigured && hash === ASSET_INVESTIGATION_HASH;
}
