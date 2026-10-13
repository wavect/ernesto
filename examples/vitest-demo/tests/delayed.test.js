import { test, expect } from 'vitest';
test('time window for synthetic input mutation', async () => {
  await new Promise((resolve) => setTimeout(resolve, 900));
  expect(true).toBe(true);
});
