import { useRef, useEffect, useCallback, useState } from 'react';
import { useScoreStore } from '../store/scoreStore';
import { useViewStore } from '../store/viewStore';
import { ticksPerMeasure } from '../utils/tick';
import { buildMeasureLayouts, tickToXFromLayouts } from '../utils/layout';

const RULER_HEIGHT = 24;
const LABEL_WIDTH = 72;

export function BeatRuler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setContainerWidth] = useState(800);

  const score = useScoreStore((s) => s.score);
  const scrollX = useViewStore((s) => s.scrollX);
  const zoom = useViewStore((s) => s.zoom);
  const setScrollX = useViewStore((s) => s.setScrollX);
  const adjustZoom = useViewStore((s) => s.adjustZoom);
  const measureWidths = useViewStore((s) => s.measureWidths);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

    ctx.fillStyle = 'rgba(80, 40, 120, 0.6)';
    ctx.fillRect(0, 0, rect.width, RULER_HEIGHT);

    ctx.fillStyle = 'rgba(70, 35, 110, 0.7)';
    ctx.fillRect(0, 0, LABEL_WIDTH, RULER_HEIGHT);
    ctx.strokeStyle = 'rgba(224, 111, 234, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LABEL_WIDTH, 0);
    ctx.lineTo(LABEL_WIDTH, RULER_HEIGHT);
    ctx.stroke();

    const { measures, ppq } = score;
    const thirtySecondTick = ppq / 8;
    let measureStartTick = 0;

    // Build per-measure layouts for tick-to-pixel mapping
    const hasLayouts = measureWidths.length > 0 && measureWidths.length === measures.length;
    const layouts = hasLayouts ? buildMeasureLayouts(measures, measureWidths, ppq) : null;
    const tx = (absTick: number) => {
      if (layouts) {
        const absX = tickToXFromLayouts(absTick, layouts);
        const scrollPx = tickToXFromLayouts(scrollX, layouts) - LABEL_WIDTH;
        return absX - scrollPx;
      }
      return LABEL_WIDTH + (absTick - scrollX) * zoom;
    };

    for (let mi = 0; mi < measures.length; mi++) {
      const measure = measures[mi];
      const measTicks = ticksPerMeasure(measure.timeSignature, ppq);
      const [beats, beatVal] = measure.timeSignature;
      const ticksPerBeat = ppq * (4 / beatVal);
      const subsPerBeat = Math.round(ticksPerBeat / thirtySecondTick);
      const halfBeat = Math.floor(subsPerBeat / 2);

      const measStartX = tx(measureStartTick);
      const measEndX = tx(measureStartTick + measTicks);

      if (measEndX < LABEL_WIDTH || measStartX > rect.width) {
        measureStartTick += measTicks;
        continue;
      }

      for (let beat = 0; beat < beats; beat++) {
        const beatTick = measureStartTick + beat * ticksPerBeat;
        const beatX = tx(beatTick);

        if (beatX >= LABEL_WIDTH - 20 && beatX <= rect.width + 20) {
          const isBeat0 = beat === 0;
          ctx.strokeStyle = isBeat0 ? 'rgba(224, 111, 234, 0.7)' : 'rgba(200, 160, 220, 0.5)';
          ctx.lineWidth = isBeat0 ? 1.5 : 1;
          ctx.beginPath();
          ctx.moveTo(beatX, isBeat0 ? 0 : RULER_HEIGHT * 0.4);
          ctx.lineTo(beatX, RULER_HEIGHT);
          ctx.stroke();

          ctx.fillStyle = isBeat0 ? 'rgba(240, 230, 250, 0.9)' : 'rgba(200, 180, 220, 0.7)';
          ctx.font = isBeat0 ? "600 10px 'Vulf Mono', monospace" : "500 9px 'Vulf Mono', monospace";
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const label = isBeat0 ? `${mi + 1}` : `${beat + 1}`;
          ctx.fillText(label, beatX + 3, 2);
        }

        for (let sub = 1; sub < subsPerBeat; sub++) {
          const subTick = beatTick + sub * thirtySecondTick;
          const x = tx(subTick);
          if (x < LABEL_WIDTH || x > rect.width) continue;

          if (sub === halfBeat) {
            ctx.strokeStyle = 'rgba(180, 140, 210, 0.4)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, RULER_HEIGHT * 0.6);
            ctx.lineTo(x, RULER_HEIGHT);
            ctx.stroke();
          } else if (sub % 2 === 0) {
            ctx.strokeStyle = 'rgba(160, 120, 190, 0.3)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, RULER_HEIGHT * 0.75);
            ctx.lineTo(x, RULER_HEIGHT);
            ctx.stroke();
          }
        }
      }

      measureStartTick += measTicks;
    }

    ctx.strokeStyle = 'rgba(224, 111, 234, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, RULER_HEIGHT - 0.5);
    ctx.lineTo(rect.width, RULER_HEIGHT - 0.5);
    ctx.stroke();
  }, [score, scrollX, zoom, measureWidths]);

  useEffect(() => {
    let frameId = requestAnimationFrame(function loop() {
      draw();
      frameId = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frameId);
  }, [draw]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{ height: RULER_HEIGHT }}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
