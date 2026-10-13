import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  captureSnapshot,
  sha256,
  snapshotsMatch,
  excludedPath,
  safeRelative,
} from '../core/snapshot.js';
import {
  parseEvidence,
  initialEvidence,
  reduceEvidence,
  parseCheckConfig,
  parseRunStart,
  evidenceRecordPath,
  SUPPORTED_VITEST_VERSION,
  ingestEvidence,
} from '../core/evidence.js';
import {
  config,
  memoryFS,
  snap,
  validRecord,
} from './helpers/evidence-fixture.mjs';
const derive = (r) =>
  reduceEvidence(initialEvidence(), {
    type: 'record',
    text: JSON.stringify(r),
  });
test('SHA256 is interoperable over UTF8 and binary multi-block vectors', () => {
  for (const value of [
    '',
    'abc',
    '😀',
    'x'.repeat(10000),
    new Uint8Array([0, 255, 128]),
  ])
    assert.equal(
      sha256(value),
      createHash('sha256').update(value).digest('hex'),
    );
});
test('strict identity, version, parser and record bounds reject hostile records', async () => {
  const r = await validRecord();
  assert.equal(
    parseEvidence(JSON.stringify(r)).integrity,
    'validated_local_record',
  );
  for (const patch of [
    { schemaVersion: 2 },
    { integration: { ...r.integration, runnerVersion: '99' } },
  ])
    assert.equal(
      parseEvidence(JSON.stringify({ ...r, ...patch })).integrity,
      'unsupported',
    );
  for (const counts of [
    { ...r.counts, passed: -1 },
    { ...r.counts, selected: 1.5 },
    { ...r.counts, selected: Number.MAX_SAFE_INTEGER },
    { ...r.counts, completed: 2 },
    { ...r.counts, todo: 1 },
  ])
    assert.equal(
      parseEvidence(JSON.stringify({ ...r, counts })).integrity,
      'invalid',
    );
  for (const text of [
    '{"schemaVersion":1',
    JSON.stringify({ ...r, extra: 'unexpected' }),
    ' '.repeat(32769),
    '{"__proto__":{}}',
    JSON.stringify({
      a: {
        a: {
          a: {
            a: {
              a: {
                a: { a: { a: { a: { a: { a: { a: { a: { a: 1 } } } } } } } },
              },
            },
          },
        },
      },
    }),
  ])
    assert.notEqual(parseEvidence(text).integrity, 'validated_local_record');
  for (const key of ['workspaceId', 'checkId', 'configHash', 'runId'])
    assert.equal(
      parseEvidence(JSON.stringify(r), { [key]: 'wrong' }).integrity,
      'invalid',
    );
});
test('absence of supported structured execution never passes, independently of successful exit', async () => {
  const r = await validRecord();
  for (const patch of [
    {
      runner: { reportPresent: false, success: null, globalErrors: 0 },
      counts: {
        selected: 0,
        completed: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        todo: 0,
      },
    },
    { process: { exitCode: 3, signal: null, interrupted: false } },
    { process: { exitCode: null, signal: 'SIGINT', interrupted: true } },
    { runner: { reportPresent: true, success: true, globalErrors: 1 } },
    {
      counts: {
        selected: 0,
        completed: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        todo: 0,
      },
    },
  ])
    assert.notEqual(derive({ ...r, ...patch }).outcome, 'passed');
  assert.equal(
    reduceEvidence(initialEvidence(), {
      type: 'assistant',
      text: 'all tests passed',
    }).outcome,
    'not_run',
  );
  assert.equal(
    reduceEvidence(initialEvidence(), { type: 'shell', exit: 0 }).outcome,
    'not_run',
  );
});
test('pass, omissions, filter, freshness and failure are independent', async () => {
  const r = await validRecord();
  let state = derive(r);
  assert.equal(state.outcome, 'passed');
  assert.equal(state.freshness, 'checking');
  state = reduceEvidence(state, { type: 'compare', snapshot: r.endSnapshot });
  assert.equal(state.freshness, 'matched');
  assert.equal(state.lastComparedAt, 12);
  const changed = await snap({ 'src/a.js': 'changed' }, { now: 20 });
  assert.equal(
    reduceEvidence(state, { type: 'compare', snapshot: changed }).freshness,
    'stale',
  );
  assert.equal(reduceEvidence(state, { type: 'gap' }).freshness, 'unknown');
  const fail = derive({
    ...r,
    counts: {
      selected: 1,
      completed: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      todo: 0,
    },
    runner: { reportPresent: true, success: false, globalErrors: 0 },
    process: { exitCode: 1, signal: null, interrupted: false },
  });
  assert.equal(
    reduceEvidence(fail, { type: 'compare', snapshot: changed }).outcome,
    'failed',
  );
  const omissions = derive({
    ...r,
    counts: {
      selected: 3,
      completed: 1,
      passed: 1,
      failed: 0,
      skipped: 1,
      todo: 1,
    },
  });
  assert.equal(omissions.outcome, 'passed');
  assert.equal(omissions.completeness, 'partial');
  assert.equal(
    derive({ ...r, scope: { kind: 'filtered', filters: ['tests/a.test.js'] } })
      .completeness,
    'complete',
  );
});
test('known edit/revert, changed endpoints, observation gaps prevent accepted passing confidence', async () => {
  const r = await validRecord();
  for (const patch of [
    {
      endSnapshot: { ...r.endSnapshot, epoch: 1 },
      observation: { startEpoch: 0, endEpoch: 1, gap: false },
    },
    { endSnapshot: { ...r.endSnapshot, digest: 'a'.repeat(64) } },
    { observation: { startEpoch: 0, endEpoch: 0, gap: true } },
    {
      endSnapshot: {
        ...r.endSnapshot,
        complete: false,
        reasons: ['read_failed'],
      },
    },
  ]) {
    const state = derive({ ...r, ...patch });
    assert.notEqual(state.outcome, 'passed');
    assert.equal(
      reduceEvidence(state, { type: 'compare', snapshot: r.endSnapshot })
        .freshness,
      'unknown',
    );
  }
});
test('newest failure wins over older completion; duplicates are idempotent; pending newer check wins', async () => {
  const r = await validRecord();
  let state = derive({
    ...r,
    startedAt: 20,
    endedAt: 21,
    endSnapshot: { ...r.endSnapshot, observedAt: 21 },
    runId: '22222222-2222-4222-8222-222222222222',
    process: { exitCode: 1, signal: null, interrupted: false },
    runner: { reportPresent: true, success: false, globalErrors: 0 },
  });
  assert.strictEqual(
    reduceEvidence(state, { type: 'record', text: JSON.stringify(r) }),
    state,
  );
  assert.strictEqual(
    reduceEvidence(state, {
      type: 'record',
      text: JSON.stringify(state.record),
    }),
    state,
  );
  state = reduceEvidence(state, {
    type: 'started',
    start: {
      version: 1,
      runId: r.runId,
      workspaceId: r.workspaceId,
      checkId: r.checkId,
      configHash: r.configHash,
      startedAt: 30,
    },
  });
  assert.equal(state.outcome, 'running');
  assert.strictEqual(
    reduceEvidence(state, { type: 'record', text: JSON.stringify(r) }),
    state,
  );
});
test('snapshots include dirty/new/deleted/renamed/case-sensitive/config/runtime and scope bytes', async () => {
  const base = {
    'src/a.js': 'one',
    'src/A.js': 'two',
    'package.json': '{}',
    'package-lock.json': '{}',
    'vitest.config.js': '{}',
  };
  const a = await snap(base);
  for (const changed of [
    { ...base, 'src/a.js': 'dirty' },
    { ...base, 'src/new.js': 'untracked' },
    { ...base, 'src/a.js': undefined },
    { ...base, 'src/new.js': 'one', 'src/a.js': undefined },
    { ...base, 'package-lock.json': 'changed' },
    { ...base, 'vitest.config.js': 'changed' },
  ]) {
    for (const k of Object.keys(changed))
      if (changed[k] === undefined) delete changed[k];
    assert.equal(snapshotsMatch(a, await snap(changed)), false);
  }
  assert.equal(a.files, 5);
  assert.equal(
    snapshotsMatch(a, await snap(base, { runtime: 'changed' })),
    false,
  );
  assert.equal(
    snapshotsMatch(
      a,
      await snap(base, {
        checkDefinition: { ...config, filters: ['tests/a.js'] },
      }),
    ),
    false,
  );
  assert.equal(
    snapshotsMatch(
      a,
      await snap(base, { scope: { ...config.scope, excludes: ['src/A.js'] } }),
    ),
    false,
  );
  assert.equal(
    snapshotsMatch(
      a,
      await snap(base, { fs: memoryFS(base, '/different/worktree') }),
    ),
    false,
  );
});
test('secret/dependency outputs excluded; unsafe traversal/symlinks/limits/denied reads incomplete', async () => {
  for (const p of [
    '.env',
    '.env.local',
    'src/secrets/a',
    'src/id_ed25519',
    'src/key.pem',
    'node_modules/a',
    '.ernesto/runs/x',
  ])
    assert.equal(excludedPath(p), true);
  for (const p of [
    '../x',
    '/tmp/x',
    'https://evil/x',
    'a\\b',
    'a/../b',
    'a\u0000b',
    'a\u202eb',
    'a\u2066b',
    'a\u061cb',
  ])
    assert.equal(safeRelative(p), false);
  const base = { 'src/a.js': 'one' };
  const a = await snap(base);
  assert.equal(
    snapshotsMatch(
      a,
      await snap({ ...base, 'src/.env': 'SECRET', 'src/key.pem': 'SECRET' }),
    ),
    true,
  );
  for (const files of [
    { 'src/link': { kind: 'symlink', size: 0 } },
    { 'src/submodule': { kind: 'submodule', size: 0 } },
    { 'src/a.js': 'DENY' },
  ])
    assert.equal((await snap(files)).complete, false);
  assert.equal((await snap(base, { maxFileBytes: 1 })).complete, false);
  assert.equal((await snap(base, { maxFiles: 0 })).complete, false);
});
test('config, start and owned artifact ingestion are bounded and scoped', async () => {
  assert.deepEqual(parseCheckConfig(JSON.stringify(config)), config);
  assert.throws(() => parseCheckConfig('{}'));
  const r = await validRecord();
  const s = {
    version: 1,
    runId: r.runId,
    workspaceId: r.workspaceId,
    checkId: r.checkId,
    configHash: r.configHash,
    startedAt: r.startedAt,
  };
  assert.ok(parseRunStart(JSON.stringify(s), s));
  assert.equal(
    parseRunStart(JSON.stringify({ ...s, runId: '../escape' })),
    null,
  );
  assert.throws(() => evidenceRecordPath('../escape'));
  const fs = memoryFS({ [evidenceRecordPath(r.runId)]: JSON.stringify(r) });
  assert.equal(
    (await ingestEvidence({ fs, runId: r.runId, expected: s })).outcome,
    'passed',
  );
  assert.equal(
    (
      await ingestEvidence({
        fs,
        runId: r.runId,
        expected: { workspaceId: 'wrong' },
      })
    ).outcome,
    'unknown',
  );
});

test('combinatorial pass invariant over process, runner, execution and observation states', async () => {
  const base = await validRecord();
  for (const exitCode of [0, 1, null])
    for (const success of [true, false, null])
      for (const reportPresent of [true, false])
        for (const globalErrors of [0, 1])
          for (const completed of [0, 1])
            for (const gap of [false, true]) {
              const r = {
                ...base,
                process: { exitCode, signal: null, interrupted: false },
                runner: { reportPresent, success, globalErrors },
                counts: {
                  selected: completed,
                  completed,
                  passed: completed,
                  failed: 0,
                  skipped: 0,
                  todo: 0,
                },
                observation: { startEpoch: 0, endEpoch: 0, gap },
              };
              const state = derive(r);
              if (state.outcome === 'passed') {
                assert.equal(exitCode, 0);
                assert.equal(success, true);
                assert.equal(reportPresent, true);
                assert.equal(globalErrors, 0);
                assert.equal(completed, 1);
                assert.equal(gap, false);
                assert.equal(state.integrity, 'validated_local_record');
              }
            }
});
