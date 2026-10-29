import { describe, expect, it } from "vitest";

import {
  parseAssetRegisterRecords,
  type AssetRecordValidationCode,
  type AssetRecordValidationIssue,
} from "./parseAssetRecords";

/**
 * Regression specification for the browser's read-only asset VIEW-MODEL boundary.
 * All records below are synthetic test fixtures, not real customer/plant data.
 *
 * This suite does not prove the future Java/OpenAPI wire contract, tenant access,
 * record provenance, or the engineering validity of any risk classification.
 */
const EXAMPLE = Object.freeze({
  id: "AST-001",
  tag: "V-101",
  name: "Example vessel",
  assetType: "Pressure vessel",
  location: "Unit A",
  riskStatus: "CRITICAL",
  evidenceStatus: "VALID",
});

function asset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...EXAMPLE, ...overrides };
}

function accepted(payload: unknown) {
  const result = parseAssetRegisterRecords(payload);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected a valid asset record batch");
  return result.assets;
}

function rejected(payload: unknown): readonly AssetRecordValidationIssue[] {
  const result = parseAssetRegisterRecords(payload);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected the complete asset batch to be rejected");
  return result.issues;
}

function rejectsField(
  payload: unknown,
  path: string,
  code: AssetRecordValidationCode,
): void {
  expect(rejected(payload)).toContainEqual({ path, code });
}

describe("parseAssetRegisterRecords — top-level and record shape", () => {
  it.each([
    [null], [undefined], [{}], ["[]"], [123], [false],
  ])("rejects a non-array top-level payload: %s", (payload) => {
    expect(rejected(payload)).toEqual([{ path: "$", code: "EXPECTED_ARRAY" }]);
  });

  it("accepts an empty array as a valid, explicitly empty batch", () => {
    expect(accepted([])).toEqual([]);
  });

  it.each([
    [null], [undefined], ["asset"], [50], [[]], [new Date("2026-10-20T00:00:00Z")],
  ])("rejects a non-plain item at its array index: %s", (item) => {
    rejectsField([item], "$[0]", "EXPECTED_OBJECT");
  });

  it("rejects class instances even if their fields resemble a valid record", () => {
    class AssetLike {
      readonly id = "AST-001";
      readonly tag = "V-101";
      readonly name = "Example";
    }
    rejectsField([new AssetLike()], "$[0]", "EXPECTED_OBJECT");
  });

  it("rejects objects with inherited fields or custom prototypes", () => {
    const inherited = Object.create({ id: "AST-001" }) as Record<string, unknown>;
    inherited["tag"] = "V-101";
    inherited["name"] = "Example";
    rejectsField([inherited], "$[0]", "EXPECTED_OBJECT");
  });

  it("accepts JSON-decoded plain records", () => {
    const parsed: unknown = JSON.parse(JSON.stringify([EXAMPLE]));
    expect(accepted(parsed)[0]?.id).toBe("AST-001");
  });

  it("accepts a null-prototype record with valid own properties", () => {
    const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, {
      id: "AST-001", tag: "V-101", name: "Example",
    });
    expect(accepted([nullPrototype])[0]?.name).toBe("Example");
  });

  it("rejects unknown fields rather than silently dropping them", () => {
    rejectsField([asset({ inspectionCredit: true })], "$[0].inspectionCredit", "UNEXPECTED_FIELD");
  });

  it("rejects nested objects in unexpected fields", () => {
    rejectsField([asset({ permissions: { canApprove: true } })], "$[0].permissions", "UNEXPECTED_FIELD");
  });

  it("does not treat a JSON own __proto__ field as a trusted domain property", () => {
    const parsed: unknown = JSON.parse(
      '{"id":"AST-001","tag":"V-101","name":"Example","__proto__":{"isAdmin":true}}',
    );
    rejectsField([parsed], "$[0].__proto__", "UNEXPECTED_FIELD");
    expect(({} as Record<string, unknown>)["isAdmin"]).toBeUndefined();
  });
});

describe("parseAssetRegisterRecords — required identity and text", () => {
  it("accepts the three required fields without optional metadata", () => {
    const records = accepted([{ id: "AST-1", tag: "V-1", name: "Vessel" }]);
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ id: "AST-1", tag: "V-1", name: "Vessel" });
  });

  for (const field of ["id", "tag", "name"] as const) {
    it(`rejects a missing ${field}`, () => {
      const candidate = asset();
      delete candidate[field];
      rejectsField([candidate], `$[0].${field}`, "REQUIRED_STRING");
    });

    it.each([
      ["empty string", ""],
      ["whitespace-only", "  "],
      ["leading space", " AST-1"],
      ["trailing space", "AST-1 "],
      ["control character", "AST\n001"],
      ["null", null],
      ["number", 101],
      ["explicit undefined", undefined],
    ])(`rejects invalid ${field} (%s)`, (_description, value) => {
      rejectsField([asset({ [field]: value })], `$[0].${field}`, "REQUIRED_STRING");
    });
  }

  it("preserves UTF-8 text as supplied, without silent trimming or conversion", () => {
    const records = accepted([{
      id: "ASSET-東京", tag: "É-101", name: "Réservoir — A",
    }]);
    expect(records[0]).toEqual({
      id: "ASSET-東京", tag: "É-101", name: "Réservoir — A",
    });
  });

  it("accepts case-distinct IDs because identities are opaque and case-sensitive", () => {
    expect(accepted([
      { id: "ast-1", tag: "A", name: "One" },
      { id: "AST-1", tag: "B", name: "Two" },
    ])).toHaveLength(2);
  });

  it("rejects duplicate IDs at the second occurrence", () => {
    rejectsField([asset(), asset({ tag: "V-102" })], "$[1].id", "DUPLICATE_ID");
  });

  it("identifies the later duplicate even after another record is invalid", () => {
    const issues = rejected([
      asset({ name: "" }),
      asset({ id: "AST-002" }),
      asset({ id: "AST-002", tag: "V-103" }),
    ]);
    expect(issues).toContainEqual({ path: "$[0].name", code: "REQUIRED_STRING" });
    expect(issues).toContainEqual({ path: "$[2].id", code: "DUPLICATE_ID" });
  });
});

describe("parseAssetRegisterRecords — optional text metadata", () => {
  for (const field of ["assetType", "location"] as const) {
    it(`preserves an absent ${field} as an absent property`, () => {
      const records = accepted([{ id: "A", tag: "A", name: "A" }]);
      expect(Object.hasOwn(records[0]!, field)).toBe(false);
    });

    it(`preserves a null ${field} as an explicit null`, () => {
      const records = accepted([asset({ [field]: null })]);
      expect(Object.hasOwn(records[0]!, field)).toBe(true);
      expect(records[0]?.[field]).toBeNull();
    });

    it(`accepts a valid ${field}`, () => {
      expect(accepted([asset({ [field]: "Unit E" })])[0]?.[field]).toBe("Unit E");
    });

    it.each([
      ["empty", ""],
      ["whitespace", " "],
      ["trim needed", "Unit E "],
      ["control character", "Unit\tE"],
      ["number", 4],
      ["object", { text: "Unit E" }],
      ["explicit undefined", undefined],
    ])(`rejects invalid ${field} (%s)`, (_description, value) => {
      rejectsField([asset({ [field]: value })], `$[0].${field}`, "OPTIONAL_STRING");
    });
  }
});

describe("parseAssetRegisterRecords — status semantics", () => {
  it.each(["LOW", "MODERATE", "HIGH", "CRITICAL", "UNKNOWN"])(
    "accepts risk status %s without reclassifying it", (status) => {
      expect(accepted([asset({ riskStatus: status })])[0]?.riskStatus).toBe(status);
    },
  );

  it.each(["VALID", "STALE", "INVALID", "UNAVAILABLE", "MISSING", "UNKNOWN"])(
    "accepts evidence status %s without reclassifying it", (status) => {
      expect(accepted([asset({ evidenceStatus: status })])[0]?.evidenceStatus).toBe(status);
    },
  );

  for (const field of ["riskStatus", "evidenceStatus"] as const) {
    it(`preserves absent ${field} as absent, not UNKNOWN`, () => {
      const records = accepted([{ id: "A", tag: "A", name: "A" }]);
      expect(Object.hasOwn(records[0]!, field)).toBe(false);
    });

    it(`preserves explicit null ${field} as null, not UNKNOWN`, () => {
      const records = accepted([asset({ [field]: null })]);
      expect(Object.hasOwn(records[0]!, field)).toBe(true);
      expect(records[0]?.[field]).toBeNull();
    });

    it.each([
      ["lowercase", "unknown"],
      ["unrecognized", "APPROVED"],
      ["whitespace", " UNKNOWN"],
      ["numeric", 1],
      ["boolean", true],
      ["object", { status: "UNKNOWN" }],
      ["explicit undefined", undefined],
    ])(`rejects invalid ${field} (%s)`, (_description, status) => {
      rejectsField([asset({ [field]: status })], `$[0].${field}`, "INVALID_STATUS");
    });
  }

  it("rejects the evidence VALID value in the risk category", () => {
    rejectsField([asset({ riskStatus: "VALID" })], "$[0].riskStatus", "INVALID_STATUS");
  });

  it("rejects the risk LOW value in the evidence category", () => {
    rejectsField([asset({ evidenceStatus: "LOW" })], "$[0].evidenceStatus", "INVALID_STATUS");
  });

  it("keeps valid evidence and critical risk as independent reported fields", () => {
    const [record] = accepted([asset({ riskStatus: "CRITICAL", evidenceStatus: "VALID" })]);
    expect(record?.riskStatus).toBe("CRITICAL");
    expect(record?.evidenceStatus).toBe("VALID");
  });
});

describe("parseAssetRegisterRecords — whole-batch guarantees", () => {
  it("returns no partial assets if any record is invalid", () => {
    const result = parseAssetRegisterRecords([
      asset({ id: "AST-001" }),
      asset({ id: "AST-002", riskStatus: "UNVERIFIED" }),
      asset({ id: "AST-003" }),
    ]);
    expect(result.ok).toBe(false);
    expect("assets" in result).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual({
        path: "$[1].riskStatus", code: "INVALID_STATUS",
      });
    }
  });

  it("accumulates multiple independent issues with their correct record indices", () => {
    const issues = rejected([
      asset({ id: "" }),
      asset({ id: "AST-002", evidenceStatus: "LOW", location: " Unit A" }),
      7,
    ]);
    expect(issues).toEqual([
      { path: "$[0].id", code: "REQUIRED_STRING" },
      { path: "$[1].location", code: "OPTIONAL_STRING" },
      { path: "$[1].evidenceStatus", code: "INVALID_STATUS" },
      { path: "$[2]", code: "EXPECTED_OBJECT" },
    ]);
  });

  it("preserves source order in a valid batch", () => {
    const records = accepted([
      asset({ id: "AST-003" }), asset({ id: "AST-001" }), asset({ id: "AST-002" }),
    ]);
    expect(records.map((item) => item.id)).toEqual(["AST-003", "AST-001", "AST-002"]);
  });

  it("does not mutate the caller's input array or records", () => {
    const input = Object.freeze([
      Object.freeze(asset({ id: "A" })),
      Object.freeze(asset({ id: "B" })),
    ]);
    const before = JSON.stringify(input);
    accepted(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("freezes successful results and every emitted record", () => {
    const result = parseAssetRegisterRecords([asset()]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected success");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.assets)).toBe(true);
    expect(Object.isFrozen(result.assets[0])).toBe(true);
  });

  it("freezes errors and each issue to prevent mutation", () => {
    const result = parseAssetRegisterRecords([asset({ tag: "" })]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.issues)).toBe(true);
    expect(Object.isFrozen(result.issues[0])).toBe(true);
  });

  it("does not echo untrusted field values in validation issues", () => {
    const marker = "PRIVATE-DO-NOT-ECHO-9271";
    const issues = rejected([asset({ name: ` ${marker}`, riskStatus: marker })]);
    expect(JSON.stringify(issues)).not.toContain(marker);
    expect(issues).toContainEqual({ path: "$[0].name", code: "REQUIRED_STRING" });
    expect(issues).toContainEqual({ path: "$[0].riskStatus", code: "INVALID_STATUS" });
  });

  it("does not share source-record object references with validated output", () => {
    const input = asset();
    const output = accepted([input])[0];
    expect(output).not.toBe(input);
    input["name"] = "Mutated after parse";
    expect(output?.name).toBe("Example vessel");
  });

  it("rejects a sparse array entry instead of silently dropping it", () => {
    const sparse = new Array<unknown>(2);
    sparse[1] = asset();
    rejectsField(sparse, "$[0]", "EXPECTED_OBJECT");
  });
});
