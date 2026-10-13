# Ernesto for Claude Code

Claude says it's done. Ernesto would like to see the tests.

Ernesto is Wavect's small turquoise-shell companion, with two eyes, a taste for
chocolate, and optional **scoped Vitest evidence**. Companion mode needs no QA
configuration. Mood and chocolate never determine test status.

**Version 0.1.0-rc.1 is a prerelease candidate.** Check the
[versioned release record](https://github.com/wavect/ernesto/releases) for
publication status, approved checksums and tested limitations. A source branch
or successful source installation alone does not establish an approved release.
GitHub marketplace distribution needs no Anthropic directory listing; no
directory submission has been made.

## Review the candidate

Use Claude Code **2.1.296 or later**. The verified development environment is
macOS, Claude Code 2.1.296, Node.js 24.3.0 and Vitest 4.1.11. Inspect the source
and [privacy boundaries](docs/privacy.md) before loading a privileged mod:

```sh
claude --plugin-dir .
```

For a local marketplace lifecycle check from a reviewed candidate checkout:

```sh
claude plugin install ernesto --marketplace .
```

This registers the local marketplace `ernesto` and installs `ernesto@ernesto`
in user scope. Restart Claude Code to load the installed version. Local
candidate installation is different from anonymous public-release availability.

The public shell command, **for an approved and verified release**, is:

```sh
claude plugin install ernesto --marketplace wavect/ernesto
```

The distinct interactive in-session route is:

```text
/plugin install ernesto --marketplace wavect/ernesto
```

For a new source, the session asks for confirmation and opens the scope picker.
Two-step public fallback, also release-gated:

```sh
claude plugin marketplace add wavect/ernesto
claude plugin install ernesto@ernesto
```

Shell combined syntax requires 2.1.292+; session combined syntax requires
2.1.275+. Ernesto's stricter tested host baseline is **2.1.296**. See
[installation, updates and removal](docs/install.md).

## Use Ernesto

Type `/ernesto` for help and status. All essential actions work from the
keyboard and return text on non-drawing surfaces:

```text
/ernesto evidence
/ernesto chocolate
/ernesto hide
/ernesto show
/ernesto quiet on
/ernesto quiet off
/ernesto motion reduced
/ernesto motion normal
/ernesto qa setup
/ernesto qa enable
/ernesto qa off
/ernesto refresh
/ernesto forget
/ernesto forget confirm
```

Reduced motion is the default. Quiet suppresses jokes while keeping evidence
text. Hide stops animation and evidence comparisons. The evidence pane opens
only on request; use its Refresh and Close controls, or Escape. Chocolate
changes companion presentation only. No sound, streaks or production-readiness
scores are included.

## Optional QA

Review your project inputs, create `.ernesto/config.json` using
[the evidence guide](docs/evidence.md), preview with `/ernesto qa setup`, then
explicitly opt in with `/ernesto qa enable`. Opt-in is per session/workspace,
and a new session starts with QA off. Preferences survive through namespaced
host storage; raw reports and session text do not go there.

The separate, inspectable helper runs **only when you invoke it**. The plugin
ships that helper self-contained, but its Node.js 24 and project-local Vitest
4.1.11 requirements must already be satisfied:

```sh
node integrations/vitest/run.mjs /path/to/reviewed/project
```

Setup prints the exact installed helper path. The helper records actual
structured results and real process completion, hashes the reviewed working
tree at start/end, and preserves failed process exits. The mod never launches
it. User-run tests can use their own network and environment.

Status keeps outcome, freshness, completeness and integrity separate:
**not run, running, failed, passed for recorded scope, stale, and unknown**.
A source edit invalidates the prior comparison. Skipped/todo tests remain
visible. A matched snapshot means captured inputs matched at the displayed
time, with the displayed exclusions. It cannot establish business correctness,
immutable execution, or security against same-user tampering.

## Recorded candidate demo

[![Recorded CLI evidence pane and companion](docs/media/ernesto-cli-poster.png)](docs/media/ernesto-cli-candidate.mp4)

The [25-second recording](docs/media/ernesto-cli-candidate.mp4) uses actual
CLI terminal cells from a synthetic local test project. The pane and band
are cropped and pauses shortened. It shows QA off, a real pass, a source edit
making it stale, a real failing run, and chocolate leaving evidence unchanged.
[English transcript](docs/media/ernesto-cli-en.md), plus German, Spanish and
Chinese transcripts and captions, accompany the recording. This is a tested
candidate demonstration. Publication status belongs to the versioned release record.

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
