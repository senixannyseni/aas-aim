// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
afterEach(cleanup);
const cor:EngineeringEvidence={key:'K1',domain:'COR',kind:'Calculation trace',ownerRecordId:'C1',sourceRecordId:'SC1',reference:'REF-1',status:'REPORTED',revision:null,reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'};
const ctx:CrossDomainContext={asset:{id:'A1',tag:'V-101',name:'Synthetic asset',kind:'EQUIPMENT',state:'ACTIVE'},corrosion:{state:'ready',records:[]},inspection:{state:'disconnected',records:[]},evidence:{corrosion:{entries:[cor],total:1,truncated:false},inspection:{entries:[],total:0,truncated:false}}};
function mount(){const v=render(<EngineeringEvidenceNavigator context={ctx} onOpenOwningRecord={vi.fn()}/>);fireEvent.click(screen.getByText('Engineering evidence navigator'));return v;}
describe('Phase 46.30 consolidated investigation layout',()=>{
 it('maintains compatible All Sections trace and comparison controls',()=>{mount();fireEvent.click(screen.getByRole('button',{name:/Calculation trace REF-1/}));const tools=screen.getByLabelText('Advanced evidence analysis tools') as HTMLDetailsElement;expect(tools.open).toBe(true);expect(within(tools).getByRole('button',{name:'Use as comparison A'})).toBeTruthy();expect(screen.getByRole('button',{name:/View owning COR record context/})).toBeTruthy();});
 it('collapses advanced tools in focused evidence but retains an explicit open control',()=>{mount();fireEvent.click(screen.getByRole('button',{name:/Evidence explorer/}));fireEvent.click(screen.getByRole('button',{name:/Calculation trace REF-1/}));const tools=screen.getByLabelText('Advanced evidence analysis tools') as HTMLDetailsElement;expect(tools.open).toBe(false);fireEvent.click(within(tools).getByText(/Trace and compare references/));expect(tools.open).toBe(true);expect(within(tools).getByRole('button',{name:'Use as comparison A'})).toBeTruthy();});
 it('does not reset the selected source when switching to case to draft a question',()=>{mount();fireEvent.click(screen.getByRole('button',{name:/Calculation trace REF-1/}));const nav=screen.getByRole('navigation',{name:'Source to case working path'});fireEvent.click(within(nav).getByRole('button',{name:/Draft a question/}));expect(within(nav).getByText('REF-1')).toBeTruthy();expect(screen.getByText(/Record what needs to be checked with the owning source/)).toBeTruthy();});
});
