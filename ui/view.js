import { commandSummary, commandDetails } from '../core/project.js';
import { mascotPose, mascotCells, POSE_CAPTIONS } from './mascot.js';
import { safeText } from '../core/companion.js';
export function evidenceText(qa, enabled, configured = true) {
  if (!enabled) return 'Companion mode, QA off. /ernesto qa on';
  if (!configured) return 'Companion ready · checks on request';
  const d = qa || {};
  return `QA: ${safeText(d.outcome || 'not_run')} · ${safeText(d.freshness || 'unknown')} · ${safeText(d.completeness || 'unknown')}`;
}
export function statusText(qa, enabled, config, project = null, run = null) {
  if (!enabled)
    return 'QA is off. /ernesto qa on resumes observation for this workspace.';
  if (run && (run.kind === 'command' || run.status === 'running'))
    return commandDetails(run);
  if (!config)
    return (
      'Ernesto is ready. QA observation is on. ' +
      (project && project.kind !== 'none'
        ? 'Detected: ' +
          project.label +
          '. Choose Check project or /ernesto check.'
        : 'The companion needs no setup. Project checks are available when a test/check command is detected.') +
      ' No tests run automatically.'
    );
  return (
    evidenceText(qa, true) +
    '\n' +
    safeText(qa?.reason || 'No supported check observed.') +
    '\nNext: ' +
    (qa?.record
      ? 'use /ernesto evidence for details; /ernesto check runs the next project check.'
      : 'choose Check project or /ernesto check, then inspect /ernesto evidence.') +
    '\n/ernesto qa off pauses observation and remembers your choice.'
  );
}
export function detailsText(
  qa,
  enabled,
  config = null,
  project = null,
  run = null,
) {
  if (!enabled)
    return 'QA is off. /ernesto qa on resumes observation for this workspace.';
  if (run && (run.kind === 'command' || run.status === 'running'))
    return commandDetails(run, true);
  if (!config) return statusText(qa, enabled, config, project);
  const r = qa?.record;
  return [
    evidenceText(qa, true),
    safeText(qa?.reason || 'No supported check observed.'),
    `Integrity: ${safeText(qa?.integrity || 'unsupported')}`,
    config
      ? `Declared inputs: ${config.scope.roots.map((x) => safeText(x)).join(', ')}`
      : '',
    r
      ? `Scope: ${safeText(r.scope.kind)}${r.scope.filters.length ? ': ' + r.scope.filters.map((x) => safeText(x)).join(', ') : ': configured suite'}`
      : '',
    r
      ? `Tests: ${r.counts.passed} passed; ${r.counts.failed} failed; ${r.counts.skipped} skipped; ${r.counts.todo} todo; ${r.counts.completed}/${r.counts.selected} completed`
      : '',
    r
      ? `Excluded: ${r.endSnapshot.exclusions.map((x) => safeText(x)).join(', ')}`
      : '',
    r
      ? `Recorded check: ${safeText(r.checkId)}; run: ${safeText(r.runId)}`
      : 'No correlated record.',
    r ? `Result observed: ${new Date(r.endedAt).toISOString()}` : '',
    `Last comparison: ${qa?.lastComparedAt != null ? new Date(qa.lastComparedAt).toISOString() : 'not compared'}`,
    r ? `Snapshot: ${safeText(r.endSnapshot?.digest || '')}` : '',
    'Scope comes from the project config; review generated defaults for custom inputs. External services, time, secrets and ignored inputs are outside it.',
    'Local records can be fabricated by the same user. Endpoint matches do not prove immutable execution.',
  ]
    .filter(Boolean)
    .join('\n');
}
// Accent is decorative; evidence always remains readable in the terminal's own text color.
const ACCENT = '#168b96';
export function nextStep(qa, enabled, config) {
  if (!enabled) return '/ernesto qa on resumes observation.';
  if (!config)
    return 'Choose Check project or /ernesto check. No setup required.';
  if (qa?.outcome === 'running')
    return 'Wait for the explicitly started check to finish.';
  if (qa?.freshness === 'checking')
    return 'Comparing inputs. No tests are being started.';
  if (qa?.freshness === 'stale')
    return 'Inputs changed. Choose Check project to run the check again.';
  if (qa?.outcome === 'failed')
    return 'Inspect the test failure, then choose Check project to run again.';
  if (
    qa?.outcome === 'passed' &&
    qa?.freshness === 'matched' &&
    qa?.completeness === 'complete'
  )
    return 'Snapshot matched at the last comparison. Review the scope below.';
  return 'Choose Check project or /ernesto check; review any gaps in the evidence.';
}
export function summaryText(state) {
  if (!state.enabled) return evidenceText(state.qa, false);
  const run = state.projectRun;
  if (run && (run.kind === 'command' || run.status === 'running'))
    return commandSummary(run);
  if (state.config) return evidenceText(state.qa, true);
  return state.project && state.project.kind !== 'none'
    ? 'Ready · ' + state.project.label
    : 'Ready · companion active';
}
function companionCaption(state) {
  // Personality is independent of periodic snapshot comparison and evidence claims.
  return (
    state.mood.caption || POSE_CAPTIONS[state.mood.pose] || POSE_CAPTIONS.wake
  );
}
function portrait(elements, e, state, compact = false) {
  if (e.surface !== 'terminal') return null;
  return elements.Raster({
    key: 'ernesto',
    columns: compact ? 12 : 18,
    rows: compact ? 3 : 5,
    cells: mascotCells(
      mascotPose(
        state.mood,
        state.projectRun?.kind === 'command' ||
          state.projectRun?.status === 'running'
          ? {
              outcome:
                state.projectRun.status === 'failed'
                  ? 'failed'
                  : state.projectRun.status === 'running'
                    ? 'running'
                    : 'unknown',
              freshness: state.projectRun.freshness,
            }
          : state.qa,
        state.enabled,
      ),
      state.prefs.reducedMotion ? 0 : state.frame,
      compact,
    ),
  });
}
export function drawBand(elements, e, theirs, state, checkProject) {
  const { Box, Text } = elements;
  const width = e.props.bodyColumns || e.viewport?.columns || 40;
  // Reserve a row for the host drawing instead of pushing it out of the band.
  const rows = Math.max(0, (e.props.maxRows ?? 1) - (theirs ? 1 : 0));
  if (!rows) return theirs;
  const summary = summaryText(state);
  if (width < 48 || rows === 1)
    return Box({
      flexDirection: 'column',
      children: [
        theirs,
        Text({
          key: 'ernesto-summary',
          wrap: 'truncate-end',
          children: [`Ernesto · ${summary}`],
        }),
      ],
    });
  const showPortrait = rows >= 3 && e.surface === 'terminal';
  const textWidth = width - (showPortrait ? (rows >= 5 ? 20 : 14) : 0);
  const line = (text, props = {}) =>
    Text({ wrap: 'truncate-end', ...props, children: [text] });
  const lines = [
    line('Ernesto', { bold: true, color: ACCENT }),
    line(summary, { key: 'ernesto-summary' }),
  ];
  if (rows >= 3) {
    if (
      state.enabled &&
      state.project?.kind &&
      state.project.kind !== 'none' &&
      state.projectRun?.status !== 'running' &&
      typeof checkProject === 'function'
    )
      lines.push(
        elements.Button({
          key: 'check',
          hotkey: 't',
          plain: true,
          label: 'Check project',
          onPress: checkProject,
        }),
      );
    else
      lines.push(
        line(
          state.projectRun?.status === 'running'
            ? 'Project check running...'
            : state.config
              ? '/ernesto evidence · inspect result & scope'
              : '/ernesto · companion controls',
          { dimColor: true },
        ),
      );
  }
  if (rows >= 5 && !state.prefs.quiet)
    lines.push(line(companionCaption(state), { italic: true }));
  return Box({
    flexDirection: 'column',
    children: [
      theirs,
      Box({
        flexDirection: 'row',
        gap: 2,
        alignItems: 'center',
        children: [
          ...(showPortrait ? [portrait(elements, e, state, rows < 5)] : []),
          Box({
            width: Math.max(1, textWidth),
            flexDirection: 'column',
            children: lines,
          }),
        ],
      }),
    ],
  });
}
export function drawPane(
  elements,
  e,
  state,
  refresh,
  close,
  toggleDetails,
  checkProject,
) {
  const { Box, Text, Button } = elements;
  const width = e.props.bodyColumns || e.viewport?.columns || 40;
  const qa = state.qa;
  const run = state.projectRun;
  const commandOnly = Boolean(
    run && (run.kind === 'command' || run.status === 'running'),
  );
  const narrow = width < 60;
  const short = (e.props.scroll?.bodyRows || e.props.bodyRows || 12) < 20;
  const record = state.enabled && !commandOnly ? qa?.record : null;
  const text = (value, props = {}) => Text({ ...props, children: [value] });
  const section = (title, children) =>
    Box({
      flexDirection: 'column',
      children: [text(title, { bold: true, color: ACCENT }), ...children],
    });
  const header = Box({
    flexDirection: 'column',
    children: [
      text('Ernesto evidence', { bold: true, color: ACCENT }),
      ...(!short && !state.prefs.quiet
        ? [text(companionCaption(state), { italic: true })]
        : []),
      ...(!narrow
        ? [
            text(
              short
                ? 'Ctrl+X, Tab: focus · PgDn: scroll'
                : 'Local observation · explicit checks only',
              { dimColor: true },
            ),
          ]
        : []),
    ],
  });
  const children = [
    Box({
      flexDirection: 'row',
      gap: 2,
      alignItems: 'center',
      children: [
        ...(!short && width >= 64 && e.surface === 'terminal'
          ? [portrait(elements, e, state, true)]
          : []),
        header,
      ],
    }),
    Box({
      flexDirection: narrow ? 'column' : 'row',
      gap: narrow ? 0 : 1,
      children: [
        ...(state.enabled &&
        state.project &&
        state.project.kind !== 'none' &&
        run?.status !== 'running' &&
        typeof checkProject === 'function'
          ? [
              Button({
                key: 'check',
                hotkey: 't',
                plain: true,
                label: narrow ? 'Check' : 'Check project',
                onPress: checkProject,
              }),
            ]
          : []),
        Box({
          flexDirection: 'row',
          gap: 1,
          children: [
            Button({
              key: 'refresh',
              hotkey: 'r',
              autoFocus: true,
              ...(narrow ? { plain: true } : {}),
              label: narrow ? 'Compare' : 'Compare (r)',
              onPress: refresh,
            }),
            Button({
              key: 'details',
              hotkey: 'd',
              ...(narrow ? { plain: true } : {}),
              label: narrow
                ? state.detailsExpanded
                  ? 'Less'
                  : 'Details'
                : state.detailsExpanded
                  ? 'Less (d)'
                  : 'Details (d)',
              onPress: toggleDetails,
            }),
            Button({
              key: 'close',
              hotkey: 'q',
              ...(narrow ? { plain: true } : {}),
              label: narrow ? 'Close' : 'Close (q)',
              onPress: close,
            }),
          ],
        }),
      ],
    }),
    Box({
      ...(!narrow
        ? { borderStyle: 'round', borderColor: ACCENT, paddingX: 1 }
        : {}),
      flexDirection: 'column',
      children: [
        text(
          narrow && state.enabled && state.config && !commandOnly
            ? `QA: ${safeText(qa?.outcome || 'not_run')} · ${safeText(qa?.freshness || 'unknown')}`
            : summaryText(state),
          {
            bold: true,
          },
        ),
        ...(commandOnly && run.status !== 'running'
          ? [
              text('Test counts and coverage: not verified.', {
                dimColor: true,
              }),
            ]
          : []),
        ...(state.enabled && state.config && !commandOnly
          ? [
              text(
                'Completion: ' +
                  safeText(qa?.completeness || 'unknown') +
                  (narrow
                    ? ''
                    : '   Integrity: ' +
                      safeText(qa?.integrity || 'unsupported')),
              ),
              ...(!narrow
                ? [text(safeText(qa?.reason || 'No supported check observed.'))]
                : []),
            ]
          : []),
      ],
    }),
  ];
  if (narrow) {
    // The summary must fit before controls and metadata in an eight-row inline pane.
    [children[1], children[2]] = [children[2], children[1]];
    children.push(text('PgDn: more · Esc: close', { dimColor: true }));
    if (state.enabled && state.config && !commandOnly)
      children.push(
        text('Integrity: ' + safeText(qa?.integrity || 'unsupported')),
        text(safeText(qa?.reason || 'No supported check observed.')),
      );
  }
  if (record)
    children.push(
      section('TESTS', [
        text(
          `${record.counts.passed} passed · ${record.counts.failed} failed · ${record.counts.skipped} skipped · ${record.counts.todo} todo`,
        ),
        text(
          `${record.counts.completed}/${record.counts.selected} completed · ${safeText(record.scope.kind)} scope`,
        ),
      ]),
    );
  children.push(
    section('NEXT STEP', [
      text(
        commandOnly
          ? run.status === 'running'
            ? 'Running the project check you requested.'
            : 'Choose Check project to run again. Details shows the last command output.'
          : nextStep(qa, state.enabled, state.config),
      ),
    ]),
  );
  if (state.config && state.enabled && !commandOnly)
    children.push(
      section('SCOPE', [
        text(
          `${state.config.scope.roots.length} declared inputs · ${state.config.filters.length ? 'filtered check' : 'configured suite'}`,
        ),
        text(
          'Snapshot matching covers declared inputs at comparison time. It does not establish business acceptance.',
        ),
      ]),
    );
  if (state.detailsExpanded)
    children.push(
      section('CHECK DETAILS', [
        ...(run?.output
          ? [text('LAST COMMAND OUTPUT', { bold: true }), text(run.output)]
          : []),
        text(detailsText(qa, state.enabled, state.config, state.project, run)),
      ]),
    );
  children.push(
    text(
      'Local records can be fabricated by the same user. External services, secrets and ignored inputs are outside this evidence.',
      { dimColor: true },
    ),
  );
  return Box({ flexDirection: 'column', gap: short ? 0 : 1, children });
}
