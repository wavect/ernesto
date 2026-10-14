# Installation, updates and removal

The commands below describe version 0.1.0. Check the
[versioned release record](https://github.com/wavect/ernesto/releases) for
publication status, approved checksums and exact released-source checks before
using them as supported release instructions. Source-main installation checks
are recorded separately in [release.md](release.md). Inspect the public source
at https://github.com/wavect/ernesto and its privacy/license terms before
using a privileged mod.

## Version and scope

Ernesto requires Claude Code 2.1.296+. The shell combined command itself was
added in 2.1.292; the in-session combined route in 2.1.275. A syntax floor does
not imply that an older version supports Ernesto's runtime. Shell installation
defaults to user scope; `--scope project` or `--scope local` are explicit choices.
Organizational restrictions are not bypassed by this mod.

## Release-gated public commands

From the shell:

```sh
claude plugin install ernesto --marketplace wavect/ernesto
```

Inside a Claude Code session, with source confirmation and scope selection:

```text
/plugin install ernesto --marketplace wavect/ernesto
```

Fallback from the shell:

```sh
claude plugin marketplace add wavect/ernesto
claude plugin install ernesto@ernesto
```

Fallback in-session uses `/plugin marketplace add wavect/ernesto`, then
`/plugin install ernesto@ernesto`. Marketplace name and plugin name are
`ernesto`; GitHub source `wavect/ernesto` is not the marketplace ID.

Verify with `claude --version`, `claude plugin marketplace list`,
`claude plugin list`, and `claude plugin details ernesto`. Restart or use
`/reload-plugins` where supported, then run `/ernesto` in a fresh session.
A registered marketplace alone does not prove loaded hooks or working UI.

## First use in the 0.3.0 candidate

Restart Claude Code in your project. Ernesto appears immediately. Open
`/ernesto evidence` and choose **Check project**, or type `/ernesto check`.
It uses an existing package test/check script. No project config or helper-path
copying is required. Nothing runs at startup. `/ernesto doctor` explains the
detected command. No command detected? The companion is still ready.
QA observation defaults on and remembers `/ernesto qa off` per workspace.
See [the walkthrough](getting-started.md). This branch is unreleased. A source
installation and a tagged release are separate; published stable remains 0.1.0.

## Local review

From the reviewed checkout, use `claude --plugin-dir .` for development, or
`claude plugin install ernesto --marketplace .` for a local catalog install.
Tests must use a clean profile, inspect the installed cache for missing imports,
and start a fresh session. Local tests do not certify public availability.

## Updates and disable

```sh
claude plugin update ernesto@ernesto
claude plugin disable ernesto@ernesto
claude plugin enable ernesto@ernesto
```

Restart/reload after update. The manifest version must be incremented for
new code to replace an installed cached version. Third-party marketplace
auto-update defaults off; users may enable it in `/plugin` Marketplaces.

## Remove

```sh
claude plugin uninstall ernesto@ernesto
```

For project/local scope add `--scope project` or `--scope local`, matching
installation. If desired, unregister the marketplace after uninstall:

```sh
claude plugin marketplace remove ernesto
```

Marketplace removal uninstalls every plugin from that marketplace. It is a
separate choice from removing one plugin. Run `/ernesto forget confirm`
before uninstall to remove only Ernesto's preferences for this workspace.
Project config and local evidence are separately owned: review and remove
only `.ernesto/config.json` and validated files in its run directories.
No broad recursive deletion command is required. The optional source helper
can be removed from the location where you deliberately placed it.

## Troubleshooting and rollback

Not found: check reviewed source, marketplace spelling, manifest source `./`,
permissions and release status. Installed but no UI: check host version,
scope, surface, enable state, restart/reload and `/ernesto`. QA unknown:
review config, permissions, exact Node/Vitest requirements and explicit
helper run. No report is not a passing check. Disabled organizational mods
require the administrator's decision, not a workaround.

An approved release rollback must restore a reviewed prior manifest version
in a normal commit and verify reinstall from a pinned Git checkout locally.
No public version downgrade was exercised during candidate validation; do not infer one from a same-version update.
