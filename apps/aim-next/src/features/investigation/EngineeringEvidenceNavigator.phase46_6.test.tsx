// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import {projectCrossDomainInvestigation} from './crossDomainInvestigationModel';
import {EMPTY_CORROSION} from '../corrosion/corrosionModel';
import {inspectionFixture} from '../inspection/inspectionFixtures.test-utils';

afterEach(cleanup);
function setup(){
  const input={
    navigationScopeKey:'NAV-1',crossDomainScopeKey:'NAV-1',assetScopeKey:'AIR-1',
    corrosionScopeKey:'COR-1',inspectionScopeKey:'INS-1',selectedAssetId:'A1',
    assetSnapshot:{assets:[{id:'A1',tag:'V-101',name:'Synthetic vessel',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]},
    corrosionSnapshot:{...EMPTY_CORROSION,
      loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'SYSTEM',basisReference:'LOOP-REF'}],
      circuits:[{id:'C1',loopId:'L1',code:'C-101',name:'Circuit',assetId:'A1',revision:'C-1',state:'ACTIVE'}],
      locations:Array.from({length:68},(_,i)=>({id:`LOC-${i+1}`,circuitId:'C1',tag:`TML-${i+1}`,componentReference:'shell',kind:'TML',sourceReference:`SOURCE-${i+1}`})),
    },
    inspectionSnapshot:inspectionFixture(),
  };
  const projection=projectCrossDomainInvestigation(input);
  if(projection.kind!=='ready') throw new Error('Synthetic scoped fixture must parse');
  const callback=vi.fn();
  render(<EngineeringEvidenceNavigator context={projection.context} onOpenOwningRecord={callback}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  return callback;
}
describe('Phase 46.6 bounded evidence browsing',()=>{
  it('reaches later COR references and returns to earlier pages with keyboard-reachable native controls',()=>{
    setup();
    fireEvent.click(screen.getByRole('button',{name:/^COR\s+69$/}));
    const pager=screen.getByRole('navigation',{name:'Evidence results pages'});
    expect(within(pager).getByRole('button',{name:'Previous references'}).hasAttribute('disabled')).toBe(true);
    expect(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/SOURCE-1\b/})).toBeTruthy();
    fireEvent.click(within(pager).getByRole('button',{name:'Next references'}));
    expect(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/SOURCE-31\b/})).toBeTruthy();
    expect(within(screen.getByRole('group',{name:'Reported source references'})).queryByRole('button',{name:/SOURCE-1\b/})).toBeNull();
    fireEvent.click(within(pager).getByRole('button',{name:'Next references'}));
    expect(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/SOURCE-68\b/})).toBeTruthy();
    expect(within(pager).getByRole('button',{name:'Next references'}).hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(pager).getByRole('button',{name:'Previous references'}));
    expect(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/SOURCE-31\b/})).toBeTruthy();
  });
  it('clears stale selection when moving pages and filtering independently scoped sources',()=>{
    const onOpen=setup();
    fireEvent.click(screen.getByRole('button',{name:/^COR\s+69$/}));
    fireEvent.click(within(screen.getByRole('group',{name:'Reported source references'})).getByRole('button',{name:/SOURCE-1\b/}));
    expect(screen.getByRole('region',{name:'Selected evidence provenance'})).toBeTruthy();
    const pager=screen.getByRole('navigation',{name:'Evidence results pages'});
    fireEvent.click(within(pager).getByRole('button',{name:'Next references'}));
    expect(screen.queryByRole('region',{name:'Selected evidence provenance'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:/^INS\s+/}));
    expect(screen.queryByRole('group',{name:'Reported source references'})).toBeNull();
    expect(screen.getByText(/No references available from the selected, authorized source scope/)).toBeTruthy();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
