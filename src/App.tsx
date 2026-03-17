import { useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar';
import { StaffCanvas } from './components/StaffCanvas';
import { BeatRuler } from './components/BeatRuler';
import { MidiRollCanvas } from './components/MidiRollCanvas';
import { TransportBar } from './components/TransportBar';
import { useScoreStore } from './store/scoreStore';
import { useViewStore } from './store/viewStore';
import type { ClipboardEntry } from './store/viewStore';
import { startPlayback, stopPlayback } from './audio/playbackEngine';
import { MIDI_ROLL_VOICES } from './constants/drumMap';
import { isNoteInSelection } from './renderers/midiRollRenderer';

export default function App() {
  const undo = useScoreStore((s) => s.undo);
  const redo = useScoreStore((s) => s.redo);
  const score = useScoreStore((s) => s.score);
  const pasteNotes = useScoreStore((s) => s.pasteNotes);
  const toggleNoteGhost = useScoreStore((s) => s.toggleNoteGhost);
  const toggleNoteAccent = useScoreStore((s) => s.toggleNoteAccent);
  const isPlaying = useViewStore((s) => s.isPlaying);
  const setIsPlaying = useViewStore((s) => s.setIsPlaying);
  const setPlayheadTick = useViewStore((s) => s.setPlayheadTick);

  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
      setIsPlaying(false);
      setPlayheadTick(0);
    } else {
      setIsPlaying(true);
      await startPlayback(
        score.measures,
        score.ppq,
        score.tempo,
        0,
        useViewStore.getState().looping,
        (tick) => setPlayheadTick(tick),
        () => {
          setIsPlaying(false);
          setPlayheadTick(0);
        }
      );
    }
  }, [isPlaying, score, setIsPlaying, setPlayheadTick]);

  const copySelection = useCallback(() => {
    const sel = useViewStore.getState().selection;
    if (!sel) return;

    const allNotes = useScoreStore.getState().getAllNotesAbsolute();
    const selected = allNotes.filter((entry) => {
      const row = MIDI_ROLL_VOICES.indexOf(entry.note.voice);
      return isNoteInSelection(entry.absoluteTick, row, sel);
    });

    if (selected.length === 0) return;

    const minTick = Math.min(...selected.map((s) => s.absoluteTick));
    const entries: ClipboardEntry[] = selected.map((s) => ({
      voice: s.note.voice,
      tickOffset: s.absoluteTick - minTick,
      velocity: s.note.velocity,
      ghost: s.note.ghost,
      accent: s.note.accent,
    }));

    useViewStore.getState().setClipboard(entries);
  }, []);

  const pasteClipboard = useCallback(() => {
    const { clipboard, selection } = useViewStore.getState();
    if (clipboard.length === 0) return;

    let pasteTick = 0;
    if (selection) {
      const maxTick = Math.max(selection.startTick, selection.endTick);
      pasteTick = maxTick + score.ppq / 8;
    }

    pasteNotes(clipboard.map((c) => ({
      voice: c.voice,
      absoluteTick: pasteTick + c.tickOffset,
      velocity: c.velocity,
      ghost: c.ghost,
      accent: c.accent,
    })));
  }, [score.ppq, pasteNotes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const isSelectionStyleKey = e.key === 'Alt' || e.key === 'Shift';
      const target = e.target as HTMLElement;
      if ((target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && !isSelectionStyleKey) return;

      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault(); redo();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); undo();
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); copySelection();
      } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); pasteClipboard();
      } else if (e.key === 'Escape') {
        useViewStore.getState().setSelection(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const sel = useViewStore.getState().selection;
        if (sel) {
          e.preventDefault();
          const minTick = Math.min(sel.startTick, sel.endTick);
          const maxTick = Math.max(sel.startTick, sel.endTick);
          const minRow = Math.min(sel.startRow, sel.endRow);
          const maxRow = Math.max(sel.startRow, sel.endRow);
          const ppq = useScoreStore.getState().score.ppq;
          const voices = MIDI_ROLL_VOICES.slice(minRow, maxRow + 1);
          useScoreStore.getState().removeNotesInRange(minTick, maxTick + ppq / 8, voices);
          useViewStore.getState().setSelection(null);
        }
      } else if (e.key === ' ') {
        e.preventDefault(); togglePlayback();
      } else if (e.key === 'Alt' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const sel = useViewStore.getState().selection;
        if (sel) {
          const allNotes = useScoreStore.getState().getAllNotesAbsolute();
          const selected = allNotes.filter((entry) => {
            const row = MIDI_ROLL_VOICES.indexOf(entry.note.voice);
            return isNoteInSelection(entry.absoluteTick, row, sel);
          });
          if (selected.length > 0) {
            e.preventDefault();
            for (const { note, measureIndex } of selected) {
              toggleNoteGhost(measureIndex, note.id);
            }
          }
        }
      } else if (e.key === 'Shift' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const sel = useViewStore.getState().selection;
        if (sel) {
          const allNotes = useScoreStore.getState().getAllNotesAbsolute();
          const selected = allNotes.filter((entry) => {
            const row = MIDI_ROLL_VOICES.indexOf(entry.note.voice);
            return isNoteInSelection(entry.absoluteTick, row, sel);
          });
          if (selected.length > 0) {
            e.preventDefault();
            for (const { note, measureIndex } of selected) {
              toggleNoteAccent(measureIndex, note.id);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [undo, redo, togglePlayback, copySelection, pasteClipboard, toggleNoteGhost, toggleNoteAccent]);

  return (
    <div className="flex flex-col h-screen bg-[#0f172a]">
      <Toolbar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-[#334155]">
          <StaffCanvas />
        </div>
        <BeatRuler />
        <div className="flex-1 min-h-0">
          <MidiRollCanvas />
        </div>
      </div>
      <TransportBar />
    </div>
  );
}
