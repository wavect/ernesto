import test from 'node:test';
import assert from 'node:assert/strict';
import * as fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { runCheck, pruneEvidence } from '../integrations/vitest/run.mjs';
import { nodeFilesystem } from '../integrations/vitest/node-fs.mjs';
import { parseVitestReport } from '../integrations/vitest/report.mjs';
import { captureSnapshot } from '../core/snapshot.js';
import {
  initialEvidence,
  parseEvidence,
  reduceEvidence,
  SUPPORTED_VITEST_VERSION,
} from '../core/evidence.js';
const root = fileURLToPath(
  new URL('../examples/vitest-demo/', import.meta.url),
);
const source = path.join(root, 'src/add.js');
const originalSource = await fsp.readFile(source, 'utf8');
const configuration = path.join(root, '.ernesto/config.json');
const base = JSON.parse(
  await fsp.readFile(
    new URL(
      '../examples/vitest-demo/ernesto.config.example.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
async function configure(filters = base.filters) {
  await fsp.mkdir(path.dirname(configuration), { recursive: true });
  const c = { ...base, filters };
  await fsp.writeFile(configuration, JSON.stringify(c));
  return c;
}
const stateOf = (record) =>
  reduceEvidence(initialEvidence(), {
    type: 'record',
    text: JSON.stringify(record),
  });
const current = async (config) =>
  captureSnapshot({
    root,
    scope: config.scope,
    runtime: config.runtimeDescriptor,
    checkDefinition: config,
    fs: await nodeFilesystem(root),
  });
test(
  'real installed Vitest vertical slice and negative execution paths',
  { timeout: 90000 },
  async () => {
    assert.equal(
      JSON.parse(
        await fsp.readFile(
          path.join(root, 'node_modules/vitest/package.json'),
          'utf8',
        ),
      ).version,
      SUPPORTED_VITEST_VERSION,
    );
    await fsp.writeFile(
      source,
      'export function add(a, b) { return a + b; }\n',
    );
    const c = await configure();
    try {
      const first = await runCheck({ root, quiet: true });
      assert.equal(first.exitCode, 0);
      assert.equal(
        parseEvidence(JSON.stringify(first.record)).integrity,
        'validated_local_record',
      );
      let state = stateOf(first.record);
      assert.equal(state.outcome, 'passed');
      assert.equal(state.completeness, 'complete');
      assert.equal(first.record.scope.kind, 'filtered');
      assert.deepEqual(first.record.counts, {
        selected: 1,
        completed: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        todo: 0,
      });
      state = reduceEvidence(state, {
        type: 'compare',
        snapshot: await current(c),
      });
      assert.equal(state.freshness, 'matched');
      await fsp.writeFile(
        source,
        'export function add(a, b) { return a + b + 1; }\n',
      );
      state = reduceEvidence(state, {
        type: 'compare',
        snapshot: await current(c),
      });
      assert.equal(state.freshness, 'stale');
      assert.equal(state.outcome, 'passed');
      const failed = await runCheck({ root, quiet: true });
      assert.notEqual(failed.exitCode, 0);
      assert.equal(stateOf(failed.record).outcome, 'failed');
      assert.equal(failed.record.counts.failed, 1);
      await fsp.writeFile(
        source,
        'export function add(a, b) { return a + b; }\n',
      );
      await configure(['tests/interleaved.test.js']);
      const interleaved = await runCheck({ root, quiet: true });
      assert.equal(interleaved.record.counts.failed, 1);
      assert.equal(stateOf(interleaved.record).outcome, 'failed');
      await configure(['tests/delayed.test.js']);
      let changed;
      const mutation = await runCheck({
        root,
        quiet: true,
        onStarted: () => {
          changed = new Promise((resolve, reject) =>
            setTimeout(
              () =>
                fsp
                  .writeFile(
                    source,
                    'export function add(a, b) { return a + b + 1; }\n',
                  )
                  .then(resolve, reject),
              350,
            ),
          );
        },
      });
      await changed;
      assert.notEqual(
        mutation.record.startSnapshot.digest,
        mutation.record.endSnapshot.digest,
      );
      assert.notEqual(stateOf(mutation.record).outcome, 'passed');
      await fsp.writeFile(
        source,
        'export function add(a, b) { return a + b; }\n',
      );
      let reverted;
      const editRevert = await runCheck({
        root,
        quiet: true,
        onStarted: () => {
          reverted = new Promise((resolve, reject) =>
            setTimeout(async () => {
              try {
                await fsp.writeFile(
                  source,
                  'export function add(a, b) { return a + b + 1; }\n',
                );
                await new Promise((r) => setTimeout(r, 150));
                await fsp.writeFile(
                  source,
                  'export function add(a, b) { return a + b; }\n',
                );
                resolve();
              } catch (e) {
                reject(e);
              }
            }, 350),
          );
        },
      });
      await reverted;
      assert.equal(
        editRevert.record.startSnapshot.digest,
        editRevert.record.endSnapshot.digest,
      );
      assert.ok(
        editRevert.record.observation.endEpoch >
          editRevert.record.observation.startEpoch,
      );
      assert.equal(stateOf(editRevert.record).outcome, 'unknown');
      await configure(['tests/omissions.test.js']);
      const omissions = await runCheck({ root, quiet: true });
      assert.equal(omissions.exitCode, 0);
      assert.deepEqual(omissions.record.counts, {
        selected: 3,
        completed: 1,
        passed: 1,
        failed: 0,
        skipped: 1,
        todo: 1,
      });
      assert.equal(stateOf(omissions.record).completeness, 'partial');
      await configure(['tests/missing.test.js']);
      const zero = await runCheck({ root, quiet: true });
      assert.notEqual(stateOf(zero.record).outcome, 'passed');
      assert.equal(zero.record.counts.completed, 0);
      await configure(['tests/global-error.test.js']);
      const global = await runCheck({ root, quiet: true });
      assert.notEqual(global.exitCode, 0);
      assert.equal(stateOf(global.record).outcome, 'failed');
      assert.ok(
        global.record.runner.globalErrors > 0 ||
          global.record.runner.success === false,
      );
      await configure(['tests/unhandled.test.js']);
      await fsp.writeFile(
        path.join(root, 'vitest.config.js'),
        'export default {test:{dangerouslyIgnoreUnhandledErrors:true}};\n',
      );
      const unhandled = await runCheck({ root, quiet: true });
      assert.equal(unhandled.record.counts.passed, 1);
      assert.ok(unhandled.record.runner.globalErrors > 0);
      assert.equal(stateOf(unhandled.record).outcome, 'failed');
      await configure();
      await fsp.writeFile(
        path.join(root, 'vitest.config.js'),
        "export default {test:{globalSetup:['./tests/exit-code.setup.js']}};\n",
      );
      const disagreement = await runCheck({ root, quiet: true });
      assert.equal(disagreement.record.runner.success, true);
      assert.equal(disagreement.record.process.exitCode, 9);
      assert.equal(stateOf(disagreement.record).outcome, 'failed');
      await fsp.writeFile(
        path.join(root, 'vitest.config.js'),
        "export default {test:{globalSetup:['./tests/corrupt-report.setup.js']}};\n",
      );
      const corrupt = await runCheck({ root, quiet: true });
      assert.equal(corrupt.exitCode, 0);
      assert.equal(corrupt.record.runner.reportPresent, false);
      assert.equal(stateOf(corrupt.record).outcome, 'unknown');
      await fsp.writeFile(
        path.join(root, 'vitest.config.js'),
        "export default {test:{globalSetup:['./tests/bad-counts.setup.js']}};\n",
      );
      const badCounts = await runCheck({ root, quiet: true });
      assert.equal(badCounts.exitCode, 0);
      assert.equal(badCounts.record.runner.reportPresent, false);
      assert.equal(stateOf(badCounts.record).outcome, 'unknown');
      await fsp.unlink(path.join(root, 'vitest.config.js'));
      // A leftover passing artifact outside the newly allocated run can never be reused.
      const leftover = randomUUID();
      const leftoverDir = path.join(root, '.ernesto/runs', leftover);
      await fsp.mkdir(leftoverDir);
      await fsp.writeFile(
        path.join(leftoverDir, 'report.json'),
        JSON.stringify({ success: true }),
      );
      await configure(['tests/missing.test.js']);
      const missing = await runCheck({ root, quiet: true });
      assert.notEqual(missing.record.runId, leftover);
      assert.notEqual(stateOf(missing.record).outcome, 'passed');
      await fsp.unlink(path.join(leftoverDir, 'report.json'));
      await fsp.rmdir(leftoverDir);
      await configure();
      const concurrent = await Promise.all([
        runCheck({ root, quiet: true }),
        runCheck({ root, quiet: true }),
      ]);
      assert.notEqual(concurrent[0].record.runId, concurrent[1].record.runId);
      assert.equal(stateOf(concurrent[0].record).outcome, 'passed');
      assert.equal(stateOf(concurrent[1].record).outcome, 'passed');
      await configure(['tests/slow.test.js']);
      const helper = fileURLToPath(
        new URL('../integrations/vitest/run.mjs', import.meta.url),
      );
      const before = new Set(
        await fsp.readdir(path.join(root, '.ernesto/runs')),
      );
      const child = spawn(process.execPath, [helper, root], {
        stdio: 'ignore',
        shell: false,
      });
      let freshId;
      for (let i = 0; i < 100; i++) {
        const ids = await fsp.readdir(path.join(root, '.ernesto/runs'));
        freshId = ids.find((id) => !before.has(id));
        if (freshId) {
          try {
            await fsp.stat(
              path.join(root, '.ernesto/runs', freshId, 'started.json'),
            );
            break;
          } catch {}
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.ok(freshId);
      await new Promise((r) => setTimeout(r, 500));
      const finished = new Promise((resolve) =>
        child.once('exit', (code, signal) => resolve({ code, signal })),
      );
      child.kill('SIGINT');
      const exit = await finished;
      assert.notEqual(exit.code, 0);
      const interrupted = JSON.parse(
        await fsp.readFile(
          path.join(root, '.ernesto/runs', freshId, 'record.json'),
          'utf8',
        ),
      );
      assert.equal(interrupted.process.interrupted, true);
      assert.ok(
        interrupted.process.signal !== null ||
          interrupted.process.exitCode !== null,
      );
      assert.equal(stateOf(interrupted).outcome, 'unknown');
      for (const id of await fsp.readdir(path.join(root, '.ernesto/runs'))) {
        const names = await fsp.readdir(path.join(root, '.ernesto/runs', id));
        assert.ok(
          names.every((n) => n === 'started.json' || n === 'record.json'),
        );
      }
      console.log(
        'Observed Vitest ' +
          SUPPORTED_VITEST_VERSION +
          ': pass → matched → edit/stale → real failure; skipped/todo, zero, collection/unhandled errors, real mutation/edit-revert, interleaved output, actual process/report disagreement, corrupt status, concurrent runs, leftover report, interruption.',
      );
    } finally {
      try {
        await fsp.unlink(path.join(root, 'vitest.config.js'));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      await fsp.writeFile(source, originalSource);
      await configure();
    }
  },
);
test('JSON reporter shape is validated before conversion', () => {
  for (const report of [
    '{',
    '{}',
    JSON.stringify({
      success: true,
      testResults: [{ assertionResults: [{ status: 'injected' }] }],
    }),
  ])
    assert.throws(() => parseVitestReport(report));
  const valid = {
    success: true,
    testResults: [
      { status: 'passed', assertionResults: [{ status: 'passed' }] },
    ],
    numTotalTests: 1,
    numPassedTests: 1,
    numFailedTests: 0,
    numPendingTests: 0,
    numTodoTests: 0,
  };
  assert.equal(parseVitestReport(JSON.stringify(valid)).counts.completed, 1);
  assert.throws(() =>
    parseVitestReport(JSON.stringify({ ...valid, numTotalTests: 2 })),
  );
});
test('real filesystem refuses link escape and reviewed data runtime/options', async () => {
  const fs = await nodeFilesystem(root);
  const link = path.join(root, 'src/escape');
  try {
    await fsp.symlink('../..', link);
    assert.equal((await fs.stat('src/escape')).kind, 'symlink');
    await assert.rejects(() => fs.read('src/escape/package.json'));
    await assert.rejects(() => fs.read('../package.json'));
  } finally {
    await fsp.unlink(link);
  }
  await assert.rejects(() => pruneEvidence(fs, { maxRuns: 100 }));
});
test('retention caps valid summaries while preserving unfamiliar files and run directories', async () => {
  const sandbox = fileURLToPath(
    new URL('../.agent-cache/evidence-retention/', import.meta.url),
  );
  await fsp.mkdir(path.join(sandbox, '.ernesto/runs'), { recursive: true });
  const { validRecord } = await import('./helpers/evidence-fixture.mjs');
  const r = await validRecord();
  const ids = [
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555555',
  ];
  try {
    for (let i = 0; i < ids.length; i++) {
      const dir = path.join(sandbox, '.ernesto/runs', ids[i]);
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(
        path.join(dir, 'record.json'),
        JSON.stringify({
          ...r,
          runId: ids[i],
          endedAt: 12 + i,
          endSnapshot: { ...r.endSnapshot, observedAt: 12 + i },
        }),
      );
    }
    await fsp.writeFile(
      path.join(sandbox, '.ernesto/runs', ids[0], 'unfamiliar.txt'),
      'Synthetic sentinel',
    );
    const fs = await nodeFilesystem(sandbox);
    await pruneEvidence(fs, { now: 100, maxRuns: 1 });
    assert.deepEqual(
      (await fsp.readdir(path.join(sandbox, '.ernesto/runs'))).sort(),
      [ids[0], ids[2]],
    );
    assert.equal(
      await fsp.readFile(
        path.join(sandbox, '.ernesto/runs', ids[0], 'unfamiliar.txt'),
        'utf8',
      ),
      'Synthetic sentinel',
    );
  } finally {
    for (const id of ids) {
      const dir = path.join(sandbox, '.ernesto/runs', id);
      try {
        for (const file of ['record.json', 'unfamiliar.txt'])
          try {
            await fsp.unlink(path.join(dir, file));
          } catch (e) {
            if (e.code !== 'ENOENT') throw e;
          }
        await fsp.rmdir(dir);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
  }
});
