// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringInvestigationCase} from './EngineeringInvestigationCase';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
afterEach(cleanup);
const cor:EngineeringEvidence={key:'COR:calc:C1:S1',domain:'COR',kind:'Calculation trace',sourceRecordId:'S1',ownerRecordId:'C1',reference:'COR-REF-1',revision:'r1',reportedAt:null,status:'DRAFT',supportingReference:null,authority:'SOURCE_REFERENCE'};
const ins:EngineeringEvidence={...cor,key:'INS:due:I1:S2',domain:'INS',kind:'Due target',sourceRecordId:'S2',ownerRecordId:'I1',reference:'INS-REF-2',authority:'DUE_CANDIDATE'};
const mount=()=>render(<EngineeringInvestigationCase assetId="A1" entries={[cor,ins]} selected={cor} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);
const open=()=>fireEvent.click(screen.getByText('Temporary investigation case'));
describe('Phase 46.24 source origin labels and notes',()=>{
 it('provides explicit separate origin legend instead of color-only meaning',()=>{
  mount();open();const guide=screen.getByLabelText('Difference between source evidence and working notes');
  expect(within(guide).getByText('COR · source-reported')).toBeTruthy();
  expect(within(guide).getByText('INS · source-reported')).toBeTruthy();
  expect(within(guide).getByText('Engineer-written draft')).toBeTruthy();
 });
 it('marks COR indexed pointer and draft separately and retains source state wording',()=>{
  mount();open();fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
  const refs=screen.getByLabelText('Working evidence references');
  const card=within(refs).getByText('COR-REF-1').closest('li')!;
  expect(card.getAttribute('data-origin')).toBe('COR');
  expect(within(card).getByText('COR · source-reported')).toBeTruthy();
  expect(within(card).getByText(/reported state DRAFT/)).toBeTruthy();
  fireEvent.click(within(card).getByRole('button',{name:'Use pointer in draft note'}));
  fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Check source detail'}});
  fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
  const notes=screen.getByLabelText('Working questions observations and next steps');
  expect(within(notes).getByText('Attached COR pointer (not verified support)')).toBeTruthy();
  expect(within(notes).getAllByText('Engineer-written draft').length).toBeGreaterThan(0);
 });
 it('hides withdrawn source and attached draft context',()=>{
  const view=mount();open();fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
  fireEvent.click(screen.getByRole('button',{name:'Use pointer in draft note'}));
  fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Temporary anchored note'}});
  fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
  view.rerender(<EngineeringInvestigationCase assetId="A1" entries={[]} selected={null} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);
  expect(screen.queryByText('Temporary anchored note')).toBeNull();
 });
});
