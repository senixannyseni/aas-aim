#!/usr/bin/env node
/**
 * Phase 25 — honest, non-authoritative lockfile review inventory.
 * NEVER certifies dependency safety, completeness of tests, or human review.
 * Used after pnpm resolves real registry metadata on an authorized CI runner.
 */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = input => createHash("sha256").update(input).digest("hex");
function requireExactVersion(name, version) {
  // The platform package is a local pnpm workspace link, not a registry semver.
  // No other package may use a floating or workspace specifier here.
  if (name === "@bandha/aim-platform" && version === "workspace:*") return;
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Non-exact dependency pin: ${name}=${version}`);
  }
}
export function makeCandidateReport({ lockfile, aimManifest, webManifest, nodeVersion, pnpmVersion, gateStatus = "NOT_EXECUTED" }) {
  if (!Buffer.isBuffer(lockfile) || !lockfile.length) throw new Error("Real nonempty pnpm-lock.yaml required; never fabricate one");
  // pnpm may emit leading YAML comments or multiple YAML documents.
  // Require consistent, top-level lockfileVersion declarations rather than a first-byte match.
  const lockfileText = lockfile.toString("utf8").replace(/^\uFEFF/, "");
  const versions = [...lockfileText.matchAll(/^lockfileVersion:[ \t]*(?:"(\d+(?:\.\d+)?)"|'(\d+(?:\.\d+)?)'|(\d+(?:\.\d+)?))[ \t\r]*$/gm)]
    .map(match => match[1] ?? match[2] ?? match[3]);
  if (versions.length === 0 || new Set(versions).size !== 1) {
    throw new Error("File must contain consistent top-level pnpm lockfileVersion declarations");
  }
  const manifests = [aimManifest, webManifest];
  const dependencies = manifests.map(pkg => ({
    workspace: pkg.name,
    packageManager: pkg.packageManager,
    dependencies: Object.fromEntries(Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).sort(([a], [b]) => a.localeCompare(b)))
  }));
  const a = dependencies[0].dependencies, b = dependencies[1].dependencies;
  for (const pkg of dependencies) {
    if (pkg.packageManager !== "pnpm@12.14.0") throw new Error(`Unexpected package manager pin: ${pkg.workspace}`);
    for (const [name, version] of Object.entries(pkg.dependencies)) requireExactVersion(name, version);
  }
  for (const name of Object.keys(a).filter(name => name in b)) if (a[name] !== b[name]) throw new Error(`Conflicting direct dependency pins: ${name}`);
  if (!["PASS", "FAIL", "NOT_EXECUTED"].includes(gateStatus)) throw new Error(`Invalid candidate gate status: ${gateStatus}`);
  return {
    phase: 25,
    status: "CANDIDATE_AWAITING_HUMAN_REVIEW",
    productionValidated: false,
    // Candidate gate can exercise the full release validation script, but the
    // candidate lockfile still lacks explicit human review and commit provenance.
    candidateRuntimeGates: gateStatus,
    lockfile: { path: "pnpm-lock.yaml", bytes: lockfile.length, sha256: sha256(lockfile) },
    environment: { nodeVersion, pnpmVersion },
    directDependencyPins: dependencies,
    reviewerChecklist: [
      "Inspect generated lockfile entries and unexpected transitive dependency changes",
      "Review registry provenance, licenses, notices and available security advisories",
      "Verify the CI job log and do not infer a pass from the presence of an artifact",
      "Require reviewed lockfile to be committed through the normal code-review process",
      "Execute strict frozen install, real TypeScript, Vitest, Vite and mounted 78-route Chromium audit on the final reviewed commit"
    ],
    limitation: "This report does not certify signatures, transitive safety, human review, WCAG, or production engineering integrations."
  };
}
export function formatReviewMarkdown(report) {
  return `# AAS–AIM Phase 25 — Generated dependency lockfile candidate\n\n` +
    `**STATUS: UNREVIEWED. DO NOT TREAT AS RELEASE APPROVAL.**\n\n` +
    `- SHA-256: \`${report.lockfile.sha256}\`\n` +
    `- Bytes: ${report.lockfile.bytes}\n` +
    `- Candidate runtime gates (including mounted Chromium): **${report.candidateRuntimeGates}**\n` +
    `- Runtime: Node ${report.environment.nodeVersion}, pnpm ${report.environment.pnpmVersion}\n` +
    `- Mounted 78-screen browser tests: **${report.candidateRuntimeGates === "PASS" ? "INCLUDED IN PASSING CANDIDATE GATE" : "NOT VERIFIED"}**\n` +
    `- Human lockfile review: **NOT VERIFIED**\n\n## Required review\n\n` +
    report.reviewerChecklist.map((item, i) => `${i + 1}. ${item}`).join("\n") +
    `\n\n## Limitations\n\n${report.limitation}\n`;
}
function main() {
  const root = defaultRoot;
  const lockfile = readFileSync(join(root, "pnpm-lock.yaml"));
  const aimManifest = JSON.parse(readFileSync(join(root, "apps/aim-next/package.json"), "utf8"));
  const webManifest = JSON.parse(readFileSync(join(root, "apps/web/package.json"), "utf8"));
  const gateStatus = process.env.AIM_CANDIDATE_GATE_STATUS ?? "NOT_EXECUTED";
  const report = makeCandidateReport({ lockfile, aimManifest, webManifest, nodeVersion: process.version, pnpmVersion: process.env.AIM_PNPM_VERSION ?? "UNRECORDED", gateStatus });
  const qa = join(root, "qa");
  mkdirSync(qa, {recursive: true});
  writeFileSync(join(qa, "phase25-lockfile-candidate.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(qa, "phase25-lockfile-candidate.md"), formatReviewMarkdown(report));
  console.log(`LOCKFILE CANDIDATE ONLY: SHA-256 ${report.lockfile.sha256}; ${gateStatus}; human review required`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
