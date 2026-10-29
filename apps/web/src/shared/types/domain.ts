/**
 * Read-only presentation types for evidence shown in the AAS–AIM web client.
 *
 * These types are NOT the authoritative Java domain model or a published API
 * schema. Once a versioned OpenAPI contract exists, its generated types should
 * own the wire format and a tested adapter should create these view models.
 *
 * TypeScript types are erased at runtime: unknown API payloads still require
 * runtime validation before they can be treated as these types.
 */

/** Whether the underlying data source can currently be reached. */
export type SourceAvailability = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";

/** Quality of an observation, as reported by an authoritative source. */
export type SignalQuality = "VALID" | "INVALID" | "UNKNOWN";

/** Freshness of an observation, not an engineering safety judgement. */
export type InformationFreshness = "CURRENT" | "STALE" | "UNKNOWN";

/**
 * Source references and timestamps for one observation.
 * Timestamps are intended to be ISO 8601 instants; their syntax and meaning
 * must be checked at an API boundary, not assumed from TypeScript's `string`.
 */
export type EvidenceProvenance = Readonly<{
  sourceSystemId: string;
  sourceRecordId: string;
  observedAt: string;
  receivedAt: string;
}>;

/**
 * An observation can exist even if the source is now unavailable, its signal
 * is invalid, or its value is stale. The three dimensions are independent.
 * `value` being present NEVER implies VALID, CURRENT, normal, or safe.
 */
export type ObservedEvidence<T> = Readonly<{
  kind: "OBSERVED";
  value: T;
  provenance: EvidenceProvenance;
  sourceAvailability: SourceAvailability;
  signalQuality: SignalQuality;
  freshness: InformationFreshness;
}>;

/**
 * No usable observation was supplied. A missing observation has no `value`;
 * it must not be silently converted to zero or a normal condition.
 */
export type MissingEvidence = Readonly<{
  kind: "NOT_OBSERVED";
  reason: string;
  sourceAvailability: SourceAvailability;
  signalQuality: "INVALID" | "UNKNOWN";
  freshness: "UNKNOWN";
  value?: never;
  provenance?: never;
}>;

/** Presentation-only result, intentionally separate from IOW rule evaluations. */
export type EvidenceView<T> = ObservedEvidence<T> | MissingEvidence;
