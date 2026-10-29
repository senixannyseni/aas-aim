// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringInvestigationCase} from './EngineeringInvestigationCase';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
const cor:EngineeringEvidence={key:'COR-A',domain:'COR',kind:'Calculation trace',ownerRecordId:'COR-1',sourceRecordId:'SRC-COR',reference:'CALC-COR',status:'reported',revision:null,reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'};
const ins:EngineeringEvidence={key:'INS-B',domain:'INS',kind:'Inspection evidence',ownerRecordId:'INS-1',sourceRecordId:'SRC-INS',reference:'INS-REP',status:'reported',revision:null,reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'};
afterEach(cleanup);
function mount(){const root=render(<EngineeringInvestigationCase assetId="ASSET-1" entries={[cor,ins]} selected={cor} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);fireEvent.click(within(root.container).getByText('Temporary investigation case'));return root;}
function seed(){mount();fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Verify source interval'}});fireEvent.click(screen.getByRole('button',{name:'Add working note'}));}
describe('Phase 46.31 temporary working note revision',()=>{
 it('edits an existing draft in place without adding another note',()=>{
  seed();fireEvent.click(screen.getByRole('button',{name:'Edit working note 1'}));
  expect(screen.getByText('Editing draft note #1')).toBeTruthy();
  const field=screen.getByPlaceholderText(/Write a question/) as HTMLTextAreaElement;
  expect(field.value).toBe('Verify source interval');
  fireEvent.change(field,{target:{value:'Confirm reported interval with owning source'}});
  fireEvent.click(screen.getByRole('button',{name:'Save draft changes'}));
  expect(within(screen.getByLabelText('Working questions observations and next steps')).getByText('Confirm reported interval with owning source')).toBeTruthy();
  expect(screen.queryByText('Verify source interval')).toBeNull();
  expect(screen.getByText(/Working notes · 1\/18/)).toBeTruthy();
  expect(screen.getByRole('button',{name:'Edit working note 1'})).toBeTruthy();
 });
 it('cancels a draft revision without changing the saved note',()=>{
  seed();fireEvent.click(screen.getByRole('button',{name:'Edit working note 1'}));
  fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Uncommitted change'}});
  fireEvent.click(screen.getByRole('button',{name:'Cancel edit'}));
  expect(within(screen.getByLabelText('Working questions observations and next steps')).getByText('Verify source interval')).toBeTruthy();
  expect(screen.queryByText('Uncommitted change')).toBeNull();
 });
 it('updates the read-only review when a note kind changes',()=>{
  seed();fireEvent.click(screen.getByRole('button',{name:'Edit working note 1'}));
  fireEvent.change(screen.getByLabelText('Type'),{target:{value:'NEXT_STEP'}});
  fireEvent.click(screen.getByRole('button',{name:'Save draft changes'}));
  fireEvent.click(screen.getByRole('button',{name:'Open read-only review preview'}));
  const review=screen.getByLabelText('Read-only investigation review preparation');
  expect(within(review).getByRole('region',{name:'Proposed next steps (not assigned)'})).toBeTruthy();
  expect(within(within(review).getByRole('region',{name:'Proposed next steps (not assigned)'})).getByText('Verify source interval')).toBeTruthy();
 });
 it('does not expose editing an attached note after COR is withdrawn',()=>{
  const root=mount();fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
  fireEvent.change(screen.getByLabelText(/Indexed reference \(optional\)/),{target:{value:'COR-A'}});
  fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'COR-only draft'}});
  fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
  root.rerender(<EngineeringInvestigationCase assetId="ASSET-1" entries={[ins]} selected={null} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);
  expect(screen.queryByText('COR-only draft')).toBeNull();
  expect(screen.queryByRole('button',{name:'Edit working note 1'})).toBeNull();
 });
});
