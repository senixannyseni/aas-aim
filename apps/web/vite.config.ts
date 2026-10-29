import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Bandha AIM browser prototype build configuration.
 *
 * Vite serves and bundles the presentation client only. The authoritative
 * engineering API, authentication, authorization, and audit controls belong
 * to the backend and are not implemented by this configuration.
 */
export default defineConfig({
  plugins: [react()],

  // Keep local development private by default; never expose the dev server
  // to a network unless an explicit, reviewed development need requires it.
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },

  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },

  build: {
    target: "es2023",
    outDir: "dist",
    sourcemap: false,
  },
});
