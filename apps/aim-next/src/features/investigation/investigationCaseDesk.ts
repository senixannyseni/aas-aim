/**
 * Phase 46.23: purely descriptive temporary case overview.
 * Inputs are the already authorization-filtered read-only review projection.
 * No engineering readiness, approval or authority is inferred from counts.
 */
import type {ReviewPreparation} from './evidenceReviewPreparation';

export type CaseDeskSummary=Readonly<{
  referenceCount:number;
  noteCount:number;
  questionCount:number;
  observationCount:number;
  nextStepCount:number;
  unlinkedCount:number;
  limitedSourceCount:number;
  withdrawnReferenceCount:number;
}>;
export function summarizeCaseDesk(review:ReviewPreparation):CaseDeskSummary{
  return Object.freeze({
    referenceCount:review.references.length,
    noteCount:review.observations.length+review.questions.length+review.nextSteps.length,
    questionCount:review.questions.length,
    observationCount:review.observations.length,
    nextStepCount:review.nextSteps.length,
    unlinkedCount:review.unlinkedNoteCount,
    limitedSourceCount:review.sources.filter(x=>x.state!=='ready'||x.truncated).length,
    withdrawnReferenceCount:review.withdrawnReferenceCount,
  });
}
