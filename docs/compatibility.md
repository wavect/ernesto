# Compatibility of the review candidate

Ernesto **0.1.0-rc.1** is a prerelease candidate. The [versioned release record](https://github.com/wavect/ernesto/releases) identifies its publication status and approved artifact. The tested mod baseline is **Claude Code 2.1.296**. Future host versions still require validation; a version comparison alone is not proof that every surface works.

| Environment | Candidate evidence | Support claim |
| --- | --- | --- |
| Terminal CLI, macOS 26.5.1, arm64, Claude Code 2.1.296 | Installed declarations inspected; strict plugin/marketplace validation; official host harness; real public-source installation, fresh-session loading and installed helper checked | Tested terminal combination; released artifact must match the versioned release record |
| Node.js 24.3.0, project-local Vitest 4.1.11 | Real synthetic pass/fail, scope comparisons, omissions, interruptions, concurrent runs and malformed-artifact regressions | Verified explicit helper combination |
| Desktop Code / window surface | Not tested | No advertised support |
| Linux, Windows, WSL, remote/cloud sessions | Not tested | No advertised support |
| IDE chat, claude.ai Chat, Cowork, headless drawing | No product lifecycle verification | No advertised mod UI or QA support |

The official host harness validates hook behavior and drawing trees; it is not a substitute for real terminal screenshots, an installed-copy lifecycle or a Desktop test. Final release review must retain those separate results. The current UI uses native Raster artwork on sufficiently tall terminals and a compact text/pixel fallback at smaller sizes. Commands provide essential text. The evidence pane is opened intentionally, and reduced motion is the default.

## Command syntax versus mod requirements

| Command capability | Platform syntax floor | Ernesto tested baseline |
| --- | --- | --- |
| Shell `claude plugin install ernesto --marketplace …` | 2.1.292 | 2.1.296 |
| In-session `/plugin install ernesto --marketplace …` | 2.1.275 | 2.1.296 |
| Companion, local artifact reads and QA drawing | Syntax availability does not establish these capabilities | 2.1.296 on the tested terminal environment |

These syntax floors are documented platform facts, not Ernesto support results for those older versions. The in-session route requests confirmation for a new source and then scope selection. Source-main installation was checked independently on 13 October 2026; an approved release additionally requires anonymous artifact reconciliation and exact released-source loading. See [installation](install.md) and [release gates](release.md).

## Optional helper boundary

Companion mode needs no Node runtime, test runner or QA configuration. The separately invoked helper ships inside the plugin with its pure core modules. It requires **Node major 24** and the project's already installed **Vitest 4.1.11**, refuses other combinations, and never downloads a runner. The tested Node patch version is 24.3.0; other Node 24 patch versions have not been separately qualified.

The host reads the reviewed runtime descriptor and installed Vitest version. It cannot independently establish the runtime of a future test process, environment secrets, native state or external services. Snapshots describe only captured inputs, with explicit exclusions and observation limits. Read [the evidence method](evidence.md) before enabling QA.

If an optional host facility is missing, use the text commands to inspect the limitation. Older/unsupported hosts refuse QA before project scans; no unavailable capability is converted into passing evidence. Disable/hide stops scheduled evidence work. No fallback launches a subprocess or makes a model/network call.

## Adding a support row

Before advertising another platform or version, repeat strict validation, official host tests, the real helper flow, copied-plugin loading, clean install/update/disable/remove/reinstall, keyboard/resize/theme/reduced-motion checks, and privacy review. Record exact OS, architecture, host and helper versions, tested scope and observed failures. Documentation availability and a directory listing are not compatibility evidence.
