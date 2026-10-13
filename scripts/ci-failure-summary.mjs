import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const stages = [
  'dependencies',
  'fixture_dependencies',
  'format',
  'tests',
  'fixture_clean',
  'host',
  'validate',
  'audit',
  'package',
  'whitespace',
];
const outcomes = new Set(['success', 'failure', 'cancelled', 'skipped']);
const version = (value) =>
  typeof value === 'string' &&
  value.length <= 64 &&
  /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value)
    ? value
    : 'unknown';

export function failureSummary(env, nodeVersion, pins = {}) {
  return {
    schemaVersion: 1,
    sourceCommit: /^[a-f0-9]{40}$/.test(env.CI_SOURCE_SHA ?? '')
      ? env.CI_SOURCE_SHA
      : null,
    event: ['push', 'pull_request'].includes(env.CI_EVENT)
      ? env.CI_EVENT
      : 'unknown',
    versions: {
      node: version(nodeVersion),
      claudeCodePin: version(pins['@anthropic-ai/claude-code']),
      vitestPin: version(pins.vitest),
    },
    stages: Object.fromEntries(
      stages.map((stage) => {
        const value = env[`CI_${stage.toUpperCase()}_OUTCOME`];
        return [stage, outcomes.has(value) ? value : 'not_run'];
      }),
    ),
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let pins = {};
  try {
    pins =
      JSON.parse(readFileSync('package.json', 'utf8')).devDependencies ?? {};
  } catch {
    /* Unknown versions remain explicit if dependency metadata is unavailable. */
  }
  const output = resolve('.agent-cache/ci-failure');
  mkdirSync(output, { recursive: true });
  writeFileSync(
    resolve(output, 'summary.json'),
    `${JSON.stringify(failureSummary(process.env, process.versions.node, pins), null, 2)}\n`,
  );
}
