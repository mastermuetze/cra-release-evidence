import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const releaseTag = "v0.1.0";
const ownerPlaceholder = ["YOUR", "GITHUB", "OWNER"].join("_");
const operatorMarker = ["OPERATOR", "DETAILS", "REQUIRED"].join("_");
const blockers = [];
const manual = [
  "Confirm the Marketplace action name is unique in the release dialog.",
  "Confirm the authorized owner accepted the Marketplace Developer Agreement and uses 2FA.",
  "Confirm the authorized owner approved EULA.md; file existence is only a technical check.",
  "Confirm the operator/privacy information and intake process were reviewed before enabling the public pilot form.",
  "Confirm the final repository is public and all required branch rules and CI checks are active and green.",
  "Run a separate consumer-repository smoke test against the released full SHA.",
  "Verify the live repository, release/tag, README #quick-start anchor, optional pilot URL, and Marketplace URL before changing the landing-page phase.",
];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "cra-evidence"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else files.push(absolute);
  }
  return files;
}

for (const file of await walk(root)) {
  if (!/\.(?:md|ya?ml|json|mjs|txt|template)$/i.test(file) && path.basename(file) !== "CODEOWNERS") continue;
  const source = await readFile(file, "utf8");
  if (source.includes(ownerPlaceholder)) {
    blockers.push(`Replace the GitHub owner placeholder in ${path.relative(root, file)}.`);
  }
  if (source.includes(operatorMarker)) {
    blockers.push(`Replace the operator/privacy publication marker in ${path.relative(root, file)} with reviewed owner-specific information.`);
  }
}

if (existsSync(path.join(root, "EULA-DRAFT.md"))) blockers.push("Remove EULA-DRAFT.md after approved end-user terms exist.");
if (!existsSync(path.join(root, "EULA.md"))) blockers.push("Add a legally approved EULA.md.");
if (!existsSync(path.join(root, ".github", "CODEOWNERS"))) blockers.push("Create .github/CODEOWNERS with real maintainers.");

for (const file of ["SECURITY.md", "SUPPORT.md"]) {
  const source = await readFile(path.join(root, file), "utf8");
  if (/Before publication|must replace/i.test(source)) blockers.push(`Replace publication placeholders in ${file}.`);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function isGitHubRepositoryRemote(remote) {
  let repositoryPath = null;
  if (remote.startsWith("https://")) {
    try {
      const parsed = new URL(remote);
      if (
        parsed.protocol !== "https:"
        || parsed.hostname.toLowerCase() !== "github.com"
        || parsed.username
        || parsed.password
        || parsed.search
        || parsed.hash
      ) return false;
      repositoryPath = parsed.pathname.replace(/^\/+|\/+$/g, "");
    } catch {
      return false;
    }
  } else {
    const match = remote.match(/^(?:git@github\.com:|ssh:\/\/git@github\.com\/)([^\s]+)$/i);
    if (!match) return false;
    repositoryPath = match[1];
  }

  repositoryPath = repositoryPath.replace(/\.git$/i, "");
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]+$/.test(repositoryPath);
}

let standaloneRepository = false;
let remoteReady = false;
let head = null;
try {
  const topLevel = path.resolve(git(["rev-parse", "--show-toplevel"]));
  standaloneRepository = topLevel.toLowerCase() === path.resolve(root).toLowerCase();
  if (!standaloneRepository) blockers.push("Initialize this export as its own Git repository; do not publish it from a parent worktree.");
} catch {
  blockers.push("Initialize this export as its own Git repository.");
}

if (standaloneRepository) {
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status) blockers.push("Commit or intentionally remove every worktree change before publication.");

  try {
    head = git(["rev-parse", "HEAD"]);
  } catch {
    blockers.push("Create the reviewed release commit before publication.");
  }
  try {
    const remote = git(["remote", "get-url", "origin"]);
    remoteReady = isGitHubRepositoryRemote(remote);
    if (!remoteReady) blockers.push("Origin must be an exact HTTPS or SSH URL for the final github.com owner/repository.");
  } catch {
    blockers.push("Configure the final GitHub origin remote.");
  }

  if (head) {
    try {
      const tagCommit = git(["rev-list", "-n", "1", releaseTag]);
      if (tagCommit !== head) blockers.push(`${releaseTag} must resolve to the current reviewed commit.`);
    } catch {
      blockers.push(`Create the owner-controlled ${releaseTag} tag on the current reviewed commit.`);
    }
  }

  if (remoteReady && head) {
    try {
      const advertised = git(["ls-remote", "--tags", "origin", `refs/tags/${releaseTag}`, `refs/tags/${releaseTag}^{}`]);
      const refs = new Map(advertised.split(/\r?\n/).filter(Boolean).map((line) => line.split(/\s+/, 2).reverse()));
      const remoteCommit = refs.get(`refs/tags/${releaseTag}^{}`) ?? refs.get(`refs/tags/${releaseTag}`);
      if (!remoteCommit) blockers.push(`Push ${releaseTag} to origin before publication.`);
      else if (remoteCommit !== head) blockers.push(`The pushed ${releaseTag} does not resolve to the reviewed current commit.`);
    } catch {
      blockers.push(`Verify that ${releaseTag} is pushed to the final origin; the remote tag check failed.`);
    }
  }
}

console.log("CRA Release Evidence v0.1.0 publication preflight");
console.log("SCOPE: technical checks only; this is not legal, privacy, security, conformity, or Marketplace approval.\n");
if (blockers.length) {
  console.log("BLOCKERS");
  blockers.forEach((item) => console.log(`- ${item}`));
} else {
  console.log("Automatable publication blockers: none.");
}
console.log("\nMANUAL CONFIRMATIONS");
manual.forEach((item) => console.log(`- ${item}`));

process.exitCode = blockers.length ? 2 : 0;
