import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const actionPath = path.join(projectRoot, "action", "index.mjs");

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result;
}

function git(cwd, ...args) {
  const result = run("git", args, cwd);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

function normalizeForInput(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function schemaTypeMatches(expected, value) {
  if (expected === "null") return value === null;
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  return typeof value === expected;
}

function resolveSchemaPointer(rootSchema, pointer) {
  assert.match(pointer, /^#\//, `unsupported external schema reference: ${pointer}`);
  return pointer.slice(2).split("/").reduce((current, segment) => {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    assert.ok(current && Object.hasOwn(current, key), `unresolved schema reference: ${pointer}`);
    return current[key];
  }, rootSchema);
}

function assertMatchesProjectSchema(schema, value, rootSchema = schema, location = "$") {
  const supportedKeywords = new Set([
    "$schema", "$defs", "$ref", "title", "description", "type", "required", "properties",
    "additionalProperties", "const", "enum", "format", "items", "uniqueItems", "minimum",
    "minItems", "minLength", "pattern",
  ]);
  for (const keyword of Object.keys(schema)) {
    assert.ok(supportedKeywords.has(keyword), `project test validator does not implement schema keyword ${keyword} at ${location}`);
  }
  if (schema.$ref) return assertMatchesProjectSchema(resolveSchemaPointer(rootSchema, schema.$ref), value, rootSchema, location);

  if (Object.hasOwn(schema, "const")) assert.deepEqual(value, schema.const, `${location} must equal schema const`);
  if (schema.enum) {
    assert.ok(schema.enum.some((entry) => JSON.stringify(entry) === JSON.stringify(value)), `${location} must match schema enum`);
  }
  if (schema.type) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    assert.ok(expected.some((type) => schemaTypeMatches(type, value)), `${location} must have type ${expected.join(" or ")}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, `${location} is shorter than minLength`);
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern), `${location} must match schema pattern`);
    if (schema.format === "date-time") {
      assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)), `${location} must be a date-time`);
    }
  }
  if (typeof value === "number" && schema.minimum !== undefined) {
    assert.ok(value >= schema.minimum, `${location} must be >= ${schema.minimum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, `${location} has too few items`);
    if (schema.uniqueItems) {
      assert.equal(new Set(value.map((entry) => JSON.stringify(entry))).size, value.length, `${location} must contain unique items`);
    }
    if (schema.items) value.forEach((entry, index) => assertMatchesProjectSchema(schema.items, entry, rootSchema, `${location}[${index}]`));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      assert.ok(Object.hasOwn(value, required), `${location}.${required} is required by the project schema`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) assertMatchesProjectSchema(child, value[key], rootSchema, `${location}.${key}`);
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) assert.ok(allowed.has(key), `${location}.${key} is not allowed by the project schema`);
    }
  }
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "cra-release-evidence-"));
  git(root, "init");
  git(root, "config", "user.name", "Evidence Test");
  git(root, "config", "user.email", "evidence-test@example.invalid");

  await writeFile(path.join(root, "package-lock.json"), `${JSON.stringify({
    name: "fixture",
    lockfileVersion: 3,
    packages: {
      "": { name: "fixture", version: "1.0.0" },
      "node_modules/alpha": { name: "alpha", version: "1.0.0" },
    },
  }, null, 2)}\n`);
  await writeFile(path.join(root, "app.js"), "export const version = 1;\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "first release");
  git(root, "tag", "v1.0.0");

  await writeFile(path.join(root, "app.js"), "export const version = 2;\n");
  await writeFile(path.join(root, "package-lock.json"), `${JSON.stringify({
    name: "fixture",
    lockfileVersion: 3,
    packages: {
      "": { name: "fixture", version: "1.1.0" },
      "node_modules/alpha": { name: "alpha", version: "1.1.0" },
      "node_modules/bravo": { name: "bravo", version: "2.0.0" },
    },
  }, null, 2)}\n`);
  git(root, "add", ".");
  git(root, "commit", "-m", "security relevant dependency update");
  git(root, "tag", "v1.1.0");

  await mkdir(path.join(root, "reports"));
  await writeFile(path.join(root, "reports", "junit.xml"), '<testsuites><testsuite tests="12" failures="0" errors="0" skipped="1" /></testsuites>\n');
  await writeFile(path.join(root, "reports", "codeql.sarif"), `${JSON.stringify({
    version: "2.1.0",
    runs: [{ tool: { driver: { name: "fixture" } }, results: [] }],
  })}\n`);
  return root;
}

async function generatedPackage(root) {
  const outputRoot = path.join(root, "cra-evidence");
  const entries = await readdir(outputRoot, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  assert.equal(directories.length, 1);
  return path.join(outputRoot, directories[0].name);
}

test("builds a complete versioned evidence package from local release inputs", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputFile = path.join(root, "github-output.txt");
  const summaryFile = path.join(root, "step-summary.md");
  await writeFile(outputFile, "");
  await writeFile(summaryFile, "");

  const result = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
    GITHUB_SHA: git(root, "rev-parse", "v1.1.0^{commit}"),
    GITHUB_REPOSITORY: "example/fixture",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_RUN_ID: "12345",
    GITHUB_OUTPUT: outputFile,
    GITHUB_STEP_SUMMARY: summaryFile,
    INPUT_EVIDENCE_PATHS: "reports/**/*.xml\nreports/**/*.sarif",
    INPUT_REQUIRED_EVIDENCE: "sbom,test-results,security-scan,change-summary",
    INPUT_OUTPUT_DIRECTORY: "cra-evidence",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const packageDir = await generatedPackage(root);
  const report = JSON.parse(await readFile(path.join(packageDir, "evidence.json"), "utf8"));
  const evidenceSchema = JSON.parse(await readFile(path.join(projectRoot, "schema", "evidence.schema.json"), "utf8"));
  const markdown = await readFile(path.join(packageDir, "EVIDENCE.md"), "utf8");
  const manifest = await readFile(path.join(packageDir, "MANIFEST.sha256"), "utf8");
  const outputs = await readFile(outputFile, "utf8");
  const summary = await readFile(summaryFile, "utf8");

  assert.equal(report.release.tag, "v1.1.0");
  assert.equal(report.changes.previousTag, "v1.0.0");
  assert.equal(report.changes.available, true);
  assert.equal(report.sbom.sourceCommitMatchesRelease, true);
  assert.equal(report.sbom.sourceCommitRelation, "observed-workspace-head-matches-release");
  assert.ok(report.sbom.components >= 2);
  assert.deepEqual(new Set(report.evidence.map((item) => item.category)), new Set(["security-scan", "test-results"]));
  assert.ok(report.evidence.every((item) => item.collectedAtWorkspaceCommit === report.release.commit));
  assert.ok(report.evidence.every((item) => item.producerCommit === null));
  assert.ok(report.evidence.every((item) => item.producerCommitMatchesRelease === null));
  assert.ok(report.evidence.every((item) => item.producerCommitRelation === "not-declared"));
  assert.equal(report.status, "complete");
  assert.equal(report.gaps.length, 0);
  assert.match(markdown, /not a conformity assessment/i);
  assert.doesNotMatch(markdown, /Optional activation confirmation/);
  assert.match(manifest, /evidence\.json/);
  assert.match(outputs, /package-dir<</);
  assert.match(summary, /Optional activation confirmation/);
  assert.match(summary, /blob\/main\/docs\/ACTIVATION\.md/);
  assert.match(summary, /issues\/new\?template=activation-report\.yml/);
  assert.match(summary, /sends no activation telemetry/i);
  assert.match(summary, /creates a public candidate only/i);
  assert.match(summary, /public GitHub account, profile, answers, and issue metadata are visible/i);
  assert.match(summary, /Do not attach or paste SBOMs, findings, source code, raw reports/i);
  assertMatchesProjectSchema(evidenceSchema, report);
});

test("checks a declared evidence producer commit against the release revision", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const releaseSha = git(root, "rev-parse", "v1.1.0^{commit}");
  const previousSha = git(root, "rev-parse", "v1.0.0^{commit}");

  const matching = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
    INPUT_EVIDENCE_PATHS: "reports/**/*.xml\nreports/**/*.sarif",
    INPUT_EVIDENCE_SOURCE_SHA: releaseSha,
    INPUT_REQUIRED_EVIDENCE: "sbom,test-results,security-scan,change-summary",
  });
  assert.equal(matching.status, 0, matching.stderr || matching.stdout);
  let report = JSON.parse(await readFile(path.join(await generatedPackage(root), "evidence.json"), "utf8"));
  assert.equal(report.status, "complete");
  assert.ok(report.evidence.every((item) => item.producerCommit === releaseSha));
  assert.ok(report.evidence.every((item) => item.producerCommitMatchesRelease === true));
  assert.ok(report.evidence.every((item) => item.producerCommitRelation === "declared-commit-matches-release"));

  await rm(path.join(root, "cra-evidence"), { recursive: true, force: true });
  const mismatching = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
    INPUT_EVIDENCE_PATHS: "reports/**/*.xml\nreports/**/*.sarif",
    INPUT_EVIDENCE_SOURCE_SHA: previousSha,
    INPUT_REQUIRED_EVIDENCE: "sbom,test-results,security-scan,change-summary",
  });
  assert.equal(mismatching.status, 0, mismatching.stderr || mismatching.stdout);
  report = JSON.parse(await readFile(path.join(await generatedPackage(root), "evidence.json"), "utf8"));
  assert.equal(report.status, "gaps-found");
  assert.ok(report.evidence.every((item) => item.producerCommit === previousSha));
  assert.ok(report.evidence.every((item) => item.producerCommitMatchesRelease === false));
  assert.ok(report.evidence.every((item) => item.producerCommitRelation === "declared-commit-mismatch"));
  assert.ok(report.gaps.some((gap) => gap.category === "evidence-revision"));
  assert.ok(report.gaps.some((gap) => gap.category === "test-results"));
  assert.ok(report.gaps.some((gap) => gap.category === "security-scan"));
});

test("writes the package before failing on configured gaps", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
    INPUT_EVIDENCE_PATHS: "does-not-exist/**/*.json",
    INPUT_REQUIRED_EVIDENCE: "sbom,security-scan,change-summary",
    INPUT_FAIL_ON_GAPS: "true",
  });

  assert.equal(result.status, 2);
  const packageDir = await generatedPackage(root);
  const report = JSON.parse(await readFile(path.join(packageDir, "evidence.json"), "utf8"));
  assert.equal(report.status, "gaps-found");
  assert.ok(report.gaps.some((gap) => gap.category === "security-scan"));
});

test("fails closed before writing when the release tag cannot be resolved", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));

  const result = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v9.9.9-does-not-exist",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /does not resolve to a local Git tag/i);
  await assert.rejects(access(path.join(root, "cra-evidence")));
});

test("indexes but does not accept an unrecognized file as an SBOM", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const currentSha = git(root, "rev-parse", "v1.1.0^{commit}");
  await writeFile(path.join(root, "reports", "not-an-sbom.json"), '{"hello":"world"}\n');

  const result = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
    INPUT_SBOM_PATH: "reports/not-an-sbom.json",
    INPUT_SBOM_SOURCE_SHA: currentSha,
    INPUT_EVIDENCE_PATHS: "",
    INPUT_REQUIRED_EVIDENCE: "sbom,change-summary",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(await readFile(path.join(await generatedPackage(root), "evidence.json"), "utf8"));
  assert.equal(report.sbom.structureRecognized, false);
  assert.equal(report.sbom.schemaValidation, "not-performed");
  assert.ok(report.gaps.some((gap) => gap.category === "sbom"));
  assert.ok(report.gaps.some((gap) => gap.category === "sbom-format"));
});

test("accepts supported CycloneDX and SPDX structures without claiming full schema validation", async (t) => {
  const cases = [
    {
      name: "cyclonedx",
      sbom: {
        bomFormat: "CycloneDX",
        specVersion: "1.7",
        version: 1,
        components: [{ type: "library", name: "alpha", version: "1.0.0" }],
      },
      format: "CycloneDX 1.7 JSON",
    },
    {
      name: "spdx",
      sbom: {
        spdxVersion: "SPDX-2.3",
        dataLicense: "CC0-1.0",
        SPDXID: "SPDXRef-DOCUMENT",
        name: "fixture release SBOM",
        documentNamespace: "https://example.invalid/spdx/fixture-v1.1.0",
        creationInfo: {
          created: "2026-01-01T00:00:00Z",
          creators: ["Tool: fixture-generator-1.0.0"],
        },
        packages: [{
          name: "alpha",
          SPDXID: "SPDXRef-Package-alpha",
          downloadLocation: "NOASSERTION",
          copyrightText: "NOASSERTION",
        }],
      },
      format: "SPDX-2.3 JSON",
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async (st) => {
      const root = await fixture();
      st.after(() => rm(root, { recursive: true, force: true }));
      const currentSha = git(root, "rev-parse", "v1.1.0^{commit}");
      const sbomPath = path.join(root, "reports", `${item.name}.json`);
      await writeFile(sbomPath, `${JSON.stringify(item.sbom, null, 2)}\n`);

      const result = run(process.execPath, [actionPath], root, {
        ...process.env,
        GITHUB_WORKSPACE: root,
        GITHUB_REF_NAME: "v1.1.0",
        INPUT_SBOM_PATH: normalizeForInput(root, sbomPath),
        INPUT_SBOM_SOURCE_SHA: currentSha,
        INPUT_EVIDENCE_PATHS: "",
        INPUT_REQUIRED_EVIDENCE: "sbom,change-summary",
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(await readFile(path.join(await generatedPackage(root), "evidence.json"), "utf8"));
      assert.equal(report.status, "complete");
      assert.equal(report.sbom.format, item.format);
      assert.equal(report.sbom.structureRecognized, true);
      assert.equal(report.sbom.parseStatus, "recognized-structure");
      assert.equal(report.sbom.schemaValidation, "not-performed");
    });
  }
});

test("rejects malformed components and unsupported SBOM versions", async (t) => {
  const cases = [
    {
      name: "cyclonedx-malformed-component",
      sbom: { bomFormat: "CycloneDX", specVersion: "1.6", version: 1, components: [{ arbitrary: true }] },
      issue: /components\[0\]\.type/,
    },
    {
      name: "cyclonedx-unsupported-version",
      sbom: { bomFormat: "CycloneDX", specVersion: "9.9", version: 1, components: [{ type: "library", name: "alpha" }] },
      issue: /specVersion/,
    },
    {
      name: "spdx-malformed-package",
      sbom: {
        spdxVersion: "SPDX-2.3",
        dataLicense: "CC0-1.0",
        SPDXID: "SPDXRef-DOCUMENT",
        name: "malformed package fixture",
        documentNamespace: "urn:uuid:4a84f867-b27e-47c9-896e-186f9735d536",
        creationInfo: {
          created: "2026-01-01T00:00:00Z",
          creators: ["Tool: fixture-generator-1.0.0"],
        },
        packages: [{ arbitrary: true }],
      },
      issue: /packages\[0\]\.name/,
    },
    {
      name: "spdx-unsupported-version",
      sbom: {
        spdxVersion: "SPDX-9.9",
        dataLicense: "CC0-1.0",
        SPDXID: "SPDXRef-DOCUMENT",
        name: "unsupported version fixture",
        documentNamespace: "https://example.invalid/spdx/unsupported",
        creationInfo: {
          created: "2026-01-01T00:00:00Z",
          creators: ["Tool: fixture-generator-1.0.0"],
        },
        packages: [{
          name: "alpha",
          SPDXID: "SPDXRef-Package-alpha",
          downloadLocation: "NOASSERTION",
          copyrightText: "NOASSERTION",
        }],
      },
      issue: /spdxVersion/,
    },
  ];

  for (const item of cases) {
    await t.test(item.name, async (st) => {
      const root = await fixture();
      st.after(() => rm(root, { recursive: true, force: true }));
      const currentSha = git(root, "rev-parse", "v1.1.0^{commit}");
      const sbomPath = path.join(root, "reports", `${item.name}.json`);
      await writeFile(sbomPath, `${JSON.stringify(item.sbom, null, 2)}\n`);

      const result = run(process.execPath, [actionPath], root, {
        ...process.env,
        GITHUB_WORKSPACE: root,
        GITHUB_REF_NAME: "v1.1.0",
        INPUT_SBOM_PATH: normalizeForInput(root, sbomPath),
        INPUT_SBOM_SOURCE_SHA: currentSha,
        INPUT_EVIDENCE_PATHS: "",
        INPUT_REQUIRED_EVIDENCE: "sbom,change-summary",
      });

      assert.equal(result.status, 0, result.stderr || result.stdout);
      const report = JSON.parse(await readFile(path.join(await generatedPackage(root), "evidence.json"), "utf8"));
      assert.equal(report.status, "gaps-found");
      assert.equal(report.sbom.structureRecognized, false);
      assert.equal(report.sbom.parseStatus, "unrecognized-structure");
      assert.ok(report.sbom.recognitionIssues.some((issue) => item.issue.test(issue)));
      assert.ok(report.gaps.some((gap) => gap.category === "sbom-format"));
    });
  }
});

test("fails closed when workspace HEAD does not match the requested release tag", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "post-release.txt"), "not part of v1.1.0\n");
  git(root, "add", "post-release.txt");
  git(root, "commit", "-m", "post release commit");

  const result = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Workspace HEAD must equal release tag/i);
  await assert.rejects(access(path.join(root, "cra-evidence")));
});

test("rejects an output directory that escapes the workspace", async (t) => {
  const root = await fixture();
  const escape = path.join(path.dirname(root), `${path.basename(root)}-escape`);
  t.after(() => Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(escape, { recursive: true, force: true }),
  ]));

  const result = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
    INPUT_OUTPUT_DIRECTORY: `../${path.basename(escape)}`,
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /must stay inside GITHUB_WORKSPACE/i);
  await assert.rejects(access(escape));
});

test("malformed scanner JSON cannot satisfy a required evidence category", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "reports", "trivy-malformed.json"), '{"Results": [\n');

  const result = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
    INPUT_EVIDENCE_PATHS: "reports/trivy-malformed.json",
    INPUT_REQUIRED_EVIDENCE: "sbom,security-scan,change-summary",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(await readFile(path.join(await generatedPackage(root), "evidence.json"), "utf8"));
  assert.equal(report.status, "gaps-found");
  assert.equal(report.evidence[0].parseStatus, "parse-error");
  assert.ok(report.gaps.some((gap) => gap.category === "security-scan"));
  assert.ok(report.gaps.some((gap) => gap.category === "report-parse"));
});

test("rejects a symlinked SBOM instead of following it", async (t) => {
  const root = await fixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const link = path.join(root, "reports", "linked-sbom.json");
  try {
    await symlink(path.join(root, "package-lock.json"), link, "file");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
      t.skip(`symlinks unavailable on this runner: ${error.code}`);
      return;
    }
    throw error;
  }

  const result = run(process.execPath, [actionPath], root, {
    ...process.env,
    GITHUB_WORKSPACE: root,
    GITHUB_REF_NAME: "v1.1.0",
    INPUT_SBOM_PATH: "reports/linked-sbom.json",
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /must not be or traverse a symbolic link/i);
  await assert.rejects(access(path.join(root, "cra-evidence")));
});
