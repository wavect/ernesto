import * as fsp from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import { safeRelative } from '../../core/snapshot.js';
export async function nodeFilesystem(root) {
  const canonical = await fsp.realpath(root);
  async function resolve(relative, { allowMissing = false } = {}) {
    if (!safeRelative(relative)) throw Error('Unsafe relative path');
    let current = canonical;
    const parts = relative.split('/');
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      let st;
      try {
        st = await fsp.lstat(current);
      } catch (e) {
        if (allowMissing && e.code === 'ENOENT') return null;
        throw e;
      }
      if (st.isSymbolicLink()) throw Error('Symlink input unsupported');
      if (i < parts.length - 1 && !st.isDirectory())
        throw Error('Invalid parent');
    }
    const real = await fsp.realpath(current);
    if (real !== canonical && !real.startsWith(canonical + path.sep))
      throw Error('Outside workspace');
    return real;
  }
  return {
    canonicalRoot: async () => canonical,
    async stat(relative) {
      try {
        const absolute = await resolve(relative, { allowMissing: true });
        if (!absolute) return null;
        const st = await fsp.lstat(absolute);
        if (st.isDirectory()) {
          try {
            await fsp.lstat(path.join(absolute, '.git'));
            return { kind: 'submodule', size: 0 };
          } catch (e) {
            if (e.code !== 'ENOENT') throw e;
          }
        }
        return {
          kind: st.isFile() ? 'file' : st.isDirectory() ? 'directory' : 'other',
          size: st.size,
        };
      } catch (e) {
        if (e.message === 'Symlink input unsupported')
          return { kind: 'symlink', size: 0 };
        throw e;
      }
    },
    async list(relative) {
      return (await fsp.readdir(await resolve(relative))).sort();
    },
    async read(relative) {
      const abs = await resolve(relative);
      const handle = await fsp.open(
        abs,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const st = await handle.stat();
        if (!st.isFile() || st.size > 2 * 1024 * 1024)
          throw Error('Unsafe file');
        return new Uint8Array(await handle.readFile());
      } finally {
        await handle.close();
      }
    },
    resolve,
    root: canonical,
  };
}
