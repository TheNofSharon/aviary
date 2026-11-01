// Procedural Web Audio Sound Synthesizer for Insaterrarium
// 100% pure Web Audio API - no external mp3/wav files required!

let ctx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      ctx = new AudioCtx();
    }
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Insaniquarium-style Dual-Tone Siren Alarm Beep */
export function playSirenSound() {
  const c = getAudioContext();
  if (!c) return;

  const now = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = 'sawtooth';
  // Alternating siren frequencies (440Hz -> 660Hz -> 440Hz)
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.linearRampToValueAtTime(680, now + 0.12);
  osc.frequency.linearRampToValueAtTime(440, now + 0.24);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

  osc.connect(gain);
  gain.connect(c.destination);

  osc.start(now);
  osc.stop(now + 0.28);
}

/** Weapon attack sound effects based on weapon tier */
export function playWeaponSound(tier: number) {
  const c = getAudioContext();
  if (!c) return;
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
      gain.connect(c.destination);
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
      gain.connect(c.destination);
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
      gain.connect(c.destination);
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
      gain.connect(c.destination);
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
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + 0.14);
      break;
    }
  }
}

/** Victory Fanfare Chirp when an enemy wave is defeated */
export function playVictoryChirp() {
  const c = getAudioContext();
  if (!c) return;
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
    gain.connect(c.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.15);
  });
}

/** Triumphant Fanfare when an Achievement is Unlocked */
export function playAchievementSound() {
  const c = getAudioContext();
  if (!c) return;
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
    gain.connect(c.destination);
    osc.start(now + delay);
    osc.stop(now + delay + 0.3);
  });
}
