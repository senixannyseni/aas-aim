// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import {CrossDomainInvestigation} from './CrossDomainInvestigation';
import {projectCrossDomainInvestigation} from './crossDomainInvestigationModel';
import {EMPTY_CORROSION} from '../corrosion/corrosionModel';
import {inspectionFixture} from '../inspection/inspectionFixtures.test-utils';

afterEach(cleanup);
const fixture=()=>({
  navigationScopeKey:'NAV-A',crossDomainScopeKey:'NAV-A',assetScopeKey:'AIR-A',
  corrosionScopeKey:'COR-A',inspectionScopeKey:'INS-A',selectedAssetId:'A1',
  assetSnapshot:{assets:[{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]},
  corrosionSnapshot:{...EMPTY_CORROSION,
    loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'SYS',basisReference:'BASIS-L'}],
    circuits:[{id:'C1',loopId:'L1',code:'C-101',name:'Circuit',assetId:'A1',revision:'r1',state:'ACTIVE'}],
    locations:[{id:'LOC1',circuitId:'C1',tag:'L1',componentReference:'shell',kind:'TML',sourceReference:'UNDATED-REF'}],
    calculations:[{id:'CAL1',circuitId:'C1',revision:'c1',status:'DRAFT',basisReference:'BASIS-OLD',inputReadingIds:[],traceReference:'OLD-CALC',calculatedAt:'2026-01-01T00:00:00Z'},
      {id:'CAL2',circuitId:'C1',revision:'c2',status:'DRAFT',basisReference:'BASIS-NEW',inputReadingIds:[],traceReference:'NEW-CALC',calculatedAt:'2026-02-01T00:00:00Z'}],
  },inspectionSnapshot:{...inspectionFixture(),requirements:inspectionFixture().requirements.map(x=>({...x,assetId:'A1'}))},
});
function setup(){
  const projected=projectCrossDomainInvestigation(fixture());
  if(projected.kind!=='ready')throw new Error('Expected authorized synthetic scope');
  const onOpen=vi.fn();
  render(<EngineeringEvidenceNavigator context={projected.context} onOpenOwningRecord={onOpen}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  return {onOpen};
}
describe('Phase 46.14: chronological evidence navigation',()=>{
  it('shows field coverage as an observation, not an engineering approval',()=>{
    setup();
    fireEvent.click(screen.getByText('Reported-time chronology & field coverage'));
    const area=screen.getByLabelText('Evidence chronology and field coverage');
    expect(within(area).getByText(/not an event history/)).toBeTruthy();
    expect(within(area).getByText(/No gap here proves a technical deficiency/)).toBeTruthy();
    expect(within(area).getByText('Revision not supplied')).toBeTruthy();
  });
  it('shows recent COR source times in descending order without mixing INS due targets',()=>{
    setup();
    fireEvent.click(screen.getByRole('button',{name:/^COR\s+\d+$/}));
    fireEvent.click(screen.getByRole('button',{name:/Reported source times · newest first/}));
    const list=screen.getByRole('group',{name:'Reported source references'});
    const labels=within(list).getAllByRole('button').map(x=>x.textContent??'');
    expect(labels[0]).toContain('NEW-CALC');
    expect(labels[1]).toContain('OLD-CALC');
    expect(labels.join(' ')).not.toContain('UNDATED-REF');
  });
  it('separates due-date targets from source timestamps and keeps raw reported dates',()=>{
    setup();
    fireEvent.click(screen.getByRole('button',{name:/Due targets · earliest first/}));
    const list=screen.getByRole('group',{name:'Reported source references'});
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(0);
    expect(within(list).queryByRole('button',{name:/NEW-CALC/})).toBeNull();
  });
  it('retains comparisons across date views but clears the visible record detail',()=>{
    setup();fireEvent.click(screen.getByRole('button',{name:/^COR\s+\d+$/}));
    fireEvent.click(screen.getByRole('button',{name:/NEW-CALC/}));
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison A'}));
    expect(screen.getByRole('region',{name:'Selected evidence provenance'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/Unplaced timestamps/}));
    expect(screen.queryByRole('region',{name:'Selected evidence provenance'})).toBeNull();
    expect(screen.getByRole('region',{name:'Evidence reference comparison'})).toBeTruthy();
  });
  it('removes chronology and compare context after trusted navigation-scope withdrawal',()=>{
    const onNavigate=vi.fn();
    const mounted=render(<CrossDomainInvestigation {...fixture()} activeDomain="AIR" onNavigate={onNavigate}/>);
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    fireEvent.click(screen.getByRole('button',{name:/^COR\s+\d+$/}));
    fireEvent.click(screen.getByRole('button',{name:/NEW-CALC/}));
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison A'}));
    mounted.rerender(<CrossDomainInvestigation {...fixture()} navigationScopeKey="CHANGED" activeDomain="AIR" onNavigate={onNavigate}/>);
    expect(screen.queryByLabelText('Shared engineering evidence navigator')).toBeNull();
    expect(screen.queryByRole('region',{name:'Evidence reference comparison'})).toBeNull();
  });
});
