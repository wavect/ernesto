# Your first check with Ernesto

This guide describes the **0.2.0 development candidate**. The published 0.1.0
release still uses the earlier manual setup. Check the
[release record](https://github.com/wavect/ernesto/releases) before upgrading.

## 1. Install and restart

For a published version, run this in your ordinary system terminal:

```sh
claude plugin install ernesto --marketplace wavect/ernesto
```

Restart Claude Code, open it in your project and type `/ernesto status`.
For this unreleased candidate, review its source checkout and launch
`claude --plugin-dir /path/to/reviewed/ernesto` from your project terminal
(replace the review-only path). Do not assume a public update contains this
candidate. The session must start in the project you want to check.

## 2. Ask Ernesto for the exact command

Inside Claude Code:

```text
/ernesto setup
```

Ernesto prints a command containing the helper's actual installed location.
Copy it into a terminal whose current directory is **your project**. You do
not need to locate the plugin cache or substitute an example path.

The command ending in `--init` creates a conventional `.ernesto/config.json`
if absent, then runs the configured Vitest check. To look at defaults before
executing project tests, use the command ending in `--setup` instead; later
run the helper without that flag. Existing config, including filters and
custom roots, is always preserved. Invalid config needs correction rather
than automatic replacement.

The integration requires Node.js **24** and project-local Vitest **4.1.11**.
Run `/ernesto doctor` if either requirement or config is unclear. Ernesto
never downloads dependencies. If your project uses another runner, keep
companion-only mode with `/ernesto qa off`; do not change project dependencies
just to obtain a green badge.

## 3. Read the result

```text
/ernesto evidence
```

QA observation is on by default. It picks up valid configuration and local
records automatically, including config created while the session is open.
`/ernesto refresh` asks for an immediate comparison; it does not run tests.

The pane separates the summary, test counts and next step. Choose **Scope &
record (d)** to expand declared inputs, exclusions, timestamps and identifiers.
**Compare (r)** rechecks inputs without starting tests. **Close (q)** or Escape
returns to your prompt. If focus stays in the prompt, press Ctrl+X then Tab
before using the pane hotkeys. Page Down scrolls long content; Ctrl+X then Up
expands an inline pane. These are Claude Code's terminal keyboard controls.
Compact windows retain the evidence summary and use less decoration.

- **Setup needed:** no usable config yet. Run `/ernesto setup`.
- **Not run:** configuration exists but no supported result was recorded.
- **Passed / matched:** the declared check passed and captured inputs matched
  at the last comparison. Review the scope and skipped/todo counts.
- **Stale:** an input changed after the result. Run the helper again.
- **Failed:** inspect the test failure in your terminal, fix it and rerun.
- **Unknown:** missing, unsupported or inconsistent evidence. Use
  `/ernesto doctor`; an exit-zero message or Claude saying “done” is not proof.

Default input selection covers conventional source/test folders, root
JavaScript/TypeScript files and recognized config/lock paths, including common
config and lock files that do not exist yet. Adding those files invalidates an
earlier snapshot; adding other custom roots requires a config edit.
Review the printed roots and add custom inputs to `.ernesto/config.json`.
Default exclusions and bounds remain in force. Discovery cannot know every
project layout, external service, environment secret or acceptance criterion.
See [scope and evidence](evidence.md). Consider ignoring `.ernesto/runs/` in Git;
Ernesto does not edit your project's ignore rules or package scripts.

## Keep the setup you want

```text
/ernesto qa off
/ernesto qa on
```

These choices belong to the current workspace and survive new sessions. Off
keeps the companion available and stops evidence work. Hide also pauses
comparisons. Show resumes them when QA is enabled. Quiet suppresses jokes;
reduced motion, the default, keeps static poses.

You can set the plugin's `qa` option to `false` for a companion-only default
using [Claude Code's plugin configuration](https://code.claude.com/docs/en/plugins/mods/reference).
A remembered workspace choice takes precedence. `/ernesto forget confirm`
clears workspace preferences and pauses QA for the current session; configured
defaults apply next session. Project config and evidence files remain yours.

## Update an existing installation

Once the new version is actually published:

```sh
claude plugin marketplace update ernesto
claude plugin update ernesto@ernesto --scope user
```

Match your original installation scope and restart Claude Code. Existing
`.ernesto/config.json` needs no migration, and legacy `/ernesto qa setup` and
`/ernesto qa enable` commands still work. Existing quiet, hide and motion
preferences stay intact. QA observation now defaults on; use `/ernesto qa off`
if you want companion-only behavior. Updates and their exact version
transitions require separate validation before publication.
