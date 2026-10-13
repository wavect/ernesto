# Reviewed local test evidence

QA is opt-in. Ernesto never starts a test process. The separate helper requires Node.js 24 and an already installed project-local Vitest **4.1.11**. It does not fetch packages, evaluate shell strings, change package scripts, or infer success from chat, terminal text, a screenshot, or exit zero alone.

Review the helper and your test configuration before invoking it. Tests execute project code with your normal environment and may access network services. Local records are structurally validated observations, **not tamper-proof attestation**: a process with the same user access can fabricate reports and hashes. Independent CI and review remain the enforcement layer.

## Setup and explicit run

Create `.ernesto/config.json` in the reviewed project root:

```json
{
  "version": 1,
  "checkId": "vitest",
  "scope": {
    "roots": ["src", "tests", "package.json", "package-lock.json", "vitest.config.js"],
    "excludes": []
  },
  "filters": [],
  "runtimeDescriptor": "node-24/vitest-4.1.11"
}
```

Adjust the input roots to include every source, test, configuration and lock input relevant to your check, including relevant untracked files. Configuration is parsed as data, not executed for discovery. Ernesto rejects unreviewed configuration fields. Empty filters declare the configured Vitest suite; filename filters declare only that filtered check. Filters cannot contain options, traversal, URLs, backslashes, terminal controls or bidirectional formatting controls.

The helper ships within the installed Ernesto plugin alongside its `core` modules, and also in the source distribution. From that Ernesto directory:

```sh
node integrations/vitest/run.mjs /path/to/reviewed/project
```

`/path/to/reviewed/project` is a placeholder for your project directory. The helper and its `core` modules must stay together. Invoking the helper requires your separate Node.js 24 runtime and the project's installed runner; plugin installation never invokes it. No npm publication is required.

The helper deliberately uses `vitest run`, overrides reporter selection with Vitest's ordinary `default` reporter plus a reviewed summary reporter that derives from the installed built-in `JsonReporter`. It converts structured results in memory before writing a unique scalar-only summary. The summary reporter is necessary because built-in JSON omits unhandled-error counts in this pinned Vitest version and contains test names, source paths and error bodies. The adapter adds global error counts and preserves no raw JSON on disk, including after an abrupt shutdown. Review projects that depend on custom reporter effects before using it. Test configuration, source selection, environment, assertions and runner exit behavior remain the project's own. It propagates the actual nonzero runner exit; interruption returns a signal-derived nonzero helper status while retaining the actual child completion separately. Cancellation forwards the signal and escalates to SIGKILL after three seconds if necessary. Missing or malformed structured output can leave an exit-zero run **unknown**, never passing.

## Scope and comparisons

Snapshots hash canonical worktree identity and sorted relative paths plus working-tree bytes, rather than Git HEAD. Source edits, new untracked inputs, renames, deletions, config/lock changes, check definitions, exclusions and runtime descriptors invalidate earlier matching observations. Worktrees have separate identities. Records contain hashes, aggregate counts, exclusions and generic reasons; they contain no source bytes, full paths, environment values, command strings, test names, stack traces or raw logs.

Default exclusions are `.git`, `node_modules`, `.ernesto`, `.agent-cache`, `dist`, `build`, `coverage`, `.env`, credentials/secrets directories, private-key extensions and common credential filenames. Do not put secret material in reviewed source inputs. Exclusion is not a comprehensive secret detector. Excluded inputs, environment secrets, network responses, databases, time and native state are outside the fingerprint.

Snapshots are bounded to 2,000 files, 2 MiB per input, 32 MiB total and 32 directory levels. Symlinks, nested Git repositories/submodules, unsupported file kinds, unsafe names, denied reads and limits make a snapshot incomplete. Case-sensitive names stay distinct. Missing optional configured paths are represented by their absence in the file set; adding or deleting them changes the digest.

The helper takes start/end snapshots and records observed write epochs. Known input edits followed by a revert still prevent stable passing confidence. Filesystem notifications and endpoint hashes cannot detect every external intermediate edit/revert sequence. A matched badge means **snapshot matched at the displayed comparison time**, not immutable execution or business correctness. The reviewed runtime descriptor names Node major 24 and the exact runner. The host compares the reviewed descriptor and captured inputs; it cannot independently inspect a future process runtime or external environment.

After loading a stored record, before comparison and across read/observation gaps, the status is checking or unknown. A current complete comparison can show matched or stale. The historical outcome remains separate: a failed check stays failed even after its inputs change. A later relevant failed or unknown run takes precedence over an older pass, regardless of completion arrival order. Chocolate and companion animation never modify evidence.

## Protocol v1

Only `.ernesto/runs/<UUID-v4>/record.json` is consumed. An atomic `started.json` records an explicit in-progress run. Final records are atomically renamed after process completion; temporary or old reports cannot satisfy a different run ID. A transient scalar-only summary is deleted after final normalization. No test names, error bodies, raw JSON, stdout or stderr are persisted.

Each final record contains schema/reducer versions, unique run ID, hashed workspace/config identity, check ID, integration and exact runner versions, start/end times, real child exit/signal and separate requested-interruption flag, suite or filtered scope, selected/completed/passed/failed/skipped/todo counts, structured runner success/global error count, both snapshots, observed epochs/gap and fixed safe provenance. Completed means passed plus failed; selected means completed plus skipped plus todo. Completeness describes the declared check only. Skipped/todo cases remain visible and yield partial completeness. Zero meaningful tests, global errors, process/report disagreement, missing output or interruption cannot produce an accepted pass.

The parser rejects records over 32 KiB, depth over 12, unsupported versions, unknown fields, dangerous keys, unsafe integers, inconsistent counts, hostile strings and mismatched workspace/check/config/run correlation. JSON is never interpreted as code, shell, Markdown directives or templates. The host must guard every canonical local read and reject links before ingestion. No remote record fetching exists.

## Retention and cleanup

The helper retains at most 20 valid completed summaries or seven days, whichever limit is reached first. The cleanup function accepts lower retention ceilings, from one to 20 summaries and one hour to seven days. Incomplete/interrupted runs without a final valid record are not recursively removed. Concurrent helpers use independent UUID directories and atomic files. Cleanup only removes validated, owned summary/start files in valid run directories, and skips unfamiliar files or links.

Disabling QA stops mod evidence work. Removing the plugin does not delete project files. Optional project cleanup consists of reviewing and deleting the specifically owned `.ernesto/config.json` and validated run summary files. Do not recursively remove arbitrary user-supplied directories.

## Synthetic reproduction

The openly distributable example contains only synthetic arithmetic and deliberately failing, skipped/todo, interrupted and collection-error scenarios:

```sh
cd examples/vitest-demo
npm ci --ignore-scripts --legacy-peer-deps
node reset.mjs
cd ../..
node integrations/vitest/run.mjs examples/vitest-demo
node --test tests/evidence-unit.mjs tests/evidence-e2e.mjs
```

Use a worktree-local npm cache when reproducing. The end-to-end test exercises actual installed Vitest, final records, snapshot comparison, source edit/stale, rerun/failure, omissions, zero selection, collection/unhandled errors, process/report disagreement, corrupt summary, interleaved output, real input mutation/edit-revert, concurrent run IDs, leftover reports and interruption. Host loading/drawing and installation are separately verified by the project's host tests; the Node suite alone is not proof of a supported host surface.

On the engineering machine, pure SHA256 processing of the full 32 MiB byte ceiling took 1.36 seconds; the per-file synchronous ceiling is 2 MiB, and filesystem reads yield between files. Actual full negative-case end-to-end suites have completed in roughly 10 to 27 seconds, including repeated runner startup, explicit interruption and an arithmetic edit/rerun. These are local engineering observations, not a cross-platform performance guarantee.
