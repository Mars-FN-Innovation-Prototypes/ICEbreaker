import { build } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { assertPrototypeBuild } from "./build-policy.mjs";
assertPrototypeBuild(process.env);
await build();
await build({
  build: {
    ssr: "app/entry-server.tsx",
    outDir: "dist/prerender",
    emptyOutDir: true,
  },
  publicDir: false,
});
const { render } = await import("../dist/prerender/entry-server.js");
let html = (await readFile("dist/client/index.html", "utf8")).replace(
  "<!--app-html-->",
  render(),
);
const csp =
  "default-src 'none'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'";
html = html.replace(
  '<meta charset="UTF-8" />',
  `<meta charset="UTF-8" /><meta http-equiv="Content-Security-Policy" content="${csp}" />`,
);
await writeFile("dist/client/index.html", html);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const trackedChanges =
  execFileSync("git", ["diff", "HEAD", "--name-only"], {
    encoding: "utf8",
  }).trim().length > 0;
await writeFile(
  "dist/client/release.json",
  JSON.stringify(
    {
      mode: "prototype",
      commit,
      trackedChanges,
      builtAt: new Date().toISOString(),
      lockfileSha256: createHash("sha256")
        .update(await readFile("package-lock.json"))
        .digest("hex"),
      indexSha256: createHash("sha256").update(html).digest("hex"),
    },
    null,
    2,
  ),
);
