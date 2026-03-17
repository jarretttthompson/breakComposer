import { v4 as uuidv4 } from 'uuid';
import type { DrumVoice, Note } from '../types';
import { ticksPerMeasure } from '../utils/tick';

interface Hit {
  voice: DrumVoice;
  pos: number; // 0-based 16th-note index within one bar of 4/4 (0-15)
  ghost?: boolean;
  accent?: boolean;
}

interface Template {
  name: string;
  tempoRange: [number, number]; // min, max BPM for the style
  hits: Hit[];
}

export interface BreakbeatResult {
  notes: Note[][];
  tempo: number;
}

// ---------------------------------------------------------------------------
// Classic breakbeat templates (16th-note grid, 4/4 assumed)
// ---------------------------------------------------------------------------

const TEMPLATES: Template[] = [
  {
    name: 'Amen',
    tempoRange: [160, 180],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 10 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'snare', pos: 8 },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'ride', pos: 0 },
      { voice: 'ride', pos: 2 },
      { voice: 'ride', pos: 4 },
      { voice: 'ride', pos: 6 },
      { voice: 'ride', pos: 8 },
      { voice: 'ride', pos: 10 },
      { voice: 'ride', pos: 12 },
      { voice: 'ride', pos: 14 },
    ],
  },
  {
    name: 'Think',
    tempoRange: [95, 115],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 6 },
      { voice: 'kick', pos: 10 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'hihat', pos: 0 },
      { voice: 'hihat', pos: 2 },
      { voice: 'hihat', pos: 4 },
      { voice: 'hihat-open', pos: 6 },
      { voice: 'hihat', pos: 8 },
      { voice: 'hihat', pos: 10 },
      { voice: 'hihat', pos: 12 },
      { voice: 'hihat-open', pos: 14 },
    ],
  },
  {
    name: 'Funky Drummer',
    tempoRange: [100, 120],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 3 },
      { voice: 'kick', pos: 7 },
      { voice: 'kick', pos: 10 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'snare', pos: 6, ghost: true },
      { voice: 'snare', pos: 9, ghost: true },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'snare', pos: 14, ghost: true },
      { voice: 'hihat', pos: 0 },
      { voice: 'hihat', pos: 2 },
      { voice: 'hihat', pos: 4 },
      { voice: 'hihat', pos: 6 },
      { voice: 'hihat', pos: 8 },
      { voice: 'hihat', pos: 10 },
      { voice: 'hihat', pos: 12 },
      { voice: 'hihat', pos: 14 },
    ],
  },
  {
    name: 'Apache',
    tempoRange: [110, 130],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 6 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'hihat', pos: 0 },
      { voice: 'hihat', pos: 2 },
      { voice: 'hihat', pos: 4 },
      { voice: 'hihat', pos: 6 },
      { voice: 'hihat', pos: 8 },
      { voice: 'hihat', pos: 10 },
      { voice: 'hihat', pos: 12 },
      { voice: 'hihat', pos: 14 },
    ],
  },
  {
    name: 'Skull Snaps',
    tempoRange: [140, 165],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 5 },
      { voice: 'kick', pos: 10 },
      { voice: 'kick', pos: 13 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'hihat', pos: 0 },
      { voice: 'hihat', pos: 2 },
      { voice: 'hihat', pos: 4 },
      { voice: 'hihat', pos: 6 },
      { voice: 'hihat', pos: 8 },
      { voice: 'hihat', pos: 10 },
      { voice: 'hihat', pos: 12 },
      { voice: 'hihat', pos: 14 },
    ],
  },
  {
    name: 'Impeach the President',
    tempoRange: [95, 115],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 7 },
      { voice: 'kick', pos: 10 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'snare', pos: 15, ghost: true },
      { voice: 'hihat', pos: 0 },
      { voice: 'hihat', pos: 2 },
      { voice: 'hihat', pos: 4 },
      { voice: 'hihat', pos: 6 },
      { voice: 'hihat', pos: 8 },
      { voice: 'hihat', pos: 10 },
      { voice: 'hihat', pos: 12 },
      { voice: 'hihat', pos: 14 },
    ],
  },
  {
    name: 'Synthetic Halftime',
    tempoRange: [130, 150],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 3 },
      { voice: 'kick', pos: 14 },
      { voice: 'snare', pos: 8, accent: true },
      { voice: 'snare', pos: 5, ghost: true },
      { voice: 'snare', pos: 11, ghost: true },
      { voice: 'hihat', pos: 0 },
      { voice: 'hihat', pos: 2 },
      { voice: 'hihat', pos: 4 },
      { voice: 'hihat-open', pos: 6 },
      { voice: 'hihat', pos: 8 },
      { voice: 'hihat', pos: 10 },
      { voice: 'hihat', pos: 12 },
      { voice: 'hihat-open', pos: 14 },
    ],
  },
  {
    name: 'Jungle Roller',
    tempoRange: [160, 180],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 5 },
      { voice: 'kick', pos: 9 },
      { voice: 'kick', pos: 14 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'snare', pos: 10, accent: true },
      { voice: 'snare', pos: 7, ghost: true },
      { voice: 'snare', pos: 13, ghost: true },
      { voice: 'ride', pos: 0 },
      { voice: 'ride', pos: 2 },
      { voice: 'ride', pos: 4 },
      { voice: 'ride', pos: 6 },
      { voice: 'ride', pos: 8 },
      { voice: 'ride', pos: 10 },
      { voice: 'ride', pos: 12 },
      { voice: 'ride', pos: 14 },
    ],
  },
  {
    name: 'Choppy Breaks',
    tempoRange: [135, 160],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'kick', pos: 2 },
      { voice: 'kick', pos: 7 },
      { voice: 'kick', pos: 11 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'snare', pos: 9, ghost: true },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'snare', pos: 15, ghost: true },
      { voice: 'hihat', pos: 0 },
      { voice: 'hihat', pos: 4 },
      { voice: 'hihat-open', pos: 6 },
      { voice: 'hihat', pos: 8 },
      { voice: 'hihat', pos: 12 },
      { voice: 'hihat-open', pos: 14 },
    ],
  },
  {
    name: 'Linear Funk',
    tempoRange: [100, 120],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'hihat', pos: 1 },
      { voice: 'snare', pos: 2, ghost: true },
      { voice: 'hihat', pos: 3 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'hihat', pos: 5 },
      { voice: 'kick', pos: 6 },
      { voice: 'hihat', pos: 7 },
      { voice: 'kick', pos: 8 },
      { voice: 'hihat', pos: 9 },
      { voice: 'snare', pos: 10, ghost: true },
      { voice: 'hihat-open', pos: 11 },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'hihat', pos: 13 },
      { voice: 'kick', pos: 14 },
      { voice: 'hihat', pos: 15 },
    ],
  },
  {
    name: 'Linear Breaks',
    tempoRange: [130, 155],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'hihat', pos: 1 },
      { voice: 'hihat', pos: 2 },
      { voice: 'snare', pos: 3, ghost: true },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'kick', pos: 5 },
      { voice: 'hihat', pos: 6 },
      { voice: 'hihat', pos: 7 },
      { voice: 'kick', pos: 8 },
      { voice: 'snare', pos: 9, ghost: true },
      { voice: 'hihat-open', pos: 10 },
      { voice: 'hihat', pos: 11 },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'hihat', pos: 13 },
      { voice: 'kick', pos: 14 },
      { voice: 'hihat', pos: 15 },
    ],
  },
  {
    name: 'Linear Syncopation',
    tempoRange: [105, 130],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'hihat', pos: 1 },
      { voice: 'snare', pos: 2, ghost: true },
      { voice: 'kick', pos: 3 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'hihat', pos: 5 },
      { voice: 'hihat-open', pos: 6 },
      { voice: 'snare', pos: 7, ghost: true },
      { voice: 'kick', pos: 8 },
      { voice: 'hihat', pos: 9 },
      { voice: 'kick', pos: 10 },
      { voice: 'hihat', pos: 11 },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'kick', pos: 13 },
      { voice: 'hihat', pos: 14 },
      { voice: 'snare', pos: 15, ghost: true },
    ],
  },
  {
    name: 'Linear Shuffle',
    tempoRange: [110, 140],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'ride', pos: 1 },
      { voice: 'snare', pos: 2, ghost: true },
      { voice: 'ride', pos: 3 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'ride', pos: 5 },
      { voice: 'kick', pos: 6 },
      { voice: 'snare', pos: 7, ghost: true },
      { voice: 'ride', pos: 8 },
      { voice: 'kick', pos: 9 },
      { voice: 'ride', pos: 10 },
      { voice: 'snare', pos: 11, ghost: true },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'ride', pos: 13 },
      { voice: 'kick', pos: 14 },
      { voice: 'ride', pos: 15 },
    ],
  },
  {
    name: 'Linear DnB',
    tempoRange: [160, 178],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'hihat', pos: 1 },
      { voice: 'hihat', pos: 2 },
      { voice: 'snare', pos: 3, ghost: true },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'hihat', pos: 5 },
      { voice: 'kick', pos: 6 },
      { voice: 'hihat', pos: 7 },
      { voice: 'hihat', pos: 8 },
      { voice: 'kick', pos: 9 },
      { voice: 'snare', pos: 10, accent: true },
      { voice: 'hihat', pos: 11 },
      { voice: 'kick', pos: 12 },
      { voice: 'hihat', pos: 13 },
      { voice: 'snare', pos: 14, ghost: true },
      { voice: 'hihat-open', pos: 15 },
    ],
  },
  {
    name: 'Linear Gospel',
    tempoRange: [90, 115],
    hits: [
      { voice: 'kick', pos: 0, accent: true },
      { voice: 'hihat', pos: 1 },
      { voice: 'kick', pos: 2 },
      { voice: 'hihat', pos: 3 },
      { voice: 'snare', pos: 4, accent: true },
      { voice: 'kick', pos: 5 },
      { voice: 'hihat', pos: 6 },
      { voice: 'snare', pos: 7, ghost: true },
      { voice: 'hihat-open', pos: 8 },
      { voice: 'snare', pos: 9, ghost: true },
      { voice: 'kick', pos: 10 },
      { voice: 'hihat', pos: 11 },
      { voice: 'snare', pos: 12, accent: true },
      { voice: 'hihat', pos: 13 },
      { voice: 'kick', pos: 14 },
      { voice: 'hihat', pos: 15 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cloneHits(hits: Hit[]): Hit[] {
  return hits.map((h) => ({ ...h }));
}

function occupiedPositions(hits: Hit[]): Set<string> {
  return new Set(hits.map((h) => `${h.voice}:${h.pos}`));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

type Mutation = (hits: Hit[]) => Hit[];

const ghostSnareInjection: Mutation = (hits) => {
  const occupied = occupiedPositions(hits);
  const candidates = Array.from({ length: 16 }, (_, i) => i).filter(
    (p) => !occupied.has(`snare:${p}`)
  );
  const count = Math.min(randInt(1, 3), candidates.length);
  for (let i = 0; i < count; i++) {
    const idx = randInt(0, candidates.length - 1);
    hits.push({ voice: 'snare', pos: candidates[idx], ghost: true });
    candidates.splice(idx, 1);
  }
  return hits;
};

const kickDisplacement: Mutation = (hits) => {
  const kicks = hits.filter((h) => h.voice === 'kick');
  if (kicks.length === 0) return hits;
  const target = pick(kicks);
  const occupied = occupiedPositions(hits);
  const shift = Math.random() < 0.5 ? -1 : 1;
  const newPos = ((target.pos + shift) % 16 + 16) % 16;
  if (!occupied.has(`kick:${newPos}`)) {
    target.pos = newPos;
  }
  return hits;
};

const openHihatSwap: Mutation = (hits) => {
  const closedHats = hits.filter((h) => h.voice === 'hihat');
  if (closedHats.length === 0) return hits;
  const count = Math.min(randInt(1, 2), closedHats.length);
  const shuffled = [...closedHats].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    shuffled[i].voice = 'hihat-open';
  }
  return hits;
};

const accentShuffle: Mutation = (hits) => {
  const kicksAndSnares = hits.filter(
    (h) => (h.voice === 'kick' || h.voice === 'snare') && !h.ghost
  );
  if (kicksAndSnares.length === 0) return hits;
  const target = pick(kicksAndSnares);
  target.accent = !target.accent;
  return hits;
};

const hatDensityChange: Mutation = (hits) => {
  const hatVoices: DrumVoice[] = ['hihat', 'hihat-open'];
  const isHat = (h: Hit) => hatVoices.includes(h.voice);
  const nonHats = hits.filter((h) => !isHat(h));

  const hasHatsOn16ths = hits.filter(isHat).length > 8;

  if (hasHatsOn16ths) {
    // Switch to 8th notes
    for (let p = 0; p < 16; p += 2) {
      nonHats.push({ voice: 'hihat', pos: p });
    }
  } else {
    // Switch to 16th notes
    const occupied = occupiedPositions(nonHats);
    for (let p = 0; p < 16; p++) {
      if (!occupied.has(`hihat:${p}`) && !occupied.has(`hihat-open:${p}`)) {
        nonHats.push({ voice: 'hihat', pos: p });
      }
    }
  }
  return nonHats;
};

const VOICE_PRIORITY: DrumVoice[] = [
  'snare', 'kick', 'hihat-open', 'hihat', 'ride', 'crash',
  'rack-tom-1', 'rack-tom-2', 'floor-tom', 'cross-stick',
];

const linearize: Mutation = (hits) => {
  const byPos = new Map<number, Hit[]>();
  for (const h of hits) {
    if (!byPos.has(h.pos)) byPos.set(h.pos, []);
    byPos.get(h.pos)!.push(h);
  }
  const result: Hit[] = [];
  for (const [, group] of byPos) {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      // Keep the highest-priority voice; if accented, prefer that one
      const accented = group.find((h) => h.accent);
      if (accented) {
        result.push(accented);
      } else {
        group.sort((a, b) =>
          VOICE_PRIORITY.indexOf(a.voice) - VOICE_PRIORITY.indexOf(b.voice)
        );
        result.push(group[0]);
      }
    }
  }
  return result;
};

const MUTATIONS: Mutation[] = [
  ghostSnareInjection,
  kickDisplacement,
  openHihatSwap,
  accentShuffle,
  hatDensityChange,
  linearize,
  linearize,
  linearize,
];

// ---------------------------------------------------------------------------
// Tom fill generator (applied to the last measure or every Nth measure)
// ---------------------------------------------------------------------------

function generateTomFill(startPos: number, endPos: number = 16): Hit[] {
  const tomVoices: DrumVoice[] = ['rack-tom-1', 'rack-tom-2', 'floor-tom'];
  const fill: Hit[] = [];
  let voiceIdx = 0;
  for (let p = startPos; p < endPos; p++) {
    fill.push({ voice: tomVoices[voiceIdx], pos: p, accent: p === startPos });
    voiceIdx = Math.min(voiceIdx + 1, tomVoices.length - 1);
  }
  fill.push({ voice: 'crash', pos: startPos, accent: true });
  return fill;
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

const TARGET_BARS = 16;
const FILL_COUNT = 2;

function pickFillBars(total: number, count: number): Set<number> {
  // Place fills at musically logical positions (end of 8-bar phrases)
  // For 16 bars: bar 8 and bar 16 (indices 7 and 15)
  const fills = new Set<number>();
  if (total >= 16 && count >= 2) {
    fills.add(7);   // end of first 8-bar phrase
    fills.add(15);  // end of second 8-bar phrase (last bar)
  } else if (total >= 8 && count >= 1) {
    fills.add(total - 1);
  } else {
    // Fallback: spread fills evenly
    const spacing = Math.floor(total / (count + 1));
    for (let i = 0; i < count; i++) {
      fills.add(spacing * (i + 1) + spacing - 1);
    }
  }
  return fills;
}

export function generateBreakbeat(
  measureCount: number,
  timeSignature: [number, number],
  ppq: number,
): BreakbeatResult {
  const bars = Math.max(measureCount, TARGET_BARS);
  const template = pick(TEMPLATES);
  const tempo = randInt(template.tempoRange[0], template.tempoRange[1]);
  let baseHits = cloneHits(template.hits);

  const mutationCount = randInt(2, 3);
  const shuffledMutations = [...MUTATIONS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < mutationCount; i++) {
    baseHits = shuffledMutations[i](baseHits);
  }

  baseHits = linearize(baseHits);

  const sixteenth = ppq / 4;
  const measTicks = ticksPerMeasure(timeSignature, ppq);
  const maxPos = Math.round(measTicks / sixteenth);
  const templateLen = 16;

  const fillBars = pickFillBars(bars, FILL_COUNT);
  const result: Note[][] = [];

  for (let m = 0; m < bars; m++) {
    let expandedHits: Hit[];

    if (maxPos <= templateLen) {
      expandedHits = cloneHits(baseHits).filter((h) => h.pos < maxPos);
    } else {
      expandedHits = [];
      const repetitions = Math.ceil(maxPos / templateLen);
      for (let rep = 0; rep < repetitions; rep++) {
        for (const h of baseHits) {
          const newPos = h.pos + rep * templateLen;
          if (newPos < maxPos) {
            expandedHits.push({ ...h, pos: newPos });
          }
        }
      }
      expandedHits = linearize(expandedHits);
    }

    let measureHits: Hit[];
    if (fillBars.has(m)) {
      const fillStart = Math.max(maxPos - 4, Math.floor(maxPos * 0.75));
      const withoutTail = expandedHits.filter((h) => h.pos < fillStart);
      measureHits = [...withoutTail, ...generateTomFill(fillStart, maxPos)];
    } else {
      measureHits = expandedHits;
    }

    const notes: Note[] = measureHits
      .filter((h) => h.pos >= 0 && h.pos < maxPos)
      .map((h) => ({
        id: uuidv4(),
        voice: h.voice,
        tick: h.pos * sixteenth,
        velocity: h.ghost ? 40 : h.accent ? 120 : 100,
        ghost: h.ghost || undefined,
        accent: h.accent || undefined,
      }));

    result.push(notes);
  }

  return { notes: result, tempo };
}
