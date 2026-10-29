import { describe, expect, it } from "vitest";
import { beginRead, completeRead } from "./authorizedReadState";

const generation = {
  scopeKey: "site-a", generationId: "generation-1",
  schemaVersion: "1", producedAt: "2026-10-28T10:00:00Z",
} as const;

describe("Stage 45.1 — authorized presentation state", () => {
  it("accepts a completion for the current request", () => {
    const current = beginRead<readonly string[]>("site-a", 1);
    const next = completeRead(current, {
      kind: "ready", scopeKey: "site-a", requestKey: 1,
      generation, data: ["asset-001"],
    });
    expect(next.kind).toBe("ready");
  });
  it("ignores a late response", () => {
    const current = beginRead<readonly string[]>("site-a", 2);
    expect(completeRead(current, {
      kind: "ready", scopeKey: "site-a", requestKey: 1,
      generation, data: ["asset-001"],
    })).toBe(current);
  });
  it("ignores another scope", () => {
    const current = beginRead<string[]>("site-b", 3);
    expect(completeRead(current, {
      kind: "empty", scopeKey: "site-a", requestKey: 3, generation,
    })).toBe(current);
  });
  it("fails closed for inconsistent source generation", () => {
    const current = beginRead<string[]>("site-a", 4);
    const next = completeRead(current, {
      kind: "empty", scopeKey: "site-a", requestKey: 4,
      generation: { ...generation, scopeKey: "site-b" },
    });
    expect(next.kind).toBe("error");
    if (next.kind === "error") expect(next.failure.kind).toBe("invalid_response");
  });
  it("leaves disconnected state unchanged", () => {
    const current = { kind: "disconnected" } as const;
    expect(completeRead<string[]>(current, {
      kind: "empty", scopeKey: "site-a", requestKey: 1, generation,
    })).toBe(current);
  });
  it("rejects invalid local request identifiers", () => {
    expect(() => beginRead("", 1)).toThrow();
    expect(() => beginRead("site-a", Number.NaN)).toThrow();
  });
});
