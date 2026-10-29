/**
 * Phase 46.20 — descriptive coverage of a session-only review working draft.
 * These states are editorial observations, NEVER technical readiness,
 * completeness, engineering acceptance, or approval decisions.
 */
import type {ReviewPreparation} from './evidenceReviewPreparation';

export type WorkingMaterialState='ENTERED'|'NOT_ENTERED'|'SOURCE_LIMITED';
export type WorkingMaterialItem=Readonly<{
  key:'REFERENCES'|'OBSERVATIONS'|'QUESTIONS'|'NEXT_STEPS'|'SOURCE_CONTEXT';
  label:string;
  state:WorkingMaterialState;
  description:string;
}>;
export type WorkingMaterialCoverage=Readonly<{
  items:readonly WorkingMaterialItem[];
  prompts:readonly string[];
  sourceStates:readonly Readonly<{domain:'COR'|'INS';state:'ready'|'disconnected'|'rejected';indexed:number;totalReported:number;truncated:boolean}>[];
  /** Intentionally no score, percent, ready flag or approval state. */
}>;

export function describeWorkingMaterial(review:ReviewPreparation):WorkingMaterialCoverage{
  const items:WorkingMaterialItem[]=[];
  const prompts:string[]=[];
  const add=(key:WorkingMaterialItem['key'],label:string,entered:boolean,
    presentText:string,emptyText:string):void=>{
    items.push(Object.freeze({key,label,state:entered?'ENTERED':'NOT_ENTERED',
      description:entered?presentText:emptyText}));
  };
  add('REFERENCES','Selected evidence pointers',review.references.length>0,
    `${review.references.length} current indexed pointer(s) selected; source documents and relevance not verified.`,
    'No indexed pointers selected in this working case; this does not imply absence of source evidence.');
  add('OBSERVATIONS','Working observations',review.observations.length>0,
    `${review.observations.length} manually entered observation(s); not verified findings.`,
    'No working observation entered.');
  add('QUESTIONS','Questions for discussion',review.questions.length>0,
    `${review.questions.length} manually entered question(s); none is marked resolved.`,
    'No question entered; the interface cannot determine whether questions remain.');
  add('NEXT_STEPS','Proposed follow-up',review.nextSteps.length>0,
    `${review.nextSteps.length} suggested action(s); none assigned or authorized.`,
    'No next step proposed in this working draft.');
  const sourceLimited=review.sources.length!==2||(['COR','INS'] as const).some(domain=>{
    const domainSources=review.sources.filter(s=>s.domain===domain);
    return domainSources.length!==1||domainSources[0]?.state!=='ready'||domainSources[0].truncated
      ||domainSources[0].indexed<domainSources[0].totalReported;
  });
  items.push(Object.freeze({key:'SOURCE_CONTEXT',label:'Independent source coverage',
    state:sourceLimited?'SOURCE_LIMITED':'ENTERED',
    description:review.sources.length===0?'No source metadata supplied.':sourceLimited
      ?'Source connection or bounded-index limitations apply; absence of records cannot be inferred.'
      :'Both declared sources reported connected and within their indexed limits; completeness is not certified.'}));
  if(review.references.length===0)prompts.push('Select and inspect source pointers where relevant; do not infer missing evidence from an empty working set.');
  if(review.questions.length>0)prompts.push('Discuss the entered questions with an authorized reviewer; no resolution is recorded here.');
  if(review.nextSteps.length>0)prompts.push('Confirm responsibility and authorization for proposed next steps outside this temporary interface.');
  if(review.unlinkedNoteCount>0)prompts.push(`${review.unlinkedNoteCount} note(s) have no indexed evidence pointer attached; this may be intentional.`);
  if(review.withdrawnReferenceCount>0)prompts.push(`${review.withdrawnReferenceCount} withdrawn pointer(s) and their attached notes are excluded.`);
  if(sourceLimited)prompts.push('Recheck independently authorized COR/INS source availability and any index limits in the owning services.');
  prompts.push('Engineering sufficiency, record authenticity, and approval must be determined outside this preview.');
  return Object.freeze({items:Object.freeze(items),prompts:Object.freeze(prompts),
    sourceStates:Object.freeze(review.sources.map(s=>Object.freeze({...s})))});
}
