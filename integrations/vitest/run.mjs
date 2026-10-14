#!/usr/bin/env node
// Explicit user invocation only. No downloads or shell evaluation. The mod can invoke this only on an explicit check action.
import * as fsp from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  captureSnapshot,
  excludedPath,
  safeRelative,
} from '../../core/snapshot.js';
import {
  parseCheckConfig,
  parseEvidence,
  SUPPORTED_VITEST_VERSION,
} from '../../core/evidence.js';
import { nodeFilesystem } from './node-fs.mjs';
import { initializeProject } from './setup.mjs';
export async function pruneEvidence(
  fs,
  { now = Date.now(), maxRuns = 20, maxAgeMs = 7 * 86400000 } = {},
) {
  if (
    !Number.isInteger(maxRuns) ||
    maxRuns < 1 ||
    maxRuns > 20 ||
    !Number.isSafeInteger(maxAgeMs) ||
    maxAgeMs < 3600000 ||
    maxAgeMs > 7 * 86400000
  )
    throw Error('Invalid retention policy');
  let ids;
  try {
    ids = await fs.list('.ernesto/runs');
  } catch {
    return;
  }
  if (ids.length > 1000) return;
  const summaries = [];
  for (const id of ids) {
    if (!/^[a-f0-9-]{36}$/.test(id)) continue;
    const relative = '.ernesto/runs/' + id;
    try {
      if ((await fs.stat(relative))?.kind !== 'directory') continue;
      const p = relative + '/record.json';
      const data = await fs.read(p);
      const parsed = parseEvidence(
        new TextDecoder('utf-8', { fatal: true }).decode(data),
      );
      if (
        parsed.integrity === 'validated_local_record' &&
        parsed.record.runId === id
      )
        summaries.push({ id, endedAt: parsed.record.endedAt });
    } catch {}
  }
  summaries.sort((a, b) => b.endedAt - a.endedAt || a.id.localeCompare(b.id));
  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    if (i < maxRuns && now - s.endedAt <= maxAgeMs) continue;
    const relative = '.ernesto/runs/' + s.id;
    try {
      const names = await fs.list(relative);
      if (names.some((n) => !['record.json', 'started.json'].includes(n)))
        continue;
      for (const name of names) {
        const p = relative + '/' + name;
        if ((await fs.stat(p))?.kind !== 'file')
          throw Error('Unsafe retention file');
        await fsp.unlink(await fs.resolve(p));
      }
      await fsp.rmdir(await fs.resolve(relative));
    } catch {}
  }
}
async function atomicJSON(fs, relative, value) {
  const folder = relative.slice(0, relative.lastIndexOf('/'));
  const dir = await fs.resolve(folder);
  const temp = path.join(dir, '.pending-' + randomUUID());
  await fsp.writeFile(temp, JSON.stringify(value), { flag: 'wx', mode: 0o600 });
  await fsp.rename(temp, path.join(dir, path.basename(relative)));
}
export async function runCheck({
  root = process.cwd(),
  quiet = false,
  onStarted,
} = {}) {
  if (Number(process.versions.node.split('.')[0]) !== 24)
    throw Error('This helper requires Node.js 24');
  const fs = await nodeFilesystem(root);
  const config = parseCheckConfig(
    new TextDecoder('utf-8', { fatal: true }).decode(
      await fs.read('.ernesto/config.json'),
    ),
  );
  const runnerPackage = JSON.parse(
    new TextDecoder().decode(await fs.read('node_modules/vitest/package.json')),
  );
  if (runnerPackage.version !== SUPPORTED_VITEST_VERSION)
    throw Error('Unsupported installed Vitest version');
  const runner = await fs.resolve('node_modules/vitest/vitest.mjs');
  const owned = path.join(fs.root, '.ernesto');
  await fs.resolve('.ernesto');
  try {
    await fs.resolve('.ernesto/runs');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    await fsp.mkdir(path.join(owned, 'runs'), { mode: 0o700 });
  }
  const runId = randomUUID();
  const runRelative = '.ernesto/runs/' + runId;
  await fsp.mkdir(path.join(owned, 'runs', runId), { mode: 0o700 });
  let epoch = 0,
    gap = false,
    watcher;
  try {
    watcher = watch(fs.root, { recursive: true }, (_event, name) => {
      if (typeof name !== 'string') {
        gap = true;
        return;
      }
      const relative = name.split(path.sep).join('/');
      if (!safeRelative(relative)) {
        gap = true;
        return;
      }
      if (
        !excludedPath(relative, config.scope.excludes) &&
        config.scope.roots.some(
          (p) => relative === p || relative.startsWith(p + '/'),
        )
      )
        epoch++;
    });
    watcher.on('error', () => {
      gap = true;
    });
  } catch {
    gap = true;
  }
  try {
    // Establish the watcher before the tested baseline; drain queued setup notifications.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const snapshot = () =>
      captureSnapshot({
        root: fs.root,
        scope: config.scope,
        runtime: config.runtimeDescriptor,
        checkDefinition: config,
        fs,
        epoch,
        observationGap: gap,
      });
    const startSnapshot = await snapshot();
    const startedAt = Date.now();
    const start = {
      version: 1,
      runId,
      workspaceId: startSnapshot.workspaceId,
      checkId: config.checkId,
      configHash: startSnapshot.configHash,
      startedAt,
    };
    await atomicJSON(fs, runRelative + '/started.json', start);
    await onStarted?.(start);
    const statusAbsolute = path.join(owned, 'runs', runId, 'status.json');
    const reportersModule = await fs.resolve(
      'node_modules/vitest/dist/reporters.js',
    );
    const errorReporter = fileURLToPath(
      new URL('./errors-reporter.mjs', import.meta.url),
    );
    let child;
    let interrupt = null;
    let killTimer;
    const forward = (signal) => {
      interrupt = signal;
      child?.kill(signal);
      killTimer ??= setTimeout(() => child?.kill('SIGKILL'), 3000);
    };
    const sigint = () => forward('SIGINT'),
      sigterm = () => forward('SIGTERM');
    process.on('SIGINT', sigint);
    process.on('SIGTERM', sigterm);
    let completion;
    try {
      completion = await new Promise((resolve, reject) => {
        child = spawn(
          process.execPath,
          [
            runner,
            'run',
            ...config.filters,
            '--reporter=default',
            '--reporter=' + errorReporter,
          ],
          {
            cwd: fs.root,
            stdio: quiet ? 'ignore' : 'inherit',
            shell: false,
            env: {
              ...process.env,
              ERNESTO_VITEST_STATUS_FILE: statusAbsolute,
              ERNESTO_VITEST_RUN_ID: runId,
              ERNESTO_VITEST_REPORTERS_MODULE: reportersModule,
            },
          },
        );
        child.once('error', reject);
        child.once('exit', (exitCode, signal) => resolve({ exitCode, signal }));
      });
    } catch {
      completion = { exitCode: null, signal: 'OTHER' };
    } finally {
      process.off('SIGINT', sigint);
      process.off('SIGTERM', sigterm);
      clearTimeout(killTimer);
    }
    const endedAt = Date.now();
    const endSnapshot = await snapshot();
    watcher?.close();
    let parsed = {
      counts: {
        selected: 0,
        completed: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        todo: 0,
      },
      runner: { reportPresent: false, success: null, globalErrors: 0 },
    };
    try {
      const relative = runRelative + '/status.json';
      const stat = await fs.stat(relative);
      if (stat?.kind !== 'file' || stat.size > 32768)
        throw Error('Unsafe summary');
      const summary = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(
          await fs.read(relative),
        ),
      );
      if (
        Object.keys(summary).sort().join('|') !==
          'counts|runId|runner|version' ||
        summary.version !== 1 ||
        summary.runId !== runId
      )
        throw Error('Invalid summary channel');
      parsed = { counts: summary.counts, runner: summary.runner };
    } catch {
      parsed = {
        counts: {
          selected: 0,
          completed: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          todo: 0,
        },
        runner: { reportPresent: false, success: null, globalErrors: 0 },
      };
    } finally {
      try {
        if ((await fs.stat(runRelative + '/status.json'))?.kind === 'file')
          await fsp.unlink(await fs.resolve(runRelative + '/status.json'));
      } catch {}
    }
    const signal = completion.signal;
    const record = {
      schemaVersion: 1,
      reducerVersion: 1,
      runId,
      workspaceId: start.workspaceId,
      checkId: config.checkId,
      configHash: start.configHash,
      integration: {
        name: 'vitest',
        version: 1,
        runnerVersion: runnerPackage.version,
      },
      startedAt,
      endedAt,
      process: {
        exitCode: completion.exitCode,
        signal: signal
          ? [
              'SIGINT',
              'SIGTERM',
              'SIGKILL',
              'SIGHUP',
              'SIGABRT',
              'SIGSEGV',
            ].includes(signal)
            ? signal
            : 'OTHER'
          : null,
        interrupted: interrupt !== null,
      },
      scope: {
        kind: config.filters.length ? 'filtered' : 'suite',
        filters: config.filters,
      },
      ...parsed,
      startSnapshot,
      endSnapshot,
      observation: {
        startEpoch: startSnapshot.epoch,
        endEpoch: endSnapshot.epoch,
        gap: gap || startSnapshot.observationGap || endSnapshot.observationGap,
      },
      provenance: { source: 'explicit-local-helper', endpointOnly: true },
    };
    let validation = parseEvidence(JSON.stringify(record), start);
    if (validation.integrity !== 'validated_local_record') {
      record.counts = {
        selected: 0,
        completed: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        todo: 0,
      };
      record.runner = { reportPresent: false, success: null, globalErrors: 0 };
      validation = parseEvidence(JSON.stringify(record), start);
    }
    if (validation.integrity !== 'validated_local_record')
      throw Error(
        'Helper record failed internal validation: ' + validation.reason,
      );
    await atomicJSON(fs, runRelative + '/record.json', record);
    await pruneEvidence(fs);
    return {
      record,
      exitCode: interrupt
        ? interrupt === 'SIGINT'
          ? 130
          : 143
        : signal
          ? signal === 'SIGINT'
            ? 130
            : 143
          : (completion.exitCode ?? 1),
    };
  } finally {
    watcher?.close();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const modes = args.filter((a) => ['--setup', '--init', '--help'].includes(a));
  const roots = args.filter((a) => !a.startsWith('-'));
  const usage =
    'Usage: node integrations/vitest/run.mjs [--setup|--init] [workspace-root]\n--setup: create defaults only; no tests run.\n--init: create defaults if missing, then run the check.\nExisting configuration is never overwritten. Without a root, use the current directory.';
  if (
    modes.length > 1 ||
    roots.length > 1 ||
    args.some((a) => a.startsWith('-') && !modes.includes(a))
  ) {
    console.error(usage);
    process.exitCode = 2;
  } else if (modes[0] === '--help') {
    console.log(usage);
  } else {
    try {
      const root = roots[0] ?? process.cwd();
      if (modes.length) {
        const setup = await initializeProject(root);
        console.log(
          (setup.created ? 'Created' : 'Kept existing') +
            ' .ernesto/config.json.',
        );
        console.log('Declared inputs: ' + setup.config.scope.roots.join(', '));
        console.log(
          'Review this scope; custom inputs, excluded files and external services are not inferred.',
        );
      }
      if (modes[0] === '--setup') {
        console.log(
          'Setup complete. No tests run. Run this helper without --setup when ready.',
        );
      } else {
        const result = await runCheck({ root });
        console.log('Ernesto recorded ' + result.record.runId);
        console.log(
          `Tests: ${result.record.counts.passed} passed; ${result.record.counts.failed} failed. Use /ernesto refresh or /ernesto evidence in Claude Code.`,
        );
        process.exitCode = result.exitCode;
      }
    } catch (e) {
      console.error('Ernesto helper: ' + e.message);
      process.exitCode = 2;
    }
  }
}
