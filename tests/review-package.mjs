import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (data) => createHash('sha256').update(data).digest('hex');
function runPython(args, cwd = root) {
  const result = spawnSync('python3', args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
function pngChunks(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let at = 8;
  const chunks = [];
  while (at < bytes.length) {
    assert.ok(at + 12 <= bytes.length, 'truncated PNG');
    const size = bytes.readUInt32BE(at);
    assert.ok(at + 12 + size <= bytes.length, 'out-of-bounds PNG chunk');
    const type = bytes.toString('ascii', at + 4, at + 8);
    chunks.push(type);
    at += 12 + size;
  }
  assert.equal(chunks.at(-1), 'IEND');
  return chunks;
}
const forbiddenPath = new RegExp(
  '\\x2f(?:Users|home)\\x2f[^/\\s]+|[A-Z]:\\\\Users\\\\|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----',
);
test('distributable mascot PNGs contain no textual or EXIF metadata', async () => {
  for (const name of await fs.readdir(path.join(root, 'assets'))) {
    if (!name.endsWith('.png')) continue;
    const chunks = pngChunks(
      await fs.readFile(path.join(root, 'assets', name)),
    );
    for (const type of ['tEXt', 'zTXt', 'iTXt', 'eXIf'])
      assert.ok(
        !chunks.includes(type),
        name + ' contains unreviewed metadata ' + type,
      );
  }
});
test('source archive is deterministic, complete, private-state-free and content-verified', async () => {
  runPython(['scripts/package.py']);
  const folder = path.join(root, '.agent-cache/package');
  const first = await fs.readFile(path.join(folder, 'ernesto-source.tar.gz'));
  const inventory = JSON.parse(
    await fs.readFile(path.join(folder, 'CONTENTS.sha256.json'), 'utf8'),
  );
  const checksums = await fs.readFile(path.join(folder, 'SHA256SUMS'), 'utf8');
  assert.equal(checksums.trim(), hash(first) + '  ernesto-source.tar.gz');
  runPython(['scripts/package.py']);
  assert.deepEqual(
    await fs.readFile(path.join(folder, 'ernesto-source.tar.gz')),
    first,
    'same source produced a different archive',
  );
  const entries = JSON.parse(
    runPython([
      '-c',
      `import tarfile,json,hashlib
with tarfile.open('.agent-cache/package/ernesto-source.tar.gz') as a:
 print(json.dumps([{'name':m.name,'type':m.type.decode(),'mode':m.mode,'mtime':m.mtime,'uid':m.uid,'gid':m.gid,'digest':hashlib.sha256(a.extractfile(m).read()).hexdigest()} for m in a]))`,
    ]),
  );
  assert.equal(entries.length, Object.keys(inventory).length);
  const names = [];
  for (const entry of entries) {
    assert.equal(entry.type, '0');
    assert.equal(entry.mode, 0o644);
    assert.equal(entry.mtime, 0);
    assert.equal(entry.uid, 0);
    assert.equal(entry.gid, 0);
    assert.ok(entry.name.startsWith('ernesto/'));
    const name = entry.name.slice(8);
    assert.ok(name.split('/').every((p) => p && p !== '.' && p !== '..'));
    assert.ok(
      !name
        .split('/')
        .some((p) =>
          [
            '.git',
            'node_modules',
            '.agent-cache',
            '.agent-worktrees',
            '.ernesto',
            '__pycache__',
            'graft',
            'graphify-out',
          ].includes(p),
        ),
    );
    assert.ok(
      !name.includes('execution-status') &&
        !name.includes('docs/plans/') &&
        !name.includes('Agent_Pack'),
    );
    assert.equal(entry.digest, inventory[name]);
    assert.equal(entry.digest, hash(await fs.readFile(path.join(root, name))));
    names.push(name);
    if (/\.(?:[cm]?js|ts|json|md|py|ya?ml)$/.test(name)) {
      assert.ok(
        !forbiddenPath.test(await fs.readFile(path.join(root, name), 'utf8')),
        'private path or credential pattern in ' + name,
      );
    }
  }
  for (const required of [
    '.claude-plugin/plugin.json',
    '.claude-plugin/marketplace.json',
    'hooks/register.js',
    'core/evidence.js',
    'core/snapshot.js',
    'ui/view.js',
    'assets/ernesto.png',
    'LICENSE',
    'ASSET_LICENSE.md',
    'THIRD_PARTY_NOTICES.md',
    'docs/install.md',
    'docs/privacy.md',
    'integrations/vitest/run.mjs',
    'integrations/vitest/errors-reporter.mjs',
    'examples/vitest-demo/package-lock.json',
  ])
    assert.ok(
      names.includes(required),
      'missing installed/source artifact ' + required,
    );
  const plugin = JSON.parse(
    await fs.readFile(path.join(root, '.claude-plugin/plugin.json')),
  );
  const marketplace = JSON.parse(
    await fs.readFile(path.join(root, '.claude-plugin/marketplace.json')),
  );
  assert.equal(plugin.name, 'ernesto');
  assert.equal(marketplace.name, 'ernesto');
  assert.equal(marketplace.plugins[0].name, 'ernesto');
  assert.equal(marketplace.plugins[0].source, './');
});
