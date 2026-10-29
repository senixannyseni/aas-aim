// @vitest-environment jsdom

import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../api/apiClient";
import {
  createAuthSessionBoundary,
  type AuthSessionActivation,
  type AuthSessionBoundary,
  type AuthSessionPhase,
  type AuthSessionSnapshot,
  type UnauthenticatedPhase,
} from "./authSession";
import { useAuthSession } from "./useAuthSession";

/**
 * File 51 — React integration tests for the read-only auth session hook.
 *
 * Keys and credentials are SYNTHETIC test fixtures. No provider, browser
 * credential store, live network endpoint, or Java API is used. A React hook
 * cannot authenticate a user or grant tenant authorization; the authoritative
 * backend must enforce those requirements independently.
 */
afterEach(cleanup);

const TOKEN_A = "synthetic-bearer-token-A";
const TOKEN_B = "synthetic-bearer-token-B";

const SESSION_A: AuthSessionActivation = Object.freeze({
  subjectKey: "synthetic-subject-A",
  tenantKey: "synthetic-tenant-A",
  sessionKey: "synthetic-session-A",
  getAccessToken: () => TOKEN_A,
});
const SESSION_B: AuthSessionActivation = Object.freeze({
  subjectKey: "synthetic-subject-B",
  tenantKey: "synthetic-tenant-B",
  sessionKey: "synthetic-session-B",
  getAccessToken: () => TOKEN_B,
});

function boundary(): AuthSessionBoundary {
  // The fake transport should never be invoked by the hook or by activation.
  return createAuthSessionBoundary({
    apiBasePath: "/api",
    fetchImpl: vi.fn(async () => {
      throw new Error("Unexpected network access from a subscription test");
    }),
  });
}

function activated(session: AuthSessionActivation = SESSION_A): AuthSessionBoundary {
  const auth = boundary();
  auth.activate(session);
  return auth;
}

function useObservedBoundary(auth: AuthSessionBoundary | null): AuthSessionSnapshot {
  return useAuthSession(auth);
}

function TestProbe({ auth }: { auth: AuthSessionBoundary | null }) {
  const snapshot = useAuthSession(auth);
  return (
    <section aria-label="Synthetic authentication observation">
      <output aria-label="Authentication phase">{snapshot.phase}</output>
      <output aria-label="Session revision">{snapshot.revision}</output>
      <output aria-label="API client visibility">
        {snapshot.client === null ? "No client" : "Authenticated client"}
      </output>
    </section>
  );
}

/** Instrument subscriptions, not credentials or private boundary internals. */
function observed(auth: AuthSessionBoundary) {
  let subscribes = 0;
  let unsubscribes = 0;
  let active = 0;
  const observedBoundary: AuthSessionBoundary = {
    ...auth,
    subscribe(listener) {
      subscribes++;
      active++;
      const stop = auth.subscribe(listener);
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        active--;
        unsubscribes++;
        stop();
      };
    },
  };
  return {
    boundary: observedBoundary,
    counts: () => ({ subscribes, unsubscribes, active }),
  };
}

describe("useAuthSession — disconnected state", () => {
  it("returns a signed-out snapshot for null without an API client", () => {
    const { result } = renderHook(() => useObservedBoundary(null));
    expect(result.current).toEqual({ phase: "signed-out", revision: 0, client: null });
    expect(result.current.client).toBeNull();
  });

  it("preserves the exact disconnected snapshot reference across renders", () => {
    const { result, rerender } = renderHook(() => useAuthSession(null));
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
    expect(Object.isFrozen(result.current)).toBe(true);
  });

  it("does not invent a session, tenant, or authorization state", () => {
    const { result } = renderHook(() => useAuthSession(null));
    expect(Object.keys(result.current).sort()).toEqual(["client", "phase", "revision"]);
    expect(JSON.stringify(result.current)).toBe('{"phase":"signed-out","revision":0,"client":null}');
  });

  it("renders an explicit unauthenticated interface for a null boundary", () => {
    render(<TestProbe auth={null} />);
    expect(screen.getByRole("status", { name: "Authentication phase" }).textContent).toBe("signed-out");
    expect(screen.getByRole("status", { name: "API client visibility" }).textContent).toBe("No client");
  });

  it("does not rely on a prior mounted component's authenticated snapshot", () => {
    const auth = activated();
    const { unmount } = render(<TestProbe auth={auth} />);
    expect(screen.getByRole("status", { name: "API client visibility" }).textContent).toBe("Authenticated client");
    unmount();
    render(<TestProbe auth={null} />);
    expect(screen.getByRole("status", { name: "API client visibility" }).textContent).toBe("No client");
    auth.dispose();
  });
});

describe("useAuthSession — live boundary snapshots", () => {
  it("starts signed out with an actual but inactive boundary", () => {
    const auth = boundary();
    const { result } = renderHook(() => useAuthSession(auth));
    expect(result.current).toBe(auth.getSnapshot());
    expect(result.current).toEqual({ phase: "signed-out", revision: 0, client: null });
    auth.dispose();
  });

  it("reads the exact immutable snapshot exposed by an authenticated boundary", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    expect(result.current).toBe(auth.getSnapshot());
    expect(Object.isFrozen(result.current)).toBe(true);
    expect(result.current.phase).toBe("authenticated");
    expect(result.current.client).not.toBeNull();
    auth.dispose();
  });

  it("does not acquire a token merely by rendering an authenticated snapshot", () => {
    const getAccessToken = vi.fn(() => TOKEN_A);
    const auth = activated({ ...SESSION_A, getAccessToken });
    const { rerender } = renderHook(() => useAuthSession(auth));
    rerender();
    expect(getAccessToken).not.toHaveBeenCalled();
    auth.dispose();
  });

  it("reuses the same snapshot when a parent re-renders without a session transition", () => {
    const auth = activated();
    const { result, rerender } = renderHook(() => useAuthSession(auth));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    auth.dispose();
  });

  it("updates after an authentication activation", () => {
    const auth = boundary();
    const { result } = renderHook(() => useAuthSession(auth));
    act(() => auth.activate(SESSION_A));
    expect(result.current).toBe(auth.getSnapshot());
    expect(result.current).toMatchObject({ phase: "authenticated", revision: 1 });
    expect(result.current.client).not.toBeNull();
    auth.dispose();
  });

  it("updates the visible component without polling", () => {
    const auth = boundary();
    render(<TestProbe auth={auth} />);
    expect(screen.getByRole("status", { name: "API client visibility" }).textContent).toBe("No client");
    act(() => auth.activate(SESSION_A));
    expect(screen.getByRole("status", { name: "Authentication phase" }).textContent).toBe("authenticated");
    expect(screen.getByRole("status", { name: "API client visibility" }).textContent).toBe("Authenticated client");
    auth.dispose();
  });

  const inactivePhases = [
    "signed-out", "authenticating", "refreshing", "expired", "revoked", "error",
  ] as const satisfies readonly UnauthenticatedPhase[];

  for (const phase of inactivePhases) {
    it(`removes the API client immediately when the boundary transitions to ${phase}`, () => {
      const auth = activated();
      const { result } = renderHook(() => useAuthSession(auth));
      const oldClient = result.current.client;
      expect(oldClient).not.toBeNull();
      act(() => auth.transition(phase));
      expect(result.current).toBe(auth.getSnapshot());
      expect(result.current.phase).toBe(phase);
      expect(result.current.client).toBeNull();
      expect(result.current.revision).toBe(2);
      auth.dispose();
    });
  }

  it("changes revision even when transitioning to the same phase twice", () => {
    const auth = boundary();
    const { result } = renderHook(() => useAuthSession(auth));
    const original = result.current;
    act(() => auth.transition("signed-out"));
    expect(result.current.revision).toBe(1);
    expect(result.current).not.toBe(original);
    act(() => auth.transition("signed-out"));
    expect(result.current.revision).toBe(2);
    auth.dispose();
  });

  it("retains only the latest session after consecutive transitions", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    act(() => {
      auth.transition("refreshing");
      auth.activate(SESSION_B);
      auth.transition("expired");
    });
    expect(result.current).toBe(auth.getSnapshot());
    expect(result.current).toMatchObject({ phase: "expired", revision: 4, client: null });
    auth.dispose();
  });

  it("recovers from an expired phase only on a new explicit activation", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    act(() => auth.transition("expired"));
    expect(result.current.client).toBeNull();
    act(() => auth.activate(SESSION_B));
    expect(result.current.phase).toBe("authenticated");
    expect(result.current.client).not.toBeNull();
    expect(result.current.revision).toBe(3);
    auth.dispose();
  });

  it("never places identity identifiers or tokens in observable snapshots", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    const serialized = JSON.stringify(result.current);
    for (const value of [TOKEN_A, SESSION_A.subjectKey, SESSION_A.tenantKey, SESSION_A.sessionKey]) {
      expect(serialized).not.toContain(value);
    }
    expect(Object.keys(result.current).sort()).toEqual(["client", "phase", "revision"]);
    auth.dispose();
  });
});

describe("useAuthSession — identity and tenant replacement", () => {
  it("changes client identity when the subject changes", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    const oldClient = result.current.client;
    act(() => auth.activate(SESSION_B));
    expect(result.current.client).not.toBeNull();
    expect(result.current.client).not.toBe(oldClient);
    expect(result.current).toBe(auth.getSnapshot());
    auth.dispose();
  });

  it("changes client identity when only the tenant changes", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    const oldClient = result.current.client;
    act(() => auth.activate({ ...SESSION_A, tenantKey: "synthetic-tenant-B" }));
    expect(result.current.client).not.toBe(oldClient);
    expect(result.current.revision).toBe(2);
    auth.dispose();
  });

  it("changes client identity when only the session key changes", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    const oldClient = result.current.client;
    act(() => auth.activate({ ...SESSION_A, sessionKey: "synthetic-session-rotated" }));
    expect(result.current.client).not.toBe(oldClient);
    auth.dispose();
  });

  it("rotates the client even if all context keys repeat", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    const oldClient = result.current.client;
    act(() => auth.activate(SESSION_A));
    expect(result.current.client).not.toBe(oldClient);
    expect(result.current.revision).toBe(2);
    auth.dispose();
  });

  it("makes a client held before sign-out unusable", async () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    const previousClient = result.current.client;
    expect(previousClient).not.toBeNull();
    act(() => auth.transition("signed-out"));
    expect(result.current.client).toBeNull();
    await expect(previousClient!.request({
      pathSegments: ["v1", "assets"],
      decode: (value: unknown) => value,
    })).rejects.toMatchObject({ code: "ABORTED" } satisfies Partial<ApiClientError>);
    auth.dispose();
  });

  it("invalidates an old tenant client before publishing the replacement", () => {
    const auth = activated();
    const previousClient = auth.getSnapshot().client;
    let seenOldClient = false;
    const stop = auth.subscribe(() => {
      if (auth.getSnapshot().revision === 2) {
        seenOldClient = auth.getSnapshot().client === previousClient;
      }
    });
    const { result } = renderHook(() => useAuthSession(auth));
    act(() => auth.activate(SESSION_B));
    expect(seenOldClient).toBe(false);
    expect(result.current.client).not.toBe(previousClient);
    stop();
    auth.dispose();
  });

  it("never merges snapshots from two independently authenticated boundaries", () => {
    const first = activated(SESSION_A);
    const second = activated(SESSION_B);
    const { result: firstResult } = renderHook(() => useAuthSession(first));
    const { result: secondResult } = renderHook(() => useAuthSession(second));
    expect(firstResult.current.client).not.toBe(secondResult.current.client);
    act(() => first.transition("revoked"));
    expect(firstResult.current.client).toBeNull();
    expect(secondResult.current.client).toBe(second.getSnapshot().client);
    first.dispose();
    second.dispose();
  });
});

describe("useAuthSession — swapping and detaching boundaries", () => {
  it("switches to the next boundary's snapshot during a parent rerender", () => {
    const first = activated(SESSION_A);
    const second = activated(SESSION_B);
    const { result, rerender } = renderHook(
      ({ auth }: { auth: AuthSessionBoundary | null }) => useAuthSession(auth),
      { initialProps: { auth: first as AuthSessionBoundary | null } },
    );
    const oldClient = result.current.client;
    rerender({ auth: second });
    expect(result.current).toBe(second.getSnapshot());
    expect(result.current.client).not.toBe(oldClient);
    first.dispose();
    second.dispose();
  });

  it("detaches from the previous boundary and returns a disconnected snapshot", () => {
    const first = activated();
    const { result, rerender } = renderHook(
      ({ auth }: { auth: AuthSessionBoundary | null }) => useAuthSession(auth),
      { initialProps: { auth: first as AuthSessionBoundary | null } },
    );
    rerender({ auth: null });
    expect(result.current).toEqual({ phase: "signed-out", revision: 0, client: null });
    act(() => first.activate(SESSION_B));
    expect(result.current).toEqual({ phase: "signed-out", revision: 0, client: null });
    first.dispose();
  });

  it("starts observing the newly supplied boundary after a null interval", () => {
    const next = activated(SESSION_B);
    const { result, rerender } = renderHook(
      ({ auth }: { auth: AuthSessionBoundary | null }) => useAuthSession(auth),
      { initialProps: { auth: null as AuthSessionBoundary | null } },
    );
    expect(result.current.client).toBeNull();
    rerender({ auth: next });
    expect(result.current).toBe(next.getSnapshot());
    next.dispose();
  });

  it("does not revert to a stale boundary's snapshot after A → B → A switching", () => {
    const first = activated(SESSION_A);
    const second = activated(SESSION_B);
    const { result, rerender } = renderHook(
      ({ auth }: { auth: AuthSessionBoundary | null }) => useAuthSession(auth),
      { initialProps: { auth: first as AuthSessionBoundary | null } },
    );
    rerender({ auth: second });
    act(() => first.transition("expired"));
    expect(result.current).toBe(second.getSnapshot());
    rerender({ auth: first });
    expect(result.current).toBe(first.getSnapshot());
    expect(result.current).toMatchObject({ phase: "expired", client: null });
    first.dispose();
    second.dispose();
  });

  it("renders the replacement boundary's phase and client without exposing the old one", () => {
    const first = activated();
    const second = boundary();
    const { rerender } = render(<TestProbe auth={first} />);
    expect(screen.getByRole("status", { name: "API client visibility" }).textContent).toBe("Authenticated client");
    rerender(<TestProbe auth={second} />);
    expect(screen.getByRole("status", { name: "Authentication phase" }).textContent).toBe("signed-out");
    expect(screen.getByRole("status", { name: "API client visibility" }).textContent).toBe("No client");
    first.dispose();
    second.dispose();
  });
});

describe("useAuthSession — React subscription lifecycle", () => {
  it("subscribes to an active boundary and unsubscribes on unmount", () => {
    const auth = boundary();
    const tracked = observed(auth);
    const { unmount } = renderHook(() => useAuthSession(tracked.boundary));
    expect(tracked.counts().subscribes).toBeGreaterThan(0);
    expect(tracked.counts().active).toBe(1);
    unmount();
    expect(tracked.counts().active).toBe(0);
    expect(tracked.counts().unsubscribes).toBe(tracked.counts().subscribes);
    auth.dispose();
  });

  it("does not resubscribe on an unrelated parent rerender", () => {
    const auth = boundary();
    const tracked = observed(auth);
    const { rerender } = renderHook(() => useAuthSession(tracked.boundary));
    const before = tracked.counts();
    rerender();
    expect(tracked.counts()).toEqual(before);
    auth.dispose();
  });

  it("does not resubscribe on a snapshot transition", () => {
    const auth = boundary();
    const tracked = observed(auth);
    renderHook(() => useAuthSession(tracked.boundary));
    const before = tracked.counts();
    act(() => auth.activate(SESSION_A));
    expect(tracked.counts()).toEqual(before);
    auth.dispose();
  });

  it("removes old subscriptions and establishes new ones on boundary replacement", () => {
    const first = boundary();
    const second = boundary();
    const trackedFirst = observed(first);
    const trackedSecond = observed(second);
    const { rerender, unmount } = renderHook(
      ({ auth }: { auth: AuthSessionBoundary | null }) => useAuthSession(auth),
      { initialProps: { auth: trackedFirst.boundary as AuthSessionBoundary | null } },
    );
    expect(trackedFirst.counts().active).toBe(1);
    rerender({ auth: trackedSecond.boundary });
    expect(trackedFirst.counts().active).toBe(0);
    expect(trackedSecond.counts().active).toBe(1);
    unmount();
    expect(trackedSecond.counts().active).toBe(0);
    first.dispose();
    second.dispose();
  });

  it("drops its old subscription when the prop becomes null", () => {
    const auth = boundary();
    const tracked = observed(auth);
    const { rerender } = renderHook(
      ({ value }: { value: AuthSessionBoundary | null }) => useAuthSession(value),
      { initialProps: { value: tracked.boundary as AuthSessionBoundary | null } },
    );
    expect(tracked.counts().active).toBe(1);
    rerender({ value: null });
    expect(tracked.counts().active).toBe(0);
    auth.dispose();
  });

  it("does not deliver stale updates to an unmounted hook", () => {
    const auth = boundary();
    const renders: AuthSessionPhase[] = [];
    const { unmount } = renderHook(() => {
      const snapshot = useAuthSession(auth);
      renders.push(snapshot.phase);
      return snapshot;
    });
    const countBeforeUnmount = renders.length;
    unmount();
    act(() => auth.activate(SESSION_A));
    act(() => auth.transition("signed-out"));
    expect(renders).toHaveLength(countBeforeUnmount);
    auth.dispose();
  });

  it("publishes terminal disposal as revoked while observers are still mounted", () => {
    const auth = activated();
    const { result } = renderHook(() => useAuthSession(auth));
    act(() => auth.dispose());
    expect(result.current.phase).toBe("revoked");
    expect(result.current.client).toBeNull();
    expect(result.current).toBe(auth.getSnapshot());
  });
});

describe("useAuthSession — server-rendering boundary", () => {
  it("renders signed out during SSR even when an authenticated boundary is passed", () => {
    const auth = activated();
    const html = renderToString(<TestProbe auth={auth} />);
    expect(html).toContain("signed-out");
    expect(html).toContain("No client");
    expect(html).not.toContain("Authenticated client");
    auth.dispose();
  });

  it("does not serialize subject, tenant, session, or token values in SSR markup", () => {
    const auth = activated();
    const html = renderToString(<TestProbe auth={auth} />);
    for (const value of [TOKEN_A, SESSION_A.subjectKey, SESSION_A.tenantKey, SESSION_A.sessionKey]) {
      expect(html).not.toContain(value);
    }
    auth.dispose();
  });

  it("returns exactly the disconnected snapshot during SSR for a null boundary", () => {
    const html = renderToString(<TestProbe auth={null} />);
    expect(html).toContain("signed-out");
    expect(html).toContain("No client");
    expect(html).toContain(">0<");
  });
});
