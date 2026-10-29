/**
 * Phase 46.14 — observational, bounded chronology of ALREADY scoped evidence.
 * These dates describe different source fields. A due candidate's target date
 * is NOT an occurrence/review date; governing INS decisions use determinedAt.
 * No time-zone guessing, document retrieval, engineering deficiency, age limit,
 * inspection credit, completeness certification, or chronology across scopes.
 */
import type {EngineeringEvidence} from './engineeringEvidenceModel';

export type ChronologyMode='SOURCE_INDEX'|'SOURCE_TIMES'|'DUE_TARGETS'|'UNPLACED';
export type TimestampInterpretation='ORDERABLE'|'NOT_SUPPLIED'|'UNORDERABLE';
export type ChronologyEntry=Readonly<{
  evidence:EngineeringEvidence;
  role:'REPORTED_SOURCE_TIME'|'REPORTED_DUE_TARGET';
  timestamp:TimestampInterpretation;
  epochMs:number|null;
  /** Observations only: optional fields, not required-field compliance failures. */
  notSupplied:readonly ('Source timestamp'|'Revision'|'Supporting reference')[];
}>;
export type EvidenceChronology=Readonly<{
  sourceOrder:readonly EngineeringEvidence[];
  sourceTimes:readonly ChronologyEntry[];
  dueTargets:readonly ChronologyEntry[];
  unplaced:readonly ChronologyEntry[];
  coverage:Readonly<{
    indexed:number;
    timestampNotSupplied:number;
    timestampUnorderable:number;
    revisionNotSupplied:number;
    supportingReferenceNotSupplied:number;
  }>;
}>;

// Require a timezone. Date-only, local, and ambiguous formats are NEVER sorted.
// Reject calendar normalization (e.g. February 30) and out-of-range offsets.
const ISO_ZONED=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
export function reportedInstant(value:string|null):number|null{
  if(value===null)return null;
  const match=ISO_ZONED.exec(value);
  if(!match)return null;
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]);
  const offset=match[7];
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(month<1||month>12||day<1||day>(days[month-1]??0)||hour>23||minute>59||second>59)return null;
  if(offset!=='Z'){
    const hh=Number(offset?.slice(1,3));
    const mm=Number(offset?.slice(4,6));
    if(hh>14||mm>59||(hh===14&&mm!==0))return null;
  }
  const instant=Date.parse(value);
  return Number.isFinite(instant)?instant:null;
}

function annotated(evidence:EngineeringEvidence):ChronologyEntry{
  const role=evidence.authority==='DUE_CANDIDATE'?'REPORTED_DUE_TARGET':'REPORTED_SOURCE_TIME';
  const epochMs=reportedInstant(evidence.reportedAt);
  const timestamp:TimestampInterpretation=evidence.reportedAt===null?'NOT_SUPPLIED':epochMs===null?'UNORDERABLE':'ORDERABLE';
  const notSupplied:('Source timestamp'|'Revision'|'Supporting reference')[]=[];
  if(evidence.reportedAt===null)notSupplied.push('Source timestamp');
  if(evidence.revision===null)notSupplied.push('Revision');
  if(evidence.supportingReference===null)notSupplied.push('Supporting reference');
  return Object.freeze({evidence,role,timestamp,epochMs,notSupplied:Object.freeze(notSupplied)});
}
function sorted(rows:ChronologyEntry[],ascending:boolean):readonly ChronologyEntry[]{
  return Object.freeze(rows.sort((a,b)=>{
    const dateDelta=(a.epochMs??0)-(b.epochMs??0);
    // Preserve the owning source's original ordering for matching instants.
    return ascending?dateDelta:-dateDelta;
  }));
}
/** Only accepts the current selected-asset, independently authorized bounded index. */
export function buildEvidenceChronology(entries:readonly EngineeringEvidence[]):EvidenceChronology{
  const all=entries.map(annotated);
  const sourceTimes=sorted(all.filter(x=>x.timestamp==='ORDERABLE'&&x.role==='REPORTED_SOURCE_TIME'),false);
  const dueTargets=sorted(all.filter(x=>x.timestamp==='ORDERABLE'&&x.role==='REPORTED_DUE_TARGET'),true);
  const unplaced=Object.freeze(all.filter(x=>x.timestamp!=='ORDERABLE'));
  return Object.freeze({
    sourceOrder:Object.freeze([...entries]),sourceTimes,dueTargets,unplaced,
    coverage:Object.freeze({
      indexed:entries.length,
      timestampNotSupplied:all.filter(x=>x.timestamp==='NOT_SUPPLIED').length,
      timestampUnorderable:all.filter(x=>x.timestamp==='UNORDERABLE').length,
      revisionNotSupplied:all.filter(x=>x.evidence.revision===null).length,
      supportingReferenceNotSupplied:all.filter(x=>x.evidence.supportingReference===null).length,
    }),
  });
}
export function entriesForChronology(view:EvidenceChronology,mode:ChronologyMode):readonly EngineeringEvidence[]{
  if(mode==='SOURCE_INDEX')return view.sourceOrder;
  if(mode==='SOURCE_TIMES')return view.sourceTimes.map(x=>x.evidence);
  if(mode==='DUE_TARGETS')return view.dueTargets.map(x=>x.evidence);
  return view.unplaced.map(x=>x.evidence);
}
