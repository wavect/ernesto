import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defaultCheckConfig, helperCommand } from '../core/setup.js';
import { initializeProject } from '../integrations/vitest/setup.mjs';
import { parseCommand } from '../core/companion.js';
import { captureSnapshot, snapshotsMatch } from '../core/snapshot.js';
import { memoryFS } from './helpers/evidence-fixture.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = path.join(root, '.agent-cache/setup-tests');
const helper = path.join(root, 'integrations/vitest/run.mjs');
async function fixture() {
  await fs.mkdir(scratch, { recursive: true });
  const dir = await fs.mkdtemp(path.join(scratch, 'project-'));
  await fs.mkdir(path.join(dir, 'src'));
  await fs.mkdir(path.join(dir, 'tests'));
  await fs.mkdir(path.join(dir, 'node_modules/vitest'), { recursive: true });
  await fs.writeFile(path.join(dir, 'package.json'), '{"private":true}');
  await fs.writeFile(
    path.join(dir, 'node_modules/vitest/package.json'),
    '{"version":"4.1.11"}',
  );
  await fs.writeFile(
    path.join(dir, 'node_modules/vitest/vitest.mjs'),
    'throw Error("Setup must not execute this runner")',
  );
  return dir;
}
const cli = (args, cwd) =>
  spawnSync(process.execPath, [helper, ...args], { cwd, encoding: 'utf8' });

test('adding an initially absent conventional runner config or lockfile invalidates the default snapshot', async () => {
  const config = defaultCheckConfig([
    { name: 'src', kind: 'directory' },
    { name: 'package.json', kind: 'file' },
  ]);
  const files = { 'src/add.js': 'export const n = 1;', 'package.json': '{}' };
  const fs = memoryFS(files);
  const snapshot = () =>
    captureSnapshot({
      root: '/synthetic/worktree',
      scope: config.scope,
      runtime: config.runtimeDescriptor,
      checkDefinition: config,
      fs,
      now: 10,
    });
  const before = await snapshot();
  assert.equal(before.complete, true);
  files['vitest.config.ts'] = 'export default {}';
  assert.equal(snapshotsMatch(before, await snapshot()), false);
  delete files['vitest.config.ts'];
  files['package-lock.json'] = '{"lockfileVersion":3}';
  assert.equal(snapshotsMatch(before, await snapshot()), false);
});

test('default scope selects conventional inputs without credentials, output, hidden files or arbitrary JSON', () => {
  const config = defaultCheckConfig([
    ...[
      'src',
      'tests',
      'node_modules',
      'secrets',
      'dist',
      '.git',
      '.agent-cache',
      'client-data',
    ].map((name) => ({ name, kind: 'directory' })),
    ...[
      'package.json',
      'pnpm-lock.yaml',
      'vitest.config.ts',
      'tsconfig.app.json',
      '.env',
      'credentials.json',
      'secrets.js',
      'client-data.json',
    ].map((name) => ({ name, kind: 'file' })),
  ]);
  for (const name of [
    'package.json',
    'pnpm-lock.yaml',
    'src',
    'tests',
    'tsconfig.app.json',
    'vitest.config.ts',
    'vite.config.js',
    'package-lock.json',
  ])
    assert.ok(config.scope.roots.includes(name), name);
  for (const name of [
    'credentials.json',
    'secrets.js',
    'client-data.json',
    'client-data',
    'node_modules',
    'dist',
    '.git',
    '.env',
  ])
    assert.ok(!config.scope.roots.includes(name), name);
  assert.deepEqual(config.filters, []);
  assert.throws(
    () => defaultCheckConfig([{ name: 'src', kind: 'other' }]),
    /unsafe/,
  );
  assert.throws(
    () =>
      defaultCheckConfig(
        Array.from({ length: 513 }, () => ({ name: 'x', kind: 'file' })),
      ),
    /too many/,
  );
  assert.throws(() => defaultCheckConfig([]), /No bounded/);
  assert.throws(
    () => defaultCheckConfig([{ name: 'package.json', kind: 'file' }]),
    /No bounded/,
  );
});

test('setup creates private defaults once, preserves existing bytes and never starts tests', async () => {
  const dir = await fixture();
  try {
    const result = cli(['--setup'], dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No tests run/);
    const config = path.join(dir, '.ernesto/config.json');
    const bytes = await fs.readFile(config, 'utf8');
    for (const name of ['package.json', 'src', 'tests', 'vitest.config.js'])
      assert.ok(JSON.parse(bytes).scope.roots.includes(name));
    if (process.platform !== 'win32')
      assert.equal((await fs.stat(config)).mode & 0o777, 0o600);
    assert.equal((await initializeProject(dir)).created, false);
    assert.equal(await fs.readFile(config, 'utf8'), bytes);
    await assert.rejects(fs.stat(path.join(dir, '.ernesto/runs')), {
      code: 'ENOENT',
    });
    await fs.writeFile(config, '{"invalid":true}');
    await assert.rejects(initializeProject(dir), /configuration/);
    assert.equal(await fs.readFile(config, 'utf8'), '{"invalid":true}');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('missing and unsupported runners produce actionable errors without project edits', async () => {
  const dir = await fixture();
  try {
    await fs.writeFile(
      path.join(dir, 'node_modules/vitest/package.json'),
      '{"version":"0.0.0"}',
    );
    await assert.rejects(
      initializeProject(dir),
      /supports project-local Vitest 4.1.11/,
    );
    await fs.unlink(path.join(dir, 'node_modules/vitest/package.json'));
    const result = cli(['--setup'], dir);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /npm install --save-dev vitest@4.1.11/);
    await assert.rejects(fs.stat(path.join(dir, '.ernesto')), {
      code: 'ENOENT',
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('parallel setup creates exactly one config and refuses directory and config symlinks', async () => {
  const dir = await fixture();
  const outside = await fixture();
  try {
    const results = await Promise.all([
      initializeProject(dir),
      initializeProject(dir),
    ]);
    assert.equal(results.filter((r) => r.created).length, 1);
    await fs.unlink(path.join(dir, '.ernesto/config.json'));
    await fs.writeFile(path.join(outside, 'sentinel.json'), 'must survive');
    await fs.symlink(
      path.join(outside, 'sentinel.json'),
      path.join(dir, '.ernesto/config.json'),
    );
    await assert.rejects(initializeProject(dir), /Symlink|Unsafe/);
    assert.equal(
      await fs.readFile(path.join(outside, 'sentinel.json'), 'utf8'),
      'must survive',
    );
    await fs.rm(path.join(dir, '.ernesto'), { recursive: true });
    await fs.symlink(outside, path.join(dir, '.ernesto'));
    await assert.rejects(initializeProject(dir), /real project directory/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
});

test('new commands are exact aliases and helper commands quote hostile paths as a single argument', async () => {
  for (const args of ['setup', 'qa setup'])
    assert.equal(parseCommand(args).action, 'setup');
  assert.equal(parseCommand('qa on').action, 'qa enable');
  assert.equal(parseCommand('doctor').action, 'doctor');
  assert.equal(parseCommand('setup ; echo bad').action, 'invalid');
  assert.throws(() => helperCommand('/plugin', '--init; bad'), /Unsupported/);
  assert.throws(() => helperCommand('/plugin\n'), /unsupported characters/);
  const dir = await fixture();
  try {
    const plugin = path.join(dir, "plugin ' $ literal");
    await fs.mkdir(path.join(plugin, 'integrations/vitest'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(plugin, 'integrations/vitest/run.mjs'),
      'console.log(JSON.stringify(process.argv.slice(2)))',
    );
    const result = spawnSync(
      '/bin/sh',
      ['-c', helperCommand(plugin, '--setup')],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ['--setup']);
    const help = cli(['--help'], dir);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /--init/);
    assert.equal(cli(['--init', '--setup'], dir).status, 2);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test(
  'the explicit init command keeps reviewed filters and records real pass and fail exits',
  { timeout: 30000 },
  async () => {
    const dir = path.join(root, 'examples/vitest-demo');
    const configPath = path.join(dir, '.ernesto/config.json');
    const source = path.join(dir, 'src/add.js');
    const original = await fs.readFile(source);
    let previous;
    try {
      previous = await fs.readFile(configPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      const config = JSON.parse(
        await fs.readFile(
          path.join(dir, 'ernesto.config.example.json'),
          'utf8',
        ),
      );
      config.filters = ['tests/add.test.js'];
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      const reviewed = JSON.stringify(config);
      await fs.writeFile(configPath, reviewed);
      await fs.writeFile(source, 'export function add(a,b) { return a+b; }\n');
      const pass = cli(['--init'], dir);
      assert.equal(pass.status, 0, pass.stderr + pass.stdout);
      assert.match(pass.stdout, /Kept existing/);
      assert.match(pass.stdout, /1 passed; 0 failed/);
      assert.equal(await fs.readFile(configPath, 'utf8'), reviewed);
      await fs.writeFile(source, 'export function add() { return -100; }\n');
      const fail = cli(['--init'], dir);
      assert.equal(fail.status, 1, fail.stderr + fail.stdout);
      assert.match(fail.stdout, /0 passed; 1 failed/);
      assert.equal(await fs.readFile(configPath, 'utf8'), reviewed);
    } finally {
      await fs.writeFile(source, original);
      if (previous) await fs.writeFile(configPath, previous);
      else await fs.unlink(configPath).catch(() => {});
    }
  },
);
