# Candidate review and release gates

Current implementation version: **0.1.0-rc.1**. There is no approved immutable public release, certified public installation or production website deployment. Development checks and a local marketplace test do not establish public availability. No Anthropic directory submission or endorsement is claimed.

The candidate includes companion controls, optional scoped Vitest evidence, the explicit helper, synthetic examples, original MIT source and Wavect artwork under its separate display/redistribution terms. [ASSET_LICENSE.md](../ASSET_LICENSE.md) retains Wavect artwork and trademark rights; MIT does not apply to the mascot. Future colony, business acceptance, delivery-receipt and multi-runner features are absent.

## Reviewable evidence

The tested environment is terminal Claude Code 2.1.296 on macOS 26.5.1 arm64, with Node.js 24.3.0 and project-local Vitest 4.1.11. See [compatibility](compatibility.md) for the distinction between command syntax floors and product testing.

Candidate checks passed: 23 official host tests, 16 Node tests (including four real Vitest integrations and two package tests), strict plugin validation and npm audit with zero vulnerabilities. Independent local marketplace checks exercised combined and fallback installation in user and project scopes, an isolated rc.2 version update and scoped uninstall/reinstall. The actual 25-second CLI demo has five reviewed stages, a poster, screenshots and four caption/transcript languages. Final source and archive reconciliation, remaining measured UI checks, independent signoff and owner approval still apply. CI configuration exists; local results do not prove a GitHub workflow has run or Linux mod behavior is supported.

## Reproduce checks

From the candidate checkout, with caches inside that checkout:

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

Every unchecked item remains a release requirement:

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

After publication, withdraw broken availability claims, restore a reviewed known-good source/version through a normal commit and independently verify reinstall and live website rollback. No previous approved public release currently exists, so no public downgrade is claimed tested. Plugin removal, preference cleanup and optional project evidence cleanup remain separate user choices; never delete arbitrary project directories.
