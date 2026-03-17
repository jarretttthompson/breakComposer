import { useCallback, useState } from 'react';
import { useViewStore } from '../store/viewStore';
import { useScoreStore } from '../store/scoreStore';
import { tickToBeat } from '../utils/tick';
import { startPlayback, stopPlayback, setMasterVolume } from '../audio/playbackEngine';

export function TransportBar() {
  const isPlaying = useViewStore((s) => s.isPlaying);
  const setIsPlaying = useViewStore((s) => s.setIsPlaying);
  const playheadTick = useViewStore((s) => s.playheadTick);
  const setPlayheadTick = useViewStore((s) => s.setPlayheadTick);
  const looping = useViewStore((s) => s.looping);
  const toggleLooping = useViewStore((s) => s.toggleLooping);

  const [volume, setVolume] = useState(50);

  const score = useScoreStore((s) => s.score);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    const db = val === 0 ? -Infinity : -40 + (val / 100) * 40;
    setMasterVolume(db);
  }, []);

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
    <div className="relative z-10 flex items-center justify-center gap-4 px-4 py-2 border-t border-[#3d2a55] bg-[#1a0f28]/80 backdrop-blur-sm" style={{animation:'borderGlow 2s ease-in-out infinite'}}>
      <button
        onClick={isPlaying ? stop : play}
        title={isPlaying ? 'Stop' : 'Play'}
        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
          isPlaying
            ? 'bg-[#ff3366] text-white hover:bg-[#e0294f]'
            : 'bg-[#e06fea] text-white hover:bg-[#c850d0]'
        }`}
        style={{boxShadow: isPlaying ? '0 0 12px rgba(255,51,102,0.5)' : '0 0 12px rgba(224,111,234,0.4)'}}
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
            ? 'bg-[#00f7ff]/20 text-[#00f7ff] ring-1 ring-[#00f7ff]/40'
            : 'text-[#5a3a7a] hover:text-[#a080b8] hover:bg-[#2a1a3e]'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 1l2 2-2 2" />
          <path d="M3 8V6a3 3 0 013-3h7" />
          <path d="M5 15l-2-2 2-2" />
          <path d="M13 8v2a3 3 0 01-3 3H3" />
        </svg>
      </button>

      <div className="text-[#a080b8] text-sm font-mono min-w-[80px] text-center">
        {currentMeasure}.{beatInMeasure}
      </div>

      <div className="text-[#5a3a7a] text-xs">
        {score.tempo} BPM &middot; {score.measures.length} measures
      </div>

      <div className="w-px h-6 bg-[#3d2a55]" />

      <div className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={volume === 0 ? '#5a3a7a' : '#a080b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          {volume > 0 && volume <= 50 && (
            <path d="M15.54 8.46a5 5 0 010 7.07" />
          )}
          {volume > 50 && (
            <>
              <path d="M15.54 8.46a5 5 0 010 7.07" />
              <path d="M19.07 4.93a10 10 0 010 14.14" />
            </>
          )}
          {volume === 0 && (
            <>
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          )}
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={handleVolumeChange}
          title={`Volume: ${volume}%`}
          className="w-20 h-1 appearance-none rounded-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, #e06fea ${volume}%, #3d2a55 ${volume}%)`,
            accentColor: '#e06fea',
          }}
        />
      </div>
    </div>
  );
}
