import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const command = process.platform === "win32" ? process.env.ComSpec : "npm";
const args =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "npm.cmd run build"]
    : ["run", "build"];
const build = spawnSync(command, args, {
  cwd: root,
  env: { ...process.env, ICEBREAKER_BASE_PATH: "/ICEbreaker" },
  stdio: "inherit",
});

if (build.error) {
  throw build.error;
}

if (build.status !== 0) {
  process.exit(build.status || 1);
}

await import("./render-github-pages.mjs");
