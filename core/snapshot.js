// Pure byte hashing and scoped snapshots. Filesystem effects are injected by the caller.
export const SNAPSHOT_VERSION = 1;
export const DEFAULT_EXCLUSIONS = Object.freeze([
  '.git',
  'node_modules',
  '.ernesto',
  '.agent-cache',
  'dist',
  'build',
  'coverage',
  '.env',
  'credentials',
  'secrets',
]);
const encoder = new TextEncoder();
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
export function sha256(input) {
  const data = typeof input === 'string' ? encoder.encode(input) : input;
  const bytes = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  bytes.set(data);
  bytes[data.length] = 128;
  const view = new DataView(bytes.buffer);
  view.setUint32(bytes.length - 4, (data.length * 8) >>> 0);
  view.setUint32(bytes.length - 8, Math.floor(data.length / 0x20000000));
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Uint32Array(64);
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let at = 0; at < bytes.length; at += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(at + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15],
        b = w[i - 2];
      w[i] =
        w[i - 16] +
        (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) +
        w[i - 7] +
        (r(b, 17) ^ r(b, 19) ^ (b >>> 10));
    }
    let [a, b, c, d, e, f, g, z] = h;
    for (let i = 0; i < 64; i++) {
      const t =
        (z +
          (r(e, 6) ^ r(e, 11) ^ r(e, 25)) +
          ((e & f) ^ (~e & g)) +
          K[i] +
          w[i]) |
        0;
      const u =
        ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      z = g;
      g = f;
      f = e;
      e = (d + t) | 0;
      d = c;
      c = b;
      b = a;
      a = (t + u) | 0;
    }
    [a, b, c, d, e, f, g, z].forEach((v, i) => (h[i] = (h[i] + v) | 0));
  }
  return h.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}
export function stableJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stableJSON(value[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export function safeRelative(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    path.length <= 512 &&
    !/[\x00-\x1f\x7f\\:\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(
      path,
    ) &&
    !path.startsWith('/') &&
    path.split('/').every((p) => p && p !== '.' && p !== '..')
  );
}
export function excludedPath(path, extras = []) {
  return (
    path
      .split('/')
      .some(
        (p) =>
          DEFAULT_EXCLUSIONS.includes(p) ||
          /^\.env(?:\.|$)/i.test(p) ||
          /(?:^id_(?:rsa|ed25519)$|\.(?:pem|key|p12|pfx)$|^\.npmrc$|^\.netrc$)/i.test(
            p,
          ),
      ) || extras.some((e) => path === e || path.startsWith(e + '/'))
  );
}
export function validateScope(scope) {
  if (
    !scope ||
    !Array.isArray(scope.roots) ||
    !scope.roots.length ||
    scope.roots.length > 64 ||
    !scope.roots.every(safeRelative) ||
    !Array.isArray(scope.excludes) ||
    scope.excludes.length > 64 ||
    !scope.excludes.every(safeRelative)
  )
    throw Error('Invalid reviewed scope');
  return {
    roots: [...new Set(scope.roots)].sort(),
    excludes: [...new Set(scope.excludes)].sort(),
  };
}
export async function captureSnapshot({
  root,
  scope,
  runtime,
  checkDefinition = {},
  fs,
  now = Date.now(),
  epoch = 0,
  observationGap = false,
  maxFiles = 2000,
  maxBytes = 32 * 1024 * 1024,
  maxFileBytes = 2 * 1024 * 1024,
}) {
  const policy = validateScope(scope);
  if (
    typeof runtime !== 'string' ||
    runtime.length > 128 ||
    /[\x00-\x1f]/.test(runtime)
  )
    throw Error('Invalid runtime descriptor');
  const canonical = await fs.canonicalRoot(root);
  const workspaceId = sha256('ernesto-workspace-v1\0' + canonical);
  const reasons = [];
  const entries = [];
  const visited = new Set();
  let bytes = 0;
  async function walk(path, depth = 0) {
    if (excludedPath(path, policy.excludes) || visited.has(path)) return;
    visited.add(path);
    if (!safeRelative(path) || depth > 32 || visited.size > maxFiles * 2) {
      if (!reasons.includes('scope_limit')) reasons.push('scope_limit');
      return;
    }
    try {
      const info = await fs.stat(path);
      if (!info) return;
      if (
        info.kind === 'symlink' ||
        info.kind === 'submodule' ||
        info.kind === 'other'
      ) {
        reasons.push('unsupported_input');
        return;
      }
      if (info.kind === 'directory') {
        const children = await fs.list(path);
        if (!Array.isArray(children) || children.length > maxFiles) {
          reasons.push('scope_limit');
          return;
        }
        for (const child of [...children].sort()) {
          if (
            typeof child !== 'string' ||
            !safeRelative(child) ||
            child.includes('/')
          ) {
            reasons.push('unsafe_path');
            continue;
          }
          await walk(path + '/' + child, depth + 1);
        }
      } else if (info.kind === 'file') {
        if (
          entries.length >= maxFiles ||
          info.size > maxFileBytes ||
          bytes + info.size > maxBytes
        ) {
          reasons.push('scope_limit');
          return;
        }
        const value = await fs.read(path);
        if (
          !(value instanceof Uint8Array) ||
          value.length !== info.size ||
          value.length > maxFileBytes
        ) {
          reasons.push('read_changed');
          return;
        }
        bytes += value.length;
        entries.push([path, value.length, sha256(value)]);
      } else reasons.push('unsupported_input');
    } catch {
      reasons.push('read_failed');
    }
  }
  for (const path of policy.roots) await walk(path);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (entries.length === 0) reasons.push('empty_scope');
  const policyHash = sha256(
    stableJSON({
      version: 1,
      ...policy,
      defaultExclusions: DEFAULT_EXCLUSIONS,
      maxFiles,
      maxBytes,
      maxFileBytes,
    }),
  );
  const configHash = sha256(
    stableJSON({ scope: policyHash, runtime, checkDefinition }),
  );
  const fileSetDigest = sha256(stableJSON(entries.map((e) => e[0])));
  const digest = sha256(stableJSON({ workspaceId, configHash, entries }));
  return Object.freeze({
    version: 1,
    algorithm: 'sha256-v1',
    workspaceId,
    policyHash,
    configHash,
    runtime,
    digest,
    fileSetDigest,
    files: entries.length,
    bytes,
    complete: reasons.length === 0,
    exclusions: [...DEFAULT_EXCLUSIONS, ...policy.excludes],
    reasons: [...new Set(reasons)].slice(0, 16),
    observedAt: now,
    epoch,
    observationGap: Boolean(observationGap),
  });
}
export function snapshotsMatch(a, b) {
  return Boolean(
    a &&
      b &&
      a.complete &&
      b.complete &&
      !a.observationGap &&
      !b.observationGap &&
      a.workspaceId === b.workspaceId &&
      a.configHash === b.configHash &&
      a.policyHash === b.policyHash &&
      a.runtime === b.runtime &&
      a.digest === b.digest &&
      a.fileSetDigest === b.fileSetDigest,
  );
}
