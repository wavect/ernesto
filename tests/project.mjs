import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectProject,
  commandDetails,
  compareCommand,
  outputPreview,
} from '../core/project.js';
import { captureSnapshot } from '../core/snapshot.js';
const detect = (scripts, packageManager, entries = []) =>
  detectProject(
    JSON.stringify({ scripts, packageManager }),
    entries,
    null,
    '/plugin',
  );
test('discovery selects an existing one-shot check and its package manager without evaluating scripts', () => {
  assert.deepEqual(
    detect({ test: 'echo ok', 'test:ci': 'vitest run' }, 'pnpm@10.1.0').argv,
    ['pnpm', 'run', 'test:ci'],
  );
  assert.equal(
    detect({ check: 'tsc' }, null, [{ name: 'yarn.lock', kind: 'file' }]).label,
    'yarn run check',
  );
  assert.equal(detect({ lint: 'eslint .' }, 'bun@1.3').label, 'bun run lint');
  assert.equal(
    detect({
      'test:watch': 'vitest',
      test: 'vitest --watch',
      'check:fix': 'eslint --fix',
      dev: 'vite',
    }),
    null,
  );
  assert.equal(
    detect({ test: 'echo "Error: no test specified" && exit 1' }),
    null,
  );
  assert.equal(detect({ 'test;curl evil': 'echo x' }), null);
  assert.deepEqual(detect({ test: 'echo $(anything)' }, 'npm;curl@evil').argv, [
    'npm',
    'run',
    'test',
  ]);
  assert.equal(detectProject(null, [], '4.1.11', '/plugin').kind, 'vitest');
  assert.equal(detectProject(null, [], '4.1.10', '/plugin'), null);
  for (const bad of ['{broken', '[]', 'null', 'x'.repeat(65537)])
    assert.throws(() => detectProject(bad, [], null, '/plugin'));
});
test('command success cannot claim verified tests and output is bounded and separate', () => {
  const summary = commandDetails({
    status: 'completed',
    exitCode: 0,
    label: 'npm run test',
    output: 'secret-failure-name',
  });
  assert.match(summary, /completed \(exit 0\)/);
  assert.match(summary, /not verified/);
  assert.doesNotMatch(summary, /secret-failure-name|passed/);
  const output = outputPreview({
    stdout: 'x'.repeat(8000) + '\x1b[31mred\x1b[0m\x00\u202e',
    stderr: 'error',
  });
  assert.equal(output.length, 4000);
  assert.match(output, /red\nerror$/);
  assert.doesNotMatch(output, /\x1b|\x00|\u202e/);
});
test('input freshness stays separate from command exit and observation gaps', async () => {
  let bytes = 'one';
  const fs = {
    canonicalRoot: async () => '/project',
    stat: async () => ({ kind: 'file', size: bytes.length }),
    read: async () => new TextEncoder().encode(bytes),
  };
  const snapshot = () =>
    captureSnapshot({
      root: '/project',
      scope: { roots: ['a.js'], excludes: [] },
      runtime: 'project-command-v1',
      checkDefinition: {},
      fs,
      now: 10,
    });
  const initial = await snapshot();
  const run = {
    status: 'failed',
    exitCode: 1,
    startSnapshot: initial,
    endSnapshot: initial,
    startEpoch: 0,
    endEpoch: 0,
  };
  assert.equal(compareCommand(run, initial, 0).freshness, 'matched');
  bytes = 'two';
  const changed = compareCommand(run, await snapshot(), 0);
  assert.equal(changed.freshness, 'stale');
  assert.equal(changed.status, 'failed');
  assert.equal(compareCommand(run, initial, 1).freshness, 'unknown');
  assert.equal(
    compareCommand({ ...run, observationGap: true }, initial, 0).freshness,
    'unknown',
  );
  assert.equal(
    compareCommand({ ...run, endSnapshot: null }, initial, 0).freshness,
    'unknown',
  );
});
