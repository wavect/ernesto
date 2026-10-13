import { safeRelative, snapshotsMatch } from './snapshot.js';
export const EVIDENCE_VERSION = 1;
export const REDUCER_VERSION = 1;
export const SUPPORTED_VITEST_VERSION = '4.1.11';
export const MAX_RECORD_BYTES = 32768;
const hex = (x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const integer = (x) =>
  Number.isSafeInteger(x) && x >= 0 && x <= 100000000000000;
const count = (x) => integer(x) && x <= 1000000;
const label = (x) =>
  typeof x === 'string' &&
  x.length <= 128 &&
  !/[\x00-\x1f\x7f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(x);
const run = (x) =>
  typeof x === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    x,
  );
const exact = (o, keys) =>
  o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.keys(o).sort().join('|') === keys.sort().join('|');
function boundedShape(value, depth = 0) {
  if (depth > 12) return false;
  if (typeof value === 'string')
    return (
      value.length <= 1024 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)
    );
  if (value && typeof value === 'object')
    return (
      Object.keys(value).length <= 128 &&
      Object.keys(value).every(
        (k) =>
          !['__proto__', 'prototype', 'constructor'].includes(k) &&
          boundedShape(value[k], depth + 1),
      )
    );
  return value === null || ['number', 'boolean'].includes(typeof value);
}
function validSnapshot(s) {
  return (
    exact(s, [
      'version',
      'algorithm',
      'workspaceId',
      'policyHash',
      'configHash',
      'runtime',
      'digest',
      'fileSetDigest',
      'files',
      'bytes',
      'complete',
      'exclusions',
      'reasons',
      'observedAt',
      'epoch',
      'observationGap',
    ]) &&
    s.version === 1 &&
    s.algorithm === 'sha256-v1' &&
    [
      'workspaceId',
      'policyHash',
      'configHash',
      'digest',
      'fileSetDigest',
    ].every((k) => hex(s[k])) &&
    label(s.runtime) &&
    count(s.files) &&
    integer(s.bytes) &&
    typeof s.complete === 'boolean' &&
    typeof s.observationGap === 'boolean' &&
    integer(s.observedAt) &&
    integer(s.epoch) &&
    Array.isArray(s.exclusions) &&
    s.exclusions.length <= 128 &&
    s.exclusions.every(label) &&
    Array.isArray(s.reasons) &&
    s.reasons.length <= 16 &&
    s.reasons.every(label) &&
    s.complete === (s.reasons.length === 0) &&
    (!s.complete || s.files > 0)
  );
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export function parseEvidence(text, expected = {}) {
  const invalid = (reason) => ({ integrity: 'invalid', reason });
  if (
    typeof text !== 'string' ||
    new TextEncoder().encode(text).length > MAX_RECORD_BYTES
  )
    return invalid('record_size');
  let v;
  try {
    v = JSON.parse(text);
  } catch {
    return invalid('malformed_json');
  }
  if (!boundedShape(v)) return invalid('unsafe_shape');
  if (
    v?.schemaVersion !== 1 ||
    v?.reducerVersion !== 1 ||
    v?.integration?.version !== 1 ||
    v?.integration?.runnerVersion !== SUPPORTED_VITEST_VERSION
  )
    return { integrity: 'unsupported', reason: 'unsupported_version' };
  if (
    !exact(v, [
      'schemaVersion',
      'reducerVersion',
      'runId',
      'workspaceId',
      'checkId',
      'configHash',
      'integration',
      'startedAt',
      'endedAt',
      'process',
      'scope',
      'counts',
      'runner',
      'startSnapshot',
      'endSnapshot',
      'observation',
      'provenance',
    ])
  )
    return invalid('record_shape');
  if (
    !run(v.runId) ||
    !hex(v.workspaceId) ||
    !hex(v.configHash) ||
    typeof v.checkId !== 'string' ||
    !/^[-a-z0-9]{1,64}$/.test(v.checkId) ||
    !integer(v.startedAt) ||
    !integer(v.endedAt) ||
    v.endedAt < v.startedAt
  )
    return invalid('identity_or_time');
  if (
    !exact(v.integration, ['name', 'version', 'runnerVersion']) ||
    v.integration.name !== 'vitest' ||
    !exact(v.process, ['exitCode', 'signal', 'interrupted']) ||
    typeof v.process.interrupted !== 'boolean' ||
    !(v.process.exitCode === null || count(v.process.exitCode)) ||
    !(
      v.process.signal === null ||
      [
        'SIGINT',
        'SIGTERM',
        'SIGKILL',
        'SIGHUP',
        'SIGABRT',
        'SIGSEGV',
        'OTHER',
      ].includes(v.process.signal)
    ) ||
    (v.process.exitCode !== null && v.process.signal !== null)
  )
    return invalid('process');
  if (
    !exact(v.scope, ['kind', 'filters']) ||
    !['suite', 'filtered'].includes(v.scope.kind) ||
    !Array.isArray(v.scope.filters) ||
    v.scope.filters.length > 32 ||
    !v.scope.filters.every((x) => safeRelative(x) && !x.startsWith('-')) ||
    (v.scope.kind === 'suite') !== (v.scope.filters.length === 0)
  )
    return invalid('scope');
  if (
    !exact(v.counts, [
      'selected',
      'completed',
      'passed',
      'failed',
      'skipped',
      'todo',
    ]) ||
    !Object.values(v.counts).every(count) ||
    v.counts.completed !== v.counts.passed + v.counts.failed ||
    v.counts.selected !== v.counts.completed + v.counts.skipped + v.counts.todo
  )
    return invalid('counts');
  if (
    !exact(v.runner, ['reportPresent', 'success', 'globalErrors']) ||
    typeof v.runner.reportPresent !== 'boolean' ||
    !(v.runner.success === null || typeof v.runner.success === 'boolean') ||
    !count(v.runner.globalErrors) ||
    (!v.runner.reportPresent &&
      (v.runner.success !== null || v.counts.selected !== 0))
  )
    return invalid('runner');
  if (
    !validSnapshot(v.startSnapshot) ||
    !validSnapshot(v.endSnapshot) ||
    !exact(v.observation, ['startEpoch', 'endEpoch', 'gap']) ||
    !integer(v.observation.startEpoch) ||
    !integer(v.observation.endEpoch) ||
    v.observation.endEpoch < v.observation.startEpoch ||
    typeof v.observation.gap !== 'boolean'
  )
    return invalid('snapshot');
  if (
    v.startSnapshot.workspaceId !== v.workspaceId ||
    v.endSnapshot.workspaceId !== v.workspaceId ||
    v.startSnapshot.configHash !== v.configHash ||
    v.startSnapshot.observedAt > v.startedAt ||
    v.endSnapshot.observedAt < v.endedAt ||
    v.observation.startEpoch !== v.startSnapshot.epoch ||
    v.observation.endEpoch !== v.endSnapshot.epoch
  )
    return invalid('snapshot_correlation');
  if (
    !exact(v.provenance, ['source', 'endpointOnly']) ||
    v.provenance.source !== 'explicit-local-helper' ||
    v.provenance.endpointOnly !== true
  )
    return invalid('provenance');
  for (const k of ['workspaceId', 'checkId', 'configHash', 'runId'])
    if (expected[k] !== undefined && expected[k] !== v[k])
      return invalid('correlation_' + k);
  return {
    integrity: 'validated_local_record',
    record: freeze(v),
    reason: null,
  };
}
export function initialEvidence() {
  return freeze({
    reducerVersion: 1,
    record: null,
    outcome: 'not_run',
    freshness: 'not_applicable',
    completeness: 'unknown',
    integrity: 'unsupported',
    reason: 'No supported check recorded',
    lastComparedAt: null,
  });
}
function derive(record) {
  const c = record.counts;
  const stable =
    snapshotsMatch(record.startSnapshot, record.endSnapshot) &&
    !record.observation.gap &&
    record.observation.startEpoch === record.observation.endEpoch;
  const failed =
    c.failed > 0 ||
    record.runner.globalErrors > 0 ||
    record.runner.success === false ||
    (record.process.exitCode !== null && record.process.exitCode !== 0);
  const passed =
    record.runner.reportPresent &&
    record.runner.success === true &&
    record.process.exitCode === 0 &&
    record.process.signal === null &&
    !record.process.interrupted &&
    c.completed > 0 &&
    c.failed === 0 &&
    record.runner.globalErrors === 0 &&
    stable;
  return {
    outcome:
      record.process.interrupted || record.process.signal !== null
        ? 'unknown'
        : failed
          ? 'failed'
          : passed
            ? 'passed'
            : 'unknown',
    completeness:
      c.selected > 0 &&
      c.skipped === 0 &&
      c.todo === 0 &&
      c.completed === c.selected &&
      record.runner.reportPresent &&
      record.runner.globalErrors === 0 &&
      record.process.signal === null &&
      !record.process.interrupted &&
      stable
        ? 'complete'
        : 'partial',
    reason:
      record.process.interrupted || record.process.signal
        ? 'Run interrupted'
        : !record.runner.reportPresent
          ? 'Missing structured runner report'
          : !stable
            ? 'Run inputs changed or observation incomplete'
            : c.completed === 0
              ? 'No meaningful tests executed'
              : c.skipped + c.todo > 0
                ? 'Some tests skipped or todo'
                : 'Recorded check scope',
  };
}
export function reduceEvidence(state = initialEvidence(), event) {
  if (event.type === 'clear') return initialEvidence();
  if (event.type === 'started') {
    const r = parseRunStart(JSON.stringify(event.start));
    if (!r || (state.record && r.startedAt <= state.record.startedAt))
      return state;
    return freeze({
      ...state,
      record: null,
      pendingRun: r,
      outcome: 'running',
      freshness: 'checking',
      completeness: 'unknown',
      reason: 'Explicit check is running',
    });
  }
  if (event.type === 'record') {
    const parsed = event.parsed || parseEvidence(event.text, event.expected);
    if (parsed.integrity !== 'validated_local_record')
      return freeze({
        ...state,
        outcome: 'unknown',
        freshness: 'unknown',
        completeness: 'unknown',
        integrity: parsed.integrity,
        reason: parsed.reason,
      });
    const r = parsed.record;
    if (state.pendingRun && r.startedAt < state.pendingRun.startedAt)
      return state;
    if (
      state.record &&
      (r.runId === state.record.runId ||
        r.startedAt < state.record.startedAt ||
        (r.startedAt === state.record.startedAt &&
          r.runId <= state.record.runId))
    )
      return state;
    return freeze({
      ...state,
      record: r,
      pendingRun: null,
      ...derive(r),
      freshness: 'checking',
      integrity: parsed.integrity,
      lastComparedAt: null,
    });
  }
  if (event.type === 'pending')
    return freeze({
      ...state,
      freshness: state.record ? 'checking' : 'not_applicable',
      reason: 'Comparing captured inputs',
    });
  if (event.type === 'gap')
    return freeze({
      ...state,
      freshness: state.record ? 'unknown' : 'not_applicable',
      reason: 'Observation interrupted; refresh required',
    });
  if (event.type === 'compare' && state.record) {
    const s = event.snapshot;
    const r = state.record;
    const known =
      s &&
      s.complete &&
      !s.observationGap &&
      !r.observation.gap &&
      r.observation.startEpoch === r.observation.endEpoch &&
      snapshotsMatch(r.startSnapshot, r.endSnapshot);
    return freeze({
      ...state,
      freshness: !known
        ? 'unknown'
        : snapshotsMatch(r.endSnapshot, s)
          ? 'matched'
          : 'stale',
      lastComparedAt: s?.observedAt ?? null,
      reason: !known
        ? 'Could not verify captured inputs'
        : snapshotsMatch(r.endSnapshot, s)
          ? 'Snapshot matched at recorded comparison time'
          : 'Changed since this check',
    });
  }
  return state;
}
export function evidenceRecordPath(runId) {
  if (!run(runId)) throw Error('Invalid run identifier');
  return '.ernesto/runs/' + runId + '/record.json';
}
export async function ingestEvidence({ fs, runId, expected, state }) {
  const path = evidenceRecordPath(runId);
  try {
    const info = await fs.stat(path);
    if (!info || info.kind !== 'file' || info.size > MAX_RECORD_BYTES)
      return reduceEvidence(state, {
        type: 'record',
        parsed: { integrity: 'invalid', reason: 'missing_or_unsafe_record' },
      });
    const bytes = await fs.read(path);
    if (!(bytes instanceof Uint8Array) || bytes.length > MAX_RECORD_BYTES)
      throw Error('Unsafe record');
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return reduceEvidence(state, {
      type: 'record',
      text,
      expected: { ...expected, runId },
    });
  } catch {
    return reduceEvidence(state, {
      type: 'record',
      parsed: { integrity: 'invalid', reason: 'record_read_failed' },
    });
  }
}
export function parseCheckConfig(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 8192)
    throw Error('Invalid configuration size');
  let c;
  try {
    c = JSON.parse(text);
  } catch {
    throw Error('Invalid configuration JSON');
  }
  if (
    !boundedShape(c) ||
    !exact(c, [
      'version',
      'checkId',
      'scope',
      'filters',
      'runtimeDescriptor',
    ]) ||
    c.version !== 1 ||
    !/^[-a-z0-9]{1,64}$/.test(c.checkId) ||
    !exact(c.scope, ['roots', 'excludes']) ||
    !Array.isArray(c.scope.roots) ||
    c.scope.roots.length === 0 ||
    c.scope.roots.length > 64 ||
    !c.scope.roots.every(safeRelative) ||
    !Array.isArray(c.scope.excludes) ||
    c.scope.excludes.length > 64 ||
    !c.scope.excludes.every(safeRelative) ||
    !Array.isArray(c.filters) ||
    c.filters.length > 32 ||
    !c.filters.every((x) => safeRelative(x) && !x.startsWith('-')) ||
    c.runtimeDescriptor !== 'node-24/vitest-' + SUPPORTED_VITEST_VERSION
  )
    throw Error('Unsupported reviewed configuration');
  return freeze(c);
}
export function parseRunStart(text, expected = {}) {
  if (typeof text !== 'string' || text.length > 4096) return null;
  let r;
  try {
    r = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !boundedShape(r) ||
    !exact(r, [
      'version',
      'runId',
      'workspaceId',
      'checkId',
      'configHash',
      'startedAt',
    ]) ||
    r.version !== 1 ||
    !run(r.runId) ||
    !hex(r.workspaceId) ||
    !hex(r.configHash) ||
    !/^[-a-z0-9]{1,64}$/.test(r.checkId) ||
    !integer(r.startedAt)
  )
    return null;
  for (const k of ['runId', 'workspaceId', 'checkId', 'configHash'])
    if (expected[k] !== undefined && expected[k] !== r[k]) return null;
  return freeze(r);
}
