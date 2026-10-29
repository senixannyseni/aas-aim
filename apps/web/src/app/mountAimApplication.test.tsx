// @vitest-environment jsdom

import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type TrustedAuthEvent, type TrustedIdentitySource } from "../shared/auth/authBootstrap";
import { type AuthSessionActivation } from "../shared/auth/authSession";
import { mountAimApplication, type MountedAimApplication } from "./mountAimApplication";

/**
 * File 57 — application entry-point regression tests.
 *
 * All identities, tenants, bearer strings and records are synthetic. Nothing
 * here supplies login credentials to production or asserts backend permission.
 */
const USER_A: AuthSessionActivation = {
  subjectKey: "fixture-user-a",
  tenantKey: "fixture-tenant-a",
  sessionKey: "fixture-session-a",
  getAccessToken: () => "fixture-token-a",
};
const USER_B: AuthSessionActivation = {
  subjectKey: "fixture-user-b",
  tenantKey: "fixture-tenant-b",
  sessionKey: "fixture-session-b",
  getAccessToken: () => "fixture-token-b",
};

type SourceFixture = Readonly<{
  identitySource: TrustedIdentitySource;
  emit: (event: TrustedAuthEvent) => void;
  emitLate: (event: TrustedAuthEvent) => void;
  subscribed: () => number;
  tornDown: () => number;
  signal: () => AbortSignal | null;
}>;

function sourceFixture(initial?: TrustedAuthEvent): SourceFixture {
  let eventHandler: ((event: TrustedAuthEvent) => void) | null = null;
  let lastHandler: ((event: TrustedAuthEvent) => void) | null = null;
  let currentSignal: AbortSignal | null = null;
  let subscribed = 0;
  let tornDown = 0;
  const identitySource: TrustedIdentitySource = {
    subscribe(onEvent, signal) {
      subscribed++;
      eventHandler = onEvent;
      lastHandler = onEvent;
      currentSignal = signal;
      if (initial) onEvent(initial); // IdPs may notify synchronously.
      return () => {
        tornDown++;
        eventHandler = null;
      };
    },
  };
  return {
    identitySource,
    emit(event) {
      if (!eventHandler) throw new Error("Test source not subscribed.");
      eventHandler(event);
    },
    emitLate(event) { lastHandler?.(event); },
    subscribed: () => subscribed,
    tornDown: () => tornDown,
    signal: () => currentSignal,
  };
}

function pageFor(name: string): unknown {
  return {
    items: [{
      id: `fixture-id-${name}`,
      tag: `fixture-tag-${name}`,
      name,
      riskClassification: {
        level: "UNKNOWN",
        basisRecordId: "fixture-risk-basis",
        assessedAt: "2026-10-20T00:00:00Z",
      },
    }],
    pageInfo: {
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
    },
  };
}

function jsonPage(name: string): Response {
  return new Response(JSON.stringify(pageFor(name)), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const mounted = new Set<MountedAimApplication>();
const containers = new Set<HTMLDivElement>();

function mount(identitySource?: TrustedIdentitySource | null): MountedAimApplication {
  const container = document.createElement("div");
  document.body.append(container);
  containers.add(container);
  let app!: MountedAimApplication;
  act(() => {
    app = mountAimApplication(container,
      identitySource === undefined ? {} : { identitySource });
  });
  mounted.add(app);
  return app;
}

function disconnected(): void {
  expect(screen.getByText("Asset Register API is not connected.")).toBeDefined();
  expect(screen.queryByRole("table")).toBeNull();
}

afterEach(() => {
  for (const app of mounted) act(() => app.dispose());
  mounted.clear();
  cleanup();
  for (const container of containers) container.remove();
  containers.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mountAimApplication — explicit trusted bootstrap", () => {
  it("starts disconnected even when API configuration is missing or invalid", () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "not-a-path");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    mount();
    disconnected();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats an explicitly null identity source as disconnected", () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "not-a-path");
    mount(null);
    disconnected();
  });

  it("rejects invalid API configuration before subscribing to a trusted source", () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "https://different-host.invalid/api");
    const source = sourceFixture();
    expect(() => mount(source.identitySource)).toThrow();
    expect(source.subscribed()).toBe(0);
  });

  it("subscribes exactly once outside React StrictMode and disposes exactly once", () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "/api");
    const source = sourceFixture();
    const app = mount(source.identitySource);
    expect(source.subscribed()).toBe(1);
    disconnected();
    act(() => app.dispose());
    act(() => app.dispose());
    expect(source.signal()?.aborted).toBe(true);
    expect(source.tornDown()).toBe(1);
  });

  it("accepts a synchronous reviewed-source activation and fetches the current page", async () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "/api");
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Headers(init?.headers).get("authorization") ?? "");
      return jsonPage("Synthetic mount asset A");
    }));
    const source = sourceFixture({ type: "authenticated", session: USER_A });
    mount(source.identitySource);
    await waitFor(() => expect(screen.getByText("Synthetic mount asset A")).toBeDefined());
    expect(source.subscribed()).toBe(1);
    expect(requests).toEqual(["Bearer fixture-token-a"]);
  });

  it("removes the previous page immediately on sign-out", async () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "/api");
    vi.stubGlobal("fetch", vi.fn(async () => jsonPage("Synthetic mount asset A")));
    const source = sourceFixture({ type: "authenticated", session: USER_A });
    mount(source.identitySource);
    await waitFor(() => expect(screen.getByText("Synthetic mount asset A")).toBeDefined());
    act(() => source.emit({ type: "signed-out" }));
    disconnected();
    expect(screen.queryByText("Synthetic mount asset A")).toBeNull();
  });

  it("rotates API identity and shows only the new tenant's records", async () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "/api");
    const tokens: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get("authorization") ?? "";
      tokens.push(auth);
      return jsonPage(auth.endsWith("fixture-token-a")
        ? "Synthetic tenant A asset" : "Synthetic tenant B asset");
    }));
    const source = sourceFixture({ type: "authenticated", session: USER_A });
    mount(source.identitySource);
    await waitFor(() => expect(screen.getByText("Synthetic tenant A asset")).toBeDefined());
    act(() => source.emit({ type: "authenticated", session: USER_B }));
    expect(screen.queryByText("Synthetic tenant A asset")).toBeNull();
    await waitFor(() => expect(screen.getByText("Synthetic tenant B asset")).toBeDefined());
    expect(tokens).toEqual(["Bearer fixture-token-a", "Bearer fixture-token-b"]);
  });

  it("disposal revokes access and ignores late identity callbacks", async () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "/api");
    const fetchSpy = vi.fn(async () => jsonPage("Synthetic mount asset A"));
    vi.stubGlobal("fetch", fetchSpy);
    const source = sourceFixture();
    const app = mount(source.identitySource);
    act(() => app.dispose());
    expect(source.signal()?.aborted).toBe(true);
    act(() => source.emitLate({ type: "authenticated", session: USER_A }));
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps a source failure disconnected and does not reactivate on late events", () => {
    vi.stubEnv("VITE_AIM_API_BASE_PATH", "/api");
    let late: ((event: TrustedAuthEvent) => void) | null = null;
    const identitySource: TrustedIdentitySource = {
      subscribe(onEvent) {
        late = onEvent;
        throw new Error("Sensitive IdP diagnostic");
      },
    };
    mount(identitySource);
    disconnected();
    const deliver = late as ((event: TrustedAuthEvent) => void) | null;
    if (deliver !== null) {
      act(() => deliver({ type: "authenticated", session: USER_A }));
    }
    disconnected();
  });
});
