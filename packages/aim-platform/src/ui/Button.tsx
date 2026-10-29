import type { ComponentPropsWithRef, ReactNode } from "react";

/** Visual emphasis only; the variant does not represent engineering authority. */
export type ButtonVariant = "primary" | "secondary";

/**
 * A native-button wrapper for ordinary AIM interface actions.
 *
 * - Defaults to type="button" so a button cannot submit a form by accident.
 * - Native `disabled` blocks activation during loading or when disabled.
 * - Keeps its visible label while loading, with an additional screen-reader cue.
 * - For icon-only children, the caller must supply an accessible `aria-label`.
 * - Business authorization and approval must always be checked on the server.
 *
 * The `ref` and all normal HTML button attributes are forwarded (React 19).
 */
export type ButtonProps = Omit<ComponentPropsWithRef<"button">, "children"> & {
  children: ReactNode;
  variant?: ButtonVariant;
  isLoading?: boolean;
  loadingLabel?: string;
};

export function Button({
  children,
  variant = "primary",
  isLoading = false,
  loadingLabel = "Loading",
  type = "button",
  disabled = false,
  className,
  ...buttonProps
}: ButtonProps) {
  const classes = [
    "aim-button",
    `aim-button--${variant}`,
    isLoading ? "aim-button--loading" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...buttonProps}
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      aria-busy={isLoading ? true : buttonProps["aria-busy"]}
    >
      {isLoading && <span className="aim-button__spinner" aria-hidden="true" />}
      <span className="aim-button__label">{children}</span>
      {isLoading && <span className="aim-sr-only"> — {loadingLabel}</span>}
    </button>
  );
}
