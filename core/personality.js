// Bundled banter, selected only from activity categories, never project content.
export const BANTER = Object.freeze(
  Object.fromEntries(
    Object.entries({
      idle: [
        'Your rubber duck quit. You got me.',
        'Thinking, or did we hit your loading screen?',
        'Take your time, keyboard goblin. Doubt ages well.',
        'I have no hands. Somehow, I am still supervising.',
      ],
      wake: [
        'Back again, you sentient TODO.',
        'Welcome back, chaos intern.',
        'Ah, my favorite source of preventable incidents.',
        "Let's make that confidence testable.",
      ],
      focus: [
        'Reading your code. Chocolate will be invoiced.',
        'Hold still, keyboard goblin. I am reading.',
        'Reading. Try not to invent a new bug meanwhile.',
        'Two eyes. Both professionally suspicious.',
      ],
      activity: [
        'Look at you, pressing buttons with consequences.',
        'Bold moves, keyboard goblin. Receipts, please.',
        'Another tool call. Truly, the plot thickens.',
        'Busy is a personality. Verified is a result.',
      ],
      complete: [
        'Claude said done. Adorable. Receipts?',
        'Congratulations on reaching the claim stage.',
        "'Done' is a lovely theory, chaos intern.",
        "The typing stopped. Let's not get carried away.",
      ],
      chocolate: [
        'A bribe? Finally, some competent engineering.',
        'You fed the snail. A rare display of judgment.',
        'Excellent. Your strongest technical skill.',
        'Chocolate accepted. Standards remain inconvenient.',
      ],
      checking: ['Comparing inputs. Your confidence can wait.'],
      passed: ['A passing result. Do try to remain unbearable in moderation.'],
      failed: ['Well, that was confidently wrong. Inspect the failure.'],
      stale: ['You changed the inputs, genius. The old result did not follow.'],
      unknown: ['Evidence missing. Vibes remain inadmissible, counselor.'],
    }).map(([pose, lines]) => [pose, Object.freeze(lines)]),
  ),
);
export function personalityLine(pose, index = 0) {
  const lines = Object.hasOwn(BANTER, pose) ? BANTER[pose] : BANTER.idle;
  const offset = Number.isSafeInteger(index) && index >= 0 ? index : 0;
  return lines[offset % lines.length];
}
