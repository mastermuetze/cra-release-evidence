# What the evidence package looks like

The following is a shortened, illustrative rendering of an evidence package. Names, commits, hashes, counts, and paths are synthetic. The checked-in example shows format and interpretation only; it is not evidence for a product and is not an activation.

For an independently inspectable project-owned run, see the public [`v0.1.2` demo release](https://github.com/mastermuetze/cra-release-evidence-demo/releases/tag/v0.1.2). A project-owned demo does not count as external market validation.

## `EVIDENCE.md`

```markdown
# Release evidence index — v1.4.0

> Automated evidence index, not a conformity assessment. “Found” means a
> configured file or generated record was indexed; it does not mean a legal
> requirement is fulfilled or that the source is authentic.

## Release identity

- Repository: `example/widget-cli`
- Tag: `v1.4.0`
- Commit: `1111111111111111111111111111111111111111`
- Previous tag: `v1.3.0`

## Configured completeness

Overall status: **complete** (configured evidence only; never a CRA compliance result).

| Category | Status | Note |
|---|---|---|
| sbom | Found | Indexed with a digest in evidence.json |
| security-scan | Found | Indexed with a digest in evidence.json |
| change-summary | Found | Indexed with a digest in evidence.json |

## SBOM

- Mode: imported
- Format: CycloneDX 1.6 JSON
- Structure recognition: passed supported structural checks
- Full schema validation: not-performed
- Components: 42
- Source-commit relation: declared-commit-matches-release

## Collected reports

| Type | Source | Parse status | Producer-commit relation | SHA-256 | Summary |
|---|---|---|---|---|---|
| security-scan | `reports/trivy.sarif` | parsed | declared-commit-matches-release | `222222222222…` | {"runs":1,"results":3} |

Raw reports are not copied by default; only digests and summaries remain in
`evidence.json`. Preserve the original sources separately.

## Changes from the previous release

7 commits and 13 changed paths; 2 paths flagged for security review.

## Evidence gaps

- No gaps against the configured evidence list.

## Human checkpoints — not automated

- **Cybersecurity risk and residual-risk acceptance:** not evaluated. Technical
  findings require accountable human judgment.
- **Release approval:** not evaluated. The package is evidence input, not an
  automated release authorization.
```

## `evidence.json`

The JSON file carries the same release identity and status in a machine-readable form. A representative excerpt is:

```json
{
  "schemaVersion": "0.1.0",
  "status": "complete",
  "statusMeaning": "Completeness against the configured evidence list only; not legal compliance.",
  "release": {
    "repository": "example/widget-cli",
    "tag": "v1.4.0",
    "commit": "1111111111111111111111111111111111111111"
  },
  "policy": {
    "requiredEvidence": ["sbom", "security-scan", "change-summary"],
    "includeRawReports": false,
    "failOnGaps": false
  },
  "sbom": {
    "mode": "imported",
    "format": "CycloneDX 1.6 JSON",
    "components": 42,
    "structureRecognized": true,
    "schemaValidation": "not-performed",
    "sourceCommitRelation": "declared-commit-matches-release"
  },
  "gaps": [],
  "legalBoundary": "Not legal advice, not a CRA scanner, not a conformity assessment, and not a guarantee of compliance."
}
```

The real file also records full SHA-256 digests, parse status, report summaries, change metadata, and the five unevaluated human checkpoints. A `complete` example only means the configured files were present and recognized. It does not mean findings were acceptable, the SBOM was complete, CRA duties were fulfilled, or the release was approved.

