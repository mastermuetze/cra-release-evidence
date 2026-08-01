# CRA Release Evidence v0.1.0

This first public prototype creates a version-specific evidence index from material already present in a GitHub Actions workspace.

## Included

- exact release tag and commit binding;
- supported CycloneDX 1.2–1.7 JSON and SPDX 2.2–2.3 JSON import with limited structural recognition (not full schema validation);
- manifest-only CycloneDX fallback;
- local test and security report discovery;
- previous-tag change summary;
- explicit evidence gaps and human checkpoints;
- Markdown, JSON, SBOM, changes, and SHA-256 manifest output.

## Important boundaries

This release is not a CRA scanner, legal advice, or a conformity decision. It does not validate the legal sufficiency, authenticity, or completeness of supplied evidence. It makes no network calls to a vendor backend and does not send action telemetry.

## Requirements

- GitHub-hosted runner or self-hosted Actions Runner with Node 24 action support;
- Git available in the runner;
- checkout with full tag history for predecessor detection;
- reports copied or generated into the current job workspace.

Before publishing these notes, replace all owner placeholders, complete the launch checklist, and link the reviewed release commit SHA.
