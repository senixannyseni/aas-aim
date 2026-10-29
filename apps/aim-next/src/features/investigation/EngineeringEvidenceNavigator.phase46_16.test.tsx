// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import {CrossDomainInvestigation} from './CrossDomainInvestigation';
import {projectCrossDomainInvestigation} from './crossDomainInvestigationModel';
import {EMPTY_CORROSION} from '../corrosion/corrosionModel';

const snapshot=()=>({
  navigationScopeKey:'NAV-1',crossDomainScopeKey:'NAV-1',assetScopeKey:'AIR-1',
  corrosionScopeKey:'COR-1',selectedAssetId:'A1',
  assetSnapshot:{assets:[{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]},
  corrosionSnapshot:{...EMPTY_CORROSION,
    loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'SYS',basisReference:'SHARED'}],
    circuits:[{id:'C1',loopId:'L1',code:'C-101',name:'Circuit',assetId:'A1',revision:'r1',state:'ACTIVE'}],
    calculations:[
      {id:'CAL1',circuitId:'C1',revision:'r1',status:'DRAFT',basisReference:'B1',inputReadingIds:[],traceReference:'TRACE',calculatedAt:'2026-01-01T00:00:00Z'},
      {id:'CAL2',circuitId:'C1',revision:'r2',status:'DRAFT',basisReference:'B2',inputReadingIds:[],traceReference:'TRACE',calculatedAt:'2026-02-01T00:00:00Z'},
    ]},
});
const mounted=()=>{
  const result=projectCrossDomainInvestigation(snapshot());
  if(result.kind!=='ready')throw new Error('Expected synthetic selected scope');
  const onOpen=vi.fn();
  render(<EngineeringEvidenceNavigator context={result.context} onOpenOwningRecord={onOpen}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  fireEvent.click(screen.getByText('Investigation summary'));
  return {onOpen};
};
afterEach(cleanup);
describe('Phase 46.16 engineering investigation overview',()=>{
  it('shows one bounded, explicitly non-authoritative summary',()=>{
    mounted();
    const summary=screen.getByLabelText('Selected asset investigation summary');
    expect(within(summary).getByText(/Counts describe the bounded/)).toBeTruthy();
    expect(within(summary).getByText(/No pattern here establishes a technical conflict/)).toBeTruthy();
    expect(within(summary).getByText(/one or more independent sources are unavailable or rejected/i)).toBeTruthy();
  });
  it('lets users open the owning record without a new API or approval control',()=>{
    const {onOpen}=mounted();
    const summary=screen.getByLabelText('Selected asset investigation summary');
    const open=within(summary).getAllByRole('button',{name:/View COR · C1/})[0];
    if(!open)throw new Error('Missing owning source');
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0].ownerRecordId).toBe('C1');
  });
  it('reflects comparison slots without establishing engineering equivalence',()=>{
    mounted();
    const summary=screen.getByLabelText('Selected asset investigation summary');
    expect(within(summary).getByText(/Comparison slots: 0 of 2/)).toBeTruthy();
    const sourceButton=screen.getAllByRole('button',{name:/TRACE/})[0];
    if(!sourceButton)throw new Error('Missing synthetic reference');
    fireEvent.click(sourceButton);
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison A'}));
    expect(within(summary).getByText(/Comparison slots: 1 of 2/)).toBeTruthy();
  });
  it('clears the overview after navigation scope withdrawal',()=>{
    const onNavigate=vi.fn();
    const v=render(<CrossDomainInvestigation {...snapshot()} activeDomain="AIR" onNavigate={onNavigate}/>);
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    fireEvent.click(screen.getByText('Investigation summary'));
    expect(screen.getByLabelText('Selected asset investigation summary')).toBeTruthy();
    v.rerender(<CrossDomainInvestigation {...snapshot()} navigationScopeKey="NEW" activeDomain="AIR" onNavigate={onNavigate}/>);
    expect(screen.queryByLabelText('Selected asset investigation summary')).toBeNull();
  });
});
