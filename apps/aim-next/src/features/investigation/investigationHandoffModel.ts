/** Phase 46.22: explicitly stage a CURRENT indexed source reference into a temporary case.
 * No data transport, engineering validation, cross-domain join, or approval.
 */
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import {
  CASE_REFERENCE_LIMIT,addCaseReference,projectInvestigationCase,
  type CaseNoteKind,type InvestigationCase,
} from './evidenceCase';

export type EvidenceHandoffKind='REFERENCE'|CaseNoteKind;
export type EvidenceHandoffRequest=Readonly<{
  sequence:number;
  evidenceKey:string;
  kind:EvidenceHandoffKind;
}>;
export type EvidenceHandoffResult=Readonly<{
  state:InvestigationCase;
  status:'ADDED'|'ALREADY_SELECTED'|'UNAVAILABLE'|'LIMIT_REACHED';
  attachedKey:string|null;
  draftNoteKind:CaseNoteKind|null;
}>;

/** Fail closed on withdrawn keys, asset changes, or an unavailable prior selection. */
export function stageEvidenceHandoff(
  state:InvestigationCase,assetId:string,authorized:readonly EngineeringEvidence[],
  request:EvidenceHandoffRequest,
):EvidenceHandoffResult{
  const deny=(status:'UNAVAILABLE'|'LIMIT_REACHED'):EvidenceHandoffResult=>({
    state,status,attachedKey:null,draftNoteKind:null,
  });
  if(state.assetId!==assetId||!Number.isSafeInteger(request.sequence)||request.sequence<1||
    !['REFERENCE','OBSERVATION','QUESTION','NEXT_STEP'].includes(request.kind)||
    !authorized.some(item=>item.key===request.evidenceKey))return deny('UNAVAILABLE');
  const prior=projectInvestigationCase(state,assetId,authorized);
  // Do not silently continue editing while a withdrawn working reference is present.
  if(prior.withdrawnCount>0)return deny('UNAVAILABLE');
  const already=prior.references.some(item=>item.key===request.evidenceKey);
  if(!already&&state.referenceKeys.length>=CASE_REFERENCE_LIMIT)return deny('LIMIT_REACHED');
  const next=already?state:addCaseReference(state,assetId,request.evidenceKey,authorized);
  if(!next.referenceKeys.includes(request.evidenceKey))return deny('UNAVAILABLE');
  return {
    state:next,status:already?'ALREADY_SELECTED':'ADDED',
    attachedKey:request.evidenceKey,
    draftNoteKind:request.kind==='REFERENCE'?null:request.kind,
  };
}
