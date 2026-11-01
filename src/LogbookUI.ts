import Phaser from 'phaser';
import { ALLY_ENTRIES, BIRD_ENTRIES, ENEMY_ENTRIES, AllyLogEntry, BirdLogEntry, EnemyLogEntry } from './LogbookData';
import { loadSave } from './data';

const FONT = 'Trebuchet MS, Verdana, sans-serif';

export type LogbookTab = 'birds' | 'allies' | 'enemies';

export interface LogbookOptions {
  onClose: () => void;
  isModal?: boolean;
  initialTab?: LogbookTab;
}

export class LogbookUI {
  private container: Phaser.GameObjects.Container;
  private currentTab: LogbookTab = 'birds';
  private selectedIndex = 0;
  private pageIndex = 0;
  private readonly itemsPerPage = 5;
  private detailContainer?: Phaser.GameObjects.Container;
  private listContainer?: Phaser.GameObjects.Container;
  private tabButtons: { tab: LogbookTab; container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text }[] = [];
  private saveLevel = 1;

  constructor(private scene: Phaser.Scene, private options: LogbookOptions) {
    const save = loadSave();
    this.saveLevel = Math.max(1, save.level ?? 1);
    this.currentTab = options.initialTab ?? 'birds';

    const W = scene.scale.width;
    const H = scene.scale.height;
    const depth = options.isModal ? 80 : 20;

    this.container = scene.add.container(0, 0).setDepth(depth);

    // Dark backdrop overlay
    const bg = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, options.isModal ? 0.78 : 0.88).setInteractive();
    this.container.add(bg);

    // Main Field Guide Leather Book Frame
    const frameW = Math.min(980, W - 32);
    const frameH = Math.min(526, H - 32);
    const frameX = W / 2 - frameW / 2;
    const frameY = H / 2 - frameH / 2;

    const bookGfx = scene.add.graphics();
    // Shadow
    bookGfx.fillStyle(0x000000, 0.5);
    bookGfx.fillRoundedRect(frameX + 6, frameY + 8, frameW, frameH, 20);

    // Outer rich leather border
    bookGfx.fillStyle(0x23140a, 0.98);
    bookGfx.fillRoundedRect(frameX, frameY, frameW, frameH, 20);
    bookGfx.lineStyle(3, 0xd97706, 0.9);
    bookGfx.strokeRoundedRect(frameX, frameY, frameW, frameH, 20);

    // Inner parchment trim
    bookGfx.fillStyle(0x19212d, 0.95);
    bookGfx.fillRoundedRect(frameX + 10, frameY + 68, frameW - 20, frameH - 78, 14);
    bookGfx.lineStyle(1.5, 0x475569, 0.7);
    bookGfx.strokeRoundedRect(frameX + 10, frameY + 68, frameW - 20, frameH - 78, 14);

    this.container.add(bookGfx);

    // Top Header
    const titleText = scene.add.text(frameX + 28, frameY + 22, '📖 AVIARY LOGBOOK & FIELD GUIDE', {
      fontFamily: FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffd54f',
    });
    const subText = scene.add.text(frameX + 28, frameY + 46, 'Comprehensive dossier of flock species, rescued companion allies, and canopy predators', {
      fontFamily: FONT,
      fontSize: '12px',
      color: '#cbd5e1',
    });
    this.container.add([titleText, subText]);

    // Close Button (Top-Right)
    const closeBtn = scene.add.container(frameX + frameW - 42, frameY + 34);
    const cbg = scene.add.graphics();
    cbg.fillStyle(0x991b1b, 0.9);
    cbg.fillCircle(0, 0, 18);
    cbg.lineStyle(2, 0xfca5a5, 1);
    cbg.strokeCircle(0, 0, 18);
    const ctxt = scene.add.text(0, 0, '✕', {
      fontFamily: FONT,
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    closeBtn.add([cbg, ctxt]);
    closeBtn.setSize(36, 36).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.destroy());
    closeBtn.on('pointerover', () => scene.tweens.add({ targets: closeBtn, scale: 1.15, duration: 100 }));
    closeBtn.on('pointerout', () => scene.tweens.add({ targets: closeBtn, scale: 1.0, duration: 100 }));
    this.container.add(closeBtn);

    // Navigation Tabs Bar
    this.buildTabs(frameX + 420, frameY + 24);

    // Directory list container (Left side)
    this.listContainer = scene.add.container(frameX + 20, frameY + 80);
    this.container.add(this.listContainer);

    // Detail dossier container (Right side)
    this.detailContainer = scene.add.container(frameX + 400, frameY + 80);
    this.container.add(this.detailContainer);

    // Render initial data
    this.renderCurrentTab();
  }

  private buildTabs(startX: number, startY: number) {
    const tabs: { key: LogbookTab; label: string; count: number }[] = [
      { key: 'birds', label: '🕊️ BIRDS', count: BIRD_ENTRIES.length },
      { key: 'allies', label: '🐾 ALLIES', count: ALLY_ENTRIES.length },
      { key: 'enemies', label: '⚔️ ENEMIES', count: ENEMY_ENTRIES.length },
    ];

    const tabW = 145;
    const tabH = 34;

    tabs.forEach((t, idx) => {
      const tx = startX + idx * (tabW + 8);
      const tc = this.scene.add.container(tx, startY);

      const g = this.scene.add.graphics();
      const txt = this.scene.add.text(tabW / 2, tabH / 2, `${t.label} (${t.count})`, {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      tc.add([g, txt]);
      tc.setSize(tabW, tabH).setInteractive({ useHandCursor: true });
      tc.on('pointerdown', () => {
        if (this.currentTab === t.key) return;
        this.currentTab = t.key;
        this.selectedIndex = 0;
        this.pageIndex = 0;
        this.updateTabStyles();
        this.renderCurrentTab();
      });

      this.tabButtons.push({ tab: t.key, container: tc, bg: g, txt });
      this.container.add(tc);
    });

    this.updateTabStyles();
  }

  private updateTabStyles() {
    const tabW = 145;
    const tabH = 34;

    this.tabButtons.forEach((b) => {
      const active = b.tab === this.currentTab;
      b.bg.clear();
      if (active) {
        b.bg.fillStyle(0xd97706, 0.95);
        b.bg.fillRoundedRect(0, 0, tabW, tabH, 8);
        b.bg.lineStyle(2, 0xfef08a, 1);
        b.bg.strokeRoundedRect(0, 0, tabW, tabH, 8);
        b.txt.setColor('#1c1917');
      } else {
        b.bg.fillStyle(0x334155, 0.8);
        b.bg.fillRoundedRect(0, 0, tabW, tabH, 8);
        b.bg.lineStyle(1.5, 0x64748b, 0.7);
        b.bg.strokeRoundedRect(0, 0, tabW, tabH, 8);
        b.txt.setColor('#cbd5e1');
      }
    });
  }

  private getActiveList(): (BirdLogEntry | AllyLogEntry | EnemyLogEntry)[] {
    if (this.currentTab === 'birds') return BIRD_ENTRIES;
    if (this.currentTab === 'allies') return ALLY_ENTRIES;
    return ENEMY_ENTRIES;
  }

  private renderCurrentTab() {
    this.renderList();
    this.renderDetail();
  }

  private renderList() {
    if (!this.listContainer) return;
    const listC = this.listContainer;
    listC.removeAll(true);

    const list = this.getActiveList();
    const totalPages = Math.ceil(list.length / this.itemsPerPage);
    const startIdx = this.pageIndex * this.itemsPerPage;
    const pageItems = list.slice(startIdx, startIdx + this.itemsPerPage);

    const cardW = 360;
    const cardH = 74;
    const gapY = 8;

    pageItems.forEach((item, i) => {
      const globalIdx = startIdx + i;
      const isSelected = globalIdx === this.selectedIndex;
      const cy = i * (cardH + gapY);

      const card = this.scene.add.container(0, cy);
      const g = this.scene.add.graphics();

      // Card Background
      if (isSelected) {
        g.fillStyle(0x3b82f6, 0.25);
        g.fillRoundedRect(0, 0, cardW, cardH, 10);
        g.lineStyle(2, 0x60a5fa, 1);
        g.strokeRoundedRect(0, 0, cardW, cardH, 10);
      } else {
        g.fillStyle(0x1e293b, 0.85);
        g.fillRoundedRect(0, 0, cardW, cardH, 10);
        g.lineStyle(1, 0x334155, 0.8);
        g.strokeRoundedRect(0, 0, cardW, cardH, 10);
      }

      // Thumbnail background circle
      g.fillStyle(0x0f172a, 0.9);
      g.fillCircle(38, cardH / 2, 26);
      g.lineStyle(1.5, isSelected ? 0x93c5fd : 0x475569, 0.8);
      g.strokeCircle(38, cardH / 2, 26);

      // Sprite Avatar
      let icon: Phaser.GameObjects.GameObject;
      const spriteKey = (item as any).spriteKey;
      if (this.scene.textures.exists(spriteKey)) {
        const img = this.scene.add.image(38, cardH / 2, spriteKey);
        const maxDim = Math.max(img.width, img.height);
        const targetSize = 42;
        const scale = maxDim > 0 ? targetSize / maxDim : 0.8;
        img.setScale(scale);
        icon = img;
      } else {
        icon = this.scene.add.text(38, cardH / 2, '🐦', { fontSize: '24px' }).setOrigin(0.5);
      }

      // Titles & Badges
      let titleStr = item.name;
      let badgeStr = '';
      let badgeCol = '#38bdf8';

      if (this.currentTab === 'birds') {
        const b = item as BirdLogEntry;
        badgeStr = b.subtitle;
        badgeCol = b.category === 'Evolution' ? '#4ade80' : b.category === 'Legendary' ? '#f59e0b' : '#38bdf8';
      } else if (this.currentTab === 'allies') {
        const a = item as AllyLogEntry;
        const isUnlocked = this.saveLevel >= a.stageReq;
        badgeStr = isUnlocked ? `Unlocked • ${a.worldStage}` : `Locked (Beat ${a.worldStage})`;
        badgeCol = isUnlocked ? '#34d399' : '#f87171';
      } else {
        const e = item as EnemyLogEntry;
        badgeStr = `${'★'.repeat(e.dangerStars)} • ${e.worldHabitat.split(':')[0]}`;
        badgeCol = e.dangerStars >= 5 ? '#ef4444' : e.dangerStars >= 4 ? '#f97316' : '#eab308';
      }

      const titleTxt = this.scene.add.text(76, 14, titleStr, {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: isSelected ? '#ffffff' : '#e2e8f0',
      });

      const badgeTxt = this.scene.add.text(76, 36, badgeStr, {
        fontFamily: FONT,
        fontSize: '11px',
        fontStyle: 'bold',
        color: badgeCol,
      });

      // Quick hint line
      let hintStr = '';
      if (this.currentTab === 'birds') hintStr = (item as BirdLogEntry).diet;
      else if (this.currentTab === 'allies') hintStr = (item as AllyLogEntry).title;
      else hintStr = (item as EnemyLogEntry).threatType;

      const hintTxt = this.scene.add.text(76, 52, hintStr, {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#94a3b8',
      });

      card.add([g, icon, titleTxt, badgeTxt, hintTxt]);
      card.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        this.selectedIndex = globalIdx;
        this.renderList();
        this.renderDetail();
      });

      listC.add(card);
    });

    // Pagination Row at bottom of list
    const pagY = 412;
    const pagC = this.scene.add.container(0, pagY);

    const prevBtn = this.scene.add.text(10, 0, '◀ PREV', {
      fontFamily: FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: this.pageIndex > 0 ? '#fbbf24' : '#64748b',
    }).setOrigin(0, 0.5);

    if (this.pageIndex > 0) {
      prevBtn.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.pageIndex--;
        this.renderList();
      });
    }

    const nextBtn = this.scene.add.text(cardW - 10, 0, 'NEXT ▶', {
      fontFamily: FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: this.pageIndex < totalPages - 1 ? '#fbbf24' : '#64748b',
    }).setOrigin(1, 0.5);

    if (this.pageIndex < totalPages - 1) {
      nextBtn.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.pageIndex++;
        this.renderList();
      });
    }

    const pageIndicator = this.scene.add.text(cardW / 2, 0, `Page ${this.pageIndex + 1} of ${totalPages}`, {
      fontFamily: FONT,
      fontSize: '12px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    pagC.add([prevBtn, nextBtn, pageIndicator]);
    listC.add(pagC);
  }

  private renderDetail() {
    if (!this.detailContainer) return;
    const detailC = this.detailContainer;
    detailC.removeAll(true);

    const list = this.getActiveList();
    const item = list[this.selectedIndex] ?? list[0];
    if (!item) return;

    const panelW = 530;
    const panelH = 432;

    const g = this.scene.add.graphics();
    // Inner parchment card
    g.fillStyle(0x0f172a, 0.95);
    g.fillRoundedRect(0, 0, panelW, panelH, 12);
    g.lineStyle(1.5, 0x334155, 0.9);
    g.strokeRoundedRect(0, 0, panelW, panelH, 12);

    // Hero Avatar Pedestal (Top-Left of detail card)
    const pedX = 80;
    const pedY = 82;
    g.fillStyle(0x1e293b, 0.9);
    g.fillEllipse(pedX, pedY + 36, 110, 32);
    g.lineStyle(1.5, 0x475569, 0.8);
    g.strokeEllipse(pedX, pedY + 36, 110, 32);

    detailC.add(g);

    // Avatar Graphic / Sprite
    const spriteKey = (item as any).spriteKey;
    const animKey = (item as any).animKey;
    const hasCrown = (item as any).hasCrown;

    if (animKey && this.scene.anims.exists(animKey)) {
      const spr = this.scene.add.sprite(pedX, pedY, animKey).play(animKey);
      spr.setScale((item as any).scale ?? 0.85);
      detailC.add(spr);
      if (hasCrown && this.scene.textures.exists('crown')) {
        const crown = this.scene.add.image(pedX + 4, pedY - 36, 'crown').setScale(0.85).setRotation(0.2);
        detailC.add(crown);
      }
    } else if (this.scene.textures.exists(spriteKey)) {
      const img = this.scene.add.image(pedX, pedY, spriteKey);
      const maxDim = Math.max(img.width, img.height);
      const targetSize = 82;
      const scale = maxDim > 0 ? targetSize / maxDim : 1.0;
      img.setScale(scale);
      detailC.add(img);
      if (hasCrown && this.scene.textures.exists('crown')) {
        const crown = this.scene.add.image(pedX + 4, pedY - 36, 'crown').setScale(0.85).setRotation(0.2);
        detailC.add(crown);
      }
    }

    // Title & Header Information (Top-Right of detail card)
    const infoX = 160;
    const titleTxt = this.scene.add.text(infoX, 22, item.name, {
      fontFamily: FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffd54f',
    });

    let subtitleStr = '';
    let categoryBadge = '';
    let categoryCol = '#38bdf8';

    if (this.currentTab === 'birds') {
      const b = item as BirdLogEntry;
      subtitleStr = b.subtitle;
      categoryBadge = b.category.toUpperCase();
      categoryCol = b.category === 'Evolution' ? '#4ade80' : b.category === 'Legendary' ? '#f59e0b' : '#38bdf8';
    } else if (this.currentTab === 'allies') {
      const a = item as AllyLogEntry;
      subtitleStr = a.title;
      const isUnlocked = this.saveLevel >= a.stageReq;
      categoryBadge = isUnlocked ? 'ACTIVE ALLY' : `LOCKED (BEAT ${a.worldStage})`;
      categoryCol = isUnlocked ? '#34d399' : '#f87171';
    } else {
      const e = item as EnemyLogEntry;
      subtitleStr = e.title;
      categoryBadge = `DANGER LEVEL: ${'★'.repeat(e.dangerStars)}`;
      categoryCol = e.dangerStars >= 5 ? '#ef4444' : e.dangerStars >= 4 ? '#f97316' : '#eab308';
    }

    const subTxt = this.scene.add.text(infoX, 50, subtitleStr, {
      fontFamily: FONT,
      fontSize: '13px',
      color: '#cbd5e1',
    });

    const badgeTxt = this.scene.add.text(infoX, 70, categoryBadge, {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: categoryCol,
    });

    detailC.add([titleTxt, subTxt, badgeTxt]);

    // Data Stats Grid (Y: 135 to 220)
    const statsY = 135;
    const statBoxG = this.scene.add.graphics();
    statBoxG.fillStyle(0x1e293b, 0.7);
    statBoxG.fillRoundedRect(20, statsY, panelW - 40, 80, 8);
    statBoxG.lineStyle(1, 0x334155, 0.8);
    statBoxG.strokeRoundedRect(20, statsY, panelW - 40, 80, 8);
    detailC.add(statBoxG);

    if (this.currentTab === 'birds') {
      const b = item as BirdLogEntry;
      this.renderStatPair(32, statsY + 12, 'DIET', b.diet);
      this.renderStatPair(270, statsY + 12, 'DROPS', b.drops);
      this.renderStatPair(32, statsY + 46, 'BEHAVIOR', b.behavior);
      this.renderStatPair(270, statsY + 46, 'CLASSIFICATION', b.category);
    } else if (this.currentTab === 'allies') {
      const a = item as AllyLogEntry;
      const isUnlocked = this.saveLevel >= a.stageReq;
      this.renderStatPair(32, statsY + 12, 'UNLOCKED AT', a.worldStage);
      this.renderStatPair(270, statsY + 12, 'STATUS', isUnlocked ? '✅ Unlocked & Available' : `🔒 Requires Stage ${a.worldStage}`);
      this.renderStatPair(32, statsY + 46, 'TACTICAL ROLE', a.title);
      this.renderStatPair(270, statsY + 46, 'PRIMARY ABILITY', a.ability.slice(0, 32) + '...');
    } else {
      const e = item as EnemyLogEntry;
      this.renderStatPair(32, statsY + 12, 'BASE HEALTH', e.hpRange);
      this.renderStatPair(270, statsY + 12, 'HABITAT', e.worldHabitat);
      this.renderStatPair(32, statsY + 46, 'THREAT PROFILE', e.threatType);
      this.renderStatPair(270, statsY + 46, 'WEAKNESS', 'Slingshot & Precision Timing');
    }

    // Lore & Narrative Section (Y: 228 to 305)
    let loreStr = '';
    if (this.currentTab === 'birds') loreStr = (item as BirdLogEntry).lore;
    else if (this.currentTab === 'allies') loreStr = (item as AllyLogEntry).lore;
    else loreStr = (item as EnemyLogEntry).description;

    const loreTitle = this.scene.add.text(20, 226, 'FIELD OBSERVATIONS & LORE', {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#94a3b8',
    });

    const loreBody = this.scene.add.text(20, 244, loreStr, {
      fontFamily: FONT,
      fontSize: '12px',
      color: '#f1f5f9',
      wordWrap: { width: panelW - 40, useAdvancedWrap: true },
      lineSpacing: 3,
    });
    detailC.add([loreTitle, loreBody]);

    // Strategic Advice Box (Y: 318 to 415)
    const stratY = 320;
    const stratBoxG = this.scene.add.graphics();
    stratBoxG.fillStyle(0x172554, 0.85);
    stratBoxG.fillRoundedRect(20, stratY, panelW - 40, 96, 8);
    stratBoxG.lineStyle(1.5, 0x3b82f6, 0.9);
    stratBoxG.strokeRoundedRect(20, stratY, panelW - 40, 96, 8);
    detailC.add(stratBoxG);

    let stratTitle = '';
    let stratBody = '';
    if (this.currentTab === 'birds') {
      stratTitle = '💡 FLOCK CARE & NURTURING';
      stratBody = (item as BirdLogEntry).fieldTips;
    } else if (this.currentTab === 'allies') {
      stratTitle = '🛡️ COMPANION TACTICAL SYNERGY';
      stratBody = (item as AllyLogEntry).tactics;
    } else {
      stratTitle = '⚔️ SURVIVAL COUNTER-STRATEGY';
      stratBody = (item as EnemyLogEntry).weaknessStrategy;
    }

    const stTitleTxt = this.scene.add.text(32, stratY + 10, stratTitle, {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#fbbf24',
    });

    const stBodyTxt = this.scene.add.text(32, stratY + 30, stratBody, {
      fontFamily: FONT,
      fontSize: '12px',
      color: '#e2e8f0',
      wordWrap: { width: panelW - 64, useAdvancedWrap: true },
      lineSpacing: 3,
    });
    detailC.add([stTitleTxt, stBodyTxt]);
  }

  private renderStatPair(x: number, y: number, label: string, value: string) {
    const detailC = this.detailContainer;
    if (!detailC) return;
    const lbl = this.scene.add.text(x, y, label, {
      fontFamily: FONT,
      fontSize: '9.5px',
      fontStyle: 'bold',
      color: '#94a3b8',
    });
    const val = this.scene.add.text(x, y + 14, value, {
      fontFamily: FONT,
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });
    detailC.add([lbl, val]);
  }

  public destroy() {
    this.container.destroy();
    this.options.onClose();
  }
}
