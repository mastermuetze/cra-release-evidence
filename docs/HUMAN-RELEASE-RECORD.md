# Human release decision record

Use this template to document decisions that **CRA Release Evidence does not and cannot automate**. It is not legal advice, a conformity assessment, or an EU declaration of conformity, and a `complete` evidence package never replaces accountable human approval.

## Release identity

- Product and variant:
- Release tag:
- Full release commit:
- Evidence package/path:
- SHA-256 of `evidence.json`:
- SHA-256 of `MANIFEST.sha256`:
- Reviewed workflow run:
- Decision date:

## 1. Legal determinations — authorized people only

Record `not evaluated`, `approved`, `not approved`, or `not applicable`, plus the reasoning and accountable person.

| Decision | Status | Reasoning/reference | Accountable person |
|---|---|---|---|
| Product and exact version are within the determined CRA/placing-on-the-market scope |  |  |  |
| Product category, any applicable class, and conformity-assessment route were determined |  |  |  |
| Support period and vulnerability-handling obligations were determined |  |  |  |
| Technical documentation and cybersecurity risk assessment were reviewed for this version |  |  |  |
| Residual risks were accepted by an accountable person |  |  |  |
| EU declaration of conformity and CE marking were separately approved where applicable |  |  |  |
| Event-driven notifications to authorities, ENISA/CSIRTs, and users were evaluated for this release or incident context |  |  |  |

Check legal requirements only against current official primary sources, including the [official CRA text on EUR-Lex](https://eur-lex.europa.eu/eli/reg/2024/2847/oj). This template does not interpret those sources.

## 2. Good practice — not represented as a statutory duty

- [ ] Every evidence gap and unrecognized report was read and assigned.
- [ ] Findings were triaged; accepted risks have an owner, rationale, and review date.
- [ ] A person confirmed that imported SBOMs and reports belong to the shipped version.
- [ ] Public assets contain no confidential SBOM, SARIF, scanner, customer, or credential data.
- [ ] Release tag, commit, workflow, and package digests are mutually consistent.
- [ ] Deviations from the normal release process are documented.

## 3. Product output — observed technical facts

- Package status (`complete`/`gaps-found`):
- Evidence gap count:
- SBOM mode and source-commit relation:
- Report producer-commit relation:
- Previous tag and diff range:
- Manifest verification passed: yes/no

`complete` means only that the configured evidence list was found and technically accepted. It is not CRA compliance, a security approval, or release authorization.

## Release decision

- [ ] **approved**
- [ ] **not approved**
- [ ] **deferred**

Reasoning and conditions:

- Release owner / date:
- Security or risk approval / date:
- Legal or conformity review / date:
- Reference to separately approved declaration, CE material, or notifications where applicable:

Do not put confidential findings or unnecessary personal data in a public copy of this record.
