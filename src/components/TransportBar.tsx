import { useCallback } from 'react';
import { useViewStore } from '../store/viewStore';
import { useScoreStore } from '../store/scoreStore';
import { tickToBeat } from '../utils/tick';
import { startPlayback, stopPlayback } from '../audio/playbackEngine';

export function TransportBar() {
  const isPlaying = useViewStore((s) => s.isPlaying);
  const setIsPlaying = useViewStore((s) => s.setIsPlaying);
  const playheadTick = useViewStore((s) => s.playheadTick);
  const setPlayheadTick = useViewStore((s) => s.setPlayheadTick);
  const looping = useViewStore((s) => s.looping);
  const toggleLooping = useViewStore((s) => s.toggleLooping);

  const score = useScoreStore((s) => s.score);

  const play = useCallback(async () => {
    setIsPlaying(true);
    await startPlayback(
      score.measures,
      score.ppq,
      score.tempo,
      playheadTick,
      useViewStore.getState().looping,
      (tick) => setPlayheadTick(tick),
      () => {
        setIsPlaying(false);
        setPlayheadTick(0);
      }
    );
  }, [score, playheadTick, setIsPlaying, setPlayheadTick]);

  const stop = useCallback(() => {
    stopPlayback();
    setIsPlaying(false);
    setPlayheadTick(0);
  }, [setIsPlaying, setPlayheadTick]);

  const currentBeat = tickToBeat(playheadTick, score.ppq);
  const beatsPerMeasure = score.measures[0]?.timeSignature[0] || 4;
  const currentMeasure = Math.floor(currentBeat / beatsPerMeasure) + 1;
  const beatInMeasure = Math.floor(currentBeat % beatsPerMeasure) + 1;

  return (
    <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-[#334155] bg-[#1e293b]">
      <button
        onClick={isPlaying ? stop : play}
        title={isPlaying ? 'Stop' : 'Play'}
        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
          isPlaying
            ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
            : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
        }`}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="1" y="1" width="12" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
            <path d="M2 1.5L12 8L2 14.5V1.5Z" />
          </svg>
        )}
      </button>

      <button
        onClick={toggleLooping}
        title={looping ? 'Disable loop' : 'Enable loop'}
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
          looping
            ? 'bg-[#22c55e]/20 text-[#22c55e] ring-1 ring-[#22c55e]/40'
            : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#334155]'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 1l2 2-2 2" />
          <path d="M3 8V6a3 3 0 013-3h7" />
          <path d="M5 15l-2-2 2-2" />
          <path d="M13 8v2a3 3 0 01-3 3H3" />
        </svg>
      </button>

      <div className="text-[#94a3b8] text-sm font-mono min-w-[80px] text-center">
        {currentMeasure}.{beatInMeasure}
      </div>

      <div className="text-[#64748b] text-xs">
        {score.tempo} BPM &middot; {score.measures.length} measures
      </div>
    </div>
  );
}
