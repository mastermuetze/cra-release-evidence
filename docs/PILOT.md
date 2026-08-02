# Pilot validation rules

The free action is the validation product. No paid platform is considered until the two quantitative minimums are reached simultaneously:

1. at least **100 verified activations** in unique external repositories; and
2. at least **10 qualified willingness-to-pay commitments** from ten different companies that used the action.

Meeting both minimums is necessary, never sufficient. A person must audit the supporting records, deduplication, evidence quality, budget authority, and recency before documenting a business decision.

## What counts as an activation

One repository counts once when all of the following are true:

- it is not controlled by the project team and is not a commissioned demo repository;
- the action ran for an actual product release, not only a test tag or copied workflow;
- both `EVIDENCE.md` and parseable `evidence.json` were generated;
- a `gaps-found` status may count when the package was produced before an intentional `fail-on-gaps` failure;
- repeated runs, forks, renamed repositories, and later action upgrades are deduplicated;
- verification records presence and release context, never the contents of private evidence.

Stars, Marketplace views, landing-page clicks, forks, workflow-file copies, and statements of intended future use do not count.

For public repositories, verification may use a public workflow run, release asset, or committed package with a release reference. For private repositories, verification requires a voluntary, separately agreed private confirmation by an authorized user. Store only a pseudonymous repository key, organization key, date, segment, action version, package-generated flag, verification method, reviewer, and counting status. Generate private pseudonyms as random identifiers or HMACs with a separately stored secret; never use a plain hash of a guessable repository or company name.

Quality guardrails are tracked separately from the core gate: target at least 30 distinct organizations and at least 60 activations in installable commercial software, commercial developer tools, or device firmware. Pure SaaS and demos may inform research but do not satisfy the target-segment guardrail.

## What counts as willingness to pay

A team counts only when:

- it belongs to the prioritized target market and has a verified activation;
- a budget or procurement owner participated;
- it saw a concrete, versioned offer and visible price hypothesis;
- the commitment concerns clearly described future paid functionality, not the free collector;
- a dated written commitment such as a design-partner letter of intent or fully refundable reservation exists;
- intended start is within 90 days after availability;
- the commitment was recorded after activation verification, is no more than 180 days old, has an explicit expiry date, and is not withdrawn or expired at the decision date;
- only one team per legal company is counted.

A waitlist entry, survey response, free pilot, or “probably would pay” statement is not enough. Pricing and commitment data must never be requested in a public pilot issue. Keep it in a controlled private register.

## Status models

Activation:

```text
candidate -> verified -> counted
          -> rejected
          -> duplicate
```

Commercial commitment:

```text
candidate -> qualified -> counted
                     -> withdrawn
                     -> expired
                     -> rejected
```

## Privacy boundary

Never retain or request raw SBOMs, vulnerability findings, source code, internal filenames, credentials, or copies of confidential evidence for measurement. The optional `activation-report.yml` issue form is deliberately narrow and only creates a public candidate record; it does not count automatically. It necessarily exposes the submitter's public GitHub account, profile, and issue metadata, warns against sensitive content, and requests only the minimum release-verification fields. Private repository use counts only after explicit consent to a minimal verification arranged outside the public issue.

The separate commercial pilot form remains disabled as `pilot-registration.yml.template` until the operator documents the additional purpose, retention, deletion, commercial workflow, and applicable reviewed privacy information. No willingness-to-pay or private evidence is requested through the public activation form.
