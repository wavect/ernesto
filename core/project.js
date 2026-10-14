import { safeText } from './companion.js';
import { snapshotsMatch } from './snapshot.js';

const PRIORITY = [
  'test:ci',
  'test',
  'check:all',
  'verify:all',
  'check',
  'verify',
  'lint',
];
const scriptName = (name) =>
  /^(?:test|check|verify|lint)(?::[a-z0-9_-]+)*$/i.test(name) &&
  !/(?:^|:)(?:watch|dev|fix)(?:$|:)/i.test(name);
export function detectProject(
  packageText,
  entries,
  vitestVersion,
  pluginRoot,
  configured = false,
) {
  if (!Array.isArray(entries) || entries.length > 512) return null;
  let pkg;
  if (packageText != null) {
    if (typeof packageText !== 'string' || packageText.length > 65536)
      throw Error('Project manifest is too large');
    try {
      pkg = JSON.parse(packageText);
    } catch {
      throw Error('Project package.json needs valid JSON');
    }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg))
      throw Error('Project package.json needs an object');
  }
  const detailed = {
    kind: 'vitest',
    label: 'Vitest project tests',
    argv: ['node', pluginRoot + '/integrations/vitest/run.mjs', '--init'],
  };
  if (configured && vitestVersion === '4.1.11') return detailed;
  const scripts = pkg?.scripts;
  if (scripts && typeof scripts === 'object' && !Array.isArray(scripts)) {
    const names = Object.keys(scripts).filter(
      (name) =>
        scriptName(name) &&
        typeof scripts[name] === 'string' &&
        scripts[name].length > 0 &&
        scripts[name].length <= 8192 &&
        !/no test specified|(?:^|\s)--watch(?:\s|=|$)/i.test(scripts[name]),
    );
    const name = PRIORITY.find((n) => names.includes(n)) || names.sort()[0];
    if (name) {
      const declared = /^(npm|pnpm|yarn|bun)@[^\s]+$/.exec(
        pkg.packageManager || '',
      )?.[1];
      const files = new Set(
        entries
          .filter((e) => e.kind === 'file' && !e.isLink)
          .map((e) => e.name),
      );
      const manager =
        declared ||
        (files.has('pnpm-lock.yaml')
          ? 'pnpm'
          : files.has('yarn.lock')
            ? 'yarn'
            : files.has('bun.lock') || files.has('bun.lockb')
              ? 'bun'
              : 'npm');
      return {
        kind: 'command',
        label: `${manager} run ${name}`,
        argv: [manager, 'run', name],
      };
    }
  }
  if (vitestVersion === '4.1.11') return detailed;
  return null;
}
export function commandSummary(run) {
  const result =
    run.status === 'running'
      ? 'running'
      : run.status === 'completed'
        ? 'completed (exit 0)'
        : run.status === 'failed'
          ? `failed (exit ${run.exitCode})`
          : 'unknown';
  return `Project command: ${result} · inputs ${run.freshness || 'unknown'}`;
}
export function commandDetails(run, expanded = false) {
  return [
    commandSummary(run),
    'Command: ' + safeText(run.label),
    'Test counts and coverage: not verified. Command success alone does not verify test results.',
    'Input scope: ' +
      (run.scope ? 'bounded project inputs' : 'unavailable') +
      ', not the full project or business acceptance.',
    expanded && run.scope
      ? 'Inputs: ' + run.scope.roots.map((x) => safeText(x)).join(', ')
      : '',
    expanded && run.endSnapshot
      ? 'Excluded: ' +
        run.endSnapshot.exclusions.map((x) => safeText(x)).join(', ')
      : '',
    run.reason || '',
    run.endedAt != null
      ? 'Finished: ' + new Date(run.endedAt).toISOString()
      : '',
    'This command result is kept for the current session only.',
  ]
    .filter(Boolean)
    .join('\n');
}
export function compareCommand(run, snapshot, epoch) {
  const known =
    !run.observationGap &&
    run.startSnapshot &&
    run.endSnapshot &&
    snapshotsMatch(run.startSnapshot, run.endSnapshot) &&
    run.startEpoch === run.endEpoch;
  const freshness =
    !known || !snapshot?.complete
      ? 'unknown'
      : !snapshotsMatch(run.endSnapshot, snapshot)
        ? 'stale'
        : epoch !== run.endEpoch
          ? 'unknown'
          : 'matched';
  return { ...run, freshness };
}
export function outputPreview(result) {
  return [result?.stdout, result?.stderr]
    .filter((x) => typeof x === 'string')
    .join('\n')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(
      /[\x00-\x08\x0b-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
      '',
    )
    .slice(-4000);
}
