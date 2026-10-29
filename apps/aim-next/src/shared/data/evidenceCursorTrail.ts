/**
 * Stage 45.6 — bounded cursor navigation for a single authorized evidence scope.
 * A cursor is not a permission grant: every page must still be authorized by
 * the server and independently validated by the evidence-page decoder.
 */
export const MAX_EVIDENCE_PAGES = 100;

export type EvidenceCursorStep = Readonly<{
  cursor: string | null;
  snapshotKey: string | null;
}>;

export const FIRST_EVIDENCE_PAGE: EvidenceCursorStep = Object.freeze({
  cursor: null,
  snapshotKey: null,
});

export type EvidenceCursorTrail = Readonly<{
  steps: readonly EvidenceCursorStep[];
  index: number;
}>;

export type CursorPage = Readonly<{
  snapshotKey: string;
  nextCursor: string | null;
}>;

/** Does not validate server JSON; callers must provide a decoded page. */
export function advanceEvidenceCursor(
  trail: EvidenceCursorTrail,
  page: CursorPage,
): EvidenceCursorTrail | null {
  const current = trail.steps[trail.index];
  if (current === undefined || trail.index < 0 ||
      trail.index >= MAX_EVIDENCE_PAGES ||
      trail.steps.length > MAX_EVIDENCE_PAGES ||
      !Number.isSafeInteger(trail.index) ||
      page.nextCursor === null) return null;
  if (current.snapshotKey !== null && current.snapshotKey !== page.snapshotKey) return null;
  // Any cursor seen previously is a cycle; do not let a repeated cursor turn
  // the Next button into an infinite loop or a misleading "new" page.
  // Moving forward after Previous may revisit the already-authorized immediate next step.
  // Do not treat that one exact cursor and generation as a cycle.
  const immediateNext = trail.steps[trail.index + 1];
  if (immediateNext?.cursor === page.nextCursor &&
      immediateNext.snapshotKey === page.snapshotKey) {
    return { index: trail.index + 1, steps: trail.steps };
  }
  // Reuse of any other recorded cursor is an actual cycle.
  if (trail.steps.some(step => step.cursor === page.nextCursor)) return null;
  if (trail.index + 1 >= MAX_EVIDENCE_PAGES) return null;
  return Object.freeze({
    index: trail.index + 1,
    steps: Object.freeze([
      ...trail.steps.slice(0, trail.index + 1),
      Object.freeze({ cursor: page.nextCursor, snapshotKey: page.snapshotKey }),
    ]),
  });
}

export function previousEvidenceCursor(trail: EvidenceCursorTrail): EvidenceCursorTrail | null {
  if (!Number.isSafeInteger(trail.index) || trail.index <= 0 ||
      trail.index >= trail.steps.length || trail.steps.length > MAX_EVIDENCE_PAGES) return null;
  return { steps: trail.steps, index: trail.index - 1 };
}

/** Expired cursor recovery starts from the first page, not an obsolete token. */
export function restartEvidenceCursor(): EvidenceCursorTrail {
  return { steps: [FIRST_EVIDENCE_PAGE], index: 0 };
}
