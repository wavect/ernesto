// Normalize Vitest's structured JSON in memory. Even an abrupt helper shutdown
// cannot leave test names, source paths, error bodies or raw logs on disk.
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseVitestReport } from './report.mjs';
const { JsonReporter } = await import(
  pathToFileURL(process.env.ERNESTO_VITEST_REPORTERS_MODULE).href
);
export default class ErnestoSummaryReporter extends JsonReporter {
  async onTestRunEnd(modules, errors, reason) {
    if (
      !['passed', 'failed', 'interrupted'].includes(reason) ||
      !Array.isArray(errors)
    )
      throw Error('Unsupported Vitest run completion');
    this.ernestoEnd = { reason, globalErrors: errors.length };
    await super.onTestRunEnd(modules);
  }
  async writeReport(text) {
    const file = process.env.ERNESTO_VITEST_STATUS_FILE;
    const runId = process.env.ERNESTO_VITEST_RUN_ID;
    if (!file || !runId || !this.ernestoEnd)
      throw Error('Missing helper-owned summary channel');
    const summary = parseVitestReport(text);
    summary.runner.globalErrors += this.ernestoEnd.globalErrors;
    summary.runner.success =
      summary.runner.success && this.ernestoEnd.reason === 'passed';
    await writeFile(file, JSON.stringify({ version: 1, runId, ...summary }), {
      flag: 'wx',
      mode: 0o600,
    });
  }
}
