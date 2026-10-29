import { describe, expect, it } from "vitest";

import type {
  EngineeringQuantity,
  PressureQuantity,
  ThicknessQuantity,
} from "../types/units";
import { formatQuantity } from "./formatQuantity";

/**
 * Regression tests for PRESENTATION formatting only.
 *
 * No test here establishes measurement validity, engineering tolerances,
 * unit-conversion rules, or equipment acceptability. Those responsibilities
 * belong to authoritative backend contracts and domain tests.
 *
 * Test strings use explicit locales to avoid depending on the host locale.
 */
const thickness: ThicknessQuantity = {
  kind: "THICKNESS",
  value: 8.567,
  unit: "mm",
};

function quantity(value: number): ThicknessQuantity {
  return { kind: "THICKNESS", value, unit: "mm" };
}

describe("formatQuantity — formatting and precision", () => {
  it("rounds to explicitly requested decimal places", () => {
    expect(formatQuantity(thickness, { fractionDigits: 2 })).toBe("8.57 mm");
  });

  it("preserves trailing zeros when precision requires them", () => {
    expect(formatQuantity(quantity(8.5), { fractionDigits: 3 })).toBe("8.500 mm");
  });

  it("accepts zero fractional digits", () => {
    expect(formatQuantity(quantity(8), { fractionDigits: 0 })).toBe("8 mm");
  });

  it("supports the upper precision boundary of 12 digits", () => {
    expect(formatQuantity(quantity(0.125), { fractionDigits: 12 })).toBe(
      "0.125000000000 mm",
    );
  });

  it("preserves an exactly zero reading rather than reporting a detection bound", () => {
    expect(formatQuantity(quantity(0), { fractionDigits: 2 })).toBe("0.00 mm");
  });

  it("preserves negative numeric readings", () => {
    const input: EngineeringQuantity = {
      kind: "TEMPERATURE",
      value: -25.349,
      unit: "°C",
    };
    expect(formatQuantity(input, { fractionDigits: 1 })).toBe("-25.3 °C");
  });

  it("does not introduce thousands separators by default", () => {
    expect(formatQuantity(quantity(12345.67), { fractionDigits: 2 })).toBe(
      "12345.67 mm",
    );
  });

  it("adds thousands separators only when explicitly requested", () => {
    expect(
      formatQuantity(quantity(12345.67), {
        fractionDigits: 2,
        useGrouping: true,
      }),
    ).toBe("12,345.67 mm");
  });
});

describe("formatQuantity — nonzero values that round to zero", () => {
  it("qualifies a positive small nonzero reading", () => {
    expect(formatQuantity(quantity(0.004), { fractionDigits: 2 })).toBe(
      "< 0.01 mm",
    );
  });

  it("qualifies a negative small nonzero reading without losing its sign", () => {
    expect(formatQuantity(quantity(-0.004), { fractionDigits: 2 })).toBe(
      "> -0.01 mm",
    );
  });

  it("qualifies positive small values at zero fractional digits", () => {
    expect(formatQuantity(quantity(0.1), { fractionDigits: 0 })).toBe("< 1 mm");
  });

  it("qualifies negative small values at zero fractional digits", () => {
    expect(formatQuantity(quantity(-0.1), { fractionDigits: 0 })).toBe(
      "> -1 mm",
    );
  });

  it("retains the qualified form with a decimal-comma locale", () => {
    expect(
      formatQuantity(quantity(0.004), { fractionDigits: 2, locale: "de-DE" }),
    ).toBe("< 0,01 mm");
  });

  it("retains negative sign with a decimal-comma locale", () => {
    expect(
      formatQuantity(quantity(-0.004), { fractionDigits: 2, locale: "de-DE" }),
    ).toBe("> -0,01 mm");
  });
});

describe("formatQuantity — units and locale", () => {
  it("preserves gauge-pressure units without converting them", () => {
    const input: PressureQuantity = {
      kind: "PRESSURE",
      value: 3.124,
      unit: "bar(g)",
    };
    expect(formatQuantity(input, { fractionDigits: 2 })).toBe("3.12 bar(g)");
  });

  it("preserves absolute-pressure distinction", () => {
    const input: PressureQuantity = {
      kind: "PRESSURE",
      value: 1.23,
      unit: "bar(a)",
    };
    expect(formatQuantity(input, { fractionDigits: 2 })).toBe("1.23 bar(a)");
  });

  it("preserves mechanical stress units", () => {
    const input: EngineeringQuantity = {
      kind: "STRESS",
      value: 240,
      unit: "MPa",
    };
    expect(formatQuantity(input, { fractionDigits: 0 })).toBe("240 MPa");
  });

  it("preserves imperial thickness units without converting them", () => {
    const input: ThicknessQuantity = {
      kind: "THICKNESS",
      value: 0.25,
      unit: "in",
    };
    expect(formatQuantity(input, { fractionDigits: 3 })).toBe("0.250 in");
  });

  it("formats a decimal comma in an explicitly selected locale", () => {
    expect(
      formatQuantity(quantity(8.5), { fractionDigits: 2, locale: "de-DE" }),
    ).toBe("8,50 mm");
  });

  it("supports grouping in an explicitly selected decimal-comma locale", () => {
    expect(
      formatQuantity(quantity(12345.67), {
        fractionDigits: 2,
        locale: "de-DE",
        useGrouping: true,
      }),
    ).toBe("12.345,67 mm");
  });

  it("does not modify the underlying quantity or options", () => {
    const input: ThicknessQuantity = Object.freeze({
      kind: "THICKNESS",
      value: 8.567,
      unit: "mm",
    });
    const options = Object.freeze({ fractionDigits: 2, locale: "en-US" });

    expect(formatQuantity(input, options)).toBe("8.57 mm");
    expect(input).toEqual({ kind: "THICKNESS", value: 8.567, unit: "mm" });
    expect(options).toEqual({ fractionDigits: 2, locale: "en-US" });
  });
});

describe("formatQuantity — invalid numeric values", () => {
  it("withholds NaN", () => {
    expect(formatQuantity(quantity(Number.NaN), { fractionDigits: 2 })).toBe(
      "Invalid numeric value",
    );
  });

  it("withholds positive Infinity", () => {
    expect(formatQuantity(quantity(Infinity), { fractionDigits: 2 })).toBe(
      "Invalid numeric value",
    );
  });

  it("withholds negative Infinity", () => {
    expect(formatQuantity(quantity(-Infinity), { fractionDigits: 2 })).toBe(
      "Invalid numeric value",
    );
  });
});

describe("formatQuantity — invalid precision configuration", () => {
  for (const { precision, label } of [
    { precision: -1, label: "negative" },
    { precision: 13, label: "above maximum" },
    { precision: 1.5, label: "fractional" },
    { precision: Number.NaN, label: "NaN" },
    { precision: Infinity, label: "positive Infinity" },
    { precision: -Infinity, label: "negative Infinity" },
  ]) {
    it(`rejects ${label} precision`, () => {
      expect(() => formatQuantity(thickness, { fractionDigits: precision })).toThrow(
        RangeError,
      );
    });
  }

  it("rejects invalid precision even if the measurement is non-finite", () => {
    expect(() =>
      formatQuantity(quantity(NaN), { fractionDigits: -1 }),
    ).toThrow(RangeError);
  });
});
