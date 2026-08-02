# Data handling and privacy

## Action execution

CRA Release Evidence processes files inside the GitHub Actions runner. Version `0.1.0` has no vendor backend, does not send action telemetry, and does not call scanner portals or GitHub security APIs.

The action writes its result only to the configured workspace output directory. Storage or publication happens only when the user's workflow adds a separate step such as `actions/upload-artifact`, a release upload, or a repository commit.

An imported SBOM is always copied into the package under `sbom/`; otherwise the action writes its clearly labelled manifest-only fallback there. SBOMs can expose dependency names, versions, internal product structure, and other sensitive information. The `include-raw-reports` switch controls only matched raw test and security reports such as SARIF or scanner output. Users must review the package destination's visibility and retention before uploading either the default package or opted-in raw reports.

GitHub and any scanner actions used in the surrounding workflow process data under their own terms and privacy notices. They are not operated by this project.

## Publisher contact

- Responsible publisher: **Benjamin Warnow**
- Legal form: **sole proprietorship**
- Business name: **Warnowdigitalsolutions**
- Address: **An der hohlen Gasse 19, 4058 Basel, Switzerland**
- UID/CHE identifier: **not yet available**
- Monitored general contact: [hallo@warnowdigitalsolutions.ch](mailto:hallo@warnowdigitalsolutions.ch)

Do not send SBOMs, findings, credentials, source code, private repository details, customer information, or other confidential evidence to this address. These supplied publisher details do not by themselves constitute a reviewed privacy notice.

## Activation reporting

The activation report issue form is optional and stored by GitHub as a public issue. It creates a candidate record only; a human must verify and deduplicate it before counting. A submitter's public GitHub account, profile, and issue metadata are visible to GitHub and issue readers. Do not submit source code, SBOM contents, vulnerability findings, credentials, confidential filenames, raw evidence, company or repository names for private projects, or additional personal data. For a private repository, use a newly generated random opaque identifier and leave the public verification URL blank. Private verification must be arranged separately and no private evidence should be posted or emailed without an agreed process.

## Commercial pilot registration

The separate commercial pilot form remains disabled. Commercial commitments and any design-partner intake require a separately documented private channel, purpose, retention and deletion rules, and reviewed operator information.

## Publication blocker

**Status: `OPERATOR_DETAILS_REQUIRED`.** The responsible publisher, legal form, business name, address including country, absence of a current UID/CHE identifier, and general contact above are confirmed. The marker is retained as a technical blocker for the separate commercial pilot or any private intake. The minimal public activation form above may be enabled because it is voluntary, public by design, warns against sensitive content, and creates only a candidate. Before the commercial pilot form or any separate private/commercial intake is enabled, the responsible owner must replace the marker with concrete, reviewed information covering at least:

- purposes and scope of the commercial or private intake;
- GitHub/public visibility and any separate systems used;
- retention and deletion rules plus a request channel; and
- the reviewed privacy notice and approvals applicable to that operator;
- any other register, tax, or public-identification details an authorized reviewer determines should be added.

This file describes technical behavior only. Its presence is not a legal or privacy approval, and the publication preflight intentionally fails while the marker remains.
