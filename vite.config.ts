// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// NITRO_PRESET env var lets us swap the build target.
// - Default (unset): Cloudflare Workers (Lovable Cloud preview/deploy)
// - "node-server":    Standalone Node server for Azure Container Apps / App Service
// - "azure":          Azure Static Web Apps
const preset = process.env.NITRO_PRESET;

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  ...(preset ? { nitro: { preset } } : {}),
});
