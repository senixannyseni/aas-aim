import type {
  EvidenceProvenance,
  EvidenceView,
  InformationFreshness,
  SignalQuality,
  SourceAvailability,
} from "../types/domain";
import type { EngineeringQuantity } from "../types/units";
import { formatQuantity, type QuantityFormatOptions } from "./formatQuantity";

/**
 * Presentation-only status, not an IOW condition or engineering assessment.
 * REPORTED_CURRENT says nothing about equipment integrity or safe operation.
 */
export type EvidenceDisplayState =
  | "REPORTED_CURRENT"
  | "REPORTED_WITH_CAVEATS"
  | "READING_WITHHELD"
  | "NOT_OBSERVED";

/**
 * A display label that remains informative even when rendered without badges.
 * `valueText` is null whenever a reading must not be presented as usable data.
 */
export type FormattedEvidence = Readonly<{
  state: EvidenceDisplayState;
  text: string;
  valueText: string | null;
  indicators: readonly string[];
  provenance: EvidenceProvenance | null;
}>;

const SOURCE_LABELS: Readonly<Record<SourceAvailability, string>> = {
  AVAILABLE: "source available",
  UNAVAILABLE: "source unavailable",
  UNKNOWN: "source availability unknown",
};

const QUALITY_LABELS: Readonly<Record<SignalQuality, string>> = {
  VALID: "signal valid",
  INVALID: "signal invalid",
  UNKNOWN: "signal quality unknown",
};

const FRESHNESS_LABELS: Readonly<Record<InformationFreshness, string>> = {
  CURRENT: "information current",
  STALE: "information stale",
  UNKNOWN: "information freshness unknown",
};

/**
 * Format evidence without conflating source availability, signal quality,
 * freshness, or engineering safety.
 *
 * - Missing evidence never receives a numeric value or a zero fallback.
 * - Invalid/unknown signal quality or non-finite numbers withhold the value.
 * - Stale or source-unavailable observations can be shown only with their
 *   qualifications explicitly attached to the rendered text.
 * - No thresholds, conversions, acceptance rules, or IOW evaluations run here.
 *
 * The inputs are typed view models, not validation of untrusted API payloads.
 * The future OpenAPI boundary must validate the data and its provenance.
 */
export function formatEvidence(
  evidence: EvidenceView<EngineeringQuantity>,
  options: QuantityFormatOptions,
): FormattedEvidence {
  const indicators = Object.freeze([
    SOURCE_LABELS[evidence.sourceAvailability],
    QUALITY_LABELS[evidence.signalQuality],
    FRESHNESS_LABELS[evidence.freshness],
  ]);
  const label = indicators.join("; ");

  if (evidence.kind === "NOT_OBSERVED") {
    const reason = evidence.reason.trim() || "reason unspecified";
    return {
      state: "NOT_OBSERVED",
      text: `Not observed — ${reason} (${label})`,
      valueText: null,
      indicators,
      provenance: null,
    };
  }

  if (
    evidence.signalQuality !== "VALID" ||
    !Number.isFinite(evidence.value.value)
  ) {
    const numericIssue = Number.isFinite(evidence.value.value)
      ? ""
      : "invalid numeric value; ";
    return {
      state: "READING_WITHHELD",
      text: `Reading withheld (${numericIssue}${label})`,
      valueText: null,
      indicators,
      provenance: evidence.provenance,
    };
  }

  const valueText = formatQuantity(evidence.value, options);
  const isCurrent =
    evidence.sourceAvailability === "AVAILABLE" &&
    evidence.freshness === "CURRENT";

  return {
    state: isCurrent ? "REPORTED_CURRENT" : "REPORTED_WITH_CAVEATS",
    text: `${isCurrent ? "Reported reading" : "Reported reading (not confirmed current)"}: ${valueText} (${label})`,
    valueText,
    indicators,
    provenance: evidence.provenance,
  };
}
