import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "work", "github-pages");
if (output !== resolve(root, "work/github-pages"))
  throw new Error("Unexpected artifact path");
const html = await readFile(resolve(root, "dist/client/index.html"), "utf8");
if (!html.includes("/ICEbreaker/assets/"))
  throw new Error("Incorrect GitHub Pages base path");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "dist/client"), output, { recursive: true });
await writeFile(resolve(output, "404.html"), html);
await writeFile(resolve(output, ".nojekyll"), "");
console.log(`GitHub Pages artifact prepared at ${output}`);
