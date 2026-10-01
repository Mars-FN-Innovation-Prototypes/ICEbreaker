import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { assertPrototypeBuild, basePath } from "./scripts/build-policy.mjs";
export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), ["ICEBREAKER_", "VITE_"]),
    ...process.env,
  };
  assertPrototypeBuild(env);
  return {
    base: basePath(env.ICEBREAKER_BASE_PATH),
    plugins: [react()],
    server: { host: "localhost", strictPort: true },
    preview: { host: "localhost", strictPort: true },
    build: { outDir: "dist/client", sourcemap: false, assetsInlineLimit: 0 },
  };
});
