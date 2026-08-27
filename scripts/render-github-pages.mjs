import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const clientDirectory = resolve(root, "dist", "client");
const outputDirectory = resolve(root, "work", "github-pages");
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("github-pages", `${Date.now()}`);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(clientDirectory, outputDirectory, { recursive: true });

const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request("https://mars-fn-innovation-prototypes.github.io/ICEbreaker/", {
    headers: {
      accept: "text/html",
      "x-forwarded-host": "mars-fn-innovation-prototypes.github.io",
      "x-forwarded-proto": "https",
    },
  }),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  { waitUntil() {}, passThroughOnException() {} },
);

if (!response.ok) {
  throw new Error(
    `Static render failed with ${response.status} (${response.headers.get("location") || "no redirect"})`,
  );
}

const html = await response.text();
if (!html.includes('/ICEbreaker/assets/')) {
  throw new Error("Static render did not include the GitHub Pages base path");
}

await Promise.all([
  writeFile(resolve(outputDirectory, "index.html"), html),
  writeFile(resolve(outputDirectory, "404.html"), html),
  writeFile(resolve(outputDirectory, ".nojekyll"), ""),
]);

console.log(`GitHub Pages artifact prepared at ${outputDirectory}`);
