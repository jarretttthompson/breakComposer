import type { DrumVoice, DrumVoiceConfig } from '../types';

/**
 * Staff position is measured in half-spaces from the bottom line of the staff.
 * 0 = bottom line (E4 in treble), 2 = second line, etc.
 * Negative values are below the staff, values > 8 are above.
 *
 * Standard drumset notation positions:
 *   Kick:       space below staff (pos -2)
 *   Floor Tom:  space 1 (pos 1)
 *   Snare:      space 3 (pos 3)
 *   Cross-stick: space 3 (pos 3, x notehead)
 *   Rack Tom 2: line 3 (pos 4)
 *   Rack Tom 1: space 4 (pos 5)
 *   Hi-hat:     top line + 1 space (pos 9)
 *   Hi-hat open: same as hi-hat (pos 9, circle-x)
 *   Ride:       above staff (pos 10)
 *   Crash:      above staff (pos 11)
 */
export const DRUM_VOICES: DrumVoiceConfig[] = [
  { voice: 'crash',      label: 'Crash',       shortLabel: 'CR', staffPosition: 11, notehead: 'x',        stemDirection: 'up',   midiNote: 49, vexKey: 'a/5/x2',  vexNotehead: 'x2' },
  { voice: 'ride',       label: 'Ride',        shortLabel: 'RD', staffPosition: 10, notehead: 'x',        stemDirection: 'up',   midiNote: 51, vexKey: 'f/5/x2',  vexNotehead: 'x2' },
  { voice: 'hihat',      label: 'Hi-Hat',      shortLabel: 'HH', staffPosition: 9,  notehead: 'x',        stemDirection: 'up',   midiNote: 42, vexKey: 'g/5/x2',  vexNotehead: 'x2' },
  { voice: 'hihat-open', label: 'HH Open',     shortLabel: 'HO', staffPosition: 9,  notehead: 'circle-x', stemDirection: 'up',   midiNote: 46, vexKey: 'g/5/x3',  vexNotehead: 'x3' },
  { voice: 'rack-tom-1', label: 'High Tom',    shortLabel: 'T1', staffPosition: 7,  notehead: 'normal',   stemDirection: 'up',   midiNote: 50, vexKey: 'e/5',     vexNotehead: '' },
  { voice: 'rack-tom-2', label: 'Mid Tom',     shortLabel: 'T2', staffPosition: 5,  notehead: 'normal',   stemDirection: 'up',   midiNote: 47, vexKey: 'c/5',     vexNotehead: '' },
  { voice: 'snare',      label: 'Snare',       shortLabel: 'SN', staffPosition: 3,  notehead: 'normal',   stemDirection: 'up',   midiNote: 38, vexKey: 'c/5',     vexNotehead: '' },
  { voice: 'cross-stick',label: 'Cross Stick', shortLabel: 'XS', staffPosition: 3,  notehead: 'x',        stemDirection: 'up',   midiNote: 37, vexKey: 'c/5/x2',  vexNotehead: 'x2' },
  { voice: 'floor-tom',  label: 'Floor Tom',   shortLabel: 'FT', staffPosition: 1,  notehead: 'normal',   stemDirection: 'up',   midiNote: 43, vexKey: 'a/4',     vexNotehead: '' },
  { voice: 'kick',       label: 'Kick',        shortLabel: 'KD', staffPosition: -2, notehead: 'normal',   stemDirection: 'up',   midiNote: 36, vexKey: 'd/4',     vexNotehead: '' },
];

export const VOICE_CONFIG_MAP: Record<DrumVoice, DrumVoiceConfig> =
  Object.fromEntries(DRUM_VOICES.map(v => [v.voice, v])) as Record<DrumVoice, DrumVoiceConfig>;

/** Voices displayed in the MIDI roll (top to bottom) */
export const MIDI_ROLL_VOICES: DrumVoice[] = [
  'crash', 'ride', 'hihat', 'hihat-open',
  'rack-tom-1', 'rack-tom-2', 'snare',
  'floor-tom', 'kick',
];

export const NOTE_VALUE_TICKS: Record<string, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
};

export const DEFAULT_PPQ = 480;
export const DEFAULT_TEMPO = 120;
export const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
