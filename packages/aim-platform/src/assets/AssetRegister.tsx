import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";

import { Button } from "@bandha/aim-platform/ui/Button";
import { Card } from "@bandha/aim-platform/ui/Card";
import {
  StatusBadge,
  type EvidenceStatus,
  type RiskStatus,
} from "@bandha/aim-platform/ui/StatusBadge";
import type { AssetOverviewRecord } from "@bandha/aim-platform/assets/AssetOverview";

/**
 * Read-only Asset Register presentation. This is NOT a Java domain entity,
 * an OpenAPI response schema, or an authorization boundary.
 *
 * A versioned API adapter must validate identities, tenant scope, status
 * provenance, and field values before supplying records to this component.
 * Do not pass raw JSON or assume UNKNOWN = missing / LOW / safe.
 */
export type AssetRegisterRecord = AssetOverviewRecord;

export type AssetRegisterState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "empty"; detail?: string }>
  | Readonly<{ kind: "error"; onRetry?: () => void }>
  | Readonly<{ kind: "ready"; assets: readonly AssetRegisterRecord[] }>;

export type AssetRegisterProps = Readonly<{
  state: AssetRegisterState;
}>;

export type RiskFilter = RiskStatus | "ALL" | "NOT_PROVIDED";
export type EvidenceFilter = EvidenceStatus | "ALL" | "NOT_PROVIDED";
export type AssetRegisterPageSize = 10 | 25 | 50;

export type AssetRegisterFilters = Readonly<{
  search: string;
  risk: RiskFilter;
  evidence: EvidenceFilter;
}>;

const NO_ASSETS: readonly AssetRegisterRecord[] = Object.freeze([]);
const PAGE_SIZES: readonly AssetRegisterPageSize[] = [10, 25, 50];
const RISK_OPTIONS: readonly RiskFilter[] = [
  "ALL", "LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN", "NOT_PROVIDED",
];
const EVIDENCE_OPTIONS: readonly EvidenceFilter[] = [
  "ALL", "VALID", "STALE", "INVALID", "UNAVAILABLE", "MISSING", "UNKNOWN", "NOT_PROVIDED",
];

function displayField(value: string | null | undefined): string {
  return value?.trim() || "Not provided";
}

function matchesStatus<T extends string>(
  actual: T | null | undefined,
  selected: T | "ALL" | "NOT_PROVIDED",
): boolean {
  if (selected === "ALL") return true;
  if (selected === "NOT_PROVIDED") return actual == null;
  return actual === selected;
}

/** Pure, deterministic client-side filtering; never makes engineering decisions. */
export function filterAssetRegisterRecords(
  assets: readonly AssetRegisterRecord[],
  filters: AssetRegisterFilters,
): readonly AssetRegisterRecord[] {
  const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return assets.filter((asset) => {
    if (!matchesStatus(asset.riskStatus, filters.risk)) return false;
    if (!matchesStatus(asset.evidenceStatus, filters.evidence)) return false;

    const searchable = [
      asset.id,
      asset.tag,
      asset.name,
      asset.assetType ?? "",
      asset.location ?? "",
    ].join(" ").toLowerCase();

    return terms.every((term) => searchable.includes(term));
  });
}

/**
 * Pagination operates only on records already supplied to the browser.
 * Server pagination/filtering becomes necessary for larger collections and
 * must retain tenant authorization and ordering guarantees on the server.
 */
export function paginateAssetRegisterRecords(
  assets: readonly AssetRegisterRecord[],
  requestedPage: number,
  pageSize: AssetRegisterPageSize,
): Readonly<{
  items: readonly AssetRegisterRecord[];
  page: number;
  pageCount: number;
  first: number;
  last: number;
}> {
  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    throw new RangeError("requestedPage must be a positive integer.");
  }
  if (!PAGE_SIZES.includes(pageSize)) {
    throw new RangeError("Unsupported asset register page size.");
  }
  const pageCount = Math.max(1, Math.ceil(assets.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * pageSize;
  const items = assets.slice(start, start + pageSize);

  return {
    items,
    page,
    pageCount,
    first: assets.length === 0 ? 0 : start + 1,
    last: start + items.length,
  };
}

function formatOption(option: string): string {
  if (option === "ALL") return "All";
  if (option === "NOT_PROVIDED") return "Not provided";
  return option.charAt(0) + option.slice(1).toLowerCase();
}

function readRiskFilter(value: string): RiskFilter {
  const match = RISK_OPTIONS.find((option) => option === value);
  if (match === undefined) throw new Error("Unsupported risk filter.");
  return match;
}

function readEvidenceFilter(value: string): EvidenceFilter {
  const match = EVIDENCE_OPTIONS.find((option) => option === value);
  if (match === undefined) throw new Error("Unsupported evidence filter.");
  return match;
}

function readPageSize(value: string): AssetRegisterPageSize {
  const parsed = Number(value);
  const match = PAGE_SIZES.find((size) => size === parsed);
  if (match === undefined) throw new Error("Unsupported page size.");
  return match;
}

/**
 * Table view of previously validated records. Search/filter/page are local
 * presentation controls. Data refresh, selection, audit and authorization
 * remain the responsibility of the later authoritative API integration.
 */
export function AssetRegister({ state }: AssetRegisterProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<RiskFilter>("ALL");
  const [evidence, setEvidence] = useState<EvidenceFilter>("ALL");
  const [pageSize, setPageSize] = useState<AssetRegisterPageSize>(10);
  const [requestedPage, setRequestedPage] = useState(1);

  const assets = state.kind === "ready" ? state.assets : NO_ASSETS;
  const filteredAssets = useMemo(
    () => filterAssetRegisterRecords(assets, { search, risk, evidence }),
    [assets, search, risk, evidence],
  );
  const pagination = paginateAssetRegisterRecords(filteredAssets, requestedPage, pageSize);

  // React state can survive updates where a shorter result set is supplied.
  // Avoid leaving the internal page beyond the new result set.
  useEffect(() => {
    setRequestedPage((previous) => Math.min(previous, pagination.pageCount));
  }, [pagination.pageCount]);

  function changeSearch(value: string): void {
    setSearch(value);
    setRequestedPage(1);
  }

  function changeRisk(value: string): void {
    setRisk(readRiskFilter(value));
    setRequestedPage(1);
  }

  function changeEvidence(value: string): void {
    setEvidence(readEvidenceFilter(value));
    setRequestedPage(1);
  }

  function changePageSize(value: string): void {
    setPageSize(readPageSize(value));
    setRequestedPage(1);
  }

  let content: JSX.Element;
  switch (state.kind) {
    case "loading":
      content = <p role="status">Loading asset register…</p>;
      break;
    case "empty":
      content = (
        <div className="aim-asset-register__message">
          <p>No assets available.</p>
          {state.detail && <p>{state.detail}</p>}
        </div>
      );
      break;
    case "error":
      content = (
        <div className="aim-asset-register__message" role="alert">
          <p>Asset register could not be loaded. No asset records are shown.</p>
          {state.onRetry && (
            <Button variant="secondary" onClick={state.onRetry}>Retry loading</Button>
          )}
        </div>
      );
      break;
    case "ready":
      content = assets.length === 0 ? (
        <p>No assets available.</p>
      ) : (
        <div className="aim-asset-register">
          <div className="aim-asset-register__filters" role="group" aria-label="Filter asset register">
            <div className="aim-asset-register__control aim-asset-register__control--search">
              <label htmlFor="asset-register-search">Search assets</label>
              <input
                id="asset-register-search"
                type="search"
                value={search}
                onChange={(event) => changeSearch(event.currentTarget.value)}
                placeholder="Name, tag, ID, type, location"
              />
            </div>
            <div className="aim-asset-register__control">
              <label htmlFor="asset-register-risk">Risk classification</label>
              <select
                id="asset-register-risk"
                value={risk}
                onChange={(event) => changeRisk(event.currentTarget.value)}
              >
                {RISK_OPTIONS.map((value) => (
                  <option key={value} value={value}>{formatOption(value)}</option>
                ))}
              </select>
            </div>
            <div className="aim-asset-register__control">
              <label htmlFor="asset-register-evidence">Evidence status</label>
              <select
                id="asset-register-evidence"
                value={evidence}
                onChange={(event) => changeEvidence(event.currentTarget.value)}
              >
                {EVIDENCE_OPTIONS.map((value) => (
                  <option key={value} value={value}>{formatOption(value)}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <p className="aim-asset-register__message" role="status">
              No assets match the current search and filters.
            </p>
          ) : (
            <>
              <div className="aim-asset-register__table-wrap" tabIndex={0} role="region" aria-label="Scrollable asset register table">
                <table className="aim-asset-register__table">
                  <caption className="aim-sr-only">
                    Asset records supplied to this browser session; statuses are reported, not verified safety decisions.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Asset tag</th>
                      <th scope="col">Name</th>
                      <th scope="col">Asset ID</th>
                      <th scope="col">Type</th>
                      <th scope="col">Location</th>
                      <th scope="col">Risk</th>
                      <th scope="col">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.items.map((asset) => (
                      <tr key={asset.id}>
                        <th scope="row">{displayField(asset.tag)}</th>
                        <td>{displayField(asset.name)}</td>
                        <td>{displayField(asset.id)}</td>
                        <td>{displayField(asset.assetType)}</td>
                        <td>{displayField(asset.location)}</td>
                        <td>{asset.riskStatus == null ? "Not provided" : (
                          <StatusBadge category="risk" status={asset.riskStatus} />
                        )}</td>
                        <td>{asset.evidenceStatus == null ? "Not provided" : (
                          <StatusBadge category="evidence" status={asset.evidenceStatus} />
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="aim-asset-register__pagination">
                <p className="aim-asset-register__count" role="status">
                  Showing {pagination.first}–{pagination.last} of {filteredAssets.length} matching assets
                  {filteredAssets.length !== assets.length ? ` (${assets.length} total)` : ""}.
                </p>
                <div className="aim-asset-register__pager">
                  <label htmlFor="asset-register-page-size">Rows per page</label>
                  <select
                    id="asset-register-page-size"
                    value={pageSize}
                    onChange={(event) => changePageSize(event.currentTarget.value)}
                  >
                    {PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                  <Button
                    variant="secondary"
                    onClick={() => setRequestedPage((previous) => Math.max(1, previous - 1))}
                    disabled={pagination.page === 1}
                    aria-label="Previous page"
                  >Previous</Button>
                  <span aria-label={`Page ${pagination.page} of ${pagination.pageCount}`}>
                    {pagination.page} / {pagination.pageCount}
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => setRequestedPage((previous) => Math.min(pagination.pageCount, previous + 1))}
                    disabled={pagination.page >= pagination.pageCount}
                    aria-label="Next page"
                  >Next</Button>
                </div>
              </div>
            </>
          )}
          <p className="aim-asset-register__disclaimer">
            Risk and evidence are distinct reported classifications, not equipment safety or approval decisions.
            Search and pagination cover only records already provided to this browser view.
          </p>
        </div>
      );
      break;
    default: {
      const exhaustive: never = state;
      throw new Error(`Unsupported asset register state: ${String(exhaustive)}`);
    }
  }

  return (
    <Card
      id="asset-register"
      title="Asset register"
      description="Browse supplied asset records and reported classifications"
      aria-busy={state.kind === "loading"}
    >
      {content}
    </Card>
  );
}
