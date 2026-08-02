# Changelog

All notable changes to this action are documented here.

## 0.1.0 — release candidate

- Create version-specific Markdown and JSON evidence indexes.
- Import supported CycloneDX 1.2–1.7 JSON or SPDX 2.2–2.3 JSON SBOMs with limited structural recognition, explicitly without claiming full schema validation.
- Generate a labelled manifest-only CycloneDX fallback when no SBOM is supplied.
- Summarize local JUnit, SARIF, Trivy, Snyk, coverage, and configured report files.
- Optionally compare a declared producer commit for matched report files with the release commit and report revision mismatches as evidence gaps.
- Record changes from the previous tag and report configured evidence gaps.
- Enforce exact tag-to-`HEAD` identity and workspace-safe output paths.
- Default to no telemetry, no provider backend, and no copied raw test/security reports; an imported SBOM remains part of the package.
