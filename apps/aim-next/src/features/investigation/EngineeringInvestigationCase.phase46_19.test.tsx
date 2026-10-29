// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringInvestigationCase} from './EngineeringInvestigationCase';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
afterEach(cleanup);
const item:EngineeringEvidence={key:'COR:calc:C1:S1',domain:'COR',kind:'Calculation trace',sourceRecordId:'S1',
  ownerRecordId:'C1',reference:'CALC-SYNTHETIC',supportingReference:null,revision:'r1',
  reportedAt:'2026-10-01T00:00:00Z',status:'DRAFT',authority:'SOURCE_REFERENCE'};
const coverage=[{domain:'COR' as const,state:'ready' as const,indexed:1,totalReported:2,truncated:true},
  {domain:'INS' as const,state:'disconnected' as const,indexed:0,totalReported:0,truncated:false}];
function mount(onInspect=vi.fn()){
  return render(<EngineeringInvestigationCase assetId="A1" entries={[item]} selected={item}
    sourceCoverage={coverage} onInspect={onInspect} onOpenOwningRecord={vi.fn()}/>);
}
function open(){fireEvent.click(screen.getByText('Temporary investigation case'));fireEvent.click(screen.getByText('Review preparation preview'));}
function note(kind:string,content:string,anchor=''){
  fireEvent.change(screen.getByLabelText('Type'),{target:{value:kind}});
  fireEvent.change(screen.getByLabelText(/Indexed reference \(optional\)/),{target:{value:anchor}});
  fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:content}});
  fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
}
describe('Phase 46.19 mounted review preparation preview',()=>{
  it('reflects current evidence, notes, source coverage and source navigation without approval actions',()=>{
    const onInspect=vi.fn();mount(onInspect);open();
    fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
    note('QUESTION','Does the basis match?',item.key);
    note('NEXT_STEP','Propose checking this', '');
    const preview=screen.getByLabelText('Read-only investigation review preparation');
    expect(within(preview).getByText('Does the basis match?')).toBeTruthy();
    expect(within(preview).getByText('Propose checking this')).toBeTruthy();
    expect(within(preview).getByText(/INS: disconnected/)).toBeTruthy();
    expect(within(preview).getByText(/index limited/)).toBeTruthy();
    const buttons=within(preview).getAllByRole('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]!);expect(onInspect).toHaveBeenCalledWith(item);
    expect(within(preview).queryByRole('button',{name:/approve|submit|export|save|sign/i})).toBeNull();
  });
  it('withdrawal hides anchored draft in preview and clear empties preview',()=>{
    const root=mount();open();
    fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
    note('QUESTION','Scope-specific question',item.key);
    root.rerender(<EngineeringInvestigationCase assetId="A1" entries={[]} selected={null}
      sourceCoverage={coverage} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);
    const preview=screen.getByLabelText('Read-only investigation review preparation');
    expect(within(preview).queryByText('Scope-specific question')).toBeNull();
    expect(within(preview).queryByText('CALC-SYNTHETIC')).toBeNull();
    expect(within(preview).getByText(/1 previously selected reference/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Clear temporary case'}));
    expect(within(preview).queryByText(/1 previously selected reference/)).toBeNull();
  });
  it('remount on scope change removes all temporary review context',()=>{
    const factory=(key:string)=><EngineeringInvestigationCase key={key} assetId="A1" entries={[item]} selected={item}
      sourceCoverage={coverage} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>;
    const root=render(factory('scope-1'));open();
    note('OBSERVATION','Ephemeral thought');
    expect(within(screen.getByLabelText('Read-only investigation review preparation')).getByText('Ephemeral thought')).toBeTruthy();
    root.rerender(factory('scope-2'));open();
    expect(screen.queryByText('Ephemeral thought')).toBeNull();
  });
});
