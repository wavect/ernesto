import { writeFileSync } from 'node:fs';
export default function setup() {
  process.on('exit', () => {
    // Synthetic adversarial fixture: corrupt only the helper-owned status channel.
    writeFileSync(process.env.ERNESTO_VITEST_STATUS_FILE, '{partial');
  });
}
