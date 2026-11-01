import Phaser from 'phaser';
import { EditorScene, SelectionInfo } from './EditorScene';
import {
  LevelLayoutDef,
  TreeDef,
  BranchDef,
  FreePerchDef,
  LeafClusterDef,
  SceneryItemDef,
  TreeStyle,
  SCENERY_PALETTE,
  loadLevelLayout,
  saveLevelLayout,
  resetLevelLayout,
  getDefaultLevelDesign,
} from '../LevelDesignData';

let currentStageKey = 'world_1_stage_1';
let currentWorldId = 1;
let scene: EditorScene;

// Stage selector change
const stageSelect = document.getElementById('stage-select') as HTMLSelectElement;

function getStageInfo(key: string): { key: string; worldId: number } {
  if (key === 'sandbox') return { key: 'sandbox', worldId: 1 };
  if (key === 'challenge_night_bats') return { key: 'challenge_night_bats', worldId: 1 };
  const match = key.match(/world_(\d+)_stage_(\d+)/);
  if (match) {
    return { key, worldId: parseInt(match[1], 10) };
  }
  return { key, worldId: 1 };
}

function loadActiveStage() {
  const info = getStageInfo(stageSelect.value);
  currentStageKey = info.key;
  currentWorldId = info.worldId;

  const layout = loadLevelLayout(currentStageKey, currentWorldId);
  scene.setLayout(layout);
  refreshHierarchy();
  renderInspector();
}

// Initialize Phaser
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'editor-phaser-root',
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  render: {
    antialias: true,
    antialiasGL: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  scene: [EditorScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

game.events.once('ready', () => {
  scene = game.scene.getScene('EditorScene') as EditorScene;

  scene.onSelectionChanged = (sel) => {
    highlightHierarchyNode(sel);
    renderInspector();
  };

  scene.onLayoutModified = () => {
    refreshHierarchy();
    renderInspector();
  };

  const zoomVal = document.getElementById('hud-zoom-val');
  const btnResetView = document.getElementById('btn-reset-view');

  scene.onCameraChanged = () => {
    if (zoomVal) {
      const pct = Math.round(scene.cameras.main.zoom * 100);
      zoomVal.innerText = `${pct}%`;
    }
  };

  btnResetView?.addEventListener('click', () => {
    scene.resetView();
  });

  loadActiveStage();
});

stageSelect.addEventListener('change', () => {
  loadActiveStage();
  showToast(`Loaded ${stageSelect.selectedOptions[0].text}`);
});

// Toast notification helper
function showToast(msg: string) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------------------------------------------------------------------------
// HIERARCHY OUTLINER
// ---------------------------------------------------------------------------
function refreshHierarchy() {
  const treeContainer = document.getElementById('hierarchy-tree');
  const countBadge = document.getElementById('obj-count');
  if (!treeContainer || !scene?.layout) return;

  treeContainer.innerHTML = '';
  let totalObjs = 0;

  // Trees and Branches
  scene.layout.trees.forEach((tree, tIdx) => {
    totalObjs++;
    const isTreeSelected = scene.selection.type === 'tree' && scene.selection.treeIndex === tIdx;

    const tNode = document.createElement('div');
    tNode.className = `tree-node ${isTreeSelected ? 'selected' : ''}`;
    tNode.innerHTML = `
      <span>🌳 <b>${tree.name || tree.style.toUpperCase()}</b></span>
      <span style="font-size:11px; opacity:0.6;">X=${tree.trunkX}</span>
    `;
    tNode.onclick = (e) => {
      e.stopPropagation();
      scene.select({ type: 'tree', treeIndex: tIdx });
    };
    treeContainer.appendChild(tNode);

    // Branches
    tree.branches.forEach((b, bIdx) => {
      totalObjs++;
      const isBranchSelected =
        scene.selection.type === 'branch' &&
        scene.selection.treeIndex === tIdx &&
        scene.selection.branchIndex === bIdx;

      const bNode = document.createElement('div');
      bNode.className = `tree-node tree-node-sub ${isBranchSelected ? 'selected' : ''}`;
      bNode.innerHTML = `
        <span>🐦 Branch #${bIdx + 1}</span>
        <span style="font-size:11px; opacity:0.6;">(${b.x}, ${b.y})</span>
      `;
      bNode.onclick = (e) => {
        e.stopPropagation();
        scene.select({ type: 'branch', treeIndex: tIdx, branchIndex: bIdx });
      };
      treeContainer.appendChild(bNode);

      if (b.nest) {
        totalObjs++;
        const isNestSelected =
          scene.selection.type === 'nest' &&
          scene.selection.treeIndex === tIdx &&
          scene.selection.branchIndex === bIdx;
        const nx = b.nestX ?? b.x;
        const ny = b.nestY ?? (b.y - 4);
        const nNode = document.createElement('div');
        nNode.className = `tree-node ${isNestSelected ? 'selected' : ''}`;
        nNode.style.paddingLeft = '38px';
        nNode.innerHTML = `
          <span>🪺 Nest Bowl</span>
          <span style="font-size:11px; color:#facc15;">(${nx}, ${ny})</span>
        `;
        nNode.onclick = (e) => {
          e.stopPropagation();
          scene.select({ type: 'nest', treeIndex: tIdx, branchIndex: bIdx });
        };
        treeContainer.appendChild(nNode);
      }
    });
  });

  // Free Standalone Perches & Nests Category
  if (scene.layout.freePerches && scene.layout.freePerches.length > 0) {
    const fpHdr = document.createElement('div');
    fpHdr.style.cssText = 'font-size:11px; font-weight:700; color:#facc15; margin:10px 4px 4px; text-transform:uppercase;';
    fpHdr.innerText = `Free Nests & Perches (${scene.layout.freePerches.length})`;
    treeContainer.appendChild(fpHdr);

    scene.layout.freePerches.forEach((fp, fpIdx) => {
      totalObjs++;
      const isFpSel = scene.selection.type === 'freePerch' && scene.selection.freePerchIndex === fpIdx;
      const fpNode = document.createElement('div');
      fpNode.className = `tree-node ${isFpSel ? 'selected' : ''}`;
      fpNode.innerHTML = `
        <span>${fp.isNest ? '🪺 Free Nest' : '🐦 Free Perch'}</span>
        <span style="font-size:11px; opacity:0.6;">(${fp.x}, ${fp.y})</span>
      `;
      fpNode.onclick = (e) => {
        e.stopPropagation();
        scene.select({ type: 'freePerch', freePerchIndex: fpIdx });
      };
      treeContainer.appendChild(fpNode);
    });
  }

  // Free Leaf Foliage Clusters Category
  if (scene.layout.leafClusters && scene.layout.leafClusters.length > 0) {
    const lcHdr = document.createElement('div');
    lcHdr.style.cssText = 'font-size:11px; font-weight:700; color:#4ade80; margin:10px 4px 4px; text-transform:uppercase;';
    lcHdr.innerText = `Leaf Foliage Clusters (${scene.layout.leafClusters.length})`;
    treeContainer.appendChild(lcHdr);

    scene.layout.leafClusters.forEach((lc, lcIdx) => {
      totalObjs++;
      const isLcSel = scene.selection.type === 'leafCluster' && scene.selection.leafClusterIndex === lcIdx;
      const lcNode = document.createElement('div');
      lcNode.className = `tree-node ${isLcSel ? 'selected' : ''}`;
      lcNode.innerHTML = `
        <span>🍃 Leaf Puff</span>
        <span style="font-size:11px; opacity:0.6;">(${lc.x}, ${lc.y})</span>
      `;
      lcNode.onclick = (e) => {
        e.stopPropagation();
        scene.select({ type: 'leafCluster', leafClusterIndex: lcIdx });
      };
      treeContainer.appendChild(lcNode);
    });
  }

  // Scenery Props Category
  const scHeader = document.createElement('div');
  scHeader.style.cssText = 'font-size:11px; font-weight:700; color:#9ca3af; margin:10px 4px 4px; text-transform:uppercase;';
  scHeader.innerText = `Scenery Props (${scene.layout.scenery.length})`;
  treeContainer.appendChild(scHeader);

  scene.layout.scenery.forEach((sc, scIdx) => {
    totalObjs++;
    const isScSelected = scene.selection.type === 'scenery' && scene.selection.sceneryIndex === scIdx;
    const sNode = document.createElement('div');
    sNode.className = `tree-node ${isScSelected ? 'selected' : ''}`;
    const propMeta = SCENERY_PALETTE.find((p) => p.texture === sc.texture);
    const label = propMeta ? `${propMeta.icon} ${propMeta.name}` : sc.texture;

    sNode.innerHTML = `
      <span>${label}</span>
      <span style="font-size:11px; opacity:0.6;">(${sc.x}, ${sc.y})</span>
    `;
    sNode.onclick = (e) => {
      e.stopPropagation();
      scene.select({ type: 'scenery', sceneryIndex: scIdx });
    };
    treeContainer.appendChild(sNode);
  });

  if (countBadge) countBadge.innerText = `${totalObjs} objects`;
}

function highlightHierarchyNode(sel: SelectionInfo) {
  // Simply re-render classes
  refreshHierarchy();
}

// ---------------------------------------------------------------------------
// INSPECTOR / PROPERTIES PANEL
// ---------------------------------------------------------------------------
function renderInspector() {
  const body = document.getElementById('inspector-body');
  const badge = document.getElementById('selected-type-badge');
  if (!body || !badge || !scene?.layout) return;

  const { type, treeIndex, branchIndex, sceneryIndex } = scene.selection;

  if (type === 'none') {
    badge.innerText = 'Stage Overview';
    body.innerHTML = `
      <div class="prop-group">
        <div class="prop-label"><span>STAGE IDENTIFIER</span></div>
        <div style="font-family:'Fira Code', monospace; color:#38bdf8; font-size:13px;">${scene.layout.levelKey}</div>
      </div>
      <div class="prop-group">
        <div class="prop-label"><span>ENVIRONMENT SUMMARY</span></div>
        <div style="font-size:13px; line-height:1.6; color:#9ca3af;">
          • Trees: <b>${scene.layout.trees.length}</b><br/>
          • Total Branches: <b>${scene.layout.trees.reduce((acc, t) => acc + t.branches.length, 0)}</b><br/>
          • Nests: <b>${scene.layout.trees.reduce((acc, t) => acc + t.branches.filter((b) => b.nest).length, 0)}</b><br/>
          • Props: <b>${scene.layout.scenery.length}</b>
        </div>
      </div>
      <div style="font-size:12px; color:#6b7280; text-align:center; padding:12px 0;">
        Select an element in the hierarchy or viewport to inspect and customize it.
      </div>
    `;
    return;
  }

  // 1. TREE INSPECTOR
  if (type === 'tree' && treeIndex !== undefined && scene.layout.trees[treeIndex]) {
    const tree = scene.layout.trees[treeIndex];
    badge.innerText = `Tree: ${tree.name}`;
    body.innerHTML = `
      <div class="prop-group">
        <div class="prop-label"><span>TREE NAME</span></div>
        <input type="text" id="inp-tree-name" value="${tree.name}" />
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>TREE STYLE</span></div>
        <select id="inp-tree-style" class="select-input" style="width:100%;">
          ${['oak', 'birch', 'mangrove', 'kapok', 'sakura', 'pine', 'basalt'].map(
            (s) => `<option value="${s}" ${tree.style === s ? 'selected' : ''}>${s.toUpperCase()}</option>`
          ).join('')}
        </select>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>TRUNK BASE X</span> <span id="val-trunk-x">${tree.trunkX}px</span></div>
        <div class="prop-row">
          <input type="range" id="rng-trunk-x" min="80" max="1200" value="${tree.trunkX}" />
          <input type="number" id="inp-trunk-x" min="80" max="1200" value="${tree.trunkX}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>TRUNK BASE Y (ELEVATION)</span> <span id="val-trunk-y">${tree.trunkY ?? 625}px</span></div>
        <div class="prop-row">
          <input type="range" id="rng-trunk-y" min="300" max="720" value="${tree.trunkY ?? 625}" />
          <input type="number" id="inp-trunk-y" min="300" max="720" value="${tree.trunkY ?? 625}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>TREE SCALE (SIZE)</span> <span id="val-tree-scale">${(tree.scale ?? 1.0).toFixed(2)}x</span></div>
        <div class="prop-row">
          <input type="range" id="rng-tree-scale" min="40" max="250" value="${Math.round((tree.scale ?? 1.0) * 100)}" />
          <input type="number" id="inp-tree-scale" min="0.4" max="2.5" step="0.05" value="${tree.scale ?? 1.0}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>TRUNK TOP (TRIM / HEIGHT)</span> <span id="val-tree-topy">${tree.topY ?? (tree.style === 'birch' ? 260 : 300)}px</span></div>
        <div class="prop-row">
          <input type="range" id="rng-tree-topy" min="120" max="480" value="${tree.topY ?? (tree.style === 'birch' ? 260 : 300)}" />
          <input type="number" id="inp-tree-topy" min="120" max="480" value="${tree.topY ?? (tree.style === 'birch' ? 260 : 300)}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>CANOPY CENTER X</span> <span id="val-canopy-x">${tree.canopyX ?? tree.trunkX}px</span></div>
        <div class="prop-row">
          <input type="range" id="rng-canopy-x" min="80" max="1200" value="${tree.canopyX ?? tree.trunkX}" />
          <input type="number" id="inp-canopy-x" min="80" max="1200" value="${tree.canopyX ?? tree.trunkX}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>CANOPY ELEVATION (LEAVES Y)</span> <span id="val-canopy-y">${tree.canopyY ?? 210}px</span></div>
        <div class="prop-row">
          <input type="range" id="rng-canopy-y" min="60" max="450" value="${tree.canopyY ?? 210}" />
          <input type="number" id="inp-canopy-y" min="60" max="450" value="${tree.canopyY ?? 210}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>CANOPY SPREAD (RADIUS)</span> <span id="val-canopy-rad">${tree.canopyRadius ?? 180}px</span></div>
        <div class="prop-row">
          <input type="range" id="rng-canopy-rad" min="80" max="320" value="${tree.canopyRadius ?? 180}" />
          <input type="number" id="inp-canopy-rad" min="80" max="320" value="${tree.canopyRadius ?? 180}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>LEAF DENSITY</span> <span id="val-leaf-density">${(tree.leafDensity ?? 1.0).toFixed(1)}x</span></div>
        <div class="prop-row">
          <input type="range" id="rng-leaf-density" min="40" max="200" value="${Math.round((tree.leafDensity ?? 1.0) * 100)}" />
          <input type="number" id="inp-leaf-density" min="0.4" max="2.0" step="0.1" value="${tree.leafDensity ?? 1.0}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group" style="gap:10px;">
        <button id="btn-tree-add-branch" class="btn btn-primary" style="justify-content:center;">➕ Add Branch to this Tree</button>
        <button id="btn-tree-delete" class="btn btn-danger" style="justify-content:center;">🗑️ Delete Tree</button>
      </div>
    `;

    // Event handlers
    const inpName = document.getElementById('inp-tree-name') as HTMLInputElement;
    inpName.oninput = () => {
      tree.name = inpName.value;
      refreshHierarchy();
    };

    const selStyle = document.getElementById('inp-tree-style') as HTMLSelectElement;
    selStyle.onchange = () => {
      tree.style = selStyle.value as TreeStyle;
      for (const b of tree.branches) {
        b.isBirch = tree.style === 'birch';
      }
      scene.renderAll();
      refreshHierarchy();
    };

    const rngX = document.getElementById('rng-trunk-x') as HTMLInputElement;
    const inpX = document.getElementById('inp-trunk-x') as HTMLInputElement;
    const valX = document.getElementById('val-trunk-x') as HTMLElement;

    const updateTrunkX = (newX: number) => {
      const deltaX = newX - tree.trunkX;
      tree.trunkX = newX;
      if (tree.canopyX !== undefined) tree.canopyX += deltaX;
      for (const b of tree.branches) {
        b.from[0] += deltaX;
        b.x += deltaX;
        if (b.nestX !== undefined) b.nestX += deltaX;
      }
      rngX.value = String(newX);
      inpX.value = String(newX);
      valX.innerText = `${newX}px`;
      scene.renderAll();
      refreshHierarchy();
    };

    rngX.oninput = () => updateTrunkX(parseInt(rngX.value, 10));
    inpX.onchange = () => updateTrunkX(parseInt(inpX.value, 10));

    // Trunk Base Y
    const rngY = document.getElementById('rng-trunk-y') as HTMLInputElement;
    const inpY = document.getElementById('inp-trunk-y') as HTMLInputElement;
    const valY = document.getElementById('val-trunk-y') as HTMLElement;

    const updateTrunkY = (newY: number) => {
      const deltaY = newY - (tree.trunkY ?? 625);
      tree.trunkY = newY;
      if (tree.topY !== undefined) tree.topY += deltaY;
      if (tree.canopyY !== undefined) tree.canopyY += deltaY;
      for (const b of tree.branches) {
        b.from[1] += deltaY;
        b.y += deltaY;
        if (b.nestY !== undefined) b.nestY += deltaY;
      }
      rngY.value = String(newY);
      inpY.value = String(newY);
      valY.innerText = `${newY}px`;
      scene.renderAll();
      refreshHierarchy();
    };

    if (rngY && inpY) {
      rngY.oninput = () => updateTrunkY(parseInt(rngY.value, 10));
      inpY.onchange = () => updateTrunkY(parseInt(inpY.value, 10));
    }

    // Tree Scale
    const rngScale = document.getElementById('rng-tree-scale') as HTMLInputElement;
    const inpScale = document.getElementById('inp-tree-scale') as HTMLInputElement;
    const valScale = document.getElementById('val-tree-scale') as HTMLElement;
    const updateScale = (sVal: number) => {
      tree.scale = sVal;
      valScale.innerText = `${sVal.toFixed(2)}x`;
      inpScale.value = String(sVal);
      rngScale.value = String(Math.round(sVal * 100));
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
    };
    rngScale.oninput = () => updateScale(parseInt(rngScale.value, 10) / 100);
    inpScale.onchange = () => updateScale(parseFloat(inpScale.value));

    // Trunk Top Trim
    const rngTopY = document.getElementById('rng-tree-topy') as HTMLInputElement;
    const inpTopY = document.getElementById('inp-tree-topy') as HTMLInputElement;
    const valTopY = document.getElementById('val-tree-topy') as HTMLElement;
    const updateTopY = (yVal: number) => {
      const diffY = yVal - (tree.topY ?? (tree.style === 'birch' ? 260 : 300));
      tree.topY = yVal;
      if (tree.canopyY !== undefined) tree.canopyY += diffY;
      valTopY.innerText = `${yVal}px`;
      inpTopY.value = String(yVal);
      rngTopY.value = String(yVal);
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
    };
    rngTopY.oninput = () => updateTopY(parseInt(rngTopY.value, 10));
    inpTopY.onchange = () => updateTopY(parseInt(inpTopY.value, 10));

    // Canopy Center X
    const rngCanX = document.getElementById('rng-canopy-x') as HTMLInputElement;
    const inpCanX = document.getElementById('inp-canopy-x') as HTMLInputElement;
    const valCanX = document.getElementById('val-canopy-x') as HTMLElement;
    const updateCanX = (xVal: number) => {
      tree.canopyX = xVal;
      valCanX.innerText = `${xVal}px`;
      inpCanX.value = String(xVal);
      rngCanX.value = String(xVal);
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
    };
    if (rngCanX && inpCanX) {
      rngCanX.oninput = () => updateCanX(parseInt(rngCanX.value, 10));
      inpCanX.onchange = () => updateCanX(parseInt(inpCanX.value, 10));
    }

    // Canopy Elevation Y
    const rngCanY = document.getElementById('rng-canopy-y') as HTMLInputElement;
    const inpCanY = document.getElementById('inp-canopy-y') as HTMLInputElement;
    const valCanY = document.getElementById('val-canopy-y') as HTMLElement;
    const updateCanY = (yVal: number) => {
      tree.canopyY = yVal;
      valCanY.innerText = `${yVal}px`;
      inpCanY.value = String(yVal);
      rngCanY.value = String(yVal);
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
    };
    rngCanY.oninput = () => updateCanY(parseInt(rngCanY.value, 10));
    inpCanY.onchange = () => updateCanY(parseInt(inpCanY.value, 10));

    // Canopy Radius
    const rngCanRad = document.getElementById('rng-canopy-rad') as HTMLInputElement;
    const inpCanRad = document.getElementById('inp-canopy-rad') as HTMLInputElement;
    const valCanRad = document.getElementById('val-canopy-rad') as HTMLElement;
    const updateCanRad = (rad: number) => {
      tree.canopyRadius = rad;
      valCanRad.innerText = `${rad}px`;
      inpCanRad.value = String(rad);
      rngCanRad.value = String(rad);
      scene.renderTrees();
      scene.updateGizmoVisuals();
    };
    rngCanRad.oninput = () => updateCanRad(parseInt(rngCanRad.value, 10));
    inpCanRad.onchange = () => updateCanRad(parseInt(inpCanRad.value, 10));

    // Leaf Density
    const rngDens = document.getElementById('rng-leaf-density') as HTMLInputElement;
    const inpDens = document.getElementById('inp-leaf-density') as HTMLInputElement;
    const valDens = document.getElementById('val-leaf-density') as HTMLElement;
    const updateDens = (dVal: number) => {
      tree.leafDensity = dVal;
      valDens.innerText = `${dVal.toFixed(1)}x`;
      inpDens.value = String(dVal);
      rngDens.value = String(Math.round(dVal * 100));
      scene.renderTrees();
      scene.updateGizmoVisuals();
    };
    rngDens.oninput = () => updateDens(parseInt(rngDens.value, 10) / 100);
    inpDens.onchange = () => updateDens(parseFloat(inpDens.value));

    document.getElementById('btn-tree-add-branch')!.onclick = () => {
      addBranchToTree(treeIndex);
    };

    document.getElementById('btn-tree-delete')!.onclick = () => {
      if (confirm(`Delete ${tree.name}?`)) {
        scene.layout.trees.splice(treeIndex, 1);
        scene.select({ type: 'none' });
        scene.renderAll();
        refreshHierarchy();
      }
    };
    return;
  }

  // 2. BRANCH INSPECTOR
  if (
    type === 'branch' &&
    treeIndex !== undefined &&
    branchIndex !== undefined &&
    scene.layout.trees[treeIndex]?.branches[branchIndex]
  ) {
    const tree = scene.layout.trees[treeIndex];
    const b = tree.branches[branchIndex];
    badge.innerText = `Branch #${branchIndex + 1} (${b.nest ? 'Nest' : 'Perch'})`;

    body.innerHTML = `
      <div class="prop-group">
        <div class="prop-label"><span>PERCH POSITION (BIRD REST)</span></div>
        <div class="prop-row">
          <label style="font-size:12px; width:16px;">X:</label>
          <input type="number" id="inp-b-x" value="${b.x}" min="40" max="1240" />
          <label style="font-size:12px; width:16px;">Y:</label>
          <input type="number" id="inp-b-y" value="${b.y}" min="160" max="580" />
        </div>
        <input type="range" id="rng-b-x" min="40" max="1240" value="${b.x}" />
        <input type="range" id="rng-b-y" min="160" max="580" value="${b.y}" />
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>TRUNK ATTACHMENT SOCKET</span></div>
        <div class="prop-row">
          <label style="font-size:12px; width:16px;">X:</label>
          <input type="number" id="inp-from-x" value="${b.from[0]}" />
          <label style="font-size:12px; width:16px;">Y:</label>
          <input type="number" id="inp-from-y" value="${b.from[1]}" min="220" max="620" />
        </div>
        <button id="btn-snap-trunk" class="btn btn-primary" style="justify-content:center; margin-top:4px;">
          🔗 Snap Socket to Trunk Contour
        </button>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>BRANCH THICKNESS</span></div>
        <div class="prop-row">
          <label style="font-size:12px; color:#9ca3af;">Base:</label>
          <input type="number" id="inp-start-w" value="${b.startW}" min="10" max="60" />
          <label style="font-size:12px; color:#9ca3af;">Tip:</label>
          <input type="number" id="inp-end-w" value="${b.endW}" min="6" max="30" />
        </div>
      </div>

      <div class="prop-group" style="gap:12px;">
        <label class="checkbox-label">
          <input type="checkbox" id="chk-nest" ${b.nest ? 'checked' : ''} />
          <span>🪺 Holds Egg Nest</span>
        </label>
        ${
          b.nest
            ? `<button id="btn-goto-nest" class="btn btn-secondary" style="justify-content:center; font-size:12px; margin-top:-4px;">
                🪺 Edit Nest Position (${b.nestX ?? b.x}, ${b.nestY ?? b.y - 4})
              </button>`
            : ''
        }
        <label class="checkbox-label">
          <input type="checkbox" id="chk-leaves" ${b.leaves !== false ? 'checked' : ''} />
          <span>🍃 Lush Foliage & Leaves</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="chk-birch" ${b.isBirch ? 'checked' : ''} />
          <span>Paper Birch Bark</span>
        </label>
      </div>

      <div class="prop-group">
        <button id="btn-delete-branch" class="btn btn-danger" style="justify-content:center;">🗑️ Delete Branch</button>
      </div>
    `;

    // Input bindings
    const inpBX = document.getElementById('inp-b-x') as HTMLInputElement;
    const inpBY = document.getElementById('inp-b-y') as HTMLInputElement;
    const rngBX = document.getElementById('rng-b-x') as HTMLInputElement;
    const rngBY = document.getElementById('rng-b-y') as HTMLInputElement;

    const updatePerch = () => {
      b.x = parseInt(inpBX.value, 10);
      b.y = parseInt(inpBY.value, 10);
      rngBX.value = String(b.x);
      rngBY.value = String(b.y);
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
    };

    inpBX.onchange = updatePerch;
    inpBY.onchange = updatePerch;
    rngBX.oninput = () => { inpBX.value = rngBX.value; updatePerch(); };
    rngBY.oninput = () => { inpBY.value = rngBY.value; updatePerch(); };

    const inpFromX = document.getElementById('inp-from-x') as HTMLInputElement;
    const inpFromY = document.getElementById('inp-from-y') as HTMLInputElement;

    const updateFrom = () => {
      b.from[0] = parseInt(inpFromX.value, 10);
      b.from[1] = parseInt(inpFromY.value, 10);
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
    };

    inpFromX.onchange = updateFrom;
    inpFromY.onchange = updateFrom;

    // Snap to Trunk button!
    document.getElementById('btn-snap-trunk')!.onclick = () => {
      scene.snapBranchToTrunk(treeIndex, branchIndex);
      inpFromX.value = String(b.from[0]);
      showToast('🔗 Snapped branch flush to trunk contour!');
    };

    // Thickness
    const inpStartW = document.getElementById('inp-start-w') as HTMLInputElement;
    const inpEndW = document.getElementById('inp-end-w') as HTMLInputElement;
    inpStartW.onchange = () => { b.startW = parseInt(inpStartW.value, 10); scene.renderTrees(); };
    inpEndW.onchange = () => { b.endW = parseInt(inpEndW.value, 10); scene.renderTrees(); };

    // Toggles
    const chkNest = document.getElementById('chk-nest') as HTMLInputElement;
    chkNest.onchange = () => {
      b.nest = chkNest.checked;
      if (b.nest && b.nestX === undefined) {
        b.nestX = b.x;
        b.nestY = b.y - 4;
      }
      badge.innerText = `Branch #${branchIndex + 1} (${b.nest ? 'Nest' : 'Perch'})`;
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
      renderInspector();
    };

    const btnGotoNest = document.getElementById('btn-goto-nest');
    if (btnGotoNest) {
      btnGotoNest.onclick = () => {
        scene.select({ type: 'nest', treeIndex, branchIndex });
      };
    }

    const chkLeaves = document.getElementById('chk-leaves') as HTMLInputElement;
    chkLeaves.onchange = () => {
      b.leaves = chkLeaves.checked;
      scene.renderTrees();
      scene.updateGizmoVisuals();
    };

    const chkBirch = document.getElementById('chk-birch') as HTMLInputElement;
    chkBirch.onchange = () => {
      b.isBirch = chkBirch.checked;
      scene.renderTrees();
    };

    // Delete
    document.getElementById('btn-delete-branch')!.onclick = () => {
      tree.branches.splice(branchIndex, 1);
      scene.select({ type: 'tree', treeIndex });
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
    };
    return;
  }

  // 2.5 NEST INSPECTOR
  if (
    type === 'nest' &&
    treeIndex !== undefined &&
    branchIndex !== undefined &&
    scene.layout.trees[treeIndex]?.branches[branchIndex]
  ) {
    const tree = scene.layout.trees[treeIndex];
    const b = tree.branches[branchIndex];
    badge.innerText = `🪺 Nest Bowl (Branch #${branchIndex + 1})`;
    const nx = b.nestX ?? b.x;
    const ny = b.nestY ?? (b.y - 4);

    body.innerHTML = `
      <div class="prop-group">
        <div class="prop-label"><span>NEST POSITION (WHERE BIRDS NEST)</span></div>
        <div class="prop-row">
          <label style="font-size:12px; width:16px;">X:</label>
          <input type="number" id="inp-nest-x" value="${nx}" min="40" max="1240" />
          <label style="font-size:12px; width:16px;">Y:</label>
          <input type="number" id="inp-nest-y" value="${ny}" min="140" max="600" />
        </div>
        <input type="range" id="rng-nest-x" min="40" max="1240" value="${nx}" />
        <input type="range" id="rng-nest-y" min="140" max="600" value="${ny}" />
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>QUICK PLACEMENT PRESETS</span></div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <button id="btn-nest-tip" class="btn btn-secondary" style="justify-content:center; font-size:12px;">📍 Branch Tip</button>
          <button id="btn-nest-mid" class="btn btn-secondary" style="justify-content:center; font-size:12px;">🌿 Mid-Branch Bough</button>
          <button id="btn-nest-trunk" class="btn btn-secondary" style="justify-content:center; font-size:12px;">🌳 Trunk Fork / Crook</button>
        </div>
      </div>

      <div class="prop-group" style="gap:8px;">
        <button id="btn-back-to-branch" class="btn btn-secondary" style="justify-content:center;">🐦 Select Parent Branch</button>
        <button id="btn-remove-nest" class="btn btn-danger" style="justify-content:center;">❌ Remove Nest from this Branch</button>
      </div>
    `;

    const inpNX = document.getElementById('inp-nest-x') as HTMLInputElement;
    const inpNY = document.getElementById('inp-nest-y') as HTMLInputElement;
    const rngNX = document.getElementById('rng-nest-x') as HTMLInputElement;
    const rngNY = document.getElementById('rng-nest-y') as HTMLInputElement;

    const setNestPos = (x: number, y: number) => {
      b.nestX = x;
      b.nestY = y;
      inpNX.value = String(x);
      rngNX.value = String(x);
      inpNY.value = String(y);
      rngNY.value = String(y);
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
    };

    inpNX.onchange = () => setNestPos(parseInt(inpNX.value, 10), b.nestY ?? (b.y - 4));
    rngNX.oninput = () => setNestPos(parseInt(rngNX.value, 10), b.nestY ?? (b.y - 4));
    inpNY.onchange = () => setNestPos(b.nestX ?? b.x, parseInt(inpNY.value, 10));
    rngNY.oninput = () => setNestPos(b.nestX ?? b.x, parseInt(rngNY.value, 10));

    document.getElementById('btn-nest-tip')!.onclick = () => setNestPos(b.x, b.y - 4);
    document.getElementById('btn-nest-mid')!.onclick = () => {
      const mx = Math.round((b.from[0] + b.x) / 2);
      const my = Math.round((b.from[1] + b.y) / 2 - 12);
      setNestPos(mx, my);
    };
    document.getElementById('btn-nest-trunk')!.onclick = () => setNestPos(b.from[0], b.from[1] - 8);

    document.getElementById('btn-back-to-branch')!.onclick = () => {
      scene.select({ type: 'branch', treeIndex, branchIndex });
    };

    document.getElementById('btn-remove-nest')!.onclick = () => {
      b.nest = false;
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
      scene.select({ type: 'branch', treeIndex, branchIndex });
    };

    return;
  }

  // 2.7 FREE PERCH / FREE NEST INSPECTOR
  if (
    type === 'freePerch' &&
    scene.selection.freePerchIndex !== undefined &&
    scene.layout.freePerches?.[scene.selection.freePerchIndex]
  ) {
    const fp = scene.layout.freePerches[scene.selection.freePerchIndex];
    badge.innerText = fp.isNest ? '🪺 Free Nest' : '🐦 Free Perch';

    body.innerHTML = `
      <div class="prop-group">
        <div class="prop-label"><span>POSITION</span></div>
        <div class="prop-row">
          <label style="font-size:12px; width:16px;">X:</label>
          <input type="number" id="inp-fp-x" value="${fp.x}" min="40" max="1240" />
          <label style="font-size:12px; width:16px;">Y:</label>
          <input type="number" id="inp-fp-y" value="${fp.y}" min="120" max="600" />
        </div>
        <input type="range" id="rng-fp-x" min="40" max="1240" value="${fp.x}" />
        <input type="range" id="rng-fp-y" min="120" max="600" value="${fp.y}" />
      </div>

      <div class="prop-group" style="gap:10px;">
        <label class="checkbox-label">
          <input type="checkbox" id="chk-fp-nest" ${fp.isNest ? 'checked' : ''} />
          <span>🪺 Is Egg Nest Bowl</span>
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="chk-fp-leaves" ${fp.leaves !== false ? 'checked' : ''} />
          <span>🍃 Sprout Leaf Sprig Underneath</span>
        </label>
      </div>

      <div class="prop-group">
        <button id="btn-delete-fp" class="btn btn-danger" style="justify-content:center;">🗑️ Delete This Spot</button>
      </div>
    `;

    const inpX = document.getElementById('inp-fp-x') as HTMLInputElement;
    const inpY = document.getElementById('inp-fp-y') as HTMLInputElement;
    const rngX = document.getElementById('rng-fp-x') as HTMLInputElement;
    const rngY = document.getElementById('rng-fp-y') as HTMLInputElement;

    const updateFp = () => {
      fp.x = parseInt(inpX.value, 10);
      fp.y = parseInt(inpY.value, 10);
      rngX.value = String(fp.x);
      rngY.value = String(fp.y);
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
    };

    inpX.onchange = updateFp;
    inpY.onchange = updateFp;
    rngX.oninput = () => { inpX.value = rngX.value; updateFp(); };
    rngY.oninput = () => { inpY.value = rngY.value; updateFp(); };

    const chkNest = document.getElementById('chk-fp-nest') as HTMLInputElement;
    chkNest.onchange = () => {
      fp.isNest = chkNest.checked;
      badge.innerText = fp.isNest ? '🪺 Free Nest' : '🐦 Free Perch';
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
    };

    const chkLeaves = document.getElementById('chk-fp-leaves') as HTMLInputElement;
    chkLeaves.onchange = () => {
      fp.leaves = chkLeaves.checked;
      scene.renderTrees();
      scene.updateGizmoVisuals();
    };

    document.getElementById('btn-delete-fp')!.onclick = () => {
      scene.layout.freePerches?.splice(scene.selection.freePerchIndex!, 1);
      scene.select({ type: 'none' });
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
    };
    return;
  }

  // 2.8 LEAF CLUSTER INSPECTOR
  if (
    type === 'leafCluster' &&
    scene.selection.leafClusterIndex !== undefined &&
    scene.layout.leafClusters?.[scene.selection.leafClusterIndex]
  ) {
    const lc = scene.layout.leafClusters[scene.selection.leafClusterIndex];
    badge.innerText = '🍃 Leaf Foliage Puff';

    body.innerHTML = `
      <div class="prop-group">
        <div class="prop-label"><span>POSITION</span></div>
        <div class="prop-row">
          <label style="font-size:12px; width:16px;">X:</label>
          <input type="number" id="inp-lc-x" value="${lc.x}" min="30" max="1250" />
          <label style="font-size:12px; width:16px;">Y:</label>
          <input type="number" id="inp-lc-y" value="${lc.y}" min="80" max="620" />
        </div>
        <input type="range" id="rng-lc-x" min="30" max="1250" value="${lc.x}" />
        <input type="range" id="rng-lc-y" min="80" max="620" value="${lc.y}" />
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>CLUSTER SCALE</span> <span id="val-lc-scale">${(lc.scale ?? 1.0).toFixed(1)}x</span></div>
        <div class="prop-row">
          <input type="range" id="rng-lc-scale" min="40" max="250" value="${Math.round((lc.scale ?? 1.0) * 100)}" />
          <input type="number" id="inp-lc-scale" min="0.4" max="2.5" step="0.1" value="${lc.scale ?? 1.0}" style="width:70px;" />
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>LEAF STYLE</span></div>
        <select id="sel-lc-style" class="select-input" style="width:100%;">
          ${['oak', 'birch', 'mangrove', 'kapok', 'sakura', 'pine', 'basalt'].map(
            (s) => `<option value="${s}" ${(lc.style || scene.layout.trees[0]?.style || 'oak') === s ? 'selected' : ''}>${s.toUpperCase()}</option>`
          ).join('')}
        </select>
      </div>

      <div class="prop-group">
        <button id="btn-delete-lc" class="btn btn-danger" style="justify-content:center;">🗑️ Delete Foliage Puff</button>
      </div>
    `;

    const inpX = document.getElementById('inp-lc-x') as HTMLInputElement;
    const inpY = document.getElementById('inp-lc-y') as HTMLInputElement;
    const rngX = document.getElementById('rng-lc-x') as HTMLInputElement;
    const rngY = document.getElementById('rng-lc-y') as HTMLInputElement;

    const updateLc = () => {
      lc.x = parseInt(inpX.value, 10);
      lc.y = parseInt(inpY.value, 10);
      rngX.value = String(lc.x);
      rngY.value = String(lc.y);
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
    };

    inpX.onchange = updateLc;
    inpY.onchange = updateLc;
    rngX.oninput = () => { inpX.value = rngX.value; updateLc(); };
    rngY.oninput = () => { inpY.value = rngY.value; updateLc(); };

    const rngScale = document.getElementById('rng-lc-scale') as HTMLInputElement;
    const inpScale = document.getElementById('inp-lc-scale') as HTMLInputElement;
    const valScale = document.getElementById('val-lc-scale') as HTMLElement;

    const updateScale = (scVal: number) => {
      lc.scale = scVal;
      valScale.innerText = `${scVal.toFixed(1)}x`;
      inpScale.value = String(scVal);
      rngScale.value = String(Math.round(scVal * 100));
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
    };

    rngScale.oninput = () => updateScale(parseInt(rngScale.value, 10) / 100);
    inpScale.onchange = () => updateScale(parseFloat(inpScale.value));

    const selStyle = document.getElementById('sel-lc-style') as HTMLSelectElement;
    selStyle.onchange = () => {
      lc.style = selStyle.value as TreeStyle;
      scene.renderTrees();
      scene.updateGizmoVisuals();
    };

    document.getElementById('btn-delete-lc')!.onclick = () => {
      scene.layout.leafClusters?.splice(scene.selection.leafClusterIndex!, 1);
      scene.select({ type: 'none' });
      scene.renderTrees();
      scene.buildGizmos();
      scene.updateGizmoVisuals();
      refreshHierarchy();
    };
    return;
  }

  // 3. SCENERY PROP INSPECTOR
  if (type === 'scenery' && sceneryIndex !== undefined && scene.layout.scenery[sceneryIndex]) {
    const sc = scene.layout.scenery[sceneryIndex];
    badge.innerText = `Prop: ${sc.texture}`;

    body.innerHTML = `
      <div class="prop-group">
        <div class="prop-label"><span>PROP TYPE</span></div>
        <select id="inp-sc-texture" class="select-input" style="width:100%;">
          <optgroup label="🌾 Farm & Countryside">
            ${SCENERY_PALETTE.filter((p) => p.category === 'Farm')
              .map((p) => `<option value="${p.texture}" ${sc.texture === p.texture ? 'selected' : ''}>${p.icon} ${p.name}</option>`)
              .join('')}
          </optgroup>
          <optgroup label="🪨 Rocks & Formations">
            ${SCENERY_PALETTE.filter((p) => p.category === 'Rocks')
              .map((p) => `<option value="${p.texture}" ${sc.texture === p.texture ? 'selected' : ''}>${p.icon} ${p.name}</option>`)
              .join('')}
          </optgroup>
          <optgroup label="🌿 Flora & Woods">
            ${SCENERY_PALETTE.filter((p) => p.category === 'Flora')
              .map((p) => `<option value="${p.texture}" ${sc.texture === p.texture ? 'selected' : ''}>${p.icon} ${p.name}</option>`)
              .join('')}
          </optgroup>
          <optgroup label="✨ Decor & Atmosphere">
            ${SCENERY_PALETTE.filter((p) => p.category === 'Decor')
              .map((p) => `<option value="${p.texture}" ${sc.texture === p.texture ? 'selected' : ''}>${p.icon} ${p.name}</option>`)
              .join('')}
          </optgroup>
        </select>
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>POSITION</span></div>
        <div class="prop-row">
          <label style="font-size:12px; width:16px;">X:</label>
          <input type="number" id="inp-sc-x" value="${sc.x}" min="20" max="1260" />
          <label style="font-size:12px; width:16px;">Y:</label>
          <input type="number" id="inp-sc-y" value="${sc.y}" min="100" max="640" />
        </div>
        <input type="range" id="rng-sc-x" min="20" max="1260" value="${sc.x}" />
        <input type="range" id="rng-sc-y" min="100" max="640" value="${sc.y}" />
      </div>

      <div class="prop-group">
        <div class="prop-label"><span>SCALE</span> <span id="val-sc-scale">${sc.scale.toFixed(1)}x</span></div>
        <input type="range" id="rng-sc-scale" min="3" max="25" value="${Math.round(sc.scale * 10)}" />
      </div>

      <div class="prop-group" style="gap:12px;">
        <label class="checkbox-label">
          <input type="checkbox" id="chk-sc-flip" ${sc.flipX ? 'checked' : ''} />
          <span>⇄ Flip Horizontal</span>
        </label>
        <div class="prop-row" style="justify-content:space-between;">
          <span style="font-size:13px; color:#9ca3af;">Layer Depth:</span>
          <select id="sel-sc-depth" class="select-input">
            <option value="1" ${sc.depth === 1 ? 'selected' : ''}>Background (Depth 1)</option>
            <option value="4" ${sc.depth === 4 ? 'selected' : ''}>Foreground (Depth 4)</option>
          </select>
        </div>
      </div>

      <div class="prop-group" style="gap:8px;">
        <button id="btn-duplicate-prop" class="btn btn-primary" style="justify-content:center;">📑 Duplicate Prop</button>
        <button id="btn-delete-prop" class="btn btn-danger" style="justify-content:center;">🗑️ Delete Prop</button>
      </div>
    `;

    // Prop type change
    const selTex = document.getElementById('inp-sc-texture') as HTMLSelectElement;
    selTex.onchange = () => {
      sc.texture = selTex.value;
      scene.renderAll();
      refreshHierarchy();
    };

    // Position
    const inpSX = document.getElementById('inp-sc-x') as HTMLInputElement;
    const inpSY = document.getElementById('inp-sc-y') as HTMLInputElement;
    const rngSX = document.getElementById('rng-sc-x') as HTMLInputElement;
    const rngSY = document.getElementById('rng-sc-y') as HTMLInputElement;

    const updateScPos = () => {
      sc.x = parseInt(inpSX.value, 10);
      sc.y = parseInt(inpSY.value, 10);
      rngSX.value = String(sc.x);
      rngSY.value = String(sc.y);
      scene.renderAll();
      refreshHierarchy();
    };

    inpSX.onchange = updateScPos;
    inpSY.onchange = updateScPos;
    rngSX.oninput = () => { inpSX.value = rngSX.value; updateScPos(); };
    rngSY.oninput = () => { inpSY.value = rngSY.value; updateScPos(); };

    // Scale
    const rngScale = document.getElementById('rng-sc-scale') as HTMLInputElement;
    const valScale = document.getElementById('val-sc-scale') as HTMLElement;
    rngScale.oninput = () => {
      sc.scale = parseInt(rngScale.value, 10) / 10;
      valScale.innerText = `${sc.scale.toFixed(1)}x`;
      scene.renderAll();
    };

    // Flip & Depth
    const chkFlip = document.getElementById('chk-sc-flip') as HTMLInputElement;
    chkFlip.onchange = () => {
      sc.flipX = chkFlip.checked;
      scene.renderAll();
    };

    const selDepth = document.getElementById('sel-sc-depth') as HTMLSelectElement;
    selDepth.onchange = () => {
      sc.depth = parseInt(selDepth.value, 10);
      scene.renderAll();
    };

    // Duplicate
    document.getElementById('btn-duplicate-prop')!.onclick = () => {
      const copy: SceneryItemDef = {
        ...sc,
        id: `sc_${Date.now()}`,
        x: sc.x + 30,
        y: sc.y + 10,
      };
      scene.layout.scenery.push(copy);
      scene.select({ type: 'scenery', sceneryIndex: scene.layout.scenery.length - 1 });
      scene.renderAll();
      refreshHierarchy();
      showToast('📑 Duplicated prop!');
    };

    // Delete
    document.getElementById('btn-delete-prop')!.onclick = () => {
      scene.layout.scenery.splice(sceneryIndex, 1);
      scene.select({ type: 'none' });
      scene.renderAll();
      refreshHierarchy();
    };
    return;
  }
}

function addBranchToTree(treeIndex: number) {
  const tree = scene.layout.trees[treeIndex];
  if (!tree) return;

  const isLeft = tree.trunkX < 640;
  const newX = isLeft ? tree.trunkX + 160 : tree.trunkX - 160;
  const newY = 380 + Math.floor(Math.random() * 80);
  const fromY = newY + 25;
  const fromX = isLeft ? tree.trunkX + 30 : tree.trunkX - 30;

  const newB: BranchDef = {
    x: newX,
    y: newY,
    nest: true,
    from: [fromX, fromY],
    startW: 32,
    endW: 15,
    isBirch: tree.style === 'birch',
  };

  tree.branches.push(newB);
  scene.renderAll();
  refreshHierarchy();
  scene.select({ type: 'branch', treeIndex, branchIndex: tree.branches.length - 1 });
  scene.snapBranchToTrunk(treeIndex, tree.branches.length - 1);
  showToast('🌿 Added new branch & snapped to trunk!');
}

// ---------------------------------------------------------------------------
// TOOLBAR BUTTONS
// ---------------------------------------------------------------------------
document.getElementById('btn-add-tree')!.onclick = () => {
  const newTree: TreeDef = {
    id: `tree_${Date.now()}`,
    name: 'New Oak Tree',
    style: 'oak',
    trunkX: 640,
    branches: [
      { x: 500, y: 390, nest: false, from: [610, 420], startW: 30, endW: 14 },
      { x: 780, y: 430, nest: true, from: [670, 460], startW: 34, endW: 16 },
    ],
  };
  scene.layout.trees.push(newTree);
  scene.renderAll();
  refreshHierarchy();
  scene.select({ type: 'tree', treeIndex: scene.layout.trees.length - 1 });
  showToast('🌳 Added new tree at canvas center!');
};

document.getElementById('btn-add-branch')!.onclick = () => {
  const tIdx = scene.selection.type === 'tree' ? (scene.selection.treeIndex ?? 0) : 0;
  addBranchToTree(tIdx);
};

document.getElementById('btn-add-nest')?.addEventListener('click', () => {
  if (!scene.layout.freePerches) scene.layout.freePerches = [];
  const newNest: FreePerchDef = {
    id: `nest_${Date.now()}`,
    x: 640,
    y: 360,
    isNest: true,
    leaves: true,
  };
  scene.layout.freePerches.push(newNest);
  scene.renderTrees();
  scene.buildGizmos();
  scene.updateGizmoVisuals();
  refreshHierarchy();
  scene.select({ type: 'freePerch', freePerchIndex: scene.layout.freePerches.length - 1 });
  showToast('🪺 Placed standalone Nest at center! Drag anywhere!');
});

document.getElementById('btn-add-perch')?.addEventListener('click', () => {
  if (!scene.layout.freePerches) scene.layout.freePerches = [];
  const newPerch: FreePerchDef = {
    id: `perch_${Date.now()}`,
    x: 640,
    y: 360,
    isNest: false,
    leaves: true,
  };
  scene.layout.freePerches.push(newPerch);
  scene.renderTrees();
  scene.buildGizmos();
  scene.updateGizmoVisuals();
  refreshHierarchy();
  scene.select({ type: 'freePerch', freePerchIndex: scene.layout.freePerches.length - 1 });
  showToast('🐦 Placed standalone Perch at center! Drag anywhere!');
});

document.getElementById('btn-add-leaves')?.addEventListener('click', () => {
  if (!scene.layout.leafClusters) scene.layout.leafClusters = [];
  const newLc: LeafClusterDef = {
    id: `leaf_${Date.now()}`,
    x: 640,
    y: 320,
    scale: 1.0,
    style: scene.layout.trees[0]?.style || 'oak',
  };
  scene.layout.leafClusters.push(newLc);
  scene.renderTrees();
  scene.buildGizmos();
  scene.updateGizmoVisuals();
  refreshHierarchy();
  scene.select({ type: 'leafCluster', leafClusterIndex: scene.layout.leafClusters.length - 1 });
  showToast('🍃 Placed Foliage Puff at center! Drag anywhere!');
});

document.getElementById('btn-add-prop')!.onclick = () => {
  const newProp: SceneryItemDef = {
    id: `sc_${Date.now()}`,
    texture: 'scenery_stone_moss',
    x: 640,
    y: 580,
    scale: 1.0,
    flipX: false,
    depth: 1,
  };
  scene.layout.scenery.push(newProp);
  scene.renderAll();
  refreshHierarchy();
  scene.select({ type: 'scenery', sceneryIndex: scene.layout.scenery.length - 1 });
  showToast('🪨 Placed new prop at center!');
};

// Save to Game
document.getElementById('btn-save')!.onclick = () => {
  saveLevelLayout(scene.layout);
  showToast('💾 Saved level design to browser! Active in-game immediately.');
};

// Play Game
document.getElementById('btn-play')!.onclick = () => {
  saveLevelLayout(scene.layout);
  window.open('/', '_blank');
};

// Reset Defaults
document.getElementById('btn-reset')!.onclick = () => {
  if (confirm(`Reset ${currentStageKey} back to original built-in defaults?`)) {
    resetLevelLayout(currentStageKey);
    const def = getDefaultLevelDesign(currentWorldId, currentStageKey);
    scene.setLayout(def);
    refreshHierarchy();
    renderInspector();
    showToast('↺ Reverted to default layout!');
  }
};

// JSON Modal
const jsonModal = document.getElementById('json-modal')!;
const jsonTextarea = document.getElementById('json-textarea') as HTMLTextAreaElement;

document.getElementById('btn-export')!.onclick = () => {
  jsonTextarea.value = JSON.stringify(scene.layout, null, 2);
  jsonModal.classList.add('open');
};

document.getElementById('btn-modal-close')!.onclick = () => {
  jsonModal.classList.remove('open');
};

document.getElementById('btn-copy-clipboard')!.onclick = () => {
  navigator.clipboard.writeText(jsonTextarea.value).then(() => {
    showToast('📋 JSON copied to clipboard!');
  });
};

document.getElementById('btn-apply-json')!.onclick = () => {
  try {
    const parsed = JSON.parse(jsonTextarea.value);
    if (parsed && Array.isArray(parsed.trees) && Array.isArray(parsed.scenery)) {
      scene.setLayout(parsed);
      refreshHierarchy();
      renderInspector();
      jsonModal.classList.remove('open');
      showToast('📥 Applied custom layout!');
    } else {
      alert('Invalid JSON structure: must contain trees and scenery arrays.');
    }
  } catch (err) {
    alert('JSON syntax error: ' + err);
  }
};
