# GitHub Marketplace submission — v0.1.0

**Prepared:** 2 August 2026
**Scope:** copy-ready technical handoff; not legal approval and not authorization to publish

## Verified live state

- Repository: `mastermuetze/cra-release-evidence` (public)
- Root metadata: exactly one `action.yml`
- GitHub displays the “You can publish this Action to the GitHub Marketplace” banner.
- The exact Marketplace search for `CRA Release Evidence` returned zero results when checked on 2 August 2026. Recheck uniqueness in the release dialog immediately before publication.
- The Marketplace release form is currently blocked because the repository owner has not accepted the GitHub Marketplace Developer Agreement.
- No `v0.1.0` tag or GitHub Release existed at the time of preparation.

## Copy-ready release fields

| Field | Value |
|---|---|
| Marketplace | Select **Publish this release to the GitHub Marketplace** |
| Action name | `CRA Release Evidence` (read from `action.yml`) |
| Tag | `v0.1.0` |
| Target | the final reviewed `main` commit after all Marketplace-preparation changes are merged and CI is green |
| Release title | `CRA Release Evidence v0.1.0 — free evidence collector prototype` |
| Release notes | copy the complete contents of `RELEASE_NOTES_v0.1.0.md` |
| Primary category | **Security** |
| Secondary category | **Reporting** |
| Pre-release | leave unchecked; major version zero and the release notes already describe the prototype status |
| Latest release | keep enabled |
| Binary assets | none required; the tagged source is the executable JavaScript action |

Do not target the currently documented demo commit merely because it has already been tested. The release tag must point to the final reviewed Marketplace release commit.

## Owner-controlled status and remaining blockers

1. **Completed:** the authorized Publisher approved `EULA.md` on 2 August 2026; `docs/EULA-APPROVAL.md` records the decision and exact file SHA-256.
2. **Open:** accept the GitHub Marketplace Developer Agreement from the Marketplace release form as the authorized repository owner.
3. **Open:** confirm that the publishing account has working two-factor authentication. GitHub requires 2FA to publish the release.
4. **Open:** confirm that the publisher information, support route, security route, and listing claims remain accurate at publication time. Scripts cannot provide legal, privacy, security, or business approval.

The disabled public pilot form and its separate privacy/intake review do not need to be activated for the free Action listing. They must remain disabled until the dedicated intake review is complete.

## Technical publication sequence

1. Export the reviewed Action-only repository and open a pull request against `mastermuetze/cra-release-evidence`.
2. Let the Ubuntu, Windows, and macOS checks pass; review the exact merged branch-head SHA.
3. Confirm that the live release dialog reports “Everything looks good!” for `action.yml` and that the action name remains unique.
4. Create the owner-controlled `v0.1.0` tag on that exact commit and push it.
5. Run `npm run preflight` from a clean standalone checkout of the Action repository. Technical blockers must be empty; manual confirmations remain separate.
6. Create the GitHub Release for the existing tag, apply the fields above, and save it as a draft for final review.
7. After explicit owner confirmation, publish the release. This is the step that publishes the Marketplace listing immediately.
8. Open the resulting Marketplace listing and verify its name, categories, README, Quick Start, licence, support, and security links.
9. Run a separate consumer-repository release smoke test pinned to the full `v0.1.0` commit SHA.
10. Only after those checks pass, switch the landing page to its Marketplace phase and use the verified listing URL.

## Do not combine these permissions

The collector job remains at:

```yaml
permissions:
  contents: read
```

Any workflow that creates a tag, release, or release asset needs a separate, explicitly reviewed `contents: write` job. Marketplace publication itself is an owner-controlled GitHub UI action and is not performed by the collector.

## Official GitHub sources

- [Publishing actions in GitHub Marketplace](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace)
- [GitHub Marketplace Developer Agreement](https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement)
- [Action metadata syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax)
- [Releasing and maintaining actions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/release-and-maintain-actions)
