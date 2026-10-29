import { parseApiBasePath } from "@bandha/aim-platform/config";

/**
 * AAS–AIM browser HTTP transport boundary.
 *
 * This module defines NO routes, auth tokens, tenant identity, or engineering
 * business rules. A future generated OpenAPI client will supply route contracts,
 * while a validated decoder must turn untrusted JSON into presentation data.
 *
 * Same-origin cookies may be sent by the browser; the authoritative server must
 * enforce authentication, authorization, CSRF defenses, and audit controls.
 */

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "ABORTED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "HTTP_ERROR"
  | "INVALID_CONTENT_TYPE"
  | "INVALID_JSON"
  | "INVALID_RESPONSE";

/** Stable, deliberately non-sensitive errors for presentation/logging boundaries. */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;

  constructor(code: ApiErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

export type QueryScalar = string | number | boolean;

export type RequestBase<T> = Readonly<{
  /** Explicit path segments; never a URL, query string, or fragment. */
  pathSegments: readonly string[];
  query?: Readonly<Record<string, QueryScalar>>;
  /** Must validate UNKNOWN JSON at runtime, not just cast to T. */
  decode: (input: unknown) => T;
  signal?: AbortSignal;
}>;

export type JsonApiRequest<T> =
  | (RequestBase<T> & Readonly<{
      method?: "GET" | "DELETE";
      json?: never;
    }>)
  | (RequestBase<T> & Readonly<{
      method: "POST" | "PUT" | "PATCH";
      json: unknown;
    }>);

export type ApiClientOptions = Readonly<{
  /** A same-origin path, such as /api, from validated public configuration. */
  apiBasePath: string;
  /** Whole fetch-and-read deadline, in milliseconds; default is 15,000. */
  timeoutMs?: number;
  /** Test seam; leave unset in production to use the browser's fetch. */
  fetchImpl?: typeof fetch;
}>;

export type ApiClient = Readonly<{
  request<T>(request: JsonApiRequest<T>): Promise<T>;
}>;

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;
const SAFE_QUERY_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;
const JSON_CONTENT_TYPE = /^application\/(?:json|[a-z0-9][a-z0-9._-]*\+json)$/;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

function invalidRequest(): ApiClientError {
  return new ApiClientError("INVALID_REQUEST", "Invalid API request configuration.");
}

/** Avoid accidentally addressing another origin, decoding paths, or dot segments. */
function makeRequestPath(
  base: string,
  segments: readonly string[],
  query: Readonly<Record<string, QueryScalar>> | undefined,
): string {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw invalidRequest();
  }

  if (!segments.every((segment) => typeof segment === "string" && SAFE_SEGMENT.test(segment))) {
    throw invalidRequest();
  }

  const suffix = segments.map((segment) => encodeURIComponent(segment)).join("/");
  const params = new URLSearchParams();

  if (query !== undefined) {
    if (query === null || typeof query !== "object" || Array.isArray(query)) {
      throw invalidRequest();
    }
    for (const [key, value] of Object.entries(query)) {
      if (!SAFE_QUERY_KEY.test(key)) {
        throw invalidRequest();
      }
      if (
        typeof value !== "string" &&
        typeof value !== "boolean" &&
        !(typeof value === "number" && Number.isFinite(value))
      ) {
        throw invalidRequest();
      }
      params.append(key, String(value));
    }
  }

  const search = params.toString();
  return `${base}/${suffix}${search ? `?${search}` : ""}`;
}

function serializeJson(input: unknown): string {
  try {
    const output = JSON.stringify(input, (_key, value: unknown) => {
      // JSON.stringify normally changes NaN/Infinity to null; never do so silently.
      if (
        (typeof value === "number" && !Number.isFinite(value)) ||
        value === undefined ||
        typeof value === "function" ||
        typeof value === "symbol" ||
        typeof value === "bigint"
      ) {
        throw invalidRequest();
      }
      return value;
    });
    if (typeof output !== "string") {
      throw invalidRequest();
    }
    return output;
  } catch {
    throw invalidRequest();
  }
}

/** Read a bounded JSON response; reject missing bodies and oversized payloads. */
async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    throw new ApiClientError("INVALID_RESPONSE", "The API returned no JSON content.");
  }

  const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType === undefined || !JSON_CONTENT_TYPE.test(mediaType)) {
    throw new ApiClientError("INVALID_CONTENT_TYPE", "The API did not return JSON.");
  }

  const declaredSize = response.headers.get("content-length");
  if (declaredSize !== null && Number(declaredSize) > MAX_RESPONSE_BYTES) {
    throw new ApiClientError("INVALID_RESPONSE", "The API response exceeds the size limit.");
  }

  // Streaming imposes a real byte cap even if Content-Length is absent or false.
  // A standard Fetch Response has a ReadableStream body; a bodyless 200 is invalid.
  if (response.body === null) {
    throw new ApiClientError("INVALID_RESPONSE", "The API returned no JSON content.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let totalBytes = 0;
  let completed = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        completed = true;
        break;
      }
      totalBytes += chunk.value.byteLength;
      if (totalBytes > MAX_RESPONSE_BYTES) {
        throw new ApiClientError("INVALID_RESPONSE", "The API response exceeds the size limit.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } catch (error: unknown) {
    if (error instanceof ApiClientError) throw error;
    if (error instanceof TypeError) {
      throw new ApiClientError("INVALID_JSON", "The API response is not valid UTF-8 JSON.");
    }
    throw error;
  } finally {
    if (!completed) {
      // Stop consuming an oversized/invalid stream without delaying the error.
      void reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }

  if (text.trim() === "") {
    throw new ApiClientError("INVALID_JSON", "The API returned empty JSON.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiClientError("INVALID_JSON", "The API returned malformed JSON.");
  }
}

/**
 * Create a transport only. Nothing is sent until request() is explicitly used.
 * No routes are assumed to exist, and no response is trusted without a decoder.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  let apiBasePath: string;
  try {
    apiBasePath = parseApiBasePath(options.apiBasePath);
  } catch {
    throw invalidRequest();
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw invalidRequest();
  }

  const transport = options.fetchImpl ?? fetch;

  return Object.freeze({
    async request<T>(request: JsonApiRequest<T>): Promise<T> {
      if (typeof request.decode !== "function") {
        throw invalidRequest();
      }

      const path = makeRequestPath(apiBasePath, request.pathSegments, request.query);
      const method = request.method ?? "GET";
      let body: string | undefined;
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        body = serializeJson(request.json);
      } else if (method !== "GET" && method !== "DELETE") {
        throw invalidRequest();
      } else if ("json" in request) {
        throw invalidRequest();
      }

      if (request.signal?.aborted) {
        throw new ApiClientError("ABORTED", "The API request was cancelled.");
      }

      const controller = new AbortController();
      let timedOut = false;
      const abortOnCallerSignal = () => controller.abort();
      request.signal?.addEventListener("abort", abortOnCallerSignal, { once: true });
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const response = await transport(path, {
          method,
          mode: "same-origin",
          credentials: "same-origin",
          redirect: "error",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          ...(body !== undefined ? { body } : {}),
          signal: controller.signal,
        });

        // Never echo backend bodies: they can contain private tenant information.
        if (!response.ok) {
          throw new ApiClientError(
            "HTTP_ERROR",
            `The API request failed (HTTP ${response.status}).`,
            response.status,
          );
        }

        const json = await readJson(response);
        // Also cover injected transports which do not obey AbortSignal.
        if (controller.signal.aborted) {
          throw new ApiClientError("ABORTED", "The API request was cancelled.");
        }
        try {
          return request.decode(json);
        } catch {
          throw new ApiClientError("INVALID_RESPONSE", "The API response failed validation.");
        }
      } catch (error: unknown) {
        if (timedOut) {
          throw new ApiClientError("TIMEOUT", "The API request timed out.");
        }
        if (request.signal?.aborted) {
          throw new ApiClientError("ABORTED", "The API request was cancelled.");
        }
        if (error instanceof ApiClientError) {
          throw error;
        }
        throw new ApiClientError("NETWORK_ERROR", "The API could not be reached.");
      } finally {
        clearTimeout(timeoutId);
        request.signal?.removeEventListener("abort", abortOnCallerSignal);
      }
    },
  });
}
