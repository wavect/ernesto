import * as fsp from 'node:fs/promises';
import path from 'node:path';
import { defaultCheckConfig } from '../../core/setup.js';
import {
  parseCheckConfig,
  SUPPORTED_VITEST_VERSION,
} from '../../core/evidence.js';
import { nodeFilesystem } from './node-fs.mjs';

export async function initializeProject(root = process.cwd()) {
  if (Number(process.versions.node.split('.')[0]) !== 24)
    throw Error('Use Node.js 24 for the Ernesto helper. No files changed.');
  const fs = await nodeFilesystem(root);
  const folder = await fs.stat('.ernesto');
  if (folder && folder.kind !== 'directory')
    throw Error('.ernesto must be a real project directory. No files changed.');
  const existing = await fs.stat('.ernesto/config.json');
  if (existing) {
    const config = parseCheckConfig(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await fs.read('.ernesto/config.json'),
      ),
    );
    return { config, created: false };
  }
  let runner;
  try {
    runner = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await fs.read('node_modules/vitest/package.json'),
      ),
    );
  } catch {
    throw Error(
      'Install project-local Vitest ' +
        SUPPORTED_VITEST_VERSION +
        ' first (for npm: npm install --save-dev vitest@' +
        SUPPORTED_VITEST_VERSION +
        '). Ernesto does not install dependencies.',
    );
  }
  if (runner.version !== SUPPORTED_VITEST_VERSION)
    throw Error(
      'This integration supports project-local Vitest ' +
        SUPPORTED_VITEST_VERSION +
        '. Keep your existing runner unchanged unless you choose to change it.',
    );
  const entries = await fsp.readdir(fs.root, { withFileTypes: true });
  const config = defaultCheckConfig(
    entries.map((e) => ({
      name: e.name,
      kind: e.isDirectory() ? 'directory' : e.isFile() ? 'file' : 'other',
    })),
  );
  if (!folder) {
    try {
      await fsp.mkdir(path.join(fs.root, '.ernesto'), { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  await fs.resolve('.ernesto');
  try {
    await fsp.writeFile(
      path.join(fs.root, '.ernesto/config.json'),
      JSON.stringify(config, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return {
      config: parseCheckConfig(
        new TextDecoder('utf-8', { fatal: true }).decode(
          await fs.read('.ernesto/config.json'),
        ),
      ),
      created: false,
    };
  }
  return { config, created: true };
}
