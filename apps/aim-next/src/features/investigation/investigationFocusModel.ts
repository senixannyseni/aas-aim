/** Presentation-only visibility. Does not change any source index, permission, or case data. */
export type InvestigationFocus = 'ALL' | 'EVIDENCE' | 'OBSERVATIONS' | 'CASE';

export const INVESTIGATION_FOCUS_OPTIONS = Object.freeze([
  {id:'EVIDENCE',label:'Evidence explorer',helper:'Search and trace sources'},
  {id:'OBSERVATIONS',label:'Source observations',helper:'Chronology and patterns'},
  {id:'CASE',label:'Case & review',helper:'Temporary working notes'},
  {id:'ALL',label:'All sections',helper:'Full detail view'},
] as const);

export function visibleInvestigationPanels(focus:InvestigationFocus):Readonly<{evidence:boolean;observations:boolean;caseWork:boolean}> {
  return Object.freeze({
    evidence:focus==='ALL'||focus==='EVIDENCE',
    observations:focus==='ALL'||focus==='OBSERVATIONS',
    caseWork:focus==='ALL'||focus==='CASE',
  });
}

/** A source-trace action must reveal the explorer; the full view remains unchanged. */
export function focusForSourceInspection(previous:InvestigationFocus):InvestigationFocus {
  return previous==='ALL'?'ALL':'EVIDENCE';
}
