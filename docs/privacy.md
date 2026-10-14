# Privacy and trust boundaries

Ernesto's runtime hooks make no model calls, HTTP requests, telemetry calls,
subprocess calls, prompt changes, permission decisions or automatic tests.
Activity is category-only; prompts, tool arguments, output and filenames are
not retained. Companion mode does not scan project inputs. It displays the
bundled owner-approved artwork and stores boolean preferences.

The 0.2.0 candidate defaults QA observation on. Each workspace remembers its
own on/off preference. Without config, startup probes only workspace/config
metadata and shows setup needed. With a valid config, it reads the supported
runner descriptor, bounded declared source bytes and owned run summaries.
Use `/ernesto qa off` to stop those reads, including after restarting.
A manifest `qa: false` default can also select companion-only mode. Preferences use separate keys per workspace hash and field.
Evidence is revalidated from local artifacts, never from a saved green badge.
QA off and hide stop comparisons and decorative timers. The helper retains
at most 20 completed summaries or seven days; see the evidence guide.

The explicit Node helper is a different execution boundary. `--setup` creates
`.ernesto/config.json` with conventional defaults and no test execution.
`--init` creates missing defaults and then runs the check. Existing config is
never replaced; malformed config, missing requirements and known symlinks fail
closed. These modes are user-invoked. The runtime hooks never write project
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
