import type { ApiClient } from "@bandha/aim-platform/api/apiClient";
import { ApiClientError } from "@bandha/aim-platform/api/apiClient";
import { classifyAssetDetailFailure, validateAssetDetailId } from "./assetDetailReadModel";
import type { ReadFailure } from "./authorizedReadState";

/**
 * Stage 45.5 DRAFT: independently authorized and source-reported evidence.
 * Membership in an evidence list is NOT permission to fetch the evidence body,
 * proof that a calculation consumed it, or an engineering approval.
 * HISTORICAL is a server-attested predecessor relationship, not a client guess.
 */
export type EvidenceGroup = "DISPLAYED_REVISION" | "HISTORICAL";
export type EvidenceKind = "DOCUMENT" | "MEASUREMENT" | "INSPECTION" | "CALCULATION" | "OTHER";
export type EvidenceAssociation = "ASSOCIATED" | "USED_AS_BASIS";
export type EvidenceAvailability = "AVAILABLE" | "UNAVAILABLE";
export type EvidenceQuality = "VALID" | "SUSPECT" | "REJECTED" | "UNKNOWN";

export type AuthorizedEvidenceItem = Readonly<{
  id: string;
  revisionId: string;
  kind: EvidenceKind;
  association: EvidenceAssociation;
  availability: EvidenceAvailability;
  quality: EvidenceQuality;
  sourceReference: string | null;
  basisReference: string | null;
  recordedAt: string;
}>;

export type AuthorizedEvidencePage = Readonly<{
  assetId: string;
  viewRevisionId: string;
  group: EvidenceGroup;
  snapshotKey: string;
  items: readonly AuthorizedEvidenceItem[];
  nextCursor: string | null;
}>;

export type EvidencePageRequest = Readonly<{
  assetId: string;
  viewRevisionId: string;
  group: EvidenceGroup;
  cursor?: string | null;
  snapshotKey?: string | null;
}>;

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const PAGE_TOKEN = /^[A-Za-z0-9_-]{1,256}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const KINDS = new Set<EvidenceKind>(["DOCUMENT", "MEASUREMENT", "INSPECTION", "CALCULATION", "OTHER"]);
const ASSOCIATIONS = new Set<EvidenceAssociation>(["ASSOCIATED", "USED_AS_BASIS"]);
const AVAILABILITY = new Set<EvidenceAvailability>(["AVAILABLE", "UNAVAILABLE"]);
const QUALITY = new Set<EvidenceQuality>(["VALID", "SUSPECT", "REJECTED", "UNKNOWN"]);

type Obj = Record<string, unknown>;
function obj(value: unknown, keys: readonly string[]): value is Obj {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) &&
    Object.keys(value).every(key => keys.includes(key));
}
function text(value: unknown, max = 512): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max &&
    value.trim() === value && !CONTROL.test(value);
}
function instant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = INSTANT.exec(value);
  if (!parts) return false;
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  const hour = Number(parts[4]), minute = Number(parts[5]), second = Number(parts[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zone = parts[7]!;
  if (!year || month < 1 || month > 12 || day < 1 || day > days[month - 1]! ||
      hour > 23 || minute > 59 || second > 59 ||
      (zone !== "Z" && (Number(zone.slice(1, 3)) > 14 ||
       (zone.slice(1, 3) === "14" && zone.slice(4, 6) !== "00") ||
       Number(zone.slice(4, 6)) > 59))) return false;
  return Number.isFinite(Date.parse(value));
}
function malformed(): never { throw new Error("Asset Evidence response failed contract validation."); }

export function validateEvidenceRequest(request: EvidencePageRequest): void {
  validateAssetDetailId(request.assetId);
  if (!ID.test(request.viewRevisionId) ||
      (request.group !== "DISPLAYED_REVISION" && request.group !== "HISTORICAL") ||
      (request.cursor != null && !PAGE_TOKEN.test(request.cursor)) ||
      (request.snapshotKey != null && !PAGE_TOKEN.test(request.snapshotKey)) ||
      (request.cursor != null && request.snapshotKey == null) ||
      (request.cursor == null && request.snapshotKey != null)) {
    throw new ApiClientError("INVALID_REQUEST", "Invalid Asset Evidence request.");
  }
}

export function decodeAssetEvidencePage(input: unknown, request: EvidencePageRequest): AuthorizedEvidencePage {
  validateEvidenceRequest(request);
  if (!obj(input, ["assetId", "viewRevisionId", "group", "snapshotKey", "items", "nextCursor"]) ||
      input.assetId !== request.assetId || input.viewRevisionId !== request.viewRevisionId ||
      input.group !== request.group || !text(input.snapshotKey, 256) ||
      !PAGE_TOKEN.test(input.snapshotKey) || !Array.isArray(input.items) ||
      input.items.length > 20 || !("nextCursor" in input) ||
      (input.nextCursor !== null &&
        (typeof input.nextCursor !== "string" || !PAGE_TOKEN.test(input.nextCursor)))) malformed();
  if (request.snapshotKey != null && input.snapshotKey !== request.snapshotKey) malformed();
  if (input.nextCursor != null &&
      (input.items.length === 0 || input.nextCursor === request.cursor)) malformed();

  const seen = new Set<string>();
  const items: AuthorizedEvidenceItem[] = [];
  for (const value of input.items) {
    if (!obj(value, ["id", "revisionId", "kind", "association", "availability", "quality",
         "sourceReference", "basisReference", "recordedAt"]) ||
        typeof value.id !== "string" || !ID.test(value.id) || seen.has(value.id) ||
        typeof value.revisionId !== "string" || !ID.test(value.revisionId) ||
        (request.group === "DISPLAYED_REVISION" && value.revisionId !== request.viewRevisionId) ||
        (request.group === "HISTORICAL" && value.revisionId === request.viewRevisionId) ||
        !KINDS.has(value.kind as EvidenceKind) ||
        !ASSOCIATIONS.has(value.association as EvidenceAssociation) ||
        !AVAILABILITY.has(value.availability as EvidenceAvailability) ||
        !QUALITY.has(value.quality as EvidenceQuality) ||
        !("sourceReference" in value) || !("basisReference" in value) ||
        (value.sourceReference !== null && !text(value.sourceReference)) ||
        (value.basisReference !== null && !text(value.basisReference)) ||
        (value.availability === "AVAILABLE" && value.sourceReference === null) ||
        (value.availability === "UNAVAILABLE" && value.sourceReference !== null) ||
        (value.association === "USED_AS_BASIS" && value.basisReference === null) ||
        !instant(value.recordedAt)) malformed();
    seen.add(value.id);
    items.push(Object.freeze({
      id: value.id as string,
      revisionId: value.revisionId as string,
      kind: value.kind as EvidenceKind,
      association: value.association as EvidenceAssociation,
      availability: value.availability as EvidenceAvailability,
      quality: value.quality as EvidenceQuality,
      sourceReference: value.sourceReference as string | null,
      basisReference: value.basisReference as string | null,
      recordedAt: value.recordedAt as string,
    }));
  }
  return Object.freeze({
    assetId: request.assetId,
    viewRevisionId: request.viewRevisionId,
    group: request.group,
    snapshotKey: input.snapshotKey as string,
    items: Object.freeze(items),
    nextCursor: input.nextCursor as string | null,
  });
}

/** A cursor and snapshotKey come only from a prior validated server response. */
export function requestAssetEvidencePage(
  client: ApiClient, request: EvidencePageRequest, signal: AbortSignal,
): Promise<AuthorizedEvidencePage> {
  validateEvidenceRequest(request);
  return client.request({
    method: "GET",
    pathSegments: ["v1", "assets", request.assetId, "evidence"],
    query: {
      viewRevisionId: request.viewRevisionId,
      group: request.group,
      pageSize: 20,
      ...(request.cursor != null ? { cursor: request.cursor, snapshotKey: request.snapshotKey! } : {}),
    },
    signal,
    decode: (input: unknown) => decodeAssetEvidencePage(input, request),
  });
}

/**
 * An HTTP 409 from this draft evidence endpoint means the authoritative
 * cursor snapshot expired. Display a restart action rather than describing
 * the source as generally unavailable. All other failures remain sanitized.
 */
export function classifyAssetEvidenceFailure(error: unknown): ReadFailure {
  if (error instanceof ApiClientError && error.status === 409) {
    return { kind: "source_generation_changed" };
  }
  return classifyAssetDetailFailure(error);
}
