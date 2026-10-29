// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
afterEach(cleanup);
const item:EngineeringEvidence={key:'COR:CALC:C1:S1',domain:'COR',kind:'Calculation trace',sourceRecordId:'S1',ownerRecordId:'C1',
  reference:'SYNTHETIC-CALC',status:'DRAFT',revision:'R1',reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'};
const context:CrossDomainContext={asset:{id:'A1',tag:'V-101',name:'Demo vessel',kind:'EQUIPMENT',state:'ACTIVE'},
 corrosion:{state:'ready',records:[]},inspection:{state:'disconnected',records:[]},
 evidence:{corrosion:{entries:[item],total:1,truncated:false},inspection:{entries:[],total:0,truncated:false}}};
const setup=()=>{
 const result=render(<EngineeringEvidenceNavigator context={context} onOpenOwningRecord={vi.fn()}/>);
 fireEvent.click(screen.getByText('Engineering evidence navigator'));
 fireEvent.click(screen.getByRole('button',{name:/Calculation trace SYNTHETIC-CALC/}));
 return result;
};
describe('Phase 46.22 mounted evidence-to-case workflow',()=>{
 it('stages selected evidence and focuses the question draft without auto-creating a note',()=>{
   const view=setup();
   fireEvent.click(screen.getByRole('button',{name:'Draft a question'}));
   const casePanel=view.container.querySelector('section[aria-label="Case and review working area"]') as HTMLElement;
   expect(casePanel.hidden).toBe(false);
   expect((casePanel.querySelector('.engineering-investigation-case') as HTMLDetailsElement).open).toBe(true);
   expect(within(casePanel).getByText(/Source pointer staged/)).toBeTruthy();
   expect((within(casePanel).getByLabelText('Type') as HTMLSelectElement).value).toBe('QUESTION');
   expect((within(casePanel).getByLabelText(/Indexed reference \(optional\)/) as HTMLSelectElement).value).toBe(item.key);
   expect(within(casePanel).getByText('Working references · 1/12')).toBeTruthy();
   expect(within(casePanel).getByText('Working notes · 0/18')).toBeTruthy();
   fireEvent.change(within(casePanel).getByPlaceholderText(/Write a question/),{target:{value:'Review source basis'}});
   fireEvent.click(within(casePanel).getByRole('button',{name:'Add working note'}));
   expect(within(within(casePanel).getByLabelText('Working questions observations and next steps')).getByText('Review source basis')).toBeTruthy();
 });
 it('does not double-add a selected source when a different note type is requested',()=>{
   const view=setup();
   fireEvent.click(screen.getByRole('button',{name:'Add to temporary case'}));
   fireEvent.click(screen.getByRole('button',{name:/Evidence explorer/}));
   fireEvent.click(screen.getByRole('button',{name:'Propose a next step'}));
   const panel=view.container.querySelector('section[aria-label="Case and review working area"]') as HTMLElement;
   expect(within(panel).getByText('Working references · 1/12')).toBeTruthy();
   expect((within(panel).getByLabelText('Type') as HTMLSelectElement).value).toBe('NEXT_STEP');
 });
 it('opens read-only review without saving or approving notes',()=>{
   setup();fireEvent.click(screen.getByRole('button',{name:'Draft a question'}));
   fireEvent.click(screen.getByRole('button',{name:'Open read-only review preview'}));
   const review=screen.getByLabelText('Read-only investigation review preparation') as HTMLDetailsElement;
   expect(review.open).toBe(true);
   expect(within(review).queryByRole('button',{name:/approve|submit|save|export/i})).toBeNull();
 });
 it('scope-key remount clears the temporary working case',()=>{
   const v=setup();fireEvent.click(screen.getByRole('button',{name:'Draft a question'}));
   v.rerender(<EngineeringEvidenceNavigator key="other-trusted-scope" context={context} onOpenOwningRecord={vi.fn()}/>);
   fireEvent.click(screen.getByText('Engineering evidence navigator'));
   fireEvent.click(screen.getByRole('button',{name:/Case & review/}));
   expect(screen.getByText('Working references · 0/12')).toBeTruthy();
 });
});
