// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import {CrossDomainInvestigation} from './CrossDomainInvestigation';
import {projectCrossDomainInvestigation} from './crossDomainInvestigationModel';
import {EMPTY_CORROSION} from '../corrosion/corrosionModel';
import {inspectionFixture} from '../inspection/inspectionFixtures.test-utils';

afterEach(cleanup);
const input=()=>({
  navigationScopeKey:'NAV',crossDomainScopeKey:'NAV',assetScopeKey:'AIR',
  corrosionScopeKey:'COR',inspectionScopeKey:'INS',selectedAssetId:'A1',
  assetSnapshot:{assets:[{id:'A1',tag:'V-101',name:'Synthetic vessel',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]},
  corrosionSnapshot:{...EMPTY_CORROSION,
    loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'SYSTEM',basisReference:'LOOP-BASIS'}],
    circuits:[{id:'C1',loopId:'L1',code:'C-101',name:'Circuit',assetId:'A1',revision:'C-1',state:'ACTIVE'}],
    locations:Array.from({length:65},(_,i)=>({id:`LOC-${i+1}`,circuitId:'C1',tag:`TML-${i+1}`,
      componentReference:'shell',kind:'TML',sourceReference:`SOURCE-${i+1}`})),
  },
  inspectionSnapshot:inspectionFixture(),
});
function setup(){
  const projected=projectCrossDomainInvestigation(input());
  if(projected.kind!=='ready')throw new Error('Expected an authorized fixture');
  const onOpen=vi.fn();
  const mounted=render(<EngineeringEvidenceNavigator context={projected.context} onOpenOwningRecord={onOpen}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  fireEvent.click(screen.getByRole('button',{name:/^COR\s+66$/}));
  return {mounted,projected,onOpen};
}
function select(ref:string){const sourceList=screen.getByRole('group',{name:'Reported source references'});fireEvent.click(within(sourceList).getByRole('button',{name:new RegExp(`\\b${ref}\\b`)}));}

describe('Phase 46.13: bounded comparison journey',()=>{
  it('compares two reported references across result pages, with source IDs and missing values visible',()=>{
    setup();
    select('SOURCE-1');
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison A'}));
    const pager=screen.getByRole('navigation',{name:'Evidence results pages'});
    fireEvent.click(within(pager).getByRole('button',{name:'Next references'}));
    select('SOURCE-31');
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison B'}));
    const comparison=screen.getByRole('region',{name:'Evidence reference comparison'});
    expect(within(comparison).getByRole('table',{name:/Reported source fields/})).toBeTruthy();
    expect(within(comparison).getByText('SOURCE-1')).toBeTruthy();
    expect(within(comparison).getByText('SOURCE-31')).toBeTruthy();
    expect(within(comparison).getAllByText('Different reported text').length).toBeGreaterThan(0);
    expect(within(comparison).getByText(/does not establish the same record/)).toBeTruthy();
  });
  it('clears comparison anchors when changing owning-domain filters',()=>{
    setup();select('SOURCE-1');
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison A'}));
    expect(screen.getByRole('region',{name:'Evidence reference comparison'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/^INS\s+/}));
    expect(screen.queryByRole('region',{name:'Evidence reference comparison'})).toBeNull();
  });
  it('prevents comparing the same reference to itself',()=>{
    setup();select('SOURCE-1');
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison A'}));
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison B'}));
    expect(screen.queryByRole('table',{name:/Reported source fields/})).toBeNull();
    expect(screen.getByText(/Choose two different indexed references/)).toBeTruthy();
  });
  it('never converts compared references into remote document links or approval controls',()=>{
    setup();select('SOURCE-1');
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison A'}));
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button',{name:/approve|download evidence/i})).toBeNull();
  });
  it('remounts comparison state on an independent authorized-source scope rotation',()=>{
    const go=vi.fn();
    const mounted=render(<CrossDomainInvestigation {...input()} activeDomain="AIR" onNavigate={go}/>);
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    fireEvent.click(screen.getByRole('button',{name:/^COR\s+66$/}));
    select('SOURCE-1');
    fireEvent.click(screen.getByRole('button',{name:'Use as comparison A'}));
    expect(screen.getByRole('region',{name:'Evidence reference comparison'})).toBeTruthy();
    mounted.rerender(<CrossDomainInvestigation {...input()} corrosionScopeKey="COR-ROTATED" activeDomain="AIR" onNavigate={go}/>);
    expect(screen.queryByRole('region',{name:'Evidence reference comparison'})).toBeNull();
    const navigator=screen.getByText('Engineering evidence navigator').closest('details')!;
    expect(navigator.hasAttribute('open')).toBe(false);
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    expect(screen.queryByRole('region',{name:'Evidence reference comparison'})).toBeNull();
  });
});
