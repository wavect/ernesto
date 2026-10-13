# Contributing

Work on a branch and open a pull request. Run README's development checks,
including real Vitest integration, the official Claude harness, strict
validation and deterministic package inspection. Keep evidence negative cases
and the compatibility matrix truthful. Do not add network, model, automatic
test execution, permission approval or prompt modification to the mod.

Use synthetic data only in public tests and demos. Do not attach keys,
client source, raw test output, transcripts or private paths to issues.
Original code is MIT; mascot artwork has separate terms. No automatic merge,
release, directory submission or external announcement is part of CI.

## CI failure evidence

Every failed check job attempts to save `ernesto-ci-failure-status` for seven
days. It contains only a validated public commit SHA, event type, running Node version, configured host/runner pins
and fixed stage outcomes. Raw test output, names, source contents, prompts,
paths and arbitrary environment variables are excluded. The artifact upload
uses an exact summary-file path; it does not upload the cache directory.
Failure reporting never changes the original failed gate to success.

To verify fail-closed behavior, use a temporary branch with one synthetic
failing test fixture. Confirm that the test step and workflow fail, later
release gates are skipped, and the downloaded artifact contains only the
allowed scalar fields. Keep this fixture out of the review branch and release.

Verified on 14 October 2026: the [normal branch workflow](https://github.com/wavect/ernesto/actions/runs/38484320384)
passed. A [separate controlled negative fixture](https://github.com/wavect/ernesto/actions/runs/38484376094)
failed the test step, kept the workflow failed and skipped later host/package
release gates. Its downloaded summary recorded the failed/skipped outcomes and
only the allowed scalar fields. The failing fixture is absent from this branch
and the immutable published prerelease.
