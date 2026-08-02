# v0.1.0 repository and Marketplace launch

**Checklist date:** 2 August 2026

This file separates completed source preparation from owner-controlled or legal publication steps.

## Source and claims

- [x] Root `action.yml` has `name`, `description`, `runs`, inputs, outputs, and branding.
- [x] Pure JavaScript action uses Node 24 and has no runtime dependencies or downloads.
- [x] Collector requires only `contents: read`.
- [x] No vendor backend or action telemetry.
- [x] Raw reports remain opt-in.
- [x] CRA scanning, legal advice, conformity decisions, the EU declaration of conformity, CE marking, and regulatory reporting are explicitly out of scope.
- [x] Human legal, risk, conformity, notification, and release decisions have a separate non-automated record template in `docs/HUMAN-RELEASE-RECORD.md`.
- [x] SHA-256 is described as a consistency mechanism, not authenticity or signed provenance.
- [x] SBOM support is accurately limited to supported CycloneDX 1.2–1.7 JSON and SPDX 2.2–2.3 JSON structural recognition plus a manifest-only JSON fallback; full official-schema validation is not claimed.
- [x] Automatic predecessor selection is described as the nearest reachable ancestor tag, not guaranteed release chronology.

## Automated verification

- [x] Source syntax and unit/integration tests are included.
- [x] CI matrix covers `ubuntu-latest`, `windows-latest`, and `macos-latest` with Node 24.
- [x] CI includes a real `uses: ./` runtime smoke test.
- [x] Foreign CI actions are pinned to reviewed 40-character SHAs.
- [x] Repository tests check the action entrypoint, metadata, package version, schema, workflow pins, and forbidden site files.
- [x] The current public `main` CI matrix is green in the final public repository.
- [x] Public consumer-repository release smoke test is green against reviewed, merged source-only commit `625729f34a9ab8fcdecff1ab9ab2b8755b4ab00d`; the inspected package and checksum are attached to `mastermuetze/cra-release-evidence-demo@v0.1.2`, with matching SBOM, test, and security producer revisions.
- [x] GitHub displays the Marketplace publication banner for the public repository.
- [x] The exact Marketplace search for `CRA Release Evidence` returned zero results on 2 August 2026; uniqueness still needs rechecking in the final release dialog.
- [ ] Separate consumer-repository smoke test is green against the released full commit SHA.

## Owner and legal blockers

- [x] Choose the GitHub user and final repository name.
- [x] Final GitHub owner is `mastermuetze`; examples use `mastermuetze/cra-release-evidence`.
- [x] `.github/CODEOWNERS` assigns the initial prototype to `@mastermuetze`.
- [ ] Enable 2FA for the publishing account.
- [ ] Accept the GitHub Marketplace Developer Agreement as the authorized owner. The live release form currently disables Marketplace publication until this is done.
- [ ] Replace `EULA-DRAFT.md` with legally approved `EULA.md`; confirm suitability for Marketplace Agreement section 2.4.
- [x] Record the supplied responsible publisher `Benjamin Warnow`, legal form `sole proprietorship`, business name `Warnowdigitalsolutions`, address `An der hohlen Gasse 19, 4058 Basel, Switzerland`, and monitored general contact `hallo@warnowdigitalsolutions.ch`.
- [x] Record that no UID/CHE identifier is currently available.
- [ ] Confirm any other required public identifiers or notices with an authorized reviewer.
- [x] Enable Private Vulnerability Reporting and verify the repository-specific private reporting URL in `SECURITY.md`.
- [x] Confirm Benjamin Warnow as the initial security owner, with a 3-business-day acknowledgement target, updates every 7 calendar days for active reports, coordinated private disclosure, and no fixed remediation deadline.
- [ ] Before enabling GitHub Issues, pilot intake, or private/commercial intake, replace the publication-blocker marker in `PRIVACY.md` with reviewed operator identity, contact, purpose, visibility, retention, deletion, and applicable privacy information.

## Repository controls

- [x] Create the public Action-only repository `mastermuetze/cra-release-evidence`.
- [x] Set `main` as the default branch.
- [x] Configure active ruleset [`Protect main - solo prototype`](https://github.com/mastermuetze/cra-release-evidence/rules/20230746), requiring the three CI matrix checks and routing normal changes through pull requests.
- [x] Keep zero mandatory approvals during solo operation, with an explicit owner bypass for recovery. `CODEOWNERS` identifies sensitive files; require at least one independent Code Owner approval before a second maintainer or paid platform phase is introduced.
- [x] Enable secret scanning, push protection, Dependabot alerts, and Dependabot security updates.
- [x] Keep GitHub Issues disabled while operator/privacy and monitored support details remain unresolved.
- [ ] After privacy/operator approval, rename `pilot-registration.yml.template` to `pilot-registration.yml`; optionally create the `pilot` label.
- [ ] Enable Discussions only after a monitored support owner is assigned.

## Release v0.1.0

1. Complete every owner, legal, privacy, support, and security blocker above. Obtain explicit approval from the responsible owner; a script cannot provide it.
2. Merge the exact reviewed source with green CI on all three hosted runners and record the full branch-head SHA.
3. Create and push a signed or otherwise owner-controlled tag `v0.1.0` on that exact commit.
4. Run `npm run preflight` until its **technical Marketplace** blocker list is empty, then separately record all manual owner confirmations. Deferred pilot-intake blockers may remain only while the public pilot form remains disabled. A green preflight is not legal, privacy, security, or Marketplace approval.
5. Create a draft GitHub Release for the existing tag using `RELEASE_NOTES_v0.1.0.md`.
6. Attach any intended assets before publication. The action itself needs no bundle asset because the tagged source is executable.
7. In the release dialog, resolve Marketplace validation, choose the categories, and select publication to GitHub Marketplace.
8. Confirm the action name is unique immediately before publication.
9. Publish the release and enable immutable releases when compatible with the chosen tag strategy.
10. Run a consumer workflow pinned to the release commit SHA.
11. Verify that the repository, released commit/tag, README `#quick-start` anchor, pilot URL (if enabled), and Marketplace listing (once enabled) are publicly reachable and mutually consistent.
12. Only then update the separate product landing configuration with the verified repository slug, full action SHA, and live URLs.

Immutable releases and moving major tags require an explicit policy. For the prototype, prefer the fixed `v0.1.0` release and document the full SHA; do not create convenience tags until maintenance responsibilities are clear.

## Proposed Marketplace copy

**Name:** CRA Release Evidence

**Short description:** Build a version-specific evidence index from existing SBOM, test, security, and Git release data—without making compliance claims.

**Categories to confirm in the publishing dialog:** Security (primary) and Reporting (secondary).

**Boundary sentence:** This action is an evidence collector, not a CRA scanner, legal advice, conformity assessment, or guarantee of compliance.

The copy-ready field values and final sequence are recorded in [MARKETPLACE-SUBMISSION.md](MARKETPLACE-SUBMISSION.md).

## Official GitHub references

- [Publishing actions in GitHub Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace)
- [Metadata syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax)
- [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [Marketplace Developer Agreement](https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement)
- [Immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)
