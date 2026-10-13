import { mascotPose, mascotCells, POSE_CAPTIONS } from './mascot.js';
import { safeText } from '../core/companion.js';
export function evidenceText(qa, enabled) {
  if (!enabled) return 'Companion mode, QA off. /ernesto qa setup';
  const d = qa || {};
  return `QA: ${safeText(d.outcome || 'not_run')} · ${safeText(d.freshness || 'unknown')} · ${safeText(d.completeness || 'unknown')}`;
}
export function detailsText(qa, enabled, config = null) {
  if (!enabled)
    return 'QA is off. Setup previews the scope and explicit helper command before enabling.';
  const r = qa?.record;
  return [
    evidenceText(qa, true),
    safeText(qa?.reason || 'No supported check observed.'),
    `Integrity: ${safeText(qa?.integrity || 'unsupported')}`,
    config
      ? `Reviewed inputs: ${config.scope.roots.map((x) => safeText(x)).join(', ')}`
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
    'Scope comes from the reviewed project config. External services, time, secrets and ignored inputs are outside it.',
    'Local records can be fabricated by the same user. Endpoint matches do not prove immutable execution.',
  ]
    .filter(Boolean)
    .join('\n');
}
export function drawBand(elements, e, theirs, state, pluginRoot) {
  const { Box, Text, Image, Raster } = elements;
  const pose = mascotPose(state.mood, state.qa, state.enabled);
  const width = e.props.bodyColumns || e.viewport.columns;
  const summary = evidenceText(state.qa, state.enabled);
  const children = [theirs];
  if (width < 56 || e.props.maxRows < 2)
    children.push(Text({ children: [`Ernesto · ${summary}`] }));
  else {
    const portrait =
      e.surface === 'terminal' && e.props.maxRows >= 5
        ? Raster({
            key: 'ernesto',
            columns: 18,
            rows: 5,
            cells: mascotCells(pose, state.frame),
          })
        : e.surface === 'terminal'
          ? Image({
              key: 'ernesto',
              source: {
                file:
                  pluginRoot +
                  '/assets/' +
                  (pose === 'chocolate'
                    ? 'ernesto-chocolate.png'
                    : 'ernesto.png'),
                format: 'png',
              },
              columns: 6,
              rows: 2,
              alt: 'Ernesto, turquoise shell and two eyes',
            })
          : Text({ color: '#2fc6cc', children: ['Ernesto'] });
    children.push(
      Box({
        flexDirection: 'row',
        gap: 1,
        children: [
          portrait,
          Box({
            flexDirection: 'column',
            children: [
              Text({
                children: [
                  'Ernesto · ' +
                    (state.prefs.quiet ? 'Companion' : POSE_CAPTIONS[pose]),
                ],
              }),
              Text({ children: [summary] }),
            ],
          }),
        ],
      }),
    );
  }
  return Box({ flexDirection: 'column', children });
}
export function drawPane(elements, e, state, refresh, close) {
  const { Box, Text, Button } = elements;
  return Box({
    flexDirection: 'column',
    gap: 1,
    children: [
      Text({ bold: true, children: ['Ernesto evidence'] }),
      Text({ children: [detailsText(state.qa, state.enabled, state.config)] }),
      Button({
        key: 'refresh',
        hotkey: 'r',
        label: '[r] Refresh snapshot',
        onPress: refresh,
      }),
      Button({ key: 'close', hotkey: 'q', label: '[q] Close', onPress: close }),
    ],
  });
}
