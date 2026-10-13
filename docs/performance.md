# Candidate performance observations

Measured on 13 October 2026 with Ernesto 0.1.0-rc.1, Claude Code
2.1.296, Node.js 24.3.0 and Vitest 4.1.11. The host was an Apple M3 Pro
Mac with 11 CPU cores, 18 GiB memory and macOS 26.5.1, arm64.

Each case used a separate interactive CLI process and isolated profile in a
synthetic local project, with the same onboarding/account metadata and empty
MCP configuration. The companion cases loaded the current source through
`--plugin-dir`; the baseline did not load Ernesto. Only local slash commands
were sent. No model prompt or model call was used.

After startup and command completion, `ps` sampled the native Claude process
about every 300 ms for approximately six seconds. CPU is the change in cumulative
process CPU time divided by elapsed time, with 100% representing one core.
RSS is resident memory for that process, including Claude itself, not just the
mod. The active case invoked `/ernesto chocolate` approximately every 1.5 seconds.
The QA case displayed the evidence pane while observing an explicitly completed
Vitest run. Scope contained 13 reviewed files and 41,120 bytes, including runner
and configuration identity files. The helper did not run during measurement.

| Case                           | Elapsed seconds | CPU, one core | Median RSS, MiB | Peak RSS, MiB |
| ------------------------------ | --------------: | ------------: | --------------: | ------------: |
| Claude baseline                |           6.114 |        0.327% |         203.828 |       206.141 |
| Companion idle, QA off         |           6.029 |        1.990% |         264.547 |       278.391 |
| Companion active, QA off       |           6.155 |        8.124% |         280.391 |       281.031 |
| QA enabled, evidence pane open |           6.154 |        8.287% |         257.484 |       261.922 |

Relative to this baseline, CPU increased by about 1.66, 7.80 and 7.96 percentage
points; median RSS differed by about 60.7, 76.6 and 53.7 MiB respectively.
These are short observations from separate processes on one machine. Startup,
host allocation, garbage collection, profile state and other local work cause
variation. They do not isolate every allocation to Ernesto, establish a leak,
or predict sustained use or large-project behavior. Earlier baseline attempts
varied materially in RSS. There is no zero-overhead claim.

A scoped source edit after a displayed matching pass became visibly stale
in approximately 0.41 seconds in the same small-project run. A second actual
host check required the exact `QA: passed · matched · complete` to
`QA: passed · stale · complete` transition and observed it in 0.44 seconds. This is an
observation from a completed local comparison, not a promise for all projects.
QA comparisons are bounded and scheduled through the host clock; hidden and
QA-off behavior has independent harness coverage showing no subsequent project
reads across a five-second interval. Companion mode does not scan the project.

For release review, repeat on the exact packaged copy and every newly supported
host/OS, with larger supported scopes and repeated samples before tightening
performance claims. Desktop Code and other operating systems remain unmeasured.
