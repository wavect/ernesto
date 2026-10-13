// Only this synthetic example is modified. Never accepts an arbitrary project path.
import * as fs from 'node:fs/promises';
const root = new URL('./', import.meta.url);
await fs.mkdir(new URL('.ernesto/', root), { recursive: true });
await fs.copyFile(
  new URL('ernesto.config.example.json', root),
  new URL('.ernesto/config.json', root),
);
await fs.writeFile(
  new URL('src/add.js', root),
  'export function add(a, b) {\n  return a + b;\n}\n',
);
try {
  await fs.unlink(new URL('vitest.config.js', root));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
console.log(
  'Synthetic demo source and reviewed configuration reset. Existing summaries are retained.',
);
