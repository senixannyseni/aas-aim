#!/usr/bin/env node
/** Phase 46.10: check a live, complete gate trace against today's lockfile.
 * This is LOCAL release integrity, not cryptographic provenance or deployment approval.
 */
import {readFileSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {GATES,digestLockfile,verifyLockfileContinuity} from './release-evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tracePath = join(root,'qa','runtime','phase32-release-gates.json');
const lockfilePath = join(root,'pnpm-lock.yaml');
const gate = 'phase46_10_release_integrity';

export function verifyReleaseTrace(trace, actualDigest) {
  if (!trace || typeof trace !== 'object' || trace.status !== 'IN_PROGRESS') {
    throw new Error('No in-progress runtime validation trace');
  }
  if (trace.currentGate !== gate) throw new Error('Integrity gate was not entered by release runner');
  const index=GATES.indexOf(gate);
  if (index !== GATES.length-1 || index < 1) throw new Error('Integrity check must be final gate');
  if (!Array.isArray(trace.expectedGates) ||
      trace.expectedGates.length !== GATES.length ||
      trace.expectedGates.some((name,i) => name !== GATES[i])) {
    throw new Error('Trace expected gates differ from the actual release sequence');
  }
  if (!Array.isArray(trace.passedGates) || trace.passedGates.length !== index ||
      trace.passedGates.some((name,i) => name !== GATES[i])) {
    throw new Error('Earlier runtime gates were not all recorded in their exact order');
  }
  if (trace.failedGate !== null || trace.failureExitCode !== null) {
    throw new Error('An earlier runtime gate was recorded failed');
  }
  if (trace.mountedAppBrowserAudit !== 'PASSED') {
    throw new Error('Mounted Chromium audit was not recorded as passed');
  }
  if (trace.releaseApproved !== false || trace.humanLockfileReview !== 'NOT_VERIFIED') {
    throw new Error('Runtime evidence must not claim production or lockfile approval');
  }
  verifyLockfileContinuity(trace.source?.lockfileSha256,actualDigest);
  return {passedBeforeIntegrity:index,lockfileSha256:actualDigest};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const evidence=JSON.parse(readFileSync(tracePath,'utf8'));
    const actual=verifyReleaseTrace(evidence,digestLockfile(lockfilePath));
    console.log(`PASS Phase 46.10: ${actual.passedBeforeIntegrity} preceding gates recorded, frozen lockfile unchanged (${actual.lockfileSha256}), no release approval implied.`);
  } catch(error) {
    console.error(`FAIL Phase 46.10 release continuity: ${error.message}`);
    process.exitCode=1;
  }
}
