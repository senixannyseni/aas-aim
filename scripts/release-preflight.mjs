#!/usr/bin/env node
/** Phase 25: non-mutating release prerequisites, not a replacement for runtime tests. */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");
const json = process.argv.includes("--json");
const checks = [];
function check(name, ok, detail) { checks.push({ name, passed: Boolean(ok), detail }); }
const major = Number(process.versions.node.split(".")[0]);
check("Node.js release runtime", major >= 24 && major < 27, `installed ${process.version}; required >=24 <27`);
const pnpm = spawnSync("pnpm", ["--version"], { encoding: "utf8", timeout: 5000 });
const pnpmVersion = pnpm.status === 0 ? pnpm.stdout.trim() : null;
const requiredPnpm = "12.14.0";
check("pnpm release runtime", pnpmVersion === requiredPnpm, `installed ${pnpmVersion ?? "not available"}; required ${requiredPnpm}`);
check("Workspace lockfile exists (manual review still required)", existsSync(join(root, "pnpm-lock.yaml")), "pnpm-lock.yaml is mandatory for frozen resolution; never fabricate it offline");
const rootManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
check("Root package manager pin", rootManifest.private === true && rootManifest.packageManager === `pnpm@${requiredPnpm}`, "workspace root must be private and pin exactly the same pnpm version as its projects");
check("Root engine policy", rootManifest.engines?.node === ">=24 <27" && rootManifest.engines?.pnpm === ">=12 <13", "workspace root must enforce the same Node and pnpm engine bounds");
const manifestVersions = new Map();
for (const app of ["aim-next", "web"]) {
  const file = join(root, "apps", app, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  const declared = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies });
  manifestVersions.set(app, Object.fromEntries(declared));
  check(`${app} pnpm manager pin`, pkg.packageManager === `pnpm@${requiredPnpm}`, `declared ${pkg.packageManager ?? "missing"}`);
  const notExact = declared.filter(([name, version]) =>
    !(name === '@bandha/aim-platform' && version === 'workspace:*') &&
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version));
  check(`${app} dependency pins`, notExact.length === 0, `${declared.length} declared dependencies; ${notExact.length} non-exact versions`);
  check(`${app} engine policy`, pkg.engines?.node === ">=24 <27" && pkg.engines?.pnpm === ">=12 <13", `Node ${pkg.engines?.node ?? "?"}; pnpm ${pkg.engines?.pnpm ?? "?"}`);
}
const a = manifestVersions.get("aim-next") ?? {};
const b = manifestVersions.get("web") ?? {};
const collisions = Object.keys(a).filter(name => name in b && a[name] !== b[name]);
check("Shared dependency version parity", collisions.length === 0, collisions.length ? `conflicts: ${collisions.join(", ")}` : `${Object.keys(a).filter(name => name in b).length} common dependencies agree`);
const sharedPackage = JSON.parse(readFileSync(join(root, "packages/aim-platform/package.json"), "utf8"));
check("Shared platform package pin", sharedPackage.name === "@bandha/aim-platform" &&
  sharedPackage.packageManager === `pnpm@${requiredPnpm}`, "shared platform must use the pinned manager");
check("Shared platform engine policy", sharedPackage.engines?.node === ">=24 <27" &&
  sharedPackage.engines?.pnpm === ">=12 <13", "shared package must enforce Node/pnpm constraints");
for (const app of ["aim-next", "web"]) {
  const dependencies = manifestVersions.get(app) ?? {};
  check(`${app} shared workspace link`, dependencies["@bandha/aim-platform"] === "workspace:*",
    "both applications must link one common platform source");
}
const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
check("Workspace engine and peer enforcement", /^engineStrict:\s*true\s*$/m.test(workspace) && /^strictPeerDependencies:\s*true\s*$/m.test(workspace), "workspace must enforce engines and strict peers");
const failures = checks.filter(c => !c.passed);
const report = { stage: "AAS–AIM release preflight (Phase 32)", status: failures.length ? "BLOCKED" : "READY_FOR_EXECUTION", releaseValidated: false, checks };
if (json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else for (const item of checks) process.stdout.write(`${item.passed ? "PASS" : "BLOCK"} ${item.name}: ${item.detail}\n`);
if (strict && failures.length) {
  process.stderr.write(`Release gate blocked (${failures.length} unmet prerequisites). No production validation has been claimed.\n`);
  process.exitCode = 1;
}
