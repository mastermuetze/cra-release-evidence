import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  const files = [
    ".github/workflows/ci.yml",
    "examples/release-evidence.yml",
    "examples/trivy-release-evidence.yml",
  ];
  for (const file of files) {
    const source = await text(file);
    for (const match of source.matchAll(/uses:\s*([^@\s]+)@([^\s#]+)/g)) {
      assert.match(match[2], /^[0-9a-f]{40}$/i, `${file}: ${match[1]} must use a full SHA`);
    }
  }
});

test("Trivy integration remains copy-ready and preserves the product boundary", async () => {
  const [workflow, guide] = await Promise.all([
    text("examples/trivy-release-evidence.yml"),
    text("docs/TRIVY-RELEASE-EVIDENCE.md"),
  ]);
  assert.match(workflow, /aquasecurity\/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25/);
  assert.match(workflow, /format: cyclonedx/);
  assert.match(workflow, /format: sarif/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read/);
  assert.match(workflow, /include-raw-reports: false/);
  assert.match(guide, /not a CRA assessment/i);
  assert.match(guide, /after-publication archive/i);
  assert.match(guide, /voluntarily report an activation/i);
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

test("activation reporting is voluntary, minimal, and never counts automatically", async () => {
  const [form, privacy, pilot] = await Promise.all([
    text(".github/ISSUE_TEMPLATE/activation-report.yml"),
    text("PRIVACY.md"),
    text("docs/PILOT.md"),
  ]);

  assert.match(form, /labels:\s*\n\s+- activation-candidate/);
  assert.match(form, /candidate only/i);
  assert.match(form, /EVIDENCE\.md and parseable evidence\.json/i);
  assert.match(form, /Do not upload or paste SBOMs, findings, raw reports, source code, tokens/i);
  assert.match(form, /random opaque ID/i);
  assert.match(form, /Never use a plain hash/i);
  assert.doesNotMatch(form, /id:\s*(?:email|phone|company_name)\b/i);
  assert.match(privacy, /creates a candidate record only/i);
  assert.match(pilot, /does not count automatically/i);
});

test("Marketplace release handoff is copy-ready and keeps owner decisions manual", async () => {
  const [releaseNotes, submission, preflight, eula, approval, rootFiles] = await Promise.all([
    text("RELEASE_NOTES_v0.1.0.md"),
    text("docs/MARKETPLACE-SUBMISSION.md"),
    text("scripts/preflight.mjs"),
    text("EULA.md"),
    text("docs/EULA-APPROVAL.md"),
    readdir(root),
  ]);

  assert.doesNotMatch(releaseNotes, /replace all owner placeholders/i);
  assert.match(releaseNotes, /contents: read/);
  assert.match(releaseNotes, /not a CRA scanner/i);
  assert.match(submission, /Primary category \| \*\*Security\*\*/);
  assert.match(submission, /Secondary category \| \*\*Reporting\*\*/);
  assert.match(submission, /explicit owner confirmation/i);
  assert.match(submission, /not legal approval/i);
  assert.match(preflight, /DEFERRED PILOT INTAKE BLOCKERS/);
  assert.match(preflight, /public pilot form remains disabled/);
  assert.equal(rootFiles.includes("EULA-DRAFT.md"), false);
  assert.doesNotMatch(eula, /LEGAL REVIEW REQUIRED|TODO|TBD/);
  const canonicalEula = eula.replace(/\r\n/g, "\n");
  assert.doesNotMatch(canonicalEula, /\r/);
  const eulaSha256 = createHash("sha256").update(canonicalEula).digest("hex");
  assert.equal(eulaSha256, "751dcc470a0b38fce238e9e861b4184a4ffcba134c74c148f575cba9930a04c9");
  assert.match(approval, new RegExp(eulaSha256));
  assert.match(approval, /authorized Publisher/i);
});
