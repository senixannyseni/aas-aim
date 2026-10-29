import type { EngineeringQuantity } from "../types/units";

/**
 * Presentation-only formatting for an already validated engineering quantity.
 *
 * This function NEVER converts units, changes the underlying source value,
 * determines engineering acceptability, or establishes evidence validity.
 * An API-boundary adapter must validate untrusted quantities and their units.
 * The caller must handle evidence quality/freshness before displaying a value.
 */
export type QuantityFormatOptions = Readonly<{
  /** Required: display decimal places, from 0 to 12 (not measurement accuracy). */
  fractionDigits: number;
  /** A BCP 47 locale; defaults to en-US for deterministic AIM presentation. */
  locale?: string;
  /** Defaults to false so thousands separators never appear unexpectedly. */
  useGrouping?: boolean;
}>;

export function formatQuantity(
  quantity: EngineeringQuantity,
  options: QuantityFormatOptions,
): string {
  const { fractionDigits, locale = "en-US", useGrouping = false } = options;

  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 12) {
    throw new RangeError("fractionDigits must be an integer between 0 and 12.");
  }

  // Never let NaN or infinity masquerade as a measured engineering quantity.
  if (!Number.isFinite(quantity.value)) {
    return "Invalid numeric value";
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping,
  });

  const renderedValue = formatter.format(quantity.value);

  // Display rounding must not silently turn a small nonzero reading into zero.
  // The bound is a display cue, not a measurement tolerance or engineering rule.
  if (
    quantity.value !== 0 &&
    (renderedValue === formatter.format(0) || renderedValue === formatter.format(-0))
  ) {
    const bound = formatter.format(10 ** -fractionDigits);
    return `${quantity.value < 0 ? "> -" : "< "}${bound} ${quantity.unit}`;
  }

  return `${renderedValue} ${quantity.unit}`;
}
