import {
  Renderer,
  Stave,
  StaveNote,
  GhostNote,
  Voice,
  Beam,
  Formatter,
  Parenthesis,
  ModifierPosition,
  type StemmableNote,
} from 'vexflow';
import type { Measure, Note } from '../types';
import { VOICE_CONFIG_MAP } from '../constants/drumMap';
import { spellVoiceRhythm, type RhythmEvent } from '../utils/rhythmSolver';
import { ticksPerMeasure } from '../utils/tick';

const STAVE_HEIGHT = 120;
const TOP_MARGIN = 35;
const ACCENT_Y = 6;
const STAFF_TIMELINE_LEFT = 72;
const STAFF_RIGHT_PADDING = 20;
const FIRST_MEASURE_DECORATION_SPACE = 72;
const MIN_STAVE_WIDTH = 140;
const MIN_PX_PER_EVENT = 22;

export interface RenderResult {
  totalWidth: number;
  staveYTop: number;
  staveYBottom: number;
  tickToX: (absoluteTick: number) => number;
}

/**
 * Group a measure's notes into up-stem and down-stem buckets,
 * keyed by local tick so that simultaneous notes can be merged
 * into a single VexFlow chord.
 */
function partitionNotes(notes: Note[]) {
  const up = new Map<number, Note[]>();
  const down = new Map<number, Note[]>();

  for (const note of notes) {
    const config = VOICE_CONFIG_MAP[note.voice];
    if (!config) continue;

    const target = config.stemDirection === 'up' ? up : down;
    if (!target.has(note.tick)) target.set(note.tick, []);
    target.get(note.tick)!.push(note);
  }

  return { up, down };
}

/**
 * Convert a rhythm-event sequence into VexFlow note objects.
 * Notes are StaveNote (possibly chords), rests are also StaveNote
 * with the 'r' duration suffix when the voice is active, or
 * GhostNote when the voice has no notes at all (invisible filler).
 */
function buildVoiceFromRhythm(
  events: RhythmEvent[],
  noteMap: Map<number, Note[]>,
  stemDir: 'up' | 'down',
  voiceIsEmpty: boolean,
  accentNoteCollector?: StaveNote[]
): StemmableNote[] {
  const stemDirection = stemDir === 'up' ? 1 : -1;
  const restKey = stemDir === 'up' ? 'e/5' : 'a/4';

  return events.map((ev) => {
    if (ev.isRest) {
      if (voiceIsEmpty) {
        return new GhostNote({ duration: ev.vexDuration });
      }
      return new StaveNote({
        keys: [restKey],
        duration: ev.vexDuration + 'r',
        clef: 'percussion',
        stemDirection,
      });
    }

    const notesAtTick = noteMap.get(ev.tick) ?? [];
    const keys: string[] = [];
    const ghostIndices: number[] = [];
    let hasAccent = false;
    for (let i = 0; i < notesAtTick.length; i++) {
      const n = notesAtTick[i];
      const config = VOICE_CONFIG_MAP[n.voice];
      if (!config) continue;
      keys.push(config.vexKey);
      if (n.ghost) ghostIndices.push(i);
      if (n.accent) hasAccent = true;
    }

    if (keys.length === 0) {
      return new GhostNote({ duration: ev.vexDuration });
    }

    const staveNote = new StaveNote({
      keys,
      duration: ev.vexDuration,
      stemDirection,
      clef: 'percussion',
    });

    for (const idx of ghostIndices) {
      staveNote.addModifier(new Parenthesis(ModifierPosition.LEFT), idx);
      staveNote.addModifier(new Parenthesis(ModifierPosition.RIGHT), idx);
    }
    if (hasAccent) {
      accentNoteCollector?.push(staveNote);
    }

    return staveNote;
  });
}

/**
 * Collect beamable (eighth-note-or-smaller) StaveNotes grouped
 * by beat, and create Beam objects for groups of 2+ notes.
 */
function buildBeamsForVoice(
  voiceNotes: StemmableNote[],
  events: RhythmEvent[],
  ppq: number
): Beam[] {
  const beams: Beam[] = [];
  const beatGroups = new Map<number, StaveNote[]>();

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.isRest) continue;
    if (ev.durationTicks > ppq / 2) continue; // quarter or longer → not beamable

    const note = voiceNotes[i];
    if (!(note instanceof StaveNote)) continue;

    const beat = Math.floor(ev.tick / ppq);
    if (!beatGroups.has(beat)) beatGroups.set(beat, []);
    beatGroups.get(beat)!.push(note);
  }

  for (const group of beatGroups.values()) {
    if (group.length >= 2) {
      try {
        beams.push(new Beam(group));
      } catch (e) {
        console.warn('[DrumScore] Beam error:', e);
      }
    }
  }

  return beams;
}

/**
 * Estimate the minimum stave width needed to avoid dense beamed groups
 * visually colliding with the next barline.
 */
function estimateMinimumStaveWidth(measure: Measure, ppq: number, isFirst: boolean): number {
  const measureTicks = ticksPerMeasure(measure.timeSignature, ppq);
  const { up, down } = partitionNotes(measure.notes);
  const upTicks = [...up.keys()].sort((a, b) => a - b);
  const downTicks = [...down.keys()].sort((a, b) => a - b);
  const upEvents = spellVoiceRhythm(upTicks, measureTicks);
  const downEvents = spellVoiceRhythm(downTicks, measureTicks);
  const eventColumns = Math.max(upEvents.length, downEvents.length, 1);
  const densityWidth = eventColumns * MIN_PX_PER_EVENT + 24;
  return Math.max(
    MIN_STAVE_WIDTH,
    densityWidth + (isFirst ? FIRST_MEASURE_DECORATION_SPACE : 0)
  );
}

export function renderScore(
  container: HTMLDivElement,
  measures: Measure[],
  ppq: number,
  containerWidth: number,
  zoom: number
): RenderResult {
  container.innerHTML = '';

  if (measures.length === 0) {
    return {
      totalWidth: containerWidth,
      staveYTop: TOP_MARGIN,
      staveYBottom: TOP_MARGIN + STAVE_HEIGHT,
      tickToX: () => 0,
    };
  }

  const measureTickLengths = measures.map((m) => ticksPerMeasure(m.timeSignature, ppq));
  const computedWidths = measures.map((measure, i) => {
    const tickWidth = measureTickLengths[i] * zoom;
    const minDensityWidth = estimateMinimumStaveWidth(measure, ppq, i === 0);
    return Math.max(tickWidth, minDensityWidth);
  });
  const totalWidth = Math.max(
    containerWidth,
    STAFF_TIMELINE_LEFT + computedWidths.reduce((sum, w) => sum + w, 0) + STAFF_RIGHT_PADDING
  );

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(totalWidth, STAVE_HEIGHT + TOP_MARGIN + 30);
  const context = renderer.getContext();

  const staveXPositions: {
    startX: number;
    width: number;
    tickStart: number;
    ticksInMeasure: number;
  }[] = [];

  let cumulativeTick = 0;
  let currentX = STAFF_TIMELINE_LEFT;

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const staveWidth = computedWidths[mi];

    const stave = new Stave(currentX, TOP_MARGIN, staveWidth);

    if (mi === 0) {
      stave.addClef('percussion');
      stave.addTimeSignature(
        `${measure.timeSignature[0]}/${measure.timeSignature[1]}`
      );
    }

    if (mi === measures.length - 1) {
      stave.setEndBarType(3);
    }

    stave.setMeasure(mi + 1);
    stave.setContext(context).draw();

    const [beats, beatVal] = measure.timeSignature;
    const measTickLen = ticksPerMeasure(measure.timeSignature, ppq);

    staveXPositions.push({
      startX: currentX,
      width: staveWidth,
      tickStart: cumulativeTick,
      ticksInMeasure: measTickLen,
    });

    // Partition notes into up/down voice buckets
    const { up: upMap, down: downMap } = partitionNotes(measure.notes);
    const upTicks = [...upMap.keys()].sort((a, b) => a - b);
    const downTicks = [...downMap.keys()].sort((a, b) => a - b);

    // Run the rhythm solver for each voice
    const upEvents = spellVoiceRhythm(upTicks, measTickLen);
    const downEvents = spellVoiceRhythm(downTicks, measTickLen);

    const upIsEmpty = upTicks.length === 0;
    const downIsEmpty = downTicks.length === 0;

    const accentedNotes: StaveNote[] = [];

    const upVoiceNotes = buildVoiceFromRhythm(upEvents, upMap, 'up', upIsEmpty, accentedNotes);
    const downVoiceNotes = buildVoiceFromRhythm(
      downEvents,
      downMap,
      'down',
      downIsEmpty,
      accentedNotes
    );

    const numBeats = beats;
    const upVoice = new Voice({ numBeats, beatValue: beatVal })
      .setMode(Voice.Mode.SOFT)
      .addTickables(upVoiceNotes);
    const downVoice = new Voice({ numBeats, beatValue: beatVal })
      .setMode(Voice.Mode.SOFT)
      .addTickables(downVoiceNotes);

    const noteAreaWidth = Math.max(20, stave.getNoteEndX() - stave.getNoteStartX() - 10);
    new Formatter()
      .joinVoices([upVoice])
      .joinVoices([downVoice])
      .format([upVoice, downVoice], noteAreaWidth);

    // Build beams before drawing so notes know they're beamed
    const allBeams: Beam[] = [
      ...buildBeamsForVoice(upVoiceNotes, upEvents, ppq),
      ...buildBeamsForVoice(downVoiceNotes, downEvents, ppq),
    ];

    upVoice.draw(context, stave);
    downVoice.draw(context, stave);

    for (const beam of allBeams) {
      beam.setContext(context).draw();
    }

    // Draw accent marks manually at a fixed Y above the staff.
    // This bypasses VexFlow's articulation positioning entirely,
    // guaranteeing all accents sit on the same horizontal line.
    if (accentedNotes.length > 0) {
      const svg = container.querySelector('svg');
      if (svg) {
        const accentY = ACCENT_Y;
        for (const note of accentedNotes) {
          const x = note.getAbsoluteX();
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('transform', `translate(${x}, ${accentY})`);
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M-7,-4 L7,0 L-7,4');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', 'black');
          path.setAttribute('stroke-width', '2.5');
          path.setAttribute('stroke-linejoin', 'miter');
          g.appendChild(path);
          svg.appendChild(g);
        }
      }
    }

    cumulativeTick += measTickLen;
    currentX += staveWidth;
  }

  const tickToX = (absoluteTick: number): number => {
    for (const sp of staveXPositions) {
      if (
        absoluteTick >= sp.tickStart &&
        absoluteTick <= sp.tickStart + sp.ticksInMeasure
      ) {
        const fraction = (absoluteTick - sp.tickStart) / sp.ticksInMeasure;
        return sp.startX + fraction * sp.width;
      }
    }
    if (staveXPositions.length > 0) {
      const last = staveXPositions[staveXPositions.length - 1];
      const fraction = (absoluteTick - last.tickStart) / last.ticksInMeasure;
      return last.startX + fraction * last.width;
    }
    return 0;
  };

  return {
    totalWidth,
    staveYTop: TOP_MARGIN,
    staveYBottom: TOP_MARGIN + STAVE_HEIGHT,
    tickToX,
  };
}
