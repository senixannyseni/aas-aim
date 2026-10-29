#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const script=read('scripts/release-validation.sh');
const reg=read('scripts/release-evidence.mjs');
const proof=read('apps/aim-next/scripts/browser-phase46-36-visual-proof.py');
const checker=read('apps/aim-next/scripts/verify-phase46-38-build-identity.py');
const identity=read('apps/aim-next/scripts/phase46_38_build_identity.py');
const tests=read('apps/aim-next/scripts/test_browser_phase46_38_build_identity.py');
let count=0;
const check=(condition,message)=>{assert(condition,message);count++};
for(const scriptName of [
  'apps/aim-next/scripts/phase46_38_build_identity.py',
  'apps/aim-next/scripts/verify-phase46-38-build-identity.py',
  'apps/aim-next/scripts/test_browser_phase46_38_build_identity.py'
]) check(fs.existsSync(path.join(root,scriptName)), `exists ${scriptName}`);
check(proof.includes('from phase46_38_build_identity import build_identity'),'proof imports build fingerprint');
check(proof.includes('build_sha, build_files = build_identity(dist)'),'proof snapshots dist prior to mount');
check(proof.includes('html != (dist / "index.html").read_text'),'proof compares served HTML to exact dist');
check(proof.includes('if build_identity(dist) != (build_sha, build_files):'),'proof detects build mutation during capture');
check(proof.includes("'buildSha256': build_sha"),'evidence includes digest');
check(proof.includes("'buildFileCount': build_files"),'evidence includes inventory count');
check(checker.includes('recorded != actual or count != actual_count'),'attestation rejects different build');
check(checker.includes("MOUNTED_REACT_APP"),'attestation insists on mounted proof');
check(checker.includes('syntheticScreenshot'),'attestation does not accept synthetic evidence');
check(checker.includes('engineeringApproval'),'attestation protects approval boundary');
check(identity.includes('followlinks=False'),'directory walker does not follow links');
check(identity.includes("is_symlink()"),'symlink rejection');
check(identity.includes('sorted(entries)'),'stable file ordering');
check(identity.includes('hashlib.sha256(body).digest()'),'content hashing');
check(identity.includes('len(name_bytes).to_bytes(8'),'unambiguous file names');
check(identity.includes('len(body).to_bytes(8'),'unambiguous body sizes');
for(const t of ['test_pass_current_dist','test_reject_modified_js','test_reject_added_chunk',
  'test_reject_symlinked_assets','test_reject_missing_identity','test_reject_synthetic_evidence'])
  check(tests.includes(t),'unit case '+t);
const sg='run_gate phase46_38_build_identity_contract node scripts/phase46-38-build-identity-contract.cjs';
const mg='run_gate mounted_chromium_build_identity python3 apps/aim-next/scripts/verify-phase46-38-build-identity.py';
check(script.includes(sg),'source gate included');
check(script.includes(mg),'mounted gate included');
check(reg.includes("'phase46_38_build_identity_contract'"),'source gate registered');
check(reg.includes("'mounted_chromium_build_identity'"),'mounted gate registered');
check(script.indexOf(mg)>script.indexOf('run_gate mounted_chromium_visual_attestation'),'build verifier follows image verifier');
check(script.indexOf(mg)<script.indexOf('run_gate phase46_10_release_integrity'),'integrity follows build verifier');
check(script.includes('run_gate vite_production_build'),'real Vite build still required');
check(script.includes('run_gate mounted_chromium_78x4_audit'),'real Chromium audit still required');
check(read('apps/aim-next/src/styles.css').includes('--bandha-v18-deep:#101b1d;'),'Bandha v1.8 token preserved');
check(read('apps/aim-next/src/styles.css').includes("font-family:'DM Sans'"),'font continuity');
console.log(`PASS Phase 46.38 bound mounted build identity ${count}/${count}`);
