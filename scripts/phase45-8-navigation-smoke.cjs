/** Dependency-light Stage 45.8 route and preservation smoke.
 * Node + TypeScript are required; does not execute React or prove authentication.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const appRoot = path.resolve(__dirname, "../apps/aim-next");
const ts = createRequire(path.join(appRoot, "package.json"))("@typescript/typescript6");
if (typeof ts.createSourceFile !== "function" || !ts.ScriptKind) {
  throw new Error("Navigation smoke requires the TypeScript 6 compiler API");
}
const root = path.join(appRoot, "src");
const filename = path.join(root, "shared/data/assetInvestigationNavigation.ts");
const text = fs.readFileSync(filename, "utf8");
const generated = ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const result = { exports: {} };
vm.runInNewContext(generated, { module: result, exports: result.exports }, { timeout: 1000 });
const { ASSET_INVESTIGATION_HASH, canOpenAssetInvestigationRoute } = result.exports;
let checks = 0;
function check(value, expected) { assert.equal(value, expected); checks++; }
check(ASSET_INVESTIGATION_HASH, "#/investigate/assets");
check(canOpenAssetInvestigationRoute(ASSET_INVESTIGATION_HASH, true), true);
check(canOpenAssetInvestigationRoute(ASSET_INVESTIGATION_HASH, false), false);
for (const rejected of ["", "#/screens/SCR-AIR-001", "#/investigate/assets/AST-001", "#/investigate/assets?token=abc", "#/investigate/assets/", "#/investigate/Assets"]) {
  check(canOpenAssetInvestigationRoute(rejected, true), false);
}
const appPath = path.join(root, "FutureAimApp.tsx");
const app = fs.readFileSync(appPath, "utf8");
check(app.includes("assetInvestigationBoundary?: AuthSessionBoundary | null"), true);
check(app.includes("assetInvestigationEnabled = !!assetInvestigationBoundary && !!navigationScopeKey"), true);
check(app.includes("<AuthenticatedAssetInvestigation boundary={assetInvestigationBoundary ?? null} />"), true);
check(app.includes('area==="asset-investigation" && assetInvestigationEnabled'), true);
check(app.includes('onClick={openAssetInvestigation}'), true);
for (const name of ["FutureAimApp.tsx", "FutureAimApp.phase45_8.integration.test.tsx", "shared/data/assetInvestigationNavigation.ts", "shared/data/assetInvestigationNavigation.test.ts"]) {
  const file = path.join(root, name);
  const source = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  check(sf.parseDiagnostics.length, 0);
}
console.log(`PASS — ${checks}/${checks} isolated Stage 45.8 route/source assertions (not React tests)`);
