// Procedural Web Audio Sound Synthesizer & Ambient Music Engine for Insaterrarium
// 100% pure Web Audio API - zero external MP3/WAV files required!

let ctx: AudioContext | null = null;
let sfxGainNode: GainNode | null = null;
let bgmGainNode: GainNode | null = null;

let isSoundEnabled = true;
let isMusicEnabled = true;
let sfxVolume = 0.7;
let bgmVolume = 0.35;

// Ambient BGM scheduler state
let bgmTimer: number | null = null;
let bgmChordOscs: OscillatorNode[] = [];
let bgmIsPlaying = false;

// Coin combo pitch tracking
let lastCoinCollectTime = 0;
let coinComboStep = 0;

/** Initializes or resumes the browser AudioContext safely */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      ctx = new AudioCtx();
      sfxGainNode = ctx.createGain();
      sfxGainNode.gain.setValueAtTime(sfxVolume, ctx.currentTime);
      sfxGainNode.connect(ctx.destination);

      bgmGainNode = ctx.createGain();
      bgmGainNode.gain.setValueAtTime(bgmVolume, ctx.currentTime);
      bgmGainNode.connect(ctx.destination);
    }
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Configures audio preferences from save data */
export function setAudioSettings(soundOn: boolean, musicOn: boolean, sVol = 0.7, mVol = 0.35) {
  isSoundEnabled = soundOn;
  isMusicEnabled = musicOn;
  sfxVolume = sVol;
  bgmVolume = mVol;

  if (ctx) {
    const now = ctx.currentTime;
    if (sfxGainNode) {
      sfxGainNode.gain.setValueAtTime(isSoundEnabled ? sfxVolume : 0, now);
    }
    if (bgmGainNode) {
      bgmGainNode.gain.linearRampToValueAtTime(isMusicEnabled ? bgmVolume : 0, now + 0.3);
    }
  }

  if (isMusicEnabled && !bgmIsPlaying) {
    startAmbientBgm();
  } else if (!isMusicEnabled && bgmIsPlaying) {
    stopAmbientBgm();
  }
}

export function isSoundOn(): boolean {
  return isSoundEnabled;
}

export function isMusicOn(): boolean {
  return isMusicEnabled;
}

export function toggleSound(): boolean {
  setAudioSettings(!isSoundEnabled, isMusicEnabled, sfxVolume, bgmVolume);
  return isSoundEnabled;
}

export function toggleMusic(): boolean {
  setAudioSettings(isSoundEnabled, !isMusicEnabled, sfxVolume, bgmVolume);
  return isMusicEnabled;
}

// ---------------------------------------------------------------------------
// CALM CELTIC HARP & AMBIENT FOREST BGM
// Acoustic plucked harp arpeggios + subtle warm nature pad
// ---------------------------------------------------------------------------

// Standard tuning frequencies for folk harp strings
const H: Record<string, number> = {
  F2: 87.31,
  G2: 98.0,
  A2: 110.0,
  Bb2: 116.54,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
};

// Soothing, melodic harp phrase compositions
const HARP_COMPOSITIONS: Array<{
  padNotes: number[];
  plucks: Array<{ freq: number; delay: number; vel?: number; dur?: number }>;
  duration: number;
}> = [
  // 1. "Canopy Morning" (F Major Blossom Arpeggio)
  {
    padNotes: [H.F3, H.C4, H.A4],
    duration: 8.5,
    plucks: [
      { freq: H.F2, delay: 0.1, vel: 0.9, dur: 3.2 },
      { freq: H.C3, delay: 0.5, vel: 0.75, dur: 2.8 },
      { freq: H.F3, delay: 0.9, vel: 0.8, dur: 2.6 },
      { freq: H.A3, delay: 1.3, vel: 0.85, dur: 2.4 },
      { freq: H.C4, delay: 1.75, vel: 0.9, dur: 2.4 },
      { freq: H.F4, delay: 2.2, vel: 0.95, dur: 2.5 },
      { freq: H.A4, delay: 2.75, vel: 0.9, dur: 2.6 },
      { freq: H.C5, delay: 3.4, vel: 1.0, dur: 3.0 },
      { freq: H.A4, delay: 4.2, vel: 0.75, dur: 2.4 },
      { freq: H.F4, delay: 5.0, vel: 0.7, dur: 2.6 },
    ],
  },
  // 2. "Forest Stream" (D Minor / F Pentatonic Falling Ripple)
  {
    padNotes: [H.D3, H.A3, H.F4],
    duration: 8.2,
    plucks: [
      { freq: H.D3, delay: 0.1, vel: 0.95, dur: 3.0 },
      { freq: H.A3, delay: 0.45, vel: 0.8, dur: 2.8 },
      { freq: H.D4, delay: 0.85, vel: 0.85, dur: 2.6 },
      { freq: H.F4, delay: 1.25, vel: 0.9, dur: 2.5 },
      { freq: H.A4, delay: 1.7, vel: 0.95, dur: 2.6 },
      { freq: H.D5, delay: 2.2, vel: 1.0, dur: 3.0 },
      { freq: H.C5, delay: 2.9, vel: 0.85, dur: 2.6 },
      { freq: H.A4, delay: 3.6, vel: 0.8, dur: 2.4 },
      { freq: H.F4, delay: 4.3, vel: 0.75, dur: 2.4 },
      { freq: H.D4, delay: 5.1, vel: 0.7, dur: 2.8 },
    ],
  },
  // 3. "Sunlit Meadow" (Bb Major 7 Peaceful Pastoral)
  {
    padNotes: [H.Bb2, H.F3, H.D4],
    duration: 8.4,
    plucks: [
      { freq: H.Bb2, delay: 0.1, vel: 0.9, dur: 3.2 },
      { freq: H.F3, delay: 0.5, vel: 0.75, dur: 2.8 },
      { freq: H.Bb3, delay: 0.9, vel: 0.8, dur: 2.6 },
      { freq: H.D4, delay: 1.35, vel: 0.85, dur: 2.5 },
      { freq: H.F4, delay: 1.8, vel: 0.9, dur: 2.6 },
      { freq: H.A4, delay: 2.3, vel: 0.95, dur: 2.7 },
      { freq: H.D5, delay: 2.95, vel: 1.0, dur: 3.0 },
      { freq: H.Bb4, delay: 3.8, vel: 0.8, dur: 2.5 },
      { freq: H.F4, delay: 4.6, vel: 0.7, dur: 2.5 },
    ],
  },
  // 4. "Evening Songbird" (C Major 9 Gentle Lullaby)
  {
    padNotes: [H.C3, H.G3, H.E4],
    duration: 8.6,
    plucks: [
      { freq: H.C3, delay: 0.1, vel: 0.9, dur: 3.2 },
      { freq: H.G3, delay: 0.5, vel: 0.75, dur: 2.8 },
      { freq: H.C4, delay: 0.95, vel: 0.8, dur: 2.6 },
      { freq: H.E4, delay: 1.4, vel: 0.85, dur: 2.6 },
      { freq: H.G4, delay: 1.85, vel: 0.9, dur: 2.7 },
      { freq: H.C5, delay: 2.35, vel: 0.95, dur: 2.8 },
      { freq: H.D5, delay: 3.0, vel: 1.0, dur: 3.2 },
      { freq: H.G4, delay: 3.9, vel: 0.8, dur: 2.4 },
      { freq: H.E4, delay: 4.8, vel: 0.75, dur: 2.6 },
      { freq: H.C4, delay: 5.6, vel: 0.7, dur: 2.8 },
    ],
  },
  // 5. "Wind Through the Leaves" (F Pentatonic Harp Glissando Wave)
  {
    padNotes: [H.F3, H.C4, H.F4],
    duration: 8.8,
    plucks: [
      { freq: H.F2, delay: 0.1, vel: 0.95, dur: 3.5 },
      { freq: H.C3, delay: 0.8, vel: 0.7, dur: 2.6 },
      { freq: H.F3, delay: 1.0, vel: 0.72, dur: 2.6 },
      { freq: H.G3, delay: 1.2, vel: 0.75, dur: 2.6 },
      { freq: H.A3, delay: 1.4, vel: 0.78, dur: 2.6 },
      { freq: H.C4, delay: 1.6, vel: 0.82, dur: 2.7 },
      { freq: H.D4, delay: 1.8, vel: 0.86, dur: 2.8 },
      { freq: H.F4, delay: 2.0, vel: 0.9, dur: 2.9 },
      { freq: H.A4, delay: 2.25, vel: 0.95, dur: 3.0 },
      { freq: H.C5, delay: 2.55, vel: 1.0, dur: 3.4 },
      { freq: H.A4, delay: 3.6, vel: 0.75, dur: 2.6 },
      { freq: H.F4, delay: 4.6, vel: 0.7, dur: 2.8 },
    ],
  },
];

let chordIndex = 0;

export function startAmbientBgm() {
  if (!isMusicEnabled) return;
  const c = getAudioContext();
  if (!c || bgmIsPlaying) return;
  bgmIsPlaying = true;

  scheduleNextBgmCycle();
}

export function stopAmbientBgm() {
  bgmIsPlaying = false;
  if (bgmTimer) {
    window.clearTimeout(bgmTimer);
    bgmTimer = null;
  }
  for (const osc of bgmChordOscs) {
    try {
      osc.stop();
      osc.disconnect();
    } catch {}
  }
  bgmChordOscs = [];
}

function scheduleNextBgmCycle() {
  if (!bgmIsPlaying || !isMusicEnabled) return;
  const c = getAudioContext();
  if (!c || !bgmGainNode) return;

  const now = c.currentTime;
  const comp = HARP_COMPOSITIONS[chordIndex % HARP_COMPOSITIONS.length];
  chordIndex++;

  const cycleDuration = comp.duration;

  // 1. Soft warm ambient background pad (very quiet bed of air, gain ~0.02)
  const padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.setValueAtTime(360, now);
  padFilter.frequency.linearRampToValueAtTime(520, now + cycleDuration * 0.5);
  padFilter.frequency.linearRampToValueAtTime(340, now + cycleDuration);

  const padGain = c.createGain();
  padGain.gain.setValueAtTime(0.001, now);
  padGain.gain.linearRampToValueAtTime(0.022, now + 1.8);
  padGain.gain.linearRampToValueAtTime(0.022, now + cycleDuration - 1.6);
  padGain.gain.linearRampToValueAtTime(0.001, now + cycleDuration);

  padFilter.connect(padGain);
  padGain.connect(bgmGainNode);

  const newOscs: OscillatorNode[] = [];
  for (const freq of comp.padNotes) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(padFilter);
    osc.start(now);
    osc.stop(now + cycleDuration);
    newOscs.push(osc);
  }
  bgmChordOscs = newOscs;

  // 2. Schedule acoustic harp pluck melody
  for (const p of comp.plucks) {
    playHarpPluck(now + p.delay, p.freq, p.vel ?? 0.85, p.dur ?? 2.8);
  }

  // 3. 50% chance of a gentle distant songbird warble drifting through the harp notes
  if (Math.random() < 0.5) {
    const birdDelay = 1.5 + Math.random() * (cycleDuration - 3.5);
    window.setTimeout(() => {
      if (bgmIsPlaying && isMusicEnabled) {
        playBirdChirpSound(Math.random() < 0.5 ? 'warble' : 'trill', 0.45);
      }
    }, birdDelay * 1000);
  }

  // Next harp phrase scheduled with breathing crossfade
  const nextDelayMs = Math.round((cycleDuration - 0.7) * 1000);
  bgmTimer = window.setTimeout(() => {
    scheduleNextBgmCycle();
  }, nextDelayMs);
}

/**
 * Organic Acoustic Harp String Pluck
 * Models the fingernail pluck attack, wooden soundboard damping, and reverberant string ring
 */
function playHarpPluck(time: number, freq: number, velocity = 1.0, duration = 2.8) {
  const c = getAudioContext();
  if (!c || !bgmGainNode) return;

  // 1. Dynamic lowpass damping filter (wooden harp body resonance + string damping)
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(4800, freq * 5.0), time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(340, freq * 1.2), time + 0.55);

  // 2. Main pluck envelope (crisp 8ms finger pluck attack + natural exponential string ring)
  const gain = c.createGain();
  const peakVol = 0.08 * velocity;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peakVol, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(peakVol * 0.42, time + 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  // 3. Dual string oscillators for acoustic warm wood resonance
  const osc1 = c.createOscillator();
  osc1.type = 'triangle'; // rich fundamental
  osc1.frequency.setValueAtTime(freq, time);

  const osc2 = c.createOscillator();
  osc2.type = 'sine'; // warm octave overtone
  osc2.frequency.setValueAtTime(freq * 2, time);

  const harmGain = c.createGain();
  harmGain.gain.setValueAtTime(0.3, time);
  harmGain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

  // Connect graph
  osc1.connect(filter);
  osc2.connect(harmGain);
  harmGain.connect(filter);

  filter.connect(gain);
  gain.connect(bgmGainNode);

  osc1.start(time);
  osc1.stop(time + duration);
  osc2.start(time);
  osc2.stop(time + duration);

  bgmChordOscs.push(osc1, osc2);
}

// ---------------------------------------------------------------------------
// JUICY GAME SOUND EFFECTS (100% Web Audio API)
// ---------------------------------------------------------------------------

/** Food Dropping "Plop / Scatter" */
export function playFoodDropSound(quality = 0) {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  const baseFreq = quality === 0 ? 680 : quality === 1 ? 520 : quality === 2 ? 400 : 320;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, now + 0.06);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.06);
}

/** Cute Bird Eating Nibble / Peck */
export function playBirdEatSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  // Pitch randomizer so birds in a flock don't sound identical
  const jitter = 0.9 + Math.random() * 0.25;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(750 * jitter, now);
  osc.frequency.linearRampToValueAtTime(1150 * jitter, now + 0.03);
  osc.frequency.exponentialRampToValueAtTime(350 * jitter, now + 0.07);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.07);
}

/**
 * Satisfying Coin / Feather Collect Sound with Rising Pitch Combo!
 * Rapid collection steps up the musical scale just like PopCap games.
 */
export function playCoinCollectSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  // Scale: C5, D5, E5, G5, A5, C6, D6, E6
  const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

  if (now - lastCoinCollectTime < 0.75) {
    coinComboStep = Math.min(scale.length - 1, coinComboStep + 1);
  } else {
    coinComboStep = 0;
  }
  lastCoinCollectTime = now;

  const freq = scale[coinComboStep];

  // Dual tone for rich metallic coin shimmer
  [freq, freq * 1.5].forEach((f, idx) => {
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = idx === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(f, now);

    const vol = idx === 0 ? 0.18 : 0.08;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.18);
  });
}

/** Gem & Rare Treasure Shimmer Chime */
export function playGemCollectSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const chord = [880.0, 1108.73, 1318.51, 1760.0]; // A major sparkle
  chord.forEach((freq, i) => {
    const delay = i * 0.035;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);

    gain.gain.setValueAtTime(0.12, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now + delay);
    osc.stop(now + delay + 0.25);
  });
}

/** Soft Hollow Drop Plop (When laying a coin/feather or egg) */
export function playEggDropSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

  gain.gain.setValueAtTime(0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(sfxGainNode!);
  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * Natural Bird Chirping & Songbird Melodic Trills
 * Uses frequency-modulated sine/triangle waves for realistic avian syrinx acoustics
 */
export function playBirdChirpSound(style: 'peep' | 'chirp' | 'trill' | 'warble' | 'happy' = 'chirp', volumeScale = 1.0) {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  if (style === 'peep') {
    // Cute high-pitched double peep (baby chick / fledgling)
    [0, 0.07].forEach((offset, idx) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const startF = idx === 0 ? 2500 : 2800;
      const endF = idx === 0 ? 3200 : 3500;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startF, now + offset);
      osc.frequency.exponentialRampToValueAtTime(endF, now + offset + 0.025);
      osc.frequency.exponentialRampToValueAtTime(startF * 0.88, now + offset + 0.055);

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.linearRampToValueAtTime(0.12 * volumeScale, now + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

      osc.connect(gain);
      gain.connect(sfxGainNode!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.065);
    });
  } else if (style === 'trill') {
    // Fast 3-to-4-note frequency flutter (sparrow / finch perched on a branch)
    const pitches = [2200, 2700, 2400, 2900];
    pitches.forEach((f, idx) => {
      const offset = idx * 0.04;
      const osc = c.createOscillator();
      const gain = c.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + offset);
      osc.frequency.linearRampToValueAtTime(f + 300, now + offset + 0.02);
      osc.frequency.linearRampToValueAtTime(f - 80, now + offset + 0.038);

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.linearRampToValueAtTime(0.11 * volumeScale, now + offset + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.042);

      osc.connect(gain);
      gain.connect(sfxGainNode!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.045);
    });
  } else if (style === 'warble') {
    // Sweet lyrical songbird warble with fast avian vibrato
    const baseFreq = 2000 + Math.random() * 350;
    const osc = c.createOscillator();
    const vibrato = c.createOscillator();
    const vibratoGain = c.createGain();
    const gain = c.createGain();

    vibrato.frequency.setValueAtTime(24, now); // 24Hz bird syrinx vibrato
    vibratoGain.gain.setValueAtTime(160, now);
    vibrato.connect(osc.frequency);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.linearRampToValueAtTime(baseFreq + 550, now + 0.07);
    osc.frequency.linearRampToValueAtTime(baseFreq - 150, now + 0.17);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12 * volumeScale, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    vibrato.start(now);
    vibrato.stop(now + 0.2);
    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.2);
  } else {
    // Default bright cheerful songbird chirp / happy peck
    const startF = 1900 + Math.random() * 300;
    const peakF = startF + 750 + Math.random() * 350;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(peakF, now + 0.035);
    osc.frequency.exponentialRampToValueAtTime(startF * 0.9, now + 0.09);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13 * volumeScale, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now);
    osc.stop(now + 0.1);
  }
}

/** Sweet Petting Warble Chirp (When clicking on a bird in My Aviary) */
export function playPettingSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const notes = [880, 1174.66, 1567.98];
  notes.forEach((freq, idx) => {
    const delay = idx * 0.045;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + delay);

    gain.gain.setValueAtTime(0.14, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now + delay);
    osc.stop(now + delay + 0.12);
  });
}

/** Uplifting Evolution Fanfare (When a bird grows a stage) */
export function playBirdEvolveSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const arpeggio = [440.0, 554.37, 659.25, 880.0, 1108.73]; // A major ascending
  arpeggio.forEach((freq, idx) => {
    const delay = idx * 0.06;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + delay);

    gain.gain.setValueAtTime(0.16, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.22);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now + delay);
    osc.stop(now + delay + 0.22);
  });
}

/** Worried Peep / Starving Warning Chirp */
export function playHungryChirpSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1250, now);
  osc.frequency.exponentialRampToValueAtTime(850, now + 0.1);

  gain.gain.setValueAtTime(0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Shop Purchase "Cha-Ching" Cash Clink */
export function playShopBuySound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  [987.77, 1318.51].forEach((freq, idx) => {
    const delay = idx * 0.08;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + delay);

    gain.gain.setValueAtTime(0.18, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now + delay);
    osc.stop(now + delay + 0.2);
  });
}

/** Insufficient Funds Error Dull Thud */
export function playShopErrorSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  [120, 95].forEach((freq, idx) => {
    const delay = idx * 0.09;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + delay);

    gain.gain.setValueAtTime(0.12, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now + delay);
    osc.stop(now + delay + 0.09);
  });
}

/** Deep Resonant Egg Piece Purchase Chime */
export function playEggPieceSound(pieceNum: number) {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const notes = [261.63, 329.63, 392.0]; // C4, E4, G4
  const freq = notes[Math.min(notes.length - 1, pieceNum - 1)] || 261.63;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.24, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.85);
}

/** Stage Complete Victory Fanfare */
export function playStageClearFanfare() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const melody = [
    { f: 523.25, d: 0.12 }, // C5
    { f: 659.25, d: 0.12 }, // E5
    { f: 783.99, d: 0.14 }, // G5
    { f: 1046.5, d: 0.35 }, // C6
  ];

  let cumulativeTime = 0;
  melody.forEach((note) => {
    const startT = now + cumulativeTime;
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(note.f, startT);

    gain.gain.setValueAtTime(0.2, startT);
    gain.gain.exponentialRampToValueAtTime(0.001, startT + note.d + 0.15);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(startT);
    osc.stop(startT + note.d + 0.15);

    cumulativeTime += note.d;
  });
}

/** Predator Spawn Growl / Hiss */
export function playPredatorSpawnSound(kind: string) {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  if (kind === 'bat') {
    // High screech
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.18);
  } else if (kind === 'snake' || kind === 'spider') {
    // Sibilant hiss
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.22);
  } else {
    // Deep beast growl
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
  }

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.35);
}

/** Predator Hit Impact Thud */
export function playPredatorHurtSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(130, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.08);
}

/** Predator Defeated Dispersal Poof */
export function playPredatorDefeatedSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(280, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.24);

  gain.gain.setValueAtTime(0.24, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.24);
}

/** Missile Intercept Blast */
export function playMissileExplosionSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.16);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.16);
}

/** Crisp Wooden Button Click */
export function playButtonClickSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(620, now);
  osc.frequency.exponentialRampToValueAtTime(280, now + 0.035);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(gain);
  gain.connect(sfxGainNode);
  osc.start(now);
  osc.stop(now + 0.035);
}

/** Insaniquarium-style Dual-Tone Siren Alarm Beep */
export function playSirenSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;

  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.linearRampToValueAtTime(680, now + 0.12);
  osc.frequency.linearRampToValueAtTime(440, now + 0.24);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(sfxGainNode);

  osc.start(now);
  osc.stop(now + 0.28);
}

/** Weapon attack sound effects based on weapon tier */
export function playWeaponSound(tier: number) {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  switch (tier) {
    case 0: {
      // Wooden Stick Whack: Low resonant wood thump
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(sfxGainNode!);
      osc.start(now);
      osc.stop(now + 0.09);
      break;
    }
    case 1: {
      // Slingshot: Rubber band twang + stone snap
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.11);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

      osc.connect(gain);
      gain.connect(sfxGainNode!);
      osc.start(now);
      osc.stop(now + 0.11);
      break;
    }
    case 2: {
      // Hunting Bow: Sharp string twang & release
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(520, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(sfxGainNode!);
      osc.start(now);
      osc.stop(now + 0.15);
      break;
    }
    case 3: {
      // Rifle: Gunshot bang with sharp noise impulse
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.18);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(sfxGainNode!);
      osc.start(now);
      osc.stop(now + 0.18);
      break;
    }
    case 4:
    default: {
      // Laser Blaster: PopCap retro sci-fi laser zap
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.14);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(sfxGainNode!);
      osc.start(now);
      osc.stop(now + 0.14);
      break;
    }
  }
}

/** Victory Fanfare Chirp when an enemy wave is defeated */
export function playVictoryChirp() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  [0, 0.08, 0.16].forEach((delay, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqs[i], now + delay);

    gain.gain.setValueAtTime(0.12, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now + delay);
    osc.stop(now + delay + 0.15);
  });
}

/** Triumphant Fanfare when an Achievement is Unlocked */
export function playAchievementSound() {
  if (!isSoundEnabled) return;
  const c = getAudioContext();
  if (!c || !sfxGainNode) return;
  const now = c.currentTime;

  [0, 0.09, 0.18, 0.28].forEach((delay, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freqs[i], now + delay);

    gain.gain.setValueAtTime(0.16, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);

    osc.connect(gain);
    gain.connect(sfxGainNode!);
    osc.start(now + delay);
    osc.stop(now + delay + 0.3);
  });
}
