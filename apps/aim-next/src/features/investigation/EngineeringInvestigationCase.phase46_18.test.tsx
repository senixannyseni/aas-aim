// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringInvestigationCase} from './EngineeringInvestigationCase';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import {CrossDomainInvestigation} from './CrossDomainInvestigation';
import {EMPTY_CORROSION} from '../corrosion/corrosionModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import type {CrossDomainContext} from './crossDomainInvestigationModel';

afterEach(cleanup);
const e=(key:string):EngineeringEvidence=>({key,domain:'COR',kind:'Calculation trace',sourceRecordId:key,
  ownerRecordId:'C1',reference:`R-${key}`,supportingReference:null,revision:'rev1',reportedAt:null,status:'DRAFT',authority:'SOURCE_REFERENCE'});
const entries=[e('K1'),e('K2')];
const context:CrossDomainContext={
  asset:{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'},
  corrosion:{state:'ready',records:[]},inspection:{state:'disconnected',records:[]},
  evidence:{corrosion:{entries,total:2,truncated:false},inspection:{entries:[],total:0,truncated:false}},
};
const expand=(root:ReturnType<typeof render>)=>{
  fireEvent.click(within(root.container).getByText('Temporary investigation case'));
};
describe('Phase 46.18 mounted temporary investigation case',()=>{
  it('adds indexed reference, manually entered question and follows only owning callback',()=>{
    const onInspect=vi.fn();const onOpen=vi.fn();
    const root=render(<EngineeringInvestigationCase assetId="A1" entries={entries} selected={entries[0]!}
      onInspect={onInspect} onOpenOwningRecord={onOpen}/>);
    expand(root);
    fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
    expect(screen.getByText(/· R-K1/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Check source basis'}});
    fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
    expect(within(screen.getByLabelText('Working questions observations and next steps')).getByText('Check source basis')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('region',{name:'Working evidence references'})).getByRole('button',{name:'Inspect indexed source'}));
    expect(onInspect).toHaveBeenCalledWith(entries[0]);
    fireEvent.click(screen.getByRole('button',{name:'Open owning COR record'}));
    expect(onOpen).toHaveBeenCalledWith(entries[0]);
    fireEvent.click(screen.getByRole('button',{name:'Clear temporary case'}));
    expect(screen.queryByText('Check source basis')).toBeNull();
  });
  it('withdrawn source never exposes its reference or attached note in the projection',()=>{
    const root=render(<EngineeringInvestigationCase assetId="A1" entries={entries} selected={entries[0]!} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);
    expand(root);
    fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
    fireEvent.change(screen.getByLabelText(/Indexed reference \(optional\)/),{target:{value:'K1'}});
    fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Private attached thought'}});
    fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
    root.rerender(<EngineeringInvestigationCase assetId="A1" entries={[]} selected={null} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>);
    expect(screen.queryByText('R-K1')).toBeNull();
    expect(screen.queryByText('Private attached thought')).toBeNull();
    expect(screen.getByText(/1 saved reference\(s\) are unavailable/)).toBeTruthy();
  });
  it('navigation-scope keyed remount loses unsaved user text',()=>{
    const ui=(key:string)=> <EngineeringInvestigationCase key={key} assetId="A1" entries={entries} selected={entries[0]!} onInspect={vi.fn()} onOpenOwningRecord={vi.fn()}/>;
    const root=render(ui('scope-A'));expand(root);
    fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'not persisted'}});
    root.rerender(ui('scope-B'));
    expand(root);
    expect((screen.getByPlaceholderText(/Write a question/) as HTMLTextAreaElement).value).toBe('');
  });
  it('keeps notes across AIR/COR screen changes but resets on a source-scope rotation',()=>{
    const props={navigationScopeKey:'NAV-1',crossDomainScopeKey:'NAV-1',assetScopeKey:'AIR-1',
      corrosionScopeKey:'COR-1',selectedAssetId:'A1',
      assetSnapshot:{assets:[{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]},
      corrosionSnapshot:{...EMPTY_CORROSION,
        loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'SYS',basisReference:'BASIS'}],
        circuits:[{id:'C1',loopId:'L1',code:'C1',name:'Circuit',assetId:'A1',revision:'r1',state:'ACTIVE'}]},
    };
    const renderRail=(scope:string,domain:'AIR'|'COR')=><CrossDomainInvestigation key={scope}
      {...props} corrosionScopeKey={scope} activeDomain={domain} onNavigate={vi.fn()}/>;
    const root=render(renderRail('COR-1','AIR'));
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    fireEvent.click(screen.getByText('Temporary investigation case'));
    fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Working question before navigation'}});
    fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
    root.rerender(renderRail('COR-1','COR'));
    expect(within(screen.getByLabelText('Working questions observations and next steps')).getByText('Working question before navigation')).toBeTruthy();
    root.rerender(renderRail('COR-2','COR'));
    expect(screen.queryByText('Working question before navigation')).toBeNull();
  });
  it('navigator embeds the temporary case without a new route or backend fetch',()=>{
    render(<EngineeringEvidenceNavigator context={context} onOpenOwningRecord={vi.fn()}/>);
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    expect(screen.getByText('Temporary investigation case')).toBeTruthy();
  });
});
