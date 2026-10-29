// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringInvestigationCase} from './EngineeringInvestigationCase';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
afterEach(cleanup);
const source:EngineeringEvidence={key:'COR:calc:C1:S1',domain:'COR',kind:'Calculation trace',sourceRecordId:'S1',ownerRecordId:'C1',reference:'CALC-01',revision:'r1',reportedAt:'2026-10-01T00:00:00Z',status:'DRAFT',supportingReference:null,authority:'SOURCE_REFERENCE'};
const mount=()=>render(<EngineeringInvestigationCase assetId="A1" entries={[source]} selected={source} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);
const openCase=()=>fireEvent.click(screen.getByText('Temporary investigation case'));
describe('Phase 46.23 desk interaction and source boundaries',()=>{
 it('shows descriptive zero-state counts without engineering readiness labels',()=>{
  mount();openCase();
  const overview=screen.getByLabelText('Temporary case material overview');
  expect(within(overview).getByText('Source pointers')).toBeTruthy();
  expect(within(overview).getByText('Questions entered')).toBeTruthy();
  expect(screen.getByText('Working references · 0/12')).toBeTruthy();
  expect(screen.getByText('Working notes · 0/18')).toBeTruthy();
 });
 it('uses a currently indexed pointer in the note composer and never auto-creates a note',()=>{
  mount();openCase();
  fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
  fireEvent.click(screen.getByRole('button',{name:'Use pointer in draft note'}));
  expect(screen.getByText('Working notes · 0/18')).toBeTruthy();
  expect((screen.getByLabelText(/Indexed reference \(optional\)/) as HTMLSelectElement).value).toBe(source.key);
  fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Check source detail'}});
  expect(screen.getByText('19/400 characters · Unsaved, session only')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
  expect(within(screen.getByLabelText('Working questions observations and next steps')).getByText('Check source detail')).toBeTruthy();
  expect(screen.getByText('Working notes · 1/18')).toBeTruthy();
 });
 it('withdrawal hides source context and attached notes',()=>{
  const root=mount();openCase();
  fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
  fireEvent.click(screen.getByRole('button',{name:'Use pointer in draft note'}));
  fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Private draft pointer'}});
  fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
  root.rerender(<EngineeringInvestigationCase assetId="A1" entries={[]} selected={null} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);
  expect(screen.queryByText('Private draft pointer')).toBeNull();
  expect(screen.getByText('Working references · 0/12')).toBeTruthy();
 });
 it('keeps read-only review separate from draft composer',()=>{
  mount();openCase();fireEvent.click(screen.getByRole('button',{name:'Open read-only review preview'}));
  const review=screen.getByLabelText('Read-only investigation review preparation');
  expect((review as HTMLDetailsElement).open).toBe(true);
  expect(within(review).queryByRole('button',{name:/submit|approve|save|export/i})).toBeNull();
 });
});
