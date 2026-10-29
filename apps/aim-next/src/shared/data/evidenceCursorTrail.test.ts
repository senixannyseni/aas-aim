import { describe, expect, it } from "vitest";
import { advanceEvidenceCursor, previousEvidenceCursor, restartEvidenceCursor,
  MAX_EVIDENCE_PAGES } from "./evidenceCursorTrail";

describe("Stage 45.6 — bounded authorized evidence cursor navigation", () => {
  it("accepts an authorized server cursor and binds its source generation", () => {
    const next = advanceEvidenceCursor(restartEvidenceCursor(),
      { snapshotKey: "s1", nextCursor: "cursor2" });
    expect(next).not.toBeNull();
    expect(next?.steps[1]).toEqual({ cursor: "cursor2", snapshotKey: "s1" });
  });
  it("refuses a changed snapshot generation", () => {
    const next = advanceEvidenceCursor(restartEvidenceCursor(),
      { snapshotKey: "s1", nextCursor: "cursor2" })!;
    expect(advanceEvidenceCursor(next,
      { snapshotKey: "s2", nextCursor: "cursor3" })).toBeNull();
  });
  it("refuses repeated cursors and terminal pages", () => {
    const next = advanceEvidenceCursor(restartEvidenceCursor(),
      { snapshotKey: "s1", nextCursor: "cursor2" })!;
    expect(advanceEvidenceCursor(next,
      { snapshotKey: "s1", nextCursor: "cursor2" })).toBeNull();
    expect(advanceEvidenceCursor(next,
      { snapshotKey: "s1", nextCursor: null })).toBeNull();
  });
  it("keeps the page trail bounded independently of server promises", () => {
    let trail = restartEvidenceCursor();
    for (let number = 1; number < MAX_EVIDENCE_PAGES; number++) {
      const next = advanceEvidenceCursor(trail,
        { snapshotKey: "s1", nextCursor: `cursor${number}` });
      expect(next).not.toBeNull();
      trail = next!;
    }
    expect(trail.steps).toHaveLength(MAX_EVIDENCE_PAGES);
    expect(advanceEvidenceCursor(trail,
      { snapshotKey: "s1", nextCursor: "beyond" })).toBeNull();
  });
  it("returns to the previous page without inventing a new cursor", () => {
    const next = advanceEvidenceCursor(restartEvidenceCursor(),
      { snapshotKey: "s1", nextCursor: "cursor2" })!;
    const prior = previousEvidenceCursor(next)!;
    expect(prior.index).toBe(0);
    expect(prior.steps).toBe(next.steps);
    expect(previousEvidenceCursor(prior)).toBeNull();
  });
  it("can move forward again after Previous, but cannot loop to a nonadjacent cursor", () => {
    const first = advanceEvidenceCursor(restartEvidenceCursor(),
      { snapshotKey: "s1", nextCursor: "cursor2" })!;
    const second = advanceEvidenceCursor(first,
      { snapshotKey: "s1", nextCursor: "cursor3" })!;
    const back = previousEvidenceCursor(second)!;
    expect(back.index).toBe(1);
    const forward = advanceEvidenceCursor(back,
      { snapshotKey: "s1", nextCursor: "cursor3" });
    expect(forward?.index).toBe(2);
    expect(forward?.steps).toBe(second.steps);
    const firstAgain = previousEvidenceCursor(back)!;
    const secondAgain = advanceEvidenceCursor(firstAgain,
      { snapshotKey: "s1", nextCursor: "cursor2" });
    expect(secondAgain?.index).toBe(1);
    expect(secondAgain?.steps).toBe(second.steps);
    // The known cursor cannot be reused under a different source generation.
    expect(advanceEvidenceCursor(firstAgain,
      { snapshotKey: "s2", nextCursor: "cursor2" })).toBeNull();
    // Nor can navigation jump to a previously seen but nonadjacent cursor.
    expect(advanceEvidenceCursor(firstAgain,
      { snapshotKey: "s1", nextCursor: "cursor3" })).toBeNull();
  });
  it("restarts from the first page after cursor invalidation", () => {
    const next = advanceEvidenceCursor(restartEvidenceCursor(),
      { snapshotKey: "s1", nextCursor: "cursor2" })!;
    expect(restartEvidenceCursor()).toEqual({ steps: [{ cursor: null, snapshotKey: null }], index: 0 });
    expect(next.steps).toHaveLength(2);
  });
});
