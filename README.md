# CRA Release Evidence

> Evidence for a release, not a legal verdict.

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

## Install with Trivy in five minutes

Create `.github/workflows/trivy-release-evidence.yml` in your repository and copy the complete workflow below. It uses only `contents: read`, keeps the raw SARIF security report out of the package while retaining the imported SBOM, and pins every third-party action to an immutable full commit SHA.

```yaml
name: Trivy release evidence

on:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  evidence:
    runs-on: ubuntu-latest
    steps:
      - name: Check out the released revision
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.release.tag_name }}
          fetch-depth: 0
          persist-credentials: false

      - name: Prepare local report directory
        run: mkdir -p reports

      - name: Generate CycloneDX SBOM with Trivy
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
        with:
          scan-type: fs
          scan-ref: .
          format: cyclonedx
          output: reports/bom.cdx.json
          exit-code: "0"

      - name: Generate SARIF security report with Trivy
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
        with:
          scan-type: fs
          scan-ref: .
          format: sarif
          output: reports/trivy.sarif
          exit-code: "0"
          skip-setup-trivy: true

      - name: Record the checked-out release commit
        id: release
        shell: bash
        run: echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"

      - name: Build the versioned evidence package
        id: evidence
        uses: mastermuetze/cra-release-evidence@62c7f6d5a635390cfa8f6b3c2364c240e3bb647c # v0.1.0
        with:
          release-tag: ${{ github.event.release.tag_name }}
          sbom-path: reports/bom.cdx.json
          sbom-source-sha: ${{ steps.release.outputs.sha }}
          evidence-paths: reports/trivy.sarif
          evidence-source-sha: ${{ steps.release.outputs.sha }}
          required-evidence: sbom,security-scan,change-summary
          include-raw-reports: false
          fail-on-gaps: false

      - name: Retain the evidence package
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
        with:
          name: cra-evidence-${{ github.event.release.tag_name }}
          path: ${{ steps.evidence.outputs.package-dir }}
          if-no-files-found: error
          retention-days: 90
```

Then commit the workflow and publish a normal GitHub release. Open the completed **Trivy release evidence** run and download `cra-evidence-<tag>`. The archive contains the version-specific Markdown and JSON index, change summary, digest manifest, and imported SBOM.

See the [five-minute walkthrough](docs/QUICKSTART.md), the maintained [copy-ready workflow file](examples/trivy-release-evidence.yml), and [what the output looks like](docs/EXAMPLE-OUTPUT.md). If you already produce reports in another workflow, use the [existing-report integration guide](docs/TRIVY-RELEASE-EVIDENCE.md#add-your-test-results).

The pinned Action SHA above is the reviewed v0.1.0 revision. Review and deliberately update immutable pins when adopting later releases; do not replace them with a mutable branch reference in production.

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

The project-owned repository [mastermuetze/cra-release-evidence-demo](https://github.com/mastermuetze/cra-release-evidence-demo) ran release [`v0.1.2`](https://github.com/mastermuetze/cra-release-evidence-demo/releases/tag/v0.1.2) against immutable merged Action commit `625729f34a9ab8fcdecff1ab9ab2b8755b4ab00d`. The [release workflow](https://github.com/mastermuetze/cra-release-evidence-demo/actions/runs/30748406259) passed, and its inspected evidence ZIP plus SHA-256 checksum are attached to the release. The SBOM, test, and security evidence declare producer revisions that match the release commit.

This proves the public consumer workflow for the source-only prototype. It is project-owned and therefore does not count as an external activation or market validation.

## Pilot validation

The project is validating the free collector before building any paid platform. A real activation means one external repository produced a package for an actual product release. Stars, clicks, forks, demo tags, and copied workflow files do not count.

The optional [Activation report](https://github.com/mastermuetze/cra-release-evidence/issues/new?template=activation-report.yml) creates a public candidate only. It counts only after human verification and deduplication. Never attach private SBOMs, findings, source code, internal paths, credentials, raw evidence, or additional personal data to a public issue. Public GitHub account, profile, and issue metadata remain visible. Read the [activation privacy boundary](docs/ACTIVATION.md) before reporting a private-repository run. The separate commercial pilot form remains disabled. See [docs/PILOT.md](docs/PILOT.md).

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
- End-user licence: [EULA.md](EULA.md)
- EULA approval record: [docs/EULA-APPROVAL.md](docs/EULA-APPROVAL.md)
- Software license: [MIT](LICENSE)

The authorized Publisher approved the v0.1.0 EULA on 2 August 2026. The approval record documents the exact file hash and the boundary of that human decision; it is not a CRA or release verdict.
