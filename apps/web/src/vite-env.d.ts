/// <reference types="vite/client" />

/**
 * Public environment declarations for the AAS–AIM browser client.
 *
 * Keep this file free of import/export statements so these interfaces
 * augment Vite's global environment types.
 *
 * TypeScript declarations do not create environment variables or validate
 * their runtime values. Runtime validation belongs in shared/config/env.ts.
 */
interface ViteTypeOptions {
  /** Reject references to undeclared import.meta.env keys at type-check time. */
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  /** Public, same-origin API base path, for example "/api". */
  readonly VITE_AIM_API_BASE_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
