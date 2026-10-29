import { useId } from "react";
import type { ComponentPropsWithRef, ReactNode } from "react";

/**
 * A read-only layout container for AIM information and workspace sections.
 *
 * A Card is a named <section>, not a clickable surface. Actions must be
 * explicit interactive children (for example, the shared Button component).
 * A displayed heading does not grant authority or imply engineering validity.
 *
 * The generated heading ID provides an accessible section name. Callers may
 * also provide an external `aria-describedby` reference; if a description is
 * present, both descriptions will be preserved.
 */
export type CardProps = Omit<
  ComponentPropsWithRef<"section">,
  "title" | "children" | "dangerouslySetInnerHTML" | "aria-label" | "aria-labelledby"
> & {
  /** Visible heading and accessible name for the section. */
  title: string;
  /** Optional descriptive sentence shown below the heading. */
  description?: string;
  /** Optional controls positioned in the heading area. */
  actions?: ReactNode;
  /** Match the heading level to the surrounding page outline. */
  headingLevel?: 2 | 3 | 4;
  children: ReactNode;
};

export function Card({
  title,
  description,
  actions,
  headingLevel = 2,
  children,
  className,
  "aria-describedby": externalDescriptionId,
  ...sectionProps
}: CardProps) {
  // Hooks must run unconditionally, even if a caller supplied an invalid title.
  const generatedId = useId();
  if (title.trim().length === 0) {
    throw new Error("Card title must not be empty.");
  }

  const visibleDescription = description?.trim();
  const headingId = `${generatedId}-heading`;
  const descriptionId = `${generatedId}-description`;
  const Heading = headingLevel === 2 ? "h2" : headingLevel === 3 ? "h3" : "h4";

  const describedBy = [visibleDescription ? descriptionId : undefined, externalDescriptionId]
    .filter(Boolean)
    .join(" ");
  const classes = ["aim-card", className].filter(Boolean).join(" ");

  return (
    <section
      {...sectionProps}
      className={classes}
      aria-labelledby={headingId}
      aria-describedby={describedBy || undefined}
    >
      <header className="aim-card__header">
        <div className="aim-card__heading-block">
          <Heading id={headingId} className="aim-card__title">
            {title}
          </Heading>
          {visibleDescription && (
            <p id={descriptionId} className="aim-card__description">
              {visibleDescription}
            </p>
          )}
        </div>
        {actions != null && <div className="aim-card__actions">{actions}</div>}
      </header>
      <div className="aim-card__body">{children}</div>
    </section>
  );
}
