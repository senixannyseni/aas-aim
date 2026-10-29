import type { AssetRegisterRecord, AssetRegisterPageSize } from "@bandha/aim-platform/assets/AssetRegister";
import type { EvidenceStatus, RiskStatus } from "@bandha/aim-platform/ui/StatusBadge";

/**
 * File 40 — DRAFT OpenAPI AssetListResponse -> browser presentation adapter.
 *
 * Accept only JSON-decoded unknown input. This adapter validates the wire
 * structure, retains page metadata and classification-basis references, and
 * projects a SINGLE server page into the existing seven-field view records.
 *
 * It does NOT authorize users, establish tenant scope, verify the truth of a
 * basis record, or turn reported classifications into engineering decisions.
 * It does NOT connect a paged server result to AssetRegister's LOCAL pager:
 * that component must be adapted to server paging before API integration.
 */

export type AssetRegisterPageInfo = Readonly<{
  page: number;
  pageSize: AssetRegisterPageSize;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
}>;

export type RiskBasis = Readonly<{
  basisRecordId: string;
  assessedAt: string;
}>;

export type EvidenceBasis = Readonly<{
  basisRecordId: string;
  evaluatedAt: string;
}>;

export type AdaptedAssetItem = Readonly<{
  record: AssetRegisterRecord;
  /** Omitted, null, and a present basis remain distinct. */
  riskBasis?: RiskBasis | null;
  evidenceBasis?: EvidenceBasis | null;
}>;

export type AdaptedAssetPage = Readonly<{
  items: readonly AdaptedAssetItem[];
  pageInfo: AssetRegisterPageInfo;
}>;

export type AssetAdapterIssueCode =
  | "EXPECTED_OBJECT"
  | "EXPECTED_ARRAY"
  | "MISSING_FIELD"
  | "UNEXPECTED_FIELD"
  | "INVALID_FIELD"
  | "DUPLICATE_ASSET_ID"
  | "INCONSISTENT_PAGINATION";

export type AssetAdapterIssue = Readonly<{
  path: string;
  code: AssetAdapterIssueCode;
}>;

export type AssetAdapterResult =
  | Readonly<{ ok: true; page: AdaptedAssetPage }>
  | Readonly<{ ok: false; issues: readonly AssetAdapterIssue[] }>;

const PAGE_SIZES: readonly number[] = [10, 25, 50];
const RISK_LEVELS: Readonly<Record<RiskStatus, true>> = {
  LOW: true, MODERATE: true, HIGH: true, CRITICAL: true, UNKNOWN: true,
};
const EVIDENCE_STATES: Readonly<Record<EvidenceStatus, true>> = {
  VALID: true, STALE: true, INVALID: true,
  UNAVAILABLE: true, MISSING: true, UNKNOWN: true,
};
const RESPONSE_FIELDS = new Set(["items", "pageInfo"]);
const PAGE_FIELDS = new Set(["page", "pageSize", "totalItems", "totalPages", "hasNextPage"]);
const ASSET_FIELDS = new Set([
  "id", "tag", "name", "assetType", "location", "riskClassification", "evidenceAssessment",
]);
const RISK_FIELDS = new Set(["level", "basisRecordId", "assessedAt"]);
const EVIDENCE_FIELDS = new Set(["state", "basisRecordId", "evaluatedAt"]);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

type PlainRecord = Record<string, unknown>;

function isObject(input: unknown): input is PlainRecord {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  const proto: unknown = Object.getPrototypeOf(input);
  return proto === Object.prototype || proto === null;
}

function addIssue(issues: AssetAdapterIssue[], path: string, code: AssetAdapterIssueCode): void {
  issues.push(Object.freeze({ path, code }));
}

function has(input: PlainRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function rejectExtra(input: PlainRecord, allowed: ReadonlySet<string>, path: string, issues: AssetAdapterIssue[]): void {
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) addIssue(issues, `${path}.${key}`, "UNEXPECTED_FIELD");
  }
}

function cleanText(input: unknown, maxLength: number): input is string {
  return typeof input === "string" && input.length > 0 && input.length <= maxLength &&
    input.trim() === input && !CONTROL_CHARS.test(input);
}

function requiredText(input: PlainRecord, field: string, max: number, path: string, issues: AssetAdapterIssue[]): string | undefined {
  if (!has(input, field)) {
    addIssue(issues, `${path}.${field}`, "MISSING_FIELD");
    return undefined;
  }
  const value = input[field];
  if (!cleanText(value, max)) {
    addIssue(issues, `${path}.${field}`, "INVALID_FIELD");
    return undefined;
  }
  return value;
}

function optionalText(input: PlainRecord, field: string, path: string, issues: AssetAdapterIssue[]): string | null | undefined {
  if (!has(input, field)) return undefined;
  const value = input[field];
  if (value === null || cleanText(value, 256)) return value;
  addIssue(issues, `${path}.${field}`, "INVALID_FIELD");
  return undefined;
}

/** Strict calendar and offset checks; leap-second timestamps are not accepted. */
function rfc3339Instant(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const m = RFC3339.exec(input);
  if (m === null) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 ||
      hour > 23 || minute > 59 || second > 59) return false;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC treats 0..99 as 1900..1999, hence the explicit year reset.
  calendar.setUTCFullYear(year);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 ||
      calendar.getUTCDate() !== day) return false;
  if (m[7] !== "Z") {
    const offsetHour = Number(m[9]);
    const offsetMinute = Number(m[10]);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(input));
}

function requiredEnum<T extends string>(
  input: PlainRecord,
  field: string,
  options: Readonly<Record<T, true>>,
  path: string,
  issues: AssetAdapterIssue[],
): T | undefined {
  if (!has(input, field)) {
    addIssue(issues, `${path}.${field}`, "MISSING_FIELD");
    return undefined;
  }
  const value = input[field];
  if (typeof value !== "string" || !has(options, value)) {
    addIssue(issues, `${path}.${field}`, "INVALID_FIELD");
    return undefined;
  }
  return value as T;
}

function parseRisk(input: unknown, path: string, issues: AssetAdapterIssue[]):
  Readonly<{ status: RiskStatus; basis: RiskBasis }> | undefined {
  if (!isObject(input)) {
    addIssue(issues, path, "EXPECTED_OBJECT");
    return undefined;
  }
  rejectExtra(input, RISK_FIELDS, path, issues);
  const status = requiredEnum(input, "level", RISK_LEVELS, path, issues);
  const basisRecordId = requiredText(input, "basisRecordId", 128, path, issues);
  if (!has(input, "assessedAt")) addIssue(issues, `${path}.assessedAt`, "MISSING_FIELD");
  else if (!rfc3339Instant(input["assessedAt"])) addIssue(issues, `${path}.assessedAt`, "INVALID_FIELD");
  const assessedAt = input["assessedAt"];
  if (status === undefined || basisRecordId === undefined || typeof assessedAt !== "string" ||
      !rfc3339Instant(assessedAt)) return undefined;
  return Object.freeze({ status, basis: Object.freeze({ basisRecordId, assessedAt }) });
}

function parseEvidence(input: unknown, path: string, issues: AssetAdapterIssue[]):
  Readonly<{ status: EvidenceStatus; basis: EvidenceBasis }> | undefined {
  if (!isObject(input)) {
    addIssue(issues, path, "EXPECTED_OBJECT");
    return undefined;
  }
  rejectExtra(input, EVIDENCE_FIELDS, path, issues);
  const status = requiredEnum(input, "state", EVIDENCE_STATES, path, issues);
  const basisRecordId = requiredText(input, "basisRecordId", 128, path, issues);
  if (!has(input, "evaluatedAt")) addIssue(issues, `${path}.evaluatedAt`, "MISSING_FIELD");
  else if (!rfc3339Instant(input["evaluatedAt"])) addIssue(issues, `${path}.evaluatedAt`, "INVALID_FIELD");
  const evaluatedAt = input["evaluatedAt"];
  if (status === undefined || basisRecordId === undefined || typeof evaluatedAt !== "string" ||
      !rfc3339Instant(evaluatedAt)) return undefined;
  return Object.freeze({ status, basis: Object.freeze({ basisRecordId, evaluatedAt }) });
}

function parseAsset(input: unknown, path: string, issues: AssetAdapterIssue[]): AdaptedAssetItem | undefined {
  if (!isObject(input)) {
    addIssue(issues, path, "EXPECTED_OBJECT");
    return undefined;
  }
  const before = issues.length;
  rejectExtra(input, ASSET_FIELDS, path, issues);
  const id = requiredText(input, "id", 128, path, issues);
  const tag = requiredText(input, "tag", 128, path, issues);
  const name = requiredText(input, "name", 256, path, issues);
  const assetType = optionalText(input, "assetType", path, issues);
  const location = optionalText(input, "location", path, issues);
  const riskValue = has(input, "riskClassification") ? input["riskClassification"] : undefined;
  const evidenceValue = has(input, "evidenceAssessment") ? input["evidenceAssessment"] : undefined;
  const risk = riskValue != null ? parseRisk(riskValue, `${path}.riskClassification`, issues) : undefined;
  const evidence = evidenceValue != null ? parseEvidence(evidenceValue, `${path}.evidenceAssessment`, issues) : undefined;

  if (has(input, "riskClassification") && riskValue === undefined) {
    addIssue(issues, `${path}.riskClassification`, "INVALID_FIELD");
  }
  if (has(input, "evidenceAssessment") && evidenceValue === undefined) {
    addIssue(issues, `${path}.evidenceAssessment`, "INVALID_FIELD");
  }
  if (issues.length !== before || id === undefined || tag === undefined || name === undefined) {
    return undefined;
  }

  const record: AssetRegisterRecord = Object.freeze({
    id, tag, name,
    ...(assetType !== undefined ? { assetType } : {}),
    ...(location !== undefined ? { location } : {}),
    ...(riskValue === null && has(input, "riskClassification")
      ? { riskStatus: null } : risk !== undefined ? { riskStatus: risk.status } : {}),
    ...(evidenceValue === null && has(input, "evidenceAssessment")
      ? { evidenceStatus: null } : evidence !== undefined ? { evidenceStatus: evidence.status } : {}),
  });
  return Object.freeze({
    record,
    ...(riskValue === null && has(input, "riskClassification")
      ? { riskBasis: null } : risk !== undefined ? { riskBasis: risk.basis } : {}),
    ...(evidenceValue === null && has(input, "evidenceAssessment")
      ? { evidenceBasis: null } : evidence !== undefined ? { evidenceBasis: evidence.basis } : {}),
  });
}

function parsePageInfo(input: unknown, path: string, issues: AssetAdapterIssue[]): AssetRegisterPageInfo | undefined {
  if (!isObject(input)) {
    addIssue(issues, path, "EXPECTED_OBJECT");
    return undefined;
  }
  const before = issues.length;
  rejectExtra(input, PAGE_FIELDS, path, issues);
  const integer = (field: string, min: number): number | undefined => {
    if (!has(input, field)) {
      addIssue(issues, `${path}.${field}`, "MISSING_FIELD");
      return undefined;
    }
    const value = input[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) {
      addIssue(issues, `${path}.${field}`, "INVALID_FIELD");
      return undefined;
    }
    return value;
  };
  const page = integer("page", 1);
  const pageSize = integer("pageSize", 1);
  const totalItems = integer("totalItems", 0);
  const totalPages = integer("totalPages", 1);
  let hasNextPage: boolean | undefined;
  if (!has(input, "hasNextPage")) addIssue(issues, `${path}.hasNextPage`, "MISSING_FIELD");
  else if (typeof input["hasNextPage"] !== "boolean") addIssue(issues, `${path}.hasNextPage`, "INVALID_FIELD");
  else hasNextPage = input["hasNextPage"];
  if (pageSize !== undefined && !PAGE_SIZES.includes(pageSize)) {
    addIssue(issues, `${path}.pageSize`, "INVALID_FIELD");
  }
  if (issues.length !== before || page === undefined || pageSize === undefined ||
      totalItems === undefined || totalPages === undefined || hasNextPage === undefined) return undefined;
  return Object.freeze({ page, pageSize: pageSize as AssetRegisterPageSize, totalItems, totalPages, hasNextPage });
}

/**
 * Validate and adapt one response atomically: never return a partially valid page.
 * Errors list field paths and codes only; source values are never echoed.
 */
export function parseAssetRegisterPage(payload: unknown): AssetAdapterResult {
  const issues: AssetAdapterIssue[] = [];
  if (!isObject(payload)) {
    return Object.freeze({ ok: false, issues: Object.freeze([{ path: "$", code: "EXPECTED_OBJECT" as const }]) });
  }
  rejectExtra(payload, RESPONSE_FIELDS, "$", issues);
  const info = has(payload, "pageInfo")
    ? parsePageInfo(payload["pageInfo"], "$.pageInfo", issues)
    : (addIssue(issues, "$.pageInfo", "MISSING_FIELD"), undefined);
  let items: AdaptedAssetItem[] = [];
  if (!has(payload, "items")) addIssue(issues, "$.items", "MISSING_FIELD");
  else if (!Array.isArray(payload["items"])) addIssue(issues, "$.items", "EXPECTED_ARRAY");
  else {
    const rawItems: unknown[] = payload["items"];
    if (rawItems.length > 50) {
      addIssue(issues, "$.items", "INVALID_FIELD");
    } else {
      items = [];
      const seenIds = new Set<string>();
      for (const [i, item] of rawItems.entries()) {
        const parsed = parseAsset(item, `$.items[${i}]`, issues);
        if (parsed === undefined) continue;
        if (seenIds.has(parsed.record.id)) addIssue(issues, `$.items[${i}].id`, "DUPLICATE_ASSET_ID");
        else seenIds.add(parsed.record.id);
        items.push(parsed);
      }
    }
  }
  if (info !== undefined && Array.isArray(payload["items"])) {
    const expectedTotalPages = Math.max(1, Math.ceil(info.totalItems / info.pageSize));
    const expectedCount = Math.min(info.pageSize, Math.max(0, info.totalItems - (info.page - 1) * info.pageSize));
    if (
      info.totalPages !== expectedTotalPages ||
      info.page > info.totalPages ||
      info.hasNextPage !== (info.page < info.totalPages) ||
      payload["items"].length !== expectedCount
    ) addIssue(issues, "$.pageInfo", "INCONSISTENT_PAGINATION");
  }
  if (issues.length > 0 || info === undefined) {
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }
  return Object.freeze({ ok: true, page: Object.freeze({ items: Object.freeze(items), pageInfo: info }) });
}

/** Decoder usable by apiClient.request(); invalid JSON fails closed. */
export function decodeAssetRegisterPage(payload: unknown): AdaptedAssetPage {
  const result = parseAssetRegisterPage(payload);
  if (!result.ok) throw new Error("Invalid Asset Register API response.");
  return result.page;
}
