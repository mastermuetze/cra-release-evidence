# Data handling and privacy

## Action execution

CRA Release Evidence processes files inside the GitHub Actions runner. Version `0.1.0` has no vendor backend, does not send action telemetry, and does not call scanner portals or GitHub security APIs.

The action writes its result only to the configured workspace output directory. Storage or publication happens only when the user's workflow adds a separate step such as `actions/upload-artifact`, a release upload, or a repository commit.

An imported SBOM is always copied into the package under `sbom/`; otherwise the action writes its clearly labelled manifest-only fallback there. SBOMs can expose dependency names, versions, internal product structure, and other sensitive information. The `include-raw-reports` switch controls only matched raw test and security reports such as SARIF or scanner output. Users must review the package destination's visibility and retention before uploading either the default package or opted-in raw reports.

GitHub and any scanner actions used in the surrounding workflow process data under their own terms and privacy notices. They are not operated by this project.

## Pilot registration

The pilot issue form is optional and stored by GitHub as a public issue. A submitter's public GitHub account, profile, and issue metadata are visible to GitHub and issue readers. Do not submit source code, SBOM contents, vulnerability findings, credentials, confidential filenames, raw evidence, or additional personal data. Commercial commitments and private-repository verification must use a separately agreed private channel after the publisher has documented its operator and privacy information.

## Publication blocker

**Status: `OPERATOR_DETAILS_REQUIRED`.** Before GitHub Issues, the pilot form, or any separate private/commercial intake is enabled, the responsible owner must replace this marker with concrete, reviewed information covering at least:

- operator identity and a monitored contact channel;
- purposes and scope of the public pilot intake;
- GitHub/public visibility and any separate systems used;
- retention and deletion rules plus a request channel; and
- the privacy notice and approvals applicable to that operator.

This file describes technical behavior only. Its presence is not a legal or privacy approval, and the publication preflight intentionally fails while the marker remains.
