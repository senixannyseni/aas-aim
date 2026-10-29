import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {GATES,digestLockfile,initialEvidence,transition,verifyLockfileContinuity} from './release-evidence.mjs';
import {verifyReleaseTrace} from './phase46-10-integrity-gate.mjs';

const sha='a'.repeat(64);
function ready(){
  let report=initialEvidence({nodeVersion:'v26.12.1',lockfileSha256:sha,commitSha:null,startedAt:'2026-10-29T00:00:00Z'});
  for(const gate of GATES.slice(0,-1)){
    report=transition(report,'enter',gate);
    report=transition(report,'pass',gate);
  }
  return transition(report,'enter',GATES.at(-1));
}

test('accepts complete ordered trace while refusing to call it production approval',()=>{
  const result=verifyReleaseTrace(ready(),sha);
  assert.equal(result.passedBeforeIntegrity, GATES.length-1);
  assert.equal(result.lockfileSha256,sha);
});
test('rejects a stale or missing lockfile, not merely a missing trace hash',()=>{
  assert.throws(()=>verifyLockfileContinuity(sha,'b'.repeat(64)),/changed/);
  assert.throws(()=>verifyReleaseTrace(ready(),null),/missing/);
  assert.throws(()=>verifyLockfileContinuity(null,sha),/starting/);
});
test('recomputes SHA256 from the actual lockfile bytes',()=>{
  const dir=mkdtempSync(join(tmpdir(),'aim-integrity-'));
  try {
    const file=join(dir,'pnpm-lock.yaml');
    writeFileSync(file,'lockfileVersion: 9.0\n');
    const first=digestLockfile(file);
    writeFileSync(file,'lockfileVersion: 9.0\n# changed\n');
    assert.throws(()=>verifyLockfileContinuity(first,digestLockfile(file)),/changed/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
test('rejects a skipped or reordered previous gate',()=>{
  const t=ready();
  assert.throws(()=>verifyReleaseTrace({...t,passedGates:t.passedGates.slice(1)},sha),/not all recorded/);
  const swapped=[...t.passedGates]; [swapped[0],swapped[1]]=[swapped[1],swapped[0]];
  assert.throws(()=>verifyReleaseTrace({...t,passedGates:swapped},sha),/not all recorded/);
  assert.throws(()=>verifyReleaseTrace({...t,expectedGates:t.expectedGates.slice(1)},sha),/expected gates/);
});
test('rejects tampered success markers, unentered gate and failed trace',()=>{
  const t=ready();
  assert.throws(()=>verifyReleaseTrace({...t,currentGate:null},sha),/not entered/);
  assert.throws(()=>verifyReleaseTrace({...t,status:'FAILED'},sha),/in-progress/);
  assert.throws(()=>verifyReleaseTrace({...t,mountedAppBrowserAudit:'NOT_EXECUTED'},sha),/Chromium/);
  assert.throws(()=>verifyReleaseTrace({...t,releaseApproved:true},sha),/approval/);
  assert.throws(()=>verifyReleaseTrace({...t,humanLockfileReview:'VERIFIED'},sha),/approval/);
});
