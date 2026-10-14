# Release verification and recovery

Implementation candidate: **0.3.0, unreleased**. Published stable: **0.1.0**. The [versioned release record](https://github.com/wavect/ernesto/releases) is authoritative for publication status, approved source, checksums and post-publication verification. Development and source-main installation checks do not independently establish an approved tagged release or production website deployment. No Anthropic directory submission or endorsement is claimed.

The published 0.1.0 release includes companion controls, optional scoped Vitest evidence, the explicit helper, synthetic examples, original MIT source and Wavect artwork under its separate display/redistribution terms. [ASSET_LICENSE.md](../ASSET_LICENSE.md) retains Wavect artwork and trademark rights; MIT does not apply to the mascot. Future colony, business acceptance, delivery-receipt and multi-runner features are absent.

## 0.3.0 candidate scope

The companion works immediately after installation and restart. Project
configuration is optional. Check project and `/ernesto check` explicitly run
an existing package script through the official host process API, with no
shell interpolation, dependency installation or startup process. Command
completion and input freshness do not claim structured test passes or counts.
Output is bounded, session-only and disclosed through Details. Late results
are discarded after off/hide/workspace changes; the host API has no cancellation
handle for an already launched command. Existing strict Vitest evidence and
config stay compatible, with automatic initialization on the explicit action
for detected Vitest-only projects. This replaces 0.2.0's manual-helper onboarding.

Candidate validation: 39 official host tests and 36 Node tests passed,
including real Vitest negative paths and deterministic package checks. Strict
SDK validation confirms the only new privileged operation is process.run on
the explicit action. Format and diff checks passed; npm audit found zero
vulnerabilities. Real macOS CLI checks exercised a config-free npm command,
button execution, Details output, actual exits zero/one and stale inputs.
A separate Vitest-only project initialized defaults via the button and showed
one verified pass, a stale edit and one verified failure. No model prompts or
model messages were used. These checks do not qualify other operating systems,
Desktop UI or real pnpm/yarn/bun execution. Public-source update and tagged
release validation are not run because this candidate is not published.

The refreshed 46-second actual terminal demo records the config-free npm flow,
including Details, stale input, failure, quiet and chocolate. Eleven unique
exported frames were visually reviewed. All 552 H.264 frames decode; media and
runtime hashes, seven stage boundaries and all four caption/transcript languages
are reconciled in `media/recording.json`. Historical checks below retain their
original scope. No new tag, release or website availability is established by
this branch. The earlier 0.2.0 source update had no tagged release.

## Reviewable evidence

The tested environment is terminal Claude Code 2.1.296 on macOS 26.5.1 arm64, with Node.js 24.3.0 and project-local Vitest 4.1.11. See [compatibility](compatibility.md) for the distinction between command syntax floors and product testing.

Historical rc.1 checks passed: 23 official host tests, 16 Node tests (including four real Vitest integrations and two package tests), strict plugin validation and npm audit with zero vulnerabilities. Independent local marketplace checks exercised combined and fallback installation in user and project scopes, an isolated rc.2 version update and scoped uninstall/reinstall. The historical 25-second CLI demo had five reviewed stages, a poster, screenshots and four caption/transcript languages. Independent privacy/package and terminal review passed; [short local performance measurements](performance.md) include a 0.441-second stale-update observation and their limits. Both exact-head GitHub workflows passed for the merged implementation. Those Linux harness results do not establish real Linux terminal UI support. Every release still requires final source/archive reconciliation and owner approval.

The stable version changes the displayed version and release documentation, and adds bounded CI failure receipts. Runtime behavior, helper behavior, artwork rights and compatibility limits remain as documented. Exact stable checks, source and archive results belong to its versioned release record. The immutable rc.1 release remains available.

## Historical rc.1 public-source validation snapshot

On 13 October 2026, independent anonymous checks installed merged main commit
`2a0b79d29874fb135be4daad5db171a4b7a8020d` at version 0.1.0-rc.1. Shell combined
and two-step fallback installation, user/project scope, disable/re-enable,
uninstall, marketplace removal and reinstall passed. Public update returned
`up_to_date` at rc.1; this is not a public later-version upgrade or downgrade.
All 72 tracked installed files matched that reviewed source. The cached copy
passed 23 official host tests and strict validation; its explicit helper ran
one real passing synthetic test. In-session combined installation requested
source confirmation and scope selection. A fresh actual session loaded the
project-scoped companion and `/ernesto status`, with QA off and no model calls.
In-session two-step fallback user installation and fresh-session status loading
also passed. Scoped cleanup preserved unrelated profile and project sentinels.
These results apply to that source snapshot, not an unverified future tag or
changed source. Versioned release notes must reconcile the published artifact
and record any repeated installation checks.

## Reproduce checks

From the reviewed checkout, with caches inside that checkout:

```sh
env npm_config_cache="$PWD/.agent-cache/npm" npm ci --ignore-scripts --legacy-peer-deps
env npm_config_cache="$PWD/.agent-cache/npm" npm --prefix examples/vitest-demo ci --ignore-scripts --legacy-peer-deps
npm test
npm run test:host
npm run validate
npm audit --audit-level=moderate
npm run package
git diff --check
```

The example tests deliberately change and restore only the synthetic project. Give its real-run suite exclusive access while reproducing or recording the demo. The package builder writes `.agent-cache/package/ernesto-source.tar.gz`, `CONTENTS.sha256.json` and `SHA256SUMS`; it excludes local reports, caches, installed dependencies and private planning. Verify the archive itself, including image metadata, source hashes, licenses and the installed helper layout. Rebuild after documentation or asset changes and compare repeated archive checksums.

## Mandatory approval checklist

Use this checklist for each release and record its outcomes in the versioned release notes. This reusable template does not report current publication status:

- [ ] Identify the reviewed source commit, candidate version and final archive checksum; inspect complete branch history and files for private material.
- [ ] Pass pure, official host, real Vitest and package-content tests on that exact source; record skipped checks and limitations. Confirm a deliberate failure cannot create a green verification.
- [ ] Complete real terminal keyboard, narrow/normal/wide layout, themes, reduced-motion, lifecycle and coexistence checks. Record measured idle/active/QA overhead and small-fixture stale-update timing; do not claim zero overhead or accessibility certification.
- [ ] Complete clean-profile local install, loaded command/UI, installed helper, version-bump update, disable/re-enable, matching-scope uninstall/reinstall and optional marketplace removal. Keep `ernesto@ernesto` consistent.
- [ ] Independently review privacy, bounded storage/cleanup, observed I/O, dependency/Action pins, source and artwork rights, metadata and vulnerability reporting.
- [ ] Export a real sanitized demo, poster, screenshots, captions and transcript matching the candidate. Review every frame; a synthetic browser preview is labeled as a simulation.
- [ ] Reconcile README, manifests, licenses, compatibility, commands, demo and website facts. Website languages do not imply localized mod UI.
- [ ] Obtain explicit owner approval of the concrete source/version/archive and publication sequence. Review-branch push or PR creation does not authorize tagging, release publication or production deployment.

## Approved publication sequence

After the owner approves the concrete candidate:

1. Publish only the approved immutable version tag and release artifact, checksums, changelog and tested limitations. Keep the self-hosted marketplace at repository root, with marketplace and plugin both named `ernesto`, source `./`.
2. Redownload the release anonymously, inspect it and compare checksums. In a clean profile, test the public shell combined command, interactive in-session route and two-step fallback from `wavect/ernesto`. Start a fresh session and verify loaded hooks, UI and explicit QA/helper behavior. A listed marketplace alone is insufficient.
3. Verify public update/removal and rollback/pinning procedures for the actual versions. Third-party marketplace auto-update is off by default.
4. Set website facts to available only after those checks succeed. Obtain the separate website deployment approval, publish through its ordinary release workflow and verify all four live routes, locale metadata, links, media and consent behavior.
5. Use separately authorized indexing or announcements only if requested. Optional Anthropic directory submission needs its own owner decision and current portal review; it does not block the self-hosted marketplace.

Public install syntax is documented in [install.md](install.md) as release-gated. Do not enable an install CTA, available software schema, live listing badge or released version field based on a local test or an assumed future tag.

## Recovery

If an install or compatibility check fails, retain candidate/unavailable facts and show the limitation. Never loosen parser, crawler, privacy or release gates to turn a failure green. Fix and rerun the affected checks, then rebuild the exact package.

After publication, withdraw broken availability claims, restore a reviewed known-good source/version through a normal commit and independently verify reinstall and live website rollback. Candidate validation did not exercise a public version downgrade, so none is claimed tested. Plugin removal, preference cleanup and optional project evidence cleanup remain separate user choices; never delete arbitrary project directories.
