import { create } from 'zustand';
import type { NoteValue, DrumVoice } from '../types';

export interface SelectionRect {
  startTick: number;
  endTick: number;
  startRow: number;
  endRow: number;
}

export interface ClipboardEntry {
  voice: DrumVoice;
  tickOffset: number;
  velocity: number;
  ghost?: boolean;
  accent?: boolean;
}

interface ViewState {
  scrollX: number;
  zoom: number;
  selectedNoteValue: NoteValue;
  isPlaying: boolean;
  playheadTick: number;
  looping: boolean;

  selection: SelectionRect | null;
  clipboard: ClipboardEntry[];
  measureWidths: number[];

  setScrollX: (x: number) => void;
  setZoom: (z: number) => void;
  setSelectedNoteValue: (v: NoteValue) => void;
  setIsPlaying: (p: boolean) => void;
  setPlayheadTick: (t: number) => void;
  adjustZoom: (delta: number) => void;
  setSelection: (sel: SelectionRect | null) => void;
  setClipboard: (entries: ClipboardEntry[]) => void;
  setMeasureWidths: (widths: number[]) => void;
  toggleLooping: () => void;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 1.0;

export const useViewStore = create<ViewState>((set) => ({
  scrollX: 0,
  zoom: 0.25,
  selectedNoteValue: 'eighth',
  isPlaying: false,
  playheadTick: 0,
  looping: false,
  selection: null,
  clipboard: [],
  measureWidths: [],

  setScrollX: (x) => set({ scrollX: Math.max(0, x) }),
  setZoom: (z) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)) }),
  setSelectedNoteValue: (v) => set({ selectedNoteValue: v }),
  setIsPlaying: (p) => set({ isPlaying: p }),
  setPlayheadTick: (t) => set({ playheadTick: t }),
  adjustZoom: (delta) =>
    set((s) => ({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom + delta)) })),
  setSelection: (sel) => set({ selection: sel }),
  setClipboard: (entries) => set({ clipboard: entries }),
  setMeasureWidths: (widths) => set({ measureWidths: widths }),
  toggleLooping: () => set((s) => ({ looping: !s.looping })),
}));
