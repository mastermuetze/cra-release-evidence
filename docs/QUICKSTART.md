# Five-minute Trivy quick start

This path is for a GitHub repository that publishes installable software, a developer tool, or device firmware and does not already create an SBOM and security report. It adds one release-triggered workflow. No vendor account, token, or backend is required.

> CRA Release Evidence indexes technical artifacts for one release. It is not a CRA scanner, legal advice, a conformity assessment, risk acceptance, or a guarantee of compliance. Human owners still decide product scope, risk, release approval, conformity work, CE marking, and notifications.

## 1. Add the workflow

Create this file in the repository:

```text
.github/workflows/trivy-release-evidence.yml
```

Copy the complete contents of [`examples/trivy-release-evidence.yml`](../examples/trivy-release-evidence.yml). The example is ready to run and already:

- grants only `contents: read`;
- checks out the exact released tag without retaining credentials;
- creates a CycloneDX SBOM and SARIF report with Trivy;
- declares the checked-out release commit as the producer revision;
- excludes raw scanner reports from the evidence package;
- pins all external actions to immutable 40-character commit SHAs.

Review the workflow in your own repository before committing it. Keep the full SHA pins and deliberately review version updates.

## 2. Publish a release

Commit the workflow to the default branch, then publish a normal GitHub release for an existing or new tag. The workflow uses the published release tag and fetches the Git history needed to compare it with the nearest reachable earlier tag.

The `release: published` trigger creates an after-publication archive. If publishing the GitHub release is itself your legal market-placement event, move evidence generation into a build or draft-release process and require human review before publication.

## 3. Download the package

Open **Actions → Trivy release evidence → the release run**. Download the artifact named `cra-evidence-<release-tag>`.

The archive contains:

```text
cra-evidence/release-v1.4.0-<tag-hash>/
├── EVIDENCE.md
├── evidence.json
├── changes.json
├── MANIFEST.sha256
└── sbom/
```

Start with `EVIDENCE.md`. The `complete` or `gaps-found` status describes only the evidence categories configured in the workflow; it is never a CRA compliance result. See the [representative output](EXAMPLE-OUTPUT.md).

Before choosing a long-term destination, review the imported SBOM for sensitive product information. The default workflow keeps raw SARIF findings out of the package. The package remains in a GitHub Actions artifact owned by your repository and is not uploaded to the CRA Release Evidence publisher.

## 4. Check integrity and gaps

Verify `MANIFEST.sha256` with your normal checksum tool, parse `evidence.json`, and review every item under **Evidence gaps** and **Human checkpoints**. Digests help detect later inconsistency; without a trusted signed attestation or immutable store they do not prove authenticity.

## 5. Optionally confirm a real activation

After a real external product release generated both `EVIDENCE.md` and parseable `evidence.json`, you may submit an optional [activation confirmation](https://github.com/mastermuetze/cra-release-evidence/issues/new?template=activation-report.yml). Action revisions that include the activation prompt also show this link in the workflow summary; the prompt never submits anything automatically.

The Action sends no telemetry and does not report automatically. The public form requests only minimal verification metadata and never asks you to transmit the evidence package. Do not attach or paste SBOMs, findings, source code, raw reports, internal paths, credentials, or private repository names. Read the [activation privacy boundary](ACTIVATION.md) before submitting information about a private repository.
