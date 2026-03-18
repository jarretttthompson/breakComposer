import type { Measure, DrumVoice } from '../types';
import { MIDI_ROLL_VOICES, VOICE_CONFIG_MAP } from '../constants/drumMap';
import { ticksPerMeasure } from '../utils/tick';
import { buildMeasureLayouts, tickToXFromLayouts } from '../utils/layout';
import type { SelectionRect } from '../store/viewStore';



const GRID_SUBDIVISIONS_PER_BEAT = 8; // 32nd notes

export interface MidiRollLayout {
  rowHeight: number;
  labelWidth: number;
  totalRows: number;
  totalHeight: number;
  /** Convert absolute tick to pixel X, accounting for scroll */
  tickToPx: (absTick: number, scrollX: number) => number;
  /** Convert pixel X to absolute tick, accounting for scroll */
  pxToTick: (canvasX: number, scrollX: number) => number;
}

export function getMidiRollLayout(
  rowHeight: number = 28,
  measures: Measure[] = [],
  ppq: number = 480,
  zoom: number = 0.25,
  measureWidths: number[] = []
): MidiRollLayout {
  const totalRows = MIDI_ROLL_VOICES.length;
  const labelWidth = 72;

  // Build per-measure layouts if widths are available
  const hasLayouts = measureWidths.length > 0 && measureWidths.length === measures.length;
  const layouts = hasLayouts ? buildMeasureLayouts(measures, measureWidths, ppq) : null;

  const tickToPx = (absTick: number, scrollX: number): number => {
    if (layouts) {
      const absX = tickToXFromLayouts(absTick, layouts);
      const scrollPx = tickToXFromLayouts(scrollX, layouts) - labelWidth;
      return absX - scrollPx;
    }
    return labelWidth + (absTick - scrollX) * zoom;
  };

  const pxToTick = (canvasX: number, scrollX: number): number => {
    if (layouts) {
      // We need to convert canvasX to absolute X, then to tick
      const scrollPx = tickToXFromLayouts(scrollX, layouts) - labelWidth;
      const absX = canvasX + scrollPx;
      // Find which measure this X falls in
      for (const l of layouts) {
        if (absX >= l.startX && absX <= l.startX + l.width) {
          const fraction = (absX - l.startX) / l.width;
          return l.tickStart + fraction * l.ticks;
        }
      }
      // Beyond last measure
      if (layouts.length > 0) {
        const last = layouts[layouts.length - 1];
        const fraction = (absX - last.startX) / last.width;
        return last.tickStart + fraction * last.ticks;
      }
    }
    return (canvasX - labelWidth) / zoom + scrollX;
  };

  return {
    rowHeight,
    labelWidth,
    totalRows,
    totalHeight: totalRows * rowHeight,
    tickToPx,
    pxToTick,
  };
}

export function drawMidiRollLabels(
  ctx: CanvasRenderingContext2D,
  layout: MidiRollLayout,
  _dpr: number
) {
  const { rowHeight, labelWidth, totalRows } = layout;

  ctx.fillStyle = 'rgba(70, 35, 110, 0.7)';
  ctx.fillRect(0, 0, labelWidth, totalRows * rowHeight);

  ctx.strokeStyle = 'rgba(224, 111, 234, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(labelWidth, 0);
  ctx.lineTo(labelWidth, totalRows * rowHeight);
  ctx.stroke();

  for (let i = 0; i < totalRows; i++) {
    const voice = MIDI_ROLL_VOICES[i];
    const config = VOICE_CONFIG_MAP[voice];
    const y = i * rowHeight;

    if (i > 0) {
      ctx.strokeStyle = 'rgba(224, 111, 234, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(labelWidth, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(240, 230, 250, 0.85)';
    ctx.font = `600 11px 'Vulf Mono', 'Courier New', monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.shortLabel, labelWidth - 10, y + rowHeight / 2);
  }
}

export function drawMidiRollGrid(
  ctx: CanvasRenderingContext2D,
  measures: Measure[],
  ppq: number,
  scrollX: number,
  zoom: number,
  canvasWidth: number,
  layout: MidiRollLayout
) {
  const { rowHeight, labelWidth, totalRows } = layout;
  const gridHeight = totalRows * rowHeight;
  const thirtySecondTick = ppq / 8;

  ctx.clearRect(labelWidth, 0, canvasWidth - labelWidth, gridHeight);

  // Shading pass
  let shadeMeasStart = 0;
  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);
    const [beats, beatVal] = measure.timeSignature;
    const ticksPerBeat = ppq * (4 / beatVal);
    const subsPerBeat = Math.round(ticksPerBeat / thirtySecondTick);
    const halfBeat = Math.floor(subsPerBeat / 2);
    const measEndX = layout.tickToPx(shadeMeasStart + measTicks, scrollX);
    const measStartX = layout.tickToPx(shadeMeasStart, scrollX);

    if (measEndX < labelWidth || measStartX > canvasWidth) {
      shadeMeasStart += measTicks;
      continue;
    }

    for (let beat = 0; beat < beats; beat++) {
      const beatTick = shadeMeasStart + beat * ticksPerBeat;

      for (let sub = 0; sub < subsPerBeat; sub++) {
        const subTick = beatTick + sub * thirtySecondTick;
        const colX = layout.tickToPx(subTick, scrollX);
        const colW = thirtySecondTick * zoom;

        if (colX + colW < labelWidth || colX > canvasWidth) continue;

        const drawX = Math.max(colX, labelWidth);
        const drawW = Math.min(colX + colW, canvasWidth) - drawX;
        if (drawW <= 0) continue;

        let shade: string;
        if (sub === 0) {
          shade = 'rgba(224, 111, 234, 0.08)';
        } else if (sub === halfBeat) {
          shade = 'rgba(224, 111, 234, 0.05)';
        } else if (sub % 2 === 0) {
          shade = 'rgba(224, 111, 234, 0.03)';
        } else {
          shade = 'rgba(0, 0, 0, 0)';
        }

        if (shade !== 'rgba(0, 0, 0, 0)') {
          ctx.fillStyle = shade;
          ctx.fillRect(drawX, 0, drawW, gridHeight);
        }
      }
    }
    shadeMeasStart += measTicks;
  }

  // Row stripes
  for (let i = 0; i < totalRows; i++) {
    const y = i * rowHeight;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(80, 40, 120, 0.55)' : 'rgba(90, 48, 135, 0.5)';
    ctx.fillRect(labelWidth, y, canvasWidth - labelWidth, rowHeight);
  }

  // Grid lines + barlines
  let measureStartTick = 0;

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);
    const [beats, beatVal] = measure.timeSignature;
    const ticksPerBeat = ppq * (4 / beatVal);
    const subsPerBeat = Math.round(ticksPerBeat / thirtySecondTick);
    const halfBeat = Math.floor(subsPerBeat / 2);

    const measStartX2 = layout.tickToPx(measureStartTick, scrollX);
    const measEndX2 = layout.tickToPx(measureStartTick + measTicks, scrollX);

    if (measEndX2 < labelWidth || measStartX2 > canvasWidth) {
      measureStartTick += measTicks;
      continue;
    }

    for (let beat = 0; beat < beats; beat++) {
      const beatTick = measureStartTick + beat * ticksPerBeat;

      for (let sub = 0; sub < subsPerBeat; sub++) {
        if (sub === 0) continue;

        const subTick = beatTick + sub * thirtySecondTick;
        const x = layout.tickToPx(subTick, scrollX);
        if (x < labelWidth || x > canvasWidth) continue;

        if (sub === halfBeat) {
          ctx.strokeStyle = 'rgba(200, 160, 230, 0.35)';
          ctx.lineWidth = 1;
        } else if (sub % 2 === 0) {
          ctx.strokeStyle = 'rgba(180, 140, 210, 0.25)';
          ctx.lineWidth = 0.7;
        } else {
          ctx.strokeStyle = 'rgba(160, 120, 190, 0.18)';
          ctx.lineWidth = 0.5;
        }
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gridHeight);
        ctx.stroke();
      }

      if (beat > 0) {
        const beatX = layout.tickToPx(beatTick, scrollX);
        if (beatX >= labelWidth && beatX <= canvasWidth) {
          ctx.strokeStyle = 'rgba(224, 111, 234, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(beatX, 0);
          ctx.lineTo(beatX, gridHeight);
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = 'rgba(224, 111, 234, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(measStartX2, 0);
    ctx.lineTo(measStartX2, gridHeight);
    ctx.stroke();

    ctx.fillStyle = 'rgba(240, 230, 250, 0.8)';
    ctx.font = "600 9px 'Vulf Mono', 'Courier New', monospace";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(mi + 1), measStartX2 + 4, 2);

    measureStartTick += measTicks;
  }

  const finalX = layout.tickToPx(measureStartTick, scrollX);
  if (finalX >= labelWidth && finalX <= canvasWidth) {
    ctx.strokeStyle = 'rgba(224, 111, 234, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(finalX, 0);
    ctx.lineTo(finalX, gridHeight);
    ctx.stroke();
  }

  for (let i = 1; i < totalRows; i++) {
    const y = i * rowHeight;
    ctx.strokeStyle = 'rgba(224, 111, 234, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(labelWidth, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
}

export function drawAlignmentGuides(
  ctx: CanvasRenderingContext2D,
  measures: Measure[],
  ppq: number,
  scrollX: number,
  _zoom: number,
  canvasWidth: number,
  layout: MidiRollLayout
) {
  const { labelWidth, totalRows, rowHeight } = layout;
  const gridHeight = totalRows * rowHeight;

  const noteTickSet = new Set<number>();
  let measureStartTick = 0;
  for (const measure of measures) {
    for (const note of measure.notes) {
      noteTickSet.add(measureStartTick + note.tick);
    }
    measureStartTick += ticksPerMeasure(measure.timeSignature, ppq);
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 247, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);

  for (const absTick of noteTickSet) {
    const x = layout.tickToPx(absTick, scrollX);
    if (x < labelWidth || x > canvasWidth) continue;

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, gridHeight);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawMidiRollNotes(
  ctx: CanvasRenderingContext2D,
  measures: Measure[],
  ppq: number,
  scrollX: number,
  zoom: number,
  canvasWidth: number,
  layout: MidiRollLayout
) {
  const { rowHeight, labelWidth } = layout;
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;
  const cellWidth = gridTickSize * zoom;

  let measureStartTick = 0;

  ctx.save();
  ctx.shadowColor = 'rgba(224, 111, 234, 0.7)';
  ctx.shadowBlur = 10;

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);

    for (const note of measure.notes) {
      const voiceIdx = MIDI_ROLL_VOICES.indexOf(note.voice);
      if (voiceIdx === -1) continue;

      const absTick = measureStartTick + note.tick;
      const x = layout.tickToPx(absTick, scrollX);
      const y = voiceIdx * rowHeight;

      if (x + cellWidth < labelWidth || x > canvasWidth) continue;

      const alpha = 0.6 + (note.velocity / 127) * 0.4;

      if (note.ghost) {
        ctx.shadowColor = 'rgba(160, 128, 200, 0.4)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(160, 128, 200, ${alpha * 0.5})`;
      } else if (note.accent) {
        ctx.shadowColor = 'rgba(0, 247, 255, 0.8)';
        ctx.shadowBlur = 14;
        ctx.fillStyle = `rgba(0, 247, 255, ${alpha})`;
      } else {
        ctx.shadowColor = 'rgba(224, 111, 234, 0.7)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(224, 111, 234, ${alpha})`;
      }

      const pad = 2;
      const drawX = Math.max(x + pad, labelWidth);
      const drawW = Math.min(cellWidth - pad * 2, canvasWidth - drawX);
      const noteW = Math.max(drawW, 2);
      const noteH = rowHeight - pad * 2;
      const radius = 3;

      ctx.beginPath();
      ctx.moveTo(drawX + radius, y + pad);
      ctx.lineTo(drawX + noteW - radius, y + pad);
      ctx.quadraticCurveTo(drawX + noteW, y + pad, drawX + noteW, y + pad + radius);
      ctx.lineTo(drawX + noteW, y + pad + noteH - radius);
      ctx.quadraticCurveTo(drawX + noteW, y + pad + noteH, drawX + noteW - radius, y + pad + noteH);
      ctx.lineTo(drawX + radius, y + pad + noteH);
      ctx.quadraticCurveTo(drawX, y + pad + noteH, drawX, y + pad + noteH - radius);
      ctx.lineTo(drawX, y + pad + radius);
      ctx.quadraticCurveTo(drawX, y + pad, drawX + radius, y + pad);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      if (note.accent) {
        ctx.fillStyle = `rgba(130, 255, 255, ${alpha})`;
      } else if (!note.ghost) {
        ctx.fillStyle = `rgba(240, 154, 250, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(180, 160, 210, ${alpha * 0.4})`;
      }
      ctx.fillRect(drawX, y + pad, noteW, 2);
      ctx.shadowBlur = 10;
    }

    measureStartTick += measTicks;
  }

  ctx.restore();
}

export function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  playheadTick: number,
  scrollX: number,
  _zoom: number,
  layout: MidiRollLayout,
  height: number
) {
  const x = layout.tickToPx(playheadTick, scrollX);
  if (x < layout.labelWidth) return;

  ctx.strokeStyle = '#ff3366';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}

export function hitTestMidiRoll(
  canvasX: number,
  canvasY: number,
  scrollX: number,
  _zoom: number,
  ppq: number,
  layout: MidiRollLayout
): { voice: DrumVoice; tick: number; row: number } | null {
  const { rowHeight, labelWidth, totalRows } = layout;

  if (canvasX < labelWidth) return null;

  const row = Math.floor(canvasY / rowHeight);
  if (row < 0 || row >= totalRows) return null;

  const voice = MIDI_ROLL_VOICES[row];
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;

  const rawTick = layout.pxToTick(canvasX, scrollX);
  const snappedTick = Math.floor(rawTick / gridTickSize) * gridTickSize;

  return { voice, tick: snappedTick, row };
}

export function canvasToTickRow(
  canvasX: number,
  canvasY: number,
  scrollX: number,
  _zoom: number,
  ppq: number,
  layout: MidiRollLayout
): { tick: number; row: number } {
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;
  const rawTick = layout.pxToTick(canvasX, scrollX);
  const snappedTick = Math.floor(rawTick / gridTickSize) * gridTickSize;
  const row = Math.floor(canvasY / layout.rowHeight);
  return { tick: snappedTick, row };
}

export function drawSelectionRect(
  ctx: CanvasRenderingContext2D,
  selection: SelectionRect,
  scrollX: number,
  _zoom: number,
  layout: MidiRollLayout,
  canvasWidth: number
) {
  const { rowHeight, labelWidth } = layout;

  const minTick = Math.min(selection.startTick, selection.endTick);
  const maxTick = Math.max(selection.startTick, selection.endTick);
  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.max(selection.startRow, selection.endRow);

  const gridTickSize = 60;
  const x1 = layout.tickToPx(minTick, scrollX);
  const x2 = layout.tickToPx(maxTick + gridTickSize, scrollX);
  const y1 = minRow * rowHeight;
  const y2 = (maxRow + 1) * rowHeight;

  const drawX = Math.max(x1, labelWidth);
  const drawX2 = Math.min(x2, canvasWidth);
  if (drawX2 <= drawX) return;

  ctx.fillStyle = 'rgba(224, 111, 234, 0.12)';
  ctx.fillRect(drawX, y1, drawX2 - drawX, y2 - y1);

  ctx.strokeStyle = 'rgba(224, 111, 234, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 2]);
  ctx.strokeRect(drawX, y1, drawX2 - drawX, y2 - y1);
  ctx.setLineDash([]);
}

export function isNoteInSelection(
  absTick: number,
  voiceRow: number,
  selection: SelectionRect | null
): boolean {
  if (!selection) return false;
  const minTick = Math.min(selection.startTick, selection.endTick);
  const maxTick = Math.max(selection.startTick, selection.endTick);
  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.max(selection.startRow, selection.endRow);
  return absTick >= minTick && absTick <= maxTick && voiceRow >= minRow && voiceRow <= maxRow;
}

export interface DragDelta {
  tickDelta: number;
  rowDelta: number;
}

export interface ResizeEdge {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

const RESIZE_HANDLE_PX = 8;

export function getResizeEdge(
  canvasX: number,
  canvasY: number,
  selection: SelectionRect,
  scrollX: number,
  _zoom: number,
  ppq: number,
  layout: MidiRollLayout
): ResizeEdge | null {
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;
  const minTick = Math.min(selection.startTick, selection.endTick);
  const maxTick = Math.max(selection.startTick, selection.endTick);
  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.max(selection.startRow, selection.endRow);

  const leftX = layout.tickToPx(minTick, scrollX);
  const rightX = layout.tickToPx(maxTick + gridTickSize, scrollX);
  const topY = minRow * layout.rowHeight;
  const bottomY = (maxRow + 1) * layout.rowHeight;

  const h = RESIZE_HANDLE_PX;
  if (canvasX < leftX - h || canvasX > rightX + h) return null;
  if (canvasY < topY - h || canvasY > bottomY + h) return null;

  const nearLeft = Math.abs(canvasX - leftX) <= h;
  const nearRight = Math.abs(canvasX - rightX) <= h;
  const nearTop = Math.abs(canvasY - topY) <= h;
  const nearBottom = Math.abs(canvasY - bottomY) <= h;

  if (!nearLeft && !nearRight && !nearTop && !nearBottom) return null;
  return { left: nearLeft, right: nearRight, top: nearTop, bottom: nearBottom };
}

export function getResizeCursor(edge: ResizeEdge): string {
  const { left, right, top, bottom } = edge;
  if ((top && left) || (bottom && right)) return 'nwse-resize';
  if ((top && right) || (bottom && left)) return 'nesw-resize';
  if (left || right) return 'ew-resize';
  if (top || bottom) return 'ns-resize';
  return 'default';
}

export function isInsideSelection(
  tick: number,
  row: number,
  selection: SelectionRect
): boolean {
  const minTick = Math.min(selection.startTick, selection.endTick);
  const maxTick = Math.max(selection.startTick, selection.endTick);
  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.max(selection.startRow, selection.endRow);
  return tick >= minTick && tick <= maxTick && row >= minRow && row <= maxRow;
}

export function drawMidiRollNotesWithSelection(
  ctx: CanvasRenderingContext2D,
  measures: Measure[],
  ppq: number,
  scrollX: number,
  zoom: number,
  canvasWidth: number,
  layout: MidiRollLayout,
  selection: SelectionRect | null,
  dragDelta: DragDelta | null = null
) {
  const { rowHeight, labelWidth } = layout;
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;
  const cellWidth = gridTickSize * zoom;
  const isMoving = dragDelta !== null && selection !== null;

  let measureStartTick = 0;

  ctx.save();

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);

    for (const note of measure.notes) {
      const voiceIdx = MIDI_ROLL_VOICES.indexOf(note.voice);
      if (voiceIdx === -1) continue;

      const absTick = measureStartTick + note.tick;
      const selected = isNoteInSelection(absTick, voiceIdx, selection);

      if (isMoving && selected) continue;

      const x = layout.tickToPx(absTick, scrollX);
      const y = voiceIdx * rowHeight;

      if (x + cellWidth < labelWidth || x > canvasWidth) continue;

      const alpha = 0.6 + (note.velocity / 127) * 0.4;
      const isGhost = !!note.ghost;
      const isAccent = !!note.accent;

      let fillColor: string;
      let topColor: string;
      if (selected) {
        fillColor = `rgba(0, 247, 255, ${alpha})`;
        topColor = `rgba(130, 255, 255, ${alpha})`;
        ctx.shadowColor = 'rgba(0, 247, 255, 0.8)';
        ctx.shadowBlur = 14;
      } else if (isGhost) {
        fillColor = `rgba(160, 128, 200, ${alpha * 0.45})`;
        topColor = `rgba(180, 160, 210, ${alpha * 0.5})`;
        ctx.shadowColor = 'rgba(160, 128, 200, 0.3)';
        ctx.shadowBlur = 5;
      } else if (isAccent) {
        fillColor = `rgba(0, 247, 255, ${alpha})`;
        topColor = `rgba(130, 255, 255, ${alpha})`;
        ctx.shadowColor = 'rgba(0, 247, 255, 0.8)';
        ctx.shadowBlur = 14;
      } else {
        fillColor = `rgba(224, 111, 234, ${alpha})`;
        topColor = `rgba(240, 154, 250, ${alpha})`;
        ctx.shadowColor = 'rgba(224, 111, 234, 0.7)';
        ctx.shadowBlur = 10;
      }

      const pad = 2;
      const drawX = Math.max(x + pad, labelWidth);
      const drawW = Math.min(cellWidth - pad * 2, canvasWidth - drawX);
      const noteW = Math.max(drawW, 2);
      const noteH = rowHeight - pad * 2;
      const radius = 3;

      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(drawX + radius, y + pad);
      ctx.lineTo(drawX + noteW - radius, y + pad);
      ctx.quadraticCurveTo(drawX + noteW, y + pad, drawX + noteW, y + pad + radius);
      ctx.lineTo(drawX + noteW, y + pad + noteH - radius);
      ctx.quadraticCurveTo(drawX + noteW, y + pad + noteH, drawX + noteW - radius, y + pad + noteH);
      ctx.lineTo(drawX + radius, y + pad + noteH);
      ctx.quadraticCurveTo(drawX, y + pad + noteH, drawX, y + pad + noteH - radius);
      ctx.lineTo(drawX, y + pad + radius);
      ctx.quadraticCurveTo(drawX, y + pad, drawX + radius, y + pad);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = topColor;
      ctx.fillRect(drawX, y + pad, noteW, 2);

      if (isGhost) {
        ctx.strokeStyle = `rgba(160, 128, 200, 0.5)`;
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, y + pad, noteW, noteH);
        ctx.setLineDash([]);
      }
    }

    measureStartTick += measTicks;
  }

  ctx.restore();

  if (isMoving && dragDelta) {
    drawDragGhosts(ctx, measures, ppq, scrollX, zoom, canvasWidth, layout, selection!, dragDelta);
  }
}

function drawDragGhosts(
  ctx: CanvasRenderingContext2D,
  measures: Measure[],
  ppq: number,
  scrollX: number,
  zoom: number,
  canvasWidth: number,
  layout: MidiRollLayout,
  selection: SelectionRect,
  delta: DragDelta
) {
  const { rowHeight, labelWidth, totalRows } = layout;
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;
  const cellWidth = gridTickSize * zoom;

  let measureStartTick = 0;

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);

    for (const note of measure.notes) {
      const voiceIdx = MIDI_ROLL_VOICES.indexOf(note.voice);
      if (voiceIdx === -1) continue;

      const absTick = measureStartTick + note.tick;
      if (!isNoteInSelection(absTick, voiceIdx, selection)) continue;

      const newTick = absTick + delta.tickDelta;
      const newRow = voiceIdx + delta.rowDelta;
      if (newRow < 0 || newRow >= totalRows) continue;

      const x = layout.tickToPx(newTick, scrollX);
      const y = newRow * rowHeight;

      if (x + cellWidth < labelWidth || x > canvasWidth) continue;

      ctx.fillStyle = 'rgba(0, 247, 255, 0.45)';
      const pad = 2;
      const drawX = Math.max(x + pad, labelWidth);
      const drawW = Math.min(cellWidth - pad * 2, canvasWidth - drawX);
      ctx.fillRect(drawX, y + pad, Math.max(drawW, 2), rowHeight - pad * 2);

      ctx.fillStyle = 'rgba(100, 255, 255, 0.6)';
      ctx.fillRect(drawX, y + pad, Math.max(drawW, 2), 2);
    }

    measureStartTick += measTicks;
  }
}
