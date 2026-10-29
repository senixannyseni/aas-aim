// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
afterEach(cleanup);
const cor:EngineeringEvidence={key:'C-1',domain:'COR',kind:'Calculation trace',ownerRecordId:'COR-100',sourceRecordId:'S1',reference:'CALC-101',status:'DRAFT',revision:'r1',reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'};
const ctx=(sources:EngineeringEvidence[]):CrossDomainContext=>({asset:{id:'A1',tag:'V-101',name:'Demo vessel',kind:'EQUIPMENT',state:'ACTIVE'},corrosion:{state:'ready',records:[]},inspection:{state:'disconnected',records:[]},evidence:{corrosion:{entries:sources,total:sources.length,truncated:false},inspection:{entries:[],total:0,truncated:false}}});
const mount=(sources=[cor])=>{const v=render(<EngineeringEvidenceNavigator context={ctx(sources)} onOpenOwningRecord={vi.fn()}/>);fireEvent.click(screen.getByText('Engineering evidence navigator'));return v;};
describe('Phase 46.26 mounted unified journey',()=>{
 it('does not offer an evidence handoff until an authorized indexed source is selected',()=>{
  mount();const nav=screen.getByRole('navigation',{name:'Source to case working path'});
  expect(within(nav).getByText('No source currently selected')).toBeTruthy();
  expect((within(nav).getByRole('button',{name:'2 · Draft a question'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:/Calculation trace CALC-101/}));
  expect((within(nav).getByRole('button',{name:'2 · Draft a question'}) as HTMLButtonElement).disabled).toBe(false);
  expect(within(nav).getByText('CALC-101')).toBeTruthy();
 });
 it('stages an authorized pointer and shows the case, without creating a note',()=>{
  const view=mount();fireEvent.click(screen.getByRole('button',{name:/Calculation trace CALC-101/}));
  fireEvent.click(within(screen.getByRole('navigation',{name:'Source to case working path'})).getByRole('button',{name:'2 · Draft a question'}));
  const panel=view.container.querySelector('section[aria-label="Case and review working area"]') as HTMLElement;
  expect(panel.hidden).toBe(false);expect(within(panel).getByText('Working references · 1/12')).toBeTruthy();
  expect(within(panel).getByText('Working notes · 0/18')).toBeTruthy();
  fireEvent.click(within(panel).getByRole('button',{name:'Back to Evidence Explorer'}));
  expect(panel.hidden).toBe(true);expect(within(panel).getByText('Working references · 1/12')).toBeTruthy();
 });
 it('opens existing read-only review, not save, submit or approval',()=>{
  mount();fireEvent.click(within(screen.getByRole('navigation',{name:'Source to case working path'})).getByRole('button',{name:'3 · Review working material'}));
  const review=screen.getByLabelText('Read-only investigation review preparation') as HTMLDetailsElement;
  expect(review.open).toBe(true);expect(review.querySelector('summary')).toBe(document.activeElement);
  expect(within(review).queryByRole('button',{name:/submit|approve|save|export/i})).toBeNull();
 });
 it('loses the selected pointer when a source is withdrawn',()=>{
  const v=mount();fireEvent.click(screen.getByRole('button',{name:/Calculation trace CALC-101/}));
  v.rerender(<EngineeringEvidenceNavigator context={ctx([])} onOpenOwningRecord={vi.fn()}/>);
  const nav=screen.getByRole('navigation',{name:'Source to case working path'});
  expect((within(nav).getByRole('button',{name:'2 · Draft a question'}) as HTMLButtonElement).disabled).toBe(true);
 });
});
