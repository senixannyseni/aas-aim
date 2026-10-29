/**
 * AAS–AIM Stage 45.1 — presentation-only async read state.
 * Successful transport does not mean engineering approval or authorization.
 * Scopes and generations MUST come from a trusted integration; the browser
 * must not manufacture them to claim a source is authorized or consistent.
 */
export type ReadGeneration = Readonly<{
  scopeKey: string;
  generationId: string;
  schemaVersion: string;
  producedAt: string;
}>;

export type ReadFailure =
  | Readonly<{ kind: "authentication_required" }>
  | Readonly<{ kind: "access_denied" }>
  | Readonly<{ kind: "rate_limited"; retryAfterSeconds?: number }>
  | Readonly<{ kind: "source_generation_changed" }>
  | Readonly<{ kind: "service_unavailable"; requestId?: string }>
  | Readonly<{ kind: "invalid_response"; requestId?: string }>
  | Readonly<{ kind: "network_failure" }>
  | Readonly<{ kind: "timeout" }>;

export type AuthorizedReadState<T> =
  | Readonly<{ kind: "disconnected" }>
  | Readonly<{ kind: "loading"; scopeKey: string; requestKey: number }>
  | Readonly<{ kind: "ready"; scopeKey: string; requestKey: number; generation: ReadGeneration; data: T }>
  | Readonly<{ kind: "empty"; scopeKey: string; requestKey: number; generation: ReadGeneration }>
  | Readonly<{ kind: "error"; scopeKey: string; requestKey: number; failure: ReadFailure }>;

export type ReadCompletion<T> = Extract<AuthorizedReadState<T>, { kind: "ready" | "empty" | "error" }>;

/** Request keys are locally monotonic identifiers, not security credentials. */
export function beginRead<T>(scopeKey: string, requestKey: number): AuthorizedReadState<T> {
  if (!scopeKey || !Number.isSafeInteger(requestKey) || requestKey < 0) {
    throw new Error("Invalid read identity.");
  }
  return Object.freeze({ kind: "loading", scopeKey, requestKey });
}

/** A late request or a response from another scope cannot replace current state. */
export function completeRead<T>(
  current: AuthorizedReadState<T>,
  result: ReadCompletion<T>,
): AuthorizedReadState<T> {
  if (
    current.kind !== "loading" ||
    current.scopeKey !== result.scopeKey ||
    current.requestKey !== result.requestKey
  ) return current;

  if (
    (result.kind === "ready" || result.kind === "empty") &&
    (
      result.generation.scopeKey !== result.scopeKey ||
      !result.generation.generationId ||
      !result.generation.schemaVersion ||
      !result.generation.producedAt
    )
  ) {
    return Object.freeze({
      kind: "error", scopeKey: current.scopeKey, requestKey: current.requestKey,
      failure: { kind: "invalid_response" as const },
    });
  }
  return result;
}
