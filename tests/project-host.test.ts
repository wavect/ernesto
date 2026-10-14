import { expect, test, mock } from 'claude-code/testing';
const root = '/plug-play';
async function fixture($, on, opts = {}) {
  const clock = mock.clock(on);
  mock.store(on);
  on('command.register', () => ({ value: undefined }));
  on('session.version', () => ({ value: { version: '2.1.296' } }));
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.close', () => ({ value: undefined }));
  on('ui.render', () => ({
    type: 'Text',
    props: {},
    children: ['host drawing'],
  }));
  const files = {
    'package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
    'src/a.js': 'one',
  };
  const dirs = ['', 'src'];
  on('fs.stat', ($, e) => {
    const p = e.path === root ? '' : e.path.slice(root.length + 1);
    const dir = dirs.includes(p);
    if (!dir && !(p in files)) return { deny: 'ENOENT' };
    return {
      value: {
        kind: dir ? 'dir' : 'file',
        size: dir ? 0 : files[p].length,
        isLink: false,
        realPath: e.path,
        mtimeMs: 1,
      },
    };
  });
  on('fs.list', ($, e) => ({
    value:
      e.path === root
        ? [
            { name: 'package.json', kind: 'file' },
            { name: 'src', kind: 'dir' },
          ]
        : [{ name: 'a.js', kind: 'file' }],
  }));
  on('fs.read', ($, e) => ({
    value: {
      base64: btoa(files[e.path.slice(root.length + 1)]),
      encoding: 'base64',
    },
  }));
  let calls = 0;
  on('process.run', async ($, e) => {
    calls++;
    expect(e.argv).toEqual(['npm', 'run', 'test']);
    expect(e.init.cwd).toBe(root);
    expect(e.init.env).toEqual({ CI: '1' });
    expect(e.init.timeoutMs).toBe(120000);
    if (opts.run) return opts.run();
    return {
      value: { exitCode: 0, stdout: 'private-test-output', stderr: '' },
    };
  });
  await $.session.start({ cwd: root, surface: null, isInteractive: false });
  await clock.advance(150);
  return { files, clock, calls: () => calls };
}
const command = ($, args) => $.command.run({ command: 'ernesto', args });
test('no config: immediately ready, no process until explicit check; output is private to Details', async ($, on) => {
  const f = await fixture($, on);
  for (const args of ['setup', 'doctor', 'refresh', 'evidence', 'status']) {
    const r = await command($, args);
    expect(r.text).not.toContain('/plugins/cache');
    expect(r.text).not.toContain('--init');
    expect(r.text).not.toContain('setup needed');
  }
  await f.clock.advance(1600);
  expect(f.calls()).toBe(0);
  const checked = await command($, 'check');
  expect(checked.text).toContain('completed (exit 0)');
  expect(checked.text).toContain('inputs matched');
  expect(f.calls()).toBe(1);
  const result = await command($, 'status');
  expect(result.text).toContain('not verified');
  expect(result.text).not.toContain('private-test-output');
  expect(result.text).not.toContain('passed');
  f.files['src/a.js'] = 'two';
  expect((await command($, 'refresh')).text).toContain('inputs stale');
  expect(f.calls()).toBe(1);
});
test('failure and invalid exit stay failure or unknown, never passed', async ($, on) => {
  let exitCode = 7;
  await fixture($, on, {
    run: () => ({ value: { exitCode, stdout: '', stderr: 'private failure' } }),
  });
  expect((await command($, 'check')).text).toContain('failed (exit 7)');
  exitCode = -1;
  expect((await command($, 'check')).text).toContain('unknown');
  expect((await command($, 'status')).text).not.toContain('private failure');
});
test('process denied or missing executable leaves unknown and keeps the companion usable', async ($, on) => {
  await fixture($, on, { run: () => ({ deny: 'Executable unavailable' }) });
  expect((await command($, 'check')).text).toContain('could not complete');
  expect((await command($, 'status')).text).toContain('unknown');
  expect((await command($, 'chocolate')).text).toContain(
    'QA evidence is unchanged',
  );
});
test('QA off during a user-started command discards late results and prevents more executions', async ($, on) => {
  let release, entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const f = await fixture($, on, {
    run: async () => {
      entered();
      await gate;
      return { value: { exitCode: 0, stdout: 'late-output', stderr: '' } };
    },
  });
  const pending = command($, 'check');
  await started;
  expect((await command($, 'check')).text).toContain('already running');
  await command($, 'qa off');
  release();
  expect((await pending).text).toContain('discarded');
  expect((await command($, 'status')).text).toContain('QA is off');
  expect((await command($, 'check')).text).toContain('paused');
  expect(f.calls()).toBe(1);
});
test('no command detected needs no JSON setup and runs nothing', async ($, on) => {
  const f = await fixture($, on);
  f.files['package.json'] = '{}';
  expect((await command($, 'setup')).text).toContain(
    'companion works immediately',
  );
  expect((await command($, 'check')).text).toContain('nothing to configure');
  expect(f.calls()).toBe(0);
});
test('Check project button runs once and Details alone reveals command output', async ($, on) => {
  const f = await fixture($, on);
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
  expect(await pane.find({ type: 'Button', key: 'check' })).toBeDefined();
  expect(f.calls()).toBe(0);
  await pane.press({ key: 'check' });
  expect(f.calls()).toBe(1);
  expect(
    await pane.find({ type: 'Text', text: /private-test-output/ }),
  ).toBeUndefined();
  expect(await pane.find({ type: 'Text', text: /not verified/ })).toBeDefined();
  await pane.press({ key: 'details' });
  expect(
    await pane.find({ type: 'Text', text: /private-test-output/ }),
  ).toBeDefined();
  await pane.press({ key: 'details' });
  expect(
    await pane.find({ type: 'Text', text: /private-test-output/ }),
  ).toBeUndefined();
  await pane.press({ key: 'refresh' });
  expect(f.calls()).toBe(1);
  await pane.unmount();
});
test('hiding during a check prevents a late result from restoring confidence', async ($, on) => {
  let release, entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  await fixture($, on, {
    run: async () => {
      entered();
      await gate;
      return { value: { exitCode: 0, stdout: 'hidden output', stderr: '' } };
    },
  });
  const pending = command($, 'check');
  await started;
  await command($, 'hide');
  release();
  await pending;
  await command($, 'show');
  const result = await command($, 'status');
  expect(result.text).toContain('unknown');
  expect(result.text).not.toContain('completed (exit 0)');
  expect(result.text).not.toContain('hidden output');
});
test('workspace change during a check cannot retain its output or result', async ($, on) => {
  let release, entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  await fixture($, on, {
    run: async () => {
      entered();
      await gate;
      return {
        value: { exitCode: 0, stdout: 'previous workspace', stderr: '' },
      };
    },
  });
  const pending = command($, 'check');
  await started;
  await $.session.start({
    cwd: '/other-workspace',
    surface: null,
    isInteractive: false,
  });
  release();
  await pending;
  const result = await command($, 'status');
  expect(result.text).not.toContain('completed (exit 0)');
  expect(result.text).not.toContain('previous workspace');
});
