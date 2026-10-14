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
import { helperCommand } from '../core/setup.js';
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
    },
    supported: false,
    cwd: '',
    surface: null,
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
async function refresh($, ctx) {
  if (
    !ctx.state.enabled ||
    ctx.state.prefs.hidden ||
    ctx.busy ||
    !ctx.supported
  )
    return;
  if (!ctx.fs || !ctx.config) {
    const connecting = ctx.generation;
    try {
      await setup($, ctx, true);
    } catch {
      if (connecting === ctx.generation && ctx.state.enabled) {
        ctx.state.qa = {
          ...initialEvidence(),
          reason:
            'Setup needed. Run /ernesto setup for the exact local command.',
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
async function setup($, ctx, enable) {
  if (!ctx.supported) throw Error('Claude Code 2.1.296 or later required');
  const ticket = ctx.generation;
  const candidate = await workspaceFS($, ctx.cwd);
  const raw = await candidate.read('.ernesto/config.json');
  if (raw.length > 8192) throw Error('Config too large');
  const reviewed = parseCheckConfig(
    new TextDecoder('utf-8', { fatal: true }).decode(raw),
  );
  const preview = `Configuration ready. Run this in your PROJECT terminal when ready:\n${helperCommand($.plugin.root)}\nThen /ernesto evidence for the result.\nScope: ${reviewed.scope.roots.length} declared input roots; review .ernesto/config.json or /ernesto evidence for the full list and exclusions. Custom project inputs may need adding.\nRuntime: ${reviewed.runtimeDescriptor}. Project tests use your environment and may access the network.\nErnesto has not launched tests; running the terminal command above executes them.\n/ernesto qa on resumes observation; /ernesto qa off pauses it and remembers your choice.`;
  if (!enable) return preview;
  if (ticket !== ctx.generation || !ctx.state.prefs.qa)
    return 'Setup interrupted by a newer workspace or preference change. Run /ernesto status.';
  ctx.fs = candidate;
  ctx.config = reviewed;
  ctx.state.enabled = true;
  ctx.generation++;
  ctx.state.qa = initialEvidence();
  poll($, ctx);
  await refresh($, ctx);
  return 'Project QA enabled. ' + preview;
}
async function gettingStarted($, ctx, doctor = false) {
  if (!ctx.supported)
    return 'Use Claude Code 2.1.296 or later, reload the plugin, then /ernesto setup. No project files read or changed.';
  let candidate;
  let summary;
  try {
    summary = await setup($, ctx, false);
  } catch {
    summary = `Project setup is needed (configuration missing, unreadable or invalid). No files changed.\nIn your PROJECT terminal, create conventional defaults and run the first check explicitly:\n${helperCommand($.plugin.root, '--init')}\nTo create defaults without running tests:\n${helperCommand($.plugin.root, '--setup')}\nExisting configuration is never overwritten. Review .ernesto/config.json for custom source, test and configuration inputs.\nAfterward, /ernesto refresh or /ernesto evidence. QA observation is ${ctx.state.prefs.qa ? 'on' : 'off; use /ernesto qa on to resume'}.`;
  }
  if (doctor) {
    let runner =
      'Missing or unreadable. Install project-local Vitest 4.1.11 yourself (npm install --save-dev vitest@4.1.11), or keep companion mode.';
    try {
      candidate = await workspaceFS($, ctx.cwd);
      const installed = JSON.parse(
        new TextDecoder().decode(
          await candidate.read('node_modules/vitest/package.json'),
        ),
      );
      runner =
        installed.version === '4.1.11'
          ? 'Vitest 4.1.11 is installed.'
          : 'Unsupported runner version. This integration requires Vitest 4.1.11; no dependencies changed.';
    } catch {}
    summary =
      'Host: supported Claude Code.\nRunner: ' +
      runner +
      '\nNode: the explicit helper checks for Node.js 24.\n' +
      summary;
  }
  return summary;
}
export function register(on, options = {}) {
  const ctx = createContext(options);
  on('session.start', async ($, e, next) => {
    stop(ctx);
    ctx.cwd = e.cwd;
    ctx.surface = e.surface;
    ctx.key = 'v1.' + sha256('ernesto-preferences\0' + ctx.cwd);
    ctx.state.enabled = false;
    ctx.state.qa = initialEvidence();
    ctx.fs = null;
    ctx.config = null;
    ctx.generation++;
    ctx.epoch = 0;
    ctx.tainted.clear();
    ctx.busy = false;
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
        description: 'Companion controls and scoped Vitest evidence',
        argumentHint: '[setup|doctor|evidence|qa on|qa off]',
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
      ctx.generation++;
      schedule($, ctx);
    }
    return next(e);
  });
  on('tool.call', async ($, e, next) => {
    try {
      if (['Write', 'Edit', 'Bash'].includes(e.tool)) {
        ctx.epoch++;
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
            (c.action === 'help' ? HELP : 'Ernesto 0.2.0 status') +
            '\nSurface: ' +
            (ctx.surface || 'text fallback') +
            '; ' +
            (ctx.supported
              ? 'supported host'
              : 'requires Claude Code 2.1.296+') +
            '\n' +
            statusText(ctx.state.qa, ctx.state.enabled, ctx.config),
        };
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
            text:
              'QA observation on; setup needed.\n' +
              (await gettingStarted($, ctx)),
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
          text: 'A rigorous compensation policy. QA evidence is unchanged.',
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
          text: detailsText(ctx.state.qa, ctx.state.enabled, ctx.config),
        };
      }
      if (c.action === 'evidence') {
        if (ctx.surface === 'terminal' || ctx.surface === 'desktop')
          await $.ui.open({
            id: 'ernesto-evidence',
            title: 'Ernesto evidence',
            focus: true,
            closeOnEscape: true,
          });
        return {
          text: detailsText(ctx.state.qa, ctx.state.enabled, ctx.config),
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
      $.plugin.root,
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
        )
      : next(e),
  );
}
