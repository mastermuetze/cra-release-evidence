# Trivy to versioned release evidence

Trivy already produces useful security data. CRA Release Evidence does not rescan or reinterpret it. It binds the existing Trivy SBOM and SARIF report to one Git release and packages them with the Git change summary as Markdown and JSON.

> This is a technical evidence workflow, not a CRA assessment, legal advice, risk acceptance, or proof of conformity. Humans remain responsible for product scope, risk decisions, release approval, conformity work, CE marking, and regulatory reporting.

## Copy-ready workflow

Copy [`examples/trivy-release-evidence.yml`](../examples/trivy-release-evidence.yml) to `.github/workflows/trivy-release-evidence.yml` in your repository.

The workflow uses immutable full commit SHAs and needs only:

```yaml
permissions:
  contents: read
```

For each published release it:

1. checks out the exact release tag with full Git history;
2. asks Trivy v0.36.0 for a CycloneDX SBOM;
3. asks Trivy for a SARIF vulnerability report;
4. records the checked-out release commit as the declared producer revision;
5. creates `EVIDENCE.md`, `evidence.json`, `changes.json`, `MANIFEST.sha256`, and the imported SBOM;
6. retains the package as a workflow artifact in your GitHub repository.

The example pins Trivy to commit `ed142fd0673e97e23eac54620cfb913e5ce36c25` and CRA Release Evidence v0.1.0 to `62c7f6d5a635390cfa8f6b3c2364c240e3bb647c`. Review and deliberately update both pins when adopting later versions.

## What the two Trivy outputs mean

- `reports/bom.cdx.json` is the dependency inventory imported into the evidence package. CRA Release Evidence performs limited structural recognition; it does not perform full official CycloneDX schema validation.
- `reports/trivy.sarif` is indexed as security-scan evidence. The default package records its presence, size, SHA-256 digest, format, and neutral summary without copying the raw SARIF file.
- `include-raw-reports: false` keeps matched raw security reports out of the package. The imported SBOM is still included and can itself contain sensitive product information, so review artifact visibility and retention.

Trivy findings are not automatically accepted, rejected, or converted into a compliance status. Set release and risk policy in a separate human-controlled step.

## Add your test results

If the same job already creates JUnit XML, add its path and require the category:

```yaml
with:
  evidence-paths: |
    reports/trivy.sarif
    reports/**/junit*.xml
  required-evidence: sbom,test-results,security-scan,change-summary
```

Reports from another job must first be downloaded into the current workspace. The collector does not fetch earlier workflow artifacts, scanner portals, or GitHub Code Scanning results through APIs.

## Try it on a real release

1. Add the workflow on your default branch.
2. Create and publish a normal product release tag.
3. Open the completed `Trivy release evidence` workflow run.
4. Download `cra-evidence-<release-tag>`.
5. Inspect `EVIDENCE.md`, parse `evidence.json`, and verify `MANIFEST.sha256` before deciding where to retain the package.

A workflow triggered by `release: published` is an after-publication archive. If the GitHub release itself is your market placement, generate and review evidence during the build or draft-release process before publication.

If an external repository produced both `EVIDENCE.md` and parseable `evidence.json` for a real product release, you can [voluntarily report an activation](https://github.com/mastermuetze/cra-release-evidence/issues/new?template=activation-report.yml). Do not submit SBOMs, findings, source code, raw reports, credentials, private repository names, or other confidential evidence.
