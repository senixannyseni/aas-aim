// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
afterEach(cleanup);
const cor=(i:number):EngineeringEvidence=>({key:`COR:${i}`,domain:'COR',kind:i%2?'Calculation trace':'Thickness reading',sourceRecordId:`SRC-${i}`,ownerRecordId:'COR-1',reference:`EVID-${i}`,revision:'r1',reportedAt:null,status:'DRAFT',supportingReference:null,authority:'SOURCE_REFERENCE'});
const ins:EngineeringEvidence={...cor(99),key:'INS:99',domain:'INS',kind:'Inspection plan',sourceRecordId:'SRC-I99',ownerRecordId:'INS-9',reference:'PLAN-I99',authority:'SOURCE_REFERENCE'};
const make=(items:EngineeringEvidence[]):CrossDomainContext=>({asset:{id:'A1',tag:'V-101',name:'Synthetic vessel',kind:'EQUIPMENT',state:'ACTIVE'},corrosion:{state:'ready',records:[]},inspection:{state:'ready',records:[]},evidence:{corrosion:{entries:items.filter(x=>x.domain==='COR'),total:items.filter(x=>x.domain==='COR').length,truncated:false},inspection:{entries:items.filter(x=>x.domain==='INS'),total:items.filter(x=>x.domain==='INS').length,truncated:false}}});
const mount=(items:EngineeringEvidence[])=>{const view=render(<EngineeringEvidenceNavigator context={make(items)} onOpenOwningRecord={vi.fn()}/>);fireEvent.click(screen.getByText('Engineering evidence navigator'));return view;};
describe('Phase 46.25 mounted quick-find',()=>{
 it('locates a later-page source without revealing it outside the current index',()=>{
  mount([...Array.from({length:64},(_,i)=>cor(i+1)),ins]);
  const search=screen.getByRole('searchbox',{name:/Find within indexed references/});
  fireEvent.change(search,{target:{value:'EVID-61'}});
  expect(screen.getByText(/1 matching indexed reference/)).toBeTruthy();
  fireEvent.click(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/EVID-61/}));
  expect(screen.getByRole('navigation',{name:'Move between filtered evidence references'})).toBeTruthy();
  expect(screen.getByText(/Reference 1 of 1/)).toBeTruthy();
  expect(within(screen.getByRole('group',{name:'Reported source references'})).queryByRole('button',{name:/EVID-1\b/})).toBeNull();
 });
 it('moves across page boundaries in the active filter',()=>{
  mount(Array.from({length:33},(_,i)=>cor(i+1)));
  fireEvent.click(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/EVID-30\b/}));
  fireEvent.click(within(screen.getByRole('navigation',{name:'Move between filtered evidence references'})).getByRole('button',{name:'Next source'}));
  expect(screen.getByText(/Reference 31 of 33/)).toBeTruthy();
  expect(screen.getByRole('region',{name:'Selected evidence provenance'})).toBeTruthy();
  fireEvent.click(within(screen.getByRole('navigation',{name:'Move between filtered evidence references'})).getByRole('button',{name:'Previous source'}));
  expect(screen.getByText(/Reference 30 of 33/)).toBeTruthy();
 });
 it('clears selection and prevents stale navigation after scope filter',()=>{
  mount([cor(1),cor(2),ins]);
  fireEvent.click(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/EVID-1\b/}));
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'PLAN-I99'}});
  expect(screen.queryByRole('region',{name:'Selected evidence provenance'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:/^COR\s+2$/}));
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  expect(within(screen.getByRole('group',{name:'Reported source references'})).queryByRole('button',{name:/PLAN-I99/})).toBeNull();
 });
 it('returns an explicit no-matches state without cross-source search',()=>{
  mount([cor(1)]);
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'NOT-IN-INDEX'}});
  expect(screen.getByText(/No matches within this indexed view/)).toBeTruthy();
 });
});
