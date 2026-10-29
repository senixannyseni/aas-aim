/**
 * Phase 46.19: read-only review PREPARATION from a projected temporary case.
 * The caller must supply the projection against the CURRENT, independently
 * authorized evidence index. This is neither an assessment nor an approval.
 * No inferred evidence joins, completeness decisions, or note substantiation.
 */
import type {EngineeringEvidence, EvidenceDomain} from './engineeringEvidenceModel';
import type {CaseNoteKind, ProjectedCase} from './evidenceCase';

export type ReviewSourceState='ready'|'disconnected'|'rejected';
export type ReviewSourceCoverage=Readonly<{
  domain:EvidenceDomain;
  state:ReviewSourceState;
  indexed:number;
  totalReported:number;
  truncated:boolean;
}>;
export type ReviewNote=Readonly<{
  id:number;
  text:string;
  kind:CaseNoteKind;
  /** An authorized indexed source pointer; never proof that a note is true. */
  evidence:EngineeringEvidence|null;
}>;
export type ReviewPreparation=Readonly<{
  assetId:string;
  references:readonly EngineeringEvidence[];
  observations:readonly ReviewNote[];
  questions:readonly ReviewNote[];
  nextSteps:readonly ReviewNote[];
  unlinkedNoteCount:number;
  withdrawnReferenceCount:number;
  /** Source connection and index coverage are reported, never certified. */
  sources:readonly ReviewSourceCoverage[];
  limitations:readonly string[];
}>;

const labels:Readonly<Record<CaseNoteKind,'observations'|'questions'|'nextSteps'>>={
  OBSERVATION:'observations',QUESTION:'questions',NEXT_STEP:'nextSteps',
};

/**
 * The preview must NEVER receive raw notes or unfiltered source entries.
 * Consequently notes anchored to withdrawn references cannot reappear here.
 */
export function prepareInvestigationReview(
  projected:ProjectedCase,
  sourceCoverage:readonly ReviewSourceCoverage[]=[],
):ReviewPreparation{
  const groups:{observations:ReviewNote[];questions:ReviewNote[];nextSteps:ReviewNote[]}={
    observations:[],questions:[],nextSteps:[],
  };
  let unlinkedNoteCount=0;
  for(const {note,evidence} of projected.notes){
    // Guard against a malformed caller projection: only current visible case
    // references may be linked, and they must match the current source identity.
    const linked=evidence && projected.references.find(ref=>ref.key===evidence.key
      && ref.domain===evidence.domain && ref.ownerRecordId===evidence.ownerRecordId) || null;
    if(note.evidenceKey!==null && (!linked || linked.key!==note.evidenceKey))continue;
    const item:ReviewNote=Object.freeze({id:note.id,text:note.text,kind:note.kind,evidence:linked});
    if(!linked)unlinkedNoteCount++;
    groups[labels[note.kind]].push(item);
  }
  // Scope/availability are not silently upgraded if source metadata is absent.
  const sources=sourceCoverage.map(source=>Object.freeze({
    domain:source.domain,state:source.state,
    indexed:source.state==='ready'?source.indexed:0,
    totalReported:source.state==='ready'?source.totalReported:0,
    truncated:source.state==='ready'&&source.truncated,
  }));
  const limitations=[
    'This preview is a temporary working aid, not an engineering assessment, submitted review, finding, assignment, or approval.',
    'A selected source reference is a navigation pointer, not verification of a document or substantiation of a note.',
    'Questions and proposed next steps are manually entered and have not been resolved, assigned, or authorized by this interface.',
  ];
  if(projected.withdrawnCount>0)limitations.push(
    `${projected.withdrawnCount} previously selected reference(s) are unavailable in the current index; associated notes are excluded.`,
  );
  if(sources.some(source=>source.state!=='ready'))limitations.push(
    'One or more COR/INS sources are disconnected or rejected; this preview does not imply those source records are absent.',
  );
  if(sources.some(source=>source.truncated))limitations.push(
    'At least one authorized source index reached its display limit; selected references do not represent the complete source corpus.',
  );
  if(sources.length===0)limitations.push('Source connection and indexing coverage were not supplied to this preview.');
  return Object.freeze({
    assetId:projected.assetId,
    references:Object.freeze([...projected.references]),
    observations:Object.freeze(groups.observations),
    questions:Object.freeze(groups.questions),
    nextSteps:Object.freeze(groups.nextSteps),
    unlinkedNoteCount,withdrawnReferenceCount:projected.withdrawnCount,
    sources:Object.freeze(sources),limitations:Object.freeze(limitations),
  });
}
