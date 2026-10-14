export const HELP = `Ernesto 0.1.0, Wavect companion for Claude Code.
/ernesto evidence | refresh | hide | show | chocolate
/ernesto quiet on|off | motion reduced|normal
/ernesto qa setup | qa enable | qa off | forget confirm
Companion mood is independent of evidence. No automatic tests, installs, model calls or telemetry.`;
export function parseCommand(args) {
  if (
    typeof args !== 'string' ||
    args.length > 160 ||
    /[\x00-\x1f\x7f]/.test(args)
  )
    return { action: 'invalid' };
  const words = args.trim().split(/\s+/);
  const s = words.join(' ');
  if (!s || s === 'help' || s === 'status') return { action: 'help' };
  if (['evidence', 'refresh', 'hide', 'show', 'chocolate'].includes(s))
    return { action: s };
  if (['qa setup', 'qa enable', 'qa off', 'forget confirm'].includes(s))
    return { action: s };
  if (s === 'forget') return { action: 'forget' };
  if (/^quiet (on|off)$/.test(s))
    return { action: 'quiet', value: words[1] === 'on' };
  if (/^motion (reduced|normal)$/.test(s))
    return { action: 'motion', value: words[1] === 'reduced' };
  return { action: 'invalid' };
}
const captions = {
  idle: 'Available for professional suspicion.',
  wake: 'Ready when you are.',
  focus: 'Reading the interesting bits.',
  activity: 'Work observed. Checks are separate.',
  chocolate: 'A rigorous compensation policy.',
  complete: 'Claude finished. Evidence has its own opinion.',
};
export function companion(previous, action, now) {
  if (!Object.hasOwn(captions, action)) return previous;
  return { pose: action, caption: captions[action], changedAt: now };
}
export const INITIAL_COMPANION = {
  pose: 'idle',
  caption: captions.idle,
  changedAt: 0,
};
export function safeText(value, max = 240) {
  return typeof value === 'string'
    ? value
        .replace(
          /[\x00-\x1f\x7f-\x9f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
          '',
        )
        .slice(0, max)
    : '';
}
export function validPreferences(saved, defaults) {
  return Object.fromEntries(
    Object.entries(defaults).map(([k, v]) => [
      k,
      typeof saved?.[k] === 'boolean' ? saved[k] : v,
    ]),
  );
}
