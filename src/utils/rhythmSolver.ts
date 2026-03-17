/**
 * Rhythm solver: given a set of note-on positions within a measure,
 * produce a sequence of VexFlow-compatible events (notes + rests)
 * with correct durations that exactly fill the measure.
 *
 * Algorithm: greedy power-of-2 fill. For each position, pick the
 * largest duration D that satisfies:
 *   1. D ≤ available space (to next event or measure end)
 *   2. tick % D === 0 (valid metric position for that duration)
 *
 * Rule 2 automatically prevents beat-boundary and half-bar violations:
 * a half note (960 ticks) can only start where tick%960===0, i.e. beat 1
 * or beat 3 in 4/4, which is exactly the correct metric behaviour.
 */

export interface RhythmEvent {
  tick: number;
  durationTicks: number;
  vexDuration: string;
  isRest: boolean;
}

interface DurationEntry {
  ticks: number;
  vex: string;
}

const DURATIONS: DurationEntry[] = [
  { ticks: 1920, vex: 'w' },
  { ticks: 960,  vex: 'h' },
  { ticks: 480,  vex: 'q' },
  { ticks: 240,  vex: '8' },
  { ticks: 120,  vex: '16' },
  { ticks: 60,   vex: '32' },
];

function bestDuration(tick: number, maxTicks: number): DurationEntry {
  for (const d of DURATIONS) {
    if (d.ticks <= maxTicks && tick % d.ticks === 0) {
      return d;
    }
  }
  return DURATIONS[DURATIONS.length - 1];
}

/**
 * Spell the rhythm for a single voice within one measure.
 *
 * @param noteTicks  sorted array of tick positions that have note events
 * @param measureTicks total ticks in the measure (e.g. 1920 for 4/4 @ ppq=480)
 */
export function spellVoiceRhythm(
  noteTicks: number[],
  measureTicks: number
): RhythmEvent[] {
  const noteSet = new Set(noteTicks);
  const sorted = [...noteTicks].sort((a, b) => a - b);
  const events: RhythmEvent[] = [];
  let current = 0;

  while (current < measureTicks) {
    const isNote = noteSet.has(current);

    let nextChange = measureTicks;
    for (const t of sorted) {
      if (t > current) {
        nextChange = t;
        break;
      }
    }

    const maxSpace = nextChange - current;
    const dur = bestDuration(current, maxSpace);

    events.push({
      tick: current,
      durationTicks: dur.ticks,
      vexDuration: dur.vex,
      isRest: !isNote,
    });

    current += dur.ticks;
  }

  return events;
}
