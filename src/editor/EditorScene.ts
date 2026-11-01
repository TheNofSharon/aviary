import Phaser from 'phaser';
import {
  drawBranchLeaves,
  drawTreeCrownFront,
  drawStandaloneLeafCluster,
  renderWholeTreeStructure,
} from '../BranchFoliage';
import { makeTextures } from '../art';
import {
  LevelLayoutDef,
  TreeDef,
  BranchDef,
  FreePerchDef,
  LeafClusterDef,
  SceneryItemDef,
  TreeStyle,
  getTrunkEdgeAtY,
} from '../LevelDesignData';
import { themeFor, getWorldAndStage } from '../data';

export type SelectionType = 'tree' | 'branch' | 'nest' | 'freePerch' | 'leafCluster' | 'scenery' | 'none';

export interface SelectionInfo {
  type: SelectionType;
  treeIndex?: number;
  branchIndex?: number;
  freePerchIndex?: number;
  leafClusterIndex?: number;
  sceneryIndex?: number;
}

export class EditorScene extends Phaser.Scene {
  public layout!: LevelLayoutDef;
  public selection: SelectionInfo = { type: 'none' };
  public onSelectionChanged?: (sel: SelectionInfo) => void;
  public onLayoutModified?: () => void;
  public onCameraChanged?: () => void;

  public isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private lastMiddleClickTime = 0;

  private bgGfx!: Phaser.GameObjects.Graphics;
  private canopyGfx!: Phaser.GameObjects.Graphics;
  private trunkGfx!: Phaser.GameObjects.Graphics;
  private fgGfx!: Phaser.GameObjects.Graphics;
  private gizmoGfx!: Phaser.GameObjects.Graphics;
  private sceneryImages: Phaser.GameObjects.Image[] = [];
  private gizmoHandles: Phaser.GameObjects.Container[] = [];
  private treeContextGizmos: { treeIndex: number; handles: Phaser.GameObjects.Container[] }[] = [];

  constructor() {
    super('EditorScene');
  }

  create() {
    makeTextures(this);

    this.bgGfx = this.add.graphics().setDepth(0);
    this.trunkGfx = this.add.graphics().setDepth(2);
    this.canopyGfx = this.add.graphics().setDepth(3);
    this.fgGfx = this.add.graphics().setDepth(4);
    this.gizmoGfx = this.add.graphics().setDepth(100);

    this.renderAll();

    // 1. Scroll Wheel Zoom (Centered on mouse cursor)
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _gameObjects: any[], _deltaX: number, deltaY: number) => {
      const camera = this.cameras.main;
      const oldZoom = camera.zoom;
      // Exponential scaling: smooth on trackpads, responsive on stepped mouse wheels
      const rawFactor = Math.pow(0.998, deltaY);
      const factor = Phaser.Math.Clamp(rawFactor, 0.75, 1.35);
      const newZoom = Phaser.Math.Clamp(oldZoom * factor, 0.35, 4.0);
      if (Math.abs(newZoom - oldZoom) < 0.0005) return;

      const worldBefore = camera.getWorldPoint(pointer.x, pointer.y);
      camera.setZoom(newZoom);
      const worldAfter = camera.getWorldPoint(pointer.x, pointer.y);
      camera.scrollX += (worldBefore.x - worldAfter.x);
      camera.scrollY += (worldBefore.y - worldAfter.y);

      this.onCameraChanged?.();
    });

    // Space key indicator
    const spaceKey = this.input.keyboard?.addKey('SPACE');
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!this.isPanning && this.game.canvas) {
        this.game.canvas.style.cursor = 'grab';
      }
    });
    this.input.keyboard?.on('keyup-SPACE', () => {
      if (!this.isPanning && this.game.canvas) {
        this.game.canvas.style.cursor = 'default';
      }
    });

    // 2. Click scrollwheel (button === 1) or Space + Left-Drag to Pan
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const isMiddle = pointer.button === 1 || pointer.middleButtonDown();
      const isSpaceLeft = (spaceKey?.isDown ?? false) && pointer.button === 0;

      if (isMiddle || isSpaceLeft) {
        const now = Date.now();
        // Double middle click resets view
        if (isMiddle && (now - this.lastMiddleClickTime < 320)) {
          this.resetView();
          this.lastMiddleClickTime = 0;
          return;
        }
        if (isMiddle) {
          this.lastMiddleClickTime = now;
        }

        this.isPanning = true;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
        if (this.game.canvas) this.game.canvas.style.cursor = 'grabbing';
        return;
      }

      // Left click deselect if empty area clicked
      if (pointer.button === 0) {
        const hit = this.input.hitTestPointer(pointer);
        if (hit.length === 0) {
          this.select({ type: 'none' });
        }
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isPanning) {
        const camera = this.cameras.main;
        const dx = (pointer.x - this.panStartX) / camera.zoom;
        const dy = (pointer.y - this.panStartY) / camera.zoom;
        camera.scrollX -= dx;
        camera.scrollY -= dy;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
        this.onCameraChanged?.();
      }
    });

    const stopPanning = () => {
      if (this.isPanning) {
        this.isPanning = false;
        if (this.game.canvas) {
          this.game.canvas.style.cursor = (spaceKey?.isDown ?? false) ? 'grab' : 'default';
        }
      }
    };

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 || !pointer.middleButtonDown()) {
        stopPanning();
      }
    });

    // Window listeners so panning never gets stuck if mouse is released outside canvas
    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 1 || e.button === 0) {
        stopPanning();
      }
    });
    window.addEventListener('blur', () => {
      stopPanning();
    });

    // Guard: dragstart should never drag items when middle button is down
    this.input.on('dragstart', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || this.isPanning) {
        this.input.setDragState(pointer, 0);
      }
    });

    // DOM event guards to prevent browser scrolling and middle click autoscroll icon
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1) e.preventDefault();
      });
      canvas.addEventListener('auxclick', (e) => {
        if (e.button === 1) e.preventDefault();
      });
      canvas.addEventListener('contextmenu', (e) => {
        if (e.button === 1) e.preventDefault();
      });
    }
  }

  public resetView() {
    const camera = this.cameras.main;
    camera.setZoom(1.0);
    camera.centerOn(1280 / 2, 720 / 2);
    this.onCameraChanged?.();
  }

  public setLayout(layout: LevelLayoutDef) {
    this.layout = layout;
    this.select({ type: 'none' });
    this.renderAll();
  }

  public select(sel: SelectionInfo) {
    this.selection = sel;
    this.updateSelectionGizmos();
    this.updateGizmoVisuals();
    this.onSelectionChanged?.(sel);
  }

  public updateSelectionGizmos() {
    const isTree = this.selection.type === 'tree';
    const selTreeIdx = this.selection.treeIndex;

    this.treeContextGizmos.forEach(({ treeIndex, handles }) => {
      const isSel = isTree && selTreeIdx === treeIndex;
      for (const h of handles) {
        h.setVisible(isSel);
        if (h.input) h.input.enabled = isSel;
      }
    });
  }

  public renderAll() {
    if (!this.layout) return;
    this.renderBackground();
    this.renderScenery();
    this.renderTrees();
    this.buildGizmos();
    this.updateGizmoVisuals();
  }

  private renderBackground() {
    const W = 1280;
    const g = this.bgGfx;
    g.clear();

    const worldId = this.layout.worldId ?? 1;
    const th = themeFor((worldId - 1) * 4 + 1);

    // 1. Sky Gradient
    g.fillGradientStyle(th.sky1, th.sky1, th.sky2, th.sky2, 1);
    g.fillRect(0, 0, W, 580);

    // 2. Sun & Godrays
    g.fillStyle(th.sun, 0.2);
    g.fillCircle(170, 110, 120);
    g.fillStyle(th.sun, 0.5);
    g.fillCircle(170, 110, 60);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(170, 110, 30);

    // 3. Mountains & Hills
    g.fillStyle(th.hillFar, 0.55);
    g.fillPoints([
      new Phaser.Math.Vector2(0, 560),
      new Phaser.Math.Vector2(0, 485),
      new Phaser.Math.Vector2(140, 415),
      new Phaser.Math.Vector2(290, 465),
      new Phaser.Math.Vector2(460, 395),
      new Phaser.Math.Vector2(640, 450),
      new Phaser.Math.Vector2(810, 385),
      new Phaser.Math.Vector2(970, 435),
      new Phaser.Math.Vector2(1130, 400),
      new Phaser.Math.Vector2(W, 465),
      new Phaser.Math.Vector2(W, 560),
    ], true);

    g.fillStyle(th.hillFar, 0.9);
    g.fillEllipse(280, 560, 850, 190);
    g.fillEllipse(960, 570, 920, 200);

    g.fillStyle(th.hillNear, 1);
    g.fillEllipse(120, 620, 720, 170);
    g.fillEllipse(640, 630, 860, 160);
    g.fillEllipse(1140, 620, 720, 170);

    // 4. Ground Floor
    g.fillStyle(th.ground, 1);
    g.fillRect(0, 580, W, 48);
    g.fillStyle(th.ground2, 1);
    g.fillRect(0, 598, W, 28);
  }

  private renderScenery() {
    for (const img of this.sceneryImages) img.destroy();
    this.sceneryImages = [];

    this.layout.scenery.forEach((sc, scIdx) => {
      const img = this.add.image(sc.x, sc.y, sc.texture)
        .setDepth(sc.depth ?? 1)
        .setScale(sc.scale ?? 1.0)
        .setFlipX(!!sc.flipX)
        .setInteractive({ useHandCursor: true, draggable: true });

      img.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0) return;
        p.event.stopPropagation();
        this.select({ type: 'scenery', sceneryIndex: scIdx });
      });

      img.on('drag', (p: Phaser.Input.Pointer, dx: number, dy: number) => {
        if (p.button !== 0 || this.isPanning) return;
        sc.x = Math.round(Phaser.Math.Clamp(dx, 20, 1260));
        sc.y = Math.round(Phaser.Math.Clamp(dy, 80, 640));
        img.setPosition(sc.x, sc.y);
        this.updateGizmoVisuals();
        this.onLayoutModified?.();
      });

      this.sceneryImages.push(img);
    });
  }

  public renderTrees() {
    this.canopyGfx.clear();
    this.trunkGfx.clear();
    this.fgGfx.clear();

    const canopy = this.canopyGfx;
    const trunkGfx = this.trunkGfx;
    const fgGfx = this.fgGfx;

    const rnd = new Phaser.Math.RandomDataGenerator(['editor_tree_rnd_' + (this.layout.worldId || 1)]);
    const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

    const drawCurvedBough = (def: BranchDef, style: string) => {
      const { x: x1, y: y1Target, from, startW, endW, isBirch } = def;
      const x0 = from[0];
      const y0 = from[1];
      const y1 = y1Target + 8;
      const midX = (x0 + x1) / 2;
      const midY = (y0 + y1) / 2 - 12;
      const steps = 12;
      const pts: { x: number; y: number; w: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const inv = 1 - t;
        const px = inv * inv * x0 + 2 * inv * t * midX + t * t * x1;
        const py = inv * inv * y0 + 2 * inv * t * midY + t * t * y1;
        const w = Phaser.Math.Linear(startW, endW, t);
        pts.push({ x: px, y: py, w });
      }

      let bOutline = 0x3e200c;
      let bBase = 0x6b3f1f;
      let bLight = 0x93592b;

      if (isBirch || style === 'birch') {
        bOutline = 0x334155;
        bBase = 0xe2e8f0;
        bLight = 0xf8fafc;
      } else if (style === 'mangrove' || style === 'kapok') {
        bOutline = 0x141a0b;
        bBase = 0x334125;
        bLight = 0x5a6d36;
      } else if (style === 'sakura') {
        bOutline = 0x1b0e0c;
        bBase = 0x4a2522;
        bLight = 0x7c3a2d;
      } else if (style === 'pine') {
        bOutline = 0x221a14;
        bBase = 0x382d24;
        bLight = 0x5a483a;
      } else if (style === 'basalt') {
        bOutline = 0x09070c;
        bBase = 0x221f29;
        bLight = 0x484252;
      }

      for (let i = 0; i < pts.length - 1; i++) {
        trunkGfx.lineStyle(pts[i].w + 3, bOutline, 1);
        trunkGfx.lineBetween(pts[i].x, pts[i].y + 3, pts[i + 1].x, pts[i + 1].y + 3);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        trunkGfx.lineStyle(pts[i].w, bBase, 1);
        trunkGfx.lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        trunkGfx.lineStyle(Math.max(2, pts[i].w * 0.35), bLight, 0.7);
        trunkGfx.lineBetween(pts[i].x, pts[i].y - pts[i].w * 0.28, pts[i + 1].x, pts[i + 1].y - pts[i + 1].w * 0.28);
      }

      if (isBirch || style === 'birch') {
        trunkGfx.lineStyle(2, 0x1e293b, 0.85);
        trunkGfx.lineBetween(midX - 4, midY - 2, midX + 4, midY - 2);
      } else if (style === 'basalt') {
        trunkGfx.lineStyle(1.8, 0xef4444, 0.9);
        trunkGfx.lineBetween(x0, y0 - 2, x1, y1 - 2);
        trunkGfx.lineStyle(1.0, 0xfbbf24, 0.95);
        trunkGfx.lineBetween(x0, y0 - 2, x1, y1 - 2);
      } else if (style === 'mangrove' || style === 'kapok') {
        trunkGfx.fillStyle(0x10b981, 0.8);
        trunkGfx.fillCircle(midX - 10, midY - 6, 4);
        trunkGfx.fillCircle(midX + 12, midY - 5, 3.5);
      } else if (style === 'sakura') {
        trunkGfx.fillStyle(0xfbcfe8, 0.9);
        trunkGfx.fillCircle(x1 - 8, y1 + 4, 4);
        trunkGfx.fillCircle(x1 + 8, y1 + 4, 4);
        trunkGfx.fillStyle(0xec4899, 1);
        trunkGfx.fillCircle(x1, y1 + 6, 3);
      }

      trunkGfx.fillStyle(bBase, 1);
      trunkGfx.fillCircle(x1, y1, endW * 0.65);

      // Render Nest if attached
      if (def.nest) {
        const nx = def.nestX ?? x1;
        const ny = def.nestY ?? (y1 - 2);
        fgGfx.fillStyle(0x3e200c, 1);
        fgGfx.fillEllipse(nx, ny, 34, 16);
        fgGfx.fillStyle(0x5a3418, 1);
        fgGfx.fillEllipse(nx, ny - 2, 28, 12);
        fgGfx.fillStyle(0x1e1006, 1);
        fgGfx.fillEllipse(nx, ny - 4, 22, 8);
      }
    };

    for (const tree of this.layout.trees) {
      this.drawTreeStructure(tree, canopy, trunkGfx, fgGfx, rnd, V);
      for (let bIdx = 0; bIdx < tree.branches.length; bIdx++) {
        const b = tree.branches[bIdx];
        drawBranchLeaves(b, tree.style, canopy, fgGfx, bIdx);
        drawCurvedBough(b, tree.style);
      }
    }

    // Render Free Standalone Perches & Nests placed anywhere!
    if (this.layout.freePerches) {
      for (const fp of this.layout.freePerches) {
        if (fp.isNest) {
          fgGfx.fillStyle(0x3e200c, 1);
          fgGfx.fillEllipse(fp.x, fp.y, 34, 16);
          fgGfx.fillStyle(0x5a3418, 1);
          fgGfx.fillEllipse(fp.x, fp.y - 2, 28, 12);
          fgGfx.fillStyle(0x1e1006, 1);
          fgGfx.fillEllipse(fp.x, fp.y - 4, 22, 8);
        } else {
          fgGfx.fillStyle(0x6b3f1f, 1);
          fgGfx.fillCircle(fp.x, fp.y, 8);
          fgGfx.lineStyle(2, 0x93592b, 1);
          fgGfx.strokeCircle(fp.x, fp.y, 8);
        }
        if (fp.leaves) {
          drawStandaloneLeafCluster(
            { x: fp.x, y: fp.y + 4, scale: 0.65 },
            this.layout.trees[0]?.style || 'oak',
            canopy,
            fgGfx
          );
        }
      }
    }

    // Render Standalone Leaf Clusters placed anywhere!
    if (this.layout.leafClusters) {
      for (const lc of this.layout.leafClusters) {
        drawStandaloneLeafCluster(
          lc,
          this.layout.trees[0]?.style || 'oak',
          canopy,
          fgGfx
        );
      }
    }
  }

  private drawTreeStructure(
    tree: TreeDef,
    canopy: Phaser.GameObjects.Graphics,
    trunkGfx: Phaser.GameObjects.Graphics,
    fgGfx: Phaser.GameObjects.Graphics,
    rnd: Phaser.Math.RandomDataGenerator,
    V: (x: number, y: number) => Phaser.Math.Vector2
  ) {
    renderWholeTreeStructure(tree, canopy, trunkGfx, fgGfx, rnd, V);
  }

  public buildGizmos() {
    this.gizmoGfx.clear();
    for (const h of this.gizmoHandles) h.destroy();
    this.gizmoHandles = [];
    this.treeContextGizmos = [];

    // Draw handles for all trees, branches, and nests
    this.layout.trees.forEach((tree, tIdx) => {
      const scale = tree.scale ?? 1.0;
      const baseY = tree.trunkY ?? 625;
      const defaultTop = tree.style === 'birch' ? baseY - 365 : (tree.style === 'kapok' ? baseY - 395 : (tree.style === 'pine' ? baseY - 385 : (tree.style === 'sakura' ? baseY - 355 : baseY - 325)));
      const topY = tree.topY ?? defaultTop;
      const canX = tree.canopyX ?? tree.trunkX;
      const canY = tree.canopyY ?? (topY - 80 * scale);
      const canRad = (tree.canopyRadius ?? (tree.style === 'kapok' ? 240 : 180)) * scale;

      const allTreeHandles: Phaser.GameObjects.Container[] = [];

      // 1. Trunk Base Badge Handle (🌳 OAK)
      const tHandle = this.add.container(tree.trunkX, Math.min(620, baseY)).setDepth(110);
      const tg = this.add.graphics();
      tg.fillStyle(0x475569, 1);
      tg.fillRoundedRect(-44, -14, 88, 28, 8);
      tg.lineStyle(2, 0x94a3b8, 1);
      tg.strokeRoundedRect(-44, -14, 88, 28, 8);

      const tTxt = this.add.text(0, 0, `🌳 ${tree.style.toUpperCase()}`, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      tHandle.add([tg, tTxt]);
      tHandle.setSize(88, 28).setInteractive({ useHandCursor: true, draggable: true });
      allTreeHandles.push(tHandle);
      this.gizmoHandles.push(tHandle);

      tHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0) return;
        p.event.stopPropagation();
        this.select({ type: 'tree', treeIndex: tIdx });
      });

      tHandle.on('drag', (p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (p.button !== 0 || this.isPanning) return;
        const clampedX = Math.round(Phaser.Math.Clamp(dragX, 60, 1220));
        const clampedY = Math.round(Phaser.Math.Clamp(dragY, 200, 720));
        const deltaX = clampedX - tHandle.x;
        const deltaY = clampedY - tHandle.y;
        if (deltaX === 0 && deltaY === 0) return;

        tHandle.setPosition(clampedX, clampedY);
        tree.trunkX = clampedX;
        tree.trunkY = clampedY;
        if (tree.topY !== undefined) tree.topY += deltaY;
        if (tree.canopyY !== undefined) tree.canopyY += deltaY;
        if (tree.canopyX !== undefined) tree.canopyX += deltaX;

        // Slide branch attachments, perches, and nests with the trunk
        for (const b of tree.branches) {
          b.from[0] += deltaX;
          b.from[1] += deltaY;
          b.x += deltaX;
          b.y += deltaY;
          if (b.nestX !== undefined) b.nestX += deltaX;
          if (b.nestY !== undefined) b.nestY += deltaY;
        }

        for (const h of allTreeHandles) {
          if (h !== tHandle) {
            h.x += deltaX;
            h.y += deltaY;
          }
        }

        this.renderTrees();
        this.updateGizmoVisuals();
        this.onLayoutModified?.();
      });

      // 1.5 Tree Contextual Gizmos: ✂️ Trim Top, 🍃 Canopy 2D Handle, ↔️ Spread Handle, 📐 Scale Handle
      // A. Trim Top Handle (✂️ TRIM TOP)
      const trimHandle = this.add.container(tree.trunkX, topY).setDepth(115);
      const trg = this.add.graphics();
      trg.fillStyle(0xef4444, 1);
      trg.fillRoundedRect(-40, -12, 80, 24, 6);
      trg.lineStyle(1.5, 0xfecaca, 1);
      trg.strokeRoundedRect(-40, -12, 80, 24, 6);
      const trTxt = this.add.text(0, 0, '✂️ TRIM TOP', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      trimHandle.add([trg, trTxt]);
      trimHandle.setSize(80, 24).setInteractive({ useHandCursor: true, draggable: true });

      trimHandle.on('drag', (p: Phaser.Input.Pointer, _dx: number, dragY: number) => {
        if (p.button !== 0 || this.isPanning) return;
        const clampedY = Math.round(Phaser.Math.Clamp(dragY, 100, (tree.trunkY ?? 625) - 30));
        const diffY = clampedY - (tree.topY ?? defaultTop);
        tree.topY = clampedY;
        if (tree.canopyY !== undefined) tree.canopyY += diffY;
        trimHandle.y = clampedY;
        this.renderTrees();
        this.updateGizmoVisuals();
        this.onLayoutModified?.();
      });
      trimHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0) return;
        p.event.stopPropagation();
      });
      allTreeHandles.push(trimHandle);
      this.gizmoHandles.push(trimHandle);

      // B. Canopy Center 2D Handle (🍃 CANOPY)
      const canHandle = this.add.container(canX, canY).setDepth(115);
      const cg = this.add.graphics();
      cg.fillStyle(0x16a34a, 1);
      cg.fillRoundedRect(-36, -14, 72, 28, 8);
      cg.lineStyle(2, 0x86efac, 1);
      cg.strokeRoundedRect(-36, -14, 72, 28, 8);
      const canTxt = this.add.text(0, 0, '🍃 CANOPY', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      canHandle.add([cg, canTxt]);
      canHandle.setSize(72, 28).setInteractive({ useHandCursor: true, draggable: true });

      canHandle.on('drag', (p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (p.button !== 0 || this.isPanning) return;
        tree.canopyX = Math.round(Phaser.Math.Clamp(dragX, 40, 1240));
        tree.canopyY = Math.round(Phaser.Math.Clamp(dragY, 40, 560));
        canHandle.setPosition(tree.canopyX, tree.canopyY);
        const cRad = (tree.canopyRadius ?? 180) * (tree.scale ?? 1.0);
        spreadHandle.setPosition(tree.canopyX + cRad, tree.canopyY);
        scaleHandle.setPosition(tree.canopyX - cRad * 0.85, tree.canopyY - cRad * 0.65);
        this.renderTrees();
        this.updateGizmoVisuals();
        this.onLayoutModified?.();
      });
      canHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0) return;
        p.event.stopPropagation();
      });
      allTreeHandles.push(canHandle);
      this.gizmoHandles.push(canHandle);

      // C. Canopy Spread Handle (↔️ SPREAD)
      const spreadHandle = this.add.container(canX + canRad, canY).setDepth(115);
      const spg = this.add.graphics();
      spg.fillStyle(0x0284c7, 1);
      spg.fillCircle(0, 0, 14);
      spg.lineStyle(2, 0xbae6fd, 1);
      spg.strokeCircle(0, 0, 14);
      const spTxt = this.add.text(0, 0, '↔️', { fontSize: '11px' }).setOrigin(0.5);
      spreadHandle.add([spg, spTxt]);
      spreadHandle.setSize(28, 28).setInteractive({ useHandCursor: true, draggable: true });

      spreadHandle.on('drag', (p: Phaser.Input.Pointer, dragX: number) => {
        if (p.button !== 0 || this.isPanning) return;
        const cX = tree.canopyX ?? tree.trunkX;
        const dist = Math.abs(dragX - cX);
        const s = tree.scale ?? 1.0;
        tree.canopyRadius = Math.round(Phaser.Math.Clamp(dist / s, 50, 450));
        spreadHandle.x = cX + tree.canopyRadius * s;
        scaleHandle.x = cX - tree.canopyRadius * s * 0.85;
        this.renderTrees();
        this.updateGizmoVisuals();
        this.onLayoutModified?.();
      });
      spreadHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0) return;
        p.event.stopPropagation();
      });
      allTreeHandles.push(spreadHandle);
      this.gizmoHandles.push(spreadHandle);

      // D. Whole Tree Scale Handle (📐 SCALE)
      const scaleHandle = this.add.container(canX - canRad * 0.85, canY - canRad * 0.65).setDepth(116);
      const scg = this.add.graphics();
      scg.fillStyle(0x8b5cf6, 1);
      scg.fillRoundedRect(-32, -12, 64, 24, 6);
      scg.lineStyle(1.5, 0xddd6fe, 1);
      scg.strokeRoundedRect(-32, -12, 64, 24, 6);
      const scTxt = this.add.text(0, 0, `📐 ${(scale).toFixed(2)}x`, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);
      scaleHandle.add([scg, scTxt]);
      scaleHandle.setSize(64, 24).setInteractive({ useHandCursor: true, draggable: true });

      let initDist = 0;
      let initScale = 1.0;
      scaleHandle.on('dragstart', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0 || this.isPanning) return;
        initDist = Phaser.Math.Distance.Between(tree.trunkX, baseY, p.worldX, p.worldY);
        initScale = tree.scale ?? 1.0;
      });
      scaleHandle.on('drag', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0 || this.isPanning) return;
        const curDist = Phaser.Math.Distance.Between(tree.trunkX, baseY, p.worldX, p.worldY);
        if (initDist > 20) {
          const ratio = curDist / initDist;
          const newScale = Phaser.Math.Clamp(Math.round(initScale * ratio * 100) / 100, 0.4, 2.5);
          tree.scale = newScale;
          scTxt.setText(`📐 ${newScale.toFixed(2)}x`);
          const cX = tree.canopyX ?? tree.trunkX;
          const cY = tree.canopyY ?? (topY - 80 * newScale);
          const cRad = (tree.canopyRadius ?? 180) * newScale;
          spreadHandle.setPosition(cX + cRad, cY);
          scaleHandle.setPosition(cX - cRad * 0.85, cY - cRad * 0.65);
          this.renderTrees();
          this.updateGizmoVisuals();
          this.onLayoutModified?.();
        }
      });
      scaleHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.button !== 0) return;
        p.event.stopPropagation();
      });
      allTreeHandles.push(scaleHandle);
      this.gizmoHandles.push(scaleHandle);

      this.treeContextGizmos.push({
        treeIndex: tIdx,
        handles: [trimHandle, canHandle, spreadHandle, scaleHandle],
      });

      // 2. Branch Handles
      tree.branches.forEach((b, bIdx) => {
        // Trunk Socket Handle (Orange)
        const sHandle = this.add.container(b.from[0], b.from[1]).setDepth(110);
        const sg = this.add.graphics();
        sg.fillStyle(0xc2410c, 1);
        sg.fillCircle(0, 0, 8);
        sg.lineStyle(2, 0xffedd5, 1);
        sg.strokeCircle(0, 0, 8);
        sHandle.add(sg);
        sHandle.setSize(20, 20).setInteractive({ useHandCursor: true, draggable: true });

        sHandle.on('drag', (p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
          if (p.button !== 0 || this.isPanning) return;
          b.from[0] = Math.round(Phaser.Math.Clamp(dragX, 20, 1260));
          b.from[1] = Math.round(Phaser.Math.Clamp(dragY, 120, 640));
          sHandle.setPosition(b.from[0], b.from[1]);
          this.renderTrees();
          this.updateGizmoVisuals();
          this.onLayoutModified?.();
        });

        sHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
          if (p.button !== 0) return;
          p.event.stopPropagation();
          this.select({ type: 'branch', treeIndex: tIdx, branchIndex: bIdx });
        });

        allTreeHandles.push(sHandle);
        this.gizmoHandles.push(sHandle);

        // Branch Perch Handle (Cyan)
        const pHandle = this.add.container(b.x, b.y).setDepth(110);
        const pg = this.add.graphics();
        pg.fillStyle(0x0284c7, 1);
        pg.fillCircle(0, 0, 12);
        pg.lineStyle(2, 0xffffff, 1);
        pg.strokeCircle(0, 0, 12);

        const icon = this.add.text(0, 0, '🐦', { fontSize: '11px' }).setOrigin(0.5);
        pHandle.add([pg, icon]);
        pHandle.setSize(26, 26).setInteractive({ useHandCursor: true, draggable: true });

        pHandle.on('drag', (p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
          if (p.button !== 0 || this.isPanning) return;
          b.x = Math.round(Phaser.Math.Clamp(dragX, 40, 1240));
          b.y = Math.round(Phaser.Math.Clamp(dragY, 120, 600));
          pHandle.setPosition(b.x, b.y);
          this.renderTrees();
          this.updateGizmoVisuals();
          this.onLayoutModified?.();
        });

        pHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
          if (p.button !== 0) return;
          p.event.stopPropagation();
          this.select({ type: 'branch', treeIndex: tIdx, branchIndex: bIdx });
        });

        allTreeHandles.push(pHandle);
        this.gizmoHandles.push(pHandle);

        // 3. Egg Nest Handle (Gold / Green) - Draggable wherever the bird nests!
        if (b.nest) {
          const nx = b.nestX ?? b.x;
          const ny = b.nestY ?? (b.y - 4);
          const nHandle = this.add.container(nx, ny).setDepth(112);
          const ng = this.add.graphics();
          ng.fillStyle(0x15803d, 1);
          ng.fillCircle(0, 0, 13);
          ng.lineStyle(2, 0xfde047, 1);
          ng.strokeCircle(0, 0, 13);

          const nIcon = this.add.text(0, 0, '🪺', { fontSize: '13px' }).setOrigin(0.5);
          nHandle.add([ng, nIcon]);
          nHandle.setSize(28, 28).setInteractive({ useHandCursor: true, draggable: true });

          nHandle.on('drag', (p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
            if (p.button !== 0 || this.isPanning) return;
            b.nestX = Math.round(Phaser.Math.Clamp(dragX, 40, 1240));
            b.nestY = Math.round(Phaser.Math.Clamp(dragY, 120, 600));
            nHandle.setPosition(b.nestX, b.nestY);
            this.renderTrees();
            this.updateGizmoVisuals();
            this.onLayoutModified?.();
          });

          nHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (p.button !== 0) return;
            p.event.stopPropagation();
            this.select({ type: 'nest', treeIndex: tIdx, branchIndex: bIdx });
          });

          allTreeHandles.push(nHandle);
          this.gizmoHandles.push(nHandle);
        }
      });
    });

    // 3. Standalone Free Perches & Free Nests Handles
    if (this.layout.freePerches) {
      this.layout.freePerches.forEach((fp, fpIdx) => {
        const isFpSel = this.selection.type === 'freePerch' && this.selection.freePerchIndex === fpIdx;
        const fpHandle = this.add.container(fp.x, fp.y).setDepth(112);
        const fg = this.add.graphics();
        const col = fp.isNest ? 0x15803d : 0x0284c7;
        fg.fillStyle(col, 1);
        fg.fillCircle(0, 0, isFpSel ? 14 : 11);
        fg.lineStyle(2, isFpSel ? 0xfef08a : 0xffffff, 1);
        fg.strokeCircle(0, 0, isFpSel ? 14 : 11);

        const icon = this.add.text(0, 0, fp.isNest ? '🪺' : '🐦', { fontSize: '12px' }).setOrigin(0.5);
        fpHandle.add([fg, icon]);
        fpHandle.setSize(28, 28).setInteractive({ useHandCursor: true, draggable: true });

        fpHandle.on('drag', (p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
          if (p.button !== 0 || this.isPanning) return;
          fp.x = Math.round(Phaser.Math.Clamp(dragX, 40, 1240));
          fp.y = Math.round(Phaser.Math.Clamp(dragY, 120, 600));
          fpHandle.setPosition(fp.x, fp.y);
          this.renderTrees();
          this.updateGizmoVisuals();
          this.onLayoutModified?.();
        });

        fpHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
          if (p.button !== 0) return;
          p.event.stopPropagation();
          this.select({ type: 'freePerch', freePerchIndex: fpIdx });
        });

        this.gizmoHandles.push(fpHandle);
      });
    }

    // 4. Standalone Leaf Clusters Handles
    if (this.layout.leafClusters) {
      this.layout.leafClusters.forEach((lc, lcIdx) => {
        const isLcSel = this.selection.type === 'leafCluster' && this.selection.leafClusterIndex === lcIdx;
        const lcHandle = this.add.container(lc.x, lc.y).setDepth(112);
        const lg = this.add.graphics();
        lg.fillStyle(0x16a34a, 1);
        lg.fillCircle(0, 0, isLcSel ? 14 : 11);
        lg.lineStyle(2, isLcSel ? 0xfef08a : 0xa3e635, 1);
        lg.strokeCircle(0, 0, isLcSel ? 14 : 11);

        const icon = this.add.text(0, 0, '🍃', { fontSize: '12px' }).setOrigin(0.5);
        lcHandle.add([lg, icon]);
        lcHandle.setSize(28, 28).setInteractive({ useHandCursor: true, draggable: true });

        lcHandle.on('drag', (p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
          if (p.button !== 0 || this.isPanning) return;
          lc.x = Math.round(Phaser.Math.Clamp(dragX, 30, 1250));
          lc.y = Math.round(Phaser.Math.Clamp(dragY, 80, 620));
          lcHandle.setPosition(lc.x, lc.y);
          this.renderTrees();
          this.updateGizmoVisuals();
          this.onLayoutModified?.();
        });

        lcHandle.on('pointerdown', (p: Phaser.Input.Pointer) => {
          if (p.button !== 0) return;
          p.event.stopPropagation();
          this.select({ type: 'leafCluster', leafClusterIndex: lcIdx });
        });

        this.gizmoHandles.push(lcHandle);
      });
    }

    this.updateSelectionGizmos();
  }

  /**
   * Redraws selection halos, guide curves, and bounding boxes without recreating handles
   */
  public updateGizmoVisuals() {
    this.gizmoGfx.clear();
    const g = this.gizmoGfx;

    // Canvas boundary frame guide (visible when zoomed out)
    g.lineStyle(1.5, 0x38bdf8, 0.35);
    g.strokeRect(0, 0, 1280, 720);

    const { type, treeIndex, branchIndex, sceneryIndex } = this.selection;

    if (type === 'tree' && treeIndex !== undefined && this.layout.trees[treeIndex]) {
      const tree = this.layout.trees[treeIndex];
      const scale = tree.scale ?? 1.0;
      const baseY = tree.trunkY ?? 625;
      const defaultTop = tree.style === 'birch' ? baseY - 365 : (tree.style === 'kapok' ? baseY - 395 : (tree.style === 'pine' ? baseY - 385 : (tree.style === 'sakura' ? baseY - 355 : baseY - 325)));
      const topY = tree.topY ?? defaultTop;
      const canX = tree.canopyX ?? tree.trunkX;
      const canY = tree.canopyY ?? (topY - 80 * scale);
      const canRad = (tree.canopyRadius ?? (tree.style === 'kapok' ? 240 : 180)) * scale;

      // Golden halo around trunk base
      g.lineStyle(3, 0xf59e0b, 0.9);
      g.strokeRoundedRect(tree.trunkX - 46, Math.min(620, baseY) - 16, 92, 32, 10);
      g.lineStyle(1.5, 0xfef08a, 0.5);
      g.lineBetween(tree.trunkX, baseY, tree.trunkX, topY);

      // Whole tree selection bounding frame
      g.lineStyle(1.5, 0xf59e0b, 0.4);
      const bbLeft = Math.min(tree.trunkX - 90 * scale, canX - canRad);
      const bbRight = Math.max(tree.trunkX + 90 * scale, canX + canRad);
      const bbTop = canY - canRad * 0.7;
      const bbBottom = baseY + 12;
      g.strokeRoundedRect(bbLeft - 10, bbTop - 10, (bbRight - bbLeft) + 20, (bbBottom - bbTop) + 20, 12);
    } else if (type === 'branch' && treeIndex !== undefined && branchIndex !== undefined) {
      const b = this.layout.trees[treeIndex]?.branches[branchIndex];
      if (b) {
        // Glowing cyan guide curve connecting trunk socket to perch
        g.lineStyle(2, 0x38bdf8, 0.9);
        g.strokeCircle(b.from[0], b.from[1], 12);
        g.strokeCircle(b.x, b.y, 16);

        const midX = (b.from[0] + b.x) / 2;
        const midY = (b.from[1] + b.y) / 2 - 12;
        const curve = new Phaser.Curves.QuadraticBezier(
          new Phaser.Math.Vector2(b.from[0], b.from[1]),
          new Phaser.Math.Vector2(midX, midY),
          new Phaser.Math.Vector2(b.x, b.y)
        );
        g.lineStyle(1.8, 0x38bdf8, 0.7);
        curve.draw(g);
      }
    } else if (type === 'nest' && treeIndex !== undefined && branchIndex !== undefined) {
      const b = this.layout.trees[treeIndex]?.branches[branchIndex];
      if (b) {
        const nx = b.nestX ?? b.x;
        const ny = b.nestY ?? (b.y - 4);
        g.lineStyle(3, 0xfacc15, 0.95);
        g.strokeCircle(nx, ny, 18);
        g.lineStyle(1.5, 0x4ade80, 0.6);
        g.strokeCircle(nx, ny, 23);
      }
    } else if (type === 'freePerch' && this.selection.freePerchIndex !== undefined && this.layout.freePerches?.[this.selection.freePerchIndex]) {
      const fp = this.layout.freePerches[this.selection.freePerchIndex];
      g.lineStyle(2.5, 0xfacc15, 0.95);
      g.strokeCircle(fp.x, fp.y, 18);
    } else if (type === 'leafCluster' && this.selection.leafClusterIndex !== undefined && this.layout.leafClusters?.[this.selection.leafClusterIndex]) {
      const lc = this.layout.leafClusters[this.selection.leafClusterIndex];
      g.lineStyle(2.5, 0x4ade80, 0.95);
      g.strokeCircle(lc.x, lc.y, 28 * (lc.scale ?? 1.0));
    } else if (type === 'scenery' && sceneryIndex !== undefined && this.layout.scenery[sceneryIndex]) {
      const sc = this.layout.scenery[sceneryIndex];
      g.lineStyle(2, 0x38bdf8, 0.9);
      g.strokeCircle(sc.x, sc.y, 32 * sc.scale);
      g.lineStyle(1.5, 0x38bdf8, 0.4);
      g.strokeRect(sc.x - 36 * sc.scale, sc.y - 36 * sc.scale, 72 * sc.scale, 72 * sc.scale);
    }
  }

  /**
   * Snaps a branch's socket flush to the parent tree's contour at height Y
   */
  public snapBranchToTrunk(treeIndex: number, branchIndex: number) {
    const tree = this.layout.trees[treeIndex];
    if (!tree) return;
    const branch = tree.branches[branchIndex];
    if (!branch) return;

    const targetEdgeX = getTrunkEdgeAtY(tree, branch.from[1], 'auto', branch.x);
    branch.from[0] = targetEdgeX;

    this.renderTrees();
    this.buildGizmos();
    this.updateGizmoVisuals();
    this.onLayoutModified?.();
  }
}
