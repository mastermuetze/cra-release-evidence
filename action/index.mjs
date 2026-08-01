#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { appendFile, copyFile, lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const MAX_MATCHED_FILES = 5_000;
const MAX_REPORT_BYTES = 25 * 1024 * 1024;
const MANIFEST_PATTERNS = [
  "**/package-lock.json",
  "**/npm-shrinkwrap.json",
  "**/package.json",
  "**/requirements.txt",
  "**/go.mod",
  "**/Cargo.lock",
  "**/composer.lock",
  "**/pom.xml",
  "**/*.csproj",
];
const EXCLUDED_DIRS = new Set([
  ".git",
  ".next",
  ".vinext",
  ".wrangler",
  "node_modules",
  "dist",
]);

function input(name, fallback = "") {
  const exact = `INPUT_${name.toUpperCase().replace(/ /g, "_")}`;
  const underscored = exact.replaceAll("-", "_");
  return (process.env[exact] ?? process.env[underscored] ?? fallback).trim();
}

function boolInput(name, fallback = false) {
  const value = input(name, String(fallback)).toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
}

function annotation(level, message) {
  const safe = String(message).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  process.stdout.write(`::${level}::${safe}\n`);
}

function normalizeRelative(file) {
  return file.split(path.sep).join("/").replace(/^\.\//, "");
}

function safeSegment(value) {
  const original = String(value || "untagged");
  const safe = original
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 72);
  const digest = createHash("sha256").update(original).digest("hex").slice(0, 12);
  return `release-${safe || "tag"}-${digest}`;
}

function safeFileName(value, index = "") {
  const original = path.basename(String(value || "evidence"));
  const extension = path.extname(original).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 16);
  const stem = path.basename(original, path.extname(original))
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 60) || "evidence";
  const digest = createHash("sha256").update(original).digest("hex").slice(0, 10);
  return `${index ? `${index}-` : ""}${stem}-${digest}${extension}`;
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveInside(root, value, label) {
  const resolved = path.resolve(root, value);
  if (!isInside(root, resolved)) {
    throw new Error(`${label} must stay inside GITHUB_WORKSPACE: ${value}`);
  }
  return resolved;
}

async function assertNoSymlinkPath(root, target, label) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (!isInside(resolvedRoot, resolvedTarget)) throw new Error(`${label} must stay inside GITHUB_WORKSPACE.`);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  let current = resolvedRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error(`${label} must not be or traverse a symbolic link: ${normalizeRelative(path.relative(root, current))}`);
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
}

async function workspaceFile(workspace, value, label) {
  const source = resolveInside(workspace, value, label);
  await assertNoSymlinkPath(workspace, source, label);
  const [workspaceReal, sourceReal, info] = await Promise.all([realpath(workspace), realpath(source), lstat(source)]);
  if (!isInside(workspaceReal, sourceReal)) throw new Error(`${label} resolves outside GITHUB_WORKSPACE.`);
  if (!info.isFile()) throw new Error(`${label} is not a regular file: ${value}`);
  return { source, info };
}

function splitList(value) {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function globRegex(pattern) {
  const normalized = normalizeRelative(pattern).replace(/^\//, "");
  let regex = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "*") {
      if (normalized[index + 1] === "*") {
        index += 1;
        if (normalized[index + 1] === "/") {
          index += 1;
          regex += "(?:.*/)?";
        } else {
          regex += ".*";
        }
      } else {
        regex += "[^/]*";
      }
    } else if (char === "?") {
      regex += "[^/]";
    } else {
      regex += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`${regex}$`, "i");
}

function staticPatternRoot(pattern) {
  const normalized = normalizeRelative(pattern).replace(/^\/+/, "");
  const wildcard = normalized.search(/[?*]/);
  if (wildcard === -1) return path.posix.dirname(normalized) === "." ? "" : path.posix.dirname(normalized);
  const prefix = normalized.slice(0, wildcard);
  if (prefix.endsWith("/")) return prefix.slice(0, -1);
  const slash = prefix.lastIndexOf("/");
  return slash >= 0 ? prefix.slice(0, slash) : "";
}

async function findMatchingFiles(root, patterns, excludedAbsolute = []) {
  const files = new Map();
  const matchers = patterns.map(globRegex);
  const roots = [...new Set(patterns.map(staticPatternRoot))]
    .map((relative) => resolveInside(root, relative || ".", "evidence-paths"));
  const exclusions = excludedAbsolute.map((entry) => path.resolve(entry));

  const queue = [];
  for (const searchRoot of roots) {
    try {
      const info = await lstat(searchRoot);
      if (info.isSymbolicLink()) continue;
      if (info.isDirectory()) queue.push(searchRoot);
      else if (info.isFile()) {
        const relative = normalizeRelative(path.relative(root, searchRoot));
        if (matchers.some((matcher) => matcher.test(relative))) files.set(searchRoot, searchRoot);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const visited = new Set();
  while (queue.length > 0) {
    const directory = queue.shift();
    const directoryKey = path.resolve(directory).toLowerCase();
    if (visited.has(directoryKey)) continue;
    visited.add(directoryKey);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      annotation("warning", `Could not read ${normalizeRelative(path.relative(root, directory))}: ${error.message}`);
      continue;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (exclusions.some((excluded) => absolute === excluded || absolute.startsWith(`${excluded}${path.sep}`))) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) queue.push(absolute);
      } else if (entry.isFile()) {
        const relative = normalizeRelative(path.relative(root, absolute));
        if (matchers.some((matcher) => matcher.test(relative))) files.set(absolute, absolute);
        if (files.size > MAX_MATCHED_FILES) throw new Error(`More than ${MAX_MATCHED_FILES} files matched; narrow evidence-paths.`);
      }
    }
  }
  return [...files.values()].sort((left, right) => left.localeCompare(right));
}

async function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}

async function readTextLimited(file) {
  const info = await stat(file);
  if (info.size > MAX_REPORT_BYTES) return { text: null, size: info.size, parseStatus: "too-large" };
  return { text: await readFile(file, "utf8"), size: info.size, parseStatus: "not-parsed" };
}

function purl(type, name, version) {
  const encodedName = name.split("/").map(encodeURIComponent).join("/");
  return `pkg:${type}/${encodedName}${version ? `@${encodeURIComponent(version)}` : ""}`;
}

function component(type, name, version, source) {
  const cleanVersion = String(version || "unknown").replace(/^[=~^<>!\s]+/, "").split(/[;,\s]/)[0] || "unknown";
  return {
    type: "library",
    name,
    version: cleanVersion,
    purl: purl(type, name, cleanVersion === "unknown" ? "" : cleanVersion),
    properties: [{ name: "cra-release-evidence:source", value: source }],
  };
}

function parsePackageLock(text, source) {
  const data = JSON.parse(text);
  const components = [];
  for (const [location, value] of Object.entries(data.packages ?? {})) {
    if (!location || !location.includes("node_modules/") || !value?.version) continue;
    const name = value.name ?? location.slice(location.lastIndexOf("node_modules/") + 13);
    components.push(component("npm", name, value.version, source));
  }
  const visit = (dependencies = {}) => {
    for (const [name, value] of Object.entries(dependencies)) {
      if (value?.version) components.push(component("npm", name, value.version, source));
      if (value?.dependencies) visit(value.dependencies);
    }
  };
  if (components.length === 0) visit(data.dependencies);
  return components;
}

function parsePackageJson(text, source) {
  const data = JSON.parse(text);
  return Object.entries({ ...data.dependencies, ...data.optionalDependencies })
    .map(([name, version]) => component("npm", name, version, source));
}

function parseRequirements(text, source) {
  return text.split(/\r?\n/).flatMap((line) => {
    const clean = line.split("#")[0].trim();
    if (!clean || clean.startsWith("-") || clean.includes("git+")) return [];
    const match = clean.match(/^([A-Za-z0-9_.-]+)(?:\[[^\]]+\])?\s*(?:===|==|~=|>=|<=|>|<|!=)?\s*([^;\s]+)?/);
    return match ? [component("pypi", match[1], match[2], source)] : [];
  });
}

function parseGoMod(text, source) {
  const results = [];
  const body = text.replace(/\/\/.*$/gm, "");
  for (const match of body.matchAll(/^\s*([\w./~-]+)\s+(v[^\s)]+)\s*$/gm)) {
    if (match[1] !== "go" && match[1] !== "module") results.push(component("golang", match[1], match[2], source));
  }
  return results;
}

function parseCargoLock(text, source) {
  return [...text.matchAll(/\[\[package\]\][\s\S]*?^name\s*=\s*"([^"]+)"[\s\S]*?^version\s*=\s*"([^"]+)"/gm)]
    .map((match) => component("cargo", match[1], match[2], source));
}

function parseComposerLock(text, source) {
  const data = JSON.parse(text);
  return [...(data.packages ?? []), ...(data["packages-dev"] ?? [])]
    .filter((entry) => entry?.name)
    .map((entry) => component("composer", entry.name, entry.version, source));
}

function parsePom(text, source) {
  return [...text.matchAll(/<dependency>[\s\S]*?<groupId>\s*([^<]+)\s*<\/groupId>[\s\S]*?<artifactId>\s*([^<]+)\s*<\/artifactId>[\s\S]*?(?:<version>\s*([^<]+)\s*<\/version>)?[\s\S]*?<\/dependency>/g)]
    .map((match) => component("maven", `${match[1]}:${match[2]}`, match[3], source));
}

function parseCsproj(text, source) {
  return [...text.matchAll(/<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?[^>]*>/g)]
    .map((match) => component("nuget", match[1], match[2], source));
}

async function generateSbom(workspace, outDir, workspaceFiles) {
  const parsers = new Map([
    ["package-lock.json", parsePackageLock],
    ["npm-shrinkwrap.json", parsePackageLock],
    ["package.json", parsePackageJson],
    ["requirements.txt", parseRequirements],
    ["go.mod", parseGoMod],
    ["Cargo.lock", parseCargoLock],
    ["composer.lock", parseComposerLock],
    ["pom.xml", parsePom],
  ]);
  const components = [];
  const manifests = [];
  const warnings = [];

  for (const file of workspaceFiles) {
    const basename = path.basename(file);
    const parser = parsers.get(basename) ?? (file.endsWith(".csproj") ? parseCsproj : null);
    if (!parser) continue;
    const relative = normalizeRelative(path.relative(workspace, file));
    try {
      const { text, size } = await readTextLimited(file);
      if (text === null) {
        warnings.push(`${relative} exceeded the ${MAX_REPORT_BYTES} byte parser limit`);
        continue;
      }
      const parsed = parser(text, relative);
      components.push(...parsed);
      manifests.push({ path: relative, sha256: await sha256(file), size, components: parsed.length });
    } catch (error) {
      warnings.push(`${relative}: ${error.message}`);
    }
  }

  const deduplicated = [...new Map(components.map((entry) => [`${entry.purl}|${entry.version}`, entry])).values()]
    .sort((left, right) => left.purl.localeCompare(right.purl));
  const generatedAt = new Date().toISOString();
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${cryptoRandomUuidFallback()}`,
    version: 1,
    metadata: {
      timestamp: generatedAt,
      tools: { components: [{ type: "application", name: "cra-release-evidence", version: "0.1.0" }] },
      properties: [
        { name: "cra-release-evidence:generation-mode", value: "manifest-derived-fallback" },
        { name: "cra-release-evidence:limitation", value: "Not a binary or deployed-artifact inventory; verify against the shipped artifact." },
      ],
    },
    components: deduplicated,
  };
  const sbomDir = path.join(outDir, "sbom");
  await mkdir(sbomDir, { recursive: true });
  const destination = path.join(sbomDir, "bom.cdx.json");
  await writeFile(destination, `${JSON.stringify(sbom, null, 2)}\n`, "utf8");
  return {
    mode: "generated-manifest-fallback",
    structureRecognized: true,
    schemaValidation: "not-performed",
    recognitionIssues: [],
    parseStatus: "generated",
    path: normalizeRelative(path.relative(outDir, destination)),
    absolutePath: destination,
    format: "CycloneDX 1.6 JSON",
    components: deduplicated.length,
    sourceManifests: manifests,
    warnings,
    sha256: await sha256(destination),
    size: (await stat(destination)).size,
    sourceCommit: null,
    sourceCommitMatchesRelease: null,
    sourceCommitRelation: "pending-workspace-check",
    note: "Generated from dependency manifests at the checked-out revision; not a full binary SBOM.",
  };
}

function cryptoRandomUuidFallback() {
  const seed = createHash("sha256").update(`${Date.now()}-${process.pid}-${Math.random()}`).digest("hex");
  return `${seed.slice(0, 8)}-${seed.slice(8, 12)}-4${seed.slice(13, 16)}-a${seed.slice(17, 20)}-${seed.slice(20, 32)}`;
}

const SUPPORTED_CYCLONEDX_VERSIONS = new Set(["1.2", "1.3", "1.4", "1.5", "1.6", "1.7"]);
const SUPPORTED_CYCLONEDX_COMPONENT_TYPES = new Set([
  "application",
  "container",
  "cryptographic-asset",
  "data",
  "device",
  "device-driver",
  "file",
  "firmware",
  "framework",
  "library",
  "machine-learning-model",
  "operating-system",
  "platform",
]);
const SUPPORTED_SPDX_VERSIONS = new Set(["SPDX-2.2", "SPDX-2.3"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function recognizeCycloneDx(data) {
  const issues = [];
  if (data.bomFormat !== "CycloneDX") issues.push("bomFormat must equal CycloneDX");
  if (!SUPPORTED_CYCLONEDX_VERSIONS.has(data.specVersion)) {
    issues.push(`specVersion must be one of ${[...SUPPORTED_CYCLONEDX_VERSIONS].join(", ")}`);
  }
  if (!Number.isInteger(data.version) || data.version < 1) issues.push("version must be a positive integer");
  if (!Array.isArray(data.components)) {
    issues.push("components must be an array");
  } else {
    data.components.forEach((entry, index) => {
      if (!isRecord(entry)) {
        issues.push(`components[${index}] must be an object`);
        return;
      }
      if (!SUPPORTED_CYCLONEDX_COMPONENT_TYPES.has(entry.type)) {
        issues.push(`components[${index}].type is missing or unsupported`);
      }
      if (!nonEmptyString(entry.name)) issues.push(`components[${index}].name must be a non-empty string`);
      if (entry.version !== undefined && !nonEmptyString(entry.version)) {
        issues.push(`components[${index}].version must be a non-empty string when present`);
      }
      if (entry.purl !== undefined && !nonEmptyString(entry.purl)) {
        issues.push(`components[${index}].purl must be a non-empty string when present`);
      }
    });
  }
  return {
    recognized: issues.length === 0,
    format: `CycloneDX ${nonEmptyString(data.specVersion) ? data.specVersion : "unknown"} JSON`,
    components: Array.isArray(data.components) ? data.components.length : null,
    issues,
  };
}

function recognizeSpdx(data) {
  const issues = [];
  if (!SUPPORTED_SPDX_VERSIONS.has(data.spdxVersion)) {
    issues.push(`spdxVersion must be one of ${[...SUPPORTED_SPDX_VERSIONS].join(", ")}`);
  }
  if (data.dataLicense !== "CC0-1.0") issues.push("dataLicense must equal CC0-1.0");
  if (data.SPDXID !== "SPDXRef-DOCUMENT") issues.push("SPDXID must equal SPDXRef-DOCUMENT");
  if (!nonEmptyString(data.name)) issues.push("name must be a non-empty string");
  if (!nonEmptyString(data.documentNamespace) || !/^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(data.documentNamespace)) {
    issues.push("documentNamespace must be an absolute URI");
  }
  if (!isRecord(data.creationInfo)) {
    issues.push("creationInfo must be an object");
  } else {
    if (!nonEmptyString(data.creationInfo.created)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(data.creationInfo.created)
      || Number.isNaN(Date.parse(data.creationInfo.created))) {
      issues.push("creationInfo.created must be a UTC date-time string");
    }
    if (!Array.isArray(data.creationInfo.creators) || data.creationInfo.creators.length === 0
      || data.creationInfo.creators.some((creator) => typeof creator !== "string" || !/^(?:Person|Organization|Tool):\s*\S/i.test(creator))) {
      issues.push("creationInfo.creators must contain at least one SPDX creator string");
    }
  }
  if (!Array.isArray(data.packages)) {
    issues.push("packages must be an array");
  } else {
    data.packages.forEach((entry, index) => {
      if (!isRecord(entry)) {
        issues.push(`packages[${index}] must be an object`);
        return;
      }
      if (!nonEmptyString(entry.name)) issues.push(`packages[${index}].name must be a non-empty string`);
      if (!nonEmptyString(entry.SPDXID) || !/^SPDXRef-[A-Za-z0-9.-]+$/.test(entry.SPDXID)) {
        issues.push(`packages[${index}].SPDXID must be an SPDXRef identifier`);
      }
      if (!nonEmptyString(entry.downloadLocation)) {
        issues.push(`packages[${index}].downloadLocation must be a non-empty string`);
      }
      if (entry.filesAnalyzed !== undefined && typeof entry.filesAnalyzed !== "boolean") {
        issues.push(`packages[${index}].filesAnalyzed must be a boolean when present`);
      }
      for (const optionalText of ["licenseConcluded", "licenseDeclared", "copyrightText"]) {
        if (entry[optionalText] !== undefined && !nonEmptyString(entry[optionalText])) {
          issues.push(`packages[${index}].${optionalText} must be a non-empty string when present`);
        }
      }
    });
  }
  return {
    recognized: issues.length === 0,
    format: `${nonEmptyString(data.spdxVersion) ? data.spdxVersion : "SPDX unknown"} JSON`,
    components: Array.isArray(data.packages) ? data.packages.length : null,
    issues,
  };
}

function recognizeSbomStructure(data) {
  if (!isRecord(data)) {
    return { recognized: false, format: "unrecognized", components: null, issues: ["top-level JSON value must be an object"] };
  }
  if (data.bomFormat === "CycloneDX") return recognizeCycloneDx(data);
  if (nonEmptyString(data.spdxVersion)) return recognizeSpdx(data);
  return {
    recognized: false,
    format: "unrecognized",
    components: null,
    issues: ["no supported CycloneDX or SPDX format marker was found"],
  };
}

async function importSbom(workspace, outDir, value) {
  const { source, info } = await workspaceFile(workspace, value, "sbom-path");
  const sbomDir = path.join(outDir, "sbom");
  await mkdir(sbomDir, { recursive: true });
  const destination = path.join(sbomDir, safeFileName(path.basename(source)));
  await copyFile(source, destination);
  let format = "unrecognized";
  let components = null;
  let parseStatus = "unrecognized";
  let structureRecognized = false;
  let recognitionIssues = [];
  if (info.size > MAX_REPORT_BYTES) {
    parseStatus = "too-large";
    recognitionIssues = [`file exceeds the ${MAX_REPORT_BYTES} byte structural-recognition limit`];
  } else try {
    const data = JSON.parse(await readFile(source, "utf8"));
    const recognition = recognizeSbomStructure(data);
    format = recognition.format;
    components = recognition.components;
    structureRecognized = recognition.recognized;
    recognitionIssues = recognition.issues;
    parseStatus = structureRecognized ? "recognized-structure" : "unrecognized-structure";
  } catch (error) {
    parseStatus = "parse-error";
    recognitionIssues = [error.message];
  }
  return {
    mode: "imported",
    structureRecognized,
    schemaValidation: "not-performed",
    recognitionIssues,
    path: normalizeRelative(path.relative(outDir, destination)),
    absolutePath: destination,
    sourcePath: normalizeRelative(path.relative(workspace, source)),
    format,
    components,
    parseStatus,
    sha256: await sha256(destination),
    size: info.size,
    sourceCommit: null,
    sourceCommitMatchesRelease: null,
    sourceCommitRelation: "not-declared",
    note: structureRecognized
      ? "Imported unchanged after limited supported-structure checks; no full schema validation was performed. The declared source commit still requires comparison with the release commit."
      : "Copied for inspection, but it did not pass the supported CycloneDX or SPDX structural checks. No full schema validation was performed.",
  };
}

function classifyEvidence(relative) {
  const lower = relative.toLowerCase();
  if (/junit|test[-_]?results?|surefire|pytest/.test(lower) && /\.xml$/.test(lower)) return "test-results";
  if (/trivy|snyk|grype|dependency[-_]?check|codeql|semgrep|zap|vulnerab/.test(lower)) return "security-scan";
  if (lower.endsWith(".sarif") || lower.endsWith(".sarif.json")) return "security-scan";
  if (/coverage|lcov/.test(lower)) return "coverage";
  if (/provenance|attestation|slsa/.test(lower)) return "provenance";
  return "other";
}

function summarizeXml(text) {
  const totals = { tests: 0, failures: 0, errors: 0, skipped: 0 };
  let suites = 0;
  for (const match of text.matchAll(/<testsuite\b([^>]*)>/g)) {
    suites += 1;
    for (const key of Object.keys(totals)) {
      const value = match[1].match(new RegExp(`${key}=["'](\\d+)["']`, "i"));
      if (value) totals[key] += Number(value[1]);
    }
  }
  return suites > 0 ? { format: "JUnit-like XML", suites, ...totals } : null;
}

function summarizeJson(data) {
  if (String(data.version ?? "").startsWith("2.1") && Array.isArray(data.runs)) {
    const results = data.runs.flatMap((run) => run.results ?? []);
    const levels = results.reduce((counts, result) => {
      const level = result.level ?? "warning";
      counts[level] = (counts[level] ?? 0) + 1;
      return counts;
    }, {});
    return { format: "SARIF", runs: data.runs.length, results: results.length, levels };
  }
  if (Array.isArray(data.Results)) {
    const findings = data.Results.flatMap((result) => result.Vulnerabilities ?? []);
    const severities = findings.reduce((counts, finding) => {
      const severity = finding.Severity ?? "UNKNOWN";
      counts[severity] = (counts[severity] ?? 0) + 1;
      return counts;
    }, {});
    return { format: "Trivy JSON", findings: findings.length, severities };
  }
  if (Array.isArray(data.vulnerabilities)) {
    return { format: "Snyk-like JSON", findings: data.vulnerabilities.length };
  }
  return null;
}

async function collectEvidence(workspace, outDir, workspaceFiles, patterns, includeRaw) {
  const matchers = patterns.map(globRegex);
  const matched = workspaceFiles
    .map((absolute) => ({ absolute, relative: normalizeRelative(path.relative(workspace, absolute)) }))
    .filter(({ relative }) => matchers.some((matcher) => matcher.test(relative)))
    .sort((left, right) => left.relative.localeCompare(right.relative));
  const evidence = [];

  for (let index = 0; index < matched.length; index += 1) {
    const item = matched[index];
    const info = await stat(item.absolute);
    const category = classifyEvidence(item.relative);
    const record = {
      category,
      sourcePath: item.relative,
      size: info.size,
      sha256: await sha256(item.absolute),
      parseStatus: "opaque",
      summary: null,
      packagedPath: null,
    };
    if (info.size <= MAX_REPORT_BYTES) {
      try {
        const text = await readFile(item.absolute, "utf8");
        if (/\.xml$/i.test(item.relative)) record.summary = summarizeXml(text);
        else if (/\.(?:json|sarif)$/i.test(item.relative)) record.summary = summarizeJson(JSON.parse(text));
        record.parseStatus = record.summary ? "parsed" : "unrecognized";
      } catch (error) {
        record.parseStatus = "parse-error";
        record.parseError = error.message;
      }
    } else {
      record.parseStatus = "too-large";
    }
    if (includeRaw && info.size <= MAX_REPORT_BYTES) {
      const rawDir = path.join(outDir, "raw", category);
      await mkdir(rawDir, { recursive: true });
      const destination = path.join(rawDir, safeFileName(path.basename(item.absolute), String(index + 1).padStart(3, "0")));
      await copyFile(item.absolute, destination);
      record.packagedPath = normalizeRelative(path.relative(outDir, destination));
    }
    evidence.push(record);
  }
  return evidence;
}

async function git(workspace, args, fallback = null) {
  try {
    const { stdout } = await execFile("git", ["-C", workspace, ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout.trim();
  } catch {
    return fallback;
  }
}

async function gitSuccess(workspace, args) {
  try {
    await execFile("git", ["-C", workspace, ...args], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

function normalizeTagName(value) {
  return String(value || "").replace(/^refs\/tags\//, "").trim();
}

async function resolveTagCommit(workspace, value) {
  const tag = normalizeTagName(value);
  if (!tag || !(await gitSuccess(workspace, ["check-ref-format", `refs/tags/${tag}`]))) return null;
  return git(workspace, ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`], null);
}

async function collectChanges(workspace, releaseTag, explicitPrevious) {
  const normalizedReleaseTag = normalizeTagName(releaseTag);
  const currentSha = await resolveTagCommit(workspace, normalizedReleaseTag);
  if (!currentSha) throw new Error(`release-tag does not resolve to a local Git tag: ${normalizedReleaseTag || "(empty)"}`);
  const workspaceHead = await git(workspace, ["rev-parse", "--verify", "HEAD^{commit}"], null);
  if (!workspaceHead || workspaceHead !== currentSha) {
    throw new Error(`Workspace HEAD must equal release tag ${normalizedReleaseTag}. Check out the release tag before running the Action.`);
  }

  let previousTag = explicitPrevious ? normalizeTagName(explicitPrevious) : null;
  let selection = explicitPrevious ? "explicit-input" : "nearest-reachable-tag";
  if (!previousTag) {
    previousTag = await git(workspace, ["describe", "--tags", "--abbrev=0", `${currentSha}^`], null);
  }
  const previousSha = previousTag ? await resolveTagCommit(workspace, previousTag) : null;
  if (explicitPrevious && !previousSha) {
    throw new Error(`previous-tag does not resolve to a local Git tag: ${previousTag}`);
  }
  if (previousSha && previousSha === currentSha) {
    throw new Error("previous-tag must not resolve to the release commit.");
  }
  if (previousSha && !(await gitSuccess(workspace, ["merge-base", "--is-ancestor", previousSha, currentSha]))) {
    throw new Error(`previous-tag ${previousTag} is not an ancestor of release tag ${normalizedReleaseTag}.`);
  }
  if (!previousSha) {
    return {
      available: false,
      reason: "No reachable previous tag was found. Treat as a first release or pass previous-tag explicitly.",
      releaseTag: normalizedReleaseTag,
      previousTag: null,
      currentSha,
      previousSha: null,
      selection,
    };
  }
  const range = `${previousSha}..${currentSha}`;
  const [nameStatus, diffStat, commitLog, commitCount] = await Promise.all([
    git(workspace, ["diff", "--name-status", "--find-renames", range], ""),
    git(workspace, ["diff", "--stat", range], ""),
    git(workspace, ["log", "--format=%H%x09%aI%x09%s", range], ""),
    git(workspace, ["rev-list", "--count", range], "0"),
  ]);
  const files = nameStatus.split(/\r?\n/).filter(Boolean).map((line) => {
    const [statusCode, ...names] = line.split("\t");
    const file = names.at(-1) ?? "";
    return {
      status: statusCode,
      paths: names,
      securityRelevant: /(^|\/)(\.github\/workflows|Dockerfile|Containerfile)|(?:lock|sum|mod|toml|gradle|csproj|props|requirements.*\.txt|package\.json)$|security|auth|crypto|permission/i.test(file),
    };
  });
  const commits = commitLog.split(/\r?\n/).filter(Boolean).map((line) => {
    const [sha, authoredAt, ...subject] = line.split("\t");
    return { sha, authoredAt, subject: subject.join("\t") };
  });
  return {
    available: true,
    releaseTag: normalizedReleaseTag,
    previousTag,
    currentSha,
    previousSha,
    selection,
    range,
    commitCount: Number(commitCount),
    commits,
    files,
    securityRelevantFiles: files.filter((entry) => entry.securityRelevant).length,
    diffStat,
  };
}

function evidencePresence(sbom, evidence, changes) {
  const present = new Set();
  if (sbom?.structureRecognized === true) present.add("sbom");
  if (changes?.available) present.add("change-summary");
  for (const item of evidence.filter((entry) => entry.parseStatus === "parsed")) present.add(item.category);
  return present;
}

function jsonCell(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function markdownFor(report) {
  const rows = report.policy.requiredEvidence.map((category) => {
    const gap = report.gaps.find((entry) => entry.category === category);
    return `| ${category} | ${gap ? "Missing" : "Found"} | ${gap?.message ?? "Indexed with a digest in evidence.json"} |`;
  }).join("\n");
  const evidenceRows = report.evidence.length > 0
    ? report.evidence.map((item) => `| ${item.category} | \`${item.sourcePath}\` | ${item.parseStatus} | \`${item.sha256.slice(0, 12)}…\` | ${jsonCell(item.summary)} |`).join("\n")
    : "| — | No matching reports | — | — | — |";
  const gaps = report.gaps.length > 0
    ? report.gaps.map((gap) => `- **${gap.category}:** ${gap.message}`).join("\n")
    : "- No gaps against the configured evidence list.";
  const changed = report.changes.available
    ? `${report.changes.commitCount} commits and ${report.changes.files.length} changed paths; ${report.changes.securityRelevantFiles} paths flagged for security review.`
    : report.changes.reason;

  return `# Release evidence index — ${report.release.tag}\n\n> Automated evidence index, not a conformity assessment. “Found” means a configured file or generated record was indexed; it does not mean a legal requirement is fulfilled or that the source is authentic.\n\n## Release identity\n\n- Repository: \`${report.release.repository}\`\n- Tag: \`${report.release.tag}\`\n- Commit: \`${report.release.commit}\`\n- Previous tag: \`${report.changes.previousTag ?? "none"}\`\n- Generated: ${report.generatedAt}\n- Workflow run: ${report.release.workflowRunUrl || "not available"}\n\n## Configured completeness\n\nOverall status: **${report.status}** (configured evidence only; never a CRA compliance result).\n\n| Category | Status | Note |\n|---|---|---|\n${rows}\n\n## SBOM\n\n- Mode: ${report.sbom.mode}\n- Format: ${report.sbom.format}\n- Structure recognition: ${report.sbom.structureRecognized ? "passed supported structural checks" : "not recognized"}\n- Full schema validation: ${report.sbom.schemaValidation}\n- Components: ${report.sbom.components ?? "unknown"}\n- SHA-256: \`${report.sbom.sha256}\`\n- Source-commit relation: ${report.sbom.sourceCommitRelation}\n- Note: ${report.sbom.note}\n\n## Collected reports\n\n| Type | Source | Parse status | SHA-256 | Summary |\n|---|---|---|---|---|\n${evidenceRows}\n\nRaw reports are ${report.policy.includeRawReports ? "copied into `raw/`; review confidentiality before publishing" : "not copied by default; only digests and summaries remain in `evidence.json`. Preserve the original sources separately"}.\n\n## Changes from the previous release\n\n${changed}\n\n${report.changes.diffStat ? `\n\`\`\`text\n${report.changes.diffStat}\n\`\`\`\n` : ""}\n## Evidence gaps\n\n${gaps}\n\n## Human checkpoints — not automated\n\n${report.manualCheckpoints.map((item) => `- **${item.title}:** ${item.status}. ${item.note}`).join("\n")}\n\n## Boundary\n\nThis index documents automatically discovered artifacts and declared metadata for the named version. SHA-256 digests support later consistency checks but do not prove authenticity or tamper resistance without a trusted signed attestation or immutable store. Presence is not legal sufficiency. Scope, product classification, cybersecurity risk assessment, residual-risk acceptance, conformity assessment, EU declaration of conformity, CE marking, and notifications to authorities or users remain the manufacturer’s responsibility and require review or action by authorized people. CRA Release Evidence is not legal advice, a CRA scanner, or a guarantee of compliance.\n`;
}

async function writeManifest(outDir, files) {
  const lines = [];
  for (const file of files) {
    lines.push(`${await sha256(file)}  ${normalizeRelative(path.relative(outDir, file))}`);
  }
  const manifest = path.join(outDir, "MANIFEST.sha256");
  await writeFile(manifest, `${lines.sort().join("\n")}\n`, "utf8");
  return manifest;
}

async function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  const delimiter = `CRA_EVIDENCE_${createHash("sha1").update(`${name}-${Date.now()}`).digest("hex")}`;
  await appendFile(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, "utf8");
}

async function main() {
  const workspace = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd());
  const requestedReleaseTag = input("release-tag", process.env.GITHUB_REF_NAME || "");
  const changes = await collectChanges(workspace, requestedReleaseTag, input("previous-tag"));
  const releaseTag = changes.releaseTag;
  const outputRoot = resolveInside(workspace, input("output-directory", "cra-evidence"), "output-directory");
  await assertNoSymlinkPath(workspace, outputRoot, "output-directory");
  await mkdir(outputRoot, { recursive: true });
  await assertNoSymlinkPath(workspace, outputRoot, "output-directory");
  const outDir = path.join(outputRoot, safeSegment(releaseTag));
  try {
    await mkdir(outDir, { recursive: false });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`Evidence output already exists for ${releaseTag}; use an empty output-directory.`);
    throw error;
  }

  const manifestFiles = await findMatchingFiles(workspace, MANIFEST_PATTERNS, [outputRoot]);
  const sbom = input("sbom-path")
    ? await importSbom(workspace, outDir, input("sbom-path"))
    : await generateSbom(workspace, outDir, manifestFiles);
  for (const warning of sbom.warnings ?? []) annotation("warning", `SBOM generation: ${warning}`);
  if (sbom.mode === "generated-manifest-fallback") {
    annotation("warning", "No SBOM was supplied. Generated a manifest-derived fallback; verify it against shipped artifacts.");
  }

  const patterns = splitList(input("evidence-paths"));
  const includeRawReports = boolInput("include-raw-reports", false);
  const evidenceFiles = patterns.length > 0 ? await findMatchingFiles(workspace, patterns, [outputRoot]) : [];
  const evidence = patterns.length > 0
    ? await collectEvidence(workspace, outDir, evidenceFiles, patterns, includeRawReports)
    : [];
  for (const item of evidence) {
    item.collectedAtWorkspaceCommit = changes.currentSha;
    item.producerCommit = null;
    item.producerCommitRelation = "not-declared";
  }
  const declaredSbomSha = input("sbom-source-sha");
  if (sbom.mode === "generated-manifest-fallback") {
    sbom.sourceCommit = changes.currentSha;
    sbom.sourceCommitMatchesRelease = true;
    sbom.sourceCommitRelation = "observed-workspace-head-matches-release";
    sbom.note = "Generated from manifests while workspace HEAD matched the release commit. This is a manifest-only inventory; no independent full CycloneDX schema validation was performed, and its digest is not a signed provenance attestation.";
  } else if (declaredSbomSha) {
    const normalizedDeclaredSha = declaredSbomSha.toLowerCase();
    const exists = /^[a-f0-9]{40}$/.test(normalizedDeclaredSha)
      && await gitSuccess(workspace, ["cat-file", "-e", `${normalizedDeclaredSha}^{commit}`]);
    sbom.sourceCommit = exists ? normalizedDeclaredSha : null;
    sbom.sourceCommitMatchesRelease = exists ? normalizedDeclaredSha === changes.currentSha.toLowerCase() : false;
    sbom.sourceCommitRelation = !exists
      ? "declared-commit-unresolvable"
      : sbom.sourceCommitMatchesRelease
        ? "declared-commit-matches-release"
        : "declared-commit-mismatch";
    const recognitionNote = sbom.structureRecognized
      ? "Limited supported-structure checks passed; no full CycloneDX or SPDX schema validation was performed."
      : "The file did not pass the supported structural checks; no full CycloneDX or SPDX schema validation was performed.";
    sbom.note = sbom.sourceCommitMatchesRelease
      ? `Imported unchanged; the declared source commit equals the release commit. ${recognitionNote} This declaration is not a signed provenance attestation.`
      : `The declared SBOM source commit is invalid, unavailable, or different from the release commit. ${recognitionNote}`;
  }
  const requiredEvidence = splitList(input("required-evidence", "sbom,test-results,security-scan,change-summary"));
  const present = evidencePresence(sbom, evidence, changes);
  const gaps = requiredEvidence.filter((category) => !present.has(category)).map((category) => ({
    category,
    message: category === "change-summary"
      ? (changes.reason ?? "No release-to-release comparison was produced.")
      : `No ${category} evidence matched the configured inputs.`,
  }));
  if (sbom.components === 0) {
    gaps.push({ category: "sbom-content", message: "The SBOM contains no components; inspect generator coverage or supply a release SBOM." });
  }
  if (sbom.structureRecognized !== true) {
    gaps.push({ category: "sbom-format", message: "The supplied file did not pass the limited supported-structure checks for CycloneDX 1.2-1.7 or SPDX 2.2-2.3 JSON. No full schema validation is performed." });
  }
  if (sbom.sourceCommitMatchesRelease !== true) {
    gaps.push({ category: "sbom-revision", message: "The SBOM has no resolvable declared source commit matching the release commit." });
  }
  for (const item of evidence.filter((entry) => entry.parseStatus !== "parsed")) {
    gaps.push({ category: "report-parse", message: `${item.sourcePath} is ${item.parseStatus}; its digest was retained but it does not satisfy ${item.category}.` });
  }

  const repository = process.env.GITHUB_REPOSITORY || path.basename(workspace);
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
  const runId = process.env.GITHUB_RUN_ID || null;
  const report = {
    schemaVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
    generator: {
      name: "cra-release-evidence",
      version: "0.1.0",
      actionRef: process.env.GITHUB_ACTION_REF || null,
      actionRepository: process.env.GITHUB_ACTION_REPOSITORY || null,
    },
    status: gaps.length === 0 ? "complete" : "gaps-found",
    statusMeaning: "Completeness against the configured evidence list only; not legal compliance.",
    release: {
      repository,
      tag: releaseTag,
      commit: changes.currentSha,
      event: process.env.GITHUB_EVENT_NAME || "local",
      runId,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
      workflow: process.env.GITHUB_WORKFLOW || null,
      workflowRunUrl: runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : null,
    },
    policy: {
      requiredEvidence,
      includeRawReports,
      failOnGaps: boolInput("fail-on-gaps", false),
    },
    sbom: { ...sbom, absolutePath: undefined },
    evidence,
    changes,
    gaps,
    manualCheckpoints: [
      { title: "CRA scope and product classification", status: "not evaluated", note: "A GitHub release is not automatically a legal placing on the EU market." },
      { title: "Cybersecurity risk and residual-risk acceptance", status: "not evaluated", note: "Technical findings require accountable human judgment." },
      { title: "Conformity assessment, EU declaration, and CE marking", status: "not evaluated", note: "These cannot be issued or approved by this action." },
      { title: "Authority and user notifications", status: "not evaluated", note: "Reporting duties are event-driven and require an authorized person; this action sends nothing." },
      { title: "Release approval", status: "not evaluated", note: "The package is evidence input, not an automated release authorization." },
    ],
    legalBoundary: "Not legal advice, not a CRA scanner, not a conformity assessment, and not a guarantee of compliance.",
  };

  const jsonPath = path.join(outDir, "evidence.json");
  const markdownPath = path.join(outDir, "EVIDENCE.md");
  const changesPath = path.join(outDir, "changes.json");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdownFor(report), "utf8");
  await writeFile(changesPath, `${JSON.stringify(changes, null, 2)}\n`, "utf8");

  const manifestInputs = [jsonPath, markdownPath, changesPath, sbom.absolutePath];
  if (includeRawReports) {
    for (const item of evidence.filter((entry) => entry.packagedPath)) manifestInputs.push(path.join(outDir, item.packagedPath));
  }
  await writeManifest(outDir, manifestInputs);

  await setOutput("package-dir", outDir);
  await setOutput("markdown-path", markdownPath);
  await setOutput("json-path", jsonPath);
  await setOutput("status", report.status);
  await setOutput("gap-count", String(gaps.length));
  await setOutput("release-tag", releaseTag);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdownFor(report), "utf8");

  process.stdout.write(`Evidence package: ${outDir}\n`);
  if (gaps.length > 0) annotation("warning", `${gaps.length} evidence gap(s) found. This is not a legal compliance result.`);
  else annotation("notice", "Configured evidence list is complete. This is not a legal compliance result.");
  if (gaps.length > 0 && boolInput("fail-on-gaps", false)) process.exitCode = 2;
}

main().catch((error) => {
  annotation("error", error.stack || error.message);
  process.exitCode = 1;
});
