import { test, expect } from 'vitest';
test('interruptible synthetic timer', async () => {
  await new Promise((resolve) => setTimeout(resolve, 10000));
  expect(true).toBe(true);
}, 20000);
