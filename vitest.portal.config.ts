import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config for the PORTAL test suite, kept at the repo root on purpose.
 *
 * The portal deploys standalone on Vercel (root directory = `portal/`), and
 * `next build` type-checks every `.ts` under `portal/`. A `vitest.config.ts`
 * inside `portal/` would be type-checked and fail, because `vitest` is only a
 * dependency of the root `package.json`, not the portal's. Keeping this config
 * at the repo root sidesteps that entirely while still letting the portal suite
 * run from the root (where vitest is installed).
 *
 *   pnpm test:portal      → root package.json script
 *   (locally needs NODE_OPTIONS=--use-system-ca to reach Supabase in some envs)
 */
export default defineConfig({
  test: {
    globals: true,
    include: ["portal/__tests__/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "portal"),
    },
  },
});
