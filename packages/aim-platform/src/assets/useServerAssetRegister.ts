import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiClient, QueryScalar } from "@bandha/aim-platform/api/apiClient";
import type { EvidenceFilter, RiskFilter } from "@bandha/aim-platform/assets/AssetRegister";
import { decodeAssetRegisterPage } from "@bandha/aim-platform/assets/assetRegisterAdapter";
import type {
  ServerAssetRegisterProps,
  ServerAssetRegisterQuery,
  ServerAssetRegisterState,
} from "@bandha/aim-platform/assets/ServerAssetRegister";

/**
 * File 44 — Request controller for File 42's server-paginated Asset Register.
 *
 * `client` is an injected, authenticated-transport-ready ApiClient, configured
 * with the PUBLIC base path `/api` as in .env.example. Its request to the
 * literal path segments `v1/assets` matches the DRAFT OpenAPI endpoint
 * `/api/v1/assets`. A backend endpoint, authentication integration, and
 * tenant authorization are NOT implemented by this hook.
 *
 * Only the backend may authorize assets, count matches, and assign reported
 * classifications; no UI response indicates equipment safety or approval.
 */
export type UseServerAssetRegisterOptions = Readonly<{
  /** null explicitly disables requests (e.g. until backend/auth is ready). */
  client: ApiClient | null;
  /** Captured on first mount; later navigation uses onQueryChange. */
  initialQuery?: ServerAssetRegisterQuery;
}>;

export type ServerAssetRegisterController = ServerAssetRegisterProps & Readonly<{
  /** Retry the current query without changing filters or pagination. */
  retry: () => void;
}>;

export const DEFAULT_SERVER_ASSET_QUERY: ServerAssetRegisterQuery = Object.freeze({
  page: 1,
  pageSize: 10,
  search: "",
  risk: "ALL",
  evidence: "ALL",
});

const RISK_FILTERS: ReadonlySet<string> = new Set([
  "ALL", "LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN", "NOT_PROVIDED",
]);
const EVIDENCE_FILTERS: ReadonlySet<string> = new Set([
  "ALL", "VALID", "STALE", "INVALID", "UNAVAILABLE", "MISSING", "UNKNOWN", "NOT_PROVIDED",
]);
const PAGE_SIZES: ReadonlySet<number> = new Set([10, 25, 50]);
const MAX_PAGE = 2_147_483_647; // OpenAPI int32 page bound.
const MAX_SEARCH_LENGTH = 200;

/** Reject invalid programmatic query changes before any network activity. */
export function validateServerAssetQuery(value: ServerAssetRegisterQuery): ServerAssetRegisterQuery {
  if (
    value === null || typeof value !== "object" || Array.isArray(value) ||
    !Number.isSafeInteger(value.page) || value.page < 1 || value.page > MAX_PAGE ||
    !PAGE_SIZES.has(value.pageSize) ||
    typeof value.search !== "string" ||
    value.search.trim().length > MAX_SEARCH_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(value.search) ||
    !RISK_FILTERS.has(value.risk) || !EVIDENCE_FILTERS.has(value.evidence)
  ) {
    throw new Error("Invalid server asset register query.");
  }
  // Keep the wire request and current-query identity canonical.
  return Object.freeze({
    page: value.page,
    pageSize: value.pageSize,
    search: value.search.trim(),
    risk: value.risk as RiskFilter,
    evidence: value.evidence as EvidenceFilter,
  });
}

function sameQuery(a: ServerAssetRegisterQuery, b: ServerAssetRegisterQuery): boolean {
  return a.page === b.page && a.pageSize === b.pageSize &&
    a.search === b.search && a.risk === b.risk && a.evidence === b.evidence;
}

/** Serialize only the parameters specified in the draft OpenAPI contract. */
export function toAssetQueryParameters(
  query: ServerAssetRegisterQuery,
): Readonly<Record<string, QueryScalar>> {
  const valid = validateServerAssetQuery(query);
  return {
    page: valid.page,
    pageSize: valid.pageSize,
    ...(valid.search ? { search: valid.search } : {}),
    ...(valid.risk !== "ALL" ? { risk: valid.risk } : {}),
    ...(valid.evidence !== "ALL" ? { evidence: valid.evidence } : {}),
  };
}

const DISCONNECTED_DETAIL = "No authenticated Asset Register API connection has been configured.";
const idle = (): ServerAssetRegisterState => ({ kind: "idle", detail: DISCONNECTED_DETAIL });

type OwnedState = Readonly<{
  /** Prevents displaying data obtained under a previous client/session. */
  client: ApiClient | null;
  state: ServerAssetRegisterState;
}>;

/**
 * Returns exactly the props accepted by <ServerAssetRegister />, plus retry().
 *
 * - Every query/retry starts a new request epoch and aborts the previous one.
 * - Request completions are ignored after query changes, retries, unmounts,
 *   client changes or React StrictMode effect cleanup.
 * - JSON passes through the runtime adapter BEFORE reaching the view.
 * - The returned page/pageSize must equal the requested page/pageSize.
 * - Failures never masquerade as an authorized empty asset register.
 *
 * Never pass a page from this hook to the old client-side AssetRegister.
 */
export function useServerAssetRegister({
  client,
  initialQuery = DEFAULT_SERVER_ASSET_QUERY,
}: UseServerAssetRegisterOptions): ServerAssetRegisterController {
  const [query, setQuery] = useState<ServerAssetRegisterQuery>(
    () => validateServerAssetQuery(initialQuery),
  );
  const [snapshot, setSnapshot] = useState<OwnedState>(
    () => ({ client, state: client === null ? idle() : { kind: "loading" } }),
  );
  const [retryRevision, setRetryRevision] = useState(0);
  const epoch = useRef(0);
  const currentAbort = useRef<AbortController | null>(null);

  const retry = useCallback((): void => {
    if (client === null) return;
    epoch.current += 1;
    currentAbort.current?.abort();
    setSnapshot({ client, state: { kind: "loading" } });
    setRetryRevision((revision) => revision + 1);
  }, [client]);

  const onQueryChange = useCallback((next: ServerAssetRegisterQuery): void => {
    const validated = validateServerAssetQuery(next);
    if (sameQuery(validated, query)) return;
    // Invalidate synchronously, including for an A -> B -> A race before
    // React has committed a new effect or delivered a microtask completion.
    epoch.current += 1;
    currentAbort.current?.abort();
    setSnapshot({ client, state: client === null ? idle() : { kind: "loading" } });
    setQuery(validated);
  }, [query, client]);

  useEffect(() => {
    const requestEpoch = ++epoch.current;
    if (client === null) {
      currentAbort.current = null;
      setSnapshot({ client, state: idle() });
      return;
    }

    const abort = new AbortController();
    currentAbort.current = abort;
    setSnapshot({ client, state: { kind: "loading" } });
    let live = true;

    void client.request({
      method: "GET",
      pathSegments: ["v1", "assets"],
      query: toAssetQueryParameters(query),
      signal: abort.signal,
      decode: decodeAssetRegisterPage,
    }).then((page) => {
      if (!live || abort.signal.aborted || epoch.current !== requestEpoch) return;
      // The adapter verifies internal pagination arithmetic; this check
      // additionally rejects valid-but-unrelated pages from the server.
      if (page.pageInfo.page !== query.page || page.pageInfo.pageSize !== query.pageSize) {
        setSnapshot({ client, state: { kind: "error", forQuery: query, onRetry: retry } });
        return;
      }
      setSnapshot({ client, state: { kind: "ready", page, forQuery: query } });
    }).catch(() => {
      if (!live || abort.signal.aborted || epoch.current !== requestEpoch) return;
      // Do not echo exception text: it may contain data supplied by the server.
      setSnapshot({ client, state: { kind: "error", forQuery: query, onRetry: retry } });
    }).finally(() => {
      if (currentAbort.current === abort) currentAbort.current = null;
    });

    return () => {
      live = false;
      epoch.current += 1;
      abort.abort();
      if (currentAbort.current === abort) currentAbort.current = null;
    };
  }, [client, query, retryRevision, retry]);

  // Even before an effect runs, never present data from an obsolete query.
  const visibleState: ServerAssetRegisterState = client === null ? idle() :
    snapshot.client !== client ? { kind: "loading" } :
    snapshot.state.kind === "ready" && !sameQuery(query, snapshot.state.forQuery) ? { kind: "loading" } :
    snapshot.state.kind === "error" && !sameQuery(query, snapshot.state.forQuery) ? { kind: "loading" } :
    snapshot.state;

  return { query, state: visibleState, onQueryChange, retry };
}
