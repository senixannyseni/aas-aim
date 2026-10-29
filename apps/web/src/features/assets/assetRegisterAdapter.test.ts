import { describe, expect, it } from "vitest";

import {
  decodeAssetRegisterPage,
  parseAssetRegisterPage,
  type AdaptedAssetPage,
  type AssetAdapterIssue,
  type AssetAdapterIssueCode,
} from "./assetRegisterAdapter";

/**
 * File 41 — regression tests for the DRAFT Asset Register response adapter.
 *
 * All fixtures are synthetic. These tests validate the browser's acceptance
 * boundary, NOT API deployment, tenant isolation, basis-record authenticity,
 * backend ordering, or engineering fitness/approval decisions.
 *
 * Keep the wire representation distinct from the AssetRegister view model.
 */
const OBSERVED_AT = "2026-10-20T08:00:00Z";
const ASSESSED_AT = "2026-10-20T09:00:00+07:00";

function risk(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    level: "CRITICAL",
    basisRecordId: "RISK-BASIS-001",
    assessedAt: ASSESSED_AT,
    ...overrides,
  };
}

function evidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: "VALID",
    basisRecordId: "EVID-BASIS-001",
    evaluatedAt: OBSERVED_AT,
    ...overrides,
  };
}

function asset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "AST-001",
    tag: "V-101",
    name: "Synthetic pressure vessel",
    assetType: "Pressure vessel",
    location: "Unit A",
    riskClassification: risk(),
    evidenceAssessment: evidence(),
    ...overrides,
  };
}

function metadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    ...overrides,
  };
}

function response(
  items: unknown[] = [asset()],
  pageInfo: Record<string, unknown> = metadata({ totalItems: items.length }),
): Record<string, unknown> {
  return { items, pageInfo };
}

function accepted(input: unknown): AdaptedAssetPage {
  const result = parseAssetRegisterPage(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected valid Asset Register page");
  return result.page;
}

function rejected(input: unknown): readonly AssetAdapterIssue[] {
  const result = parseAssetRegisterPage(input);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected entire Asset Register page to be rejected");
  expect("page" in result).toBe(false);
  return result.issues;
}

function rejectsAt(input: unknown, path: string, code: AssetAdapterIssueCode): void {
  expect(rejected(input)).toContainEqual({ path, code });
}

describe("Asset Register API adapter — response envelope", () => {
  it("accepts a complete JSON-compatible page and preserves its metadata", () => {
    const page = accepted(response());
    expect(page.pageInfo).toEqual(metadata());
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.record).toEqual({
      id: "AST-001", tag: "V-101", name: "Synthetic pressure vessel",
      assetType: "Pressure vessel", location: "Unit A",
      riskStatus: "CRITICAL", evidenceStatus: "VALID",
    });
    expect(page.items[0]?.riskBasis).toEqual({
      basisRecordId: "RISK-BASIS-001", assessedAt: ASSESSED_AT,
    });
    expect(page.items[0]?.evidenceBasis).toEqual({
      basisRecordId: "EVID-BASIS-001", evaluatedAt: OBSERVED_AT,
    });
  });

  it("accepts a real JSON.parse-style plain object", () => {
    const json: unknown = JSON.parse(JSON.stringify(response()));
    expect(accepted(json).items[0]?.record.id).toBe("AST-001");
  });

  it.each([null, undefined, "{}", 42, false, new Date(0)])(
    "rejects a non-plain response envelope (%s)", (input) => {
      expect(rejected(input)).toEqual([{ path: "$", code: "EXPECTED_OBJECT" }]);
    },
  );

  it("rejects an array as the response envelope", () => {
    rejectsAt([], "$", "EXPECTED_OBJECT");
  });

  it("accepts a null-prototype response object with own properties", () => {
    const input = Object.assign(Object.create(null) as Record<string, unknown>, response());
    expect(accepted(input).items).toHaveLength(1);
  });

  it("rejects response objects with custom prototypes", () => {
    const input = Object.setPrototypeOf(response(), { injected: true }) as unknown;
    rejectsAt(input, "$", "EXPECTED_OBJECT");
  });

  it("rejects unexpected response fields", () => {
    rejectsAt({ ...response(), tenantId: "other-tenant" }, "$.tenantId", "UNEXPECTED_FIELD");
  });

  it("rejects absent items rather than inventing an empty register", () => {
    rejectsAt({ pageInfo: metadata() }, "$.items", "MISSING_FIELD");
  });

  it("rejects absent page information rather than inferring totals", () => {
    rejectsAt({ items: [asset()] }, "$.pageInfo", "MISSING_FIELD");
  });

  it.each([null, undefined, {}, "assets", 1, false])(
    "rejects non-array items (%s)", (items) => {
      rejectsAt({ items, pageInfo: metadata() }, "$.items", "EXPECTED_ARRAY");
    },
  );

  it("rejects oversized pages before treating them as complete", () => {
    const items = Array.from({ length: 51 }, (_, i) => asset({ id: `AST-${i}` }));
    rejectsAt(response(items, metadata({ pageSize: 50, totalItems: 51, totalPages: 2, hasNextPage: true })),
      "$.items", "INVALID_FIELD");
  });

  it("accepts a genuinely empty authorized result", () => {
    const page = accepted(response([], metadata({ totalItems: 0 })));
    expect(page.items).toEqual([]);
    expect(page.pageInfo.totalPages).toBe(1);
    expect(page.pageInfo.hasNextPage).toBe(false);
  });

  it("rejects a malformed item without returning a partial valid page", () => {
    rejectsAt(response([asset(), { id: "AST-002", tag: "V-2", name: "" }],
      metadata({ totalItems: 2 })), "$.items[1].name", "INVALID_FIELD");
  });
});

describe("Asset Register API adapter — identities and optional metadata", () => {
  it.each([null, undefined, "asset", 7, new Date(0)])(
    "rejects a non-plain item (%s)", (item) => {
      rejectsAt(response([item]), "$.items[0]", "EXPECTED_OBJECT");
    },
  );

  it("rejects an array as an asset item", () => {
    rejectsAt(response([[]]), "$.items[0]", "EXPECTED_OBJECT");
  });

  it("rejects items with inherited fields", () => {
    const input = Object.setPrototypeOf(asset(), { tenant: "unsafe" }) as unknown;
    rejectsAt(response([input]), "$.items[0]", "EXPECTED_OBJECT");
  });

  for (const field of ["id", "tag", "name"] as const) {
    it(`rejects absent ${field}`, () => {
      const item = asset();
      delete item[field];
      rejectsAt(response([item]), `$.items[0].${field}`, "MISSING_FIELD");
    });

    it.each(["", " ", " bad", "bad ", "a\nline", null, undefined, 12, {}])(
      `rejects malformed ${field} (%s)`, (value) => {
        rejectsAt(response([asset({ [field]: value })]), `$.items[0].${field}`, "INVALID_FIELD");
      },
    );
  }

  it("accepts UTF-8 identifiers and values without silent normalization", () => {
    const page = accepted(response([asset({ id: "É-001", tag: "設備-1", name: "Réservoir A" })]));
    expect(page.items[0]?.record).toEqual({
      id: "É-001", tag: "設備-1", name: "Réservoir A",
      assetType: "Pressure vessel", location: "Unit A",
      riskStatus: "CRITICAL", evidenceStatus: "VALID",
    });
  });

  it("rejects identifiers exceeding 128 characters", () => {
    rejectsAt(response([asset({ id: "X".repeat(129) })]), "$.items[0].id", "INVALID_FIELD");
  });

  it("rejects names exceeding 256 characters", () => {
    rejectsAt(response([asset({ name: "A".repeat(257) })]), "$.items[0].name", "INVALID_FIELD");
  });

  it("rejects unknown asset fields, including JSON-encoded prototype keys", () => {
    const input: unknown = JSON.parse('{"id":"AST-1","tag":"T-1","name":"Example","__proto__":{"isAdmin":true}}');
    rejectsAt(response([input]), "$.items[0].__proto__", "UNEXPECTED_FIELD");
    expect(({} as Record<string, unknown>)["isAdmin"]).toBeUndefined();
  });

  it("rejects duplicate asset IDs within one server page", () => {
    rejectsAt(response([asset(), asset({ tag: "V-102" })], metadata({ totalItems: 2 })),
      "$.items[1].id", "DUPLICATE_ASSET_ID");
  });

  it("treats opaque asset IDs as case-sensitive", () => {
    const items = [asset(), asset({ id: "ast-001", tag: "V-102" })];
    expect(accepted(response(items, metadata({ totalItems: 2 }))).items).toHaveLength(2);
  });

  for (const field of ["assetType", "location"] as const) {
    it(`keeps omitted ${field} truly omitted`, () => {
      const item = asset();
      delete item[field];
      expect(Object.hasOwn(accepted(response([item])).items[0]!.record, field)).toBe(false);
    });

    it(`preserves explicit null ${field}`, () => {
      const record = accepted(response([asset({ [field]: null })])).items[0]!.record;
      expect(Object.hasOwn(record, field)).toBe(true);
      expect(record[field]).toBeNull();
    });

    it.each(["", "bad ", " unit", "A\tB", 4, undefined, {}])(
      `rejects invalid optional ${field} (%s)`, (value) => {
        rejectsAt(response([asset({ [field]: value })]), `$.items[0].${field}`, "INVALID_FIELD");
      },
    );
  }
});

describe("Asset Register API adapter — classification provenance", () => {
  it.each(["LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN"])(
    "preserves reported risk level %s with its basis", (level) => {
      const item = accepted(response([asset({ riskClassification: risk({ level }) })])).items[0]!;
      expect(item.record.riskStatus).toBe(level);
      expect(item.riskBasis?.basisRecordId).toBe("RISK-BASIS-001");
    },
  );

  it.each(["VALID", "STALE", "INVALID", "UNAVAILABLE", "MISSING", "UNKNOWN"])(
    "preserves reported evidence state %s with its basis", (state) => {
      const item = accepted(response([asset({ evidenceAssessment: evidence({ state }) })])).items[0]!;
      expect(item.record.evidenceStatus).toBe(state);
      expect(item.evidenceBasis?.basisRecordId).toBe("EVID-BASIS-001");
    },
  );

  for (const [field, basis, status] of [
    ["riskClassification", "riskBasis", "riskStatus"],
    ["evidenceAssessment", "evidenceBasis", "evidenceStatus"],
  ] as const) {
    it(`preserves omitted ${field} instead of inventing UNKNOWN`, () => {
      const input = asset();
      delete input[field];
      const item = accepted(response([input])).items[0]!;
      expect(Object.hasOwn(item, basis)).toBe(false);
      expect(Object.hasOwn(item.record, status)).toBe(false);
    });

    it(`preserves explicitly null ${field} and basis`, () => {
      const item = accepted(response([asset({ [field]: null })])).items[0]!;
      expect(Object.hasOwn(item, basis)).toBe(true);
      expect(item[basis]).toBeNull();
      expect(Object.hasOwn(item.record, status)).toBe(true);
      expect(item.record[status]).toBeNull();
    });

    it(`rejects explicitly undefined ${field}`, () => {
      rejectsAt(response([asset({ [field]: undefined })]), `$.items[0].${field}`, "INVALID_FIELD");
    });

    it.each([false, "UNKNOWN", 12])(
      `rejects non-classification ${field} (%s)`, (value) => {
        rejectsAt(response([asset({ [field]: value })]), `$.items[0].${field}`, "EXPECTED_OBJECT");
      },
    );

    it(`rejects an array where ${field} must be an object`, () => {
      rejectsAt(response([asset({ [field]: [] })]), `$.items[0].${field}`, "EXPECTED_OBJECT");
    });

    it(`rejects incomplete ${field} objects`, () => {
      const requiredStatus = field === "riskClassification" ? "level" : "state";
      rejectsAt(response([asset({ [field]: {} })]), `$.items[0].${field}.${requiredStatus}`, "MISSING_FIELD");
    });

    it(`rejects an extra nested ${field} property`, () => {
      const variant = field === "riskClassification" ? risk({ approved: true }) : evidence({ approved: true });
      rejectsAt(response([asset({ [field]: variant })]), `$.items[0].${field}.approved`, "UNEXPECTED_FIELD");
    });
  }

  it.each(["VALID", "APPROVED", "unknown", 1, null])(
    "rejects invalid risk levels (%s)", (level) => {
      rejectsAt(response([asset({ riskClassification: risk({ level }) })]),
        "$.items[0].riskClassification.level", "INVALID_FIELD");
    },
  );

  it.each(["LOW", "APPROVED", "valid", 1, null])(
    "rejects invalid evidence states (%s)", (state) => {
      rejectsAt(response([asset({ evidenceAssessment: evidence({ state }) })]),
        "$.items[0].evidenceAssessment.state", "INVALID_FIELD");
    },
  );

  for (const [field, factory, timestampField] of [
    ["riskClassification", risk, "assessedAt"],
    ["evidenceAssessment", evidence, "evaluatedAt"],
  ] as const) {
    it(`rejects missing basis-record ID for ${field}`, () => {
      const classification = factory();
      delete classification["basisRecordId"];
      rejectsAt(response([asset({ [field]: classification })]),
        `$.items[0].${field}.basisRecordId`, "MISSING_FIELD");
    });

    it.each(["", " ", "bad ", 9, null, "X".repeat(129)])(
      `rejects invalid basis-record ID in ${field} (%s)`, (basisRecordId) => {
        rejectsAt(response([asset({ [field]: factory({ basisRecordId }) })]),
          `$.items[0].${field}.basisRecordId`, "INVALID_FIELD");
      },
    );

    it(`rejects a missing timestamp in ${field}`, () => {
      const classification = factory();
      delete classification[timestampField];
      rejectsAt(response([asset({ [field]: classification })]),
        `$.items[0].${field}.${timestampField}`, "MISSING_FIELD");
    });

    it.each([
      "not-a-date", "2026-02-30T08:00:00Z", "2025-02-29T08:00:00Z",
      "2026-13-01T08:00:00Z", "2026-10-20T25:00:00Z",
      "2026-10-20T08:60:00Z", "2026-10-20T08:00:60Z",
      "2026-10-20T08:00:00", "2026-10-20", "2026-10-20T08:00:00+05:99",
      null, 5,
    ])(`rejects malformed ${field} timestamps (%s)`, (value) => {
      rejectsAt(response([asset({ [field]: factory({ [timestampField]: value }) })]),
        `$.items[0].${field}.${timestampField}`, "INVALID_FIELD");
    });
  }

  it("keeps VALID evidence independent from CRITICAL risk", () => {
    const item = accepted(response()).items[0]!;
    expect(item.record.riskStatus).toBe("CRITICAL");
    expect(item.record.evidenceStatus).toBe("VALID");
  });
});

describe("Asset Register API adapter — pagination invariants", () => {
  it.each([10, 25, 50])("accepts authorized page size %s", (pageSize) => {
    const page = accepted(response([asset()], metadata({ pageSize })));
    expect(page.pageInfo.pageSize).toBe(pageSize);
  });

  it.each([0, 1, 9, 11, 20, 100, "10", null])(
    "rejects an unsupported page size (%s)", (pageSize) => {
      rejectsAt(response([asset()], metadata({ pageSize })), "$.pageInfo.pageSize", "INVALID_FIELD");
    },
  );

  for (const field of ["page", "pageSize", "totalItems", "totalPages", "hasNextPage"] as const) {
    it(`rejects missing pagination field ${field}`, () => {
      const pageInfo = metadata();
      delete pageInfo[field];
      rejectsAt(response([asset()], pageInfo), `$.pageInfo.${field}`, "MISSING_FIELD");
    });
  }

  it.each([
    ["page", 0], ["page", 2.5], ["page", "1"],
    ["totalItems", -1], ["totalItems", 1.5], ["totalItems", Number.POSITIVE_INFINITY],
    ["totalPages", 0], ["totalPages", "1"], ["hasNextPage", "false"],
    ["hasNextPage", null], ["pageSize", Number.NaN],
  ] as const)("rejects invalid pagination primitive %s=%s", (field, value) => {
    rejectsAt(response([asset()], metadata({ [field]: value })),
      `$.pageInfo.${field}`, "INVALID_FIELD");
  });

  it("rejects a non-object pageInfo", () => {
    rejectsAt({ items: [], pageInfo: null }, "$.pageInfo", "EXPECTED_OBJECT");
  });

  it("rejects extra pagination metadata fields", () => {
    rejectsAt(response([asset()], metadata({ tenantId: "hidden" })),
      "$.pageInfo.tenantId", "UNEXPECTED_FIELD");
  });

  it("accepts the first page of a multi-page response", () => {
    const items = Array.from({ length: 10 }, (_, i) => asset({ id: `AST-${i}` }));
    const info = metadata({ totalItems: 27, totalPages: 3, hasNextPage: true });
    const page = accepted(response(items, info));
    expect(page.items).toHaveLength(10);
    expect(page.pageInfo.totalItems).toBe(27);
    expect(page.pageInfo.totalPages).toBe(3);
    expect(page.pageInfo.hasNextPage).toBe(true);
  });

  it("accepts a partial last page without clamping page number", () => {
    const items = Array.from({ length: 7 }, (_, i) => asset({ id: `AST-${i + 20}` }));
    const info = metadata({ page: 3, totalItems: 27, totalPages: 3, hasNextPage: false });
    const page = accepted(response(items, info));
    expect(page.pageInfo.page).toBe(3);
    expect(page.items).toHaveLength(7);
  });

  it.each([
    ["incorrect totalPages", metadata({ totalPages: 2 })],
    ["page beyond range", metadata({ page: 2 })],
    ["wrong next-page flag", metadata({ hasNextPage: true })],
    ["unrealistic totals", metadata({ totalItems: 100, totalPages: 10, hasNextPage: true })],
    ["incorrect total count", metadata({ totalItems: 0 })],
  ])("rejects inconsistent page arithmetic: %s", (_description, pageInfo) => {
    rejectsAt(response([asset()], pageInfo), "$.pageInfo", "INCONSISTENT_PAGINATION");
  });

  it("rejects a truncated non-final page", () => {
    rejectsAt(response([asset()], metadata({ totalItems: 11, totalPages: 2, hasNextPage: true })),
      "$.pageInfo", "INCONSISTENT_PAGINATION");
  });

  it("rejects a non-empty page with totalItems zero", () => {
    rejectsAt(response([asset()], metadata({ totalItems: 0 })),
      "$.pageInfo", "INCONSISTENT_PAGINATION");
  });

  it("rejects a second page of an empty register", () => {
    rejectsAt(response([], metadata({ page: 2, totalItems: 0 })),
      "$.pageInfo", "INCONSISTENT_PAGINATION");
  });
});

describe("Asset Register API adapter — safety and decoder", () => {
  it("freezes the successful page, records, provenance and metadata", () => {
    const result = parseAssetRegisterPage(response());
    expect(Object.isFrozen(result)).toBe(true);
    if (!result.ok) throw new Error("Fixture should be valid");
    expect(Object.isFrozen(result.page)).toBe(true);
    expect(Object.isFrozen(result.page.items)).toBe(true);
    expect(Object.isFrozen(result.page.pageInfo)).toBe(true);
    expect(Object.isFrozen(result.page.items[0])).toBe(true);
    expect(Object.isFrozen(result.page.items[0]?.record)).toBe(true);
    expect(Object.isFrozen(result.page.items[0]?.riskBasis)).toBe(true);
    expect(Object.isFrozen(result.page.items[0]?.evidenceBasis)).toBe(true);
  });

  it("does not mutate the JSON response object", () => {
    const original = response();
    const before = JSON.stringify(original);
    accepted(original);
    expect(JSON.stringify(original)).toBe(before);
  });

  it("freezes rejected issues and omits any partially adapted page", () => {
    const result = parseAssetRegisterPage(response([asset(), asset({ name: "" })], metadata({ totalItems: 2 })));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Fixture should be rejected");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.issues)).toBe(true);
    expect(Object.isFrozen(result.issues[0])).toBe(true);
    expect("page" in result).toBe(false);
  });

  it("never embeds rejected source values in diagnostics", () => {
    const secret = "PRIVATE-CUSTOMER-DATA-DO-NOT-ECHO";
    const issues = rejected(response([asset({ name: secret + "\n" })]));
    expect(JSON.stringify(issues).includes(secret)).toBe(false);
    expect(issues[0]?.path).toBe("$.items[0].name");
  });

  it("decoder returns the same validated page shape as the parser", () => {
    const input = response();
    expect(decodeAssetRegisterPage(input)).toEqual(accepted(input));
  });

  it("decoder rejects malformed inputs with a sanitized error", () => {
    const invalid = response([asset({ riskClassification: risk({ level: "SUPER_SAFE" }) })]);
    expect(() => decodeAssetRegisterPage(invalid)).toThrow("Invalid Asset Register API response.");
  });

  it("does not interpret source availability, approval or tenant scope from status fields", () => {
    const item = accepted(response([asset({
      riskClassification: risk({ level: "UNKNOWN" }),
      evidenceAssessment: evidence({ state: "VALID" }),
    })])).items[0]!;
    expect(item.record.riskStatus).toBe("UNKNOWN");
    expect(item.record.evidenceStatus).toBe("VALID");
    expect(Object.hasOwn(item.record, "approved")).toBe(false);
    expect(Object.hasOwn(item.record, "tenantId")).toBe(false);
  });
});
