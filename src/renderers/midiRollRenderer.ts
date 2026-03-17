import type { Measure, DrumVoice } from '../types';
import { MIDI_ROLL_VOICES, VOICE_CONFIG_MAP } from '../constants/drumMap';
import { ticksPerMeasure } from '../utils/tick';
import type { SelectionRect } from '../store/viewStore';

const GRID_SUBDIVISIONS_PER_BEAT = 8; // 32nd notes

export interface MidiRollLayout {
  rowHeight: number;
  labelWidth: number;
  totalRows: number;
  totalHeight: number;
}

export function getMidiRollLayout(rowHeight: number = 28): MidiRollLayout {
  const totalRows = MIDI_ROLL_VOICES.length;
  return {
    rowHeight,
    labelWidth: 72,
    totalRows,
    totalHeight: totalRows * rowHeight,
  };
}

export function drawMidiRollLabels(
  ctx: CanvasRenderingContext2D,
  layout: MidiRollLayout,
  _dpr: number
) {
  const { rowHeight, labelWidth, totalRows } = layout;

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, labelWidth, totalRows * rowHeight);

  ctx.strokeStyle = '#334155';
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
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(labelWidth, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 11px Inter, sans-serif`;
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
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;

  ctx.clearRect(labelWidth, 0, canvasWidth - labelWidth, gridHeight);

  // --- (C) Rhythmic-weight background shading ---
  let shadeMeasStart = 0;
  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);
    const [beats] = measure.timeSignature;
    const measEndX = labelWidth + (shadeMeasStart + measTicks - scrollX) * zoom;
    const measStartX = labelWidth + (shadeMeasStart - scrollX) * zoom;

    if (measEndX < labelWidth || measStartX > canvasWidth) {
      shadeMeasStart += measTicks;
      continue;
    }

    for (let beat = 0; beat < beats; beat++) {
      const beatTick = shadeMeasStart + beat * ppq;

      for (let sub = 0; sub < GRID_SUBDIVISIONS_PER_BEAT; sub++) {
        const subTick = beatTick + sub * gridTickSize;
        const colX = labelWidth + (subTick - scrollX) * zoom;
        const colW = gridTickSize * zoom;

        if (colX + colW < labelWidth || colX > canvasWidth) continue;

        const drawX = Math.max(colX, labelWidth);
        const drawW = Math.min(colX + colW, canvasWidth) - drawX;
        if (drawW <= 0) continue;

        let shade: string;
        if (sub === 0) {
          shade = 'rgba(59, 130, 246, 0.06)';      // quarter-note: strongest
        } else if (sub === 4) {
          shade = 'rgba(59, 130, 246, 0.035)';     // eighth-note
        } else if (sub % 2 === 0) {
          shade = 'rgba(59, 130, 246, 0.02)';      // sixteenth
        } else {
          shade = 'rgba(0, 0, 0, 0)';               // 32nd: transparent
        }

        if (shade !== 'rgba(0, 0, 0, 0)') {
          ctx.fillStyle = shade;
          ctx.fillRect(drawX, 0, drawW, gridHeight);
        }
      }
    }
    shadeMeasStart += measTicks;
  }

  // --- Row stripes (on top of shading) ---
  for (let i = 0; i < totalRows; i++) {
    const y = i * rowHeight;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(15, 23, 42, 0.55)' : 'rgba(20, 28, 46, 0.55)';
    ctx.fillRect(labelWidth, y, canvasWidth - labelWidth, rowHeight);
  }

  // --- Grid lines ---
  let measureStartTick = 0;

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);
    const [beats] = measure.timeSignature;

    const measStartX2 = labelWidth + (measureStartTick - scrollX) * zoom;
    const measEndX2 = labelWidth + (measureStartTick + measTicks - scrollX) * zoom;

    if (measEndX2 < labelWidth || measStartX2 > canvasWidth) {
      measureStartTick += measTicks;
      continue;
    }

    for (let beat = 0; beat < beats; beat++) {
      const beatTick = measureStartTick + beat * ppq;

      for (let sub = 0; sub < GRID_SUBDIVISIONS_PER_BEAT; sub++) {
        if (sub === 0) continue;

        const subTick = beatTick + sub * gridTickSize;
        const x = labelWidth + (subTick - scrollX) * zoom;
        if (x < labelWidth || x > canvasWidth) continue;

        if (sub === 4) {
          ctx.strokeStyle = '#3d4d63';
          ctx.lineWidth = 0.5;
        } else if (sub % 2 === 0) {
          ctx.strokeStyle = '#2a3548';
          ctx.lineWidth = 0.4;
        } else {
          ctx.strokeStyle = '#1e2a3a';
          ctx.lineWidth = 0.3;
        }
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, gridHeight);
        ctx.stroke();
      }

      if (beat > 0) {
        const beatX = labelWidth + (beatTick - scrollX) * zoom;
        if (beatX >= labelWidth && beatX <= canvasWidth) {
          ctx.strokeStyle = '#4a5a72';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(beatX, 0);
          ctx.lineTo(beatX, gridHeight);
          ctx.stroke();
        }
      }
    }

    // Barline
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(measStartX2, 0);
    ctx.lineTo(measStartX2, gridHeight);
    ctx.stroke();

    // Measure number
    ctx.fillStyle = '#64748b';
    ctx.font = '600 9px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(mi + 1), measStartX2 + 4, 2);

    measureStartTick += measTicks;
  }

  // Final barline
  const finalX = labelWidth + (measureStartTick - scrollX) * zoom;
  if (finalX >= labelWidth && finalX <= canvasWidth) {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(finalX, 0);
    ctx.lineTo(finalX, gridHeight);
    ctx.stroke();
  }

  // Row divider lines
  for (let i = 1; i < totalRows; i++) {
    const y = i * rowHeight;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(labelWidth, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
}

/** (B) Draw vertical alignment guides at every tick that has a note */
export function drawAlignmentGuides(
  ctx: CanvasRenderingContext2D,
  measures: Measure[],
  ppq: number,
  scrollX: number,
  zoom: number,
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
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.18)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);

  for (const absTick of noteTickSet) {
    const x = labelWidth + (absTick - scrollX) * zoom;
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

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);

    for (const note of measure.notes) {
      const voiceIdx = MIDI_ROLL_VOICES.indexOf(note.voice);
      if (voiceIdx === -1) continue;

      const absTick = measureStartTick + note.tick;
      const x = labelWidth + (absTick - scrollX) * zoom;
      const y = voiceIdx * rowHeight;

      if (x + cellWidth < labelWidth || x > canvasWidth) continue;

      const alpha = 0.5 + (note.velocity / 127) * 0.5;
      ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;

      const pad = 2;
      const drawX = Math.max(x + pad, labelWidth);
      const drawW = Math.min(cellWidth - pad * 2, canvasWidth - drawX);
      ctx.fillRect(drawX, y + pad, Math.max(drawW, 2), rowHeight - pad * 2);

      ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
      ctx.fillRect(drawX, y + pad, Math.max(drawW, 2), 2);
    }

    measureStartTick += measTicks;
  }
}

export function drawPlayhead(
  ctx: CanvasRenderingContext2D,
  playheadTick: number,
  scrollX: number,
  zoom: number,
  labelWidth: number,
  height: number
) {
  const x = labelWidth + (playheadTick - scrollX) * zoom;
  if (x < labelWidth) return;

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}

/** Hit-test: given a canvas click, return the voice and tick */
export function hitTestMidiRoll(
  canvasX: number,
  canvasY: number,
  scrollX: number,
  zoom: number,
  ppq: number,
  layout: MidiRollLayout
): { voice: DrumVoice; tick: number; row: number } | null {
  const { rowHeight, labelWidth, totalRows } = layout;

  if (canvasX < labelWidth) return null;

  const row = Math.floor(canvasY / rowHeight);
  if (row < 0 || row >= totalRows) return null;

  const voice = MIDI_ROLL_VOICES[row];
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;

  const rawTick = (canvasX - labelWidth) / zoom + scrollX;
  const snappedTick = Math.floor(rawTick / gridTickSize) * gridTickSize;

  return { voice, tick: snappedTick, row };
}

/** Convert canvas (x, y) to (tick, row) without snapping */
export function canvasToTickRow(
  canvasX: number,
  canvasY: number,
  scrollX: number,
  zoom: number,
  ppq: number,
  layout: MidiRollLayout
): { tick: number; row: number } {
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;
  const rawTick = (canvasX - layout.labelWidth) / zoom + scrollX;
  const snappedTick = Math.floor(rawTick / gridTickSize) * gridTickSize;
  const row = Math.floor(canvasY / layout.rowHeight);
  return { tick: snappedTick, row };
}

/** Draw a selection rectangle overlay */
export function drawSelectionRect(
  ctx: CanvasRenderingContext2D,
  selection: SelectionRect,
  scrollX: number,
  zoom: number,
  layout: MidiRollLayout,
  canvasWidth: number
) {
  const { rowHeight, labelWidth } = layout;

  const minTick = Math.min(selection.startTick, selection.endTick);
  const maxTick = Math.max(selection.startTick, selection.endTick);
  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.max(selection.startRow, selection.endRow);

  const gridTickSize = 60; // ppq / 8 = 480/8 = 60 (32nd note)
  const x1 = labelWidth + (minTick - scrollX) * zoom;
  const x2 = labelWidth + (maxTick + gridTickSize - scrollX) * zoom;
  const y1 = minRow * rowHeight;
  const y2 = (maxRow + 1) * rowHeight;

  const drawX = Math.max(x1, labelWidth);
  const drawX2 = Math.min(x2, canvasWidth);
  if (drawX2 <= drawX) return;

  ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
  ctx.fillRect(drawX, y1, drawX2 - drawX, y2 - y1);

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 2]);
  ctx.strokeRect(drawX, y1, drawX2 - drawX, y2 - y1);
  ctx.setLineDash([]);
}

/** Check whether a note (by absolute tick + voice row) falls inside the selection */
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

/** Detect if a canvas position is on a resize edge/corner of the selection */
export function getResizeEdge(
  canvasX: number,
  canvasY: number,
  selection: SelectionRect,
  scrollX: number,
  zoom: number,
  ppq: number,
  layout: MidiRollLayout
): ResizeEdge | null {
  const gridTickSize = ppq / GRID_SUBDIVISIONS_PER_BEAT;
  const minTick = Math.min(selection.startTick, selection.endTick);
  const maxTick = Math.max(selection.startTick, selection.endTick);
  const minRow = Math.min(selection.startRow, selection.endRow);
  const maxRow = Math.max(selection.startRow, selection.endRow);

  const leftX = layout.labelWidth + (minTick - scrollX) * zoom;
  const rightX = layout.labelWidth + (maxTick + gridTickSize - scrollX) * zoom;
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

/** Map a ResizeEdge to a CSS cursor value */
export function getResizeCursor(edge: ResizeEdge): string {
  const { left, right, top, bottom } = edge;
  if ((top && left) || (bottom && right)) return 'nwse-resize';
  if ((top && right) || (bottom && left)) return 'nesw-resize';
  if (left || right) return 'ew-resize';
  if (top || bottom) return 'ns-resize';
  return 'default';
}

/** Check whether a (tick, row) position falls inside a normalized selection */
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

/** Draw notes with optional selection highlighting and optional drag preview */
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

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);

    for (const note of measure.notes) {
      const voiceIdx = MIDI_ROLL_VOICES.indexOf(note.voice);
      if (voiceIdx === -1) continue;

      const absTick = measureStartTick + note.tick;
      const selected = isNoteInSelection(absTick, voiceIdx, selection);

      if (isMoving && selected) continue;

      const x = labelWidth + (absTick - scrollX) * zoom;
      const y = voiceIdx * rowHeight;

      if (x + cellWidth < labelWidth || x > canvasWidth) continue;

      const alpha = 0.5 + (note.velocity / 127) * 0.5;
      const isGhost = !!note.ghost;
      const isAccent = !!note.accent;

      let fillColor: string;
      let topColor: string;
      if (selected) {
        fillColor = `rgba(250, 204, 21, ${alpha})`;
        topColor = `rgba(253, 224, 71, ${alpha})`;
      } else if (isGhost) {
        fillColor = `rgba(148, 163, 184, ${alpha * 0.5})`;
        topColor = `rgba(203, 213, 225, ${alpha * 0.6})`;
      } else if (isAccent) {
        fillColor = `rgba(249, 115, 22, ${alpha})`;
        topColor = `rgba(251, 146, 60, ${alpha})`;
      } else {
        fillColor = `rgba(59, 130, 246, ${alpha})`;
        topColor = `rgba(96, 165, 250, ${alpha})`;
      }

      const pad = 2;
      const drawX = Math.max(x + pad, labelWidth);
      const drawW = Math.min(cellWidth - pad * 2, canvasWidth - drawX);
      ctx.fillStyle = fillColor;
      ctx.fillRect(drawX, y + pad, Math.max(drawW, 2), rowHeight - pad * 2);

      ctx.fillStyle = topColor;
      ctx.fillRect(drawX, y + pad, Math.max(drawW, 2), 2);

      if (isGhost) {
        ctx.strokeStyle = `rgba(148, 163, 184, 0.6)`;
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, y + pad, Math.max(drawW, 2), rowHeight - pad * 2);
        ctx.setLineDash([]);
      }
    }

    measureStartTick += measTicks;
  }

  if (isMoving && dragDelta) {
    drawDragGhosts(ctx, measures, ppq, scrollX, zoom, canvasWidth, layout, selection!, dragDelta);
  }
}

/** Draw translucent ghost notes at the drag-offset position */
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

      const x = labelWidth + (newTick - scrollX) * zoom;
      const y = newRow * rowHeight;

      if (x + cellWidth < labelWidth || x > canvasWidth) continue;

      ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
      const pad = 2;
      const drawX = Math.max(x + pad, labelWidth);
      const drawW = Math.min(cellWidth - pad * 2, canvasWidth - drawX);
      ctx.fillRect(drawX, y + pad, Math.max(drawW, 2), rowHeight - pad * 2);

      ctx.fillStyle = 'rgba(253, 224, 71, 0.6)';
      ctx.fillRect(drawX, y + pad, Math.max(drawW, 2), 2);
    }

    measureStartTick += measTicks;
  }
}
