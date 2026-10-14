import { parseCheckConfig, SUPPORTED_VITEST_VERSION } from './evidence.js';
import { excludedPath, safeRelative } from './snapshot.js';

const INPUT_DIRECTORIES = new Set([
  'src',
  'test',
  'tests',
  '__tests__',
  'spec',
  'specs',
  'lib',
  'app',
  'apps',
  'packages',
  'pages',
  'components',
  'server',
  'client',
  'api',
  'shared',
  'common',
  'services',
  'scripts',
  'config',
  'fixtures',
  'types',
  'utils',
  'core',
  'hooks',
  'ui',
]);
const INPUT_FILES = new Set([
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'tsconfig.json',
  'jsconfig.json',
  ...['vitest.config', 'vitest.workspace', 'vite.config'].flatMap((name) =>
    ['js', 'ts', 'mjs', 'mts', 'cjs', 'cts'].map(
      (extension) => name + '.' + extension,
    ),
  ),
]);

export function defaultCheckConfig(entries) {
  if (!Array.isArray(entries) || entries.length > 512)
    throw Error(
      'Project root has too many entries. Create a reviewed config manually.',
    );
  if (
    entries.some((e) => INPUT_DIRECTORIES.has(e.name) && e.kind !== 'directory')
  )
    throw Error(
      'A conventional input directory is unsafe. Create a reviewed config manually.',
    );
  const discovered = entries
    .filter(
      ({ name, kind }) =>
        safeRelative(name) &&
        !name.includes('/') &&
        !excludedPath(name) &&
        ((kind === 'directory' && INPUT_DIRECTORIES.has(name)) ||
          (kind === 'file' &&
            (INPUT_FILES.has(name) ||
              /\.[cm]?[jt]sx?$/.test(name) ||
              /^tsconfig\.[a-z0-9.-]+\.json$/i.test(name)) &&
            !name.startsWith('.') &&
            !/^(?:secrets?|credentials?)(?:\.|$)/i.test(name))),
    )
    .map(({ name }) => name)
    .sort();
  const roots = [...new Set([...discovered, ...INPUT_FILES])].sort();
  const hasCodeInputs = discovered.some(
    (name) => !INPUT_FILES.has(name) && !/^tsconfig\./i.test(name),
  );
  if (!hasCodeInputs || roots.length > 64)
    throw Error(
      'No bounded conventional input scope found. Create a reviewed config manually.',
    );
  return parseCheckConfig(
    JSON.stringify({
      version: 1,
      checkId: 'vitest',
      scope: { roots, excludes: [] },
      filters: [],
      runtimeDescriptor: 'node-24/vitest-' + SUPPORTED_VITEST_VERSION,
    }),
  );
}

export function shellQuote(value) {
  if (
    typeof value !== 'string' ||
    /[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(
      value,
    )
  )
    throw Error('Helper path contains unsupported characters');
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export function helperCommand(pluginRoot, flag = '') {
  if (flag && !['--init', '--setup'].includes(flag))
    throw Error('Unsupported helper mode');
  return (
    'node ' +
    shellQuote(pluginRoot + '/integrations/vitest/run.mjs') +
    (flag ? ' ' + flag : '')
  );
}
