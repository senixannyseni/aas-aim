// @vitest-environment jsdom
/**
 * Phase 46.36: mounted React component journey for authorized evidence → edit → review.
 * This is a real React/jsdom test (not a Vite browser screenshot); execution needs
 * the frozen project dependencies. Synthetic test records never grant approval.
 */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {EngineeringEvidenceNavigator} from './EngineeringEvidenceNavigator';
import type {CrossDomainContext} from './crossDomainInvestigationModel';
import type {EngineeringEvidence} from './engineeringEvidenceModel';

const source:EngineeringEvidence={key:'COR-36',domain:'COR',kind:'Calculation trace',ownerRecordId:'COR-S36',sourceRecordId:'SRC-S36',reference:'CALC-S36',status:'DRAFT',revision:'r1',reportedAt:null,supportingReference:null,authority:'SOURCE_REFERENCE'};
const context=(entries:EngineeringEvidence[]):CrossDomainContext=>({
 asset:{id:'ASSET-36',tag:'V-36',name:'Synthetic test vessel',kind:'EQUIPMENT',state:'ACTIVE'},
 corrosion:{state:'ready',records:[]},inspection:{state:'disconnected',records:[]},
 evidence:{corrosion:{entries,total:entries.length,truncated:false},inspection:{entries:[],total:0,truncated:false}},
});
afterEach(cleanup);
const mount=()=>{const view=render(<EngineeringEvidenceNavigator context={context([source])} onOpenOwningRecord={vi.fn()}/>);
 fireEvent.click(screen.getByText('Engineering evidence navigator'));return view;};

describe('Phase 46.36 mounted investigation workflow',()=>{
 it('keeps the source pointer while drafting, revising, and opening read-only review',()=>{
  const view=mount();
  const nav=screen.getByRole('navigation',{name:'Source to case working path'});
  expect((within(nav).getByRole('button',{name:'2 · Draft a question'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:/Calculation trace CALC-S36/}));
  fireEvent.click(within(nav).getByRole('button',{name:'2 · Draft a question'}));
  const casePanel=view.container.querySelector('section[aria-label="Case and review working area"]') as HTMLElement;
  expect(casePanel.hidden).toBe(false);
  expect(within(casePanel).getByText('Working references · 1/12')).toBeTruthy();
  const text=within(casePanel).getByPlaceholderText(/Write a question/) as HTMLTextAreaElement;
  fireEvent.change(text,{target:{value:'Confirm reported shell thickness'}});
  fireEvent.click(within(casePanel).getByRole('button',{name:'Add working note'}));
  expect(within(casePanel).getByText('Working notes · 1/18')).toBeTruthy();
  fireEvent.click(within(casePanel).getByRole('button',{name:'Edit working note 1'}));
  fireEvent.change(text,{target:{value:'Confirm reported shell thickness against COR source'}});
  fireEvent.click(within(casePanel).getByRole('button',{name:'Save draft changes'}));
  expect(within(casePanel).getByText('Working notes · 1/18')).toBeTruthy();
  expect(within(within(casePanel).getByLabelText('Working questions observations and next steps')).getByText('Confirm reported shell thickness against COR source')).toBeTruthy();
  fireEvent.click(within(nav).getByRole('button',{name:'3 · Review working material'}));
  const review=within(casePanel).getByLabelText('Read-only investigation review preparation') as HTMLDetailsElement;
  expect(review.open).toBe(true);
  expect(within(review).getByText('Confirm reported shell thickness against COR source')).toBeTruthy();
  expect(within(review).queryByRole('button',{name:/submit|approve|persist|sign off/i})).toBeNull();
 });
 it('hides withdrawn source-attached working material and disables the handoff',()=>{
  const view=mount();
  fireEvent.click(screen.getByRole('button',{name:/Calculation trace CALC-S36/}));
  fireEvent.click(within(screen.getByRole('navigation',{name:'Source to case working path'})).getByRole('button',{name:'2 · Draft a question'}));
  const panel=view.container.querySelector('section[aria-label="Case and review working area"]') as HTMLElement;
  fireEvent.change(within(panel).getByPlaceholderText(/Write a question/),{target:{value:'Linked source question'}});
  fireEvent.click(within(panel).getByRole('button',{name:'Add working note'}));
  view.rerender(<EngineeringEvidenceNavigator context={context([])} onOpenOwningRecord={vi.fn()}/>);
  expect(within(panel).queryByText('Linked source question')).toBeNull();
  expect((within(screen.getByRole('navigation',{name:'Source to case working path'})).getByRole('button',{name:'2 · Draft a question'}) as HTMLButtonElement).disabled).toBe(true);
 });
});
