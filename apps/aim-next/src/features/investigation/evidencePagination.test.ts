import {describe,expect,it} from 'vitest';
import {EVIDENCE_PAGE_SIZE,paginateEvidence} from './evidencePagination';

describe('Phase 46.6 evidence pagination: accessible bounded browsing',()=>{
  const refs=Array.from({length:68},(_,i)=>`REF-${i+1}`);
  it('shows only the first bounded window initially',()=>{
    const page=paginateEvidence(refs,0);
    expect(EVIDENCE_PAGE_SIZE).toBe(30);
    expect(page.entries).toHaveLength(30);
    expect(page.first).toBe(1);
    expect(page.last).toBe(30);
    expect(page.pageCount).toBe(3);
    expect(page.hasPrevious).toBe(false);
    expect(page.hasNext).toBe(true);
  });
  it('reaches the middle and final references without losing order',()=>{
    const middle=paginateEvidence(refs,1);
    const last=paginateEvidence(refs,2);
    expect(middle.entries[0]).toBe('REF-31');
    expect(middle.last).toBe(60);
    expect(last.entries).toEqual(refs.slice(60));
    expect(last.first).toBe(61);
    expect(last.last).toBe(68);
    expect(last.hasNext).toBe(false);
    expect(last.hasPrevious).toBe(true);
  });
  it('clamps stale or invalid page state after a source or filter change',()=>{
    expect(paginateEvidence(refs.slice(0,7),2).pageIndex).toBe(0);
    expect(paginateEvidence(refs,-4).pageIndex).toBe(0);
    expect(paginateEvidence(refs,NaN).pageIndex).toBe(0);
    expect(paginateEvidence(refs,Infinity).pageIndex).toBe(0);
    expect(paginateEvidence(refs,1.5).pageIndex).toBe(0);
    expect(paginateEvidence(refs,999999).pageIndex).toBe(2);
  });
  it('does not invent a page or result when source is empty',()=>{
    const empty=paginateEvidence([],5);
    expect(empty.pageCount).toBe(0);
    expect(empty.entries).toEqual([]);
    expect(empty.first).toBe(0);
    expect(empty.last).toBe(0);
    expect(empty.hasNext).toBe(false);
  });
});
