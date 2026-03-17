import { useRef, useEffect, useCallback, useState } from 'react';
import { useScoreStore } from '../store/scoreStore';
import { useViewStore } from '../store/viewStore';
import type { SelectionRect } from '../store/viewStore';
import type { DragDelta, ResizeEdge } from '../renderers/midiRollRenderer';
import {
  getMidiRollLayout,
  drawMidiRollLabels,
  drawMidiRollGrid,
  drawMidiRollNotesWithSelection,
  drawAlignmentGuides,
  drawPlayhead,
  drawSelectionRect,
  hitTestMidiRoll,
  canvasToTickRow,
  isInsideSelection,
  isNoteInSelection,
  getResizeEdge,
  getResizeCursor,
} from '../renderers/midiRollRenderer';
import { ticksPerMeasure } from '../utils/tick';
import { MIDI_ROLL_VOICES } from '../constants/drumMap';

const DRAG_THRESHOLD = 4;

type Mode =
  | 'none'
  | 'pending-empty'   // mousedown on empty cell, waiting for drag vs click
  | 'pending-note'    // mousedown on existing note, waiting for drag vs click
  | 'selecting'       // dragging to draw selection rectangle
  | 'moving'          // dragging selection to move notes
  | 'copying'         // Cmd+dragging selection to copy notes
  | 'resizing'        // dragging selection edge to resize
  | 'note-moving';    // dragging a single note

function getStoreSelection() { return useViewStore.getState().selection; }
function getView() { const s = useViewStore.getState(); return { scrollX: s.scrollX, zoom: s.zoom }; }

function hasNoteAt(absTick: number, row: number): boolean {
  if (row < 0 || row >= MIDI_ROLL_VOICES.length) return false;
  const voice = MIDI_ROLL_VOICES[row];
  const { measures, ppq } = useScoreStore.getState().score;
  let offset = 0;
  for (const m of measures) {
    const mt = ticksPerMeasure(m.timeSignature, ppq);
    if (absTick >= offset && absTick < offset + mt) {
      return m.notes.some((n) => n.voice === voice && n.tick === absTick - offset);
    }
    offset += mt;
  }
  return false;
}

export function MidiRollCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  const modeRef = useRef<Mode>('none');
  const dragStartRef = useRef<{ x: number; y: number; tick: number; row: number } | null>(null);
  const isDraggingRef = useRef(false);
  const liveSelectionRef = useRef<SelectionRect | null>(null);
  const liveDragDeltaRef = useRef<DragDelta | null>(null);
  const resizeEdgeRef = useRef<ResizeEdge | null>(null);
  const resizeStartSelRef = useRef<SelectionRect | null>(null);
  const showSelectionRectRef = useRef(false);

  const [cursor, setCursor] = useState('crosshair');

  const score = useScoreStore((s) => s.score);
  const toggleNote = useScoreStore((s) => s.toggleNote);
  const toggleNoteGhost = useScoreStore((s) => s.toggleNoteGhost);
  const toggleNoteAccent = useScoreStore((s) => s.toggleNoteAccent);
  const moveNotes = useScoreStore((s) => s.moveNotes);
  const scrollX = useViewStore((s) => s.scrollX);
  const zoom = useViewStore((s) => s.zoom);
  const isPlaying = useViewStore((s) => s.isPlaying);
  const playheadTick = useViewStore((s) => s.playheadTick);
  const setScrollX = useViewStore((s) => s.setScrollX);
  const adjustZoom = useViewStore((s) => s.adjustZoom);
  const selection = useViewStore((s) => s.selection);
  const setSelection = useViewStore((s) => s.setSelection);

  const layout = getMidiRollLayout(28);

  // --- draw loop ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    drawMidiRollGrid(ctx, score.measures, score.ppq, scrollX, zoom, rect.width, layout);
    drawAlignmentGuides(ctx, score.measures, score.ppq, scrollX, zoom, rect.width, layout);

    const activeSel = liveSelectionRef.current ?? selection;
    const activeDelta = liveDragDeltaRef.current;

    drawMidiRollNotesWithSelection(
      ctx, score.measures, score.ppq, scrollX, zoom, rect.width, layout, activeSel, activeDelta
    );

    if (activeSel && showSelectionRectRef.current) {
      if (activeDelta && modeRef.current !== 'copying') {
        const shifted: SelectionRect = {
          startTick: activeSel.startTick + activeDelta.tickDelta,
          endTick: activeSel.endTick + activeDelta.tickDelta,
          startRow: activeSel.startRow + activeDelta.rowDelta,
          endRow: activeSel.endRow + activeDelta.rowDelta,
        };
        drawSelectionRect(ctx, shifted, scrollX, zoom, layout, rect.width);
      } else {
        drawSelectionRect(ctx, activeSel, scrollX, zoom, layout, rect.width);
      }
    }

    if (isPlaying) {
      drawPlayhead(ctx, playheadTick, scrollX, zoom, layout.labelWidth, layout.totalHeight);
    }

    drawMidiRollLabels(ctx, layout, dpr);
  }, [score, scrollX, zoom, isPlaying, playheadTick, layout, selection]);

  useEffect(() => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viewWidth = canvas.getBoundingClientRect().width - layout.labelWidth;
    if (viewWidth <= 0) return;

    const playheadPx = playheadTick * zoom;
    const viewStart = scrollX * zoom;
    const viewEnd = viewStart + viewWidth;
    const margin = viewWidth * 0.2;

    if (playheadPx < viewStart + margin || playheadPx > viewEnd - margin) {
      setScrollX((playheadPx - viewWidth * 0.3) / zoom);
    }
  }, [isPlaying, playheadTick, zoom, scrollX, layout.labelWidth, setScrollX]);

  useEffect(() => {
    const render = () => { draw(); animFrameRef.current = requestAnimationFrame(render); };
    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // --- cursor ---
  const updateCursor = useCallback((cx: number, cy: number) => {
    const sel = getStoreSelection();
    if (sel && cx >= layout.labelWidth) {
      const { scrollX: sx, zoom: z } = getView();
      const edge = getResizeEdge(cx, cy, sel, sx, z, score.ppq, layout);
      if (edge) { setCursor(getResizeCursor(edge)); return; }
      const pos = canvasToTickRow(cx, cy, sx, z, score.ppq, layout);
      if (isInsideSelection(pos.tick, pos.row, sel)) { setCursor('grab'); return; }
    }
    setCursor('crosshair');
  }, [score.ppq, layout]);

  // --- mousedown ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < layout.labelWidth) return;

    const { scrollX: sx, zoom: z } = getView();
    const pos = canvasToTickRow(x, y, sx, z, score.ppq, layout);

    dragStartRef.current = { x, y, tick: pos.tick, row: pos.row };
    isDraggingRef.current = false;
    liveSelectionRef.current = null;
    liveDragDeltaRef.current = null;
    resizeEdgeRef.current = null;
    resizeStartSelRef.current = null;

    const sel = getStoreSelection();

    // 1. Resize edge of existing selection
    if (sel) {
      const edge = getResizeEdge(x, y, sel, sx, z, score.ppq, layout);
      if (edge) {
        modeRef.current = 'resizing';
        resizeEdgeRef.current = edge;
        resizeStartSelRef.current = { ...sel };
        liveSelectionRef.current = { ...sel };
        setCursor(getResizeCursor(edge));
        return;
      }
    }

    // 2. Inside existing selection → move or copy
    if (sel && isInsideSelection(pos.tick, pos.row, sel)) {
      const isCopy = e.metaKey || e.ctrlKey;
      modeRef.current = isCopy ? 'copying' : 'moving';
      setCursor('grabbing');
      return;
    }

    // 3. Click on existing note → prepare to move single note
    if (hasNoteAt(pos.tick, pos.row)) {
      modeRef.current = 'pending-note';
      return;
    }

    // 4. Empty cell → prepare for selection drag or toggle click
    setSelection(null);
    showSelectionRectRef.current = false;
    modeRef.current = 'pending-empty';
  }, [score.ppq, layout, setSelection]);

  // --- mousemove ---
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!dragStartRef.current) { updateCursor(x, y); return; }

    const dx = x - dragStartRef.current.x;
    const dy = y - dragStartRef.current.y;
    if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
    isDraggingRef.current = true;

    const { scrollX: sx, zoom: z } = getView();
    const pos = canvasToTickRow(x, y, sx, z, score.ppq, layout);
    const clampedRow = Math.max(0, Math.min(pos.row, MIDI_ROLL_VOICES.length - 1));

    const mode = modeRef.current;

    if (mode === 'pending-empty') {
      modeRef.current = 'selecting';
      showSelectionRectRef.current = true;
    }

    if (mode === 'pending-note') {
      // Promote to single-note move: create a 1-cell selection
      const t = dragStartRef.current.tick;
      const r = dragStartRef.current.row;
      const sel: SelectionRect = { startTick: t, endTick: t, startRow: r, endRow: r };
      liveSelectionRef.current = sel;
      useViewStore.getState().setSelection(sel);
      showSelectionRectRef.current = false;
      modeRef.current = 'note-moving';
      setCursor('grabbing');
    }

    if (modeRef.current === 'selecting' || mode === 'pending-empty') {
      liveSelectionRef.current = {
        startTick: dragStartRef.current.tick,
        startRow: dragStartRef.current.row,
        endTick: pos.tick,
        endRow: clampedRow,
      };
    } else if (modeRef.current === 'moving' || modeRef.current === 'copying' || modeRef.current === 'note-moving') {
      setCursor('grabbing');
      liveDragDeltaRef.current = {
        tickDelta: pos.tick - dragStartRef.current.tick,
        rowDelta: clampedRow - dragStartRef.current.row,
      };
    } else if (modeRef.current === 'resizing' && resizeEdgeRef.current && resizeStartSelRef.current) {
      const edge = resizeEdgeRef.current;
      const orig = resizeStartSelRef.current;
      const minTick = Math.min(orig.startTick, orig.endTick);
      const maxTick = Math.max(orig.startTick, orig.endTick);
      const minRow = Math.min(orig.startRow, orig.endRow);
      const maxRow = Math.max(orig.startRow, orig.endRow);

      liveSelectionRef.current = {
        startTick: edge.left ? Math.min(pos.tick, maxTick) : minTick,
        endTick: edge.right ? Math.max(pos.tick, minTick) : maxTick,
        startRow: edge.top ? Math.min(clampedRow, maxRow) : minRow,
        endRow: edge.bottom ? Math.max(clampedRow, minRow) : maxRow,
      };
    }
  }, [score.ppq, layout, updateCursor]);

  // --- mouseup ---
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current) return;
    const mode = modeRef.current;
    const wasDragging = isDraggingRef.current;

    if ((mode === 'selecting') && wasDragging && liveSelectionRef.current) {
      setSelection(liveSelectionRef.current);
      showSelectionRectRef.current = true;

    } else if (mode === 'resizing' && wasDragging && liveSelectionRef.current) {
      setSelection(liveSelectionRef.current);

    } else if (mode === 'moving' && wasDragging && liveDragDeltaRef.current) {
      commitMove(liveDragDeltaRef.current, false);

    } else if (mode === 'note-moving' && wasDragging && liveDragDeltaRef.current) {
      showSelectionRectRef.current = false;
      commitMove(liveDragDeltaRef.current, false);

    } else if (mode === 'copying' && wasDragging && liveDragDeltaRef.current) {
      commitMove(liveDragDeltaRef.current, true);

    } else if ((mode === 'moving' || mode === 'copying') && !wasDragging) {
      // Clicked inside selection without dragging
      if (e.altKey || e.shiftKey) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const cx = e.clientX - rect.left;
          const cy = e.clientY - rect.top;
          const { scrollX: sx, zoom: z } = getView();
          const hit = hitTestMidiRoll(cx, cy, sx, z, score.ppq, layout);
          if (hit) {
            const measures = useScoreStore.getState().score.measures;
            const ppq = useScoreStore.getState().score.ppq;
            let acc = 0;
            for (let mi = 0; mi < measures.length; mi++) {
              const mt = ticksPerMeasure(measures[mi].timeSignature, ppq);
              if (hit.tick < acc + mt) {
                const localTick = hit.tick - acc;
                const note = measures[mi].notes.find((n) => n.voice === hit.voice && n.tick === localTick);
                if (note) {
                  if (e.altKey) toggleNoteGhost(mi, note.id);
                  else toggleNoteAccent(mi, note.id);
                }
                break;
              }
              acc += mt;
            }
          }
        }
      }
      // else: keep selection

    } else {
      // Clicked without dragging on empty cell or on a note
      setSelection(null);
      showSelectionRectRef.current = false;
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const { scrollX: sx, zoom: z } = getView();
        const hit = hitTestMidiRoll(cx, cy, sx, z, score.ppq, layout);
        if (hit) {
          const measures = useScoreStore.getState().score.measures;
          const ppq = useScoreStore.getState().score.ppq;
          let acc = 0;
          for (let mi = 0; mi < measures.length; mi++) {
            const mt = ticksPerMeasure(measures[mi].timeSignature, ppq);
            if (hit.tick < acc + mt) {
              const localTick = hit.tick - acc;
              const note = measures[mi].notes.find((n) => n.voice === hit.voice && n.tick === localTick);
              if (e.altKey) {
                if (note) toggleNoteGhost(mi, note.id);
                else toggleNote(mi, hit.voice, localTick, 100, true, false);
              } else if (e.shiftKey) {
                if (note) toggleNoteAccent(mi, note.id);
                else toggleNote(mi, hit.voice, localTick, 100, false, true);
              } else {
                toggleNote(mi, hit.voice, localTick);
              }
              break;
            }
            acc += mt;
          }
        }
      }
    }

    resetRefs();
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      updateCursor(e.clientX - rect.left, e.clientY - rect.top);
    }
  }, [score.ppq, layout, toggleNote, toggleNoteGhost, toggleNoteAccent, setSelection, moveNotes, updateCursor]);

  function commitMove(delta: DragDelta, isCopy: boolean) {
    const sel = getStoreSelection();
    if (!sel) return;

    const allNotes = useScoreStore.getState().getAllNotesAbsolute();
    const selected = allNotes.filter((entry) => {
      const row = MIDI_ROLL_VOICES.indexOf(entry.note.voice);
      return isNoteInSelection(entry.absoluteTick, row, sel);
    });
    if (selected.length === 0) return;

    const oldNotes = isCopy ? [] : selected.map((s) => ({
      voice: s.note.voice,
      absoluteTick: s.absoluteTick,
    }));

    const newNotes = selected.map((s) => {
      const oldRow = MIDI_ROLL_VOICES.indexOf(s.note.voice);
      const newRow = Math.max(0, Math.min(oldRow + delta.rowDelta, MIDI_ROLL_VOICES.length - 1));
      return {
        voice: MIDI_ROLL_VOICES[newRow],
        absoluteTick: s.absoluteTick + delta.tickDelta,
        velocity: s.note.velocity,
        ghost: s.note.ghost,
        accent: s.note.accent,
      };
    });

    const destMinTick = Math.min(sel.startTick, sel.endTick) + delta.tickDelta;
    const destMaxTick = Math.max(sel.startTick, sel.endTick) + delta.tickDelta;
    const destMinRow = Math.min(sel.startRow, sel.endRow) + delta.rowDelta;
    const destMaxRow = Math.max(sel.startRow, sel.endRow) + delta.rowDelta;
    const ppq = useScoreStore.getState().score.ppq;
    const destVoices = MIDI_ROLL_VOICES.slice(
      Math.max(0, destMinRow), Math.min(MIDI_ROLL_VOICES.length, destMaxRow + 1)
    );

    moveNotes(oldNotes, newNotes, {
      startTick: destMinTick,
      endTick: destMaxTick + ppq / 8,
      voices: destVoices,
    });

    setSelection({
      startTick: sel.startTick + delta.tickDelta,
      endTick: sel.endTick + delta.tickDelta,
      startRow: sel.startRow + delta.rowDelta,
      endRow: sel.endRow + delta.rowDelta,
    });
  }

  function resetRefs() {
    dragStartRef.current = null;
    isDraggingRef.current = false;
    modeRef.current = 'none';
    liveSelectionRef.current = null;
    liveDragDeltaRef.current = null;
    resizeEdgeRef.current = null;
    resizeStartSelRef.current = null;
  }

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      adjustZoom(-e.deltaY * 0.0005);
    } else {
      const { scrollX: sx, zoom: z } = getView();
      setScrollX(sx + e.deltaX / z + e.deltaY / z);
    }
  }, [adjustZoom, setScrollX]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: layout.totalHeight }}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (modeRef.current === 'selecting' && isDraggingRef.current && liveSelectionRef.current) {
            setSelection(liveSelectionRef.current);
          }
          resetRefs();
          setCursor('crosshair');
        }}
      />
    </div>
  );
}
