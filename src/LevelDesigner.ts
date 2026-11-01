import Phaser from 'phaser';
import {
  LevelLayoutDef,
  TreeDef,
  BranchDef,
  SceneryItemDef,
  SCENERY_PALETTE,
  saveLevelLayout,
  resetLevelLayout,
  TreeStyle,
  getTrunkEdgeAtY,
} from './LevelDesignData';
import { AviaryScene } from './AviaryScene';

const FONT = 'Lilita One, sans-serif';

export class LevelDesigner {
  private scene: AviaryScene;
  public active = false;
  private container?: Phaser.GameObjects.Container;
  private gizmoContainer?: Phaser.GameObjects.Container;
  private selectedSceneryId?: string;
  private selectedTreeIndex = 0;
  private sceneryPickerOpen = false;
  private sceneryPickerContainer?: Phaser.GameObjects.Container;

  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private lastMiddleClickTime = 0;
  private wheelHandler?: (pointer: Phaser.Input.Pointer, gameObjects: any[], deltaX: number, deltaY: number) => void;
  private pointerDownHandler?: (pointer: Phaser.Input.Pointer) => void;
  private pointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void;
  private pointerUpHandler?: (pointer: Phaser.Input.Pointer) => void;

  constructor(scene: AviaryScene) {
    this.scene = scene;
  }

  public toggle() {
    if (this.active) {
      this.close();
    } else {
      this.open();
    }
  }

  public open() {
    if (this.active) return;
    this.active = true;
    this.scene.gamePaused = true;
    this.scene.modal = true;

    // Build the designer interface
    this.buildUI();
    this.buildGizmos();
    this.scene.floatText(640, 200, '🎨 LEVEL DESIGNER ACTIVATED', '#38bdf8', '#0f172a');

    // Scrollwheel Zoom
    this.wheelHandler = (pointer: Phaser.Input.Pointer, _gameObjects: any[], _deltaX: number, deltaY: number) => {
      if (!this.active) return;
      const camera = this.scene.cameras.main;
      const oldZoom = camera.zoom;
      const rawFactor = Math.pow(0.998, deltaY);
      const factor = Phaser.Math.Clamp(rawFactor, 0.75, 1.35);
      const newZoom = Phaser.Math.Clamp(oldZoom * factor, 0.35, 4.0);
      if (Math.abs(newZoom - oldZoom) < 0.0005) return;

      const worldBefore = camera.getWorldPoint(pointer.x, pointer.y);
      camera.setZoom(newZoom);
      const worldAfter = camera.getWorldPoint(pointer.x, pointer.y);
      camera.scrollX += (worldBefore.x - worldAfter.x);
      camera.scrollY += (worldBefore.y - worldAfter.y);
    };

    // Middle Mouse Click Pan
    this.pointerDownHandler = (pointer: Phaser.Input.Pointer) => {
      if (!this.active) return;
      const isMiddle = pointer.button === 1 || pointer.middleButtonDown();
      if (isMiddle) {
        const now = Date.now();
        if (now - this.lastMiddleClickTime < 320) {
          this.scene.cameras.main.setZoom(1.0);
          this.scene.cameras.main.centerOn(640, 360);
          this.lastMiddleClickTime = 0;
          return;
        }
        this.lastMiddleClickTime = now;
        this.isPanning = true;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
        if (this.scene.game.canvas) this.scene.game.canvas.style.cursor = 'grabbing';
      }
    };

    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      if (this.isPanning && this.active) {
        const camera = this.scene.cameras.main;
        const dx = (pointer.x - this.panStartX) / camera.zoom;
        const dy = (pointer.y - this.panStartY) / camera.zoom;
        camera.scrollX -= dx;
        camera.scrollY -= dy;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
      }
    };

    this.pointerUpHandler = (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 || !pointer.middleButtonDown()) {
        if (this.isPanning) {
          this.isPanning = false;
          if (this.scene.game.canvas) this.scene.game.canvas.style.cursor = 'default';
        }
      }
    };

    this.scene.input.on('wheel', this.wheelHandler);
    this.scene.input.on('pointerdown', this.pointerDownHandler);
    this.scene.input.on('pointermove', this.pointerMoveHandler);
    this.scene.input.on('pointerup', this.pointerUpHandler);
  }

  public close() {
    if (!this.active) return;
    this.active = false;
    this.scene.gamePaused = false;
    this.scene.modal = false;

    if (this.wheelHandler) this.scene.input.off('wheel', this.wheelHandler);
    if (this.pointerDownHandler) this.scene.input.off('pointerdown', this.pointerDownHandler);
    if (this.pointerMoveHandler) this.scene.input.off('pointermove', this.pointerMoveHandler);
    if (this.pointerUpHandler) this.scene.input.off('pointerup', this.pointerUpHandler);
    this.isPanning = false;
    this.scene.cameras.main.setZoom(1.0);
    this.scene.cameras.main.centerOn(640, 360);
    if (this.scene.game.canvas) this.scene.game.canvas.style.cursor = 'default';

    if (this.container) {
      this.container.destroy();
      this.container = undefined;
    }
    if (this.gizmoContainer) {
      this.gizmoContainer.destroy();
      this.gizmoContainer = undefined;
    }
    if (this.sceneryPickerContainer) {
      this.sceneryPickerContainer.destroy();
      this.sceneryPickerContainer = undefined;
    }
    this.sceneryPickerOpen = false;

    // Save changes automatically on exit
    saveLevelLayout(this.scene.currentLayout);
    this.scene.floatText(640, 200, 'LEVEL DESIGNER CLOSED — CHANGES SAVED ✔', '#4ade80', '#14532d');
  }

  private buildUI() {
    if (this.container) this.container.destroy();
    this.container = this.scene.add.container(0, 0).setDepth(200).setScrollFactor(0);

    const W = 1280;
    const topBarH = 68;
    const bg = this.scene.add.graphics();

    // Dark sleek glass top toolbar
    bg.fillStyle(0x0f172a, 0.92);
    bg.fillRect(0, 0, W, topBarH);
    bg.lineStyle(2, 0x38bdf8, 0.8);
    bg.lineBetween(0, topBarH, W, topBarH);

    // Title badge
    const title = this.scene.add.text(18, 14, '🎨 LEVEL DESIGNER', {
      fontFamily: FONT,
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#38bdf8',
    });
    const sub = this.scene.add.text(18, 40, `Target: ${this.scene.currentLayout.levelKey}`, {
      fontFamily: FONT,
      fontSize: '13px',
      color: '#94a3b8',
    });

    this.container.add([bg, title, sub]);

    // Toolbar Action Buttons
    let btnX = 220;
    const spacing = 110;

    // 1. Add Branch
    this.createToolbarButton(btnX, 22, '+ 🌿 Branch', 0x14532d, 0x22c55e, () => {
      this.addBranch();
    });
    btnX += spacing;

    // 2. Add Standalone Nest
    this.createToolbarButton(btnX, 22, '+ 🪺 Nest', 0x15803d, 0xfde047, () => {
      if (!this.scene.currentLayout.freePerches) this.scene.currentLayout.freePerches = [];
      this.scene.currentLayout.freePerches.push({
        id: `nest_${Date.now()}`,
        x: 640,
        y: 360,
        isNest: true,
        leaves: true,
      });
      this.scene.redrawLevelLayout();
      this.buildGizmos();
      this.scene.floatText(640, 360, '🪺 ADDED NEST! DRAG ANYWHERE', '#fde047', '#15803d');
    });
    btnX += spacing;

    // 3. Add Standalone Leaves
    this.createToolbarButton(btnX, 22, '+ 🍃 Leaves', 0x166534, 0x86efac, () => {
      if (!this.scene.currentLayout.leafClusters) this.scene.currentLayout.leafClusters = [];
      this.scene.currentLayout.leafClusters.push({
        id: `leaf_${Date.now()}`,
        x: 640,
        y: 320,
        scale: 1.0,
      });
      this.scene.redrawLevelLayout();
      this.buildGizmos();
      this.scene.floatText(640, 320, '🍃 ADDED LEAF CLUSTER! DRAG ANYWHERE', '#86efac', '#064e3b');
    });
    btnX += spacing;

    // 4. Add Scenery Prop
    this.createToolbarButton(btnX, 22, '+ 🪨 Scenery', 0x3b0764, 0xa855f7, () => {
      this.toggleSceneryPicker();
    });
    btnX += spacing;

    // 5. Tree Style Switcher
    this.createToolbarButton(btnX, 22, '🌳 Tree Style', 0x78350f, 0xf59e0b, () => {
      this.cycleTreeStyle();
    });
    btnX += spacing;

    // 6. Save Layout
    this.createToolbarButton(btnX, 22, '💾 Save', 0x1e3a8a, 0x3b82f6, () => {
      saveLevelLayout(this.scene.currentLayout);
      this.scene.floatText(640, 360, '💾 LAYOUT SAVED TO BROWSER!', '#4ade80', '#064e3b');
    });
    btnX += 95;

    // 7. Open Full Studio Editor in browser
    this.createToolbarButton(btnX, 22, '🖥️ Studio', 0x0284c7, 0x38bdf8, () => {
      saveLevelLayout(this.scene.currentLayout);
      window.open('/editor.html', '_blank');
    });
    btnX += 105;

    // 8. Exit / Done
    this.createToolbarButton(btnX + 10, 22, '✔ DONE', 0x166534, 0x4ade80, () => {
      this.close();
    });

    // Helper hint text along the bottom of the screen
    const hintBg = this.scene.add.graphics();
    hintBg.fillStyle(0x0f172a, 0.85);
    hintBg.fillRect(0, 686, W, 34);
    const hint = this.scene.add.text(
      W / 2,
      703,
      '💡 DRAG Green/Cyan handles for perches | CLICK perch to toggle NEST | DRAG Orange handles for trunk attachment | DRAG Props to place',
      {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#e2e8f0',
      }
    ).setOrigin(0.5);
    this.container.add([hintBg, hint]);
  }

  private createToolbarButton(
    x: number,
    y: number,
    label: string,
    bgCol: number,
    borderCol: number,
    onClick: () => void
  ) {
    const btn = this.scene.add.container(x, y);
    const g = this.scene.add.graphics();
    const bw = 105;
    const bh = 34;

    g.fillStyle(bgCol, 1);
    g.fillRoundedRect(0, 0, bw, bh, 8);
    g.lineStyle(1.8, borderCol, 1);
    g.strokeRoundedRect(0, 0, bw, bh, 8);

    const txt = this.scene.add.text(bw / 2, bh / 2, label, {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    btn.add([g, txt]);
    btn.setSize(bw, bh).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', onClick);
    btn.on('pointerover', () => this.scene.tweens.add({ targets: btn, scale: 1.05, duration: 60 }));
    btn.on('pointerout', () => this.scene.tweens.add({ targets: btn, scale: 1.0, duration: 60 }));

    this.container?.add(btn);
    return btn;
  }

  /**
   * Builds draggable visual handles on the canvas for trees, branches, sockets, and scenery
   */
  public buildGizmos() {
    if (this.gizmoContainer) this.gizmoContainer.destroy();
    this.gizmoContainer = this.scene.add.container(0, 0).setDepth(190);

    const layout = this.scene.currentLayout;

    // -------------------------------------------------------------
    // 1. Tree Trunk Draggable Base Handles
    // -------------------------------------------------------------
    layout.trees.forEach((tree, tIdx) => {
      const handleY = 620;
      const tHandle = this.scene.add.container(tree.trunkX, handleY);
      const tg = this.scene.add.graphics();

      const isSel = this.selectedTreeIndex === tIdx;
      tg.fillStyle(0x000000, 0.45);
      tg.fillEllipse(0, 4, 76, 22);
      tg.fillStyle(isSel ? 0xf59e0b : 0x78350f, 1);
      tg.fillRoundedRect(-38, -14, 76, 28, 8);
      tg.lineStyle(2, isSel ? 0xfef08a : 0xd97706, 1);
      tg.strokeRoundedRect(-38, -14, 76, 28, 8);

      const label = this.scene.add.text(0, 0, `🌳 ${tree.style.toUpperCase()}`, {
        fontFamily: FONT,
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      tHandle.add([tg, label]);
      tHandle.setSize(76, 28).setInteractive({ useHandCursor: true, draggable: true });

      let tDragged = false;
      tHandle.on('dragstart', () => {
        tDragged = false;
      });
      tHandle.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        tDragged = true;
        const clampedX = Math.round(Phaser.Math.Clamp(dragX, 60, 1220));
        const clampedY = Math.round(Phaser.Math.Clamp(dragY, 200, 720));
        const deltaX = clampedX - tHandle.x;
        const deltaY = clampedY - tHandle.y;
        if (deltaX !== 0 || deltaY !== 0) {
          tHandle.setPosition(clampedX, clampedY);
          tree.trunkX = clampedX;
          tree.trunkY = clampedY;
          if (tree.topY !== undefined) tree.topY += deltaY;
          if (tree.canopyY !== undefined) tree.canopyY += deltaY;
          if (tree.canopyX !== undefined) tree.canopyX += deltaX;

          // Shift attached branch sockets and perches along with the entire tree
          for (const b of tree.branches) {
            b.from[0] = Math.round(b.from[0] + deltaX);
            b.from[1] = Math.round(b.from[1] + deltaY);
            b.x = Math.round(b.x + deltaX);
            b.y = Math.round(b.y + deltaY);
            if (b.nestX !== undefined) b.nestX = Math.round(b.nestX + deltaX);
            if (b.nestY !== undefined) b.nestY = Math.round(b.nestY + deltaY);
          }

          this.scene.redrawLevelLayout();
        }
      });
      tHandle.on('dragend', () => {
        this.buildGizmos();
      });

      tHandle.on('pointerup', () => {
        if (!tDragged) {
          this.selectedTreeIndex = tIdx;
          this.buildGizmos();
        }
      });

      this.gizmoContainer?.add(tHandle);

      // Selected Tree Handles: Canopy Center 2D and Trim Top Height
      if (isSel) {
        const scale = tree.scale ?? 1.0;
        const baseY = tree.trunkY ?? 625;
        const defaultTop = tree.style === 'birch' ? baseY - 365 : (tree.style === 'kapok' ? baseY - 395 : (tree.style === 'pine' ? baseY - 385 : (tree.style === 'sakura' ? baseY - 355 : baseY - 325)));
        const topY = tree.topY ?? defaultTop;
        const canX = tree.canopyX ?? tree.trunkX;
        const canY = tree.canopyY ?? (topY - 80 * scale);

        // Canopy 2D Drag Handle
        const canHandle = this.scene.add.container(canX, canY);
        const cg = this.scene.add.graphics();
        cg.fillStyle(0x16a34a, 1);
        cg.fillRoundedRect(-36, -14, 72, 28, 8);
        cg.lineStyle(2, 0x86efac, 1);
        cg.strokeRoundedRect(-36, -14, 72, 28, 8);
        const canTxt = this.scene.add.text(0, 0, '🍃 CANOPY', {
          fontFamily: FONT,
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#ffffff',
        }).setOrigin(0.5);
        canHandle.add([cg, canTxt]);
        canHandle.setSize(72, 28).setInteractive({ useHandCursor: true, draggable: true });
        canHandle.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
          tree.canopyX = Math.round(Phaser.Math.Clamp(dx, 40, 1240));
          tree.canopyY = Math.round(Phaser.Math.Clamp(dy, 40, 560));
          canHandle.setPosition(tree.canopyX, tree.canopyY);
          this.scene.redrawLevelLayout();
        });
        canHandle.on('dragend', () => { this.buildGizmos(); });
        this.gizmoContainer?.add(canHandle);

        // Trim Top Height Handle
        const trimHandle = this.scene.add.container(tree.trunkX, topY);
        const trg = this.scene.add.graphics();
        trg.fillStyle(0xef4444, 1);
        trg.fillRoundedRect(-40, -12, 80, 24, 6);
        trg.lineStyle(1.5, 0xfecaca, 1);
        trg.strokeRoundedRect(-40, -12, 80, 24, 6);
        const trTxt = this.scene.add.text(0, 0, '✂️ TRIM TOP', {
          fontFamily: FONT,
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#ffffff',
        }).setOrigin(0.5);
        trimHandle.add([trg, trTxt]);
        trimHandle.setSize(80, 24).setInteractive({ useHandCursor: true, draggable: true });
        trimHandle.on('drag', (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
          const clampedY = Math.round(Phaser.Math.Clamp(dy, 120, (tree.trunkY ?? 625) - 40));
          const diffY = clampedY - (tree.topY ?? defaultTop);
          tree.topY = clampedY;
          if (tree.canopyY !== undefined) tree.canopyY += diffY;
          trimHandle.y = clampedY;
          this.scene.redrawLevelLayout();
        });
        trimHandle.on('dragend', () => { this.buildGizmos(); });
        this.gizmoContainer?.add(trimHandle);
      }

      // -----------------------------------------------------------
      // 2. Branch Perches, Trunk Sockets & Nests Handles
      // -----------------------------------------------------------
      tree.branches.forEach((b, bIdx) => {
        // Socket Handle (From X/Y on trunk) - Click to snap flush to trunk!
        const sockHandle = this.scene.add.container(b.from[0], b.from[1]);
        const sg = this.scene.add.graphics();
        sg.fillStyle(0xea580c, 1);
        sg.fillCircle(0, 0, 9);
        sg.lineStyle(1.8, 0xffedd5, 1);
        sg.strokeCircle(0, 0, 9);
        sockHandle.add(sg);
        sockHandle.setSize(22, 22).setInteractive({ useHandCursor: true, draggable: true });

        let sDragged = false;
        sockHandle.on('dragstart', () => { sDragged = false; });
        sockHandle.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
          sDragged = true;
          b.from[0] = Math.round(Phaser.Math.Clamp(dx, 20, 1260));
          b.from[1] = Math.round(Phaser.Math.Clamp(dy, 220, 620));
          sockHandle.setPosition(b.from[0], b.from[1]);
          this.scene.redrawLevelLayout();
        });
        sockHandle.on('dragend', () => {
          this.buildGizmos();
        });

        // Click socket to auto-snap flush to the tree bark contour!
        sockHandle.on('pointerup', () => {
          if (!sDragged) {
            b.from[0] = getTrunkEdgeAtY(tree, b.from[1], 'auto', b.x);
            this.scene.redrawLevelLayout();
            this.buildGizmos();
            this.scene.floatText(b.from[0], b.from[1] - 25, '🔗 SNAPPED TO TRUNK!', '#38bdf8', '#082f49');
          }
        });

        this.gizmoContainer?.add(sockHandle);

        // Perch Handle (Where bird lands: x, y)
        const perchHandle = this.scene.add.container(b.x, b.y);
        const pg = this.scene.add.graphics();
        const hasNest = b.nest;

        pg.fillStyle(0x000000, 0.4);
        pg.fillCircle(1, 2, 14);
        pg.fillStyle(hasNest ? 0x16a34a : 0x0284c7, 1);
        pg.fillCircle(0, 0, 13);
        pg.lineStyle(2, hasNest ? 0xfef08a : 0xbae6fd, 1);
        pg.strokeCircle(0, 0, 13);

        const iconTxt = this.scene.add.text(0, 0, hasNest ? '🪺' : '🐦', {
          fontSize: '12px',
        }).setOrigin(0.5);

        const perchLabel = this.scene.add.text(0, -22, `B#${bIdx + 1} (${hasNest ? 'NEST' : 'PERCH'})`, {
          fontFamily: FONT,
          fontSize: '11px',
          color: hasNest ? '#86efac' : '#7dd3fc',
          stroke: '#0f172a',
          strokeThickness: 3,
        }).setOrigin(0.5);

        perchHandle.add([pg, iconTxt, perchLabel]);
        perchHandle.setSize(28, 28).setInteractive({ useHandCursor: true, draggable: true });

        let dragged = false;
        perchHandle.on('dragstart', () => { dragged = false; });
        perchHandle.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
          dragged = true;
          b.x = Math.round(Phaser.Math.Clamp(dx, 40, 1240));
          b.y = Math.round(Phaser.Math.Clamp(dy, 180, 560));
          perchHandle.setPosition(b.x, b.y);
          this.scene.redrawLevelLayout();
        });
        perchHandle.on('dragend', () => {
          if (dragged) this.buildGizmos();
        });

        // Click to toggle Nest / Perch!
        perchHandle.on('pointerup', () => {
          if (!dragged) {
            b.nest = !b.nest;
            if (b.nest && b.nestX === undefined) {
              b.nestX = b.x;
              b.nestY = b.y - 4;
            }
            this.scene.redrawLevelLayout();
            this.buildGizmos();
            this.scene.floatText(b.x, b.y - 40, b.nest ? '🪺 NEST ENABLED!' : '🐦 PERCH ONLY', '#fde047', '#0f172a');
          }
        });

        this.gizmoContainer?.add(perchHandle);

        // Dedicated Nest Bowl Draggable Handle (Where bird weaves and lays egg!)
        if (b.nest) {
          const nx = b.nestX ?? b.x;
          const ny = b.nestY ?? (b.y - 4);
          const nestHandle = this.scene.add.container(nx, ny);
          const ng = this.scene.add.graphics();
          ng.fillStyle(0x000000, 0.4);
          ng.fillCircle(1, 2, 14);
          ng.fillStyle(0x15803d, 1);
          ng.fillCircle(0, 0, 13);
          ng.lineStyle(2, 0xfde047, 1);
          ng.strokeCircle(0, 0, 13);

          const nIcon = this.scene.add.text(0, 0, '🪺', { fontSize: '12px' }).setOrigin(0.5);
          const nLabel = this.scene.add.text(0, -22, `NEST #${bIdx + 1}`, {
            fontFamily: FONT,
            fontSize: '11px',
            color: '#facc15',
            stroke: '#0f172a',
            strokeThickness: 3,
          }).setOrigin(0.5);

          nestHandle.add([ng, nIcon, nLabel]);
          nestHandle.setSize(28, 28).setInteractive({ useHandCursor: true, draggable: true });

          let nDragged = false;
          nestHandle.on('dragstart', () => { nDragged = false; });
          nestHandle.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
            nDragged = true;
            b.nestX = Math.round(Phaser.Math.Clamp(dx, 40, 1240));
            b.nestY = Math.round(Phaser.Math.Clamp(dy, 140, 600));
            nestHandle.setPosition(b.nestX, b.nestY);
            this.scene.redrawLevelLayout();
          });
          nestHandle.on('dragend', () => {
            if (nDragged) this.buildGizmos();
          });

          this.gizmoContainer?.add(nestHandle);
        }
      });
    });

    // -------------------------------------------------------------
    // 3. Scenery Items Draggable Gizmos
    // -------------------------------------------------------------
    layout.scenery.forEach((sc, scIdx) => {
      const sHandle = this.scene.add.container(sc.x, sc.y);
      const sg = this.scene.add.graphics();
      const isSel = this.selectedSceneryId === sc.id;

      sg.lineStyle(2, isSel ? 0x38bdf8 : 0xffffff, isSel ? 0.95 : 0.45);
      sg.strokeCircle(0, 0, 24);

      sHandle.add(sg);
      sHandle.setSize(48, 48).setInteractive({ useHandCursor: true, draggable: true });

      let dragged = false;
      sHandle.on('dragstart', () => { dragged = false; });
      sHandle.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
        dragged = true;
        sc.x = Math.round(Phaser.Math.Clamp(dx, 30, 1250));
        sc.y = Math.round(Phaser.Math.Clamp(dy, 120, 640));
        sHandle.setPosition(sc.x, sc.y);
        this.scene.redrawLevelLayout();
      });
      sHandle.on('dragend', () => {
        if (dragged) this.buildGizmos();
      });

      sHandle.on('pointerdown', () => {
        this.selectedSceneryId = sc.id;
        this.buildGizmos();
        this.showSceneryInspector(sc, scIdx);
      });

      this.gizmoContainer?.add(sHandle);
    });

    // 4. Standalone Free Perches & Nests
    if (layout.freePerches) {
      layout.freePerches.forEach((fp) => {
        const fpHandle = this.scene.add.container(fp.x, fp.y);
        const fg = this.scene.add.graphics();
        fg.fillStyle(0x000000, 0.4);
        fg.fillCircle(1, 2, 14);
        fg.fillStyle(fp.isNest ? 0x15803d : 0x0284c7, 1);
        fg.fillCircle(0, 0, 13);
        fg.lineStyle(2, fp.isNest ? 0xfde047 : 0xbae6fd, 1);
        fg.strokeCircle(0, 0, 13);

        const icon = this.scene.add.text(0, 0, fp.isNest ? '🪺' : '🐦', { fontSize: '12px' }).setOrigin(0.5);
        fpHandle.add([fg, icon]);
        fpHandle.setSize(28, 28).setInteractive({ useHandCursor: true, draggable: true });

        let fDragged = false;
        fpHandle.on('dragstart', () => { fDragged = false; });
        fpHandle.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
          fDragged = true;
          fp.x = Math.round(Phaser.Math.Clamp(dx, 40, 1240));
          fp.y = Math.round(Phaser.Math.Clamp(dy, 120, 600));
          fpHandle.setPosition(fp.x, fp.y);
          this.scene.redrawLevelLayout();
        });
        fpHandle.on('dragend', () => {
          if (fDragged) this.buildGizmos();
        });
        this.gizmoContainer?.add(fpHandle);
      });
    }

    // 5. Standalone Leaf Clusters
    if (layout.leafClusters) {
      layout.leafClusters.forEach((lc) => {
        const lcHandle = this.scene.add.container(lc.x, lc.y);
        const lg = this.scene.add.graphics();
        lg.fillStyle(0x000000, 0.4);
        lg.fillCircle(1, 2, 14);
        lg.fillStyle(0x16a34a, 1);
        lg.fillCircle(0, 0, 13);
        lg.lineStyle(2, 0xa3e635, 1);
        lg.strokeCircle(0, 0, 13);

        const icon = this.scene.add.text(0, 0, '🍃', { fontSize: '12px' }).setOrigin(0.5);
        lcHandle.add([lg, icon]);
        lcHandle.setSize(28, 28).setInteractive({ useHandCursor: true, draggable: true });

        let lDragged = false;
        lcHandle.on('dragstart', () => { lDragged = false; });
        lcHandle.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
          lDragged = true;
          lc.x = Math.round(Phaser.Math.Clamp(dx, 30, 1250));
          lc.y = Math.round(Phaser.Math.Clamp(dy, 80, 620));
          lcHandle.setPosition(lc.x, lc.y);
          this.scene.redrawLevelLayout();
        });
        lcHandle.on('dragend', () => {
          if (lDragged) this.buildGizmos();
        });
        this.gizmoContainer?.add(lcHandle);
      });
    }
  }

  /**
   * Floating inspector pill for a selected scenery item (Scale, Flip, Delete)
   */
  private showSceneryInspector(sc: SceneryItemDef, scIdx: number) {
    const existing = this.gizmoContainer?.getByName('scenery_inspector');
    if (existing) existing.destroy();

    const insp = this.scene.add.container(sc.x, sc.y - 50);
    insp.setName('scenery_inspector');
    const bg = this.scene.add.graphics();
    const pw = 180;
    const ph = 32;

    bg.fillStyle(0x0f172a, 0.95);
    bg.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
    bg.lineStyle(1.5, 0x38bdf8, 1);
    bg.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 8);
    insp.add(bg);

    const makeBtn = (bx: number, txt: string, onClick: () => void) => {
      const t = this.scene.add.text(bx, 0, txt, {
        fontFamily: FONT,
        fontSize: '13px',
        color: '#ffffff',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerdown', onClick);
      t.on('pointerover', () => t.setColor('#38bdf8'));
      t.on('pointerout', () => t.setColor('#ffffff'));
      insp.add(t);
    };

    // Scale Up
    makeBtn(-60, '🔍+', () => {
      sc.scale = Math.round((sc.scale + 0.1) * 10) / 10;
      this.scene.redrawLevelLayout();
      this.buildGizmos();
      this.showSceneryInspector(sc, scIdx);
    });

    // Scale Down
    makeBtn(-25, '🔍-', () => {
      sc.scale = Math.max(0.4, Math.round((sc.scale - 0.1) * 10) / 10);
      this.scene.redrawLevelLayout();
      this.buildGizmos();
      this.showSceneryInspector(sc, scIdx);
    });

    // Flip X
    makeBtn(15, '⇄ Flip', () => {
      sc.flipX = !sc.flipX;
      this.scene.redrawLevelLayout();
      this.buildGizmos();
      this.showSceneryInspector(sc, scIdx);
    });

    // Delete
    makeBtn(60, '🗑️', () => {
      this.scene.currentLayout.scenery.splice(scIdx, 1);
      this.selectedSceneryId = undefined;
      this.scene.redrawLevelLayout();
      this.buildGizmos();
      this.scene.floatText(sc.x, sc.y, 'PROP REMOVED', '#f87171', '#450a0a');
    });

    this.gizmoContainer?.add(insp);
  }

  /**
   * Adds a new branch to the currently selected tree
   */
  private addBranch() {
    const tree = this.scene.currentLayout.trees[this.selectedTreeIndex] ?? this.scene.currentLayout.trees[0];
    if (!tree) return;

    const isLeft = tree.trunkX < 640;
    const newX = isLeft ? tree.trunkX + 160 : tree.trunkX - 160;
    const newY = 380 + Math.floor(Math.random() * 100);
    const fromY = newY + 25;
    const fromX = getTrunkEdgeAtY(tree, fromY, 'auto', newX);

    const newBranch: BranchDef = {
      x: newX,
      y: newY,
      nest: true,
      from: [fromX, fromY],
      startW: 32,
      endW: 15,
      isBirch: tree.style === 'birch',
    };

    tree.branches.push(newBranch);
    this.scene.redrawLevelLayout();
    this.buildGizmos();
    this.scene.floatText(newX, newY - 30, '🌿 NEW BRANCH ADDED!', '#4ade80', '#064e3b');
  }

  /**
   * Cycles tree style (Oak -> Birch -> Mangrove -> Kapok -> Sakura -> Pine -> Basalt)
   */
  private cycleTreeStyle() {
    const tree = this.scene.currentLayout.trees[this.selectedTreeIndex] ?? this.scene.currentLayout.trees[0];
    if (!tree) return;

    const styles: TreeStyle[] = ['oak', 'birch', 'mangrove', 'kapok', 'sakura', 'pine', 'basalt'];
    const curIdx = styles.indexOf(tree.style);
    const nextStyle = styles[(curIdx + 1) % styles.length];
    tree.style = nextStyle;
    tree.name = nextStyle.charAt(0).toUpperCase() + nextStyle.slice(1);

    // Update birch flag if switching to/from birch
    for (const b of tree.branches) {
      b.isBirch = nextStyle === 'birch';
    }

    this.scene.redrawLevelLayout();
    this.buildGizmos();
    this.scene.floatText(tree.trunkX, 280, `TREE STYLE: ${tree.style.toUpperCase()}`, '#f59e0b', '#451a03');
  }

  /**
   * Visual Palette dropdown to pick and add scenery props
   */
  private toggleSceneryPicker() {
    if (this.sceneryPickerOpen) {
      if (this.sceneryPickerContainer) {
        this.sceneryPickerContainer.destroy();
        this.sceneryPickerContainer = undefined;
      }
      this.sceneryPickerOpen = false;
      return;
    }

    this.sceneryPickerOpen = true;
    const pw = 500;
    const ph = 340;
    const contX = Math.round((1280 - pw) / 2);
    const cont = this.scene.add.container(contX, 75).setDepth(210).setScrollFactor(0);
    this.sceneryPickerContainer = cont;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0f172a, 0.98);
    bg.fillRoundedRect(0, 0, pw, ph, 14);
    bg.lineStyle(2, 0xa855f7, 1);
    bg.strokeRoundedRect(0, 0, pw, ph, 14);

    const title = this.scene.add.text(pw / 2, 20, 'SELECT SCENERY PROP TO PLACE', {
      fontFamily: FONT,
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#c084fc',
    }).setOrigin(0.5);

    const closeBtn = this.scene.add.text(pw - 22, 20, '✖', {
      fontFamily: FONT,
      fontSize: '14px',
      color: '#94a3b8',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.toggleSceneryPicker());

    cont.add([bg, title, closeBtn]);

    // Grid of props (5 columns x rows)
    SCENERY_PALETTE.forEach((item, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const ix = 52 + col * 98;
      const iy = 66 + row * 66;

      const card = this.scene.add.container(ix, iy);
      const cg = this.scene.add.graphics();
      cg.fillStyle(0x1e293b, 1);
      cg.fillRoundedRect(-42, -26, 84, 52, 8);
      cg.lineStyle(1.5, 0x64748b, 0.8);
      cg.strokeRoundedRect(-42, -26, 84, 52, 8);

      const preview = this.scene.add.image(0, -7, item.texture);
      const maxDim = Math.max(preview.width || 48, preview.height || 48);
      preview.setScale(Math.min(0.65, 34 / maxDim));

      const shortName = item.name.length > 9 ? item.name.slice(0, 8) + '…' : item.name;
      const label = this.scene.add.text(0, 15, `${item.icon} ${shortName}`, {
        fontFamily: FONT,
        fontSize: '10px',
        color: '#e2e8f0',
      }).setOrigin(0.5);

      card.add([cg, preview, label]);
      card.setSize(84, 52).setInteractive({ useHandCursor: true });

      card.on('pointerdown', () => {
        this.addScenery(item.texture);
        this.toggleSceneryPicker();
      });
      card.on('pointerover', () => cg.lineStyle(2, 0x38bdf8, 1).strokeRoundedRect(-42, -26, 84, 52, 8));
      card.on('pointerout', () => cg.lineStyle(1.5, 0x64748b, 0.8).strokeRoundedRect(-42, -26, 84, 52, 8));

      cont.add(card);
    });
  }

  private addScenery(texture: string) {
    const newId = `sc_${Date.now()}`;
    const newItem: SceneryItemDef = {
      id: newId,
      texture,
      x: 640 + Math.floor((Math.random() - 0.5) * 200),
      y: 580,
      scale: 1.0,
      flipX: Math.random() < 0.5,
      depth: 1,
    };
    this.scene.currentLayout.scenery.push(newItem);
    this.selectedSceneryId = newId;
    this.scene.redrawLevelLayout();
    this.buildGizmos();
    this.scene.floatText(newItem.x, newItem.y - 30, '🪨 PROP PLACED! (Drag to position)', '#38bdf8', '#0f172a');
  }

  private copyJSON() {
    const jsonStr = JSON.stringify(this.scene.currentLayout, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        this.scene.floatText(640, 360, '📋 JSON COPIED TO CLIPBOARD!', '#38bdf8', '#082f49');
      }).catch(() => {
        console.log('--- LEVEL DESIGN JSON EXPORT ---');
        console.log(jsonStr);
        this.scene.floatText(640, 360, '📋 PRINTED JSON TO BROWSER CONSOLE!', '#fde047', '#082f49');
      });
    } else {
      console.log('--- LEVEL DESIGN JSON EXPORT ---');
      console.log(jsonStr);
      this.scene.floatText(640, 360, '📋 PRINTED JSON TO BROWSER CONSOLE!', '#fde047', '#082f49');
    }
  }

  private resetToDefault() {
    resetLevelLayout(this.scene.currentLayout.levelKey);
    this.scene.reloadDefaultLayout();
    this.buildGizmos();
    this.scene.floatText(640, 360, '↺ REVERTED TO DEFAULT LAYOUT', '#ef4444', '#450a0a');
  }
}
