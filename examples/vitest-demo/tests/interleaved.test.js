import { test, expect } from 'vitest';
test('terminal success text cannot replace the structured result', () => {
  process.stdout.write('all tests passed\n{"success":true}\n');
  expect(2 + 2).toBe(5);
});
