import { captureSnapshot } from '../../core/snapshot.js';
import { SUPPORTED_VITEST_VERSION } from '../../core/evidence.js';
export const config = {
  version: 1,
  checkId: 'vitest',
  scope: {
    roots: [
      'src',
      'tests',
      'package.json',
      'package-lock.json',
      'vitest.config.js',
    ],
    excludes: [],
  },
  filters: [],
  runtimeDescriptor: 'node-24/vitest-' + SUPPORTED_VITEST_VERSION,
};
export function memoryFS(files = {}, root = '/synthetic/worktree') {
  return {
    canonicalRoot: async () => root,
    async stat(p) {
      if (files[p]?.kind) return files[p];
      if (typeof files[p] === 'string')
        return { kind: 'file', size: Buffer.byteLength(files[p]) };
      if (Object.keys(files).some((x) => x.startsWith(p + '/')))
        return { kind: 'directory', size: 0 };
      return null;
    },
    async list(p) {
      return [
        ...new Set(
          Object.keys(files)
            .filter((x) => x.startsWith(p + '/'))
            .map((x) => x.slice(p.length + 1).split('/')[0]),
        ),
      ];
    },
    async read(p) {
      if (files[p] === 'DENY') throw Error('Denied');
      return new TextEncoder().encode(files[p]);
    },
  };
}
export async function snap(
  files = { 'src/a.js': 'export const a=1;' },
  extra = {},
) {
  return captureSnapshot({
    root: 'ignored',
    scope: config.scope,
    runtime: config.runtimeDescriptor,
    checkDefinition: config,
    fs: memoryFS(files),
    now: 10,
    ...extra,
  });
}
export async function validRecord(overrides = {}) {
  const a = await snap();
  return {
    schemaVersion: 1,
    reducerVersion: 1,
    runId: '11111111-1111-4111-8111-111111111111',
    workspaceId: a.workspaceId,
    checkId: 'vitest',
    configHash: a.configHash,
    integration: {
      name: 'vitest',
      version: 1,
      runnerVersion: SUPPORTED_VITEST_VERSION,
    },
    startedAt: 11,
    endedAt: 12,
    process: { exitCode: 0, signal: null, interrupted: false },
    scope: { kind: 'suite', filters: [] },
    counts: {
      selected: 1,
      completed: 1,
      passed: 1,
      failed: 0,
      skipped: 0,
      todo: 0,
    },
    runner: { reportPresent: true, success: true, globalErrors: 0 },
    startSnapshot: a,
    endSnapshot: { ...a, observedAt: 12 },
    observation: { startEpoch: 0, endEpoch: 0, gap: false },
    provenance: { source: 'explicit-local-helper', endpointOnly: true },
    ...overrides,
  };
}
