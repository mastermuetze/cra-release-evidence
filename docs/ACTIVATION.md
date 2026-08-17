# Optional activation confirmation

CRA Release Evidence has no activation telemetry. Running the Action does not contact the publisher, create an issue, or transmit your evidence package. A confirmation happens only when a user deliberately submits the public [Activation report](https://github.com/mastermuetze/cra-release-evidence/issues/new?template=activation-report.yml).

## What the form requests

- Action version or immutable commit SHA;
- target product segment;
- public or private repository visibility;
- a stable deduplication key;
- product release date;
- verification route; and
- confirmations that the run was external, represented a real product release, and generated both output files.

The report is a candidate only. A human must verify and deduplicate it before it can count toward validation.

## What the form must not contain

Never attach or paste:

- `EVIDENCE.md`, `evidence.json`, the SBOM, or the evidence archive;
- vulnerability findings, SARIF, test logs, or other raw reports;
- source code, internal paths, credentials, tokens, or customer information; or
- a private repository or company name.

The form is a public GitHub issue. The submitter's public account, profile, answers, and issue metadata are visible to GitHub and issue readers.

For a private repository, generate a new random opaque activation key such as `cre-a7f3c2d1...`; do not use the repository name or a plain hash of a guessable name. Leave the public verification URL blank. Any private verification must be agreed separately and must verify package presence and release context without collecting evidence contents.

Submitting the form does not request legal review, risk acceptance, release approval, or a CRA compliance decision.

