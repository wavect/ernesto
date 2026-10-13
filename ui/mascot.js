// Terminal-native pixel portrait derived from the owner-approved Ernesto master.
// Two eye stalks, turquoise spiral shell, pink body, white tooth line, no limbs.
const PALETTE = {
  '.': 0x01000000,
  t: 0x27b8c3,
  T: 0x167a88,
  p: 0xc99687,
  P: 0xac786d,
  w: 0xf7f6ed,
  b: 0x202b2b,
};
const BASE = [
  '..........www.www.',
  '..........wbw.wbw.',
  '..........pp..pp..',
  '..tttttt..pp..pp..',
  '.ttTTtttt.pppppp..',
  '.tTttTtttppppppp..',
  '.tTtTttttppwwwpp..',
  '..ttttttwppppppp..',
  '...wwwwwwppppppp..',
  '.....ppppppppppp..',
];
export function mascotPose(mood, qa, enabled) {
  if (mood.pose === 'chocolate') return 'chocolate';
  if (enabled) {
    if (qa.outcome === 'running') return 'checking';
    if (qa.freshness === 'stale') return 'stale';
    if (qa.outcome === 'failed') return 'failed';
    if (qa.outcome === 'passed' && qa.freshness === 'matched') return 'passed';
    if (qa.outcome === 'unknown' || qa.freshness === 'unknown')
      return 'unknown';
  }
  return mood.pose === 'focus'
    ? 'focus'
    : mood.pose === 'idle'
      ? 'idle'
      : 'wake';
}
export function mascotCells(pose, frame = 0) {
  const rows = BASE.map((r) => r.split(''));
  // Pupils and eyelids express presentation only. QA outcome is separately labeled.
  if (pose === 'idle')
    for (const c of [10, 14]) {
      rows[1][c] = 'p';
      rows[1][c + 1] = 'P';
      rows[1][c + 2] = 'p';
    }
  else if (['focus', 'stale', 'unknown'].includes(pose)) {
    for (const c of [10, 14]) {
      rows[1][c] = 'b';
      rows[1][c + 1] = 'w';
      rows[1][c + 2] = 'w';
    }
  } else if (pose === 'checking' && frame % 2) {
    for (const c of [10, 14]) {
      rows[1][c] = 'w';
      rows[1][c + 1] = 'w';
      rows[1][c + 2] = 'b';
    }
  }
  if (pose === 'failed') for (const c of [10, 14]) rows[0][c + 1] = 'P';
  if (pose === 'chocolate') {
    rows[8][0] = 'P';
    rows[8][1] = 'P';
    rows[9][0] = 'P';
    rows[9][1] = 'P';
  }
  const packed = [];
  for (let y = 0; y < rows.length; y += 2)
    for (let x = 0; x < 18; x++) {
      const top = rows[y][x],
        bottom = rows[y + 1][x];
      if (top === '.' && bottom === '.')
        packed.push(0x20, PALETTE['.'], PALETTE['.']);
      else if (top === '.') packed.push(0x2584, PALETTE[bottom], PALETTE['.']);
      else packed.push(0x2580, PALETTE[top], PALETTE[bottom]);
    }
  return new Uint8Array(Uint32Array.from(packed).buffer).toBase64();
}
export const POSE_CAPTIONS = {
  idle: 'Available for professional suspicion.',
  wake: 'Ready when you are.',
  focus: 'Reading the interesting bits.',
  checking: 'Now we find out.',
  passed: 'Passed. Within the stated scope.',
  failed: 'A finding. Not a personality flaw.',
  stale: 'Those checks belong to earlier inputs.',
  unknown: "I haven't verified that.",
  chocolate: 'A rigorous compensation policy.',
};
