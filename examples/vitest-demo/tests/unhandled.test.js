import { test, expect } from 'vitest';
test('assertions pass but an unhandled error is still evidence', async () => {
  Promise.reject(new Error('Synthetic unhandled error'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(2 + 2).toBe(4);
});
