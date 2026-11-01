import Phaser from 'phaser';
import { AviaryScene, W, H } from './AviaryScene';
import { MenuScene } from './MenuScene';
import { getAudioContext, setAudioSettings, startAmbientBgm } from './audio';
import { loadSave } from './data';

// Initialize audio preferences from persistent save
const save = loadSave();
setAudioSettings(save.soundEnabled ?? true, save.musicEnabled ?? true);

const unlockAudio = () => {
  getAudioContext();
  if (save.musicEnabled ?? true) {
    startAmbientBgm();
  }
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// Landscape 16:9 game that scales to fit phones and desktop windows.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#59b8f2',
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [MenuScene, AviaryScene],
});

(window as any).game = game;
