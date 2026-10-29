"use strict";
/**
 * Offline test harness only. The actual Vite + pnpm build MUST use the
 * workspace's package exports and TypeScript 7 checks; this is not a bundler.
 * No live API, credentials or browser are contacted.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { createRequire } = Module;
const root = path.resolve(__dirname, "..");
const platformRoot = path.join(root, "packages/aim-platform");
const exportsMap = require(path.join(platformRoot,"package.json")).exports;
let ts;
const requireFromApp = createRequire(path.join(root,"apps/aim-next/package.json"));
for (const load of [
  () => requireFromApp("@typescript/typescript6"),
  () => require("@typescript/typescript6"),
  () => requireFromApp("typescript"),
  () => require("typescript"),
]) {
  try {
    const found = load();
    if (typeof found.transpileModule === "function" && found.ModuleKind?.CommonJS !== undefined) {
      ts = found; break;
    }
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
  }
}
if (!ts) {
  throw new Error("Offline harness requires the TypeScript 6 API or an older transpileModule-compatible compiler.");
}
const resolveOriginal = Module._resolveFilename;
const prefix = "@bandha/aim-platform/";
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request.startsWith(prefix)) {
    const subpath = "./" + request.slice(prefix.length);
    const target = exportsMap[subpath];
    if (typeof target !== "string" || !target.startsWith("./src/")) {
      throw new Error(`Unknown platform export: ${subpath}`);
    }
    const full = path.resolve(platformRoot,target);
    if (!full.startsWith(path.join(platformRoot,"src") + path.sep)) {
      throw new Error("Invalid platform export path");
    }
    return resolveOriginal.call(this,full,parent,isMain,options);
  }
  return resolveOriginal.call(this,request,parent,isMain,options);
};
function loadTS(module, filename) {
  let source = fs.readFileSync(filename,"utf8");
  if (filename === path.join(platformRoot,"src/config.ts")) {
    // Vite-only expression, which is not invoked by isolated transport checks.
    source = source.replaceAll("import.meta", "({ env: {} })");
  }
  const outcome = ts.transpileModule(source, {fileName:filename,compilerOptions:{
    target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS,
    jsx:ts.JsxEmit.ReactJSX, esModuleInterop:true,
  }});
  module._compile(outcome.outputText, filename);
}
require.extensions[".ts"] = loadTS;
require.extensions[".tsx"] = loadTS;
module.exports = {root, platformRoot};
