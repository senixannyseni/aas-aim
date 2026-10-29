// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
afterEach(cleanup);
const source=(id:string,domain:'COR'|'INS'):EngineeringEvidence=>({key:`${domain}-${id}`,domain,kind:domain==='COR'?'Calculation trace':'Inspection reference',ownerRecordId:`${domain}-100`,sourceRecordId:id,reference:`REF-${id}`,status:'REPORTED',revision:'r2',reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'});
const cor=source('C1','COR'),ins=source('I1','INS');
const context:CrossDomainContext={asset:{id:'A1',tag:'V-101',name:'Synthetic demo asset',kind:'EQUIPMENT',state:'ACTIVE'},corrosion:{state:'ready',records:[]},inspection:{state:'ready',records:[]},evidence:{corrosion:{entries:[cor],total:1,truncated:false},inspection:{entries:[ins],total:1,truncated:false}}};
describe('Phase 46.29 progressive source information priority',()=>{
 it('keeps primary source facts and authority visible while secondary provenance stays reachable',()=>{
  render(<EngineeringEvidenceNavigator context={context} onOpenOwningRecord={vi.fn()}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  fireEvent.click(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/REF-C1/}));
  const summary=screen.getByRole('region',{name:'Primary reported source facts'});
  expect(within(summary).getByText('REF-C1')).toBeTruthy();
  expect(within(summary).getByText('COR · COR-100')).toBeTruthy();
  const detail=screen.getByText(/Additional provenance/).closest('details')!;
  expect(detail.open).toBe(false);fireEvent.click(within(detail).getByText(/Additional provenance/));
  expect(detail.open).toBe(true);expect(within(detail).getByText('r2')).toBeTruthy();
  expect(screen.getByText(/source reference, not a verified document/)).toBeTruthy();
 });
 it('changes source facts when switching COR to INS and preserves working case',()=>{
  render(<EngineeringEvidenceNavigator context={context} onOpenOwningRecord={vi.fn()}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  fireEvent.click(screen.getByRole('button',{name:/INS 1/}));
  fireEvent.click(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/REF-I1/}));
  expect(within(screen.getByRole('region',{name:'Primary reported source facts'})).getByText('INS · INS-100')).toBeTruthy();
  fireEvent.click(within(screen.getByRole('navigation',{name:'Source to case working path'})).getByRole('button',{name:/Draft a question/}));
  expect(screen.getByText(/Record what needs to be checked with the owning source/)).toBeTruthy();
 });
});
