// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
afterEach(cleanup);
const cor=(index:number):EngineeringEvidence=>({key:`C-${index}`,domain:'COR',kind:'Calculation trace',sourceRecordId:`SRC-${index}`,ownerRecordId:'COR-100',reference:`EVID-${index}`,status:'DRAFT',revision:'r1',reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'});
const make=(records:EngineeringEvidence[]):CrossDomainContext=>({asset:{id:'A1',tag:'V-101',name:'Synthetic vessel',kind:'EQUIPMENT',state:'ACTIVE'},corrosion:{state:'ready',records:[]},inspection:{state:'disconnected',records:[]},evidence:{corrosion:{entries:records,total:records.length,truncated:false},inspection:{entries:[],total:0,truncated:false}}});
function mount(records=[cor(1),cor(2),cor(3)]){const view=render(<EngineeringEvidenceNavigator context={make(records)} onOpenOwningRecord={vi.fn()}/>);fireEvent.click(screen.getByText('Engineering evidence navigator'));return view;}
describe('Phase 46.27 mounted focus continuity',()=>{
 it('moves keyboard focus inside the indexed page without selecting a different reference',()=>{
  mount();const rows=within(screen.getByRole('group',{name:'Reported source references'})).getAllByRole('button');
  rows[0]!.focus();fireEvent.keyDown(rows[0]!,{key:'ArrowDown'});expect(document.activeElement).toBe(rows[1]);
  expect(rows[1]!.getAttribute('aria-pressed')).toBe('false');
  fireEvent.keyDown(rows[1]!,{key:'End'});expect(document.activeElement).toBe(rows[2]);
  fireEvent.keyDown(rows[2]!,{key:'ArrowDown'});expect(document.activeElement).toBe(rows[2]);
  fireEvent.keyDown(rows[2]!,{key:'Home'});expect(document.activeElement).toBe(rows[0]);
  fireEvent.keyDown(rows[0]!,{key:'Enter'});expect(document.activeElement).toBe(rows[0]);
 });
 it('returns to the currently selected row from inspector through button or Escape',()=>{
  mount();const list=screen.getByRole('group',{name:'Reported source references'});
  const row=within(list).getByRole('button',{name:/EVID-2/});fireEvent.click(row);
  const inspector=screen.getByRole('region',{name:'Selected evidence provenance'});
  fireEvent.click(within(inspector).getByRole('button',{name:'Return focus to selected reference'}));
  expect(document.activeElement).toBe(row);
  const next=within(inspector).getByRole('button',{name:'Draft a question'});
  next.focus();fireEvent.keyDown(next,{key:'Escape'});expect(document.activeElement).toBe(row);
 });
 it('returns from temporary case to the selected evidence row without losing notes',()=>{
  const view=mount();const row=screen.getByRole('button',{name:/Calculation trace EVID-2/});fireEvent.click(row);
  fireEvent.click(within(screen.getByRole('navigation',{name:'Source to case working path'})).getByRole('button',{name:'2 · Draft a question'}));
  const casePanel=view.container.querySelector('section[aria-label="Case and review working area"]') as HTMLElement;
  const noteField=within(casePanel).getByPlaceholderText(/Write a question/);
  expect(document.activeElement).toBe(noteField);
  fireEvent.change(noteField,{target:{value:'Verify reported source origin.'}});
  fireEvent.click(within(casePanel).getByRole('button',{name:'Back to Evidence Explorer'}));
  expect(document.activeElement).toBe(row);
  expect(within(casePanel).getByPlaceholderText(/Write a question/)).toHaveProperty('value','Verify reported source origin.');
 });
 it('falls back to local search input after source withdrawal',()=>{
  const v=mount();fireEvent.click(screen.getByRole('button',{name:/Calculation trace EVID-2/}));
  fireEvent.click(within(screen.getByRole('navigation',{name:'Source to case working path'})).getByRole('button',{name:'3 · Review working material'}));
  v.rerender(<EngineeringEvidenceNavigator context={make([cor(1)])} onOpenOwningRecord={vi.fn()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Back to Evidence Explorer'}));
  expect(screen.queryByRole('region',{name:'Selected evidence provenance'})).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('searchbox',{name:/Find within indexed references/}));
 });
});
