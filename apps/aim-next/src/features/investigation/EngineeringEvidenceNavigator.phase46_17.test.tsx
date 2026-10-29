// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import {CrossDomainInvestigation} from './CrossDomainInvestigation';
import {projectCrossDomainInvestigation,type CrossDomainContext} from './crossDomainInvestigationModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import {EMPTY_CORROSION} from '../corrosion/corrosionModel';

afterEach(cleanup);
const source=(key:string,reference:string,sourceRecordId=key,supportingReference:string|null=null):EngineeringEvidence=>({
  key,domain:'COR',kind:'Calculation trace',sourceRecordId,ownerRecordId:'C1',
  reference,supportingReference,revision:'r1',reportedAt:'2026-03-01T12:00:00Z',
  status:'DRAFT',authority:'SOURCE_REFERENCE',
});
const sourceEntries:EngineeringEvidence[]=[
  source('ROOT','REPORT','CAL', 'BASIS'),
  ...Array.from({length:36},(_,i)=>source(`B${i}`,`OTHER-${i}`)),
  source('MATCH','BASIS'),
  source('SAME-SOURCE','SHARED','CAL'),
  source('INCOMING','SUPPORTS-REPORT','INCOMING','REPORT'),
];
const context:CrossDomainContext={
  asset:{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'},
  corrosion:{state:'ready',records:[]},inspection:{state:'disconnected',records:[]},
  evidence:{corrosion:{entries:sourceEntries,total:sourceEntries.length,truncated:false},inspection:{entries:[],total:0,truncated:false}},
};
const open=()=>{
  const onOpen=vi.fn();
  const result=render(<EngineeringEvidenceNavigator context={context} onOpenOwningRecord={onOpen}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  fireEvent.click(screen.getByRole('button',{name:/Calculation trace REPORT/}));
  return {onOpen,result};
};
describe('Phase 46.17 mounted trace interactions',()=>{
  it('shows owner-only, bounded trace groups without external links',()=>{
    open();
    const trace=screen.getByRole('region',{name:'Selected evidence trace navigation'});
    expect(within(trace).getByText(/not verified relationships/)).toBeTruthy();
    expect(within(trace).getByRole('button',{name:/Inspect Calculation trace · MATCH · BASIS/})).toBeTruthy();
    expect(within(trace).getByRole('button',{name:/Inspect Calculation trace · CAL · SHARED/})).toBeTruthy();
    expect(within(trace).getByRole('button',{name:/Inspect Calculation trace · INCOMING · SUPPORTS-REPORT/})).toBeTruthy();
    expect(within(trace).queryByRole('link')).toBeNull();
  });
  it('moves to a reference on a later page while preserving the owning record callback',()=>{
    const {onOpen}=open();
    const trace=screen.getByRole('region',{name:'Selected evidence trace navigation'});
    fireEvent.click(within(trace).getByRole('button',{name:/Inspect Calculation trace · MATCH · BASIS/}));
    const provenance=screen.getByRole('region',{name:'Selected evidence provenance'});
    expect(within(within(provenance).getByRole('region',{name:'Primary reported source facts'})).getByText('BASIS')).toBeTruthy();
    expect(within(provenance).getByText('MATCH')).toBeTruthy();
    expect(screen.getByText(/page 2 of 2/i)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading',{name:/Source provenance/}));
    fireEvent.click(within(provenance).getByRole('button',{name:/View owning COR record context/}));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
  it('never exposes stale INS index entries when its source is disconnected',()=>{
    render(<EngineeringEvidenceNavigator context={{...context,evidence:{...context.evidence,
      inspection:{entries:[{...source('PRIVATE','HIDDEN'),domain:'INS'}],total:1,truncated:false}}}} onOpenOwningRecord={vi.fn()}/>);
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    expect(screen.queryByText('HIDDEN')).toBeNull();
    expect(screen.getByText(/40 reported reference\(s\)/)).toBeTruthy();
  });
  it('rotates trace state when the selected source scope changes',()=>{
    const data={navigationScopeKey:'NAV',crossDomainScopeKey:'NAV',assetScopeKey:'AIR',corrosionScopeKey:'COR',selectedAssetId:'A1',
      assetSnapshot:{assets:[{id:'A1',tag:'V-101',name:'Synthetic',kind:'EQUIPMENT',state:'ACTIVE'}],relationships:[],history:[]},
      corrosionSnapshot:{...EMPTY_CORROSION,loops:[{id:'L1',assetId:'A1',name:'Loop',systemReference:'SYS',basisReference:'BASIS'}],
        circuits:[{id:'C1',loopId:'L1',code:'C1',name:'Circuit',assetId:'A1',revision:'r1',state:'ACTIVE'}]},
    };
    expect(projectCrossDomainInvestigation(data).kind).toBe('ready');
    const result=render(<CrossDomainInvestigation {...data} activeDomain="AIR" onNavigate={vi.fn()}/>);
    fireEvent.click(screen.getByText('Engineering evidence navigator'));
    fireEvent.click(screen.getByRole('button',{name:/BASIS/}));
    expect(screen.getByRole('region',{name:'Selected evidence trace navigation'})).toBeTruthy();
    result.rerender(<CrossDomainInvestigation {...data} corrosionScopeKey="COR-NEW" activeDomain="AIR" onNavigate={vi.fn()}/>);
    expect(screen.queryByRole('region',{name:'Selected evidence trace navigation'})).toBeNull();
  });
});
