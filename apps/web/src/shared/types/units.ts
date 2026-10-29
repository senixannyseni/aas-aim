/**
 * Explicit engineering quantities for AAS–AIM browser presentation.
 *
 * These are view-model types, NOT authoritative Java domain or API contracts.
 * The future OpenAPI adapter must validate incoming values and normalize its
 * wire units to these display conventions before constructing these objects.
 *
 * TypeScript cannot prove that a number is finite, calibrated, or physically
 * meaningful. These types DO NOT implement unit conversion, arithmetic,
 * tolerances, rounding rules, or engineering acceptance criteria.
 */

/** Spatial dimension (not automatically interchangeable with thickness). */
export type LengthUnit = "mm" | "m" | "in";

/** Wall and component thickness. */
export type ThicknessUnit = "mm" | "in";

/** Mechanical stress or material strength, not process pressure. */
export type StressUnit = "MPa" | "psi";

/**
 * Process pressure. The suffix distinguishes absolute (a) from gauge (g).
 * Bare "bar" and "psi" are deliberately excluded because their reference
 * pressure would be ambiguous in an engineering record.
 */
export type PressureUnit =
  | "bar(a)"
  | "bar(g)"
  | "kPa(a)"
  | "kPa(g)"
  | "psi(a)"
  | "psi(g)";

/** Temperature: conversion between these units requires an offset. */
export type TemperatureUnit = "°C" | "°F" | "K";

/**
 * Read-only value with an explicit physical quantity and unit.
 * The discriminant lets TypeScript narrow mixed quantities safely.
 */
type Quantity<Kind extends string, Unit extends string> = Readonly<{
  kind: Kind;
  value: number;
  unit: Unit;
}>;

export type LengthQuantity = Quantity<"LENGTH", LengthUnit>;
export type ThicknessQuantity = Quantity<"THICKNESS", ThicknessUnit>;
export type StressQuantity = Quantity<"STRESS", StressUnit>;
export type PressureQuantity = Quantity<"PRESSURE", PressureUnit>;
export type TemperatureQuantity = Quantity<"TEMPERATURE", TemperatureUnit>;

/**
 * Union for display components; never sum or compare differing kinds or units
 * without separately validated normalization and quantity-specific rules.
 * A provided value is NOT evidence that the underlying signal is valid.
 * Pair this with EvidenceView<EngineeringQuantity> from domain.ts when needed.
 */
export type EngineeringQuantity =
  | LengthQuantity
  | ThicknessQuantity
  | StressQuantity
  | PressureQuantity
  | TemperatureQuantity;
