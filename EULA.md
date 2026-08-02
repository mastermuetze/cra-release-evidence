# End User License Agreement — CRA Release Evidence

**Version:** 0.1.0

**Effective date:** 2 August 2026

## 1. Publisher and contact

CRA Release Evidence is provided by Benjamin Warnow, sole proprietorship, business name Warnowdigitalsolutions, An der hohlen Gasse 19, 4058 Basel, Switzerland (the “Publisher”). General contact: [hallo@warnowdigitalsolutions.ch](mailto:hallo@warnowdigitalsolutions.ch).

## 2. Product

CRA Release Evidence is a GitHub Action that creates a version-specific evidence index from files and Git information already present in the user's GitHub Actions workspace. This EULA applies to version `0.1.0` of the Action distributed through GitHub Marketplace.

## 3. Software licence

The software source is licensed under the MIT License included in the repository as `LICENSE`. The rights to use, copy, modify, merge, publish, distribute, sublicense, or sell copies of the software are governed by that licence. Nothing in this EULA is intended to restrict permissions granted by the MIT License.

This EULA provides product-specific information about scope, user responsibilities, data handling, support, and Marketplace distribution.

## 4. Product boundary

The Action collects and indexes technical material. It is not a general CRA scanner, legal advice, certification, conformity assessment, or guarantee of compliance. A status such as `complete` means only that the evidence categories configured by the user were found and technically accepted by the Action. It is not a compliance or security verdict.

Product scope, cybersecurity risk assessment, residual-risk acceptance, the conformity-assessment route, declarations, marking, release authorization, and regulatory or user notifications remain human responsibilities.

## 5. User responsibilities

The user is responsible for:

- selecting the correct release revision and evidence sources;
- checking the completeness, accuracy, relevance, authenticity, and confidentiality of inputs and outputs;
- configuring repository, workflow, token, artifact, release, visibility, access, and retention controls;
- reviewing SBOMs and any opted-in raw reports before storing or publishing the package;
- retaining original evidence sources when the generated package contains only an index;
- obtaining all permissions required for files and data processed in the workflow; and
- performing all legal, security, risk, conformity, release, and notification decisions outside the Action.

The user must not provide credentials or confidential evidence to public support channels or to the general contact address.

## 6. Data handling

Version `0.1.0` processes files inside the GitHub Actions runner and writes output to the configured workspace directory. It has no Publisher-operated backend and does not send Action telemetry to the Publisher.

The Action does not itself upload the package. Storage or publication occurs only when the user's surrounding workflow performs an additional operation such as uploading a workflow artifact, attaching a release asset, or committing files. GitHub and any scanner actions used by the user process data under their own terms and privacy information.

The current technical data-handling description is published in `PRIVACY.md`.

## 7. GitHub and third-party services

Use of GitHub and GitHub Marketplace is subject to GitHub's terms. Scanner actions, repositories, workflow artifacts, release assets, runners, and other third-party services remain subject to the terms, availability, access controls, and retention settings of their respective providers.

## 8. Support, updates, and security reports

The prototype has no promised service level, uptime, general response time, maintenance period, or fixed remediation deadline. Current support boundaries are published in `SUPPORT.md`. Suspected vulnerabilities must be reported through the private route in `SECURITY.md`.

The Publisher may update or discontinue Marketplace distribution of the prototype. Rights already granted under the MIT License remain governed by that licence.

## 9. Warranty and liability

The software is provided under the warranty disclaimer and limitation of liability in the MIT License. No additional warranty or promise is made that the Action or its output is complete, error-free, suitable for a particular product, legally sufficient, or sufficient to demonstrate compliance.

Nothing in this EULA excludes or limits any right or liability that cannot lawfully be excluded or limited under applicable mandatory law.

## 10. EULA version and contact

This EULA applies to Action version `0.1.0`. A later Action release may include a revised EULA identified in that release. Questions about this EULA may be sent to [hallo@warnowdigitalsolutions.ch](mailto:hallo@warnowdigitalsolutions.ch).

Do not send source code, SBOMs, vulnerability findings, credentials, private repository details, customer data, or other confidential evidence to this address.
