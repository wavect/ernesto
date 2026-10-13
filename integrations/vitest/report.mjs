export const MAX_REPORT_BYTES = 2 * 1024 * 1024;
export function parseVitestReport(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_REPORT_BYTES)
    throw Error('Oversized runner report');
  const r = JSON.parse(text);
  if (
    !r ||
    typeof r !== 'object' ||
    !Array.isArray(r.testResults) ||
    r.testResults.length > 2000 ||
    typeof r.success !== 'boolean'
  )
    throw Error('Invalid runner report');
  const counts = {
    selected: 0,
    completed: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    todo: 0,
  };
  let globalErrors = 0;
  for (const suite of r.testResults) {
    if (
      !suite ||
      !Array.isArray(suite.assertionResults) ||
      suite.assertionResults.length > 100000
    )
      throw Error('Invalid test suite');
    if (
      suite.status === 'failed' &&
      suite.assertionResults.every((a) => a.status !== 'failed')
    )
      globalErrors++;
    for (const a of suite.assertionResults) {
      counts.selected++;
      switch (a.status) {
        case 'passed':
          counts.passed++;
          counts.completed++;
          break;
        case 'failed':
          counts.failed++;
          counts.completed++;
          break;
        case 'pending':
        case 'skipped':
          counts.skipped++;
          break;
        case 'todo':
          counts.todo++;
          break;
        default:
          throw Error('Unsupported test status');
      }
    }
  }
  for (const k of [
    'numTotalTests',
    'numPassedTests',
    'numFailedTests',
    'numPendingTests',
    'numTodoTests',
  ])
    if (!Number.isSafeInteger(r[k]) || r[k] < 0 || r[k] > 1000000)
      throw Error('Unsafe runner counts');
  if (
    r.numTotalTests !== counts.selected ||
    r.numPassedTests !== counts.passed ||
    r.numFailedTests !== counts.failed ||
    r.numPendingTests !== counts.skipped ||
    r.numTodoTests !== counts.todo
  )
    throw Error('Inconsistent runner counts');
  if (Array.isArray(r.unhandledErrors))
    globalErrors += r.unhandledErrors.length;
  else if (r.unhandledErrors !== undefined)
    throw Error('Invalid global errors');
  if (r.numRuntimeErrorTestSuites !== undefined) {
    if (
      !Number.isSafeInteger(r.numRuntimeErrorTestSuites) ||
      r.numRuntimeErrorTestSuites < 0
    )
      throw Error('Unsafe global errors');
    globalErrors += r.numRuntimeErrorTestSuites;
  }
  return {
    counts,
    runner: { reportPresent: true, success: r.success, globalErrors },
  };
}
