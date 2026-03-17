import { useScoreStore } from '../store/scoreStore';
import { useViewStore } from '../store/viewStore';

export function Toolbar() {
  const tempo = useScoreStore((s) => s.score.tempo);
  const title = useScoreStore((s) => s.score.title);
  const timeSignature = useScoreStore((s) =>
    s.score.measures.length > 0 ? s.score.measures[0].timeSignature : [4, 4]
  );
  const setTempo = useScoreStore((s) => s.setTempo);
  const setTitle = useScoreStore((s) => s.setTitle);
  const setGlobalTimeSignature = useScoreStore((s) => s.setGlobalTimeSignature);
  const undo = useScoreStore((s) => s.undo);
  const redo = useScoreStore((s) => s.redo);
  const addMeasure = useScoreStore((s) => s.addMeasure);
  const clearAllNotes = useScoreStore((s) => s.clearAllNotes);
  const generateBreakbeatPattern = useScoreStore((s) => s.generateBreakbeatPattern);
  const undoStack = useScoreStore((s) => s.undoStack);
  const redoStack = useScoreStore((s) => s.redoStack);

  const zoom = useViewStore((s) => s.zoom);
  const adjustZoom = useViewStore((s) => s.adjustZoom);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[#334155] bg-[#1e293b]">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-transparent text-[#f1f5f9] font-semibold text-sm px-2 py-1 border border-transparent hover:border-[#475569] focus:border-[#3b82f6] rounded outline-none w-36"
      />

      <div className="w-px h-6 bg-[#475569]" />

      <div className="flex items-center gap-1.5">
        <span className="text-[#94a3b8] text-xs">BPM</span>
        <input
          type="number"
          value={tempo}
          onChange={(e) => setTempo(Number(e.target.value))}
          min={20}
          max={300}
          className="bg-[#0f172a] text-[#f1f5f9] text-sm px-2 py-1 rounded border border-[#475569] focus:border-[#3b82f6] outline-none w-16 text-center"
        />
      </div>

      <div className="w-px h-6 bg-[#475569]" />

      <div className="flex items-center gap-1.5">
        <span className="text-[#94a3b8] text-xs">TS</span>
        <input
          type="number"
          value={timeSignature[0]}
          onChange={(e) =>
            setGlobalTimeSignature([Number(e.target.value), timeSignature[1]])
          }
          min={1}
          max={32}
          className="bg-[#0f172a] text-[#f1f5f9] text-sm px-2 py-1 rounded border border-[#475569] focus:border-[#3b82f6] outline-none w-12 text-center"
        />
        <span className="text-[#94a3b8] text-xs">/</span>
        <select
          value={timeSignature[1]}
          onChange={(e) =>
            setGlobalTimeSignature([timeSignature[0], Number(e.target.value)])
          }
          className="bg-[#0f172a] text-[#f1f5f9] text-sm px-2 py-1 rounded border border-[#475569] focus:border-[#3b82f6] outline-none"
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
          <option value={8}>8</option>
          <option value={16}>16</option>
        </select>
      </div>

      <div className="w-px h-6 bg-[#475569]" />

      <button
        onClick={undo}
        disabled={undoStack.length === 0}
        title="Undo (Ctrl+Z)"
        className="px-2 py-1 rounded text-sm text-[#94a3b8] hover:bg-[#334155] hover:text-[#f1f5f9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ↩ Undo
      </button>
      <button
        onClick={redo}
        disabled={redoStack.length === 0}
        title="Redo (Ctrl+Shift+Z)"
        className="px-2 py-1 rounded text-sm text-[#94a3b8] hover:bg-[#334155] hover:text-[#f1f5f9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ↪ Redo
      </button>

      <div className="w-px h-6 bg-[#475569]" />

      <button
        onClick={() => addMeasure()}
        title="Add measure"
        className="px-2 py-1 rounded text-sm text-[#94a3b8] hover:bg-[#334155] hover:text-[#f1f5f9] transition-colors"
      >
        + Measure
      </button>

      <div className="w-px h-6 bg-[#475569]" />

      <button
        onClick={clearAllNotes}
        title="Clear all notes"
        className="px-2 py-1 rounded text-sm text-[#ef4444]/70 hover:bg-[#334155] hover:text-[#ef4444] transition-colors"
      >
        Clear
      </button>

      <div className="w-px h-6 bg-[#475569]" />

      <button
        onClick={generateBreakbeatPattern}
        title="Generate a random breakbeat pattern"
        className="px-2 py-1 rounded text-sm text-[#a78bfa]/80 hover:bg-[#334155] hover:text-[#a78bfa] transition-colors"
      >
        Breakbeat
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => adjustZoom(-0.02)}
          className="px-1.5 py-0.5 rounded text-[#94a3b8] hover:bg-[#334155] hover:text-[#f1f5f9] text-sm transition-colors"
        >
          −
        </button>
        <span className="text-[#94a3b8] text-xs w-12 text-center">
          {Math.round(zoom * 400)}%
        </span>
        <button
          onClick={() => adjustZoom(0.02)}
          className="px-1.5 py-0.5 rounded text-[#94a3b8] hover:bg-[#334155] hover:text-[#f1f5f9] text-sm transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
