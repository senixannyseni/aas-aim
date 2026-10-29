import {describe,expect,it} from 'vitest';
import {describeWorkingMaterial} from './evidenceReviewCoverage';
import type {ReviewPreparation} from './evidenceReviewPreparation';

const example:ReviewPreparation={assetId:'SYNTHETIC-A1',references:[],observations:[],questions:[],nextSteps:[],
  unlinkedNoteCount:0,withdrawnReferenceCount:0,sources:[],limitations:[]};
describe('Phase 46.20 descriptive working-material coverage',()=>{
  it('does not infer a readiness score or technical approval from an empty case',()=>{
    const result=describeWorkingMaterial(example);
    expect(result.items.map(i=>i.state)).toEqual(['NOT_ENTERED','NOT_ENTERED','NOT_ENTERED','NOT_ENTERED','SOURCE_LIMITED']);
    expect('score' in result).toBe(false);
    expect('ready' in result).toBe(false);
    expect('approved' in result).toBe(false);
    expect(result.prompts.join(' ')).toMatch(/outside this preview/);
  });
  it('distinguishes user-entered material and source connection limitations',()=>{
    const input:ReviewPreparation={...example,references:[{} as ReviewPreparation['references'][number]],
      questions:[{} as ReviewPreparation['questions'][number]],nextSteps:[{} as ReviewPreparation['nextSteps'][number]],
      unlinkedNoteCount:1,withdrawnReferenceCount:2,
      sources:[{domain:'COR',state:'ready',indexed:20,totalReported:25,truncated:true},
        {domain:'INS',state:'rejected',indexed:0,totalReported:0,truncated:false}]};
    const result=describeWorkingMaterial(input);
    expect(result.items[0]?.state).toBe('ENTERED');
    expect(result.items[2]?.state).toBe('ENTERED');
    expect(result.items[3]?.state).toBe('ENTERED');
    expect(result.items[4]?.state).toBe('SOURCE_LIMITED');
    expect(result.prompts.join(' ')).toMatch(/2 withdrawn/);
    expect(result.prompts.join(' ')).toMatch(/1 note/);
    expect(result.prompts.join(' ')).toMatch(/no resolution is recorded/);
  });
  it('a connected bounded source is not evidence completeness',()=>{
    const connected:ReviewPreparation={...example,sources:[{domain:'COR',state:'ready',indexed:2,totalReported:2,truncated:false},
      {domain:'INS',state:'ready',indexed:1,totalReported:1,truncated:false}]};
    const result=describeWorkingMaterial(connected);
    expect(result.items[4]?.state).toBe('ENTERED');
    expect(result.items[4]?.description).toMatch(/completeness is not certified/);
  });
});
