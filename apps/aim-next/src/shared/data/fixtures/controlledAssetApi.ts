/**
 * Stage 45.7 — CONTROLLED TEST FIXTURE, NEVER A PRODUCTION BACKEND.
 *
 * This in-memory fetch adapter emulates draft GET endpoints and server-side
 * subject-to-asset authorization for integration tests. Fixed, synthetic
 * tokens identify test scopes only; none are real authentication credentials.
 * The fixture does not authenticate real users, authorize real assets, or
 * evaluate engineering fitness, approval, or evidence-body permissions.
 */

export type ControlledFault =
  | "mismatched_detail_identity"
  | "invalid_detail_revision_identity"
  | "invalid_register_pagination"
  | "oversized_evidence_page"
  | "mismatched_evidence_generation"
  | "http_503";
export type ControlledRoute = "register" | "detail" | "evidence";

export type ControlledRequest = Readonly<{
  method: string;
  route: string;
  hasAuthorizationHeader: boolean;
  credentials: RequestCredentials | undefined;
  cache: RequestCache | undefined;
  redirect: RequestRedirect | undefined;
}>;

export type ControlledAssetApi = Readonly<{
  fetchImpl: typeof fetch;
  rotateEvidenceGeneration: () => void;
  denyDetail: (assetId: string, denied: boolean) => void;
  setNextFault: (route: ControlledRoute, fault: ControlledFault) => void;
  requests: () => readonly ControlledRequest[];
}>;

type FixtureAsset = Readonly<{
  id: string;
  tag: string;
  name: string;
  site: "site-a" | "site-b";
}>;

const ASSETS: readonly FixtureAsset[] = Object.freeze([
  { id: "AST-001", tag: "V-101", name: "Synthetic pressure vessel", site: "site-a" },
  { id: "AST-002", tag: "V-102", name: "Synthetic restricted vessel", site: "site-a" },
  { id: "AST-003", tag: "V-201", name: "Synthetic remote vessel", site: "site-b" },
]);

const FIXTURE_TIME = "2026-10-28T10:00:00Z";
const VIEW_REVISION = "rev_8";
const GOVERNING_REVISION = "rev_7";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function error(status: number): Response {
  // No records, identifiers, or authorization details are leaked in errors.
  return json({ error: "REQUEST_UNAVAILABLE" }, status);
}

function pageNumber(value: string | null, fallback: number): number | null {
  if (value === null) return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function evidenceItem(index: number, revisionId: string): Record<string, unknown> {
  return {
    id: `ev_${revisionId}_${index}`,
    revisionId,
    kind: "DOCUMENT",
    association: index === 1 ? "USED_AS_BASIS" : "ASSOCIATED",
    availability: index === 2 ? "UNAVAILABLE" : "AVAILABLE",
    quality: index === 2 ? "SUSPECT" : "UNKNOWN",
    sourceReference: index === 2 ? null : `synthetic-source-${index}`,
    basisReference: index === 1 ? "synthetic-controlled-basis" : null,
    recordedAt: FIXTURE_TIME,
  };
}

/**
 * `fixture-site-a` and `fixture-site-b` are fixed test-only tokens. Every
 * request is independently checked against its currently allowed scope.
 */
export function createControlledAssetApi(): ControlledAssetApi {
  let evidenceGeneration = 1;
  const detailDenied = new Set<string>(["AST-002"]);
  const faults = new Map<ControlledRoute, ControlledFault>();
  const records: ControlledRequest[] = [];

  const fetchImpl: typeof fetch = async (input, init): Promise<Response> => {
    const url = new URL(String(input), "https://synthetic.invalid");
    const path = url.pathname;
    const method = init?.method ?? "GET";
    const route: ControlledRoute | null = path === "/api/v1/assets"
      ? "register" : /^\/api\/v1\/assets\/[A-Za-z0-9_-]+$/.test(path)
        ? "detail" : /^\/api\/v1\/assets\/[A-Za-z0-9_-]+\/evidence$/.test(path)
          ? "evidence" : null;
    const headers = new Headers(init?.headers);
    const bearer = headers.get("authorization");
    records.push(Object.freeze({
      method, route: route ?? "unknown",
      hasAuthorizationHeader: bearer !== null,
      credentials: init?.credentials,
      cache: init?.cache,
      redirect: init?.redirect,
    }));

    // Do not simulate a working endpoint if the request violates the existing
    // transport's no-cookie/no-cache/redirect contract.
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (method !== "GET") return error(405);
    if (init?.credentials !== "omit" || init.cache !== "no-store" || init.redirect !== "error") {
      return error(400);
    }
    const site = bearer === "Bearer fixture-site-a" ? "site-a"
      : bearer === "Bearer fixture-site-b" ? "site-b" : null;
    if (site === null) return error(401);
    if (route === null) return error(404);

    const fault = faults.get(route);
    if (fault !== undefined) faults.delete(route);
    if (fault === "http_503") return error(503);

    if (route === "register") {
      const page = pageNumber(url.searchParams.get("page"), 1);
      const pageSize = pageNumber(url.searchParams.get("pageSize"), 10);
      const search = url.searchParams.get("search")?.toLowerCase().trim() ?? "";
      const risk = url.searchParams.get("risk");
      const evidence = url.searchParams.get("evidence");
      if (page === null || pageSize === null || ![10, 25, 50].includes(pageSize)) return error(400);
      let unknownParameter = false;
      url.searchParams.forEach((_value, key) => {
        if (!["page", "pageSize", "search", "risk", "evidence"].includes(key)) unknownParameter = true;
      });
      if (unknownParameter) return error(400);
      if (risk !== null && !["NOT_PROVIDED", "LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN"].includes(risk)) return error(400);
      if (evidence !== null && !["NOT_PROVIDED", "VALID", "STALE", "INVALID", "UNAVAILABLE", "MISSING", "UNKNOWN"].includes(evidence)) return error(400);
      // All synthetic fixture assets deliberately have NO risk/evidence
      // classification. Only NOT_PROVIDED matches them; do not treat
      // absent/null as LOW risk, VALID evidence, or explicit UNKNOWN.
      const terms = search.split(/\s+/).filter(Boolean);
      const visible = ASSETS.filter(asset => asset.site === site &&
        (risk === null || risk === "NOT_PROVIDED") &&
        (evidence === null || evidence === "NOT_PROVIDED") &&
        terms.every(term => `${asset.id} ${asset.tag} ${asset.name}`.toLowerCase().includes(term)));
      const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
      if (page > totalPages) return error(400);
      const items = visible.slice((page - 1) * pageSize, page * pageSize).map(({ site: _site, ...item }) => item);
      if (fault === "invalid_register_pagination") return json({ items, pageInfo: {
        page, pageSize, totalItems: visible.length + 1, totalPages,
        hasNextPage: page < totalPages,
      } });
      return json({ items, pageInfo: {
        page, pageSize, totalItems: visible.length, totalPages,
        hasNextPage: page < totalPages,
      } });
    }

    const segments = path.split("/");
    const assetId = segments[4]!;
    const asset = ASSETS.find(item => item.id === assetId);
    if (asset === undefined || asset.site !== site) return error(404);
    if (detailDenied.has(assetId)) return error(403);

    if (route === "detail") {
      return json({
        asset: { id: fault === "mismatched_detail_identity" ? "AST-OTHER" : asset.id,
          tag: asset.tag, name: asset.name },
        revision: { id: fault === "invalid_detail_revision_identity" ? "rev/8" : VIEW_REVISION,
          label: "8", state: "DRAFT",
          changedAt: FIXTURE_TIME, sourceReference: "synthetic-review-source" },
        governingRevisionId: GOVERNING_REVISION,
      });
    }

    if (url.searchParams.get("viewRevisionId") !== VIEW_REVISION) return error(400);
    const group = url.searchParams.get("group");
    if (group !== "DISPLAYED_REVISION" && group !== "HISTORICAL") return error(400);
    if (url.searchParams.get("pageSize") !== "20") return error(400);
    const cursor = url.searchParams.get("cursor");
    const suppliedGeneration = url.searchParams.get("snapshotKey");
    if ((cursor === null) !== (suppliedGeneration === null)) return error(400);
    const currentGeneration = `snap_${evidenceGeneration}`;
    // Cursor tokens are bound to the server's CURRENT authorized generation.
    if (cursor !== null && suppliedGeneration !== currentGeneration) return error(409);
    const offset = cursor === null ? 0 : /^c_[0-9]+$/.test(cursor) ? Number(cursor.slice(2)) : NaN;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 40 || offset % 20 !== 0) return error(400);
    const count = group === "HISTORICAL" ? 1 : 21;
    const revisionId = group === "HISTORICAL" ? GOVERNING_REVISION : VIEW_REVISION;
    const items = Array.from({ length: Math.max(0, Math.min(20, count - offset)) }, (_, i) =>
      evidenceItem(offset + i + 1, revisionId));
    if (fault === "oversized_evidence_page") items.push(evidenceItem(999, revisionId));
    return json({ assetId, viewRevisionId: VIEW_REVISION, group,
      snapshotKey: fault === "mismatched_evidence_generation" ? "snap_wrong" : currentGeneration,
      nextCursor: offset + items.length < count ? `c_${offset + 20}` : null, items });
  };

  return Object.freeze({
    fetchImpl,
    rotateEvidenceGeneration: () => { evidenceGeneration += 1; },
    denyDetail: (assetId: string, denied: boolean) => {
      if (denied) detailDenied.add(assetId); else detailDenied.delete(assetId);
    },
    setNextFault: (route: ControlledRoute, fault: ControlledFault) => { faults.set(route, fault); },
    requests: () => Object.freeze([...records]),
  });
}
