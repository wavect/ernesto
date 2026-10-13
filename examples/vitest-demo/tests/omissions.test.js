import { test, expect } from 'vitest';
test('meaningful execution', () => expect(2 + 2).toBe(4));
test.skip('visible skipped case', () => {});
test.todo('visible todo case');
