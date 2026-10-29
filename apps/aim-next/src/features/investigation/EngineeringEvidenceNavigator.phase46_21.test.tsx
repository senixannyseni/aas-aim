// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {EngineeringEvidence} from './engineeringEvidenceModel';
import type {CrossDomainContext} from './crossDomainInvestigationModel';

afterEach(cleanup);
const record:EngineeringEvidence={key:'IDX1',domain:'COR',kind:'Calculation trace',sourceRecordId:'S1',ownerRecordId:'C1',reference:'BASIS-1',supportingReference:null,revision:'R1',reportedAt:null,status:'DRAFT',authority:'SOURCE_REFERENCE'};
const context:CrossDomainContext={
  asset:{id:'A1',tag:'V-101',name:'Synthetic vessel',kind:'EQUIPMENT',state:'ACTIVE'},
  corrosion:{state:'ready',records:[]},inspection:{state:'disconnected',records:[]},
  evidence:{corrosion:{entries:[record],total:1,truncated:false},inspection:{entries:[],total:0,truncated:false}},
};
function setup(){
  const view=render(<EngineeringEvidenceNavigator context={context} onOpenOwningRecord={vi.fn()}/>);
  fireEvent.click(screen.getByText('Engineering evidence navigator'));
  return view;
}
const panel=(view:ReturnType<typeof render>,name:string)=>view.container.querySelector(`section[aria-label="${name}"]`) as HTMLElement;
describe('Phase 46.21 mounted focus/navigation boundaries',()=>{
  it('retains legacy all-sections view until a user explicitly selects focus',()=>{
    const view=setup();
    expect(screen.getByRole('button',{name:/All sections/}).getAttribute('aria-pressed')).toBe('true');
    for(const name of ['Evidence explorer working area','Source observations working area','Case and review working area'])expect(panel(view,name).hidden).toBe(false);
  });
  it('focuses the case without unmounting the evidence explorer',()=>{
    const view=setup();
    fireEvent.click(screen.getByRole('button',{name:/Case & review/}));
    expect(panel(view,'Case and review working area').hidden).toBe(false);
    expect(panel(view,'Evidence explorer working area').hidden).toBe(true);
    expect(view.container.querySelector('.engineering-investigation-case')?.hasAttribute('open')).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:/Evidence explorer/}));
    expect(panel(view,'Case and review working area').hidden).toBe(true);
    expect(panel(view,'Evidence explorer working area').hidden).toBe(false);
  });
  it('keeps unsaved notes when switching task focus without changing authorization',()=>{
    const view=setup();
    fireEvent.click(screen.getByRole('button',{name:/Calculation trace BASIS-1/}));
    fireEvent.click(screen.getByRole('button',{name:/Case & review/}));
    fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
    fireEvent.change(screen.getByPlaceholderText(/Write a question/),{target:{value:'Check reported source revision'}});
    fireEvent.click(screen.getByRole('button',{name:'Add working note'}));
    fireEvent.click(screen.getByRole('button',{name:/Source observations/}));
    expect(panel(view,'Case and review working area').hidden).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:/Case & review/}));
    expect(within(screen.getByLabelText('Working questions observations and next steps')).getByText('Check reported source revision')).toBeTruthy();
  });
  it('reveals source navigation from a hidden case panel without expanding authorization',()=>{
    const view=setup();
    fireEvent.click(screen.getByRole('button',{name:/Calculation trace BASIS-1/}));
    fireEvent.click(screen.getByRole('button',{name:/Case & review/}));
    fireEvent.click(screen.getByRole('button',{name:'Add selected indexed reference to case'}));
    fireEvent.click(within(screen.getByRole('region',{name:'Working evidence references'})).getByRole('button',{name:'Inspect indexed source'}));
    expect(panel(view,'Evidence explorer working area').hidden).toBe(false);
    expect(panel(view,'Case and review working area').hidden).toBe(true);
    expect(screen.getByRole('heading',{name:/Source provenance/})).toBeTruthy();
  });
});
