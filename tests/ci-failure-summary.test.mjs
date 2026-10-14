import test from 'node:test';
import assert from 'node:assert/strict';
import { failureSummary } from '../scripts/ci-failure-summary.mjs';

test('failure receipt preserves failed gates and distinguishes skipped or unrun checks', () => {
  const report = failureSummary(
    {
      CI_SOURCE_SHA: 'a'.repeat(40),
      CI_EVENT: 'pull_request',
      CI_TESTS_OUTCOME: 'failure',
      CI_HOST_OUTCOME: 'skipped',
    },
    '24.3.0',
    { '@anthropic-ai/claude-code': '2.1.296', vitest: '4.1.11' },
  );
  assert.equal(report.stages.tests, 'failure');
  assert.equal(report.stages.host, 'skipped');
  assert.equal(report.stages.validate, 'not_run');
  assert.deepEqual(report.versions, {
    node: '24.3.0',
    claudeCodePin: '2.1.296',
    vitestPin: '4.1.11',
  });
});

test('failure receipt cannot include raw logs, paths, tokens, names or arbitrary environment values', () => {
  const secret = 'private-token:/' + 'Users/example/client';
  const report = failureSummary(
    {
      CI_SOURCE_SHA: secret,
      CI_EVENT: secret,
      CI_TESTS_OUTCOME: secret,
      RAW_LOG: secret,
      TOKEN: secret,
    },
    secret,
    { '@anthropic-ai/claude-code': secret, vitest: secret },
  );
  assert.equal(report.sourceCommit, null);
  assert.equal(report.event, 'unknown');
  assert.equal(report.stages.tests, 'not_run');
  assert.ok(!JSON.stringify(report).includes(secret));
  assert.deepEqual(Object.keys(report), [
    'schemaVersion',
    'sourceCommit',
    'event',
    'versions',
    'stages',
  ]);
});

test('receipt rejects trailing line breaks and non-string metadata rather than preserving it', () => {
  for (const ending of ['\n', '\r', '\r\n', '\u2028']) {
    const report = failureSummary(
      { CI_SOURCE_SHA: 'a'.repeat(40) + ending },
      '24.3.0' + ending,
      { vitest: '4.1.11' + ending },
    );
    assert.equal(report.sourceCommit, null);
    assert.equal(report.versions.node, 'unknown');
    assert.equal(report.versions.vitestPin, 'unknown');
  }
  const report = failureSummary(
    { CI_SOURCE_SHA: { length: 40, toString: () => 'a'.repeat(40) } },
    { toString: () => '24.3.0' },
  );
  assert.equal(report.sourceCommit, null);
  assert.equal(report.versions.node, 'unknown');
});
