# Start using Ernesto

This describes **0.3.0, an unreleased development candidate**. Published stable
remains 0.1.0. The earlier 0.2.0 source update had no tagged release. Check the
[release record](https://github.com/wavect/ernesto/releases) before upgrading.
For candidate review, launch `claude --plugin-dir /path/to/reviewed/ernesto`
from your project. Replace that review-only path with the reviewed checkout.

## Install, restart, ready

```sh
claude plugin install ernesto --marketplace wavect/ernesto
```

Restart Claude Code in your project. Ernesto appears immediately. You do not
need project JSON, a helper command, or an enable command.

## Check your project

Open `/ernesto evidence` and choose **Check project**, or type:

```text
/ernesto check
```

Ernesto shows the detected package command, such as `npm run test`. Detection
prefers `test:ci`, `test`, `check:all`, `verify:all`, `check`, `verify`, then
`lint`, followed by other conventional test/check script names. Recognized
watch/dev/fix script names and common placeholder tests are excluded. The
`packageManager` field or lockfile selects npm, pnpm, yarn or bun. If that tool
is unavailable, the result stays unknown; Ernesto does not download it.

Only your explicit check action starts a process. This runs the existing
project script with `CI=1` and a two-minute timeout, including the package
manager's normal pre/post scripts. Review untrusted project scripts before
running them. Startup, setup, doctor, refresh and comparisons never run tests.

- **Completed (exit 0):** the command exited successfully. Test counts and
  coverage remain unverified; this alone is not a verified test pass.
- **Failed (exit N):** the command really failed. Open **Details** for the
  last 4,000 characters of sanitized command output.
- **Inputs matched / stale / unknown:** a separate comparison of bounded
  source/test/config/lock inputs. Unknown never means passing.

**Check project** runs again. **Compare (r)** rereads inputs without running
anything. **Details (d)** expands scope and local command output. **Close (q)**
or Escape returns to your prompt. Page Down scrolls; Ctrl+X then Up expands an
inline pane. If your prompt retains keyboard focus, Ctrl+X then Tab selects
the pane. Small terminals use a compact layout.

Command output is kept only in Ernesto's session memory and appears only when
you expand Details. Status and slash-command responses do not echo it. The
Claude host has its own logging behavior. See [privacy](privacy.md).

## Optional detailed Vitest evidence

Existing `.ernesto/config.json` and evidence v1 remain compatible. Their
structured results separate outcome, freshness, completeness and integrity.
The detailed helper needs Node 24 and already installed local Vitest 4.1.11.
If no package check script exists but that Vitest version is installed,
**Check project** initializes missing conventional defaults and runs it
internally. No command copying is needed. Existing config is preserved. A valid configured Vitest check takes priority
over package scripts, preserving custom roots and filters.

Normal project commands need no Ernesto config and do not require that Vitest
version. Do not change project dependencies just to obtain a green badge.
Input discovery cannot infer custom directories, external services, secrets
or acceptance criteria. Inspect Details and [the evidence method](evidence.md)
for scope limits. No detected command? The companion still works immediately.
Other ecosystems need a separate supported integration or a package script.

## Make him behave

```text
/ernesto quiet on
/ernesto motion reduced
/ernesto qa off
/ernesto qa on
/ernesto hide
/ernesto show
```

Quiet suppresses the sarcasm while keeping checks and evidence. Reduced motion
is the default. QA on/off is remembered per workspace. Off and hide stop
observation. A process already explicitly started may continue until completion
or the host's timeout; its result is discarded after observation changes.
Forget clears workspace preferences, not project files.

## Update an existing installation

After this candidate is merged into the marketplace source:

```sh
claude plugin marketplace update ernesto
claude plugin update ernesto@ernesto --scope user
```

Match your original installation scope, then restart Claude Code. Existing
config and preferences need no migration. Legacy setup aliases remain useful
as readiness checks, but no longer tell you to copy an installed helper path.
A marketplace source update and a tagged GitHub release are separate events.
