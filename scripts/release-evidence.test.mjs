import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GATES,initialEvidence,transition,beginEvidenceRun} from './release-evidence.mjs';
const begin=()=>initialEvidence({nodeVersion:'v24.0.0',lockfileSha256:'a'.repeat(64),commitSha:null,startedAt:'2026-10-28T00:00:00.000Z'});

test('the trace never labels an unexecuted browser audit passed',()=>{
  const trace=transition(transition(begin(),'enter',GATES[0]),'pass',GATES[0]);
  assert.equal(trace.mountedAppBrowserAudit,'NOT_EXECUTED');
  assert.equal(trace.releaseApproved,false);
  assert.equal(trace.humanLockfileReview,'NOT_VERIFIED');
});
test('gates must be entered and passed in exact order',()=>{
  assert.throws(()=>transition(begin(),'pass',GATES[0]),/not running/);
  assert.throws(()=>transition(begin(),'enter',GATES[1]),/Expected next gate/);
  assert.throws(()=>transition(transition(begin(),'enter',GATES[0]),'enter',GATES[1]),/another gate/);
});
test('nonzero gate exit records a failure and prevents completion',()=>{
  const trace=transition(transition(begin(),'enter',GATES[0]),'fail',GATES[0],2);
  assert.equal(trace.failedGate,GATES[0]);
  assert.equal(trace.failureExitCode,2);
  assert.equal(trace.status,'FAILED');
  assert.throws(()=>transition(trace,'complete'),/incomplete/);
  assert.equal(trace.mountedAppBrowserAudit,'NOT_EXECUTED');
});
test('completed traced runtime gates still require review, not auto-approval',()=>{
  let trace=begin();
  for(const gate of GATES) {trace=transition(trace,'enter',gate);trace=transition(trace,'pass',gate);}
  trace=transition(trace,'complete');
  assert.equal(trace.status,'RUNTIME_GATES_PASSED_AWAITING_REVIEW');
  assert.equal(trace.mountedAppBrowserAudit,'PASSED');
  assert.equal(trace.releaseApproved,false);
  assert.equal(trace.humanLockfileReview,'NOT_VERIFIED');
});
test('completion requires actual lockfile hash evidence',()=>{
  const initial={...begin(),source:{...begin().source,lockfileSha256:null}};
  let trace=initial;
  for(const gate of GATES){trace=transition(trace,'enter',gate);trace=transition(trace,'pass',gate);}
  assert.throws(()=>transition(trace,'complete'),/lockfile/);
});

test('a fresh run replaces stale previously successful evidence',()=>{
  const temp=mkdtempSync(join(tmpdir(),'aim-trace-'));
  try {
    const file=join(temp,'release.json');
    writeFileSync(file,JSON.stringify({status:'RUNTIME_GATES_PASSED_AWAITING_REVIEW',phase:31}));
    beginEvidenceRun(file,begin(),(report,destination)=>writeFileSync(destination,JSON.stringify(report)));
    const actual=JSON.parse(readFileSync(file,'utf8'));
    assert.equal(actual.status,'IN_PROGRESS');
    assert.equal(actual.phase,32);
    assert.equal(actual.mountedAppBrowserAudit,'NOT_EXECUTED');
  } finally {rmSync(temp,{recursive:true,force:true});}
});
test('failed trace initialization cannot leave a stale success visible',()=>{
  const temp=mkdtempSync(join(tmpdir(),'aim-trace-fail-'));
  try {
    const file=join(temp,'release.json');
    writeFileSync(file,JSON.stringify({status:'RUNTIME_GATES_PASSED_AWAITING_REVIEW'}));
    assert.throws(()=>beginEvidenceRun(file,begin(),()=>{throw new Error('disk write failure');}),/disk write failure/);
    assert.equal(existsSync(file),false);
  } finally {rmSync(temp,{recursive:true,force:true});}
});
test('actual atomic report writer stores a new in-progress run without stale outcome',()=>{
  const temp=mkdtempSync(join(tmpdir(),'aim-atomic-trace-'));
  try {
    const file=join(temp,'release.json');
    writeFileSync(file,JSON.stringify({status:'RUNTIME_GATES_PASSED_AWAITING_REVIEW'}));
    beginEvidenceRun(file,begin());
    assert.equal(JSON.parse(readFileSync(file,'utf8')).status,'IN_PROGRESS');
    assert.equal(existsSync(file+'.tmp'),false);
  } finally {rmSync(temp,{recursive:true,force:true});}
});
test('CI references an ignored, newly generated runtime trace rather than committed historical evidence',()=>{
  const root=new URL('../',import.meta.url);
  const relative=path=>readFileSync(new URL(path,root),'utf8');
  assert.match(relative('.gitignore'),/^qa\/runtime\/$/m);
  for(const file of ['.github/workflows/aim-next-ui.yml','.github/workflows/aim-next-lockfile-candidate.yml']){
    assert.match(relative(file),/qa\/runtime\/phase32-release-gates\.json/);
  }
  assert.match(relative('scripts/release-validation.sh'),/qa\/runtime\/phase32-release-gates\.json/);
});

test('the release script and evidence recorder define exactly the same ordered gate sequence',()=>{
  const source=readFileSync(new URL('./release-validation.sh',import.meta.url),'utf8');
  const declared=[...source.matchAll(/^run_gate\s+([a-zA-Z0-9_]+)\s+/gm)].map(m=>m[1]);
  assert.equal(new Set(declared).size,declared.length,'no duplicate gate names');
  assert.deepEqual(declared,[...GATES],'a new CI gate must be added to release evidence before landing');
  assert.ok(GATES.includes('phase46_1_asset_contract'));
  assert.ok(GATES.includes('phase46_2_platform_exports'));
  assert.ok(GATES.includes('phase46_3_source_graph'));
  assert.ok(GATES.includes('phase46_4_source_boundary'));
  assert.ok(GATES.includes('phase46_5_evidence_boundary'));
  assert.ok(GATES.includes('phase46_6_ui_contract'));
  assert.ok(GATES.includes('phase46_7_lazy_boundary'));
  assert.ok(GATES.includes('phase46_8_navigation_boundary'));
  assert.ok(GATES.includes('phase46_9_integrated_models'));
  assert.ok(GATES.includes('phase46_11_workspace_discovery'));
  assert.ok(GATES.includes('phase46_12_workflow_guidance'));
  assert.ok(GATES.includes('phase46_13_evidence_comparison'));
  assert.ok(GATES.includes('phase46_14_evidence_chronology'));
  assert.ok(GATES.includes('phase46_15_evidence_consistency'));
  assert.ok(GATES.includes('mounted_chromium_navigation_journey'));
  assert.ok(GATES.includes('phase46_7_entry_graph'));
  assert.ok(GATES.includes('mounted_chromium_lazy_chunks'));
  assert.equal(GATES.at(-1),'phase46_10_release_integrity');
  assert.ok(GATES.includes('foundation_vitest_suite'));
  assert.ok(GATES.includes('foundation_build'));
});
