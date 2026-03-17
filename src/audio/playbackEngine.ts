import * as Tone from 'tone';
import type { DrumVoice, Measure } from '../types';
import { ticksPerMeasure } from '../utils/tick';

let initialized = false;
let masterVol: Tone.Volume | null = null;

type DrumSynth = {
  trigger: (time: number, velocity: number) => void;
};

const drums: Record<string, DrumSynth> = {};

function makeCymbal(
  filterFreq: number,
  filterType: BiquadFilterType,
  decay: number,
  vol: Tone.Volume
): DrumSynth {
  const filter = new Tone.Filter(filterFreq, filterType).connect(vol);
  const synth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay, sustain: 0, release: decay * 0.3 },
  }).connect(filter);

  return {
    trigger: (time, velocity) => {
      synth.volume.setValueAtTime(Tone.gainToDb(velocity), time);
      synth.triggerAttackRelease(decay, time);
    },
  };
}

function initSynths() {
  if (initialized) return;

  masterVol = new Tone.Volume(-20).toDestination();
  const vol = masterVol;

  // Kick
  const kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
  }).connect(vol);

  drums['kick'] = {
    trigger: (time, velocity) => {
      kickSynth.triggerAttackRelease('C1', '16n', time, velocity);
    },
  };

  // Snare
  const snareFilter = new Tone.Filter(5000, 'highpass').connect(vol);
  const snareSynth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
  }).connect(snareFilter);

  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
    volume: -10,
  }).connect(vol);

  drums['snare'] = {
    trigger: (time, velocity) => {
      snareSynth.volume.setValueAtTime(Tone.gainToDb(velocity), time);
      snareSynth.triggerAttackRelease('16n', time);
      snareBody.triggerAttackRelease('E3', '16n', time, velocity * 0.6);
    },
  };

  // Cross-stick
  const xstickFilter = new Tone.Filter(2000, 'bandpass').connect(vol);
  const xstickSynth = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
  }).connect(xstickFilter);

  drums['cross-stick'] = {
    trigger: (time, velocity) => {
      xstickSynth.volume.setValueAtTime(Tone.gainToDb(velocity), time);
      xstickSynth.triggerAttackRelease('32n', time);
    },
  };

  drums['hihat'] = makeCymbal(8000, 'highpass', 0.06, vol);
  drums['hihat-open'] = makeCymbal(7000, 'highpass', 0.35, vol);
  drums['ride'] = makeCymbal(6000, 'highpass', 0.8, vol);
  drums['crash'] = makeCymbal(4000, 'highpass', 1.5, vol);

  // Toms
  const tom1 = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
  }).connect(vol);

  drums['rack-tom-1'] = {
    trigger: (time, velocity) => tom1.triggerAttackRelease('G3', '16n', time, velocity),
  };

  const tom2 = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.1 },
  }).connect(vol);

  drums['rack-tom-2'] = {
    trigger: (time, velocity) => tom2.triggerAttackRelease('E3', '16n', time, velocity),
  };

  const floorTom = new Tone.MembraneSynth({
    pitchDecay: 0.04, octaves: 5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.15 },
  }).connect(vol);

  drums['floor-tom'] = {
    trigger: (time, velocity) => floorTom.triggerAttackRelease('C3', '16n', time, velocity),
  };

  initialized = true;
}

function triggerVoice(voice: DrumVoice, velocity: number, time: number) {
  const drum = drums[voice];
  if (!drum) return;

  try {
    drum.trigger(time, velocity / 127);
  } catch {
    // Swallow timing errors during rapid playback
  }
}

let loopStopped = false;

function scheduleNotes(
  measures: Measure[],
  ppq: number,
  startTick: number,
  ticksPerSecond: number,
  timeOffset: number,
) {
  let measureStartTick = 0;

  for (let mi = 0; mi < measures.length; mi++) {
    const measure = measures[mi];
    const measTicks = ticksPerMeasure(measure.timeSignature, ppq);

    for (const note of measure.notes) {
      const absTick = measureStartTick + note.tick;
      if (absTick < startTick) continue;

      const timeSec = timeOffset + (absTick - startTick) / ticksPerSecond;

      let vel = note.velocity;
      if (note.ghost) vel = Math.round(vel * 0.4);
      else if (note.accent) vel = Math.min(127, Math.round(vel * 1.3));

      Tone.getTransport().schedule((time) => {
        triggerVoice(note.voice, vel, time);
      }, timeSec);
    }

    measureStartTick += measTicks;
  }

  return measureStartTick;
}

export async function startPlayback(
  measures: Measure[],
  ppq: number,
  tempo: number,
  startTick: number,
  loop: boolean,
  onTick: (tick: number) => void,
  onStop: () => void
) {
  await Tone.start();
  initSynths();

  Tone.getTransport().cancel();
  Tone.getTransport().bpm.value = tempo;
  Tone.getTransport().position = 0;
  loopStopped = false;

  const ticksPerSecond = (tempo / 60) * ppq;
  const totalTicks = scheduleNotes(measures, ppq, startTick, ticksPerSecond, 0);
  const cycleDuration = (totalTicks - startTick) / ticksPerSecond;

  if (loop) {
    let loopCount = 1;
    const scheduleNextLoop = () => {
      if (loopStopped) return;
      const offset = cycleDuration * loopCount;
      scheduleNotes(measures, ppq, 0, ticksPerSecond, offset);
      loopCount++;
      Tone.getTransport().schedule(() => {
        scheduleNextLoop();
      }, offset - 0.1);
    };

    Tone.getTransport().schedule(() => {
      scheduleNextLoop();
    }, cycleDuration - 0.1);
  } else {
    Tone.getTransport().schedule(() => {
      stopPlayback();
      Tone.getDraw().schedule(() => {
        onStop();
      }, Tone.now());
    }, cycleDuration + 0.05);
  }

  const updateInterval = new Tone.Loop((time) => {
    const elapsed = Tone.getTransport().seconds;
    let currentTick: number;
    if (loop) {
      const totalCycleTicks = totalTicks - startTick;
      const elapsedTicks = elapsed * ticksPerSecond;
      currentTick = elapsedTicks % totalCycleTicks;
    } else {
      currentTick = startTick + elapsed * ticksPerSecond;
    }
    Tone.getDraw().schedule(() => {
      onTick(currentTick);
    }, time);
  }, '16n');
  updateInterval.start(0);

  Tone.getTransport().start();
}

export function stopPlayback() {
  loopStopped = true;
  Tone.getTransport().stop();
  Tone.getTransport().cancel();
}

export function setMasterVolume(db: number) {
  if (masterVol) {
    masterVol.volume.value = db;
  }
}
