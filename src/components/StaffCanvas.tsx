import { useRef, useEffect, useCallback, useState } from 'react';
import { useScoreStore } from '../store/scoreStore';
import { useViewStore } from '../store/viewStore';
import { renderScore, type RenderResult } from '../renderers/vexflowStaffRenderer';

const STAFF_CONTAINER_HEIGHT = 160;

export function StaffCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const vexRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const renderResultRef = useRef<RenderResult | null>(null);

  const score = useScoreStore((s) => s.score);
  const isPlaying = useViewStore((s) => s.isPlaying);
  const playheadTick = useViewStore((s) => s.playheadTick);
  const scrollX = useViewStore((s) => s.scrollX);
  const zoom = useViewStore((s) => s.zoom);
  const setScrollX = useViewStore((s) => s.setScrollX);
  const adjustZoom = useViewStore((s) => s.adjustZoom);
  const setMeasureWidths = useViewStore((s) => s.setMeasureWidths);

  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Render VexFlow + apply dark theme in one pass
  useEffect(() => {
    const el = vexRef.current;
    if (!el) return;

    try {
      const result = renderScore(el, score.measures, score.ppq, containerWidth, zoom);
      renderResultRef.current = result;
      setMeasureWidths(result.measureWidths);
    } catch (e) {
      console.warn('VexFlow render error:', e);
      return;
    }

    // Apply dark theme to SVG elements
    const svg = el.querySelector('svg');
    if (!svg) return;

    svg.style.overflow = 'visible';

    // Use a CSS approach: inject a <style> tag into the SVG for broad coverage
    let styleEl = svg.querySelector('style#drum-theme');
    if (!styleEl) {
      styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.id = 'drum-theme';
      svg.prepend(styleEl);
    }
    styleEl.textContent = `
      path, line, rect { stroke: rgba(240, 230, 250, 0.9); }
      path:not([fill="none"]), rect:not([fill="none"]) {
        fill: rgba(240, 230, 250, 0.9);
      }
      text { fill: rgba(240, 230, 250, 0.9) !important; }
    `;
    svg.style.filter = 'drop-shadow(0 0 3px rgba(224, 111, 234, 0.4))';

    svg.querySelectorAll('*').forEach((node) => {
      const el = node as SVGElement;
      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');

      if (fill === 'black' || fill === '#000' || fill === '#000000') {
        el.setAttribute('fill', 'rgba(240, 230, 250, 0.9)');
        el.setAttribute('stroke', 'rgba(240, 230, 250, 0.9)');
      }
      if (stroke === 'black' || stroke === '#000' || stroke === '#000000') {
        el.setAttribute('stroke', 'rgba(240, 230, 250, 0.9)');
      }
    });
  }, [score, containerWidth, zoom]);

  // Playhead (position accounts for scroll so it stays aligned with staff content)
  useEffect(() => {
    const ph = playheadRef.current;
    const rr = renderResultRef.current;
    if (!ph || !rr) return;

    if (isPlaying) {
      const baseTickX = rr.tickToX(0);
      const scrollPx = rr.tickToX(scrollX) - baseTickX;
      const playheadPx = rr.tickToX(playheadTick);
      ph.style.display = 'block';
      ph.style.left = `${playheadPx - scrollPx}px`;
      ph.style.top = `${rr.staveYTop}px`;
      ph.style.height = `${rr.staveYBottom - rr.staveYTop}px`;
    } else {
      ph.style.display = 'none';
    }
  }, [isPlaying, playheadTick, scrollX]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        adjustZoom(-e.deltaY * 0.0005);
      } else {
        setScrollX(scrollX + e.deltaX / zoom + e.deltaY / zoom);
      }
    },
    [scrollX, zoom, adjustZoom, setScrollX]
  );

  const scrollOffsetPx = renderResultRef.current
    ? renderResultRef.current.tickToX(scrollX) - renderResultRef.current.tickToX(0)
    : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{background: 'rgba(100, 52, 150, 0.54)', height: STAFF_CONTAINER_HEIGHT}}
      onWheel={handleWheel}
    >
      <div
        ref={vexRef}
        className="absolute top-0 left-0"
        style={{
          minWidth: '100%',
          transform: `translateX(-${scrollOffsetPx}px)`,
        }}
      />
      <div
        ref={playheadRef}
        className="absolute w-0.5 bg-red-500 pointer-events-none"
        style={{ display: 'none' }}
      />
    </div>
  );
}
