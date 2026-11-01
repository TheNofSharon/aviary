import Phaser from 'phaser';
import { makeTextures } from './art';
import { PETS, WORLDS, getUnlockedPets, getWorldAndStage, loadSave, maxPets, patchSave } from './data';
import { LogbookUI } from './LogbookUI';
import { AviaryScene } from './AviaryScene';
import { ACHIEVEMENTS, getUnlockedCount, isAchievementUnlocked } from './achievements';
import { isSoundOn, isMusicOn, toggleSound, toggleMusic, playButtonClickSound } from './audio';

const W = 1280;
const H = 720;
const FONT = 'Trebuchet MS, Verdana, sans-serif';

type MenuView =
  | 'main_menu'
  | 'world_select'
  | 'stage_briefing'
  | 'trophy_room'
  | 'options'
  | 'logbook'
  | 'challenges'
  | 'time_trial'
  | 'achievements';

interface MenuData {
  level?: number;
  view?: MenuView;
}

export class MenuScene extends Phaser.Scene {
  private level = 1;
  private maxUnlockedLevel = 1;
  private chosen = new Set<string>();
  private view: MenuView = 'main_menu';
  private aspectRatio: '16:9' | '4:3' = '16:9';

  constructor() {
    super('Menu');
  }

  preload() {
    // Pure procedural & generative vector textures
  }

  init(data: MenuData) {
    const save = loadSave();
    this.maxUnlockedLevel = Math.max(1, save.level);
    this.aspectRatio = save.aspectRatio ?? '16:9';

    if (data.view) {
      this.view = data.view;
      this.level = data.level ?? this.maxUnlockedLevel;
    } else if (data.level !== undefined) {
      // Direct jump or stage complete
      this.view = 'stage_briefing';
      this.level = data.level;
    } else {
      this.view = 'main_menu';
      this.level = this.maxUnlockedLevel;
    }

    this.chosen = new Set();
  }

  create() {
    makeTextures(this);
    this.events.off('refresh');

    const ws = getWorldAndStage(this.level);
    const th = ws.world.theme;

    // Atmospheric Background
    const bg = this.add.graphics();
    bg.fillGradientStyle(th.sky1, th.sky1, th.sky2, th.sky2, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(th.hillFar, 1);
    bg.fillEllipse(300, 720, 1100, 300);
    bg.fillStyle(th.hillNear, 1);
    bg.fillEllipse(950, 740, 1200, 280);
    for (let i = 0; i < 4; i++) {
      this.add.image(150 + i * 340, 80 + (i % 2) * 35, 'cloud').setAlpha(0.75).setScale(0.8);
    }

    // Route to current view
    switch (this.view) {
      case 'main_menu':
        this.renderMainMenu();
        break;
      case 'world_select':
        this.renderWorldSelect();
        break;
      case 'stage_briefing':
        this.renderStageBriefing();
        break;
      case 'trophy_room':
        this.renderTrophyRoom();
        break;
      case 'options':
        this.renderOptions();
        break;
      case 'logbook':
        this.renderLogbook();
        break;
      case 'challenges':
        this.renderChallenges();
        break;
      case 'time_trial':
        this.renderTimeTrialSelect();
        break;
      case 'achievements':
        this.renderAchievements();
        break;
    }
  }

  // =========================================================================
  // =========================================================================
  // VIEW 1: MAIN MENU (ORGANIC WOODLAND TERRARIUM SANCTUARY)
  // =========================================================================
  private renderMainMenu() {
    const save = loadSave();
    const ws = getWorldAndStage(this.maxUnlockedLevel);

    const suspended = AviaryScene.suspendedGame;
    const hasSuspended = !!suspended || !!save.suspendedSession;
    const timeTrialUnlocked = this.maxUnlockedLevel > 4;

    // -------------------------------------------------------------------------
    // LEFT SIDE: BIRCH PARCHMENT SPEECH SCROLL & COMPANION ON MOSSY BOULDER
    // -------------------------------------------------------------------------
    const bubbleX = 270;
    const bubbleY = 140;
    const bubbleW = 340;
    const bubbleH = 125;

    const bgGfx = this.add.graphics();
    // Soft shadow
    bgGfx.fillStyle(0x000000, 0.22);
    bgGfx.fillRoundedRect(bubbleX - bubbleW / 2 + 4, bubbleY - bubbleH / 2 + 6, bubbleW, bubbleH, 22);

    // Birch Parchment Body (Warm natural cream with rich woody border)
    bgGfx.fillStyle(0xfdf8eb, 0.98);
    bgGfx.fillRoundedRect(bubbleX - bubbleW / 2, bubbleY - bubbleH / 2, bubbleW, bubbleH, 22);
    bgGfx.lineStyle(3, 0x5c3818, 1);
    bgGfx.strokeRoundedRect(bubbleX - bubbleW / 2, bubbleY - bubbleH / 2, bubbleW, bubbleH, 22);

    // Inner subtle parchment border ring
    bgGfx.lineStyle(1.2, 0xd4c29a, 0.7);
    bgGfx.strokeRoundedRect(bubbleX - bubbleW / 2 + 5, bubbleY - bubbleH / 2 + 5, bubbleW - 10, bubbleH - 10, 18);

    // Comic pointer tail pointing down towards the mascot on the boulder
    bgGfx.fillStyle(0xfdf8eb, 1);
    bgGfx.fillPoints([
      new Phaser.Math.Vector2(bubbleX - 70, bubbleY + bubbleH / 2 - 2),
      new Phaser.Math.Vector2(bubbleX - 35, bubbleY + bubbleH / 2 - 2),
      new Phaser.Math.Vector2(bubbleX - 82, bubbleY + bubbleH / 2 + 25),
    ], true);
    bgGfx.lineStyle(3, 0x5c3818, 1);
    bgGfx.lineBetween(bubbleX - 70, bubbleY + bubbleH / 2 - 2, bubbleX - 82, bubbleY + bubbleH / 2 + 25);
    bgGfx.lineBetween(bubbleX - 35, bubbleY + bubbleH / 2 - 2, bubbleX - 82, bubbleY + bubbleH / 2 + 25);

    // Bubble Text
    this.add.text(bubbleX, bubbleY - 30, 'WELCOME TO AVIARY,', {
      fontFamily: FONT,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#2d6a4f',
    }).setOrigin(0.5);

    const playerName = (save.playerName || 'KEEPER').toUpperCase();
    this.add.text(bubbleX, bubbleY - 3, `${playerName}!`, {
      fontFamily: FONT,
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#451a03',
    }).setOrigin(0.5);

    const changeTxt = this.add.text(bubbleX, bubbleY + 28, 'If this is not you, click here.', {
      fontFamily: FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#059669',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    changeTxt.on('pointerdown', () => {
      const current = save.playerName || 'Keeper';
      const name = window.prompt('Enter your Keeper name:', current);
      if (name && name.trim()) {
        patchSave({ playerName: name.trim().slice(0, 16) });
        this.switchView('main_menu');
      }
    });
    changeTxt.on('pointerover', () => changeTxt.setColor('#047857'));
    changeTxt.on('pointerout', () => changeTxt.setColor('#059669'));

    // Left Mascot Scene: Mossy Granite River Boulder & Hollowed Cedar Seed Trough
    const stoneX = 240;
    const stoneY = 535;
    const cg = this.add.graphics();

    // Natural ground shadow
    cg.fillStyle(0x000000, 0.32);
    cg.fillEllipse(stoneX + 15, stoneY + 70, 260, 52);

    // Mossy Granite River Boulder (Tiered natural river rock)
    cg.fillStyle(0x334155, 1);
    cg.fillRoundedRect(stoneX - 95, stoneY - 20, 190, 85, 36);
    cg.fillStyle(0x475569, 1);
    cg.fillRoundedRect(stoneX - 88, stoneY - 32, 175, 75, 32);
    cg.fillStyle(0x64748b, 1);
    cg.fillRoundedRect(stoneX - 75, stoneY - 40, 150, 48, 24);

    // Lush Emerald & Forest Moss Patches creeping over boulder
    const drawMossPatch = (mx: number, my: number, mw: number, mh: number) => {
      cg.fillStyle(0x1e3a1e, 1);
      cg.fillEllipse(mx, my + 1, mw, mh);
      cg.fillStyle(0x2d6a4f, 1);
      cg.fillEllipse(mx, my, mw - 2, mh - 2);
      cg.fillStyle(0x52b788, 0.9);
      cg.fillEllipse(mx - 2, my - 2, mw * 0.6, mh * 0.5);
    };
    drawMossPatch(stoneX - 45, stoneY - 38, 55, 20);
    drawMossPatch(stoneX + 25, stoneY - 42, 65, 22);
    drawMossPatch(stoneX + 60, stoneY - 15, 45, 18);
    drawMossPatch(stoneX - 75, stoneY + 12, 38, 16);

    // Hollowed Rustic Cedar Log / Feeder Trough nestled by the boulder
    const troughX = stoneX - 70;
    const troughY = stoneY + 44;
    cg.fillStyle(0x2b1408, 1);
    cg.fillRoundedRect(troughX - 48, troughY - 10, 96, 32, 12);
    cg.fillStyle(0x45230c, 1);
    cg.fillRoundedRect(troughX - 45, troughY - 8, 90, 26, 10);
    cg.fillStyle(0x200e05, 1);
    cg.fillEllipse(troughX, troughY, 74, 16); // Hollow interior

    // Golden Seeds & Forest Acorns filling the trough
    cg.fillStyle(0xd97706, 1);
    cg.fillEllipse(troughX, troughY + 1, 64, 12);
    cg.fillStyle(0xfde047, 1);
    for (let i = 0; i < 14; i++) {
      const ox = (i % 5) * 12 - 24 + (i > 7 ? 6 : 0);
      const oy = Math.floor(i / 5) * 4 - 3;
      cg.fillCircle(troughX + ox, troughY + oy, 3.5);
    }
    // Sparkling Gems nestled among the seeds
    this.add.image(troughX + 22, troughY - 3, 'gem').setScale(0.72);
    this.add.image(troughX - 18, troughY - 1, 'gem').setScale(0.8);

    // Perched Animated 2.5D Mascot Bird on the mossy boulder crest
    this.createMenu25DBird(stoneX + 65, stoneY - 70, 2, 0.96, true);

    // Floating ambient woodland motes / gentle forest spores
    for (let i = 0; i < 9; i++) {
      const px = 130 + Math.random() * 280;
      const py = 350 + Math.random() * 230;
      const mote = this.add.circle(px, py, 2 + Math.random() * 2.2, 0x86efac, 0.65);
      this.tweens.add({
        targets: mote,
        y: py - 45,
        x: px + (Math.random() - 0.5) * 20,
        alpha: 0,
        duration: 2000 + Math.random() * 1400,
        repeat: -1,
        yoyo: true,
      });
    }

    // -------------------------------------------------------------------------
    // RIGHT SIDE: ANCIENT CARVED WOODLAND TABLET & POLISHED FOREST GEMSTONE BUTTONS
    // -------------------------------------------------------------------------
    const plateX = 940;
    const plateY = 360;
    const plateW = 450;
    const plateH = 590;

    const pg = this.add.graphics();
    // Deep wood drop shadow
    pg.fillStyle(0x000000, 0.38);
    pg.fillRoundedRect(plateX - plateW / 2 + 6, plateY - plateH / 2 + 8, plateW, plateH, 32);

    // Carved Oak Outer Board (Rich natural timber casing)
    pg.fillStyle(0x2d1808, 1);
    pg.fillRoundedRect(plateX - plateW / 2, plateY - plateH / 2, plateW, plateH, 32);
    pg.fillStyle(0x4a2a14, 1);
    pg.fillRoundedRect(plateX - plateW / 2 + 6, plateY - plateH / 2 + 6, plateW - 12, plateH - 12, 28);

    // Inner Recessed Cedar Board with Subtle Horizontal Grain Lines
    pg.fillStyle(0x381e0d, 1);
    pg.fillRoundedRect(plateX - plateW / 2 + 16, plateY - plateH / 2 + 16, plateW - 32, plateH - 32, 22);
    pg.fillStyle(0x533017, 1);
    pg.fillRoundedRect(plateX - plateW / 2 + 19, plateY - plateH / 2 + 19, plateW - 38, plateH - 38, 20);

    // Natural wood grain strips across the board
    pg.lineStyle(1.5, 0x3d200e, 0.35);
    for (let gy = plateY - plateH / 2 + 40; gy <= plateY + plateH / 2 - 40; gy += 38) {
      pg.lineBetween(plateX - plateW / 2 + 26, gy, plateX + plateW / 2 - 26, gy);
    }

    // Wooden Dowel Peg Joints at the four corners (Rustic master craft joints)
    const drawWoodPeg = (px: number, py: number) => {
      pg.fillStyle(0x1f1006, 1);
      pg.fillCircle(px, py + 1, 6.5);
      pg.fillStyle(0x78421a, 1);
      pg.fillCircle(px, py, 5.5);
      pg.fillStyle(0x9a5a2a, 1);
      pg.fillCircle(px - 1, py - 1, 3.5);
    };
    drawWoodPeg(plateX - plateW / 2 + 28, plateY - plateH / 2 + 28);
    drawWoodPeg(plateX + plateW / 2 - 28, plateY - plateH / 2 + 28);
    drawWoodPeg(plateX - plateW / 2 + 28, plateY + plateH / 2 - 28);
    drawWoodPeg(plateX + plateW / 2 - 28, plateY + plateH / 2 - 28);

    // Creeping Ivy Foliage clinging gracefully to the top rim & corners
    const drawIvyLeaf = (lx: number, ly: number, angleDeg: number, size = 11) => {
      pg.fillStyle(0x14532d, 1);
      pg.fillEllipse(lx, ly, size * 1.3, size * 0.9);
      pg.fillStyle(0x22c55e, 0.9);
      pg.fillEllipse(lx - 1, ly - 1, size * 0.9, size * 0.65);
    };
    // Top vine stem
    pg.lineStyle(3, 0x14532d, 0.9);
    pg.beginPath();
    pg.moveTo(plateX - plateW / 2 + 15, plateY - plateH / 2 + 12);
    pg.lineTo(plateX - plateW / 4, plateY - plateH / 2 + 6);
    pg.lineTo(plateX + plateW / 4, plateY - plateH / 2 + 8);
    pg.lineTo(plateX + plateW / 2 - 15, plateY - plateH / 2 + 14);
    pg.strokePath();

    // Ivy leaf clusters
    drawIvyLeaf(plateX - plateW / 2 + 22, plateY - plateH / 2 + 14, -20, 12);
    drawIvyLeaf(plateX - plateW / 2 + 38, plateY - plateH / 2 + 8, 15, 10);
    drawIvyLeaf(plateX - plateW / 2 + 54, plateY - plateH / 2 + 16, -10, 11);

    drawIvyLeaf(plateX + plateW / 2 - 24, plateY - plateH / 2 + 15, 25, 12);
    drawIvyLeaf(plateX + plateW / 2 - 40, plateY - plateH / 2 + 9, -15, 10);
    drawIvyLeaf(plateX + plateW / 2 - 58, plateY - plateH / 2 + 17, 10, 11);

    drawIvyLeaf(plateX - 35, plateY - plateH / 2 + 8, -5, 10);
    drawIvyLeaf(plateX + 30, plateY - plateH / 2 + 9, 8, 11);

    // -------------------------------------------------------------------------
    // THE 4 NATURE GEMSTONE RESIN CAPSULE BUTTONS
    // -------------------------------------------------------------------------
    // 1. START ADVENTURE / CONTINUE ADVENTURE (Sunlit Forest Amber)
    const advTitle = hasSuspended ? 'CONTINUE' : 'START ADVENTURE';
    const advSub = hasSuspended
      ? (suspended?.label || 'Resume Campaign')
      : `World ${ws.worldId}-${ws.stageNum}`;
    this.createNatureCapsuleButton(plateX, plateY - 195, advTitle, advSub, 'amber', () => {
      if (hasSuspended && (suspended?.mode === 'campaign' || (!suspended && save.suspendedSession))) {
        this.resumeActiveGame();
      } else {
        this.switchView('stage_briefing', this.maxUnlockedLevel);
      }
    });

    // 2. TIME TRIAL (Sky Topaz)
    const ttSub = timeTrialUnlocked ? '5-Minute Rush' : 'Locked • World 1';
    this.createNatureCapsuleButton(
      plateX,
      plateY - 105,
      'TIME TRIAL',
      ttSub,
      'topaz',
      () => {
        if (!timeTrialUnlocked) {
          this.showLockedToast('Complete World 1 (Stage 1-4) to unlock Time Trial!');
          return;
        }
        this.switchView('time_trial');
      },
      !timeTrialUnlocked
    );

    // 3. CHALLENGE (Twilight Amethyst)
    const chSub = timeTrialUnlocked ? 'Special Trials & Secrets' : 'Locked • World 1';
    this.createNatureCapsuleButton(
      plateX,
      plateY - 15,
      'CHALLENGE',
      chSub,
      'amethyst',
      () => {
        if (!timeTrialUnlocked) {
          this.showLockedToast('Complete World 1 (Stage 1-4) to unlock Challenges!');
          return;
        }
        this.switchView('challenges');
      },
      !timeTrialUnlocked
    );

    // 4. THE AVIARY (Deep Forest Emerald Sanctuary)
    const aviarySub = `${save.gems} GEMS`;
    this.createNatureCapsuleButton(plateX, plateY + 75, 'THE AVIARY', aviarySub, 'emerald', () => {
      this.scene.stop('Aviary');
      AviaryScene.suspendedGame = undefined;
      patchSave({ suspendedSession: undefined });
      this.scene.start('Aviary', { sandbox: true });
    });

    // -------------------------------------------------------------------------
    // CARVED ELDER TABLET: HALL OF FAME
    // -------------------------------------------------------------------------
    const hofBtn = this.add.container(plateX, plateY + 162);
    const hofGfx = this.add.graphics();
    // Drop shadow
    hofGfx.fillStyle(0x000000, 0.3);
    hofGfx.fillRoundedRect(-115, -19, 230, 42, 21);

    // Carved wood backing with gold inlay trim
    hofGfx.fillStyle(0x3a1d0b, 1);
    hofGfx.fillRoundedRect(-115, -22, 230, 42, 21);
    hofGfx.fillStyle(0x5c3214, 1);
    hofGfx.fillRoundedRect(-113, -20, 226, 38, 19);
    hofGfx.lineStyle(2, 0xd97706, 1);
    hofGfx.strokeRoundedRect(-113, -20, 226, 38, 19);

    const hofTxt = this.add.text(0, -2, '🏆 HALL OF FAME', {
      fontFamily: FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#fef08a',
      stroke: '#451a03',
      strokeThickness: 3,
    }).setOrigin(0.5);

    hofBtn.add([hofGfx, hofTxt]);
    hofBtn.setSize(230, 42).setInteractive({ useHandCursor: true });
    hofBtn.on('pointerdown', () => this.switchView('achievements'));
    hofBtn.on('pointerover', () => this.tweens.add({ targets: hofBtn, scale: 1.04, duration: 100 }));
    hofBtn.on('pointerout', () => this.tweens.add({ targets: hofBtn, scale: 1.0, duration: 100 }));

    // -------------------------------------------------------------------------
    // BOTTOM 3 WOODLAND SIGNPOST TABS: OPTIONS, LOGBOOK, WORLDS
    // -------------------------------------------------------------------------
    const bY = plateY + 220;
    this.createWoodlandButton(plateX - 128, bY, 'OPTIONS', 0x292524, 0x78716c, () => this.switchView('options'));
    this.createWoodlandButton(plateX, bY, 'LOGBOOK', 0x451a03, 0xb45309, () => this.switchView('logbook'));
    this.createWoodlandButton(plateX + 128, bY, 'WORLDS', 0x14532d, 0x22c55e, () => this.switchView('world_select'));
  }

  /**
   * Organic Forest Gemstone / Polished Resin capsule button with carved oak bevel & crystal sheen
   */
  private createNatureCapsuleButton(
    x: number,
    y: number,
    mainText: string,
    subText: string,
    gemTheme: 'amber' | 'topaz' | 'amethyst' | 'emerald',
    onClick: () => void,
    isLocked = false
  ) {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    const btnW = 380;
    const btnH = 72;

    // Drop shadow
    bg.fillStyle(0x000000, 0.35);
    bg.fillRoundedRect(-btnW / 2 + 4, -btnH / 2 + 5, btnW, btnH, 36);

    // Theme palettes for nature gemstones
    const themes = {
      amber: {
        rim: 0x451a03,
        bevel: 0x78350f,
        base: 0xb45309,
        fill: 0xd97706,
        highlight: 0xfef08a,
        textColor: '#fffbeb',
        subColor: '#fde047',
        textStroke: '#451a03',
      },
      topaz: {
        rim: 0x082f49,
        bevel: 0x0369a1,
        base: 0x0284c7,
        fill: 0x38bdf8,
        highlight: 0xe0f2fe,
        textColor: '#f0f9ff',
        subColor: '#bae6fd',
        textStroke: '#082f49',
      },
      amethyst: {
        rim: 0x3b0764,
        bevel: 0x6b21a8,
        base: 0x7e22ce,
        fill: 0xa855f7,
        highlight: 0xf5d0fe,
        textColor: '#faf5ff',
        subColor: '#e9d5ff',
        textStroke: '#3b0764',
      },
      emerald: {
        rim: 0x064e3b,
        bevel: 0x047857,
        base: 0x059669,
        fill: 0x10b981,
        highlight: 0xa7f3d0,
        textColor: '#ecfdf5',
        subColor: '#6ee7b7',
        textStroke: '#064e3b',
      },
    };

    const t = themes[gemTheme];

    if (isLocked) {
      // Muted slate wood locked styling
      bg.fillStyle(0x1e293b, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 36);
      bg.lineStyle(2.5, 0x475569, 1);
      bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 36);
    } else {
      // Carved Oak Wood Bevel Rim
      bg.fillStyle(t.rim, 1);
      bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 36);
      bg.fillStyle(t.bevel, 1);
      bg.fillRoundedRect(-btnW / 2 + 3, -btnH / 2 + 3, btnW - 6, btnH - 6, 33);

      // Carved Wooden Dowel / Leaf End-Caps on left & right
      const drawCapAccent = (cx: number) => {
        bg.fillStyle(0x1a0f07, 1);
        bg.fillCircle(cx, 1, 4.5);
        bg.fillStyle(0xd97706, 1);
        bg.fillCircle(cx, 0, 3.5);
        bg.fillStyle(0xfde047, 0.85);
        bg.fillCircle(cx - 1, -1, 1.2);
      };
      drawCapAccent(-btnW / 2 + 18);
      drawCapAccent(btnW / 2 - 18);

      // Polished Gemstone / Rich Colored Resin Body
      bg.fillStyle(t.base, 1);
      bg.fillRoundedRect(-btnW / 2 + 10, -btnH / 2 + 5, btnW - 20, btnH - 10, 28);
      bg.fillStyle(t.fill, 1);
      bg.fillRoundedRect(-btnW / 2 + 12, -btnH / 2 + 7, btnW - 24, btnH - 14, 26);

      // Crystal / Resin Glossy Sheen Highlight along top curve
      bg.fillStyle(t.highlight, 0.32);
      bg.fillRoundedRect(-btnW / 2 + 18, -btnH / 2 + 8, btnW - 36, (btnH - 16) * 0.44, 18);
    }

    // Typography
    const hasSub = !!subText;
    const txtY = hasSub ? -10 : -2;
    const title = this.add.text(0, txtY, (isLocked ? '🔒 ' : '') + mainText, {
      fontFamily: FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: isLocked ? '#94a3b8' : t.textColor,
      stroke: isLocked ? '#0f172a' : t.textStroke,
      strokeThickness: 4,
    }).setOrigin(0.5);

    const sub = this.add.text(0, 16, subText, {
      fontFamily: FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: isLocked ? '#64748b' : t.subColor,
      stroke: isLocked ? '#0f172a' : t.textStroke,
      strokeThickness: 2,
    }).setOrigin(0.5);

    btn.add([bg, title, sub]);
    btn.setSize(btnW, btnH).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      this.tweens.add({ targets: btn, scale: 0.97, duration: 80, yoyo: true, onComplete: onClick });
    });
    btn.on('pointerover', () => {
      this.tweens.add({ targets: btn, scale: 1.03, duration: 110 });
    });
    btn.on('pointerout', () => {
      this.tweens.add({ targets: btn, scale: 1.0, duration: 110 });
    });

    return btn;
  }

  private createWoodlandButton(x: number, y: number, text: string, bgCol: number, borderCol: number, onClick: () => void) {
    const btn = this.add.container(x, y);
    const g = this.add.graphics();
    const bw = 114;
    const bh = 34;

    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-bw / 2 + 2, -bh / 2 + 3, bw, bh, 10);
    g.fillStyle(bgCol, 1);
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);
    g.lineStyle(1.8, borderCol, 0.95);
    g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 10);

    const txt = this.add.text(0, -1, text, {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    btn.add([g, txt]);
    btn.setSize(bw, bh).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scale: 1.06, duration: 80 }));
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1.0, duration: 80 }));
    return btn;
  }

  private showLockedToast(msg: string) {
    this.cameras.main.shake(120, 0.004);
    const toast = this.add.text(W / 2, H / 2, `🔒 ${msg}`, {
      fontFamily: FONT,
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#f87171',
      stroke: '#450a0a',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(99);
    this.tweens.add({ targets: toast, y: toast.y - 35, alpha: 0, duration: 1600, onComplete: () => toast.destroy() });
  }

  private resumeActiveGame() {
    this.scene.stop('Aviary');
    const save = loadSave();
    if (save.suspendedSession) {
      const s = save.suspendedSession;
      this.scene.start('Aviary', {
        level: s.level,
        restoredCoins: s.coins,
        restoredWeapon: s.weapon,
        restoredEggs: s.eggs,
        pets: s.petKeys,
        restoredBirdCount: s.birdCount,
        promptResume: true,
      });
      return;
    }
    if (AviaryScene.suspendedGame) {
      const s = AviaryScene.suspendedGame;
      this.scene.start('Aviary', {
        level: s.level,
        restoredCoins: s.coins,
        restoredWeapon: s.weapon,
        restoredEggs: s.eggs,
        pets: s.petKeys,
        restoredBirdCount: s.flockCount,
        sandbox: s.mode === 'sandbox',
        timeTrial: s.mode === 'timeTrial',
        challengeId: s.challengeId,
        promptResume: true,
      });
      return;
    }
    this.scene.start('Aviary', { level: this.maxUnlockedLevel });
  }

  // =========================================================================
  // VIEW 2: WORLD & STAGE SELECT
  // =========================================================================
  private renderWorldSelect() {
    this.createHeaderPill('WORLD & STAGE SELECT', 'Choose any unlocked stage to replay or advance campaign');

    const colW = 256;
    const colH = 436;
    const startX = 146;
    const gapX = 272;
    const cardY = 350;

    WORLDS.forEach((world, wIdx) => {
      const cx = startX + wIdx * gapX;
      const c = this.add.container(cx, cardY);

      // Card Background
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(-colW / 2 + 4, -colH / 2 + 6, colW, colH, 18);
      g.fillStyle(0x3e2313, 0.94);
      g.fillRoundedRect(-colW / 2, -colH / 2, colW, colH, 18);
      g.lineStyle(3, 0x8d5c34, 1);
      g.strokeRoundedRect(-colW / 2, -colH / 2, colW, colH, 18);

      // World Header
      const wHeader = this.add.text(0, -colH / 2 + 24, `WORLD ${world.id}`, {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffca28',
      }).setOrigin(0.5);

      const wName = this.add.text(0, -colH / 2 + 48, world.name, {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      const wSub = this.add.text(0, -colH / 2 + 74, world.subtitle, {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ddcfbc',
        align: 'center',
        wordWrap: { width: colW - 20 },
      }).setOrigin(0.5);

      c.add([g, wHeader, wName, wSub]);

      // 4 Stage Buttons
      const stageStartY = -colH / 2 + 124;
      const stageGap = 52;

      world.stages.forEach((stg, sIdx) => {
        const flatLevel = (world.id - 1) * 4 + stg.stage;
        const isCurrent = flatLevel === this.maxUnlockedLevel;
        const isCompleted = flatLevel < this.maxUnlockedLevel;
        const isLocked = flatLevel > this.maxUnlockedLevel;

        const sy = stageStartY + sIdx * stageGap;
        const sbtn = this.add.container(0, sy);
        const sg = this.add.graphics();

        const bw = colW - 32;
        const bh = 42;

        const petDef = PETS[flatLevel - 1];
        let bgCol = 0x221208;
        let borderCol = 0x5a3922;
        let label = `Stage ${world.id}-${stg.stage}`;
        let textColor = '#ffffff';

        if (isCompleted) {
          bgCol = 0x1b4332;
          borderCol = 0x52b788;
          label = `★ ${world.id}-${stg.stage} (${petDef ? petDef.name : ''})`;
          textColor = '#d8f3dc';
        } else if (isCurrent) {
          bgCol = 0xb45309;
          borderCol = 0xfbbf24;
          label = `► ${world.id}-${stg.stage} (${petDef ? petDef.name : 'Next'})`;
          textColor = '#fffbeb';
        } else {
          bgCol = 0x1f1915;
          borderCol = 0x3d3029;
          label = `🔒 ${world.id}-${stg.stage} (${petDef ? petDef.name : 'Locked'})`;
          textColor = '#887b73';
        }

        sg.fillStyle(bgCol, 1);
        sg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
        sg.lineStyle(2, borderCol, 1);
        sg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);

        const stext = this.add.text(0, 0, label, {
          fontFamily: FONT,
          fontSize: '14px',
          fontStyle: 'bold',
          color: textColor,
        }).setOrigin(0.5);

        sbtn.add([sg, stext]);

        if (!isLocked) {
          sbtn.setSize(bw, bh).setInteractive({ useHandCursor: true });
          sbtn.on('pointerdown', () => this.switchView('stage_briefing', flatLevel));
          sbtn.on('pointerover', () => {
            this.tweens.add({ targets: sbtn, scale: 1.05, duration: 100 });
          });
          sbtn.on('pointerout', () => {
            this.tweens.add({ targets: sbtn, scale: 1.0, duration: 100 });
          });
          if (isCurrent) {
            this.tweens.add({ targets: sbtn, scale: 1.03, duration: 600, yoyo: true, repeat: -1 });
          }
        }

        c.add(sbtn);
      });

      // Bottom World Companions Progress Pill
      const worldPets = PETS.slice((world.id - 1) * 4, world.id * 4);
      const rescuedCount = worldPets.filter((p) => this.maxUnlockedLevel > p.stageReq).length;
      const petY = colH / 2 - 34;

      const petPill = this.add.graphics();
      petPill.fillStyle(rescuedCount === 4 ? 0x22543d : 0x20140e, 0.85);
      petPill.fillRoundedRect(-colW / 2 + 16, petY - 20, colW - 32, 40, 12);
      petPill.lineStyle(1.5, rescuedCount === 4 ? 0x48bb78 : 0x60402b, 1);
      petPill.strokeRoundedRect(-colW / 2 + 16, petY - 20, colW - 32, 40, 12);

      const petTxt = this.add.text(0, petY, `🐾 Companions: ${rescuedCount} / 4 Rescued`, {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: rescuedCount === 4 ? '#c6f6d5' : '#ffd54f',
      }).setOrigin(0.5);

      c.add([petPill, petTxt]);
    });

    this.createBackButton();
  }

  // =========================================================================
  // VIEW 3: STAGE BRIEFING
  // =========================================================================
  private renderStageBriefing() {
    const ws = getWorldAndStage(this.level);

    // Title & Mascots
    this.add.image(W / 2 - 340, 70, ws.worldId >= 4 ? 'bird_phoenix' : 'bird_s2').setScale(0.9);
    this.add.image(W / 2 + 340, 70, ws.worldId >= 2 ? 'bird_piranha_finch' : 'bird_s3').setScale(0.9).setFlipX(true);
    this.txt(W / 2, 50, 'AVIARY', 56, '#ffffff', '#2b4f6e', 8);

    // Stage Heading
    const headerContainer = this.add.container(W / 2, 112);
    const hpill = this.add.graphics();
    hpill.fillStyle(0x000000, 0.45);
    hpill.fillRoundedRect(-320, -22, 640, 44, 22);
    hpill.lineStyle(2, 0xffd54f, 0.8);
    hpill.strokeRoundedRect(-320, -22, 640, 44, 22);

    const titleText = this.add
      .text(0, 0, `${ws.label}: ${ws.stage.name}`, {
        fontFamily: FONT,
        fontSize: '25px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    headerContainer.add([hpill, titleText]);

    // Navigation arrows between unlocked stages
    if (this.level > 1) {
      const prevBtn = this.add
        .text(W / 2 - 360, 112, '◀', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffd54f' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      prevBtn.on('pointerdown', () => this.switchView('stage_briefing', this.level - 1));
    }
    if (this.level < this.maxUnlockedLevel) {
      const nextBtn = this.add
        .text(W / 2 + 360, 112, '▶', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffd54f' })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => this.switchView('stage_briefing', this.level + 1));
    }

    // Main Briefing Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x422817, 0.94);
    panel.fillRoundedRect(140, 150, W - 280, 440, 24);
    panel.lineStyle(4, 0x8d5c34, 1);
    panel.strokeRoundedRect(140, 150, W - 280, 440, 24);

    this.txt(W / 2, 178, `World ${ws.world.id}: ${ws.world.name} — ${ws.world.subtitle}`, 21, '#ffd54f', '#2b1608', 3);
    this.txt(W / 2, 210, `“${ws.stage.briefing}”`, 18, '#ffffff', '#221105', 3);

    // Feature Banner
    const spotY = 270;
    const spotBox = this.add.graphics();
    spotBox.fillStyle(0x27170c, 0.85);
    spotBox.fillRoundedRect(180, spotY - 30, W - 360, 64, 16);
    spotBox.lineStyle(2, 0xffa726, 0.9);
    spotBox.strokeRoundedRect(180, spotY - 30, W - 360, 64, 16);

    this.txt(W / 2, spotY - 12, `⭐ FEATURE: ${ws.world.mechanicTitle}`, 17, '#ffca28', '#2b1608', 3);
    this.txt(W / 2, spotY + 14, ws.world.mechanicDesc, 15, '#e0d6cb', '#1a0d05', 2);

    // Helper Pets or Tutorial (World 1-1)
    const unlocked = getUnlockedPets(this.maxUnlockedLevel);
    if (this.level === 1 || unlocked.length === 0) {
      const lines = [
        '1. Click sky to drop seeds (costs 5c). Sparrows grow bigger as they eat.',
        '2. Sparrows drop silver & gold coins. Hover over coins to collect them!',
        '3. If predators appear in later levels, tap them with your Slingshot!',
        '4. Buy all 3 Egg Pieces in the toolbar to clear the stage and rescue companions!',
      ];
      lines.forEach((l, i) => this.txt(W / 2, 345 + i * 26, l, 16, '#ffffff', '#221105', 3));

      // 4 Evolution Stages Showcase (Chick, Fledgling, Adult, King)
      const stagesConfig = [
        { x: W / 2 - 165, y: 465, stage: 0, scale: 0.82, isKing: false },
        { x: W / 2 - 55,  y: 465, stage: 1, scale: 0.80, isKing: false },
        { x: W / 2 + 55,  y: 465, stage: 2, scale: 0.76, isKing: false },
        { x: W / 2 + 165, y: 465, stage: 2, scale: 0.80, isKing: true },
      ];

      stagesConfig.forEach((cfg) => {
        this.createMenu25DBird(cfg.x, cfg.y, cfg.stage, cfg.scale, cfg.isKing);
      });
    } else {
      const slots = 3;
      this.txt(W / 2, 328, `Choose up to ${slots} Companion Helpers for this stage (${this.chosen.size}/${slots} chosen):`, 19, '#ffffff', '#221105', 3);

      const count = unlocked.length;
      if (count <= 4) {
        const cw = 185;
        const startX = W / 2 - ((count - 1) * (cw + 14)) / 2;
        for (let i = 0; i < count; i++) {
          this.card(startX + i * (cw + 14), 425, cw, i, slots);
        }
      } else {
        const perRow = Math.min(8, Math.ceil(count / 2));
        const cw = 118;
        const ch = 90;
        const startX = W / 2 - ((perRow - 1) * (cw + 10)) / 2;
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          const cx = startX + col * (cw + 10);
          const cy = 378 + row * (ch + 10);
          this.compactCard(cx, cy, cw, ch, i, slots);
        }
      }

      if (this.chosen.size === 0) {
        for (let i = 0; i < Math.min(unlocked.length, slots); i++) {
          this.chosen.add(unlocked[i].key);
        }
      }
      this.events.emit('refresh');
    }

    // START Button
    const btn = this.add.container(W / 2, 545);
    const g = this.add.graphics();
    g.fillStyle(0x2a6b25, 1);
    g.fillRoundedRect(-120, -8, 240, 56, 18);
    g.fillStyle(0x58c552, 1);
    g.fillRoundedRect(-120, -14, 240, 56, 18);
    btn.add([
      g,
      this.add.text(0, 14, 'START STAGE', {
        fontFamily: FONT,
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#fff',
        stroke: '#2a6b25',
        strokeThickness: 5,
      }).setOrigin(0.5),
    ]);
    btn.setSize(240, 56).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      this.scene.stop('Aviary');
      AviaryScene.suspendedGame = undefined;
      patchSave({ suspendedSession: undefined });
      this.scene.start('Aviary', { level: this.level, pets: [...this.chosen] });
    });
    this.tweens.add({ targets: btn, scale: 1.05, duration: 700, yoyo: true, repeat: -1 });

    // Secondary Stage Select & Main Menu Navigation Buttons
    this.createNavButton(180, 645, '🗺️  CHANGE STAGE', 0x204566, 0x3b82f6, () => this.switchView('world_select'));
    this.createNavButton(W - 180, 645, '◀  MAIN MENU', 0x3e2415, 0x8d5c34, () => this.switchView('main_menu'));
  }

  // =========================================================================
  // VIEW 4: TROPHY ROOM & PET SANCTUARY
  // =========================================================================
  private renderTrophyRoom() {
    this.createHeaderPill('PET SANCTUARY & TROPHY ROOM', '16 Stage Companions + Bonus Masters. Unlock one after each stage! Pick 3 in briefings.');

    const colW = 256;
    const colH = 436;
    const startX = 146;
    const gapX = 272;
    const cardY = 350;

    WORLDS.forEach((world, wIdx) => {
      const cx = startX + wIdx * gapX;
      const c = this.add.container(cx, cardY);

      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(-colW / 2 + 4, -colH / 2 + 6, colW, colH, 18);
      g.fillStyle(0x3e2313, 0.94);
      g.fillRoundedRect(-colW / 2, -colH / 2, colW, colH, 18);
      g.lineStyle(3, 0x8d5c34, 1);
      g.strokeRoundedRect(-colW / 2, -colH / 2, colW, colH, 18);

      const wHeader = this.add.text(0, -colH / 2 + 20, `WORLD ${world.id} COMPANIONS`, {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffca28',
      }).setOrigin(0.5);

      c.add([g, wHeader]);

      const rowStartY = -colH / 2 + 68;
      const rowGap = 88;

      for (let s = 0; s < 4; s++) {
        const petIdx = wIdx * 4 + s;
        const pet = PETS[petIdx];
        if (!pet) continue;
        const isUnlocked = this.maxUnlockedLevel > pet.stageReq;

        const ry = rowStartY + s * rowGap;
        const rc = this.add.container(0, ry);
        const rg = this.add.graphics();
        const rw = colW - 20;
        const rh = 80;

        rg.fillStyle(isUnlocked ? 0x24150c : 0x1a120c, 1);
        rg.fillRoundedRect(-rw / 2, -rh / 2, rw, rh, 10);
        rg.lineStyle(1.5, isUnlocked ? 0x9333ea : 0x443026, 1);
        rg.strokeRoundedRect(-rw / 2, -rh / 2, rw, rh, 10);

        const icon = this.add.image(-rw / 2 + 30, 0, 'pet_' + pet.key).setScale(0.55);
        if (!isUnlocked) icon.setTint(0x333333);

        const pName = this.add.text(-rw / 2 + 62, -26, pet.name, {
          fontFamily: FONT,
          fontSize: '15px',
          fontStyle: 'bold',
          color: isUnlocked ? '#ffffff' : '#715d50',
        });

        const pRole = this.add.text(-rw / 2 + 62, -8, `${pet.role} (${pet.stageLabel})`, {
          fontFamily: FONT,
          fontSize: '11px',
          fontStyle: 'bold',
          color: isUnlocked ? '#facc15' : '#57453a',
        });

        const pDesc = this.add.text(-rw / 2 + 62, 8, pet.desc, {
          fontFamily: FONT,
          fontSize: '10px',
          color: isUnlocked ? '#f3e8d9' : '#57453a',
          wordWrap: { width: rw - 70 },
        });

        const pBadge = this.add.text(rw / 2 - 8, -rh / 2 + 8, isUnlocked ? '✓ RESCUED' : 'LOCKED', {
          fontFamily: FONT,
          fontSize: '9px',
          fontStyle: 'bold',
          color: isUnlocked ? '#4ade80' : '#715d50',
        }).setOrigin(1, 0);

        rc.add([rg, icon, pName, pRole, pDesc, pBadge]);
        c.add(rc);
      }
    });

    this.createBackButton();
  }

  // =========================================================================
  // VIEW 5: OPTIONS & HOW TO PLAY
  // =========================================================================
  private renderOptions() {
    this.createHeaderPill('OPTIONS & HOW TO PLAY', 'Master aviary controls, sanctuary mechanics & campaign management');

    const save = loadSave();
    const ws = getWorldAndStage(this.maxUnlockedLevel);

    // Left Card: Gameplay Guide
    const leftCard = this.add.container(360, 350);
    const lg = this.add.graphics();
    lg.fillStyle(0x000000, 0.4);
    lg.fillRoundedRect(-300, -210, 600, 420, 20);
    lg.fillStyle(0x3e2313, 0.94);
    lg.fillRoundedRect(-304, -214, 600, 420, 20);
    lg.lineStyle(3, 0x8d5c34, 1);
    lg.strokeRoundedRect(-304, -214, 600, 420, 20);

    const lTitle = this.add.text(0, -180, 'KEEPER FIELD GUIDE', {
      fontFamily: FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffd54f',
    }).setOrigin(0.5);

    leftCard.add([lg, lTitle]);

    const tips = [
      { t: '🌱  Feeding Birds:', d: 'Click the sky to drop seeds. Birds eat and grow through 4 life stages.' },
      { t: '🪙  Collecting Coins:', d: 'Hover your cursor over coins, diamonds, and solar embers to harvest them.' },
      { t: '🎯  Slingshot Defense:', d: 'Tap invading Hawks, Crows, and Wyverns with your Slingshot before they hurt your flock!' },
      { t: '✨  Ecosystem Synergy:', d: 'Mama Doves hatch free chicks, Piranhas hunt chicks for diamonds, and the Sacred Pyre rebirths Phoenixes.' },
      { t: '💎  My Aviary & Secrets:', d: 'Spend gems in the daily rotating Pet Store, name your birds special secret names, and relax!' },
    ];

    tips.forEach((tip, i) => {
      const y = -140 + i * 65;
      const tH = this.add.text(-270, y, tip.t, {
        fontFamily: FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffca28',
      });
      const tD = this.add.text(-270, y + 22, tip.d, {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffffff',
        wordWrap: { width: 540 },
      });
      leftCard.add([tH, tD]);
    });

    // Right Card: Campaign Management & Progress
    const rightCard = this.add.container(960, 350);
    const rg = this.add.graphics();
    rg.fillStyle(0x000000, 0.4);
    rg.fillRoundedRect(-240, -210, 480, 420, 20);
    rg.fillStyle(0x27170c, 0.94);
    rg.fillRoundedRect(-244, -214, 480, 420, 20);
    rg.lineStyle(3, 0xd97706, 1);
    rg.strokeRoundedRect(-244, -214, 480, 420, 20);

    const rTitle = this.add.text(0, -180, 'SANCTUARY STATUS', {
      fontFamily: FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffd54f',
    }).setOrigin(0.5);

    rightCard.add([rg, rTitle]);

    const statLines = [
      `Campaign Progress: ${ws.label} (${this.maxUnlockedLevel} / 16 Stages)`,
      `Current World: ${ws.world.name}`,
      `Total Gems Stored: 💎 ${save.gems}`,
      `Time Trial Record: ⏱️ ${save.timeTrialHighScore ?? 0} Coins`,
    ];
    statLines.forEach((sl, i) => {
      const st = this.add.text(0, -135 + i * 32, sl, {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      rightCard.add(st);
    });

    // Aspect Ratio Toggle: 16:9 / 4:3
    const aspectBtn = this.add.container(0, -5);
    const abg = this.add.graphics();
    abg.fillStyle(0x1a4563, 1);
    abg.fillRoundedRect(-180, -16, 360, 32, 10);
    abg.lineStyle(2, 0x38bdf8, 1);
    abg.strokeRoundedRect(-180, -16, 360, 32, 10);
    const aspectTxt = this.add.text(0, 0, `📐  Background: ${this.aspectRatio === '16:9' ? '16:9 Widescreen (Bg 1)' : '4:3 Classic (Bg 2)'}`, {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#7df9ff',
    }).setOrigin(0.5);
    aspectBtn.add([abg, aspectTxt]);
    aspectBtn.setSize(360, 32).setInteractive({ useHandCursor: true });
    aspectBtn.on('pointerdown', () => {
      playButtonClickSound();
      this.aspectRatio = this.aspectRatio === '16:9' ? '4:3' : '16:9';
      patchSave({ aspectRatio: this.aspectRatio });
      this.switchView('options');
    });
    rightCard.add(aspectBtn);

    // Sound FX Toggle Button
    const sfxBtn = this.add.container(0, 34);
    const sfxBg = this.add.graphics();
    const sfxOn = isSoundOn();
    sfxBg.fillStyle(sfxOn ? 0x14532d : 0x374151, 1);
    sfxBg.fillRoundedRect(-180, -16, 360, 32, 10);
    sfxBg.lineStyle(2, sfxOn ? 0x22c55e : 0x9ca3af, 1);
    sfxBg.strokeRoundedRect(-180, -16, 360, 32, 10);
    const sfxTxt = this.add.text(0, 0, `🔊  Sound Effects: ${sfxOn ? 'ON' : 'MUTED'}`, {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: sfxOn ? '#86efac' : '#d1d5db',
    }).setOrigin(0.5);
    sfxBtn.add([sfxBg, sfxTxt]);
    sfxBtn.setSize(360, 32).setInteractive({ useHandCursor: true });
    sfxBtn.on('pointerdown', () => {
      const nowOn = toggleSound();
      patchSave({ soundEnabled: nowOn });
      if (nowOn) playButtonClickSound();
      this.switchView('options');
    });
    rightCard.add(sfxBtn);

    // Ambient Music Toggle Button
    const bgmBtn = this.add.container(0, 73);
    const bgmBg = this.add.graphics();
    const bgmOn = isMusicOn();
    bgmBg.fillStyle(bgmOn ? 0x115e59 : 0x374151, 1);
    bgmBg.fillRoundedRect(-180, -16, 360, 32, 10);
    bgmBg.lineStyle(2, bgmOn ? 0x14b8a6 : 0x9ca3af, 1);
    bgmBg.strokeRoundedRect(-180, -16, 360, 32, 10);
    const bgmTxt = this.add.text(0, 0, `🎵  Ambient Music: ${bgmOn ? 'ON' : 'MUTED'}`, {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: bgmOn ? '#5eead4' : '#d1d5db',
    }).setOrigin(0.5);
    bgmBtn.add([bgmBg, bgmTxt]);
    bgmBtn.setSize(360, 32).setInteractive({ useHandCursor: true });
    bgmBtn.on('pointerdown', () => {
      const nowOn = toggleMusic();
      patchSave({ musicEnabled: nowOn });
      playButtonClickSound();
      this.switchView('options');
    });
    rightCard.add(bgmBtn);

    // Restore / Unlock All Stages Button (Instant Recovery)
    const unlockBtn = this.add.container(0, 115);
    const ubg = this.add.graphics();
    ubg.fillStyle(0x166534, 1);
    ubg.fillRoundedRect(-180, -16, 360, 32, 10);
    ubg.lineStyle(2, 0x4ade80, 1);
    ubg.strokeRoundedRect(-180, -16, 360, 32, 10);

    const uTxt = this.add.text(0, 0, '👑  Unlock All 16 Campaign Stages', {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    unlockBtn.add([ubg, uTxt]);
    unlockBtn.setSize(360, 32).setInteractive({ useHandCursor: true });
    unlockBtn.on('pointerdown', () => {
      playButtonClickSound();
      patchSave({ level: 16 });
      this.switchView('stage_briefing', 16);
    });

    // Reset Campaign Progress Button
    const resetBtn = this.add.container(0, 154);
    const rbg = this.add.graphics();
    rbg.fillStyle(0x7f1d1d, 1);
    rbg.fillRoundedRect(-180, -16, 360, 32, 10);
    rbg.lineStyle(2, 0xef4444, 1);
    rbg.strokeRoundedRect(-180, -16, 360, 32, 10);

    const rTxt = this.add.text(0, 0, '⚠️  Reset Campaign to World 1-1', {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    resetBtn.add([rbg, rTxt]);
    resetBtn.setSize(360, 32).setInteractive({ useHandCursor: true });
    resetBtn.on('pointerdown', () => {
      playButtonClickSound();
      patchSave({ level: 1 });
      this.switchView('stage_briefing', 1);
    });

    const resetHint = this.add.text(0, 186, 'Safe Reset: Preserves your gems & sandbox aviary birds.', {
      fontFamily: FONT,
      fontSize: '11px',
      color: '#f87171',
    }).setOrigin(0.5);

    rightCard.add([unlockBtn, resetBtn, resetHint]);

    this.createBackButton();
  }

  // =========================================================================
  // SHARED UI HELPERS
  // =========================================================================
  private switchView(view: MenuView, level?: number) {
    this.scene.restart({ view, level: level ?? this.level });
  }

  private createHeaderPill(title: string, subtitle: string) {
    const pill = this.add.graphics();
    pill.fillStyle(0x000000, 0.45);
    pill.fillRoundedRect(W / 2 - 340, 14, 680, 56, 20);
    pill.lineStyle(2, 0xffd54f, 0.85);
    pill.strokeRoundedRect(W / 2 - 340, 14, 680, 56, 20);

    this.txt(W / 2, 32, title, 26, '#ffffff', '#241408', 5);
    this.txt(W / 2, 54, subtitle, 14, '#ffd54f', '#241408', 3);
  }

  private createBackButton() {
    const btn = this.add.container(W / 2, 650);
    const g = this.add.graphics();
    g.fillStyle(0x3e2415, 1);
    g.fillRoundedRect(-110, -18, 220, 40, 14);
    g.lineStyle(2, 0xffa726, 0.9);
    g.strokeRoundedRect(-110, -18, 220, 40, 14);

    btn.add([
      g,
      this.add.text(0, 0, '◀  MAIN MENU', {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5),
    ]);

    btn.setSize(220, 40).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this.switchView('main_menu'));
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scale: 1.05, duration: 100 }));
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1.0, duration: 100 }));
  }

  private createNavButton(x: number, y: number, text: string, bgCol: number, borderCol: number, cb: () => void) {
    const btn = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(bgCol, 1);
    g.fillRoundedRect(-150, -20, 300, 44, 14);
    g.lineStyle(2, borderCol, 0.9);
    g.strokeRoundedRect(-150, -20, 300, 44, 14);

    btn.add([
      g,
      this.add.text(0, 0, text, {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5),
    ]);

    btn.setSize(300, 44).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', cb);
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scale: 1.05, duration: 100 }));
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scale: 1.0, duration: 100 }));
    return btn;
  }

  private txt(x: number, y: number, s: string, size: number, color: string, stroke: string, st: number) {
    return this.add.text(x, y, s, {
      fontFamily: FONT,
      fontSize: size + 'px',
      fontStyle: 'bold',
      color,
      stroke,
      strokeThickness: st,
      align: 'center',
    }).setOrigin(0.5);
  }

  private createMenu25DBird(x: number, y: number, stage: number, scale = 0.8, isKing = false) {
    const s = Math.min(2, Math.max(0, stage));
    const bodyKey = this.textures.exists(`bird_sparrow_${s}`) ? `bird_sparrow_${s}` : 'bird_sparrow';
    const wingKey = this.textures.exists(`wing_sparrow_${s}`) ? `wing_sparrow_${s}` : 'wing_sparrow';

    const wingX = s === 0 ? -4 : s === 1 ? -6 : -8;
    const wingY = s === 0 ? 3 : s === 1 ? 4 : 5;

    // Contact ground shadow
    this.add.ellipse(x, y + 42 * scale, 50 * scale, 16 * scale, 0x050e1c, 0.22);

    // Rig container
    const c = this.add.container(x, y).setScale(scale);

    // Body & Wing
    const body = this.add.image(0, 0, bodyKey);
    const wing = this.add.image(wingX, wingY, wingKey).setOrigin(0.78, 0.5);

    c.add([body, wing]);

    if (isKing) {
      const crown = this.add.image(2, -34, 'crown').setScale(0.85).setRotation(0.2);
      c.add(crown);
    }

    // Buttery smooth 60 FPS tweens for wings & body
    this.tweens.add({
      targets: wing,
      angle: { from: -22, to: 22 },
      duration: s === 0 ? 190 : s === 1 ? 240 : 290,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: c,
      y: y - 8,
      duration: 1600 + s * 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return c;
  }

  private card(x: number, y: number, w: number, idx: number, slots: number) {
    const def = PETS[idx];
    if (!def) return;
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const icon = this.add.image(0, -32, 'pet_' + def.key).setScale(0.85);
    const name = this.add.text(0, 25, def.name, {
      fontFamily: FONT,
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#4a2c12',
    }).setOrigin(0.5);
    const desc = this.add.text(0, 62, def.desc, {
      fontFamily: FONT,
      fontSize: '12px',
      color: '#6b4a2a',
      align: 'center',
      wordWrap: { width: w - 18 },
    }).setOrigin(0.5);
    c.add([bg, icon, name, desc]);

    const draw = () => {
      const on = this.chosen.has(def.key);
      bg.clear();
      bg.fillStyle(on ? 0xffd86b : 0xf4e2bd, 1);
      bg.fillRoundedRect(-w / 2, -75, w, 150, 14);
      bg.lineStyle(on ? 4 : 2, on ? 0xff9a1f : 0xa87a4a, 1);
      bg.strokeRoundedRect(-w / 2, -75, w, 150, 14);
      c.setAlpha(on || this.chosen.size < slots ? 1 : 0.65);
    };
    draw();
    this.events.on('refresh', draw);
    c.setSize(w, 150).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      if (this.chosen.has(def.key)) this.chosen.delete(def.key);
      else if (this.chosen.size < slots) this.chosen.add(def.key);
      this.events.emit('refresh');
    });
  }

  private compactCard(x: number, y: number, w: number, h: number, idx: number, slots: number) {
    const def = PETS[idx];
    if (!def) return;
    const c = this.add.container(x, y);
    const bg = this.add.graphics();
    const icon = this.add.image(0, -18, 'pet_' + def.key).setScale(0.52);
    const name = this.add.text(0, 14, def.name, {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#4a2c12',
    }).setOrigin(0.5);
    const role = this.add.text(0, 28, def.role, {
      fontFamily: FONT,
      fontSize: '9px',
      color: '#78350f',
    }).setOrigin(0.5);
    c.add([bg, icon, name, role]);

    const draw = () => {
      const on = this.chosen.has(def.key);
      bg.clear();
      bg.fillStyle(on ? 0xffd86b : 0xf4e2bd, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(on ? 3 : 1.5, on ? 0xff9a1f : 0xa87a4a, 1);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      c.setAlpha(on || this.chosen.size < slots ? 1 : 0.6);
    };
    draw();
    this.events.on('refresh', draw);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      if (this.chosen.has(def.key)) this.chosen.delete(def.key);
      else if (this.chosen.size < slots) this.chosen.add(def.key);
      this.events.emit('refresh');
    });
  }

  // =========================================================================
  // VIEW 6: AVIARY LOGBOOK & ENCYCLOPEDIA
  // =========================================================================
  private renderLogbook() {
    new LogbookUI(this, {
      onClose: () => this.switchView('main_menu'),
      isModal: false,
    });
  }

  // =========================================================================
  // VIEW 7: KEEPER CHALLENGES (INCLUDING SECRET BAT CHALLENGE)
  // =========================================================================
  private renderChallenges() {
    this.createHeaderPill(
      'KEEPER CHALLENGES',
      'Survive specialized predator trials, unique conditions, and secret boss encounters'
    );

    const save = loadSave();
    const cardW = 500;
    const cardH = 480;
    const cardY = 350;

    // --- CARD 1: STANDARD TRIAL: PREDATOR ONSLAUGHT ---
    const leftX = W / 2 - cardW / 2 - 20;
    const leftContainer = this.add.container(leftX, cardY);
    const lg = this.add.graphics();
    lg.fillStyle(0x000000, 0.45);
    lg.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 18);
    lg.fillStyle(0x1e1528, 0.96);
    lg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
    lg.lineStyle(3, 0xf59e0b, 1);
    lg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);

    const lSection = this.add.text(0, -cardH / 2 + 26, '⚔️ KEEPER TRIAL 1', {
      fontFamily: FONT,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#fbbf24',
    }).setOrigin(0.5);

    const lTitle = this.add.text(0, -cardH / 2 + 56, 'Predator Onslaught', {
      fontFamily: FONT,
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    const lBadge = this.add.text(0, -cardH / 2 + 90, 'ENDURANCE GAUNTLET', {
      fontFamily: FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#fde047',
    }).setOrigin(0.5);

    const eagleIcon = this.add.image(0, -cardH / 2 + 145, 'goldegg').setScale(1.2);

    const lDesc = this.add.text(
      0,
      -cardH / 2 + 225,
      'Confront surging waves of aggressive predators without companion helpers. Fend off swift hawk dive-bombs and cunning invaders with only your seed supply and slingshot!',
      {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#e2e8f0',
        align: 'center',
        wordWrap: { width: cardW - 60 },
      }
    ).setOrigin(0.5);

    const lModBg = this.add.graphics();
    lModBg.fillStyle(0x2a1742, 0.9);
    lModBg.fillRoundedRect(-cardW / 2 + 30, -cardH / 2 + 280, cardW - 60, 48, 12);
    lModBg.lineStyle(1.5, 0xd97706, 0.7);
    lModBg.strokeRoundedRect(-cardW / 2 + 30, -cardH / 2 + 280, cardW - 60, 48, 12);

    const lModTxt = this.add.text(
      0,
      -cardH / 2 + 304,
      '⚡ Rapid Raids  •  🛡️ Solo Keeper  •  💎 +25 Gems Reward',
      {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fef3c7',
      }
    ).setOrigin(0.5);

    const playTrial1Btn = this.add.container(0, -cardH / 2 + 375);
    const p1bg = this.add.graphics();
    p1bg.fillStyle(0xb45309, 1);
    p1bg.fillRoundedRect(-150, -24, 300, 48, 14);
    p1bg.fillStyle(0xd97706, 1);
    p1bg.fillRoundedRect(-150, -28, 300, 48, 14);
    const p1txt = this.add.text(0, -4, '⚔️  PLAY TRIAL 1', {
      fontFamily: FONT,
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    playTrial1Btn.add([p1bg, p1txt]);
    playTrial1Btn.setSize(300, 48).setInteractive({ useHandCursor: true });
    playTrial1Btn.on('pointerdown', () => {
      this.scene.start('Aviary', { level: 2 });
    });
    playTrial1Btn.on('pointerover', () => this.tweens.add({ targets: playTrial1Btn, scale: 1.04, duration: 100 }));
    playTrial1Btn.on('pointerout', () => this.tweens.add({ targets: playTrial1Btn, scale: 1.0, duration: 100 }));

    leftContainer.add([lg, lSection, lTitle, lBadge, eagleIcon, lDesc, lModBg, lModTxt, playTrial1Btn]);

    // --- CARD 2: SECRET TRIAL: NIGHT OF THE BATS ---
    const batHunter = save.achievements?.['bat_hunter'];
    const batClear = save.challenges?.['night_bats'] === 'completed';
    const isBatUnlocked =
      !!batHunter ||
      !!batClear ||
      save.challenges?.['night_bats_unlocked'] === 'unlocked' ||
      save.level >= 5;

    const rightX = W / 2 + cardW / 2 + 20;
    const rightContainer = this.add.container(rightX, cardY);
    const rg = this.add.graphics();
    rg.fillStyle(0x000000, 0.45);
    rg.fillRoundedRect(-cardW / 2 + 4, -cardH / 2 + 6, cardW, cardH, 18);

    if (!isBatUnlocked) {
      // Mystery Locked Card
      rg.fillStyle(0x0f0b17, 0.95);
      rg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
      rg.lineStyle(3, 0x4c1d95, 1);
      rg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);

      const rSec = this.add.text(0, -cardH / 2 + 26, '🔒 SECRET CHALLENGE', {
        fontFamily: FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#a855f7',
      }).setOrigin(0.5);

      const rTitle = this.add.text(0, -cardH / 2 + 56, '??? (Hidden Trial)', {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#94a3b8',
      }).setOrigin(0.5);

      const rBadge = this.add.text(0, -cardH / 2 + 90, 'LOCKED SECRET', {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ef4444',
      }).setOrigin(0.5);

      // Silhouette Icon with Padlock
      const lockSilhouette = this.add.image(0, -cardH / 2 + 145, 'enemy_bat').setScale(1.25).setTint(0x1e1528);
      const lockIcon = this.add.text(0, -cardH / 2 + 145, '🔒', { fontSize: '42px' }).setOrigin(0.5);

      const rDesc = this.add.text(
        0,
        -cardH / 2 + 225,
        'A shadowy nocturnal terror lurks in the midnight canopy.\n\nDefeat 5 swooping nocturnal bats in campaign combat to discover and unlock this secret trial!',
        {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#94a3b8',
          align: 'center',
          wordWrap: { width: cardW - 60 },
        }
      ).setOrigin(0.5);

      const rModBg = this.add.graphics();
      rModBg.fillStyle(0x181028, 0.9);
      rModBg.fillRoundedRect(-cardW / 2 + 30, -cardH / 2 + 280, cardW - 60, 48, 12);
      rModBg.lineStyle(1.5, 0x3b1d54, 0.7);
      rModBg.strokeRoundedRect(-cardW / 2 + 30, -cardH / 2 + 280, cardW - 60, 48, 12);

      const rModTxt = this.add.text(
        0,
        -cardH / 2 + 304,
        '🔒 Hidden Nocturnal Encounter  •  👑 Mystery Boss',
        {
          fontFamily: FONT,
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#64748b',
        }
      ).setOrigin(0.5);

      const lockBtn = this.add.container(0, -cardH / 2 + 375);
      const lbg = this.add.graphics();
      lbg.fillStyle(0x334155, 1);
      lbg.fillRoundedRect(-150, -24, 300, 48, 14);
      const ltxt = this.add.text(0, -4, '🔒  LOCKED', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#94a3b8',
      }).setOrigin(0.5);
      lockBtn.add([lbg, ltxt]);
      lockBtn.setSize(300, 48).setInteractive({ useHandCursor: true });
      lockBtn.on('pointerdown', () => {
        this.showLockedToast('Defeat 5 swooping bats in the campaign to unlock!');
      });

      rightContainer.add([rg, rSec, rTitle, rBadge, lockSilhouette, lockIcon, rDesc, rModBg, rModTxt, lockBtn]);
    } else {
      // Unlocked Secret Card
      rg.fillStyle(0x160e29, 0.95);
      rg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);
      rg.lineStyle(3, 0xc084fc, 1);
      rg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 18);

      const rSec = this.add.text(0, -cardH / 2 + 26, '🦇 SECRET CHALLENGE UNLOCKED!', {
        fontFamily: FONT,
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#c084fc',
      }).setOrigin(0.5);

      const rTitle = this.add.text(0, -cardH / 2 + 56, 'Night of the Bats', {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      const rBadge = this.add.text(0, -cardH / 2 + 90, batClear ? '✓ COMPLETED 🏆' : '✨ NEW TRIAL', {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: batClear ? '#4ade80' : '#fbbf24',
      }).setOrigin(0.5);

      const batIcon = this.add.image(0, -cardH / 2 + 145, 'enemy_bat').setScale(1.25);
      this.tweens.add({ targets: batIcon, y: -cardH / 2 + 140, duration: 900, yoyo: true, repeat: -1 });

      const rDesc = this.add.text(
        0,
        -cardH / 2 + 225,
        'The sun has set and deep darkness shrouds the forest canopy. Fend off incoming waves of fluttering Scout Bats, Shadow Bats, and slay the colossal Vampire Bat King!',
        {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#e2e8f0',
          align: 'center',
          wordWrap: { width: cardW - 60 },
        }
      ).setOrigin(0.5);

      const rModBg = this.add.graphics();
      rModBg.fillStyle(0x2a1742, 0.9);
      rModBg.fillRoundedRect(-cardW / 2 + 30, -cardH / 2 + 280, cardW - 60, 48, 12);
      rModBg.lineStyle(1.5, 0x9333ea, 0.7);
      rModBg.strokeRoundedRect(-cardW / 2 + 30, -cardH / 2 + 280, cardW - 60, 48, 12);

      const rModTxt = this.add.text(
        0,
        -cardH / 2 + 304,
        '🌙 Deep Midnight  •  🦇 Swooping Bats  •  💎 +35 Gems Reward',
        {
          fontFamily: FONT,
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#f3e8ff',
        }
      ).setOrigin(0.5);

      const playBatBtn = this.add.container(0, -cardH / 2 + 375);
      const pbg = this.add.graphics();
      pbg.fillStyle(0x6b21a8, 1);
      pbg.fillRoundedRect(-150, -24, 300, 48, 14);
      pbg.fillStyle(0x9333ea, 1);
      pbg.fillRoundedRect(-150, -28, 300, 48, 14);
      const ptxt = this.add.text(0, -4, '🦇  PLAY NIGHT CHALLENGE', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      playBatBtn.add([pbg, ptxt]);
      playBatBtn.setSize(300, 48).setInteractive({ useHandCursor: true });
      playBatBtn.on('pointerdown', () => {
        this.scene.start('Aviary', { challengeId: 'night_bats' });
      });
      playBatBtn.on('pointerover', () => this.tweens.add({ targets: playBatBtn, scale: 1.04, duration: 100 }));
      playBatBtn.on('pointerout', () => this.tweens.add({ targets: playBatBtn, scale: 1.0, duration: 100 }));

      rightContainer.add([rg, rSec, rTitle, rBadge, batIcon, rDesc, rModBg, rModTxt, playBatBtn]);
    }

    this.createBackButton();
  }

  // =========================================================================
  // VIEW 8: TIME TRIAL STAGE SELECT
  // =========================================================================
  private renderTimeTrialSelect() {
    this.createHeaderPill(
      'TIME TRIAL: 5-MINUTE RUSH ⏱️',
      'Race against the clock on unlocked campaign stages to establish coin high scores!'
    );

    const save = loadSave();
    const rightW = 800;
    const rightH = 500;
    const cardY = 360;

    const container = this.add.container(W / 2, cardY);
    const rg = this.add.graphics();
    rg.fillStyle(0x000000, 0.45);
    rg.fillRoundedRect(-rightW / 2 + 4, -rightH / 2 + 6, rightW, rightH, 20);
    rg.fillStyle(0x1e293b, 0.96);
    rg.fillRoundedRect(-rightW / 2, -rightH / 2, rightW, rightH, 20);
    rg.lineStyle(3, 0xf59e0b, 1);
    rg.strokeRoundedRect(-rightW / 2, -rightH / 2, rightW, rightH, 20);

    const rSub = this.add.text(
      0,
      -rightH / 2 + 32,
      '5-Minute Coin Frenzy • Survive, keep sparrows well-fed, and maximize your coin yield!',
      {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#fbbf24',
      }
    ).setOrigin(0.5);

    container.add([rg, rSub]);

    // Stage rows (displaying World 1 stages 1-4, plus any unlocked higher worlds)
    const maxStagesToShow = Math.min(8, this.maxUnlockedLevel);
    const rowStartY = -rightH / 2 + 80;
    const rowGap = 72;

    for (let stgIdx = 0; stgIdx < maxStagesToShow; stgIdx++) {
      const flatLevel = stgIdx + 1;
      const ws = getWorldAndStage(flatLevel);
      const stageScore = save.timeTrialScores?.[flatLevel] ?? 0;

      const rowC = this.add.container(0, rowStartY + stgIdx * rowGap);
      const rbg = this.add.graphics();
      rbg.fillStyle(0x0f172a, 0.85);
      rbg.fillRoundedRect(-rightW / 2 + 30, -26, rightW - 60, 56, 12);
      rbg.lineStyle(1.5, 0x334155, 1);
      rbg.strokeRoundedRect(-rightW / 2 + 30, -26, rightW - 60, 56, 12);

      const stgTitle = this.add.text(
        -rightW / 2 + 55,
        -16,
        `World ${ws.worldId}-${ws.stageNum}: ${ws.stage.name}`,
        {
          fontFamily: FONT,
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ffffff',
        }
      );

      const scoreTxt = this.add.text(
        -rightW / 2 + 55,
        8,
        stageScore > 0 ? `⏱️ High Score: ${stageScore} Coins` : '⏱️ Record: None Yet',
        {
          fontFamily: FONT,
          fontSize: '13px',
          color: stageScore > 0 ? '#38bdf8' : '#94a3b8',
        }
      );

      const launchBtn = this.add.container(rightW / 2 - 110, 0);
      const lbg = this.add.graphics();
      lbg.fillStyle(0x166534, 1);
      lbg.fillRoundedRect(-70, -18, 140, 36, 10);
      lbg.fillStyle(0x22c55e, 1);
      lbg.fillRoundedRect(-70, -21, 140, 36, 10);
      const ltxt = this.add.text(0, -3, 'START ⏱️', {
        fontFamily: FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      launchBtn.add([lbg, ltxt]);
      launchBtn.setSize(140, 36).setInteractive({ useHandCursor: true });
      launchBtn.on('pointerdown', () => {
        this.scene.start('Aviary', { timeTrial: true, level: flatLevel });
      });
      launchBtn.on('pointerover', () => this.tweens.add({ targets: launchBtn, scale: 1.06, duration: 80 }));
      launchBtn.on('pointerout', () => this.tweens.add({ targets: launchBtn, scale: 1.0, duration: 80 }));

      rowC.add([rbg, stgTitle, scoreTxt, launchBtn]);
      container.add(rowC);
    }

    this.createBackButton();
  }

  // =========================================================================
  // VIEW 8: AVIAN HALL OF ACHIEVEMENTS
  // =========================================================================
  private renderAchievements() {
    const stats = getUnlockedCount();
    this.createHeaderPill(
      'AVIAN HALL OF ACHIEVEMENTS 🏆',
      `${stats.unlocked} of ${stats.total} Completed  •  ${stats.totalGemsEarned} 💎 Gems Collected`
    );

    const save = loadSave();
    const map = save.achievements || {};

    // 3 columns of 5 cards (15 achievements)
    const cardW = 380;
    const cardH = 76;
    const startX = 230;
    const gapX = 410;
    const startY = 175;
    const gapY = 88;

    ACHIEVEMENTS.forEach((a, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = startX + col * gapX;
      const cy = startY + row * gapY;

      const isUnlocked = !!map[a.id];
      const card = this.add.container(cx, cy);

      const g = this.add.graphics();
      // Drop Shadow
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(-cardW / 2 + 3, -cardH / 2 + 4, cardW, cardH, 14);

      // Card Background
      g.fillStyle(isUnlocked ? 0x1f293d : 0x14121b, 0.95);
      g.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
      g.lineStyle(2, isUnlocked ? 0xf59e0b : 0x334155, 1);
      g.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);

      // Left Icon
      const iconTxt = this.add.text(-cardW / 2 + 32, 0, a.icon, {
        fontFamily: FONT,
        fontSize: '30px',
      }).setOrigin(0.5);

      // Title
      const titleTxt = this.add.text(-cardW / 2 + 62, -22, a.title, {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: isUnlocked ? '#ffffff' : '#94a3b8',
      });

      // Description
      const descTxt = this.add.text(-cardW / 2 + 62, 1, a.desc, {
        fontFamily: FONT,
        fontSize: '11px',
        color: isUnlocked ? '#cbd5e1' : '#64748b',
        wordWrap: { width: cardW - 135 },
      });

      // Status Tag on right
      const tagBg = this.add.graphics();
      tagBg.fillStyle(isUnlocked ? 0x064e3b : 0x1e1b2e, 0.9);
      tagBg.fillRoundedRect(cardW / 2 - 76, -16, 68, 32, 8);
      tagBg.lineStyle(1, isUnlocked ? 0x10b981 : 0x475569, 1);
      tagBg.strokeRoundedRect(cardW / 2 - 76, -16, 68, 32, 8);

      const tagTxt = this.add.text(
        cardW / 2 - 42,
        0,
        isUnlocked ? `✓ +${a.gemReward}💎` : `+${a.gemReward}💎`,
        {
          fontFamily: FONT,
          fontSize: '11px',
          fontStyle: 'bold',
          color: isUnlocked ? '#34d399' : '#94a3b8',
        }
      ).setOrigin(0.5);

      card.add([g, iconTxt, titleTxt, descTxt, tagBg, tagTxt]);
    });

    this.createBackButton();
  }
}
