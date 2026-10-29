// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import {projectCrossDomainInvestigation} from './crossDomainInvestigationModel';
import {EMPTY_CORROSION} from '../corrosion/corrosionModel';
import {inspectionFixture} from '../inspection/inspectionFixtures.test-utils';

afterEach(cleanup);
const input=()=>({
  navigationScopeKey:'NAV-A',crossDomainScopeKey:'NAV-A',assetScopeKey:'AIR-A',
  corrosionScopeKey:'COR-A',inspectionScopeKey:'INS-A',selectedAssetId:'A1',
  assetSnapshot:{assets:[{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]},
  corrosionSnapshot:{...EMPTY_CORROSION,
    loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'SYS',basisReference:'BASIS-L'}],
    circuits:[{id:'C1',loopId:'L1',code:'C-101',name:'Circuit',assetId:'A1',revision:'r1',state:'ACTIVE'}],
    calculations:[
      {id:'CAL1',circuitId:'C1',revision:'r1',status:'DRAFT',basisReference:'BASIS-1',inputReadingIds:[],traceReference:'SAME-TRACE',calculatedAt:'2026-01-01T00:00:00Z'},
      {id:'CAL2',circuitId:'C1',revision:'r2',status:'IN_REVIEW',basisReference:'BASIS-2',inputReadingIds:[],traceReference:'SAME-TRACE',calculatedAt:'2026-02-01T00:00:00Z'},
    ],
  },
  inspectionSnapshot:{...inspectionFixture(),requirements:inspectionFixture().requirements.map(x=>({...x,assetId:'A1'}))},
});
const ready=()=>{
  const v=projectCrossDomainInvestigation(input());
  if(v.kind!=='ready')throw new Error('Expected selected authorized asset');
  return v.context;
};
function setup(){
  const onOpen=vi.fn();
  render(<EngineeringEvidenceNavigator context={ready()} onOpenOwningRecord={onOpen}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  fireEvent.click(screen.getByText(/Reported reference consistency/));
  return {onOpen};
}
describe('Phase 46.15: bounded observational consistency UI',()=>{
  it('shows a revision and state variation without alleging an engineering conflict',()=>{
    setup();
    expect(screen.getByText(/Multiple reported revision texts/)).toBeTruthy();
    expect(screen.getByText(/Multiple reported state texts/)).toBeTruthy();
    expect(screen.getByText(/not conflicts proven by engineering review/)).toBeTruthy();
  });
  it('filters observations and opens only a supplied owning record',()=>{
    const {onOpen}=setup();
    fireEvent.click(screen.getByRole('button',{name:'Revision variations'}));
    const observations=screen.getByRole('list',{name:'Reported consistency observations'});
    expect(within(observations).getByText('Revision text variation')).toBeTruthy();
    expect(within(observations).queryByText('State text variation')).toBeNull();
    const button=within(observations).getAllByRole('button',{name:/View COR · C1/})[0];
    if(!button)throw new Error('Missing owning-record target');
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0].domain).toBe('COR');
    expect(onOpen.mock.calls[0]?.[0].ownerRecordId).toBe('C1');
  });
  it('shows no out-of-scope COR references on a rejected source',()=>{
    const v=projectCrossDomainInvestigation({...input(),corrosionSnapshot:{invalid:true}});
    if(v.kind!=='ready')throw new Error('Expected scope projection');
    render(<EngineeringEvidenceNavigator context={v.context} onOpenOwningRecord={vi.fn()}/>);
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    fireEvent.click(screen.getByText(/Reported reference consistency/));
    expect(screen.queryByText('SAME-TRACE')).toBeNull();
    expect(screen.getByText(/COR source rejected/)).toBeTruthy();
  });
});
