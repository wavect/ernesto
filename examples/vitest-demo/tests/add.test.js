import { test, expect } from 'vitest';
import { add } from '../src/add.js';
test('adds two synthetic numbers', () => expect(add(2, 3)).toBe(5));
