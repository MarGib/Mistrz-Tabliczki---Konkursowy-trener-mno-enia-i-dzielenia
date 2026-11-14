let audioCtx: AudioContext | null = null;
let musicIntervalId: number | null = null;
let musicStep = 0;
let musicActive = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playSynthNote(
  ctx: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gainPeak: number,
  wave: OscillatorType = 'sine',
  filterFreq?: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0.0008, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

  if (filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, start);
    osc.connect(filter);
    filter.connect(gain);
  } else {
    osc.connect(gain);
  }

  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

export type SoundEffectType =
  | 'tap'
  | 'correct'
  | 'streak'
  | 'wrong'
  | 'tick'
  | 'tickUrgent'
  | 'finish';

export function playTone(
  type: SoundEffectType,
  enabled: boolean,
  streak = 0
): void {
  if (!enabled) return;
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'tap') {
      playSynthNote(ctx, 560, now, 0.045, 0.035, 'triangle');
    } else if (type === 'correct') {
      const pitchShift = Math.min(streak, 6) * 25;
      playSynthNote(ctx, 523.25 + pitchShift, now, 0.1, 0.065, 'triangle');
      playSynthNote(ctx, 659.25 + pitchShift, now + 0.065, 0.11, 0.07, 'triangle');
      playSynthNote(ctx, 783.99 + pitchShift, now + 0.13, 0.17, 0.08, 'triangle');
    } else if (type === 'streak') {
      playSynthNote(ctx, 587.33, now, 0.1, 0.065, 'triangle');
      playSynthNote(ctx, 739.99, now + 0.06, 0.1, 0.07, 'triangle');
      playSynthNote(ctx, 880, now + 0.12, 0.13, 0.08, 'triangle');
      playSynthNote(ctx, 1174.66, now + 0.19, 0.24, 0.085, 'sine');
    } else if (type === 'wrong') {
      playSynthNote(ctx, 290, now, 0.13, 0.06, 'triangle');
      playSynthNote(ctx, 210, now + 0.09, 0.22, 0.055, 'sine');
    } else if (type === 'tick') {
      playSynthNote(ctx, 920, now, 0.035, 0.03, 'triangle');
    } else if (type === 'tickUrgent') {
      playSynthNote(ctx, 1180, now, 0.035, 0.045, 'square', 1800);
      playSynthNote(ctx, 1340, now + 0.08, 0.035, 0.035, 'square', 1800);
    } else if (type === 'finish') {
      playSynthNote(ctx, 523.25, now, 0.11, 0.07, 'triangle');
      playSynthNote(ctx, 659.25, now + 0.09, 0.11, 0.07, 'triangle');
      playSynthNote(ctx, 783.99, now + 0.18, 0.13, 0.08, 'triangle');
      playSynthNote(ctx, 1046.5, now + 0.28, 0.22, 0.09, 'triangle');
      playSynthNote(ctx, 1318.51, now + 0.44, 0.34, 0.085, 'sine');
    }
  } catch {
    // Ignore audio errors in headless or restricted contexts
  }
}

// Upbeat, soft educational lo-fi marimba melody (C major pentatonic groove)
const MELODY_PATTERN = [
  523.25, 0, 659.25, 783.99, 659.25, 0, 587.33, 523.25,
  440.0, 0, 523.25, 659.25, 587.33, 0, 523.25, 392.0,
];
const BASS_PATTERN = [
  130.81, 0, 0, 0, 146.83, 0, 0, 0,
  110.0, 0, 0, 0, 98.0, 0, 0, 0,
];

export function startBackgroundMusic(): void {
  if (typeof window === 'undefined') return;
  if (musicActive) return;

  try {
    const ctx = getCtx();
    if (!ctx) return;
    musicActive = true;

    const tickMusic = () => {
      if (!musicActive) return;
      const c = getCtx();
      if (!c || c.state !== 'running') return;

      const idx = musicStep % MELODY_PATTERN.length;
      const melodyFreq = MELODY_PATTERN[idx];
      const bassFreq = BASS_PATTERN[idx];
      const now = c.currentTime;

      if (melodyFreq > 0) {
        playSynthNote(c, melodyFreq, now, 0.22, 0.014, 'sine', 1600);
      }
      if (bassFreq > 0) {
        playSynthNote(c, bassFreq, now, 0.55, 0.016, 'triangle', 600);
      }
      musicStep = (musicStep + 1) % MELODY_PATTERN.length;
    };

    musicIntervalId = window.setInterval(tickMusic, 290);
  } catch {
    musicActive = false;
  }
}

export function stopBackgroundMusic(): void {
  musicActive = false;
  if (musicIntervalId !== null && typeof window !== 'undefined') {
    window.clearInterval(musicIntervalId);
    musicIntervalId = null;
  }
}

export function isBackgroundMusicPlaying(): boolean {
  return musicActive;
}
