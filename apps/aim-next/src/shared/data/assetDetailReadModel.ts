import type { ApiClient } from "@bandha/aim-platform/api/apiClient";
import { ApiClientError } from "@bandha/aim-platform/api/apiClient";
import type { ReadFailure } from "./authorizedReadState";

/**
 * Stage 45.4 — DRAFT, independently authorized Asset Detail read endpoint.
 * The current backend does NOT implement or authorize this contract yet.
 * Successful parsing establishes presentation shape only, not engineering fitness.
 */
export type AssetRevisionState = "DRAFT" | "RELEASED" | "SUPERSEDED" | "WITHDRAWN";
export type AssetDetailReadModel = Readonly<{
  asset: Readonly<{
    id: string;
    tag: string;
    name: string;
    assetType?: string | null;
    location?: string | null;
  }>;
  revision: Readonly<{
    id: string;
    label: string;
    state: AssetRevisionState;
    changedAt: string;
    sourceReference: string;
  }>;
  /** Reported by the backend: null means NO revision ID supplied, not a safety conclusion. */
  governingRevisionId: string | null;
}>;

const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const STATES = new Set<AssetRevisionState>(["DRAFT", "RELEASED", "SUPERSEDED", "WITHDRAWN"]);
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

type PlainObject = Record<string, unknown>;
function record(input: unknown, fields: readonly string[]): input is PlainObject {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  const prototype: unknown = Object.getPrototypeOf(input);
  return (prototype === Object.prototype || prototype === null) &&
    Object.keys(input).every(key => fields.includes(key));
}
function cleanText(input: unknown, max = 256): input is string {
  return typeof input === "string" && input.length > 0 && input.length <= max &&
    input.trim() === input && !CONTROL.test(input);
}
function nullableText(input: PlainObject, key: string): boolean {
  return !(key in input) || input[key] === null || cleanText(input[key]);
}
function validInstant(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const parts = TIMESTAMP.exec(input);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  if (!year || year > 9999 || !month || month > 12 || !day || day > 31 ||
      hour === undefined || hour > 23 || minute === undefined || minute > 59 ||
      second === undefined || second > 59) return false;
  const monthLength = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > monthLength[month - 1]!) return false;
  const zone = parts[7]!;
  if (zone !== "Z") {
    const zoneHour = Number(zone.slice(1, 3));
    const zoneMinute = Number(zone.slice(4, 6));
    if (zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)) return false;
  }
  return Number.isFinite(Date.parse(input));
}
function malformed(): never {
  throw new Error("Asset Detail response failed contract validation.");
}

export function validateAssetDetailId(assetId: string): void {
  if (typeof assetId !== "string" || !SEGMENT.test(assetId)) {
    throw new ApiClientError("INVALID_REQUEST", "Invalid Asset Detail identity.");
  }
}

/** Rejects the WHOLE response, including a valid-looking record with a wrong asset ID. */
export function decodeAssetDetailResponse(input: unknown, expectedAssetId: string): AssetDetailReadModel {
  validateAssetDetailId(expectedAssetId);
  if (!record(input, ["asset", "revision", "governingRevisionId"]) ||
      !("asset" in input) || !("revision" in input) || !("governingRevisionId" in input)) malformed();
  const asset = input.asset;
  const revision = input.revision;
  const governingRevisionId = input.governingRevisionId;
  if (!record(asset, ["id", "tag", "name", "assetType", "location"]) ||
      asset.id !== expectedAssetId || !cleanText(asset.tag, 128) ||
      !cleanText(asset.name) || !nullableText(asset, "assetType") ||
      !nullableText(asset, "location")) malformed();
  if (!record(revision, ["id", "label", "state", "changedAt", "sourceReference"]) ||
      !(typeof revision.id === "string" && SEGMENT.test(revision.id)) ||
      !cleanText(revision.label, 128) ||
      !STATES.has(revision.state as AssetRevisionState) ||
      !validInstant(revision.changedAt) || !cleanText(revision.sourceReference, 512)) malformed();
  if (governingRevisionId !== null &&
      !(typeof governingRevisionId === "string" && SEGMENT.test(governingRevisionId))) malformed();
  // A non-released revision cannot itself be the governing release.
  if (governingRevisionId === revision.id && revision.state !== "RELEASED") malformed();

  return Object.freeze({
    asset: Object.freeze({
      id: expectedAssetId,
      tag: asset.tag as string,
      name: asset.name as string,
      ...(Object.prototype.hasOwnProperty.call(asset, "assetType")
        ? { assetType: asset.assetType as string | null } : {}),
      ...(Object.prototype.hasOwnProperty.call(asset, "location")
        ? { location: asset.location as string | null } : {}),
    }),
    revision: Object.freeze({
      id: revision.id as string,
      label: revision.label as string,
      state: revision.state as AssetRevisionState,
      changedAt: revision.changedAt as string,
      sourceReference: revision.sourceReference as string,
    }),
    governingRevisionId: governingRevisionId as string | null,
  });
}

export function requestAssetDetail(
  client: ApiClient,
  assetId: string,
  signal: AbortSignal,
): Promise<AssetDetailReadModel> {
  validateAssetDetailId(assetId);
  return client.request({
    method: "GET",
    pathSegments: ["v1", "assets", assetId],
    signal,
    decode: (input: unknown) => decodeAssetDetailResponse(input, assetId),
  });
}

/** Sanitized categories only. Never expose backend messages in frontend details. */
export function classifyAssetDetailFailure(error: unknown): ReadFailure {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return { kind: "authentication_required" };
    if (error.status === 403 || error.status === 404) return { kind: "access_denied" };
    if (error.status === 429) return { kind: "rate_limited" };
    if (error.code === "TIMEOUT") return { kind: "timeout" };
    if (error.code === "NETWORK_ERROR") return { kind: "network_failure" };
    if (error.code === "INVALID_RESPONSE" || error.code === "INVALID_JSON" ||
        error.code === "INVALID_CONTENT_TYPE") return { kind: "invalid_response" };
    if (error.code === "HTTP_ERROR" || error.status !== null) return { kind: "service_unavailable" };
  }
  return { kind: "invalid_response" };
}
