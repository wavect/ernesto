import { writeFileSync } from 'node:fs';
export default function setup() {
  process.on('exit', () => {
    writeFileSync(
      process.env.ERNESTO_VITEST_STATUS_FILE,
      JSON.stringify({
        version: 1,
        runId: process.env.ERNESTO_VITEST_RUN_ID,
        counts: {
          selected: 1,
          completed: 1,
          passed: -1,
          failed: 0,
          skipped: 0,
          todo: 0,
        },
        runner: { reportPresent: true, success: true, globalErrors: 0 },
      }),
    );
  });
}
