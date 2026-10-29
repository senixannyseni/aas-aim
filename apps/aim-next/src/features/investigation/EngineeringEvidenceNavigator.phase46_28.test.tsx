// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
afterEach(cleanup);
const source=(id:string,domain:'COR'|'INS'):EngineeringEvidence=>({key:`${domain}-${id}`,domain,kind:domain==='COR'?'Calculation trace':'Inspection reference',ownerRecordId:`${domain}-100`,sourceRecordId:id,reference:`REF-${id}`,status:'REPORTED',revision:'r1',reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'});
const cor=source('C1','COR'),ins=source('I1','INS');
const context:CrossDomainContext={asset:{id:'A1',tag:'V-101',name:'Synthetic demo asset',kind:'EQUIPMENT',state:'ACTIVE'},corrosion:{state:'ready',records:[]},inspection:{state:'ready',records:[]},evidence:{corrosion:{entries:[cor],total:1,truncated:false},inspection:{entries:[ins],total:1,truncated:false}}};
describe('Phase 46.28 visual structure retains verified interaction semantics',()=>{
 it('keeps the evidence browser and selected inspector under one responsive container',()=>{
  const view=render(<EngineeringEvidenceNavigator context={context} onOpenOwningRecord={vi.fn()}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  const list=screen.getByRole('group',{name:'Reported source references'});
  fireEvent.click(within(list).getByRole('button',{name:/REF-C1/}));
  const browser=view.container.querySelector('.engineering-visual-browser');
  expect(browser).toBeTruthy();
  expect(browser!.querySelector('.engineering-visual-results .engineering-evidence-list')).toBeTruthy();
  expect(browser!.querySelector('.engineering-evidence-detail')).toBeTruthy();
  expect(within(screen.getByRole('region',{name:'Selected evidence provenance'})).getByText('COR')).toBeTruthy();
 });
 it('preserves filtered source navigation and case working flow without approving records',()=>{
  const view=render(<EngineeringEvidenceNavigator context={context} onOpenOwningRecord={vi.fn()}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  fireEvent.click(screen.getByRole('button',{name:/INS 1/}));
  const group=screen.getByRole('group',{name:'Reported source references'});
  expect(within(group).queryByRole('button',{name:/REF-C1/})).toBeNull();
  const row=within(group).getByRole('button',{name:/REF-I1/});fireEvent.click(row);
  fireEvent.click(within(screen.getByRole('navigation',{name:'Source to case working path'})).getByRole('button',{name:/Draft a question/}));
  const editor=view.container.querySelector('section[aria-label="Case and review working area"]')!;
  expect(within(editor as HTMLElement).getByPlaceholderText(/Write a question/)).toBeTruthy();
 });
});
