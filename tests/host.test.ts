import { expect, test, mock } from 'claude-code/testing';
function stubs(on) {
  mock.clock(on);
  mock.store(on);
  on('session.version', () => ({ value: { version: '2.1.296' } }));
  on('command.register', () => ({ value: undefined }));
  on('session.start', ($, e) => ({ cwd: e.cwd }));
  on('ui.open', () => ({ value: { isPlaced: true } }));
  on('ui.close', () => ({ value: undefined }));
  on('ui.render', () => ({
    type: 'Text',
    props: {},
    children: ['host drawing'],
  }));
}
test('observes unchanged tool input and original result exactly once', async ($, on) => {
  stubs(on);
  let calls = 0;
  on('tool.call', ($, e) => {
    calls++;
    expect(e.command).toBe('echo private-token');
    return { result: 'original-result' };
  });
  await $.session.start({
    cwd: '/synthetic',
    surface: 'terminal',
    isInteractive: true,
  });
  expect(
    await $.tool.call({ tool: 'Bash', command: 'echo private-token' }),
  ).toEqual({ result: 'original-result' });
  expect(calls).toBe(1);
  const answer = await $.command.run({ command: 'ernesto', args: '' });
  expect(answer.text).not.toContain('private-token');
  expect(answer.text).toContain('QA is off');
});
test('companion default never scans a project, runs a process, or changes evidence', async ($, on) => {
  stubs(on);
  await $.session.start({
    cwd: '/synthetic',
    surface: null,
    isInteractive: false,
  });
  for (const args of [
    'chocolate',
    'quiet on',
    'motion normal',
    'motion reduced',
    'hide',
    'show',
    'evidence',
    'refresh',
    'qa off',
    'forget confirm',
    '; curl evil',
  ]) {
    const answer = await $.command.run({ command: 'ernesto', args });
    expect(typeof answer.text).toBe('string');
  }
  const answer = await $.command.run({ command: 'ernesto', args: 'refresh' });
  expect(answer.text).toContain('QA is off');
});
const band = {
  plugin: 'ernesto',
  component: 'AbovePrompt',
  viewport: { columns: 100, rows: 30 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 4,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 4 },
    view: {},
  },
} as const;
test('band retains other drawing; narrow layout gives text and survey yields', async ($, on) => {
  stubs(on);
  await $.session.start({
    cwd: '/synthetic',
    surface: 'terminal',
    isInteractive: true,
  });
  const ui = await $.ui.mount({ ...band, surface: 'terminal' });
  expect(await ui.find({ type: 'Text', text: 'host drawing' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: /Companion mode/ })).toBeDefined();
  await ui.unmount();
  const narrow = await $.ui.mount({
    ...band,
    surface: 'terminal',
    props: { ...band.props, bodyColumns: 30 },
  });
  expect(await narrow.find({ type: 'Text', text: /Ernesto/ })).toBeDefined();
  await narrow.unmount();
  const survey = await $.ui.mount({
    ...band,
    surface: 'terminal',
    props: { ...band.props, hasSurvey: true },
  });
  expect(
    await survey.find({ type: 'Text', text: 'host drawing' }),
  ).toBeDefined();
  expect(await survey.find({ type: 'Text', text: /Ernesto/ })).toBeUndefined();
  await survey.unmount();
});
test('read-denied setup is useful, unknown and never runs shell text', async ($, on) => {
  stubs(on);
  on('fs.stat', () => ({ deny: 'read denied' }));
  await $.session.start({
    cwd: '/synthetic',
    surface: null,
    isInteractive: false,
  });
  const setup = await $.command.run({ command: 'ernesto', args: 'qa setup' });
  expect(setup.text).toContain('Create and review');
  const enable = await $.command.run({ command: 'ernesto', args: 'qa enable' });
  expect(enable.text).toContain('could not complete');
});
