import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function text(relative) {
  return readFile(path.join(root, relative), "utf8");
}

test("standalone repository contains one valid root action entrypoint", async () => {
  const rootFiles = await readdir(root);
  assert.deepEqual(rootFiles.filter((name) => /^action\.ya?ml$/i.test(name)), ["action.yml"]);

  const metadata = await text("action.yml");
  assert.match(metadata, /^name:\s*"CRA Release Evidence"/m);
  assert.match(metadata, /^description:/m);
  assert.match(metadata, /using:\s*"node24"/);
  assert.match(metadata, /main:\s*"action\/index\.mjs"/);
  assert.match(metadata, /SPDX JSON or CycloneDX JSON/);
  assert.match(metadata, /evidence-source-sha:/);
  await access(path.join(root, "action", "index.mjs"));
});

test("package, schema, and generator versions agree", async () => {
  const packageJson = JSON.parse(await text("package.json"));
  const schema = JSON.parse(await text("schema/evidence.schema.json"));
  const source = await text("action/index.mjs");

  assert.equal(packageJson.version, "0.1.0");
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
  assert.equal(schema.properties.schemaVersion.const, packageJson.version);
  assert.equal(schema.properties.generator.properties.version.const, packageJson.version);
  assert.equal(schema.properties.sbom.properties.valid, undefined);
  for (const field of ["structureRecognized", "schemaValidation", "recognitionIssues", "parseStatus"]) {
    assert.ok(schema.properties.sbom.required.includes(field), `SBOM schema must require ${field}`);
  }
  assert.match(source, /version:\s*"0\.1\.0"/);
  assert.doesNotMatch(source, /0\.1\.0-prototype/);
});

test("foreign actions are pinned to full SHAs", async () => {
  const files = [".github/workflows/ci.yml", "examples/release-evidence.yml"];
  for (const file of files) {
    const source = await text(file);
    for (const match of source.matchAll(/uses:\s*(actions\/[^@\s]+)@([^\s#]+)/g)) {
      assert.match(match[2], /^[0-9a-f]{40}$/i, `${file}: ${match[1]} must use a full SHA`);
    }
  }
});

test("export excludes the website and preserves the safety boundary", async () => {
  const rootFiles = new Set(await readdir(root));
  for (const forbidden of ["app", "public", "worker", "build", "next.config.ts", "vite.config.ts"]) {
    assert.equal(rootFiles.has(forbidden), false, `${forbidden} must not be in the Action-only repository`);
  }

  const [readme, privacy, pilot] = await Promise.all([
    text("README.md"),
    text("PRIVACY.md"),
    text("docs/PILOT.md"),
  ]);
  assert.match(readme, /general CRA scanner/i);
  assert.match(readme, /never a compliance status/i);
  assert.match(privacy, /no vendor backend/i);
  assert.match(pilot, /100 verified activations/i);
  assert.match(pilot, /10 qualified willingness-to-pay/i);
});
