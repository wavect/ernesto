import { expect, test, mock } from 'claude-code/testing';
import { captureSnapshot } from '../core/snapshot.js';
import { mascotCells } from '../ui/mascot.js';
const root = '/review/worktree';
const id = '11111111-1111-4111-8111-111111111111';
const later = '22222222-2222-4222-8222-222222222222';
const config = {
  version: 1,
  checkId: 'vitest',
  scope: { roots: ['src', 'package-lock.json'], excludes: [] },
  filters: [],
  runtimeDescriptor: 'node-24/vitest-4.1.11',
};
async function fixture(on, hostVersion = '2.1.296', denyCommands = false) {
  const clock = mock.clock(on);
  mock.store(on);
  on('command.register', () =>
    denyCommands ? { deny: 'Name already registered' } : { value: undefined },
  );
  on('session.version', () => ({ value: { version: hostVersion } }));
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  let closed = 0;
  on('ui.close', () => {
    closed++;
    return { value: undefined };
  });
  const files = {
    '.ernesto/config.json': JSON.stringify(config),
    'src/a.js': 'one',
    'package-lock.json': '{"lockfileVersion":3}',
    'node_modules/vitest/package.json': JSON.stringify({ version: '4.1.11' }),
  };
  const fs = {
    canonicalRoot: async () => root,
    async stat(p) {
      if (typeof files[p] === 'string')
        return {
          kind: 'file',
          size: new TextEncoder().encode(files[p]).length,
        };
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
      return new TextEncoder().encode(files[p]);
    },
  };
  const a = await captureSnapshot({
    root,
    scope: config.scope,
    runtime: config.runtimeDescriptor,
    checkDefinition: config,
    fs,
    now: 10,
  });
  const record = {
    schemaVersion: 1,
    reducerVersion: 1,
    runId: id,
    workspaceId: a.workspaceId,
    checkId: 'vitest',
    configHash: a.configHash,
    integration: { name: 'vitest', version: 1, runnerVersion: '4.1.11' },
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
  };
  files['.ernesto/runs/' + id + '/record.json'] = JSON.stringify(record);
  files['.ernesto/runs/' + id + '/started.json'] = JSON.stringify({
    version: 1,
    runId: id,
    workspaceId: a.workspaceId,
    checkId: 'vitest',
    configHash: a.configHash,
    startedAt: 11,
  });
  const control = { deny: false, seen: [], readGate: null, readEntered: null };
  on('fs.stat', async ($, e) => {
    control.seen.push(e.path);
    if (control.deny) return { deny: 'permission denied' };
    if (e.path === root)
      return {
        value: {
          kind: 'dir',
          size: 0,
          isLink: false,
          realPath: root,
          mtimeMs: 1,
        },
      };
    const p = e.path.slice(root.length + 1);
    const st = await fs.stat(p);
    if (!st) return { deny: 'ENOENT' };
    return {
      value: {
        ...st,
        kind: st.kind === 'directory' ? 'dir' : st.kind,
        isLink: false,
        realPath: e.path,
        mtimeMs: p.includes(later) ? 30 : 1,
      },
    };
  });
  on('fs.list', async ($, e) => ({
    value: (await fs.list(e.path.slice(root.length + 1))).map((name) => ({
      name,
      kind: 'file',
    })),
  }));
  on('fs.read', async ($, e) => {
    if (control.readGate) {
      control.readEntered?.();
      await control.readGate;
    }
    return {
      value: {
        base64: btoa(files[e.path.slice(root.length + 1)]),
        encoding: 'base64',
      },
    };
  });
  return { files, control, record, clock, closed: () => closed };
}
test('startup command registration failure leaves evidence work stopped', async ($, on) => {
  const f = await fixture(on, '2.1.296', true);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await f.clock.advance(5000);
  expect(f.control.seen.length).toBe(0);
});

test('QA observes an existing config by default without an enable command or any test process', async ($, on) => {
  const f = await fixture(on);
  let processes = 0;
  on('process.run', () => {
    processes++;
    return { deny: 'No automatic processes' };
  });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await f.clock.advance(150);
  const status = await $.command.run({ command: 'ernesto', args: 'status' });
  expect(status.text).toContain('passed · matched');
  expect(status.text).toContain('Next:');
  expect(status.text).not.toContain('Declared inputs:');
  expect(status.text.length).toBeLessThan(1000);
  expect(processes).toBe(0);
});

test('QA off persists across sessions and QA on restores the remembered workspace preference', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa off' });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  const count = f.control.seen.length;
  await f.clock.advance(5000);
  expect(f.control.seen.length).toBe(count);
  expect(
    (await $.command.run({ command: 'ernesto', args: 'status' })).text,
  ).toContain('QA is off');
  await $.command.run({ command: 'ernesto', args: 'qa on' });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await f.clock.advance(150);
  expect(
    (await $.command.run({ command: 'ernesto', args: 'status' })).text,
  ).toContain('passed · matched');
});

test('missing config needs no setup and newly created config is picked up without restarting', async ($, on) => {
  const f = await fixture(on);
  const saved = f.files['.ernesto/config.json'];
  delete f.files['.ernesto/config.json'];
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await f.clock.advance(150);
  const setup = await $.command.run({ command: 'ernesto', args: 'setup' });
  expect(setup.text).toContain('No setup required');
  expect(setup.text).toContain('/ernesto check');
  expect(setup.text).not.toContain('--init');
  expect(setup.text).not.toContain('\nnode ');
  expect(f.control.seen).not.toContain(root + '/src/a.js');
  const status = await $.command.run({ command: 'ernesto', args: 'status' });
  expect(status.text).toContain('QA observation is on');
  expect(status.text).not.toContain('passed · matched');
  f.files['.ernesto/config.json'] = saved;
  await f.clock.advance(1600);
  expect(
    (await $.command.run({ command: 'ernesto', args: 'status' })).text,
  ).toContain('passed · matched');
});

test('doctor explains runner requirements without executing a command or echoing malformed package content', async ($, on) => {
  const f = await fixture(on);
  f.files['node_modules/vitest/package.json'] = 'private broken package';
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  const result = await $.command.run({ command: 'ernesto', args: 'doctor' });
  expect(result.text).toContain('No dependencies are installed');
  expect(result.text).toContain('Node 24 / Vitest 4.1.11');
  expect(result.text).not.toContain('private broken package');
  expect(f.control.seen).not.toContain(root + '/src/a.js');
});

test('turning QA off during startup discovery cannot re-enable it when the read completes', async ($, on) => {
  const f = await fixture(on);
  let release;
  let entered;
  f.control.readGate = new Promise((resolve) => {
    release = resolve;
  });
  const reading = new Promise((resolve) => {
    entered = resolve;
  });
  f.control.readEntered = entered;
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  const pending = f.clock.advance(150);
  await reading;
  await $.command.run({ command: 'ernesto', args: 'qa off' });
  release();
  await pending;
  expect(
    (await $.command.run({ command: 'ernesto', args: 'status' })).text,
  ).toContain('QA is off');
  expect(f.control.seen).not.toContain(root + '/src/a.js');
});
test('required read failure invalidates a previously matched result', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  const enabled = await $.command.run({
    command: 'ernesto',
    args: 'qa enable',
  });
  expect(enabled.text).toContain('QA enabled');
  const matched = await $.command.run({ command: 'ernesto', args: 'evidence' });
  expect(matched.text).toContain('passed · matched');
  f.control.deny = true;
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  const failed = await $.command.run({ command: 'ernesto', args: 'evidence' });
  expect(failed.text).not.toContain('passed · matched');
});
test('later oversized evidence cannot silently retain an earlier matching pass', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · matched');
  f.files['.ernesto/runs/' + later + '/record.json'] = 'x'.repeat(33000);
  const refreshed = await $.command.run({
    command: 'ernesto',
    args: 'refresh',
  });
  expect(refreshed.text).not.toContain('passed · matched');
});
test('later malformed start cannot silently retain an earlier matching pass', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · matched');
  f.files['.ernesto/runs/' + later + '/started.json'] = '{truncated';
  const refreshed = await $.command.run({
    command: 'ernesto',
    args: 'refresh',
  });
  expect(refreshed.text).not.toContain('passed · matched');
});

test('source change makes the previous scoped result stale; chocolate preserves it', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · matched');
  f.files['src/a.js'] = 'changed';
  const stale = await $.command.run({ command: 'ernesto', args: 'refresh' });
  expect(stale.text).toContain('passed · stale');
  await $.command.run({ command: 'ernesto', args: 'chocolate' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · stale');
});
test('sarcastic banter rotates on activity, quiet suppresses it and polling preserves the line and evidence', async ($, on) => {
  const f = await fixture(on);
  on('ui.render', () => ({
    type: 'Text',
    props: {},
    children: ['host drawing'],
  }));
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await f.clock.advance(150);
  const before = await $.command.run({ command: 'ernesto', args: 'evidence' });
  const first = await $.command.run({ command: 'ernesto', args: 'chocolate' });
  const second = await $.command.run({ command: 'ernesto', args: 'chocolate' });
  expect(first.text).not.toBe(second.text);
  expect(second.text).toContain('QA evidence is unchanged.');
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toBe(before.text);
  await $.command.run({ command: 'ernesto', args: 'quiet on' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'chocolate' })).text,
  ).toBe('Chocolate accepted. QA evidence is unchanged.');
  await $.command.run({ command: 'ernesto', args: 'quiet off' });
  const answer = await $.command.run({ command: 'ernesto', args: 'chocolate' });
  const caption = answer.text.replace(' QA evidence is unchanged.', '');
  const band = await $.ui.mount({
    plugin: 'ernesto',
    surface: 'terminal',
    component: 'AbovePrompt',
    viewport: { columns: 100, rows: 30 },
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 6,
      bodyColumns: 100,
      scroll: { offset: 0, bodyRows: 6 },
      view: {},
    },
  });
  expect(await band.find({ type: 'Text', text: caption })).toBeDefined();
  await f.clock.advance(1600);
  expect(await band.find({ type: 'Text', text: caption })).toBeDefined();
  expect(
    (await $.command.run({ command: 'ernesto', args: 'status' })).text,
  ).toContain('passed · matched');
  await band.unmount();
});

test('new workspace starts with independent QA setup and cannot display prior workspace evidence', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · matched');
  await $.session.start({
    cwd: '/review/other-worktree',
    surface: null,
    isInteractive: false,
  });
  const answer = await $.command.run({ command: 'ernesto', args: 'evidence' });
  expect(answer.text).toContain('QA observation is on');
  expect(answer.text).not.toContain(id);
});
test('foreign-worktree record cannot become a current passing result', async ($, on) => {
  const f = await fixture(on);
  f.files['.ernesto/runs/' + id + '/record.json'] = JSON.stringify({
    ...f.record,
    workspaceId: 'a'.repeat(64),
  });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).not.toContain('passed · matched');
});
test('read-only mode refusal and hide stop further evidence reads', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · matched');
  await $.command.run({ command: 'ernesto', args: 'qa off' });
  const count = f.control.seen.length;
  await $.command.run({ command: 'ernesto', args: 'refresh' });
  expect(f.control.seen.length).toBe(count);
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  await $.command.run({ command: 'ernesto', args: 'hide' });
  const hidden = f.control.seen.length;
  await $.command.run({ command: 'ernesto', args: 'refresh' });
  expect(f.control.seen.length).toBe(hidden);
});
test('evidence pane refresh and close controls work without model interaction', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({
    cwd: root,
    surface: 'terminal',
    isInteractive: true,
  });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  const pane = await $.ui.mount({
    plugin: 'ernesto',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'ernesto-evidence',
    viewport: { columns: 80, rows: 30 },
    props: {
      title: 'Ernesto evidence',
      isFocused: true,
      bodyColumns: 78,
      bodyRows: 28,
      scroll: { offset: 0, bodyRows: 28 },
      view: {},
    },
  });
  expect(
    await pane.find({ type: 'Text', text: /passed · matched/ }),
  ).toBeDefined();
  expect(await pane.find({ type: 'Button', key: 'refresh' })).toBeDefined();
  expect(
    await pane.find({ type: 'Text', text: /1 passed · 0 failed/ }),
  ).toBeDefined();
  expect(
    await pane.find({ type: 'Text', text: /Recorded check:/ }),
  ).toBeUndefined();
  await pane.press({ key: 'details' });
  expect(
    await pane.find({ type: 'Text', text: /Recorded check:/ }),
  ).toBeDefined();
  expect(
    await pane.find({ type: 'Text', text: /Declared inputs: src/ }),
  ).toBeDefined();
  await pane.press({ key: 'details' });
  expect(
    await pane.find({ type: 'Text', text: /Recorded check:/ }),
  ).toBeUndefined();

  f.files['src/a.js'] = 'changed';
  await pane.press({ key: 'refresh' });
  expect(
    await pane.find({ type: 'Text', text: /passed · stale/ }),
  ).toBeDefined();
  await pane.press({ key: 'close' });
  expect(f.closed()).toBe(1);
  await pane.unmount();
});
test('tall terminal uses approved pixel portrait and renders complete evidence details', async ($, on) => {
  const f = await fixture(on);
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['original'] }));
  await $.session.start({
    cwd: root,
    surface: 'terminal',
    isInteractive: true,
  });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  const answer = await $.command.run({ command: 'ernesto', args: 'evidence' });
  expect(answer.text).toBeUndefined();
  const pane = await $.ui.mount({
    plugin: 'ernesto',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'ernesto-evidence',
    viewport: { columns: 80, rows: 30 },
    props: {
      title: 'Ernesto evidence',
      isFocused: true,
      bodyColumns: 78,
      bodyRows: 28,
      scroll: { offset: 0, bodyRows: 28 },
      view: {},
    },
  });
  await pane.press({ key: 'details' });
  for (const text of [
    /Declared inputs: src/,
    /Scope: suite/,
    /1 passed; 0 failed; 0 skipped; 0 todo/,
    /Integrity: validated_local_record/,
    /Excluded:/,
    /Last comparison: 1970-01-01/,
  ])
    expect(await pane.find({ type: 'Text', text })).toBeDefined();
  await pane.unmount();
  const band = await $.ui.mount({
    plugin: 'ernesto',
    surface: 'terminal',
    component: 'AbovePrompt',
    viewport: { columns: 100, rows: 30 },
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 6,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 6 },
      view: {},
    },
  });
  expect(await band.find({ type: 'Raster', key: 'ernesto' })).toBeDefined();
  await band.unmount();
});

test('clear and resume do not retain fresh evidence before revalidation', async ($, on) => {
  const f = await fixture(on);
  on('classic.SessionStart', () => ({}));
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · matched');
  f.files['src/a.js'] = 'changed while stopped';
  await $.classic.SessionStart({ source: 'resume' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).not.toContain('passed · matched');
  await f.clock.advance(150);
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · stale');
  await $.classic.SessionStart({ source: 'clear' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).not.toContain('passed · matched');
});
test('hidden and QA off cancel timed evidence work', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  await $.command.run({ command: 'ernesto', args: 'hide' });
  let count = f.control.seen.length;
  await f.clock.advance(5000);
  expect(f.control.seen.length).toBe(count);
  await $.command.run({ command: 'ernesto', args: 'show' });
  await f.clock.advance(150);
  expect(f.control.seen.length).toBeGreaterThan(count);
  await $.command.run({ command: 'ernesto', args: 'qa off' });
  count = f.control.seen.length;
  await f.clock.advance(5000);
  expect(f.control.seen.length).toBe(count);
});

test('historical failed result remains failed and stale after check, scope or lock changes', async ($, on) => {
  const f = await fixture(on);
  f.files['.ernesto/runs/' + id + '/record.json'] = JSON.stringify({
    ...f.record,
    process: { exitCode: 1, signal: null, interrupted: false },
    counts: {
      selected: 1,
      completed: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      todo: 0,
    },
    runner: { reportPresent: true, success: false, globalErrors: 0 },
  });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('failed · matched');
  f.files['package-lock.json'] = '{"lockfileVersion":3,"changed":true}';
  expect(
    (await $.command.run({ command: 'ernesto', args: 'refresh' })).text,
  ).toContain('failed · stale');
  f.files['.ernesto/config.json'] = JSON.stringify({
    ...config,
    filters: ['tests/second.test.js'],
  });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'refresh' })).text,
  ).toContain('failed · stale');
  f.files['.ernesto/config.json'] = JSON.stringify({
    ...config,
    scope: { ...config.scope, excludes: ['src/a.js'] },
  });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'refresh' })).text,
  ).toContain('failed · stale');
});
test('final record must correlate with its own helper start configuration', async ($, on) => {
  const f = await fixture(on);
  const start = JSON.parse(f.files['.ernesto/runs/' + id + '/started.json']);
  f.files['.ernesto/runs/' + id + '/started.json'] = JSON.stringify({
    ...start,
    configHash: 'b'.repeat(64),
  });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).not.toContain('passed · matched');
});

test('unsupported host refuses QA before any project read and retains companion help', async ($, on) => {
  const f = await fixture(on, '2.1.291');
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'status' })).text,
  ).toContain('requires Claude Code 2.1.296+');
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(f.control.seen.length).toBe(0);
  expect(
    (await $.command.run({ command: 'ernesto', args: 'refresh' })).text,
  ).toContain('QA is off');
});
test('older invalid artifact cannot poison a newer valid result during replay', async ($, on) => {
  const f = await fixture(on);
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(
    (await $.command.run({ command: 'ernesto', args: 'evidence' })).text,
  ).toContain('passed · matched');
  const old = '33333333-3333-4333-8333-333333333333';
  const started = JSON.parse(f.files['.ernesto/runs/' + id + '/started.json']);
  f.files['.ernesto/runs/' + old + '/started.json'] = JSON.stringify({
    ...started,
    runId: old,
    startedAt: 5,
  });
  f.files['.ernesto/runs/' + old + '/record.json'] = '{truncated';
  for (let i = 0; i < 2; i++)
    expect(
      (await $.command.run({ command: 'ernesto', args: 'refresh' })).text,
    ).toContain('passed · matched');
});

test('transparent mascot cells render spaces rather than solid terminal bars', async () => {
  const bytes = Uint8Array.fromBase64(mascotCells('wake'));
  const cells = new Uint32Array(bytes.buffer);
  expect(cells.length).toBe(18 * 5 * 3);
  let blanks = 0;
  for (let i = 0; i < cells.length; i += 3) {
    if (cells[i + 1] === 0x01000000 && cells[i + 2] === 0x01000000) {
      expect(cells[i]).toBe(32);
      blanks++;
    }
  }
  expect(blanks).toBeGreaterThan(0);
});

test('original tool errors, interruption and denials pass through exactly once without private echo', async ($, on) => {
  await fixture(on);
  let calls = 0;
  const error = {
    result: 'original private failure',
    text: 'original private failure',
    isError: true,
    ref: 11,
  };
  const interruption = {
    result: 'original interruption',
    text: 'original interruption',
    isError: true,
    ref: 12,
  };
  const denial = { deny: 'original permission refusal' };
  on('tool.call', ($, e) => {
    calls++;
    return e.command === 'error'
      ? error
      : e.command === 'interrupt'
        ? interruption
        : denial;
  });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  for (const [command, expected] of [
    ['error', error],
    ['interrupt', interruption],
    ['denial', denial],
  ]) {
    expect(await $.tool.call({ tool: 'Bash', command })).toEqual(expected);
  }
  expect(calls).toBe(3);
  const answer = await $.command.run({ command: 'ernesto', args: 'evidence' });
  for (const text of [
    'original private failure',
    'original interruption',
    'original permission refusal',
  ])
    expect(answer.text).not.toContain(text);
  expect(answer.text).toContain('QA observation is on');
});

test('concurrent tool reentry preserves each original result and executes each once', async ($, on) => {
  await fixture(on);
  const calls = [];
  on('tool.call', async ($, e) => {
    calls.push(e.command);
    await Promise.resolve();
    return {
      result:
        e.command === 'first opaque input'
          ? 'first original result'
          : 'second original result',
    };
  });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  expect(
    await Promise.all([
      $.tool.call({ tool: 'Bash', command: 'first opaque input' }),
      $.tool.call({ tool: 'Bash', command: 'second opaque input' }),
    ]),
  ).toEqual([
    { result: 'first original result' },
    { result: 'second original result' },
  ]);
  expect(calls).toEqual(['first opaque input', 'second opaque input']);
  const answer = await $.command.run({ command: 'ernesto', args: 'evidence' });
  expect(answer.text).not.toContain('opaque input');
  expect(answer.text).not.toContain('original result');
});

test('terminal claims of passing tests do not create structured QA evidence', async ($, on) => {
  const f = await fixture(on);
  delete f.files['.ernesto/runs/' + id + '/record.json'];
  delete f.files['.ernesto/runs/' + id + '/started.json'];
  on('tool.call', () => ({
    result: 'Tests: 99 passed. All tests pass. private stdout.',
  }));
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await $.command.run({ command: 'ernesto', args: 'qa enable' });
  await $.tool.call({ tool: 'Bash', command: 'echo claims' });
  const answer = await $.command.run({ command: 'ernesto', args: 'evidence' });
  expect(answer.text).not.toContain('QA: passed');
  expect(answer.text).not.toContain('99 passed');
  expect(answer.text).not.toContain('private stdout');
});

test('failed explicit Vitest launch cannot reuse an earlier passing record as its new result', async ($, on) => {
  const f = await fixture(on);
  on('process.run', () => ({
    value: {
      exitCode: 1,
      stdout: '',
      stderr: 'runner failed before new record',
    },
  }));
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await f.clock.advance(150);
  expect(
    (await $.command.run({ command: 'ernesto', args: 'status' })).text,
  ).toContain('passed · matched');
  await $.command.run({ command: 'ernesto', args: 'check' });
  const status = await $.command.run({ command: 'ernesto', args: 'status' });
  expect(status.text).toContain('failed (exit 1)');
  expect(status.text).not.toContain('passed · matched');
  expect(status.text).not.toContain('runner failed before new record');
});
