# Privacy and trust boundaries

Ernesto adds no model calls, HTTP requests, telemetry, prompt changes or
permission decisions. Activity-driven personality retains only categories and
a bounded counter, not prompts, tool arguments, filenames or tool output.
Quiet suppresses bundled banter, including chocolate replies.

In 0.3.0, QA defaults on. Startup reads root metadata, package script definitions,
package-manager markers and optional local Vitest/config metadata to discover
checks. It never evaluates configuration or executes a process for discovery.
Existing structured evidence is validated from bounded local artifacts.
`/ernesto qa off` remembers the workspace choice and stops discovery and input
comparisons; hide pauses them too. Preferences are booleans under workspace
hashes. No saved green badge is trusted.

**Check project** and `/ernesto check` are explicit execution actions. They use
the official host process API with an argv array, workspace cwd, `CI=1` and a
two-minute timeout. Ernesto does not interpolate a shell command or install
dependencies. The selected npm/pnpm/yarn/bun script can itself execute arbitrary
project code and ordinary pre/post scripts, inherit your environment, access
networks and write files. A supported Vitest fallback can create conventional
Ernesto config and run the bundled helper on this same explicit action.

For ordinary project commands, Ernesto keeps exit status, bounded input
snapshots and a sanitized 4,000-character output tail in session memory only.
It displays that output only after you expand Details. It does not write output
to project files, its preference store, logs or slash-command responses. This
is not a promise about Claude's own logs or files created by your scripts.
Generic results do not establish test counts, coverage or structured test passes.

Turning observation off or hiding Ernesto discards results arriving later and
stops new comparisons. The host API provides no cancellation handle: a command
already explicitly launched can continue until completion or the two-minute
timeout. Ernesto will not restart it automatically. Command results are cleared
on a fresh session or workspace change. Structured Vitest summaries keep their
existing bounded retention, at most 20 completed records or seven days.

The explicit Node helper is a different execution boundary. `--setup` creates
`.ernesto/config.json` with conventional defaults and no test execution.
`--init` creates missing defaults and then runs the check. Existing config is
never replaced; malformed config, missing requirements and known symlinks fail
closed. These modes are user-invoked. Apart from this explicitly invoked helper, hooks do not write project
files. Configuration includes declared relative input roots, not source text.
The setup helper's checks are not an atomic filesystem security boundary
against a malicious same-user process changing ancestors concurrently.

The helper runs project Vitest only on user invocation. It inherits that test environment, and tests
may access networks. It normalizes structured runner output in memory and writes only scalar
counts, completion status and snapshot descriptors in an owned unique run
directory. Raw reports, test names, error bodies and terminal output are never
written by the helper, including interrupted runs. A hard kill can leave a
partial scalar artifact, which the host rejects. Project tests may themselves
write other files. No raw output is stored in the host preference store or release.

File reads reject unsafe names, aliases, symlinks, outside-root resolved paths,
unsupported file kinds, excessive sizes and incomplete observations. The host
filesystem API does not provide atomic no-follow reads; a malicious same-user
process can race a check/read or fabricate local summaries. Ernesto is an
observational aid, not a security boundary, independent audit or tamper-proof
attestation. Endpoint comparisons and filesystem notifications cannot detect
every external intermediate edit/revert. Excluded inputs, secrets, external
services, time and native state are outside the snapshot.

The separately installed Claude host has its own model, network, telemetry,
logging and update behavior. Ernesto's lack of added network calls does not
mean Claude or user-run tests are offline. Never attach raw client logs,
private paths, secrets or source to public reports.
