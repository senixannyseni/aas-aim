// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringInvestigationCase} from './EngineeringInvestigationCase';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
afterEach(cleanup);
const item:EngineeringEvidence={key:'COR:trace:CX:1',domain:'COR',kind:'Calculation trace',ownerRecordId:'CX',
  sourceRecordId:'SYN-1',reference:'DEMO-SYNTHETIC',supportingReference:null,revision:'r1',
  reportedAt:'2026-10-29T00:00:00Z',status:'DRAFT',authority:'SOURCE_REFERENCE'};
const coverage=[{domain:'COR' as const,state:'ready' as const,indexed:1,totalReported:1,truncated:false},
  {domain:'INS' as const,state:'disconnected' as const,indexed:0,totalReported:0,truncated:false}];
function mount(){return render(<EngineeringInvestigationCase assetId="SYNTHETIC-A1" entries={[item]} selected={item}
  sourceCoverage={coverage} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);}
function open(){fireEvent.click(screen.getByText('Temporary investigation case'));fireEvent.click(screen.getByText('Review preparation preview'));}
describe('Phase 46.20 mounted working material coverage',()=>{
  it('starts with not-entered labels but no readiness or approval controls',()=>{
    mount();open();const coveragePanel=screen.getByLabelText('Working material coverage');
    expect(within(coveragePanel).getAllByText('Not entered')).toHaveLength(4);
    expect(within(coveragePanel).getByText('Source limited')).toBeTruthy();
    expect(within(coveragePanel).queryByRole('button',{name:/approve|submit|certify|ready/i})).toBeNull();
  });
  it('reflects note updates without persisting or inventing source data',()=>{
    mount();open();fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
    fireEvent.change(screen.getByLabelText('Type'),{target:{value:'QUESTION'}});
    fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Is this reference current?'}});
    fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
    const panel=screen.getByLabelText('Working material coverage');
    expect(within(panel).getAllByText('Entered')).toHaveLength(2);
    expect(within(panel).getByText(/none is marked resolved/)).toBeTruthy();
    fireEvent.click(within(panel).getByText(/Discussion prompts/));
    expect(within(panel).getByText(/authorized reviewer/)).toBeTruthy();
  });
  it('reset on remount clears working-material context',()=>{
    const component=(key:string)=><EngineeringInvestigationCase key={key} assetId="SYNTHETIC-A1"
      entries={[item]} selected={item} sourceCoverage={coverage} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>;
    const root=render(component('scope1'));open();
    fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
    expect(within(screen.getByLabelText('Working material coverage')).getAllByText('Entered')).toHaveLength(1);
    root.rerender(component('scope2'));open();
    expect(within(screen.getByLabelText('Working material coverage')).queryByText(/1 current indexed pointer/)).toBeNull();
  });
});
