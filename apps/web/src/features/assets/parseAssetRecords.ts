import type { EvidenceStatus, RiskStatus } from "../../shared/ui/StatusBadge";
import type { AssetRegisterRecord } from "./AssetRegister";

/**
 * Presentation-boundary validation for an array of asset register view records.
 *
 * This is NOT a published Java/OpenAPI wire schema, tenant authorization check,
 * domain validation, or proof of status provenance. The eventual API adapter
 * must establish those guarantees before projecting records into this shape.
 *
 * Pass JSON-decoded unknown data, never `as AssetRegisterRecord[]`. Validation
 * rejects the entire batch if any record is malformed; it never silently drops
 * records, infers a risk/evidence status, or converts missing data to UNKNOWN.
 */
export type AssetRecordValidationCode =
  | "EXPECTED_ARRAY"
  | "EXPECTED_OBJECT"
  | "UNEXPECTED_FIELD"
  | "REQUIRED_STRING"
  | "OPTIONAL_STRING"
  | "INVALID_STATUS"
  | "DUPLICATE_ID";

/** Paths identify fields, but issues deliberately never echo untrusted values. */
export type AssetRecordValidationIssue = Readonly<{
  path: string;
  code: AssetRecordValidationCode;
}>;

export type AssetRecordsValidationResult =
  | Readonly<{ ok: true; assets: readonly AssetRegisterRecord[] }>
  | Readonly<{ ok: false; issues: readonly AssetRecordValidationIssue[] }>;

const ALLOWED_FIELDS = new Set([
  "id", "tag", "name", "assetType", "location", "riskStatus", "evidenceStatus",
]);

const RISK_STATUSES = {
  LOW: true,
  MODERATE: true,
  HIGH: true,
  CRITICAL: true,
  UNKNOWN: true,
} as const satisfies Record<RiskStatus, true>;

const EVIDENCE_STATUSES = {
  VALID: true,
  STALE: true,
  INVALID: true,
  UNAVAILABLE: true,
  MISSING: true,
  UNKNOWN: true,
} as const satisfies Record<EvidenceStatus, true>;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function issue(
  issues: AssetRecordValidationIssue[],
  path: string,
  code: AssetRecordValidationCode,
): void {
  issues.push(Object.freeze({ path, code }));
}

function isCleanString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !CONTROL_CHARACTERS.test(value)
  );
}

function readRequiredString(
  input: Record<string, unknown>,
  field: "id" | "tag" | "name",
  path: string,
  issues: AssetRecordValidationIssue[],
): string | undefined {
  const value = input[field];
  if (!isCleanString(value)) {
    issue(issues, `${path}.${field}`, "REQUIRED_STRING");
    return undefined;
  }
  return value;
}

function readOptionalString(
  input: Record<string, unknown>,
  field: "assetType" | "location",
  path: string,
  issues: AssetRecordValidationIssue[],
): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return undefined;
  const value = input[field];
  if (value === null || isCleanString(value)) return value;
  issue(issues, `${path}.${field}`, "OPTIONAL_STRING");
  return undefined;
}

function isEnumValue<T extends string>(
  value: unknown,
  choices: Readonly<Record<T, true>>,
): value is T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(choices, value);
}

function readOptionalStatus<T extends string>(
  input: Record<string, unknown>,
  field: "riskStatus" | "evidenceStatus",
  choices: Readonly<Record<T, true>>,
  path: string,
  issues: AssetRecordValidationIssue[],
): T | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return undefined;
  const value = input[field];
  if (value === null || isEnumValue(value, choices)) return value;
  issue(issues, `${path}.${field}`, "INVALID_STATUS");
  return undefined;
}

/**
 * Validate a full client-side view-model batch. No partial success is possible.
 * Accepts only arrays of plain objects containing the seven declared fields.
 * Optional fields may be absent or null, but not undefined or blank strings.
 * IDs are opaque, case-sensitive identifiers; duplicates are rejected.
 *
 * This function does not fetch, authenticate, authorize, or sanitize HTML.
 * React text rendering protects display; API trust is a separate concern.
 */
export function parseAssetRegisterRecords(payload: unknown): AssetRecordsValidationResult {
  const issues: AssetRecordValidationIssue[] = [];
  if (!Array.isArray(payload)) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([{ path: "$", code: "EXPECTED_ARRAY" as const }]),
    });
  }

  const assets: AssetRegisterRecord[] = [];
  const seenIds = new Set<string>();

  for (const [index, candidate] of payload.entries()) {
    const path = `$[${index}]`;
    if (!isPlainRecord(candidate)) {
      issue(issues, path, "EXPECTED_OBJECT");
      continue;
    }

    for (const field of Object.keys(candidate)) {
      if (!ALLOWED_FIELDS.has(field)) {
        issue(issues, `${path}.${field}`, "UNEXPECTED_FIELD");
      }
    }

    const before = issues.length;
    const id = readRequiredString(candidate, "id", path, issues);
    const tag = readRequiredString(candidate, "tag", path, issues);
    const name = readRequiredString(candidate, "name", path, issues);
    const assetType = readOptionalString(candidate, "assetType", path, issues);
    const location = readOptionalString(candidate, "location", path, issues);
    const riskStatus = readOptionalStatus(candidate, "riskStatus", RISK_STATUSES, path, issues);
    const evidenceStatus = readOptionalStatus(candidate, "evidenceStatus", EVIDENCE_STATUSES, path, issues);

    if (id !== undefined) {
      if (seenIds.has(id)) {
        issue(issues, `${path}.id`, "DUPLICATE_ID");
      } else {
        seenIds.add(id);
      }
    }

    if (issues.length !== before || id === undefined || tag === undefined || name === undefined) {
      continue;
    }

    assets.push(Object.freeze({
      id,
      tag,
      name,
      ...(assetType !== undefined ? { assetType } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(riskStatus !== undefined ? { riskStatus } : {}),
      ...(evidenceStatus !== undefined ? { evidenceStatus } : {}),
    }));
  }

  if (issues.length !== 0) {
    return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  }
  return Object.freeze({ ok: true, assets: Object.freeze(assets) });
}
