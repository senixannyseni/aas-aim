/** Phase 46.24: presentation-only origin labels for references already authorized upstream.
 * Never derive engineering validity, version precedence, verification or INS credit.
 */
import type {EngineeringEvidence,EvidenceDomain,EvidenceAuthority} from './engineeringEvidenceModel';

export type SourceOriginLabel=Readonly<{
  domain:EvidenceDomain;
  label:string;
  authorityLabel:string;
  explanatoryText:string;
}>;

const AUTHORITY_LABELS:Readonly<Record<EvidenceAuthority,string>>={
  SOURCE_REFERENCE:'Reported source reference',
  DUE_CANDIDATE:'Reported due-date candidate',
  GOVERNING_INS_DECISION:'Owning-source governing due report',
  TECHNICAL_REVIEW:'Reported technical review',
};

/** Strictly labels origin, not trust, authentication, approval, or truth. */
export function describeSourceOrigin(evidence:Pick<EngineeringEvidence,'domain'|'authority'>):SourceOriginLabel{
  return Object.freeze({
    domain:evidence.domain,
    label:`${evidence.domain} · source-reported`,
    authorityLabel:AUTHORITY_LABELS[evidence.authority],
    explanatoryText:evidence.domain==='COR'
      ?'Corrosion-owned reference text; no INS governing date or inspection credit is inferred.'
      :'Inspection-owned reference text; any approval or credit remains determined by the owning INS record.',
  });
}

export type WorkingNoteOrigin=Readonly<{
  label:'Engineer-written draft';
  attachmentLabel:string;
}>;
/** A note remains engineer-authored regardless of which source pointer is attached. */
export function describeWorkingNoteOrigin(source:Pick<EngineeringEvidence,'domain'>|null):WorkingNoteOrigin{
  return Object.freeze({label:'Engineer-written draft',
    attachmentLabel:source?`Attached ${source.domain} pointer (not verified support)`:'No indexed source attached',
  });
}
