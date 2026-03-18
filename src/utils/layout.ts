import type { Measure } from '../types';
import { ticksPerMeasure } from './tick';

const LABEL_WIDTH = 72;

export interface MeasureLayout {
  /** pixel X where this measure starts (after the label column) */
  startX: number;
  /** pixel width of this measure */
  width: number;
  /** cumulative tick at the start of this measure */
  tickStart: number;
  /** number of ticks in this measure */
  ticks: number;
}

/**
 * Build a layout table from per-measure pixel widths.
 * Both the staff renderer and the piano roll use this to convert ticks ↔ pixels.
 */
export function buildMeasureLayouts(
  measures: Measure[],
  measureWidths: number[],
  ppq: number
): MeasureLayout[] {
  const layouts: MeasureLayout[] = [];
  let currentX = LABEL_WIDTH;
  let cumulativeTick = 0;

  for (let i = 0; i < measures.length; i++) {
    const ticks = ticksPerMeasure(measures[i].timeSignature, ppq);
    layouts.push({
      startX: currentX,
      width: measureWidths[i] ?? ticks * 0.25,
      tickStart: cumulativeTick,
      ticks,
    });
    currentX += measureWidths[i] ?? ticks * 0.25;
    cumulativeTick += ticks;
  }

  return layouts;
}

/**
 * Convert an absolute tick to a pixel X using per-measure layouts.
 * Uses linear interpolation within each measure.
 */
export function tickToXFromLayouts(
  absoluteTick: number,
  layouts: MeasureLayout[]
): number {
  if (layouts.length === 0) return LABEL_WIDTH;

  for (const l of layouts) {
    if (absoluteTick >= l.tickStart && absoluteTick <= l.tickStart + l.ticks) {
      const fraction = (absoluteTick - l.tickStart) / l.ticks;
      return l.startX + fraction * l.width;
    }
  }

  // Beyond last measure — extrapolate from the last one
  const last = layouts[layouts.length - 1];
  const fraction = (absoluteTick - last.tickStart) / last.ticks;
  return last.startX + fraction * last.width;
}

/**
 * Convert a pixel X to an absolute tick using per-measure layouts.
 */
export function xToTickFromLayouts(
  x: number,
  layouts: MeasureLayout[]
): number {
  if (layouts.length === 0) return 0;

  for (const l of layouts) {
    if (x >= l.startX && x <= l.startX + l.width) {
      const fraction = (x - l.startX) / l.width;
      return l.tickStart + fraction * l.ticks;
    }
  }

  const last = layouts[layouts.length - 1];
  const fraction = (x - last.startX) / last.width;
  return last.tickStart + fraction * last.ticks;
}
