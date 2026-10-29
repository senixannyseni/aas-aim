import { describe, expect, it } from "vitest";

import {
  ApiClientError,
  createApiClient,
  type ApiClient,
  type ApiErrorCode,
} from "./apiClient";

/**
 * HTTP transport regression contract for the browser-only AIM client.
 *
 * All routes/payloads are synthetic test fixtures. No API is called, no
 * authorization is inferred, and no Java/OpenAPI contract is being asserted.
 * Native Response and AbortController are supported by the required Node 24+.
 */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

type CapturedCall = Readonly<{
  input: RequestInfo | URL;
  init: RequestInit | undefined;
}>;

function fakeFetch(handler: typeof fetch): {
  fetchImpl: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ input, init });
    return handler(input, init);
  };
  return { fetchImpl, calls };
}

function jsonResponse(value: unknown, contentType = "application/json"): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": contentType },
  });
}

function simpleClient(fetchImpl: typeof fetch, timeoutMs = 15_000): ApiClient {
  return createApiClient({ apiBasePath: "/api", fetchImpl, timeoutMs });
}

function getUnknown(client: ApiClient): Promise<unknown> {
  return client.request({ pathSegments: ["assets"], decode: (value) => value });
}

async function expectApiError(
  operation: Promise<unknown>,
  code: ApiErrorCode,
  status: number | null = null,
): Promise<ApiClientError> {
  try {
    await operation;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ApiClientError);
    const apiError = error as ApiClientError;
    expect(apiError.name).toBe("ApiClientError");
    expect(apiError.code).toBe(code);
    expect(apiError.status).toBe(status);
    return apiError;
  }
  throw new Error(`Expected the API client to reject with ${code}`);
}

function abortAwareHangingFetch(): typeof fetch {
  return async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException("Cancelled", "AbortError"));
        return;
      }
      signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Cancelled", "AbortError")),
        { once: true },
      );
    });
}

describe("createApiClient — configuration and request paths", () => {
  it("does not perform an HTTP request during construction", () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    simpleClient(transport.fetchImpl);
    expect(transport.calls).toHaveLength(0);
  });

  for (const base of ["", "/", "https://elsewhere.invalid/api", "//elsewhere.invalid", "/api/../admin", "/api/"]) {
    it(`rejects invalid API base path ${JSON.stringify(base)}`, () => {
      expect(() => createApiClient({ apiBasePath: base })).toThrow(ApiClientError);
    });
  }

  it("allows a nested same-origin API base path", async () => {
    const transport = fakeFetch(async () => jsonResponse([]));
    const client = createApiClient({ apiBasePath: "/api/v1", fetchImpl: transport.fetchImpl });
    await getUnknown(client);
    expect(transport.calls[0]?.input).toBe("/api/v1/assets");
  });

  for (const timeoutMs of [0, -1, 120_001, 1.4, NaN, Infinity]) {
    it(`rejects invalid request timeout ${String(timeoutMs)}`, () => {
      expect(() => createApiClient({ apiBasePath: "/api", timeoutMs })).toThrow(ApiClientError);
    });
  }

  it("rejects empty resource segments without fetching", async () => {
    const transport = fakeFetch(async () => jsonResponse([]));
    const client = simpleClient(transport.fetchImpl);
    await expectApiError(client.request({ pathSegments: [], decode: (value) => value }), "INVALID_REQUEST");
    expect(transport.calls).toHaveLength(0);
  });

  for (const segment of ["..", ".", "a/b", "a?b", "a#b", "https:", "a%2Fb", "a b", ""]) {
    it(`rejects unsafe path segment ${JSON.stringify(segment)}`, async () => {
      const transport = fakeFetch(async () => jsonResponse([]));
      await expectApiError(
        simpleClient(transport.fetchImpl).request({ pathSegments: ["assets", segment], decode: (v) => v }),
        "INVALID_REQUEST",
      );
      expect(transport.calls).toHaveLength(0);
    });
  }

  it("constructs a same-origin path and safely encodes query values", async () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    await simpleClient(transport.fetchImpl).request({
      pathSegments: ["asset-register", "ABC_123"],
      query: { search: "V-101 & Unit A", archived: false, page: 2 },
      decode: (value) => value,
    });
    expect(transport.calls[0]?.input).toBe(
      "/api/asset-register/ABC_123?search=V-101+%26+Unit+A&archived=false&page=2",
    );
  });

  for (const value of [NaN, Infinity, -Infinity, null, {}, [], undefined]) {
    it(`rejects invalid query values (${String(value)})`, async () => {
      const transport = fakeFetch(async () => jsonResponse({}));
      const query = { page: value } as unknown as Readonly<Record<string, string | number | boolean>>;
      await expectApiError(
        simpleClient(transport.fetchImpl).request({ pathSegments: ["assets"], query, decode: (v) => v }),
        "INVALID_REQUEST",
      );
      expect(transport.calls).toHaveLength(0);
    });
  }

  it("rejects query keys that could change URL structure", async () => {
    const transport = fakeFetch(async () => jsonResponse({}));
    await expectApiError(
      simpleClient(transport.fetchImpl).request({
        pathSegments: ["assets"], query: { "unsafe key": "x" }, decode: (v) => v,
      }),
      "INVALID_REQUEST",
    );
    expect(transport.calls).toHaveLength(0);
  });

  it("rejects a missing runtime decoder before making a request", async () => {
    const transport = fakeFetch(async () => jsonResponse({}));
    await expectApiError(
      simpleClient(transport.fetchImpl).request({ pathSegments: ["assets"] } as never),
      "INVALID_REQUEST",
    );
    expect(transport.calls).toHaveLength(0);
  });
});

describe("createApiClient — HTTP methods, headers and bodies", () => {
  it("defaults to GET with same-origin credentials, no redirects and no cache", async () => {
    const transport = fakeFetch(async () => jsonResponse({ ok: true }));
    const result = await getUnknown(simpleClient(transport.fetchImpl));
    expect(result).toEqual({ ok: true });
    const init = transport.calls[0]?.init;
    expect(init?.method).toBe("GET");
    expect(init?.mode).toBe("same-origin");
    expect(init?.credentials).toBe("same-origin");
    expect(init?.redirect).toBe("error");
    expect(init?.cache).toBe("no-store");
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(init?.body).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("allows DELETE without a request body", async () => {
    const transport = fakeFetch(async () => jsonResponse({ deleted: true }));
    await simpleClient(transport.fetchImpl).request({ method: "DELETE", pathSegments: ["assets", "A-1"], decode: (v) => v });
    expect(transport.calls[0]?.init?.method).toBe("DELETE");
    expect(transport.calls[0]?.init?.body).toBeUndefined();
  });

  for (const method of ["POST", "PUT", "PATCH"] as const) {
    it(`serializes a ${method} JSON request without transforming finite values`, async () => {
      const transport = fakeFetch(async () => jsonResponse({ saved: true }));
      await simpleClient(transport.fetchImpl).request({
        method,
        pathSegments: ["assets"],
        json: { thickness: 0.004, accepted: false, tags: ["V-101"] },
        decode: (v) => v,
      });
      const init = transport.calls[0]?.init;
      expect(init?.method).toBe(method);
      expect(init?.body).toBe('{"thickness":0.004,"accepted":false,"tags":["V-101"]}');
      expect(init?.headers).toEqual({ Accept: "application/json", "Content-Type": "application/json" });
    });
  }

  for (const invalidValue of [NaN, Infinity, -Infinity, undefined, 1n, () => "unexpected", Symbol("bad")]) {
    it(`rejects an unsafe nested JSON value (${typeof invalidValue}: ${String(invalidValue)})`, async () => {
      const transport = fakeFetch(async () => jsonResponse({}));
      await expectApiError(
        simpleClient(transport.fetchImpl).request({
          method: "POST", pathSegments: ["assets"], json: { nested: [invalidValue] }, decode: (v) => v,
        }),
        "INVALID_REQUEST",
      );
      expect(transport.calls).toHaveLength(0);
    });
  }

  it("rejects circular JSON instead of sending a partial payload", async () => {
    const transport = fakeFetch(async () => jsonResponse({}));
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    await expectApiError(
      simpleClient(transport.fetchImpl).request({ method: "POST", pathSegments: ["assets"], json: circular, decode: (v) => v }),
      "INVALID_REQUEST",
    );
    expect(transport.calls).toHaveLength(0);
  });

  it("rejects a GET request with a body even if runtime code ignores the type contract", async () => {
    const transport = fakeFetch(async () => jsonResponse({}));
    await expectApiError(
      simpleClient(transport.fetchImpl).request({ method: "GET", json: { unsafe: true }, pathSegments: ["assets"], decode: (v: unknown) => v } as never),
      "INVALID_REQUEST",
    );
    expect(transport.calls).toHaveLength(0);
  });

  it("rejects an unsupported HTTP method", async () => {
    const transport = fakeFetch(async () => jsonResponse({}));
    await expectApiError(
      simpleClient(transport.fetchImpl).request({ method: "TRACE", pathSegments: ["assets"], decode: (v: unknown) => v } as never),
      "INVALID_REQUEST",
    );
    expect(transport.calls).toHaveLength(0);
  });
});

describe("createApiClient — response decoding and error boundaries", () => {
  it("returns the exact value produced by the required runtime decoder", async () => {
    const transport = fakeFetch(async () => jsonResponse({ assets: ["V-101"] }));
    const result = await simpleClient(transport.fetchImpl).request({
      pathSegments: ["assets"],
      decode: (input) => {
        if (typeof input !== "object" || input === null || !("assets" in input)) {
          throw new Error("shape mismatch");
        }
        return "decoded-record" as const;
      },
    });
    expect(result).toBe("decoded-record");
  });

  it("allows problem-independent vendor JSON content types", async () => {
    const transport = fakeFetch(async () => jsonResponse({ valid: true }, "application/vnd.aim+json; charset=utf-8"));
    expect(await getUnknown(simpleClient(transport.fetchImpl))).toEqual({ valid: true });
  });

  it("accepts case-insensitive JSON media types", async () => {
    const transport = fakeFetch(async () => jsonResponse({ valid: true }, "APPLICATION/JSON"));
    expect(await getUnknown(simpleClient(transport.fetchImpl))).toEqual({ valid: true });
  });

  it("reports HTTP failures without exposing server response bodies", async () => {
    const transport = fakeFetch(async () => new Response("TENANT_PRIVATE_INFORMATION", { status: 403 }));
    const error = await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "HTTP_ERROR", 403);
    expect(error.message).toContain("403");
    expect(error.message).not.toContain("TENANT_PRIVATE_INFORMATION");
  });

  it("does not pass rejected HTTP responses into a decoder", async () => {
    let decoded = false;
    const transport = fakeFetch(async () => new Response("{\"secret\":true}", { status: 500 }));
    await expectApiError(simpleClient(transport.fetchImpl).request({
      pathSegments: ["assets"], decode: (v) => { decoded = true; return v; },
    }), "HTTP_ERROR", 500);
    expect(decoded).toBe(false);
  });

  for (const contentType of ["text/html", "text/plain", "application/xml", "application/javascript", "application/jsonp"]) {
    it(`rejects unexpected content type ${contentType}`, async () => {
      const transport = fakeFetch(async () => jsonResponse({}, contentType));
      await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_CONTENT_TYPE");
    });
  }

  it("rejects missing Content-Type", async () => {
    const transport = fakeFetch(async () => new Response("{}", { status: 200 }));
    await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_CONTENT_TYPE");
  });

  it("rejects malformed JSON", async () => {
    const transport = fakeFetch(async () => new Response("{not-json", { headers: { "content-type": "application/json" } }));
    await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_JSON");
  });

  it("rejects empty JSON", async () => {
    const transport = fakeFetch(async () => new Response("  \n", { headers: { "content-type": "application/json" } }));
    await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_JSON");
  });

  it("rejects invalid UTF-8", async () => {
    const transport = fakeFetch(async () => new Response(new Uint8Array([0xff, 0xfe]), { headers: { "content-type": "application/json" } }));
    await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_JSON");
  });

  for (const status of [204, 205]) {
    it(`rejects ${status} because this transport requires JSON`, async () => {
      const transport = fakeFetch(async () => new Response(null, { status }));
      await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_RESPONSE");
    });
  }

  it("rejects a bodyless 200 response", async () => {
    const transport = fakeFetch(async () => new Response(null, { headers: { "content-type": "application/json" } }));
    await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_RESPONSE");
  });

  it("rejects declared oversize Content-Length before reading", async () => {
    const transport = fakeFetch(async () => new Response("{}", {
      headers: { "content-type": "application/json", "content-length": String(MAX_RESPONSE_BYTES + 1) },
    }));
    await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_RESPONSE");
  });

  it("enforces its real streaming size cap even without Content-Length", async () => {
    const transport = fakeFetch(async () => new Response(new Uint8Array(MAX_RESPONSE_BYTES + 1), {
      headers: { "content-type": "application/json" },
    }));
    await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "INVALID_RESPONSE");
  });

  it("converts decoder exceptions into sanitized validation errors", async () => {
    const transport = fakeFetch(async () => jsonResponse({ secret: "PRIVATE-TENANT-FIELD" }));
    const error = await expectApiError(simpleClient(transport.fetchImpl).request({
      pathSegments: ["assets"],
      decode: () => { throw new Error("PRIVATE-TENANT-FIELD"); },
    }), "INVALID_RESPONSE");
    expect(error.message).not.toContain("PRIVATE-TENANT-FIELD");
  });

  it("classifies and sanitizes transport failures", async () => {
    const transport = fakeFetch(async () => { throw new Error("PRIVATE URL, token, and stack trace"); });
    const error = await expectApiError(getUnknown(simpleClient(transport.fetchImpl)), "NETWORK_ERROR");
    expect(error.message).not.toContain("PRIVATE URL");
  });
});

describe("createApiClient — cancellation and deadlines", () => {
  it("does not fetch when a caller signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = fakeFetch(async () => jsonResponse({}));
    await expectApiError(simpleClient(transport.fetchImpl).request({
      pathSegments: ["assets"], decode: (v) => v, signal: controller.signal,
    }), "ABORTED");
    expect(transport.calls).toHaveLength(0);
  });

  it("cancels an in-flight request when the caller aborts", async () => {
    const controller = new AbortController();
    const transport = fakeFetch(abortAwareHangingFetch());
    const operation = simpleClient(transport.fetchImpl, 1_000).request({
      pathSegments: ["assets"], decode: (v) => v, signal: controller.signal,
    });
    controller.abort();
    await expectApiError(operation, "ABORTED");
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.init?.signal?.aborted).toBe(true);
  });

  it("classifies a fetch aborted by the timeout as TIMEOUT", async () => {
    const transport = fakeFetch(abortAwareHangingFetch());
    await expectApiError(getUnknown(simpleClient(transport.fetchImpl, 10)), "TIMEOUT");
    expect(transport.calls[0]?.init?.signal?.aborted).toBe(true);
  });

  it("does not let a timeout change a completed successful request", async () => {
    const transport = fakeFetch(async () => jsonResponse({ finished: true }));
    expect(await getUnknown(simpleClient(transport.fetchImpl, 10))).toEqual({ finished: true });
  });

  it("freezes the client interface to avoid accidental mutation", () => {
    const client = simpleClient(async () => jsonResponse({}));
    expect(Object.isFrozen(client)).toBe(true);
  });
});

// Static contract checks: this branch is never executed, but TypeScript still
// verifies the compile-time request discriminant and required JSON body.
if (false) {
  const client = simpleClient(async () => jsonResponse({}));
  // @ts-expect-error GET must never accept a JSON request body.
  void client.request({ method: "GET", pathSegments: ["assets"], json: {}, decode: (v: unknown) => v });
  // @ts-expect-error POST must have an explicit JSON request body.
  void client.request({ method: "POST", pathSegments: ["assets"], decode: (v: unknown) => v });
}
