import Phaser from 'phaser';
import { AviaryScene, W, H } from './AviaryScene';
import { MenuScene } from './MenuScene';

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
