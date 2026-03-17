import { DEFAULT_PPQ } from '../constants/drumMap';

export function tickToPixel(tick: number, zoom: number): number {
  return tick * zoom;
}

export function pixelToTick(pixel: number, zoom: number): number {
  return pixel / zoom;
}

/** Quantize a tick value to the nearest grid division */
export function quantizeTick(tick: number, ppq: number, subdivisionPerBeat: number): number {
  const gridSize = ppq / subdivisionPerBeat;
  return Math.round(tick / gridSize) * gridSize;
}

/** Get the number of ticks in a measure given time signature and PPQ */
export function ticksPerMeasure(timeSignature: [number, number], ppq: number): number {
  const [beats, beatValue] = timeSignature;
  return beats * (ppq * (4 / beatValue));
}

/** Get subdivisions per beat for a given note value */
export function subdivisionsForNoteValue(noteValue: string): number {
  switch (noteValue) {
    case 'whole': return 0.25;
    case 'half': return 0.5;
    case 'quarter': return 1;
    case 'eighth': return 2;
    case 'sixteenth': return 4;
    default: return 1;
  }
}

/** Convert tick to beat number (0-based) */
export function tickToBeat(tick: number, ppq: number = DEFAULT_PPQ): number {
  return tick / ppq;
}
