export type DrumVoice =
  | 'crash'
  | 'ride'
  | 'hihat'
  | 'hihat-open'
  | 'rack-tom-1'
  | 'rack-tom-2'
  | 'snare'
  | 'cross-stick'
  | 'floor-tom'
  | 'kick';

export interface Note {
  id: string;
  voice: DrumVoice;
  tick: number;
  velocity: number;
  ghost?: boolean;
  accent?: boolean;
}

export interface Measure {
  id: string;
  timeSignature: [number, number];
  notes: Note[];
}

export interface Score {
  title: string;
  tempo: number;
  ppq: number;
  measures: Measure[];
}

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export type NoteheadType = 'normal' | 'x' | 'circle-x' | 'triangle' | 'diamond';

export interface DrumVoiceConfig {
  voice: DrumVoice;
  label: string;
  shortLabel: string;
  staffPosition: number;
  notehead: NoteheadType;
  stemDirection: 'up' | 'down';
  midiNote: number;
  vexKey: string;
  vexNotehead: string;
}
