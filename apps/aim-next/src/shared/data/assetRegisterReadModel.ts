import type {
  AdaptedAssetPage, AdaptedAssetItem, RiskBasis, EvidenceBasis,
} from "@bandha/aim-platform/assets/assetRegisterAdapter";
import type { RiskStatus, EvidenceStatus } from
  "@bandha/aim-platform/ui/StatusBadge";

/** Stage 45.3 — a bounded LIST read model, never an Asset Detail or master-data entity.
 * Upstream MUST use decodeAssetRegisterPage() on unknown JSON first.
 * We do not infer asset kind, state, parent, revision or technical approval.
 */
export type ReportedClassification<S extends string, B> =
  | Readonly<{ kind: "not_provided" }>
  | Readonly<{ kind: "explicit_null" }>
  | Readonly<{ kind: "reported"; status: S; basis: B }>;

export type AssetRegisterReadItem = Readonly<{
  assetId: string;
  tag: string;
  name: string;
  assetType?: string | null;
  location?: string | null;
  reportedRisk: ReportedClassification<RiskStatus, RiskBasis>;
  reportedEvidence: ReportedClassification<EvidenceStatus, EvidenceBasis>;
}>;

export type AssetRegisterReadPage = Readonly<{
  items: readonly AssetRegisterReadItem[];
  pageInfo: AdaptedAssetPage["pageInfo"];
}>;

function projectRisk(item: AdaptedAssetItem): ReportedClassification<RiskStatus, RiskBasis> {
  if (item.riskBasis === null) return { kind: "explicit_null" };
  if (item.riskBasis === undefined) return { kind: "not_provided" };
  const status = item.record.riskStatus;
  if (status == null) throw new Error("Inconsistent validated risk projection.");
  return { kind: "reported", status, basis: item.riskBasis };
}

function projectEvidence(item: AdaptedAssetItem): ReportedClassification<EvidenceStatus, EvidenceBasis> {
  if (item.evidenceBasis === null) return { kind: "explicit_null" };
  if (item.evidenceBasis === undefined) return { kind: "not_provided" };
  const status = item.record.evidenceStatus;
  if (status == null) throw new Error("Inconsistent validated evidence projection.");
  return { kind: "reported", status, basis: item.evidenceBasis };
}

/** Only accepts output from the existing trusted JSON decoder; not raw API payloads. */
export function projectAssetRegisterPage(page: AdaptedAssetPage): AssetRegisterReadPage {
  return Object.freeze({
    pageInfo: page.pageInfo,
    items: Object.freeze(page.items.map(item => Object.freeze({
      assetId: item.record.id, tag: item.record.tag, name: item.record.name,
      ...(item.record.assetType !== undefined ? { assetType: item.record.assetType } : {}),
      ...(item.record.location !== undefined ? { location: item.record.location } : {}),
      reportedRisk: projectRisk(item),
      reportedEvidence: projectEvidence(item),
    }))),
  });
}

/** Local selection of an item present on the current validated page.
 * This is NOT a grant to view Asset Detail. A future detail endpoint must
 * independently authorize the asset and return a revision-aware result.
 */
export type AssetPageSelection = Readonly<{
  assetId: string;
  sessionRevision: number;
}>;

export function selectVisibleAsset(
  page: AssetRegisterReadPage,
  assetId: string,
  sessionRevision: number,
): AssetPageSelection | null {
  if (!Number.isSafeInteger(sessionRevision) || sessionRevision < 0) return null;
  if (!page.items.some(item => item.assetId === assetId)) return null;
  return Object.freeze({ assetId, sessionRevision });
}

/** A changed session invalidates existing selection, even for the same ID. */
export function selectionIsVisible(
  selection: AssetPageSelection | null,
  page: AssetRegisterReadPage,
  sessionRevision: number,
): boolean {
  return selection !== null &&
    selection.sessionRevision === sessionRevision &&
    page.items.some(item => item.assetId === selection.assetId);
}
