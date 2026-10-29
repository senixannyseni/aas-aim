import {describe,expect,it} from 'vitest';
import {INVESTIGATION_FOCUS_OPTIONS,focusForSourceInspection,visibleInvestigationPanels} from './investigationFocusModel';

describe('Phase 46.21 presentation-only investigation focus',()=>{
  it('defines the three focus tasks and the all-sections compatibility view',()=>{
    expect(INVESTIGATION_FOCUS_OPTIONS.map(option=>option.id)).toEqual(['EVIDENCE','OBSERVATIONS','CASE','ALL']);
  });
  it('keeps every section visible in the compatibility default',()=>{
    expect(visibleInvestigationPanels('ALL')).toEqual({evidence:true,observations:true,caseWork:true});
  });
  it('shows exactly one panel per focused task',()=>{
    expect(visibleInvestigationPanels('EVIDENCE')).toEqual({evidence:true,observations:false,caseWork:false});
    expect(visibleInvestigationPanels('OBSERVATIONS')).toEqual({evidence:false,observations:true,caseWork:false});
    expect(visibleInvestigationPanels('CASE')).toEqual({evidence:false,observations:false,caseWork:true});
  });
  it('reveals source inspection without losing the all-sections preference',()=>{
    expect(focusForSourceInspection('CASE')).toBe('EVIDENCE');
    expect(focusForSourceInspection('OBSERVATIONS')).toBe('EVIDENCE');
    expect(focusForSourceInspection('ALL')).toBe('ALL');
  });
  it('freezes the panel projection and focus choices',()=>{
    expect(Object.isFrozen(visibleInvestigationPanels('ALL'))).toBe(true);
    expect(Object.isFrozen(INVESTIGATION_FOCUS_OPTIONS)).toBe(true);
  });
});
