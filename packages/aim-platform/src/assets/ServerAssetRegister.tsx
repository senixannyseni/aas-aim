import { useEffect, useId, useState } from "react";
import type { FormEvent, JSX } from "react";

import { Button } from "@bandha/aim-platform/ui/Button";
import { Card } from "@bandha/aim-platform/ui/Card";
import { StatusBadge } from "@bandha/aim-platform/ui/StatusBadge";
import type { AssetRegisterPageSize, EvidenceFilter, RiskFilter } from "@bandha/aim-platform/assets/AssetRegister";
import type { AdaptedAssetItem, AdaptedAssetPage } from "@bandha/aim-platform/assets/assetRegisterAdapter";

/**
 * File 42 — Controlled, server-paginated Asset Register VIEW.
 *
 * `query` is the requested server query. Parent code owns fetching, validation,
 * request cancellation, authentication and authorization. The adapter in File
 * 40 must validate unknown JSON before a page is supplied as `state.page`.
 *
 * Do not pass one server page into the original AssetRegister: it filters and
 * paginates the records already in browser memory and would misreport totals.
 *
 * This view never infers equipment safety, approval, or evidence validity.
 */
export type ServerAssetRegisterQuery = Readonly<{
  page: number;
  pageSize: AssetRegisterPageSize;
  search: string;
  risk: RiskFilter;
  evidence: EvidenceFilter;
}>;

export type ServerAssetRegisterState =
  | Readonly<{ kind: "idle"; detail?: string }>
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "error"; forQuery: ServerAssetRegisterQuery; onRetry?: () => void }>
  | Readonly<{
      kind: "ready";
      /** The validated page returned by the authoritative API adapter. */
      page: AdaptedAssetPage;
      /** Request parameters used to obtain the response, not inferred from it. */
      forQuery: ServerAssetRegisterQuery;
    }>;

export type ServerAssetRegisterProps = Readonly<{
  query: ServerAssetRegisterQuery;
  state: ServerAssetRegisterState;
  /** Requests a new server query; does not locally filter or mutate records. */
  onQueryChange: (next: ServerAssetRegisterQuery) => void;
}>;

const PAGE_SIZES: readonly AssetRegisterPageSize[] = [10, 25, 50];
const RISK_OPTIONS: readonly RiskFilter[] = [
  "ALL", "LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN", "NOT_PROVIDED",
];
const EVIDENCE_OPTIONS: readonly EvidenceFilter[] = [
  "ALL", "VALID", "STALE", "INVALID", "UNAVAILABLE", "MISSING", "UNKNOWN", "NOT_PROVIDED",
];

function labelFor(option: string): string {
  if (option === "ALL") return "All";
  if (option === "NOT_PROVIDED") return "Not provided";
  return option[0]?.toUpperCase() + option.slice(1).toLowerCase();
}

function selectAllowed<T extends string>(value: string, allowed: readonly T[]): T {
  const selected = allowed.find((entry) => entry === value);
  if (selected === undefined) throw new Error("Unsupported asset register filter.");
  return selected;
}

function readPageSize(value: string): AssetRegisterPageSize {
  const parsed = Number(value);
  const match = PAGE_SIZES.find((size) => size === parsed);
  if (match === undefined) throw new Error("Unsupported asset register page size.");
  return match;
}

function sameQuery(a: ServerAssetRegisterQuery, b: ServerAssetRegisterQuery): boolean {
  return a.page === b.page && a.pageSize === b.pageSize &&
    a.search === b.search && a.risk === b.risk && a.evidence === b.evidence;
}

/**
 * A page must match the FULL requested query before any result is displayed.
 * In-flight responses for previous filters/pages must not flash as current.
 *
 * The parent must additionally guard against an older response for an identical
 * query (e.g. A -> B -> A); comparison alone cannot replace request epochs.
 */
export function matchesRequestedAssetPage(
  query: ServerAssetRegisterQuery,
  state: ServerAssetRegisterState,
): state is Extract<ServerAssetRegisterState, { kind: "ready" }> {
  return state.kind === "ready" && sameQuery(query, state.forQuery) &&
    state.page.pageInfo.page === query.page &&
    state.page.pageInfo.pageSize === query.pageSize;
}

function displayField(value: string | null | undefined): string {
  return value?.trim() || "Not provided";
}

function riskCell(item: AdaptedAssetItem): JSX.Element {
  if (item.record.riskStatus == null) return <span>Not provided</span>;
  return (
    <div>
      <StatusBadge category="risk" status={item.record.riskStatus} />
      {item.riskBasis != null && (
        <small className="aim-asset-register__disclaimer">
          Basis: {item.riskBasis.basisRecordId}; assessed {item.riskBasis.assessedAt}
        </small>
      )}
    </div>
  );
}

function evidenceCell(item: AdaptedAssetItem): JSX.Element {
  if (item.record.evidenceStatus == null) return <span>Not provided</span>;
  return (
    <div>
      <StatusBadge category="evidence" status={item.record.evidenceStatus} />
      {item.evidenceBasis != null && (
        <small className="aim-asset-register__disclaimer">
          Basis: {item.evidenceBasis.basisRecordId}; evaluated {item.evidenceBasis.evaluatedAt}
        </small>
      )}
    </div>
  );
}

/**
 * Renders only the server-provided page. Search and filters request fresh
 * data from the parent; the UI never computes totals from `items.length`.
 */
export function ServerAssetRegister({
  query,
  state,
  onQueryChange,
}: ServerAssetRegisterProps): JSX.Element {
  const instanceId = useId();
  const [searchDraft, setSearchDraft] = useState(query.search);

  // Keep the draft aligned if another navigation surface changes the query.
  useEffect(() => {
    setSearchDraft(query.search);
  }, [query.search]);

  const hasCurrentPage = matchesRequestedAssetPage(query, state);
  const staleError = state.kind === "error" && !sameQuery(state.forQuery, query);
  const isWaiting = state.kind === "loading" || staleError ||
    (state.kind === "ready" && !hasCurrentPage);

  const idFor = (suffix: string): string => `${instanceId}-${suffix}`;
  const requestQuery = (changes: Partial<ServerAssetRegisterQuery>): void => {
    onQueryChange({ ...query, ...changes });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalized = searchDraft.trim();
    if (normalized !== query.search || query.page !== 1) {
      requestQuery({ search: normalized, page: 1 });
    }
  };

  let content: JSX.Element;
  if (state.kind === "idle") {
    content = (
      <div className="aim-asset-register__message">
        <p>Asset Register API is not connected.</p>
        {state.detail && <p>{state.detail}</p>}
      </div>
    );
  } else if (isWaiting) {
    content = <p role="status">Loading the requested asset page…</p>;
  } else if (state.kind === "error") {
    content = (
      <div role="alert" className="aim-asset-register__message">
        <p>Asset register could not be loaded. No asset records are shown.</p>
        {state.onRetry && (
          <Button variant="secondary" onClick={state.onRetry}>Retry loading</Button>
        )}
      </div>
    );
  } else if (state.kind === "ready" && hasCurrentPage) {
    const { items, pageInfo } = state.page;
    const hasFilters = query.search.trim().length > 0 ||
      query.risk !== "ALL" || query.evidence !== "ALL";
    const first = items.length === 0 ? 0 : (pageInfo.page - 1) * pageInfo.pageSize + 1;
    const last = items.length === 0 ? 0 : first + items.length - 1;

    content = (
      <>
        {items.length === 0 ? (
          <p className="aim-asset-register__message" role="status">
            {hasFilters ? "No assets match the current server-side query." :
              "No assets available in the authorized register."}
          </p>
        ) : (
          <div className="aim-asset-register__table-wrap" tabIndex={0} role="region"
            aria-label="Scrollable server asset register table">
            <table className="aim-asset-register__table">
              <caption className="aim-sr-only">
                Server-provided asset page; classifications are reported values with
                supporting record references, not engineering safety decisions.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Asset tag</th>
                  <th scope="col">Name</th>
                  <th scope="col">Asset ID</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Risk / basis</th>
                  <th scope="col">Evidence / basis</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.record.id}>
                    <th scope="row">{displayField(item.record.tag)}</th>
                    <td>{displayField(item.record.name)}</td>
                    <td>{displayField(item.record.id)}</td>
                    <td>{displayField(item.record.assetType)}</td>
                    <td>{displayField(item.record.location)}</td>
                    <td>{riskCell(item)}</td>
                    <td>{evidenceCell(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="aim-asset-register__pagination">
          <p className="aim-asset-register__count" role="status">
            Showing {first}–{last} of {pageInfo.totalItems} matching authorized assets
          </p>
          <div className="aim-asset-register__pager">
            <label htmlFor={idFor("page-size")}>Rows per page</label>
            <select id={idFor("page-size")} value={query.pageSize}
              onChange={(event) => requestQuery({
                page: 1,
                pageSize: readPageSize(event.currentTarget.value),
              })}>
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <Button variant="secondary" disabled={pageInfo.page <= 1}
              aria-label="Previous server page"
              onClick={() => requestQuery({ page: query.page - 1 })}>Previous</Button>
            <span aria-label={`Page ${pageInfo.page} of ${pageInfo.totalPages}`}>
              {pageInfo.page} / {pageInfo.totalPages}
            </span>
            <Button variant="secondary" disabled={!pageInfo.hasNextPage}
              aria-label="Next server page"
              onClick={() => requestQuery({ page: query.page + 1 })}>Next</Button>
          </div>
        </div>
      </>
    );
  } else {
    // Defensive fallback for a mismatched externally supplied state.
    content = <p role="status">Waiting for the requested asset page…</p>;
  }

  return (
    <Card title="Server asset register" headingLevel={2}
      description="Authorized, server-filtered records with reported classification provenance"
      aria-busy={isWaiting}>
      <div className="aim-asset-register">
        {state.kind !== "idle" && (
          <form className="aim-asset-register__filters" role="search"
            aria-label="Search server asset register" onSubmit={submitSearch}>
            <div className="aim-asset-register__control aim-asset-register__control--search">
              <label htmlFor={idFor("search")}>Search assets</label>
              <input id={idFor("search")} type="search" maxLength={200}
                value={searchDraft} onChange={(event) => setSearchDraft(event.currentTarget.value)}
                placeholder="Name, tag, ID, type, location" />
            </div>
            <div className="aim-asset-register__control">
              <label htmlFor={idFor("risk")}>Risk classification</label>
              <select id={idFor("risk")} value={query.risk}
                onChange={(event) => requestQuery({
                  risk: selectAllowed(event.currentTarget.value, RISK_OPTIONS), page: 1,
                })}>
                {RISK_OPTIONS.map((option) => (
                  <option key={option} value={option}>{labelFor(option)}</option>
                ))}
              </select>
            </div>
            <div className="aim-asset-register__control">
              <label htmlFor={idFor("evidence")}>Evidence status</label>
              <select id={idFor("evidence")} value={query.evidence}
                onChange={(event) => requestQuery({
                  evidence: selectAllowed(event.currentTarget.value, EVIDENCE_OPTIONS), page: 1,
                })}>
                {EVIDENCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{labelFor(option)}</option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        )}
        {content}
        <p className="aim-asset-register__disclaimer">
          Search, filters, and pages are server-controlled. Reported risk and evidence
          are independent classifications, never an equipment-safety or approval decision.
        </p>
      </div>
    </Card>
  );
}
