import { describe, expect, it } from "vitest";

import type {
  EvidenceProvenance,
  MissingEvidence,
  ObservedEvidence,
} from "../types/domain";
import type { EngineeringQuantity } from "../types/units";
import { formatEvidence } from "./formatEvidence";

/**
 * Regression tests for PRESENTATION behavior only.
 *
 * These assertions deliberately do not establish engineering safety,
 * acceptance limits, signal quality, or provenance authenticity.
 * Backend/domain tests must cover those authoritative decisions separately.
 *
 * Tests use only public types and the exported formatter. No backend, network,
 * browser APIs, or local deployment configuration are required.
 */
const provenance: EvidenceProvenance = {
  sourceSystemId: "inspection-system",
  sourceRecordId: "UT-001",
  observedAt: "2026-10-20T08:00:00Z",
  receivedAt: "2026-10-20T08:01:00Z",
};

function observed(
  overrides: Partial<ObservedEvidence<EngineeringQuantity>> = {},
): ObservedEvidence<EngineeringQuantity> {
  return {
    kind: "OBSERVED",
    value: { kind: "THICKNESS", value: 8.5, unit: "mm" },
    provenance,
    sourceAvailability: "AVAILABLE",
    signalQuality: "VALID",
    freshness: "CURRENT",
    ...overrides,
  };
}

function missing(overrides: Partial<MissingEvidence> = {}): MissingEvidence {
  return {
    kind: "NOT_OBSERVED",
    reason: "No observation supplied",
    sourceAvailability: "UNAVAILABLE",
    signalQuality: "UNKNOWN",
    freshness: "UNKNOWN",
    ...overrides,
  };
}

const twoDecimals = { fractionDigits: 2 } as const;

describe("formatEvidence — verified reported observations", () => {
  it("formats a valid, current observation without claiming engineering safety", () => {
    const result = formatEvidence(observed(), twoDecimals);

    expect(result.state).toBe("REPORTED_CURRENT");
    expect(result.valueText).toBe("8.50 mm");
    expect(result.text).toBe(
      "Reported reading: 8.50 mm " +
        "(source available; signal valid; information current)",
    );
    expect(result.indicators).toEqual([
      "source available",
      "signal valid",
      "information current",
    ]);
    expect(result.provenance).toEqual(provenance);
    expect(result.text).not.toContain("safe");
    expect(result.text).not.toContain("accepted");
  });

  it("keeps real zero distinct from a missing measurement", () => {
    const result = formatEvidence(
      observed({ value: { kind: "THICKNESS", value: 0, unit: "mm" } }),
      twoDecimals,
    );

    expect(result.state).toBe("REPORTED_CURRENT");
    expect(result.valueText).toBe("0.00 mm");
  });

  it("preserves a gauge-pressure unit without conversion", () => {
    const result = formatEvidence(
      observed({ value: { kind: "PRESSURE", value: 3.124, unit: "bar(g)" } }),
      twoDecimals,
    );

    expect(result.valueText).toBe("3.12 bar(g)");
  });

  it("supports an explicit display locale without changing the stored quantity", () => {
    const input = observed();
    const result = formatEvidence(input, {
      fractionDigits: 2,
      locale: "de-DE",
    });

    expect(result.valueText).toBe("8,50 mm");
    expect(input.value.value).toBe(8.5);
  });

  it("does not silently show a small nonzero observation as zero", () => {
    const result = formatEvidence(
      observed({ value: { kind: "THICKNESS", value: 0.004, unit: "mm" } }),
      twoDecimals,
    );

    expect(result.valueText).toBe("< 0.01 mm");
  });

  it("retains the direction of a small negative rounded observation", () => {
    const result = formatEvidence(
      observed({ value: { kind: "TEMPERATURE", value: -0.004, unit: "°C" } }),
      twoDecimals,
    );

    expect(result.valueText).toBe("> -0.01 °C");
  });
});

describe("formatEvidence — independent availability and freshness dimensions", () => {
  it("qualifies a stale reading even with valid signal and available source", () => {
    const result = formatEvidence(observed({ freshness: "STALE" }), twoDecimals);

    expect(result.state).toBe("REPORTED_WITH_CAVEATS");
    expect(result.valueText).toBe("8.50 mm");
    expect(result.text).toContain("not confirmed current");
    expect(result.text).toContain("information stale");
  });

  it("qualifies a reading when the source is unavailable", () => {
    const result = formatEvidence(
      observed({ sourceAvailability: "UNAVAILABLE" }),
      twoDecimals,
    );

    expect(result.state).toBe("REPORTED_WITH_CAVEATS");
    expect(result.valueText).toBe("8.50 mm");
    expect(result.text).toContain("source unavailable");
  });

  it("qualifies unknown source availability", () => {
    const result = formatEvidence(
      observed({ sourceAvailability: "UNKNOWN" }),
      twoDecimals,
    );

    expect(result.state).toBe("REPORTED_WITH_CAVEATS");
    expect(result.text).toContain("source availability unknown");
  });

  it("qualifies unknown freshness", () => {
    const result = formatEvidence(observed({ freshness: "UNKNOWN" }), twoDecimals);

    expect(result.state).toBe("REPORTED_WITH_CAVEATS");
    expect(result.text).toContain("information freshness unknown");
  });

  it("retains every caveat when source and freshness are both uncertain", () => {
    const result = formatEvidence(
      observed({ sourceAvailability: "UNKNOWN", freshness: "STALE" }),
      twoDecimals,
    );

    expect(result.indicators).toEqual([
      "source availability unknown",
      "signal valid",
      "information stale",
    ]);
    expect(result.text).toContain("not confirmed current");
  });
});

describe("formatEvidence — withheld readings", () => {
  it("withholds a numeric value when signal quality is INVALID", () => {
    const result = formatEvidence(
      observed({ signalQuality: "INVALID" }),
      twoDecimals,
    );

    expect(result.state).toBe("READING_WITHHELD");
    expect(result.valueText).toBeNull();
    expect(result.text).toContain("signal invalid");
    expect(result.text).not.toContain("8.50");
    expect(result.provenance).toEqual(provenance);
  });

  it("withholds a numeric value when signal quality is UNKNOWN", () => {
    const result = formatEvidence(
      observed({ signalQuality: "UNKNOWN" }),
      twoDecimals,
    );

    expect(result.state).toBe("READING_WITHHELD");
    expect(result.valueText).toBeNull();
    expect(result.text).toContain("signal quality unknown");
  });

  it("withholds NaN even if a source reports VALID", () => {
    const result = formatEvidence(
      observed({ value: { kind: "THICKNESS", value: Number.NaN, unit: "mm" } }),
      twoDecimals,
    );

    expect(result.state).toBe("READING_WITHHELD");
    expect(result.valueText).toBeNull();
    expect(result.text).toContain("invalid numeric value");
    expect(result.text).not.toContain("NaN mm");
  });

  it("withholds positive infinity", () => {
    const result = formatEvidence(
      observed({ value: { kind: "PRESSURE", value: Infinity, unit: "bar(a)" } }),
      twoDecimals,
    );

    expect(result.state).toBe("READING_WITHHELD");
    expect(result.valueText).toBeNull();
    expect(result.text).toContain("invalid numeric value");
  });

  it("withholds negative infinity", () => {
    const result = formatEvidence(
      observed({ value: { kind: "TEMPERATURE", value: -Infinity, unit: "°C" } }),
      twoDecimals,
    );

    expect(result.state).toBe("READING_WITHHELD");
    expect(result.valueText).toBeNull();
  });

  it("does not let stale/available labels override invalid signal quality", () => {
    const result = formatEvidence(
      observed({ signalQuality: "INVALID", freshness: "CURRENT" }),
      twoDecimals,
    );

    expect(result.state).toBe("READING_WITHHELD");
    expect(result.valueText).toBeNull();
    expect(result.indicators).toContain("information current");
  });
});

describe("formatEvidence — not observed", () => {
  it("has no reading and no provenance for missing observations", () => {
    const result = formatEvidence(missing(), twoDecimals);

    expect(result.state).toBe("NOT_OBSERVED");
    expect(result.valueText).toBeNull();
    expect(result.provenance).toBeNull();
    expect(result.text).toContain("Not observed — No observation supplied");
    expect(result.text).not.toContain("0.00 mm");
  });

  it("trims a human-readable missing-data reason", () => {
    const result = formatEvidence(
      missing({ reason: "  Instrument disconnected  " }),
      twoDecimals,
    );

    expect(result.text).toContain("Not observed — Instrument disconnected");
    expect(result.text).not.toContain("  Instrument disconnected  ");
  });

  it("makes an empty reason explicit rather than silently omitting it", () => {
    const result = formatEvidence(missing({ reason: "   " }), twoDecimals);

    expect(result.text).toContain("reason unspecified");
    expect(result.valueText).toBeNull();
  });

  it("preserves missing-observation status dimensions", () => {
    const result = formatEvidence(
      missing({ sourceAvailability: "UNKNOWN", signalQuality: "INVALID" }),
      twoDecimals,
    );

    expect(result.indicators).toEqual([
      "source availability unknown",
      "signal invalid",
      "information freshness unknown",
    ]);
    expect(result.state).toBe("NOT_OBSERVED");
  });
});

describe("formatEvidence — correctness boundaries", () => {
  it("does not mutate an input record", () => {
    const input = observed();
    const before = structuredClone(input);
    formatEvidence(input, twoDecimals);

    expect(input).toEqual(before);
  });

  it("returns an immutable indicators array", () => {
    const result = formatEvidence(observed(), twoDecimals);

    expect(Object.isFrozen(result.indicators)).toBe(true);
  });

  it("rejects invalid display precision for a reading it formats", () => {
    expect(() => formatEvidence(observed(), { fractionDigits: 13 })).toThrow(
      RangeError,
    );
  });

  it("retains the original provenance reference for observed readings", () => {
    const result = formatEvidence(observed(), twoDecimals);

    expect(result.provenance).toBe(provenance);
  });
});
