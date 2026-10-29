import {describe,expect,it} from 'vitest';
import {describeSourceOrigin,describeWorkingNoteOrigin} from './evidenceOriginPresentation';
describe('Phase 46.24 source and draft origin language',()=>{
 it('keeps COR and INS source origins distinct without inventing approvals',()=>{
  const cor=describeSourceOrigin({domain:'COR',authority:'SOURCE_REFERENCE'});
  const ins=describeSourceOrigin({domain:'INS',authority:'TECHNICAL_REVIEW'});
  expect(cor.label).toBe('COR · source-reported');
  expect(ins.label).toBe('INS · source-reported');
  expect(cor.authorityLabel).toBe('Reported source reference');
  expect(ins.authorityLabel).toBe('Reported technical review');
  expect(cor.explanatoryText).toContain('no INS governing date');
  expect(ins.explanatoryText).toContain('owning INS record');
 });
 it('does not turn a due target or governing report into an approval',()=>{
  expect(describeSourceOrigin({domain:'INS',authority:'DUE_CANDIDATE'}).authorityLabel).toBe('Reported due-date candidate');
  expect(describeSourceOrigin({domain:'INS',authority:'GOVERNING_INS_DECISION'}).authorityLabel).toBe('Owning-source governing due report');
 });
 it('always preserves authoring responsibility when a reference is attached',()=>{
  for(const domain of ['COR','INS'] as const){
   const note=describeWorkingNoteOrigin({domain});
   expect(note.label).toBe('Engineer-written draft');
   expect(note.attachmentLabel).toContain(domain);
   expect(note.attachmentLabel).toContain('not verified support');
  }
  expect(describeWorkingNoteOrigin(null).attachmentLabel).toBe('No indexed source attached');
 });
});
