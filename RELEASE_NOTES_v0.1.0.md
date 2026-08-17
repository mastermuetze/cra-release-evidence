# CRA Release Evidence v0.1.0

The first public prototype turns material already present in a GitHub Actions workspace into a version-specific Markdown and JSON evidence index.

## What is included

- exact release-tag and checked-out commit binding;
- supported CycloneDX 1.2–1.7 JSON and SPDX 2.2–2.3 JSON import with limited structural recognition, not full official-schema validation;
- a clearly labelled manifest-only CycloneDX fallback when no SBOM is supplied;
- local JUnit, SARIF, Trivy, Snyk, coverage, and configured report discovery;
- a change summary from an explicit previous tag or the nearest reachable ancestor tag;
- explicit gaps against the user's configured evidence list;
- `EVIDENCE.md`, `evidence.json`, `changes.json`, `MANIFEST.sha256`, and an SBOM.

## Security and data boundaries

- The collector itself needs only `contents: read`.
- It reads the checked-out workspace and local Git history.
- It has no vendor backend, runtime download, or action telemetry.
- Imported SBOMs are copied into the output package. Matched raw test and security reports remain excluded unless `include-raw-reports: true` is set.
- SHA-256 digests support consistency checks; they are not signed provenance or proof of authenticity.

Review the package and its destination before uploading it, especially from a public repository.

## Important scope boundary

This release is an evidence collector, not a CRA scanner, legal advice, a conformity assessment, or a guarantee of compliance. It does not decide product scope, cybersecurity risk acceptance, the EU declaration of conformity, CE marking, or regulatory notifications. Those remain human responsibilities.

## Requirements

- GitHub-hosted runner, or a current self-hosted Actions Runner with Node 24 action support;
- Git available in the runner;
- checkout with full tag history for predecessor detection;
- test, security, and SBOM files copied or generated in the current job workspace.

## Start and verify

- [Quick start for v0.1.0](https://github.com/mastermuetze/cra-release-evidence/blob/v0.1.0/README.md#quick-start)
- [Verified public demo](https://github.com/mastermuetze/cra-release-evidence-demo/releases/tag/v0.1.2)
- [Security policy](https://github.com/mastermuetze/cra-release-evidence/security/policy)
- [Support policy](https://github.com/mastermuetze/cra-release-evidence/blob/v0.1.0/SUPPORT.md)
- [End-user licence](https://github.com/mastermuetze/cra-release-evidence/blob/v0.1.0/EULA.md)

For production use, resolve `v0.1.0` to its reviewed 40-character commit SHA and pin that immutable SHA in the consuming workflow.
