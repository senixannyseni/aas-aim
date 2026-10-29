/**
 * Phase 46.13 — a display-only comparison of two references already present in
 * the same selected-asset, independently authorized, bounded evidence index.
 * No cross-source join, trust assertion, document resolution or engineering
 * evaluation is performed. Inputs must come from projectCrossDomainInvestigation.
 */
import type {EngineeringEvidence} from './engineeringEvidenceModel';

export type ComparisonStatus='BOTH_NOT_SUPPLIED'|'ONE_NOT_SUPPLIED'|'SAME_REPORTED_TEXT'|'DIFFERENT_REPORTED_TEXT';
export type ComparisonRow=Readonly<{
  label:string;
  a:string;
  b:string;
  status:ComparisonStatus;
}>;
export type EvidenceComparison=Readonly<{
  a:EngineeringEvidence;
  b:EngineeringEvidence;
  sameOwner:boolean;
  sameKind:boolean;
  rows:readonly ComparisonRow[];
}>;

const display=(value:string|null):string=>value??'Not supplied';
function makeRow(label:string,a:string|null,b:string|null):ComparisonRow{
  const status:ComparisonStatus=a===null&&b===null?'BOTH_NOT_SUPPLIED':
    a===null||b===null?'ONE_NOT_SUPPLIED':
    a===b?'SAME_REPORTED_TEXT':'DIFFERENT_REPORTED_TEXT';
  return Object.freeze({label,a:display(a),b:display(b),status});
}
/**
 * Resolve only in-scope keys, never persistent reference objects. Return null
 * if either record disappears, if keys collide, or if the index was withdrawn.
 */
export function compareIndexedEvidence(
  entries:readonly EngineeringEvidence[],aKey:string|null,bKey:string|null,
):EvidenceComparison|null{
  if(!aKey||!bKey||aKey===bKey)return null;
  const a=entries.find(x=>x.key===aKey);
  const b=entries.find(x=>x.key===bKey);
  if(!a||!b)return null;
  return Object.freeze({
    a,b,
    sameOwner:a.domain===b.domain&&a.ownerRecordId===b.ownerRecordId,
    sameKind:a.domain===b.domain&&a.kind===b.kind,
    rows:Object.freeze([
      makeRow('Owning domain',a.domain,b.domain),
      makeRow('Reference kind',a.kind,b.kind),
      makeRow('Owning record ID',a.ownerRecordId,b.ownerRecordId),
      makeRow('Source record ID',a.sourceRecordId,b.sourceRecordId),
      makeRow('Reported reference',a.reference,b.reference),
      makeRow('Supporting reference',a.supportingReference,b.supportingReference),
      makeRow('Revision',a.revision,b.revision),
      makeRow('Reported timestamp',a.reportedAt,b.reportedAt),
      makeRow('Reported state',a.status,b.status),
      makeRow('Source authority class',a.authority,b.authority),
    ]),
  });
}
