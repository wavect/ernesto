import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawBand, drawPane, nextStep } from '../ui/view.js';
import { mascotCells, mascotPose } from '../ui/mascot.js';
const elements = Object.fromEntries(
  ['Box', 'Text', 'Raster', 'Button'].map((type) => [
    type,
    (props) => ({ type, ...props }),
  ]),
);
const state = {
  prefs: { quiet: false, reducedMotion: true },
  mood: { pose: 'wake' },
  frame: 1,
  enabled: true,
  qa: {
    outcome: 'passed',
    freshness: 'matched',
    completeness: 'complete',
    integrity: 'validated_local_record',
  },
  config: { scope: { roots: ['src'], excludes: [] }, filters: [] },
};
const find = (tree, type) =>
  [
    tree,
    ...(tree?.children || []).flatMap((c) =>
      typeof c === 'object' ? find(c, type) : [],
    ),
  ].filter((n) => n?.type === type);
const text = (tree) =>
  find(tree, 'Text')
    .flatMap((n) => n.children)
    .join('\n');
test('band preserves the host and yields when its row allowance is exhausted', () => {
  const host = elements.Text({ children: ['host'] });
  for (const rows of [0, 1])
    assert.equal(
      drawBand(
        elements,
        { props: { maxRows: rows }, surface: 'terminal' },
        host,
        state,
      ),
      host,
    );
  const band = drawBand(
    elements,
    { props: { maxRows: 2 }, surface: 'terminal' },
    host,
    state,
  );
  assert.match(text(band), /host\nErnesto/);
  assert.equal(find(band, 'Raster').length, 0);
  assert.equal(find(band, 'Text')[1].wrap, 'truncate-end');
});
test('normal and roomy bands use bounded native portraits, with a text fallback outside terminal', () => {
  for (const [rows, columns, portraitRows] of [
    [4, 64, 3],
    [6, 100, 5],
  ]) {
    const band = drawBand(
      elements,
      { props: { maxRows: rows, bodyColumns: columns }, surface: 'terminal' },
      {},
      state,
    );
    assert.equal(find(band, 'Raster')[0].rows, portraitRows);
    assert.match(text(band), /QA: passed · matched · complete/);
  }
  const desktop = drawBand(
    elements,
    { props: { maxRows: 6, bodyColumns: 80 }, surface: 'desktop' },
    null,
    state,
  );
  assert.equal(find(desktop, 'Raster').length, 0);
  assert.match(text(desktop), /Ernesto/);
});
test('reduced motion fixes the portrait frame and periodic comparisons keep its silhouette steady', () => {
  const e = { props: { maxRows: 6, bodyColumns: 80 }, surface: 'terminal' };
  const first = drawBand(elements, e, null, state);
  const comparing = {
    ...state,
    frame: 3,
    qa: { ...state.qa, freshness: 'checking' },
  };
  const second = drawBand(elements, e, null, comparing);
  assert.equal(find(first, 'Raster')[0].cells, find(second, 'Raster')[0].cells);
  assert.match(text(second), /passed · checking/);
  assert.doesNotMatch(text(second), /passed · matched/);
  assert.equal(mascotPose(state.mood, comparing.qa, true), 'passed');
});
test('every portrait pose has valid transparent cells in both sizes', () => {
  for (const compact of [true, false])
    for (const pose of [
      'wake',
      'idle',
      'focus',
      'passed',
      'checking',
      'stale',
      'failed',
      'unknown',
      'chocolate',
    ]) {
      const cells = new Uint32Array(
        Uint8Array.from(
          Buffer.from(mascotCells(pose, 1, compact), 'base64'),
        ).buffer,
      );
      assert.equal(cells.length, (compact ? 12 * 3 : 18 * 5) * 3);
      for (let i = 0; i < cells.length; i += 3) {
        assert.ok([32, 0x2580, 0x2584].includes(cells[i]));
        if (cells[i + 1] === 0x01000000 && cells[i + 2] === 0x01000000)
          assert.equal(cells[i], 32);
      }
    }
});
test('next steps distinguish missing, running, stale, failed and incomplete evidence', () => {
  assert.match(nextStep(null, false, null), /qa on/);
  assert.match(nextStep(null, true, null), /setup/);
  assert.match(nextStep({ outcome: 'running' }, true, state.config), /Wait/);
  assert.match(
    nextStep({ ...state.qa, freshness: 'checking' }, true, state.config),
    /No tests/,
  );
  assert.match(
    nextStep({ ...state.qa, freshness: 'stale' }, true, state.config),
    /Inputs changed/,
  );
  assert.match(
    nextStep({ ...state.qa, outcome: 'failed' }, true, state.config),
    /failure/,
  );
  assert.doesNotMatch(
    nextStep({ ...state.qa, completeness: 'partial' }, true, state.config),
    /Snapshot matched/,
  );
});
test('quiet panes suppress personality and disclosures preserve full evidence behind an explicit action', () => {
  const e = { props: { bodyColumns: 36 }, surface: 'terminal' };
  const quiet = { ...state, prefs: { ...state.prefs, quiet: true } };
  const pane = drawPane(
    elements,
    e,
    quiet,
    () => {},
    () => {},
    () => {},
  );
  assert.doesNotMatch(text(pane), /Ready when you are/);
  assert.match(
    text(pane),
    /Completion: complete[\s\S]*Integrity: validated_local_record/,
  );
  assert.doesNotMatch(text(pane), /Declared inputs:/);
  const expanded = drawPane(
    elements,
    e,
    { ...quiet, detailsExpanded: true },
    () => {},
    () => {},
    () => {},
  );
  assert.match(text(expanded), /Declared inputs: src/);
  assert.deepEqual(
    find(expanded, 'Button').map((b) => b.key),
    ['refresh', 'details', 'close'],
  );
  assert.equal(find(expanded, 'Raster').length, 0);
});
