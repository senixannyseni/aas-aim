/**
 * Public browser configuration for the AAS–AIM web client.
 *
 * Vite embeds VITE_* variables in client-side JavaScript. They must never
 * contain credentials, tokens, signing keys, or other secrets.
 *
 * This module validates configuration only. It does not connect to an API,
 * grant permissions, or establish an authenticated session.
 */
export type PublicAppConfig = Readonly<{
  apiBasePath: string;
}>;

// A single, same-origin absolute path with ordinary URL path segments.
// Examples: /api, /api/v1. Deliberately reject URLs, query strings, path
// traversal, encodings, whitespace, and trailing slashes.
const API_BASE_PATH_PATTERN = /^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/;

/** Validate a public API base path without silently guessing a default. */
export function parseApiBasePath(value: unknown): string {
  if (typeof value !== "string" || !API_BASE_PATH_PATTERN.test(value)) {
    throw new Error(
      "Invalid VITE_AIM_API_BASE_PATH: expected a same-origin path " +
        'such as "/api" or "/api/v1", without a trailing slash.',
    );
  }

  return value;
}

/**
 * Validate public configuration supplied by the application entry point.
 *
 * Reading Vite's import.meta.env belongs to the Vite application module,
 * not to this shared workspace package. A missing or invalid path still
 * fails closed through parseApiBasePath; this is not an auth boundary.
 */
export function readPublicConfig(rawApiBasePath: unknown): PublicAppConfig {
  return Object.freeze({
    apiBasePath: parseApiBasePath(rawApiBasePath),
  });
}
