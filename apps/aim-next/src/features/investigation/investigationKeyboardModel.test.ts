import {describe,expect,it} from 'vitest';
import {nextEvidenceFocusIndex,shouldReturnToEvidenceRow} from './investigationKeyboardModel';
describe('Phase 46.27 scoped keyboard movement',()=>{
 it('moves only through local page positions and clamps at boundaries',()=>{
  expect(nextEvidenceFocusIndex('ArrowDown',0,3)).toBe(1);
  expect(nextEvidenceFocusIndex('ArrowUp',2,3)).toBe(1);
  expect(nextEvidenceFocusIndex('Home',2,3)).toBe(0);
  expect(nextEvidenceFocusIndex('End',0,3)).toBe(2);
  expect(nextEvidenceFocusIndex('ArrowDown',2,3)).toBe(2);
  expect(nextEvidenceFocusIndex('ArrowUp',0,3)).toBe(0);
 });
 it('never commandeers writing, activation, empty indexes or invalid positions',()=>{
  for(const key of ['Enter',' ','Escape','a','Tab','Control'])expect(nextEvidenceFocusIndex(key,0,3)).toBeNull();
  expect(nextEvidenceFocusIndex('ArrowDown',0,0)).toBeNull();
  expect(nextEvidenceFocusIndex('Home',-1,3)).toBeNull();
  expect(nextEvidenceFocusIndex('End',3,3)).toBeNull();
  expect(nextEvidenceFocusIndex('End',0,Number.NaN)).toBeNull();
  expect(shouldReturnToEvidenceRow('Escape')).toBe(true);
  expect(shouldReturnToEvidenceRow('Enter')).toBe(false);
 });
});
