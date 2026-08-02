# CRA Release Evidence

> Evidence for a release, not a legal verdict.

**Status:** This is a source-only prototype. No `v0.1.0` release or Marketplace listing exists yet, and the public pilot/support intake remains disabled pending human approval.

CRA Release Evidence is a free GitHub Action that turns existing SBOMs, test results, security reports, and Git changes into a version-specific Markdown and JSON evidence index.

It is **not** a general CRA scanner, legal advice, a conformity assessment, or a guarantee of compliance with the EU Cyber Resilience Act. Product scope, cybersecurity risk assessment, residual-risk acceptance, conformity assessment, the EU declaration of conformity, CE marking, and regulatory notifications remain human responsibilities.

## What the action does

- anchors the record to an existing Git tag and the exact checked-out commit;
- imports supported CycloneDX 1.2–1.7 JSON or SPDX 2.2–2.3 JSON after limited structural recognition, or creates a clearly labelled manifest-only CycloneDX fallback;
- discovers local JUnit, SARIF, Trivy, Snyk, coverage, and other configured report files;
- optionally checks one declared producer commit for all matched report files against the release commit;
- records changes from an explicit previous tag or the nearest reachable ancestor tag;
- reports configured evidence gaps without turning them into legal conclusions;
- writes `EVIDENCE.md`, `evidence.json`, `changes.json`, `MANIFEST.sha256`, and an SBOM;
- runs without a vendor backend, runtime downloads, or action telemetry.

## Quick start

The reports must already exist in the current job workspace. The collector itself needs only `contents: read`.

```yaml
name: Release evidence

on:
  release:
    types: [published]

jobs:
  evidence:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check out the released revision
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.release.tag_name }}
          fetch-depth: 0
          persist-credentials: false

      - name: Build the release evidence index
        id: evidence
        uses: mastermuetze/cra-release-evidence@0dd17d8ed483f3929363c2cd87936ac9c7928f8f
        with:
          release-tag: ${{ github.event.release.tag_name }}
          evidence-paths: |
            reports/**/*.sarif
            reports/**/junit*.xml
            reports/**/trivy*.json
            reports/**/snyk*.json
          include-raw-reports: false
          fail-on-gaps: false

      - name: Retain the versioned package
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: cra-evidence-${{ github.run_id }}
          path: ${{ steps.evidence.outputs.package-dir }}
          if-no-files-found: error
          retention-days: 90
```

The pinned 40-character SHA identifies the tested source-only prototype commit. Review it before use. After a separately approved `v0.1.0` release exists, resolve that release to its reviewed commit and continue pinning the immutable SHA in consuming workflows.

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `release-tag` | current ref name | Existing local tag. The workspace `HEAD` must resolve exactly to it. |
| `previous-tag` | nearest reachable ancestor tag | Pass explicitly when release-accurate predecessor selection matters. |
| `sbom-path` | empty | Workspace-relative supported CycloneDX JSON or SPDX JSON file. The action performs limited structural recognition, not full official-schema validation. |
| `sbom-source-sha` | empty | Declared full source commit. Equality is checked; this is not signed provenance. |
| `evidence-paths` | common report globs | Newline- or comma-separated workspace globs. |
| `evidence-source-sha` | empty | Optional declared producer commit for all matched reports. A mismatch creates evidence gaps; it is not signed provenance. |
| `required-evidence` | `sbom,test-results,security-scan,change-summary` | Local completeness policy, never a CRA result. |
| `output-directory` | `cra-evidence` | Workspace-relative output root. |
| `include-raw-reports` | `false` | Copies matched raw reports only after an explicit opt-in. |
| `fail-on-gaps` | `false` | Produces the package first, then fails when configured evidence is missing. |

## Outputs

`package-dir`, `markdown-path`, `json-path`, `status`, `gap-count`, and `release-tag` are available as step outputs. `status` is either `complete` or `gaps-found` against the configured evidence list; it is never a compliance status.

## Output layout

```text
cra-evidence/release-v1.4.0-<tag-hash>/
├── EVIDENCE.md
├── evidence.json
├── changes.json
├── MANIFEST.sha256
├── sbom/
└── raw/                 # only with explicit opt-in
```

SHA-256 digests support later consistency checks. They do not prove authenticity or tamper resistance without a trusted signed attestation or immutable store. When raw reports are not copied, the package is an index and the original evidence sources need controlled retention elsewhere.

## Release and data boundaries

- The action reads only the checked-out workspace and local Git history.
- It does not fetch scanner portals, Code Scanning results, or earlier workflow artifacts through APIs.
- It does not upload evidence. The example stores the output as a GitHub Workflow Artifact in the user's repository.
- An imported SBOM is always copied into `sbom/` (or the action writes its labelled fallback). Review its contents and the destination before uploading the package, especially to a public release.
- Matched raw test and security reports such as SARIF or scanner output remain excluded unless `include-raw-reports: true` is set.
- `structureRecognized` means the supported version and selected required fields passed the action's limited checks. `schemaValidation` remains `not-performed`; use a dedicated validator when full CycloneDX/SPDX schema conformance matters.
- The manifest-only SBOM fallback is not a binary inventory and may be incomplete. Import an SBOM from the actual build for stronger release evidence.

## Verified public demo

The project-owned repository [mastermuetze/cra-release-evidence-demo](https://github.com/mastermuetze/cra-release-evidence-demo) ran release [`v0.1.1`](https://github.com/mastermuetze/cra-release-evidence-demo/releases/tag/v0.1.1) against immutable merged Action commit `137386fa91f3ee81b961e67f2fa315f4333803a0`. The [release workflow](https://github.com/mastermuetze/cra-release-evidence-demo/actions/runs/30743346821) passed, and its inspected evidence ZIP plus SHA-256 checksum are attached to the release.

This proves the public consumer workflow for the source-only prototype. It is project-owned and therefore does not count as an external activation or market validation.

## Pilot validation

The project is validating the free collector before building any paid platform. A real activation means one external repository produced a package for an actual product release. Stars, clicks, forks, demo tags, and copied workflow files do not count.

The **Pilot registration** issue form is shipped as the disabled file `.github/ISSUE_TEMPLATE/pilot-registration.yml.template`. Activate it only after the repository owner has replaced the operator/privacy publication blocker. Never attach private SBOMs, findings, source code, internal paths, credentials, raw evidence, or additional personal data to a public issue. Public GitHub account, profile, and issue metadata remain visible. See [docs/PILOT.md](docs/PILOT.md).

## Security, support, and licensing

- Responsible publisher: **Benjamin Warnow**
- Legal form: **sole proprietorship**
- Business name: **Warnowdigitalsolutions**
- Address: **An der hohlen Gasse 19, 4058 Basel, Switzerland**
- UID/CHE identifier: **not yet available**
- General contact: [hallo@warnowdigitalsolutions.ch](mailto:hallo@warnowdigitalsolutions.ch)
- Security policy: [SECURITY.md](SECURITY.md)
- Human release decision record: [docs/HUMAN-RELEASE-RECORD.md](docs/HUMAN-RELEASE-RECORD.md)
- Support policy: [SUPPORT.md](SUPPORT.md)
- Data handling: [PRIVACY.md](PRIVACY.md)
- Software license: [MIT](LICENSE)

The Marketplace publisher must replace [EULA-DRAFT.md](EULA-DRAFT.md) with a legally approved `EULA.md` before listing. The draft is not legal advice and is intentionally a release blocker.
