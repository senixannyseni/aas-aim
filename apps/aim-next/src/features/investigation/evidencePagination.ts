/**
 * Bounded presentation of an already-authorized local evidence index.
 * The returned page is never a server query or a completeness claim.
 */
export const EVIDENCE_PAGE_SIZE = 30;

export type EvidencePage<T> = Readonly<{
  entries: readonly T[];
  pageIndex: number;
  pageCount: number;
  first: number;
  last: number;
  indexedCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}>;

export function paginateEvidence<T>(entries: readonly T[], requestedPage: number): EvidencePage<T> {
  const indexedCount = entries.length;
  const pageCount = Math.ceil(indexedCount / EVIDENCE_PAGE_SIZE);
  const lastPage = Math.max(0, pageCount - 1);
  // Invalid caller state cannot bypass the bounded page window.
  const safePage = Number.isSafeInteger(requestedPage)
    ? Math.max(0, Math.min(requestedPage, lastPage))
    : 0;
  const start = safePage * EVIDENCE_PAGE_SIZE;
  const end = Math.min(indexedCount, start + EVIDENCE_PAGE_SIZE);
  return {
    entries: entries.slice(start, end),
    pageIndex: safePage,
    pageCount,
    first: indexedCount === 0 ? 0 : start + 1,
    last: end,
    indexedCount,
    hasPrevious: safePage > 0,
    hasNext: safePage + 1 < pageCount,
  };
}
