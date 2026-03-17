import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Score, Measure, Note, DrumVoice } from '../types';
import { DEFAULT_PPQ, DEFAULT_TEMPO, DEFAULT_TIME_SIGNATURE } from '../constants/drumMap';
import { ticksPerMeasure } from '../utils/tick';
import { generateBreakbeat } from '../generators/breakbeatGenerator';

function createEmptyMeasure(timeSignature: [number, number] = DEFAULT_TIME_SIGNATURE): Measure {
  return { id: uuidv4(), timeSignature, notes: [] };
}

function createDefaultScore(): Score {
  return {
    title: 'Untitled',
    tempo: DEFAULT_TEMPO,
    ppq: DEFAULT_PPQ,
    measures: [
      createEmptyMeasure(),
      createEmptyMeasure(),
      createEmptyMeasure(),
      createEmptyMeasure(),
    ],
  };
}

interface HistoryEntry {
  measures: Measure[];
}

interface ScoreState {
  score: Score;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  setTitle: (title: string) => void;
  setTempo: (tempo: number) => void;
  setGlobalTimeSignature: (timeSignature: [number, number]) => void;

  addNote: (measureIndex: number, voice: DrumVoice, tick: number, velocity?: number, ghost?: boolean, accent?: boolean) => void;
  removeNote: (measureIndex: number, noteId: string) => void;
  toggleNote: (measureIndex: number, voice: DrumVoice, tick: number, velocity?: number, ghost?: boolean, accent?: boolean) => void;
  toggleNoteGhost: (measureIndex: number, noteId: string) => void;
  toggleNoteAccent: (measureIndex: number, noteId: string) => void;

  addMeasure: (atIndex?: number) => void;
  removeMeasure: (index: number) => void;
  clearAllNotes: () => void;
  generateBreakbeatPattern: () => void;
  pasteNotes: (entries: { voice: DrumVoice; absoluteTick: number; velocity: number; ghost?: boolean; accent?: boolean }[]) => void;
  removeNotesInRange: (startTick: number, endTick: number, voices: DrumVoice[]) => void;
  moveNotes: (
    oldNotes: { voice: DrumVoice; absoluteTick: number }[],
    newNotes: { voice: DrumVoice; absoluteTick: number; velocity: number; ghost?: boolean; accent?: boolean }[],
    clearZone?: { startTick: number; endTick: number; voices: DrumVoice[] }
  ) => void;

  undo: () => void;
  redo: () => void;

  getAbsoluteTick: (measureIndex: number, localTick: number) => number;
  getAllNotesAbsolute: () => { note: Note; measureIndex: number; absoluteTick: number }[];
}

export const useScoreStore = create<ScoreState>((set, get) => ({
  score: createDefaultScore(),
  undoStack: [],
  redoStack: [],

  setTitle: (title) => set((s) => ({ score: { ...s.score, title } })),

  setTempo: (tempo) => set((s) => ({ score: { ...s.score, tempo: Math.max(20, Math.min(300, tempo)) } })),

  setGlobalTimeSignature: (timeSignature) => {
    const state = get();
    const measures = state.score.measures;
    if (measures.length === 0) return;

    const [beatsRaw, beatValRaw] = timeSignature;
    const safeBeats = Number.isFinite(beatsRaw) ? Math.floor(beatsRaw) : DEFAULT_TIME_SIGNATURE[0];
    const beats = Math.max(1, Math.min(32, safeBeats));
    const allowedBeatValues = [2, 4, 8, 16] as const;
    const safeBeatValue = Number.isFinite(beatValRaw) ? Math.floor(beatValRaw) : DEFAULT_TIME_SIGNATURE[1];
    const beatValue = allowedBeatValues.includes(safeBeatValue as (typeof allowedBeatValues)[number])
      ? safeBeatValue
      : DEFAULT_TIME_SIGNATURE[1];

    const nextTimeSig: [number, number] = [beats, beatValue];
    const unchanged = measures.every(
      (m) => m.timeSignature[0] === nextTimeSig[0] && m.timeSignature[1] === nextTimeSig[1]
    );
    if (unchanged) return;

    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(measures)) };
    const maxTicksPerMeasure = ticksPerMeasure(nextTimeSig, state.score.ppq);
    const newMeasures = measures.map((m) => ({
      ...m,
      timeSignature: nextTimeSig,
      notes: m.notes.filter((n) => n.tick >= 0 && n.tick < maxTicksPerMeasure),
    }));

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  addNote: (measureIndex, voice, tick, velocity = 100, ghost = false, accent = false) => {
    const state = get();
    const measures = state.score.measures;
    if (measureIndex < 0 || measureIndex >= measures.length) return;

    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(measures)) };

    const newMeasures = measures.map((m, i) => {
      if (i !== measureIndex) return m;
      return {
        ...m,
        notes: [...m.notes, { id: uuidv4(), voice, tick, velocity, ghost: ghost || undefined, accent: accent || undefined }],
      };
    });

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  removeNote: (measureIndex, noteId) => {
    const state = get();
    const measures = state.score.measures;
    if (measureIndex < 0 || measureIndex >= measures.length) return;

    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(measures)) };

    const newMeasures = measures.map((m, i) => {
      if (i !== measureIndex) return m;
      return {
        ...m,
        notes: m.notes.filter((n) => n.id !== noteId),
      };
    });

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  toggleNote: (measureIndex, voice, tick, velocity = 100, ghost = false, accent = false) => {
    const state = get();
    const measures = state.score.measures;
    if (measureIndex < 0 || measureIndex >= measures.length) return;

    const measure = measures[measureIndex];
    const existing = measure.notes.find((n) => n.voice === voice && n.tick === tick);

    if (existing) {
      get().removeNote(measureIndex, existing.id);
    } else {
      get().addNote(measureIndex, voice, tick, velocity, ghost, accent);
    }
  },

  toggleNoteGhost: (measureIndex, noteId) => {
    const state = get();
    const measures = state.score.measures;
    if (measureIndex < 0 || measureIndex >= measures.length) return;

    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(measures)) };

    const newMeasures = measures.map((m, i) => {
      if (i !== measureIndex) return m;
      return {
        ...m,
        notes: m.notes.map((n) => {
          if (n.id !== noteId) return n;
          const isModified = n.ghost || n.accent;
          return isModified
            ? { ...n, ghost: undefined, accent: undefined }
            : { ...n, ghost: true, accent: undefined };
        }),
      };
    });

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  toggleNoteAccent: (measureIndex, noteId) => {
    const state = get();
    const measures = state.score.measures;
    if (measureIndex < 0 || measureIndex >= measures.length) return;

    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(measures)) };

    const newMeasures = measures.map((m, i) => {
      if (i !== measureIndex) return m;
      return {
        ...m,
        notes: m.notes.map((n) => {
          if (n.id !== noteId) return n;
          const isModified = n.ghost || n.accent;
          return isModified
            ? { ...n, ghost: undefined, accent: undefined }
            : { ...n, accent: true, ghost: undefined };
        }),
      };
    });

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  addMeasure: (atIndex) => {
    const state = get();
    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(state.score.measures)) };
    const newMeasure = createEmptyMeasure(
      state.score.measures.length > 0
        ? state.score.measures[state.score.measures.length - 1].timeSignature
        : DEFAULT_TIME_SIGNATURE
    );

    const idx = atIndex ?? state.score.measures.length;
    const newMeasures = [...state.score.measures];
    newMeasures.splice(idx, 0, newMeasure);

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  removeMeasure: (index) => {
    const state = get();
    if (state.score.measures.length <= 1) return;
    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(state.score.measures)) };

    const newMeasures = state.score.measures.filter((_, i) => i !== index);
    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  clearAllNotes: () => {
    const state = get();
    const hasNotes = state.score.measures.some((m) => m.notes.length > 0);
    if (!hasNotes) return;

    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(state.score.measures)) };
    const newMeasures = state.score.measures.map((m) => ({ ...m, notes: [] }));
    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  generateBreakbeatPattern: () => {
    const state = get();
    const { measures, ppq } = state.score;
    if (measures.length === 0) return;

    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(measures)) };
    const timeSignature = measures[0].timeSignature;
    const { notes: generated, tempo } = generateBreakbeat(measures.length, timeSignature, ppq);

    const baseMeasures = [...measures];
    while (baseMeasures.length < generated.length) {
      baseMeasures.push(createEmptyMeasure(timeSignature));
    }

    const newMeasures = baseMeasures.map((m, i) => ({
      ...m,
      notes: generated[i] ?? [],
    }));

    set({
      score: { ...state.score, measures: newMeasures, tempo },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  pasteNotes: (entries) => {
    if (entries.length === 0) return;
    const state = get();
    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(state.score.measures)) };
    const newMeasures = state.score.measures.map((m) => ({ ...m, notes: [...m.notes] }));

    let offset = 0;
    const measureOffsets: number[] = [];
    for (const m of state.score.measures) {
      measureOffsets.push(offset);
      offset += ticksPerMeasure(m.timeSignature, state.score.ppq);
    }

    for (const entry of entries) {
      let mi = -1;
      for (let i = measureOffsets.length - 1; i >= 0; i--) {
        if (entry.absoluteTick >= measureOffsets[i]) {
          mi = i;
          break;
        }
      }
      if (mi < 0 || mi >= newMeasures.length) continue;

      const localTick = entry.absoluteTick - measureOffsets[mi];
      const measTicks = ticksPerMeasure(newMeasures[mi].timeSignature, state.score.ppq);
      if (localTick < 0 || localTick >= measTicks) continue;

      const exists = newMeasures[mi].notes.some(
        (n) => n.voice === entry.voice && n.tick === localTick
      );
      if (!exists) {
        newMeasures[mi].notes.push({
          id: uuidv4(),
          voice: entry.voice,
          tick: localTick,
          velocity: entry.velocity,
          ghost: entry.ghost,
          accent: entry.accent,
        });
      }
    }

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  removeNotesInRange: (startTick, endTick, voices) => {
    const state = get();
    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(state.score.measures)) };

    let offset = 0;
    const newMeasures = state.score.measures.map((m) => {
      const measTicks = ticksPerMeasure(m.timeSignature, state.score.ppq);
      const measStart = offset;
      offset += measTicks;
      return {
        ...m,
        notes: m.notes.filter((n) => {
          const abs = measStart + n.tick;
          return !(abs >= startTick && abs < endTick && voices.includes(n.voice));
        }),
      };
    });

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  moveNotes: (oldNotes, newNotes, clearZone) => {
    if (newNotes.length === 0) return;
    const state = get();
    const snapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(state.score.measures)) };

    let offset = 0;
    const measureOffsets: number[] = [];
    for (const m of state.score.measures) {
      measureOffsets.push(offset);
      offset += ticksPerMeasure(m.timeSignature, state.score.ppq);
    }
    const totalTicks = offset;

    const toRemove = new Set(
      oldNotes.map((n) => `${n.absoluteTick}:${n.voice}`)
    );

    const czVoiceSet = clearZone ? new Set(clearZone.voices) : null;

    let off = 0;
    let newMeasures = state.score.measures.map((m) => {
      const measStart = off;
      off += ticksPerMeasure(m.timeSignature, state.score.ppq);
      return {
        ...m,
        notes: m.notes.filter((n) => {
          const abs = measStart + n.tick;
          if (toRemove.has(`${abs}:${n.voice}`)) return false;
          if (czVoiceSet && czVoiceSet.has(n.voice) &&
              abs >= clearZone!.startTick && abs < clearZone!.endTick) return false;
          return true;
        }),
      };
    });

    for (const entry of newNotes) {
      if (entry.absoluteTick < 0 || entry.absoluteTick >= totalTicks) continue;
      let mi = -1;
      for (let i = measureOffsets.length - 1; i >= 0; i--) {
        if (entry.absoluteTick >= measureOffsets[i]) { mi = i; break; }
      }
      if (mi < 0 || mi >= newMeasures.length) continue;

      const localTick = entry.absoluteTick - measureOffsets[mi];
      const measTicks = ticksPerMeasure(newMeasures[mi].timeSignature, state.score.ppq);
      if (localTick < 0 || localTick >= measTicks) continue;

      const exists = newMeasures[mi].notes.some(
        (n) => n.voice === entry.voice && n.tick === localTick
      );
      if (!exists) {
        newMeasures = newMeasures.map((m, i) =>
          i === mi
            ? { ...m, notes: [...m.notes, { id: uuidv4(), voice: entry.voice, tick: localTick, velocity: entry.velocity, ghost: entry.ghost, accent: entry.accent }] }
            : m
        );
      }
    }

    set({
      score: { ...state.score, measures: newMeasures },
      undoStack: [...state.undoStack, snapshot],
      redoStack: [],
    });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    const previous = state.undoStack[state.undoStack.length - 1];
    const currentSnapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(state.score.measures)) };

    set({
      score: { ...state.score, measures: previous.measures },
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, currentSnapshot],
    });
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;

    const next = state.redoStack[state.redoStack.length - 1];
    const currentSnapshot: HistoryEntry = { measures: JSON.parse(JSON.stringify(state.score.measures)) };

    set({
      score: { ...state.score, measures: next.measures },
      undoStack: [...state.undoStack, currentSnapshot],
      redoStack: state.redoStack.slice(0, -1),
    });
  },

  getAbsoluteTick: (measureIndex, localTick) => {
    const state = get();
    let absolute = 0;
    for (let i = 0; i < measureIndex; i++) {
      absolute += ticksPerMeasure(state.score.measures[i].timeSignature, state.score.ppq);
    }
    return absolute + localTick;
  },

  getAllNotesAbsolute: () => {
    const state = get();
    const result: { note: Note; measureIndex: number; absoluteTick: number }[] = [];
    let offset = 0;
    for (let i = 0; i < state.score.measures.length; i++) {
      const m = state.score.measures[i];
      for (const note of m.notes) {
        result.push({ note, measureIndex: i, absoluteTick: offset + note.tick });
      }
      offset += ticksPerMeasure(m.timeSignature, state.score.ppq);
    }
    return result;
  },
}));
