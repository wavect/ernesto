# Ernesto for Claude Code

Claude says it's done. Ernesto would like to see the tests.

Ernesto is Wavect's small turquoise-shell companion, with two eyes, a taste for
chocolate, and **one-action project checks**. He appears as soon as you restart Claude
Code after installation. No project configuration is required. Mood and
chocolate never determine test status.

**Development version 0.3.0; published stable 0.1.0.** Check the
[versioned release record](https://github.com/wavect/ernesto/releases) for
publication status, approved checksums and tested limitations. A source branch
or successful source installation alone does not establish an approved release.
GitHub marketplace distribution needs no Anthropic directory listing; no
directory submission has been made.

## Get started

**Development candidate 0.3.0, not published yet.** To review it, launch
`claude --plugin-dir /path/to/reviewed/ernesto` from your project. The regular
marketplace update does not contain this candidate until it is merged.

1. Install Ernesto and restart Claude Code:

   ```sh
   claude plugin install ernesto --marketplace wavect/ernesto
   ```

2. Ernesto appears immediately. Open `/ernesto evidence`, then choose
   **Check project**. Or type `/ernesto check` directly.

Ernesto detects an existing `test`, `check`, `verify` or `lint` package script
and shows the selected command. It uses your project's package manager and
installed tools. No copying helper commands, hunting cache paths or writing
JSON. Nothing runs until you request a check; no dependencies are installed.
Package scripts execute project code, including package-manager lifecycle
scripts, with your environment. Use this action in projects you trust.

A completed command shows its actual exit code. **Test counts and coverage
remain unverified** unless the separate structured Vitest integration validates
a report. Choose **Details** to see bounded command output. Source changes
make the previous command's input comparison stale. **Compare** rereads
inputs without running a check.

Without a supported command, the companion still works immediately. Detection
currently covers npm, pnpm, yarn and bun package scripts; it does not invent a
check for other project types. `/ernesto doctor` explains what was detected.
The tested host is Claude Code **2.1.296** on macOS. The optional detailed
integration needs Node **24** and local **Vitest 4.1.11**; ordinary project
scripts use their own installed toolchain. See [the walkthrough](docs/getting-started.md)
and [installation](docs/install.md).

## Everyday controls

```text
/ernesto                 help and current status
/ernesto check           run the detected project check explicitly
/ernesto setup           show readiness and the detected command
/ernesto doctor          requirements and configuration checks
/ernesto evidence        result, scope and snapshot details
/ernesto refresh         re-read local evidence, without running tests
/ernesto qa on           observe configured QA, remembered per workspace
/ernesto qa off          companion only, remembered per workspace
/ernesto hide            hide Ernesto and pause comparisons
/ernesto show            show Ernesto and resume enabled comparisons
/ernesto quiet on        suppress jokes, keep evidence text
/ernesto quiet off
/ernesto motion reduced
/ernesto motion normal
/ernesto chocolate
/ernesto forget          explain preference cleanup
/ernesto forget confirm
```

`qa setup` and `qa enable` remain aliases for existing users. Reduced motion
stays the default. The companion uses a turquoise pixel portrait when space allows,
with a compact portrait and text fallback in smaller terminals. Routine input
comparisons keep his expression steady while freshness remains explicitly labeled.
In an interactive session, `/ernesto evidence` opens the pane without dumping
the record into your conversation. Non-interactive sessions retain the full text
response. The pane leads with the result, completion, counts and next action;
**Details (d)** expands the full input list and record identifiers.
Use **Check project** to run, **Compare (r)** to compare inputs, **Close (q)** or Escape to close.
If the prompt keeps keyboard focus, press Ctrl+X then Tab; Page Down scrolls
long evidence, and Ctrl+X then Up gives an inline pane more room. Ernesto's bundled banter includes playful jabs such as "keyboard goblin" and
"sentient TODO." Lines rotate on activity, not on redraws or snapshot polls.
They are scripted personality, not an assessment of you or your code.
`/ernesto quiet on` silences the banter, including chocolate replies, while
keeping evidence and controls. Chocolate changes only the companion mood. Forget clears workspace
preferences and pauses QA for the current session; defaults apply next session.
It never removes project files.

## Defaults and honest results

No `.ernesto/config.json` is required for project commands. Ernesto selects a
bounded conventional input scope in memory and compares snapshots before,
after and following your explicit command. Missing scope, read errors, known
intermediate edits or observation gaps yield **inputs unknown**. A snapshot
match describes those inputs at comparison time, not the whole project or
business correctness. Command exit and input freshness remain separate.

For projects using the detailed Vitest integration, existing configuration and
strict evidence v1 remain supported. A local Vitest 4.1.11 project without a
package check script can use **Check project** to create conventional defaults
and run the shipped helper internally. Existing config is never overwritten. A valid configured Vitest check takes
priority over package scripts, preserving custom roots and filters.
Custom inputs and filters belong in that optional advanced configuration.
See [the evidence guide](docs/evidence.md).

QA observation defaults on. `/ernesto qa off` remembers your workspace choice
and stops discovery/comparisons. Hide pauses observation too. A command you
already explicitly started may continue until it finishes or its two-minute
host timeout; turning observation off discards its later result. Ernesto adds
no model calls, telemetry or network requests. User project commands can
access networks and write files. Read [privacy boundaries](docs/privacy.md).

## Recorded CLI demo

[![Recorded CLI evidence pane and companion](docs/media/ernesto-cli-poster.png)](docs/media/ernesto-cli-candidate.mp4)

The **unreleased 0.3.0 candidate** [46-second recording](docs/media/ernesto-cli-candidate.mp4)
uses actual Claude Code terminal cells from one synthetic arithmetic test. It
shows immediate readiness without project config, the native Check project
button executing `npm run test`, actual command output in Details, a stale
source edit, a real failure, quiet mode and sarcastic chocolate.

The native pane and band are cropped into a labeled presentation; headings
and bottom captions are editorial overlays. Typing and between-stage waits
are omitted. The command runs directly through the explicit native action,
not a copied helper. No model prompt or model call was used. Command success
is shown separately from verified test counts and coverage. An
[English transcript](docs/media/ernesto-cli-en.md), plus German, Spanish and
Chinese transcripts and captions, accompany it. The plugin UI remains English.
Historical tagged media stays unchanged; this demo does not establish release.

## Development and checks

```sh
env npm_config_cache="$PWD/.agent-cache/npm" npm ci --ignore-scripts --legacy-peer-deps
env npm_config_cache="$PWD/.agent-cache/npm" npm --prefix examples/vitest-demo ci --ignore-scripts --legacy-peer-deps
npm run format:check
npm test
npm run test:host
npm run validate
npm run package
```

Measured CPU and memory overhead, scope size and stale-update latency are
recorded in [candidate performance observations](docs/performance.md). These
short measurements describe one tested machine.

The lockfile pins development tools. `--legacy-peer-deps` omits optional
browser/UI peer tooling we do not use and avoids an npm 11.4.2 peer resolver
failure; scripts are ignored. The pinned Claude wrapper runs its already
installed native optional package for tests, without sign-in or model calls.
Runtime hooks have no npm imports or dependency installers.

See [compatibility](docs/compatibility.md), [release gates](docs/release.md),
[contribution](CONTRIBUTING.md), and [security reporting](SECURITY.md).

Original code is MIT; mascot artwork has separate Wavect terms in
[ASSET_LICENSE.md](ASSET_LICENSE.md). Wavect charges no fee for this code.
Claude access and user test infrastructure can have their own requirements
and costs. Ernesto is not an Anthropic product or endorsement.
