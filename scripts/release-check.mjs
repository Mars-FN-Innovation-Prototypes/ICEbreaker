import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
const root = "work/github-pages";
const html = await readFile(join(root, "index.html"), "utf8");
assert.match(html, /Content-Security-Policy/);
assert.match(html, /\/ICEbreaker\/assets\//);
assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/);
const files = await readdir(root, { recursive: true });
assert.ok(
  !files.some((file) =>
    /(^|[/\\])(\.env[^/\\]*|node_modules|server|\.openai)([/\\]|$)|\.map$|\.pem$|\.key$/i.test(
      file,
    ),
  ),
  "Unexpected runtime, secrets or source maps in release",
);
let js = 0;
for (const name of files.filter((file) => file.endsWith(".js"))) {
  const content = await readFile(join(root, name));
  js += gzipSync(content).length;
  assert.doesNotMatch(
    content.toString(),
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  );
}
assert.ok(js < 350 * 1024, `Compressed JS budget exceeded: ${js}`);
const release = JSON.parse(await readFile(join(root, "release.json"), "utf8"));
assert.equal(release.mode, "prototype");
assert.match(release.commit, /^[0-9a-f]{40}$/);
assert.equal(
  release.trackedChanges,
  false,
  "Commit the reviewed changes before releasing an artifact",
);
console.log(
  `Release verified: prototype only; all JavaScript ${Math.ceil(js / 1024)} KiB gzip; source ${release.commit}`,
);
