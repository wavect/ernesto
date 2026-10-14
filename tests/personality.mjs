import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companion, INITIAL_COMPANION } from '../core/companion.js';
import { BANTER } from '../core/personality.js';

test('banter varies on activity, stays bounded and does not retain arbitrary previous content', () => {
  let mood = {
    ...INITIAL_COMPANION,
    caption: 'private prompt',
    filename: 'private path',
  };
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const previous = mood;
    mood = companion(mood, 'chocolate', i);
    seen.add(mood.caption);
    assert.ok(BANTER.chocolate.includes(mood.caption));
    assert.ok(mood.banterIndex >= 0 && mood.banterIndex < 4);
    assert.notEqual(mood.caption, previous.caption);
    assert.doesNotMatch(JSON.stringify(mood), /private prompt|private path/);
  }
  assert.equal(seen.size, 4);
  assert.equal(companion(mood, 'unrecognized category', 100), mood);
});
