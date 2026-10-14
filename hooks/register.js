import {
  HELP,
  parseCommand,
  companion,
  INITIAL_COMPANION,
  validPreferences,
} from '../core/companion.js';
import { captureSnapshot, sha256, safeRelative } from '../core/snapshot.js';
import {
  initialEvidence,
  reduceEvidence,
  parseEvidence,
  parseRunStart,
  parseCheckConfig,
  evidenceRecordPath,
  MAX_RECORD_BYTES,
} from '../core/evidence.js';
import { drawBand, drawPane, detailsText, statusText } from '../ui/view.js';
import { defaultCheckConfig } from '../core/setup.js';
import {
  detectProject,
  commandSummary,
  compareCommand,
  outputPreview,
} from '../core/project.js';
async function workspaceFS($, cwd) {
  const rootInfo = await $.fs.stat(cwd, { resolve: true });
  const root = rootInfo.realPath?.replace(/\/$/, '');
  if (
    !root ||
    rootInfo.kind !== 'dir' ||
    rootInfo.isLink ||
    !root.startsWith('/')
  )
    throw Error('Unsupported workspace root');
  async function guarded(path) {
    if (!safeRelative(path)) throw Error('Unsafe relative path');
    const segments = path.split('/');
    for (let i = 1; i < segments.length; i++) {
      const ancestor = await $.fs.stat(
        root + '/' + segments.slice(0, i).join('/'),
        { resolve: true },
      );
      if (
        ancestor.isLink ||
        ancestor.kind !== 'dir' ||
        ancestor.realPath !== root + '/' + segments.slice(0, i).join('/')
      )
        throw Error('Unsafe ancestor');
    }
    let info;
    try {
      info = await $.fs.stat(root + '/' + path, { resolve: true });
    } catch (error) {
      if (/ENOENT/.test(String(error))) return null;
      throw error;
    }
    if (!info.realPath || !info.realPath.startsWith(root + '/') || info.isLink)
      return { kind: 'symlink', size: 0 };
    if (info.kind === 'dir') {
      const children = await $.fs.list(root + '/' + path);
      if (children.some((x) => x.name === '.git'))
        return { kind: 'submodule', size: 0 };
    }
    return { ...info, kind: info.kind === 'dir' ? 'directory' : info.kind };
  }
  return {
    root,
    canonicalRoot: async () => root,
    stat: guarded,
    list: async (path) => {
      const info = await guarded(path);
      if (info?.kind !== 'directory') throw Error('Unsafe directory');
      return (await $.fs.list(root + '/' + path)).map((x) => x.name);
    },
    read: async (path) => {
      const info = await guarded(path);
      if (info?.kind !== 'file' || info.size > 2 * 1024 * 1024)
        throw Error('Unsafe file');
      const { base64 } = await $.fs.read(root + '/' + path, { as: 'bytes' });
      const bytes = Uint8Array.fromBase64(base64);
      const after = await guarded(path);
      if (
        after?.kind !== 'file' ||
        after.realPath !== info.realPath ||
        after.size !== info.size ||
        after.mtimeMs !== info.mtimeMs
      )
        throw Error('File changed while reading');
      return bytes;
    },
  };
}

function createContext(options) {
  const defaults = {
    quiet: options.quiet === true,
    reducedMotion: options.reducedMotion !== false,
    hidden: options.hidden === true,
    qa: options.qa !== false,
  };
  return {
    defaults,
    state: {
      prefs: { ...defaults },
      mood: INITIAL_COMPANION,
      qa: initialEvidence(),
      enabled: false,
      frame: 0,
      detailsExpanded: false,
      project: null,
      projectRun: null,
    },
    checkTask: null,
    projectFS: null,
    projectScope: null,
    supported: false,
    cwd: '',
    surface: null,
    interactive: false,
    key: '',
    timer: null,
    animation: null,
    pending: null,
    busy: false,
    generation: 0,
    epoch: 0,
    fs: null,
    config: null,
    tainted: new Set(),
  };
}
const invalidate = ($) => {
  try {
    $.ui.invalidate('ui.render');
  } catch {}
};
const stop = (ctx) => {
  ctx.timer?.cancel();
  ctx.timer = null;
  ctx.pending?.cancel();
  ctx.pending = null;
  ctx.animation?.cancel();
  ctx.animation = null;
};
async function now($) {
  return $.clock.now();
}
async function save($, ctx, field) {
  await $.store.set(ctx.key + '.' + field, ctx.state.prefs[field]);
}
async function load($, ctx) {
  for (const field of Object.keys(ctx.defaults)) {
    const value = await $.store
      .get(ctx.key + '.' + field)
      .catch(() => undefined);
    ctx.state.prefs[field] = validPreferences({ [field]: value }, ctx.defaults)[
      field
    ];
  }
}
function move($, ctx, action) {
  // Category-only activity, no prompts, filenames, arguments, or outputs are retained.
  ctx.state.mood = companion(ctx.state.mood, action, ctx.epoch);
  ctx.state.frame = 0;
  ctx.animation?.cancel();
  ctx.animation = null;
  if (!ctx.state.prefs.hidden && !ctx.state.prefs.reducedMotion) {
    ctx.animation = $.clock.every(600, () => {
      ctx.state.frame++;
      if (ctx.state.frame >= 4) {
        ctx.animation?.cancel();
        ctx.animation = null;
        ctx.state.mood = companion(ctx.state.mood, 'idle', ctx.epoch);
        ctx.state.frame = 0;
      }
      invalidate($);
    });
  }
  invalidate($);
}
async function refresh($, ctx, checkToken = null) {
  if (
    !ctx.state.enabled ||
    ctx.state.prefs.hidden ||
    ctx.busy ||
    !ctx.supported ||
    (ctx.checkTask && ctx.checkTask !== checkToken)
  )
    return;
  if (!ctx.state.project) await discover($, ctx);
  if (ctx.state.projectRun?.kind === 'command') {
    await refreshCommand($, ctx);
    return;
  }
  if (!ctx.fs || !ctx.config) {
    const connecting = ctx.generation;
    try {
      await setup($, ctx, true);
    } catch {
      if (connecting === ctx.generation && ctx.state.enabled) {
        ctx.state.qa = {
          ...initialEvidence(),
          reason:
            'Companion ready. Choose Check project to run a detected project check.',
        };
        invalidate($);
      }
    }
    return;
  }
  ctx.busy = true;
  const ticket = ctx.generation;
  const beginEpoch = ctx.epoch;
  ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'pending' });
  invalidate($);
  try {
    const installed = JSON.parse(
      new TextDecoder().decode(
        await ctx.fs.read('node_modules/vitest/package.json'),
      ),
    );
    if (installed.version !== '4.1.11') throw Error('Runner version changed');
    const currentConfig = parseCheckConfig(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await ctx.fs.read('.ernesto/config.json'),
      ),
    );
    ctx.config = currentConfig;
    const snapshot = await captureSnapshot({
      root: ctx.fs.root,
      scope: ctx.config.scope,
      runtime: ctx.config.runtimeDescriptor,
      checkDefinition: ctx.config,
      fs: ctx.fs,
      now: await now($),
      epoch: beginEpoch,
    });
    const expected = {
      workspaceId: snapshot.workspaceId,
      checkId: ctx.config.checkId,
      configHash: snapshot.configHash,
    };
    const runRoot = await ctx.fs.stat('.ernesto/runs');
    const entries = runRoot ? await ctx.fs.list('.ernesto/runs') : [];
    if (entries.length > 100) throw Error('Evidence directory exceeds limit');
    const records = [];
    for (const name of entries) {
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          name,
        )
      )
        continue;
      const path = evidenceRecordPath(name);
      const info = await ctx.fs.stat(path);
      if (!info) {
        const started = await ctx.fs.stat(
          '.ernesto/runs/' + name + '/started.json',
        );
        if (started?.kind === 'file' && started.size <= 4096) {
          const start = parseRunStart(
            new TextDecoder().decode(
              await ctx.fs.read('.ernesto/runs/' + name + '/started.json'),
            ),
            { ...expected, runId: name },
          );
          if (start) records.push({ start, mtime: start.startedAt });
          else
            records.push({
              parsed: { integrity: 'invalid', reason: 'Malformed run start' },
              mtime: started.mtimeMs,
            });
        } else if (started)
          records.push({
            parsed: { integrity: 'invalid', reason: 'Unsafe run start' },
            mtime: started.mtimeMs,
          });
        continue;
      }
      if (info.kind !== 'file' || info.size > MAX_RECORD_BYTES) {
        records.push({
          parsed: {
            integrity: 'invalid',
            reason: 'Unsafe or oversized evidence record',
          },
          mtime: info.mtimeMs,
        });
        continue;
      }
      const ownExpected = {
        workspaceId: snapshot.workspaceId,
        checkId: ctx.config.checkId,
        runId: name,
      };
      const startPath = '.ernesto/runs/' + name + '/started.json';
      const startInfo = await ctx.fs.stat(startPath);
      const start =
        startInfo?.kind === 'file' && startInfo.size <= 4096
          ? parseRunStart(
              new TextDecoder('utf-8', { fatal: true }).decode(
                await ctx.fs.read(startPath),
              ),
              ownExpected,
            )
          : null;
      let parsed = start
        ? parseEvidence(
            new TextDecoder('utf-8', { fatal: true }).decode(
              await ctx.fs.read(path),
            ),
            { ...ownExpected, configHash: start.configHash },
          )
        : { integrity: 'invalid', reason: 'Missing or invalid own run start' };
      if (parsed.record && parsed.record.startedAt !== start.startedAt)
        parsed = {
          integrity: 'invalid',
          reason: 'Run start timestamp mismatch',
        };
      records.push({ parsed, mtime: info.mtimeMs });
    }
    records.sort(
      (a, b) =>
        (a.parsed?.record?.startedAt ?? a.mtime) -
        (b.parsed?.record?.startedAt ?? b.mtime),
    );
    let qa = initialEvidence();
    for (const item of records)
      qa = reduceEvidence(
        qa,
        item.start
          ? { type: 'started', start: item.start }
          : { type: 'record', parsed: item.parsed },
      );
    qa = reduceEvidence(qa, { type: 'compare', snapshot });
    if (
      beginEpoch !== ctx.epoch ||
      (qa.record && ctx.tainted.has(qa.record.runId))
    )
      qa = reduceEvidence(qa, { type: 'gap' });
    if (
      ticket === ctx.generation &&
      ctx.state.enabled &&
      !ctx.state.prefs.hidden
    )
      ctx.state.qa = qa;
  } catch {
    if (ticket === ctx.generation)
      ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'gap' });
  } finally {
    ctx.busy = false;
    invalidate($);
  }
}
function schedule($, ctx) {
  if (!ctx.state.enabled || ctx.state.prefs.hidden || ctx.pending) return;
  ctx.pending = $.clock.after(100, () => {
    ctx.pending = null;
    void refresh($, ctx);
  });
}
function poll($, ctx) {
  ctx.timer?.cancel();
  ctx.timer = null;
  if (ctx.state.enabled && !ctx.state.prefs.hidden)
    ctx.timer = $.clock.every(1500, () => {
      void refresh($, ctx);
    });
}
async function setup($, ctx, enable, checkToken = null) {
  if (!ctx.supported) throw Error('Claude Code 2.1.296 or later required');
  const ticket = ctx.generation;
  const candidate = await workspaceFS($, ctx.cwd);
  const raw = await candidate.read('.ernesto/config.json');
  if (raw.length > 8192) throw Error('Config too large');
  const reviewed = parseCheckConfig(
    new TextDecoder('utf-8', { fatal: true }).decode(raw),
  );
  const preview = `Detailed Vitest evidence connected. /ernesto check runs your project check here.\nScope: ${reviewed.scope.roots.length} declared inputs. Existing custom configuration is preserved. No tests start automatically.`;
  if (!enable) return preview;
  if (ticket !== ctx.generation || !ctx.state.prefs.qa)
    return 'Setup interrupted by a newer workspace or preference change. Run /ernesto status.';
  ctx.fs = candidate;
  ctx.config = reviewed;
  ctx.state.enabled = true;
  ctx.generation++;
  ctx.state.qa = initialEvidence();
  poll($, ctx);
  await refresh($, ctx, checkToken);
  return 'Project QA enabled. ' + preview;
}
async function discover($, ctx, force = false) {
  if (!ctx.supported || !ctx.state.enabled || ctx.state.prefs.hidden) return;
  if (ctx.state.project && !force) return;
  const generation = ctx.generation;
  try {
    const fs = await workspaceFS($, ctx.cwd);
    const entries = await $.fs.list(fs.root);
    if (entries.length > 512) throw Error('Project root too large');
    let pkg = null,
      vitest = null;
    if (await fs.stat('package.json'))
      pkg = new TextDecoder().decode(await fs.read('package.json'));
    try {
      vitest = JSON.parse(
        new TextDecoder().decode(
          await fs.read('node_modules/vitest/package.json'),
        ),
      ).version;
    } catch {}
    const detected = detectProject(pkg, entries, vitest, $.plugin.root);
    let scope = null;
    try {
      scope = defaultCheckConfig(
        entries.map((e) => ({
          ...e,
          kind: e.kind === 'dir' ? 'directory' : e.kind,
        })),
      ).scope;
    } catch {}
    if (
      generation !== ctx.generation ||
      !ctx.state.enabled ||
      ctx.state.prefs.hidden
    )
      return;
    ctx.projectFS = fs;
    ctx.projectScope = scope;
    ctx.state.project = detected || {
      kind: 'none',
      label: 'No test or check command detected',
    };
  } catch {
    if (generation !== ctx.generation) return;
    ctx.state.project = {
      kind: 'none',
      label: 'Project checks are unavailable; the companion is ready',
    };
  }
  invalidate($);
}
async function commandSnapshot($, ctx, run) {
  if (!ctx.projectFS || !run.scope) return null;
  return captureSnapshot({
    root: ctx.projectFS.root,
    scope: run.scope,
    runtime: 'project-command-v1',
    checkDefinition: { argv: run.argv, scope: run.scope },
    fs: ctx.projectFS,
    now: await now($),
    epoch: ctx.epoch,
  });
}
async function refreshCommand($, ctx) {
  const run = ctx.state.projectRun;
  if (!run || run.status === 'running') return;
  const generation = ctx.generation;
  try {
    const snapshot = await commandSnapshot($, ctx, run);
    if (generation === ctx.generation && ctx.state.projectRun === run)
      ctx.state.projectRun = compareCommand(run, snapshot, ctx.epoch);
  } catch {
    if (generation === ctx.generation && ctx.state.projectRun === run)
      ctx.state.projectRun = { ...run, freshness: 'unknown' };
  }
  invalidate($);
}
async function checkProject($, ctx) {
  if (!ctx.supported)
    return 'Use Claude Code 2.1.296 or later for project checks.';
  if (!ctx.state.enabled || ctx.state.prefs.hidden)
    return 'Project checks are paused. /ernesto show and /ernesto qa on resume them.';
  if (ctx.checkTask) return 'A project check is already running.';
  const token = {};
  ctx.checkTask = token;
  const generation = ctx.generation;
  const active = () =>
    generation === ctx.generation &&
    ctx.checkTask === token &&
    ctx.state.enabled &&
    !ctx.state.prefs.hidden;
  try {
    await discover($, ctx, true);
    if (!active()) return 'Project check cancelled before launch.';
    const project = ctx.state.project;
    if (!project || project.kind === 'none')
      return 'Ernesto is ready. No test or check command was detected in this project. There is nothing to configure for the companion.';
    const startedAt = await now($);
    if (!active()) return 'Project check cancelled before launch.';
    const run = {
      kind: project.kind,
      label: project.label,
      argv: project.argv,
      status: 'running',
      freshness: 'unknown',
      exitCode: null,
      startedAt,
      scope: ctx.config?.scope || ctx.projectScope,
      startEpoch: ctx.epoch,
    };
    ctx.state.projectRun = run;
    ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'gap' });
    invalidate($);
    try {
      run.startSnapshot = await commandSnapshot($, ctx, run);
    } catch {}
    if (!active()) return 'Project check cancelled before launch.';
    const result = await $.process.run(project.argv, {
      cwd: ctx.projectFS.root,
      env: { CI: '1' },
      timeoutMs: 120000,
    });
    if (!active())
      return 'Check finished after observation changed; result discarded.';
    const validExit =
      Number.isInteger(result.exitCode) &&
      result.exitCode >= 0 &&
      result.exitCode <= 255;
    const completed = {
      ...run,
      status: validExit
        ? result.exitCode === 0
          ? 'completed'
          : 'failed'
        : 'unknown',
      exitCode: validExit ? result.exitCode : null,
      endedAt: await now($),
      endEpoch: ctx.epoch,
      output: outputPreview(result),
    };
    try {
      completed.endSnapshot = await commandSnapshot($, ctx, run);
    } catch {}
    if (!active())
      return 'Check finished after observation changed; result discarded.';
    ctx.state.projectRun = compareCommand(
      completed,
      completed.endSnapshot,
      ctx.epoch,
    );
    if (project.kind === 'vitest') {
      try {
        await setup($, ctx, true, token);
      } catch {}
      if (
        ctx.state.projectRun &&
        (!ctx.state.qa.record ||
          ctx.state.qa.record.startedAt < startedAt ||
          ctx.state.qa.record.endedAt > completed.endedAt)
      )
        ctx.state.projectRun = {
          ...ctx.state.projectRun,
          kind: 'command',
          reason:
            'The detailed Vitest integration could not produce a valid record. Inspect the command output in Details.',
        };
    }
    return ctx.state.projectRun?.kind === 'command'
      ? commandSummary(ctx.state.projectRun) +
          '. Open /ernesto evidence for details.'
      : statusText(
          ctx.state.qa,
          ctx.state.enabled,
          ctx.config,
          ctx.state.project,
        );
  } catch {
    if (active())
      ctx.state.projectRun = {
        ...ctx.state.projectRun,
        kind: 'command',
        status: 'unknown',
        freshness: 'unknown',
        exitCode: null,
        reason:
          'The check could not start, was denied, or timed out. Check that the project package manager is installed.',
      };
    return 'The project check could not complete. Ernesto is still ready; see /ernesto evidence.';
  } finally {
    if (ctx.checkTask === token) ctx.checkTask = null;
    invalidate($);
  }
}
async function gettingStarted($, ctx, doctor = false) {
  if (!ctx.supported)
    return 'Ernesto is available as a companion. Project checks need Claude Code 2.1.296 or later.';
  await discover($, ctx, true);
  const project = ctx.state.project;
  const ready = 'Ernesto is ready. No setup required.';
  const check =
    project && project.kind !== 'none'
      ? `Detected: ${project.label}. Choose Check project or type /ernesto check to run it here.`
      : 'No project test or check command detected. The companion works immediately.';
  return [
    ready,
    check,
    'Checks run only when you request them. No dependencies are installed.',
    doctor
      ? 'Detection supports existing npm/pnpm/yarn/bun test/check scripts, plus the optional Node 24 / Vitest 4.1.11 detailed integration. /ernesto refresh rereads evidence. Existing .ernesto/config.json remains optional.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
export function register(on, options = {}) {
  const ctx = createContext(options);
  on('session.start', async ($, e, next) => {
    stop(ctx);
    ctx.cwd = e.cwd;
    ctx.surface = e.surface;
    ctx.interactive = e.isInteractive === true;
    ctx.key = 'v1.' + sha256('ernesto-preferences\0' + ctx.cwd);
    ctx.state.enabled = false;
    ctx.state.qa = initialEvidence();
    ctx.fs = null;
    ctx.config = null;
    ctx.generation++;
    ctx.epoch = 0;
    ctx.tainted.clear();
    ctx.busy = false;
    ctx.checkTask = null;
    ctx.projectFS = null;
    ctx.projectScope = null;
    ctx.state.project = null;
    ctx.state.projectRun = null;
    try {
      const host = await $.session.version();
      const match = /^(\d+)\.(\d+)\.(\d+)/.exec(host.version);
      ctx.supported = Boolean(
        match &&
          (+match[1] > 2 ||
            (+match[1] === 2 &&
              (+match[2] > 1 || (+match[2] === 1 && +match[3] >= 296)))),
      );
      await load($, ctx);
      await $.command.register({
        name: 'ernesto',
        description: 'Companion controls and one-action project checks',
        argumentHint: '[check|setup|evidence|quiet on|qa off]',
        immediate: true,
      });
      ctx.state.enabled = ctx.supported && ctx.state.prefs.qa;
      poll($, ctx);
      schedule($, ctx);
    } catch {
      ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'gap' });
    }
    return next(e);
  });
  on('classic.SessionStart', async ($, e, next) => {
    if (['clear', 'resume', 'fork'].includes(e.source)) {
      ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'gap' });
      if (ctx.state.projectRun)
        ctx.state.projectRun = {
          ...ctx.state.projectRun,
          freshness: 'unknown',
          observationGap: true,
        };
      ctx.generation++;
      schedule($, ctx);
    }
    return next(e);
  });
  on('tool.call', async ($, e, next) => {
    try {
      if (['Write', 'Edit', 'Bash'].includes(e.tool)) {
        ctx.epoch++;
        if (ctx.state.projectRun)
          ctx.state.projectRun = {
            ...ctx.state.projectRun,
            freshness: 'unknown',
          };
        ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'gap' });
        if (ctx.state.qa.pendingRun) {
          ctx.tainted.add(ctx.state.qa.pendingRun.runId);
          if (ctx.tainted.size > 20)
            ctx.tainted.delete(ctx.tainted.values().next().value);
        }
      }
      move($, ctx, e.tool === 'Read' ? 'focus' : 'activity');
      schedule($, ctx);
    } catch {
      ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'gap' });
    }
    return next(e);
  });
  on('turn.complete', async ($, e, next) => {
    try {
      move($, ctx, 'complete');
      schedule($, ctx);
    } catch {}
    return next(e);
  });
  on('command.run', { command: 'ernesto' }, async ($, e) => {
    const c = parseCommand(e.args || '');
    try {
      if (c.action === 'invalid') return { text: 'Invalid command.\n' + HELP };
      if (c.action === 'help' || c.action === 'status')
        return {
          text:
            (c.action === 'help' ? HELP : 'Ernesto 0.3.0 status') +
            '\nSurface: ' +
            (ctx.surface || 'text fallback') +
            '; ' +
            (ctx.supported
              ? 'supported host'
              : 'requires Claude Code 2.1.296+') +
            '\n' +
            statusText(
              ctx.state.qa,
              ctx.state.enabled,
              ctx.config,
              ctx.state.project,
              ctx.state.projectRun,
            ),
        };
      if (c.action === 'check') return { text: await checkProject($, ctx) };
      if (c.action === 'setup' || c.action === 'doctor')
        return { text: await gettingStarted($, ctx, c.action === 'doctor') };
      if (c.action === 'qa enable') {
        if (!ctx.supported) throw Error('Unsupported host');
        ctx.state.prefs.qa = true;
        ctx.state.enabled = true;
        ctx.generation++;
        await save($, ctx, 'qa');
        poll($, ctx);
        try {
          return { text: await setup($, ctx, true) };
        } catch {
          ctx.fs = null;
          ctx.config = null;
          ctx.state.qa = initialEvidence();
          invalidate($);
          return {
            text: 'QA observation on.\n' + (await gettingStarted($, ctx)),
          };
        }
      }
      if (c.action === 'qa off') {
        ctx.state.prefs.qa = false;
        ctx.state.enabled = false;
        ctx.generation++;
        stop(ctx);
        ctx.fs = null;
        ctx.config = null;
        ctx.state.qa = initialEvidence();
        ctx.state.projectRun = null;
        await save($, ctx, 'qa');
        invalidate($);
        return {
          text: 'QA off. Remembered for this workspace, including new sessions. /ernesto qa on resumes it. Companion remains available.',
        };
      }
      if (c.action === 'hide' || c.action === 'show') {
        ctx.state.prefs.hidden = c.action === 'hide';
        ctx.generation++;
        if (ctx.state.prefs.hidden) {
          stop(ctx);
          ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'gap' });
          if (ctx.state.projectRun)
            ctx.state.projectRun = {
              ...ctx.state.projectRun,
              status:
                ctx.state.projectRun.status === 'running'
                  ? 'unknown'
                  : ctx.state.projectRun.status,
              freshness: 'unknown',
              observationGap: true,
              output: '',
            };
        } else {
          poll($, ctx);
          schedule($, ctx);
        }
        await save($, ctx, 'hidden');
        invalidate($);
        return {
          text: ctx.state.prefs.hidden
            ? 'Companion hidden; evidence work stopped.'
            : 'Companion shown. /ernesto evidence',
        };
      }
      if (c.action === 'quiet' || c.action === 'motion') {
        const field = c.action === 'quiet' ? 'quiet' : 'reducedMotion';
        ctx.state.prefs[field] = c.value;
        if (c.action === 'motion' && c.value) {
          ctx.animation?.cancel();
          ctx.animation = null;
          ctx.state.frame = 0;
        }
        await save($, ctx, field);
        invalidate($);
        return { text: `${field}: ${c.value}` };
      }
      if (c.action === 'chocolate') {
        move($, ctx, 'chocolate');
        return {
          text: ctx.state.prefs.quiet
            ? 'Chocolate accepted. QA evidence is unchanged.'
            : ctx.state.mood.caption + ' QA evidence is unchanged.',
        };
      }
      if (c.action === 'forget')
        return {
          text: 'Use /ernesto forget confirm to remove only Ernesto preferences for this workspace. Local runner reports remain yours.',
        };
      if (c.action === 'forget confirm') {
        for (const field of Object.keys(ctx.defaults))
          await $.store.delete(ctx.key + '.' + field);
        ctx.state.prefs = { ...ctx.defaults };
        ctx.state.prefs.qa = false;
        ctx.state.enabled = false;
        ctx.generation++;
        stop(ctx);
        ctx.state.qa = initialEvidence();
        ctx.state.projectRun = null;
        ctx.fs = null;
        ctx.config = null;
        invalidate($);
        return {
          text: 'Ernesto preferences cleared. QA off for this session; defaults apply next session. No project files removed.',
        };
      }
      if (c.action === 'refresh') {
        await refresh($, ctx);
        return {
          text: detailsText(
            ctx.state.qa,
            ctx.state.enabled,
            ctx.config,
            ctx.state.project,
            ctx.state.projectRun,
          ),
        };
      }
      if (c.action === 'evidence') {
        if (ctx.surface === 'terminal' || ctx.surface === 'desktop')
          await $.ui.open({
            id: 'ernesto-evidence',
            title: 'Ernesto evidence',
            rows: 28,
            focus: true,
            closeOnEscape: true,
          });
        return ctx.interactive &&
          (ctx.surface === 'terminal' || ctx.surface === 'desktop')
          ? {}
          : {
              text: detailsText(
                ctx.state.qa,
                ctx.state.enabled,
                ctx.config,
                ctx.state.project,
                ctx.state.projectRun,
              ),
            };
      }
    } catch {
      ctx.state.qa = reduceEvidence(ctx.state.qa, { type: 'gap' });
      invalidate($);
      return {
        text:
          'Ernesto could not complete that action. QA remains unknown. Check scope, local permissions and supported versions.\n' +
          HELP,
      };
    }
    return { text: HELP };
  });
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const theirs = await next(e);
    if (ctx.state.prefs.hidden || e.props.hasSurvey) return theirs;
    return drawBand(
      $.ui.resolve(e),
      e,
      theirs,
      { ...ctx.state, config: ctx.config },
      () => checkProject($, ctx),
    );
  });
  on('ui.render', { component: 'Pane' }, async ($, e, next) =>
    e.requestId === 'ernesto-evidence'
      ? drawPane(
          $.ui.resolve(e),
          e,
          { ...ctx.state, config: ctx.config },
          () => refresh($, ctx),
          () => $.ui.close({ id: 'ernesto-evidence' }),
          () => {
            ctx.state.detailsExpanded = !ctx.state.detailsExpanded;
            invalidate($);
          },
          () => checkProject($, ctx),
        )
      : next(e),
  );
}
