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
    <div className="relative z-10 flex-shrink-0 flex flex-nowrap items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 toolbar-safe-top toolbar-compact border-b border-[#3d2a55] bg-[#1a0f28]/80 backdrop-blur-sm overflow-x-auto" style={{animation:'borderGlow 2s ease-in-out infinite'}}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="bg-transparent text-[#f0e6f6] font-semibold text-sm px-2 py-1 border border-transparent hover:border-[#3d2a55] focus:border-[#e06fea] rounded outline-none w-36"
      />

      <div className="w-px h-6 bg-[#3d2a55]" />

      <div className="flex items-center gap-1.5">
        <span className="text-[#a080b8] text-xs">BPM</span>
        <input
          type="number"
          value={tempo}
          onChange={(e) => setTempo(Number(e.target.value))}
          min={20}
          max={300}
          className="bg-[#0a0612] text-[#f0e6f6] text-sm px-2 py-1 rounded border border-[#3d2a55] focus:border-[#e06fea] outline-none w-16 text-center"
        />
      </div>

      <div className="w-px h-6 bg-[#3d2a55]" />

      <div className="flex items-center gap-1.5">
        <span className="text-[#a080b8] text-xs">TS</span>
        <input
          type="number"
          value={timeSignature[0]}
          onChange={(e) =>
            setGlobalTimeSignature([Number(e.target.value), timeSignature[1]])
          }
          min={1}
          max={32}
          className="bg-[#0a0612] text-[#f0e6f6] text-sm px-2 py-1 rounded border border-[#3d2a55] focus:border-[#e06fea] outline-none w-12 text-center"
        />
        <span className="text-[#a080b8] text-xs">/</span>
        <select
          value={timeSignature[1]}
          onChange={(e) =>
            setGlobalTimeSignature([timeSignature[0], Number(e.target.value)])
          }
          className="bg-[#0a0612] text-[#f0e6f6] text-sm px-2 py-1 rounded border border-[#3d2a55] focus:border-[#e06fea] outline-none"
        >
          <option value={2}>2</option>
          <option value={4}>4</option>
          <option value={8}>8</option>
          <option value={16}>16</option>
        </select>
      </div>

      <div className="w-px h-6 bg-[#3d2a55]" />

      <button
        onClick={undo}
        disabled={undoStack.length === 0}
        title="Undo (Ctrl+Z)"
        className="px-2 py-1 rounded text-sm text-[#a080b8] hover:bg-[#2a1a3e] hover:text-[#f0e6f6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ↩ Undo
      </button>
      <button
        onClick={redo}
        disabled={redoStack.length === 0}
        title="Redo (Ctrl+Shift+Z)"
        className="px-2 py-1 rounded text-sm text-[#a080b8] hover:bg-[#2a1a3e] hover:text-[#f0e6f6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ↪ Redo
      </button>

      <div className="w-px h-6 bg-[#3d2a55]" />

      <button
        onClick={() => addMeasure()}
        title="Add measure"
        className="px-2 py-1 rounded text-sm text-[#a080b8] hover:bg-[#2a1a3e] hover:text-[#f0e6f6] transition-colors"
      >
        + Measure
      </button>

      <div className="w-px h-6 bg-[#3d2a55]" />

      <button
        onClick={clearAllNotes}
        title="Clear all notes"
        className="px-2 py-1 rounded text-sm text-[#ff3366]/70 hover:bg-[#2a1a3e] hover:text-[#ff3366] transition-colors"
      >
        Clear
      </button>

      <div className="w-px h-6 bg-[#3d2a55]" />

      <button
        onClick={generateBreakbeatPattern}
        title="Generate a random breakbeat pattern"
        className="px-2 py-1 rounded text-sm text-[#00f7ff]/80 hover:bg-[#2a1a3e] hover:text-[#00f7ff] transition-colors"
        style={{textShadow:'0 0 8px rgba(0,247,255,0.4)'}}
      >
        Breakbeat
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => adjustZoom(-0.02)}
          className="px-1.5 py-0.5 rounded text-[#a080b8] hover:bg-[#2a1a3e] hover:text-[#f0e6f6] text-sm transition-colors"
        >
          −
        </button>
        <span className="text-[#a080b8] text-xs w-12 text-center">
          {Math.round(zoom * 400)}%
        </span>
        <button
          onClick={() => adjustZoom(0.02)}
          className="px-1.5 py-0.5 rounded text-[#a080b8] hover:bg-[#2a1a3e] hover:text-[#f0e6f6] text-sm transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
