import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import contractSource from "../../../../../contracts/asset-register.openapi.yaml?raw";

/**
 * Draft-contract regression tests (NOT a running API or a Java conformance test).
 *
 * The OpenAPI YAML is authoritative for this suite. Never copy its schemas into
 * another source file, and never treat a successful schema check as proof of
 * tenant authorization, provenance correctness, stable pagination, or safety.
 *
 * Vite's ?raw import keeps tests in the web workspace while loading the real
 * root-level contract. This file must NOT be imported into production UI code.
 */

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected contract object");
  }
  return value as JsonObject;
}

// Resolve only contract-owned properties. Fail rather than silently defaulting.
function path(root: unknown, ...segments: readonly string[]): unknown {
  let value = root;
  for (const segment of segments) {
    value = object(value)[segment];
  }
  return value;
}

function recordPath(root: unknown, ...segments: readonly string[]): JsonObject {
  return object(path(root, ...segments));
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item: unknown) => typeof item !== "string")) {
    throw new Error("Expected a list of strings");
  }
  return value as string[];
}

const contract: unknown = parse(contractSource, { uniqueKeys: true, strict: true });
const schemas = recordPath(contract, "components", "schemas");
const operation = recordPath(contract, "paths", "/assets", "get");

// Preserve the original OpenAPI-local #/components/schemas references. Ajv
// resolves them from this wrapper under JSON Schema draft 2020-12.
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
addFormats(ajv);

const schemaRoot = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  components: { schemas },
};
const responseValid = ajv.compile({
  ...schemaRoot,
  $ref: "#/components/schemas/AssetListResponse",
});
const errorValid = ajv.compile({
  ...schemaRoot,
  $ref: "#/components/schemas/ErrorResponse",
});

const THRESHOLD = "2026-10-27T10:30:00Z";
const SAMPLE_ASSET = {
  id: "AST-001",
  tag: "V-101",
  name: "Synthetic test vessel",
  assetType: "Pressure vessel",
  location: "Test Unit",
  riskClassification: {
    level: "CRITICAL",
    basisRecordId: "RBI-TEST-001",
    assessedAt: THRESHOLD,
  },
  evidenceAssessment: {
    state: "VALID",
    basisRecordId: "EV-TEST-001",
    evaluatedAt: THRESHOLD,
  },
};
const PAGE = {
  page: 1, pageSize: 10, totalItems: 1, totalPages: 1, hasNextPage: false,
};

function response(items: readonly unknown[] = [SAMPLE_ASSET], pageInfo: unknown = PAGE): unknown {
  return { items, pageInfo };
}

function param(name: string): JsonObject {
  const params: unknown = operation["parameters"];
  if (!Array.isArray(params)) throw new Error("Missing endpoint parameters");
  const found: unknown = params.find((item: unknown) => object(item)["name"] === name);
  return object(found);
}

function endpointResponse(status: string): JsonObject {
  return recordPath(operation, "responses", status);
}

function resolveLocalRef(ref: string): unknown {
  if (!ref.startsWith("#/")) throw new Error("Only local schema references are permitted");
  const segments = ref.slice(2).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  return path(contract, ...segments);
}

/** Walk the original document (not the Ajv copy) to detect dangling $refs. */
function collectRefs(value: unknown, results: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const part of value) collectRefs(part, results);
  } else if (typeof value === "object" && value !== null) {
    for (const [name, part] of Object.entries(value)) {
      if (name === "$ref") {
        if (typeof part !== "string") throw new Error("Invalid $ref");
        results.push(part);
      } else {
        collectRefs(part, results);
      }
    }
  }
  return results;
}

describe("Asset Register OpenAPI draft — structural contract", () => {
  it("uses the declared OpenAPI version and draft lifecycle", () => {
    expect(path(contract, "openapi")).toBe("3.2.1");
    expect(path(contract, "info", "version")).toBe("0.1.0");
    expect(String(path(contract, "info", "description"))).toMatch(/DRAFT/);
  });

  it("uses a versioned, same-origin server path", () => {
    const servers = path(contract, "servers");
    expect(Array.isArray(servers)).toBe(true);
    if (!Array.isArray(servers)) throw new Error("Missing servers");
    expect(servers).toHaveLength(1);
    expect(path(servers[0], "url")).toBe("/api/v1");
  });

  it("offers only the read-only assets GET operation", () => {
    expect(Object.keys(recordPath(contract, "paths"))).toEqual(["/assets"]);
    expect(Object.keys(recordPath(contract, "paths", "/assets"))).toEqual(["get"]);
    expect(operation["operationId"]).toBe("listAssets");
  });

  it("requires bearer authentication and delegates authorization to the server", () => {
    expect(path(contract, "components", "securitySchemes", "AimBearer", "scheme")).toBe("bearer");
    expect(path(contract, "components", "securitySchemes", "AimBearer", "type")).toBe("http");
    expect(path(contract, "security")).toEqual([{ AimBearer: [] }]);
    expect(String(operation["description"])).toMatch(/tenant/i);
    expect(String(operation["description"])).toMatch(/authorization/i);
  });

  it("does not accept a client-supplied tenant identifier", () => {
    const params = operation["parameters"];
    if (!Array.isArray(params)) throw new Error("Missing parameters");
    expect(params.map((item: unknown) => object(item)["name"])).toEqual([
      "page", "pageSize", "search", "risk", "evidence",
    ]);
    for (const item of params) expect(object(item)["in"]).toBe("query");
  });

  it("defines one-based page indexes and maximum search length", () => {
    expect(path(param("page"), "schema", "minimum")).toBe(1);
    expect(path(param("page"), "schema", "default")).toBe(1);
    expect(path(param("search"), "schema", "maxLength")).toBe(200);
  });

  it("defines page sizes 10, 25 and 50", () => {
    expect(path(param("pageSize"), "schema", "enum")).toEqual([10, 25, 50]);
    expect(path(schemas, "PageInfo", "properties", "pageSize", "enum")).toEqual([10, 25, 50]);
    expect(path(param("pageSize"), "schema", "default")).toBe(10);
  });

  it("distinguishes NOT_PROVIDED filters from explicitly UNKNOWN classification", () => {
    expect(strings(path(schemas, "RiskFilter", "enum"))).toContain("NOT_PROVIDED");
    expect(strings(path(schemas, "RiskFilter", "enum"))).toContain("UNKNOWN");
    expect(strings(path(schemas, "EvidenceFilter", "enum"))).toContain("NOT_PROVIDED");
    expect(strings(path(schemas, "EvidenceFilter", "enum"))).toContain("UNKNOWN");
  });

  it("prevents adding unreviewed enum values silently", () => {
    expect(strings(path(schemas, "RiskLevel", "enum"))).toEqual([
      "LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN",
    ]);
    expect(strings(path(schemas, "EvidenceState", "enum"))).toEqual([
      "VALID", "STALE", "INVALID", "UNAVAILABLE", "MISSING", "UNKNOWN",
    ]);
  });

  it("does not allow arbitrary fields in controlled wire records", () => {
    for (const key of [
      "AssetSummary", "RiskClassification", "EvidenceAssessment", "AssetListResponse", "PageInfo", "ErrorResponse",
    ]) expect(path(schemas, key, "additionalProperties")).toBe(false);
  });

  it("requires provenance for every non-null risk classification", () => {
    expect(path(schemas, "RiskClassification", "required")).toEqual([
      "level", "basisRecordId", "assessedAt",
    ]);
  });

  it("requires provenance for every non-null evidence assessment", () => {
    expect(path(schemas, "EvidenceAssessment", "required")).toEqual([
      "state", "basisRecordId", "evaluatedAt",
    ]);
  });

  it("documents server-enforced ordering and per-page identity uniqueness", () => {
    const endpointRules = String(operation["description"]);
    const itemRules = String(path(schemas, "AssetListResponse", "properties", "items", "description"));
    expect(endpointRules).toMatch(/ascending asset tag/i);
    expect(endpointRules).toMatch(/asset ID/i);
    expect(itemRules).toMatch(/unique asset IDs/i);
    // These semantic rules are NOT enforced by JSON Schema; Java API and
    // integration tests must verify actual ordering and uniqueness later.
  });

  it("requires pagination metadata and unique response fields", () => {
    expect(path(schemas, "AssetListResponse", "required")).toEqual(["items", "pageInfo"]);
    expect(path(schemas, "AssetListResponse", "properties", "items", "maxItems")).toBe(50);
    expect(path(schemas, "PageInfo", "required")).toEqual([
      "page", "pageSize", "totalItems", "totalPages", "hasNextPage",
    ]);
  });

  it("references existing internal contract components", () => {
    const refs = collectRefs(contract);
    expect(refs.length).toBeGreaterThan(20);
    for (const ref of refs) expect(resolveLocalRef(ref)).toBeDefined();
  });

  it("specifies expected success and failure statuses", () => {
    expect(Object.keys(recordPath(operation, "responses"))).toEqual([
      "200", "400", "401", "403", "429", "500", "503",
    ]);
    expect(path(endpointResponse("200"), "content", "application/json", "schema", "$ref"))
      .toBe("#/components/schemas/AssetListResponse");
  });

  it.each(["200", "400", "401", "403", "429", "500", "503"])(
    "requires no-store semantics on HTTP %s",
    (status: string) => {
      // Resolve reusable OpenAPI response references before inspecting headers.
      const declared = endpointResponse(status);
      const responseRef = declared["$ref"];
      const definition = typeof responseRef === "string"
        ? recordPath(resolveLocalRef(responseRef))
        : declared;
      const headers = recordPath(definition, "headers");
      const cache = recordPath(headers, "Cache-Control");
      if (typeof cache["$ref"] === "string") {
        expect(path(resolveLocalRef(cache["$ref"]), "schema", "const")).toBe("no-store");
      } else {
        expect(path(cache, "schema", "const")).toBe("no-store");
      }
    },
  );

  it("does not collapse backend unavailability into a successful empty response", () => {
    expect(endpointResponse("503")["$ref"]).toBe("#/components/responses/Unavailable");
    expect(path(resolveLocalRef(String(endpointResponse("503")["$ref"])), "content", "application/json", "schema", "$ref"))
      .toBe("#/components/schemas/ErrorResponse");
    expect(path(endpointResponse("200"), "content", "application/json", "examples", "noMatches", "value"))
      .toEqual({
        items: [],
        pageInfo: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1, hasNextPage: false },
      });
  });
});

describe("Asset Register OpenAPI draft — response JSON Schema", () => {
  it("accepts an explicitly empty authorized register", () => {
    expect(responseValid(response([], {
      page: 1, pageSize: 10, totalItems: 0, totalPages: 1, hasNextPage: false,
    }))).toBe(true);
  });

  it("accepts a fully attributed synthetic asset", () => {
    expect(responseValid(response())).toBe(true);
  });

  it("accepts a record with only required identity fields", () => {
    expect(responseValid(response([{ id: "AST-001", tag: "V-101", name: "Example" }]))).toBe(true);
  });

  it("accepts explicitly null optional fields without inferring a status", () => {
    expect(responseValid(response([{
      id: "AST-001", tag: "V-101", name: "Example",
      assetType: null, location: null,
      riskClassification: null, evidenceAssessment: null,
    }]))).toBe(true);
  });

  it("accepts explicit UNKNOWN classifications only with provenance", () => {
    expect(responseValid(response([{
      id: "AST-001", tag: "V-101", name: "Example",
      riskClassification: {
        level: "UNKNOWN", basisRecordId: "RISK-TEST-0", assessedAt: THRESHOLD,
      },
      evidenceAssessment: {
        state: "UNKNOWN", basisRecordId: "EVID-TEST-0", evaluatedAt: THRESHOLD,
      },
    }]))).toBe(true);
  });

  it.each([
    ["risk lacks basis", { riskClassification: { level: "CRITICAL", assessedAt: THRESHOLD } }],
    ["risk lacks assessment time", { riskClassification: { level: "LOW", basisRecordId: "R-1" } }],
    ["unknown risk lacks basis", { riskClassification: { level: "UNKNOWN" } }],
    ["evidence lacks basis", { evidenceAssessment: { state: "VALID", evaluatedAt: THRESHOLD } }],
    ["evidence lacks evaluation time", { evidenceAssessment: { state: "STALE", basisRecordId: "E-1" } }],
    ["unknown evidence lacks basis", { evidenceAssessment: { state: "UNKNOWN" } }],
  ])("rejects %s", (_label: string, fields: Record<string, unknown>) => {
    expect(responseValid(response([{
      id: "AST-001", tag: "V-101", name: "Example", ...fields,
    }]))).toBe(false);
  });

  it.each([
    ["unsupported risk", { riskClassification: { ...SAMPLE_ASSET.riskClassification, level: "SAFE" } }],
    ["unsupported evidence", { evidenceAssessment: { ...SAMPLE_ASSET.evidenceAssessment, state: "SAFE" } }],
    ["extra field", { hiddenTenantId: "tenant-123" }],
    ["empty ID", { id: "" }],
    ["whitespace-only tag", { tag: "   " }],
    ["leading-space name", { name: " Example" }],
    ["invalid date-time", { riskClassification: { ...SAMPLE_ASSET.riskClassification, assessedAt: "yesterday" } }],
  ])("rejects %s", (_label: string, fields: Record<string, unknown>) => {
    expect(responseValid(response([{ ...SAMPLE_ASSET, ...fields }]))).toBe(false);
  });

  it.each([
    ["missing items", { pageInfo: PAGE }],
    ["missing pageInfo", { items: [] }],
    ["unexpected response field", { items: [], pageInfo: PAGE, tenantId: "abc" }],
    ["page zero", response([], { ...PAGE, page: 0 })],
    ["negative totalItems", response([], { ...PAGE, totalItems: -1 })],
    ["zero totalPages", response([], { ...PAGE, totalPages: 0 })],
    ["unsupported page size", response([], { ...PAGE, pageSize: 100 })],
    ["invalid next-page type", response([], { ...PAGE, hasNextPage: 1 })],
    ["51 assets", response(Array.from({ length: 51 }, (_, i) => ({
      id: `A-${i}`, tag: `T-${i}`, name: `Example ${i}`,
    })))],
  ])("rejects %s", (_label: string, candidate: unknown) => {
    expect(responseValid(candidate)).toBe(false);
  });

  it("does not pretend that JSON Schema enforces arithmetic or cross-page snapshot consistency", () => {
    // These invariants are explicitly server responsibilities and require
    // Java contract tests and HTTP integration/acceptance tests later.
    expect(String(path(schemas, "PageInfo", "description"))).toMatch(/server computes/i);
    expect(String(operation["description"])).toMatch(/snapshot/i);
    expect(responseValid(response([], {
      page: 2, pageSize: 10, totalItems: 0, totalPages: 1, hasNextPage: true,
    }))).toBe(true); // shape-valid but semantically INVALID; not sufficient for deployment.
  });

  it("rejects responses that label source data as approved engineering truth", () => {
    expect(responseValid(response([{ ...SAMPLE_ASSET, operatingPermission: "APPROVED" }]))).toBe(false);
  });
});

describe("Asset Register OpenAPI draft — structured errors", () => {
  it("accepts a sanitized service-unavailable error", () => {
    expect(errorValid({
      code: "SERVICE_UNAVAILABLE", message: "Service unavailable", requestId: "req-123",
    })).toBe(true);
  });

  it.each([
    ["unknown code", { code: "OK", message: "Oops", requestId: "r" }],
    ["missing message", { code: "INTERNAL_ERROR", requestId: "r" }],
    ["missing correlation id", { code: "INTERNAL_ERROR", message: "Error" }],
    ["extra private data", { code: "FORBIDDEN", message: "Denied", requestId: "r", tenantId: "secret" }],
    ["empty message", { code: "FORBIDDEN", message: "", requestId: "r" }],
  ])("rejects %s", (_label: string, candidate: unknown) => {
    expect(errorValid(candidate)).toBe(false);
  });
});
