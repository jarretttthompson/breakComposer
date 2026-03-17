import { useState, useEffect, useCallback } from 'react';

/**
 * Full-screen overlay prompting mobile users to rotate to landscape.
 * Shown when viewport is portrait and width < 768px.
 * Uses both matchMedia and innerWidth/innerHeight fallback for Safari/iOS quirks.
 */
export function RotateOverlay() {
  const [show, setShow] = useState(false);

  const checkPortrait = useCallback(() => {
    const mq = window.matchMedia('(max-width: 768px) and (orientation: portrait)');
    // Fallback: Safari sometimes misreports orientation; treat narrow+tall as portrait
    const narrowAndTall = window.innerWidth <= 768 && window.innerWidth < window.innerHeight;
    setShow(mq.matches || narrowAndTall);
  }, []);

  useEffect(() => {
    checkPortrait();
    const mq = window.matchMedia('(max-width: 768px) and (orientation: portrait)');
    const mqW = window.matchMedia('(max-width: 768px)');
    const handler = () => checkPortrait();
    mq.addEventListener('change', handler);
    mqW.addEventListener('change', handler);
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      mq.removeEventListener('change', handler);
      mqW.removeEventListener('change', handler);
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, [checkPortrait]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483646] flex flex-col items-center justify-center bg-[#0a0612] px-6"
      style={{ fontFamily: "'Vulf Mono', monospace" }}
    >
      <div className="text-[#e06fea] text-6xl mb-4 animate-pulse" style={{ transform: 'rotate(-90deg)' }}>
        ↻
      </div>
      <p className="text-[#f0e6f6] text-lg text-center font-semibold mb-2">
        Rotate to landscape
      </p>
      <p className="text-[#a080b8] text-sm text-center max-w-[280px]">
        breakComposer works best in landscape mode on mobile. Please rotate your device.
      </p>
    </div>
  );
}
