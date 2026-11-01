import Phaser from 'phaser';
import { BranchDef, TreeDef } from './LevelDesignData';

export interface LeafPalette {
  back: number;
  mid: number;
  fore: number;
  highlight: number;
  accent: number;
  stem: number;
}

export function getLeafPalette(style: string, isBirch?: boolean): LeafPalette {
  if (isBirch || style === 'birch') {
    return {
      back: 0x365314,
      mid: 0x4d7c0f,
      fore: 0x65a30d,
      highlight: 0xa3e635,
      accent: 0xfacc15, // Golden birch shimmer
      stem: 0x334155,
    };
  }

  switch (style) {
    case 'mangrove':
      return {
        back: 0x064e3b,
        mid: 0x047857,
        fore: 0x059669,
        highlight: 0x10b981,
        accent: 0x34d399, // Seafoam highlights
        stem: 0x141a0b,
      };

    case 'kapok':
      return {
        back: 0x14532d,
        mid: 0x166534,
        fore: 0x15803d,
        highlight: 0x22c55e,
        accent: 0xf43f5e, // Exotic rainforest blossoms
        stem: 0x141a0b,
      };

    case 'sakura':
      return {
        back: 0x9d174d,
        mid: 0xdb2777,
        fore: 0xf472b6,
        highlight: 0xfbcfe8,
        accent: 0xffffff, // White blossom highlights
        stem: 0x4a2522,
      };

    case 'pine':
      return {
        back: 0x064e3b,
        mid: 0x14532d,
        fore: 0x166534,
        highlight: 0x22c55e,
        accent: 0x86efac,
        stem: 0x221a14,
      };

    case 'basalt':
      return {
        back: 0x1f2937,
        mid: 0x78350f,
        fore: 0xd97706,
        highlight: 0xfbbf24,
        accent: 0xef4444, // Glowing volcanic ember leaves
        stem: 0x09070c,
      };

    case 'oak':
    default:
      return {
        back: 0x1b4332,
        mid: 0x2d6a4f,
        fore: 0x40916c,
        highlight: 0x52b788,
        accent: 0x95d5b2, // Fresh tender leaf shoot
        stem: 0x2b1507,
      };
  }
}

/**
 * Draws lush, 2.5D stylized foliage clusters and leaf sprigs on a branch.
 * Backing leaf volume is rendered to canopyGfx (behind the bough),
 * while front sprigs, leaf stems, and highlights are rendered to fgGfx (in front).
 */
export function drawBranchLeaves(
  def: BranchDef,
  treeStyle: string,
  canopyGfx: Phaser.GameObjects.Graphics,
  fgGfx: Phaser.GameObjects.Graphics,
  branchIndex = 0
) {
  // If explicitly toggled off, skip
  if (def.leaves === false) return;

  const { x: x1, y: y1Target, from, isBirch } = def;
  const x0 = from[0];
  const y0 = from[1];
  const y1 = y1Target + 8;
  const midX = (x0 + x1) / 2;
  const midY = (y0 + y1) / 2 - 12;

  const dirX = x1 >= x0 ? 1 : -1;
  const pal = getLeafPalette(treeStyle, isBirch);

  // Pseudo-random deterministic offsets based on coordinates and index
  const hash = Math.sin(x1 * 12.9898 + y1 * 78.233 + branchIndex * 37.1) * 43758.5453;
  const frac = (i: number) => {
    const v = Math.sin(hash + i * 9.17) * 10000;
    return v - Math.floor(v);
  };

  // ---------------------------------------------------------------------------
  // 1. BACKGROUND CANOPY CLUSTERS (Volume behind the branch & tip)
  // ---------------------------------------------------------------------------
  if (treeStyle === 'pine') {
    // Pine: Fan of evergreen needle tufts
    const drawPineTuft = (cx: number, cy: number, scale = 1.0) => {
      canopyGfx.fillStyle(pal.back, 0.95);
      canopyGfx.fillEllipse(cx, cy + 3, 34 * scale, 18 * scale);
      canopyGfx.fillStyle(pal.mid, 0.95);
      canopyGfx.fillEllipse(cx + dirX * 3, cy, 28 * scale, 14 * scale);
      canopyGfx.fillStyle(pal.fore, 0.9);
      canopyGfx.fillEllipse(cx + dirX * 6, cy - 2, 20 * scale, 10 * scale);
    };

    drawPineTuft(x1 + dirX * 18, y1 - 4, 1.15);
    drawPineTuft(x1 + dirX * 34, y1 - 2, 0.9);
    drawPineTuft(midX + dirX * 6, midY - 6, 0.85);
  } else if (treeStyle === 'sakura') {
    // Sakura: Fluffy cherry blossom petal clouds
    const drawBlossomPuff = (cx: number, cy: number, r: number) => {
      canopyGfx.fillStyle(pal.back, 0.85);
      canopyGfx.fillCircle(cx, cy + 3, r * 1.05);
      canopyGfx.fillStyle(pal.mid, 0.9);
      canopyGfx.fillCircle(cx, cy, r);
      canopyGfx.fillStyle(pal.fore, 0.95);
      canopyGfx.fillCircle(cx + dirX * 2, cy - 2, r * 0.78);
      canopyGfx.fillStyle(pal.highlight, 0.98);
      canopyGfx.fillCircle(cx + dirX * 3, cy - 4, r * 0.52);
    };

    drawBlossomPuff(x1 + dirX * 16, y1 - 10, 22);
    drawBlossomPuff(x1 + dirX * 32, y1 - 4, 18);
    drawBlossomPuff(x1 + dirX * 8, y1 + 12, 16);
    drawBlossomPuff(midX + dirX * 10, midY - 8, 17);
  } else {
    // Oak / Birch / Mangrove / Kapok / Basalt: Rounded organic foliage puffs
    const drawLeafPuff = (cx: number, cy: number, rx: number, ry: number) => {
      canopyGfx.fillStyle(pal.back, 0.9);
      canopyGfx.fillEllipse(cx, cy + 4, rx * 2.1, ry * 2.1);
      canopyGfx.fillStyle(pal.mid, 0.95);
      canopyGfx.fillEllipse(cx, cy, rx * 1.9, ry * 1.8);
      canopyGfx.fillStyle(pal.fore, 0.95);
      canopyGfx.fillEllipse(cx + dirX * 3, cy - 3, rx * 1.4, ry * 1.3);
      canopyGfx.fillStyle(pal.highlight, 0.85);
      canopyGfx.fillEllipse(cx + dirX * 4, cy - 5, rx * 0.9, ry * 0.8);
    };

    // Major cluster billowing past the branch tip
    drawLeafPuff(x1 + dirX * 20, y1 - 8, 22, 17);
    drawLeafPuff(x1 + dirX * 38, y1 - 4, 18, 14);
    drawLeafPuff(x1 + dirX * 12, y1 + 14, 17, 13);

    // Mid-branch foliage cluster
    drawLeafPuff(midX + dirX * 4, midY - 8, 18, 14);
  }

  // ---------------------------------------------------------------------------
  // 2. FOREGROUND LEAF SPRIGS & BUDS (Pops in front of the branch)
  // ---------------------------------------------------------------------------
  // Mid-branch sprig (t = 0.45)
  const tMid = 0.45;
  const invM = 1 - tMid;
  const smX = invM * invM * x0 + 2 * invM * tMid * midX + tMid * tMid * x1;
  const smY = invM * invM * y0 + 2 * invM * tMid * midY + tMid * tMid * y1;

  // Tiny stem sprouting up from bough
  fgGfx.lineStyle(2, pal.stem, 0.95);
  fgGfx.lineBetween(smX, smY - 2, smX + dirX * 8, smY - 14);

  // Pair of leaves on mid sprig
  fgGfx.fillStyle(pal.fore, 1);
  fgGfx.fillEllipse(smX + dirX * 11, smY - 17, 14, 8);
  fgGfx.fillStyle(pal.highlight, 0.9);
  fgGfx.fillEllipse(smX + dirX * 5, smY - 12, 10, 6);

  // Outer branch tip sprigs (t = 0.85 to tip)
  const tipStemX = x1 + dirX * 10;
  const tipStemY = y1 - 6;

  fgGfx.lineStyle(2.2, pal.stem, 0.95);
  fgGfx.lineBetween(x1, y1, tipStemX, tipStemY);
  fgGfx.lineBetween(tipStemX, tipStemY, tipStemX + dirX * 12, tipStemY - 8);

  // Crisp foreground leaf cluster right around perch
  fgGfx.fillStyle(pal.fore, 1);
  fgGfx.fillEllipse(tipStemX + dirX * 4, tipStemY - 4, 16, 9);
  fgGfx.fillStyle(pal.highlight, 0.95);
  fgGfx.fillEllipse(tipStemX + dirX * 12, tipStemY - 9, 13, 7);
  fgGfx.fillStyle(pal.accent, 0.9);
  fgGfx.fillCircle(tipStemX + dirX * 17, tipStemY - 11, 3.5);

  // Additional style specifics
  if (treeStyle === 'mangrove') {
    // Hanging aerial rootlet / moss tendril dropping below the branch
    fgGfx.lineStyle(1.8, 0x064e3b, 0.85);
    fgGfx.lineBetween(x1 - dirX * 10, y1 + 8, x1 - dirX * 6, y1 + 26);
    fgGfx.lineBetween(x1 - dirX * 6, y1 + 26, x1 - dirX * 8, y1 + 38);
    fgGfx.fillStyle(0x34d399, 0.9);
    fgGfx.fillCircle(x1 - dirX * 8, y1 + 40, 2.5);
  } else if (treeStyle === 'kapok') {
    // Jungle flower bud
    fgGfx.fillStyle(pal.accent, 1);
    fgGfx.fillCircle(tipStemX + dirX * 14, tipStemY - 13, 4.5);
    fgGfx.fillStyle(0xfde047, 1);
    fgGfx.fillCircle(tipStemX + dirX * 14, tipStemY - 13, 2);
  } else if (treeStyle === 'sakura') {
    // Cherry blossom petal cluster
    fgGfx.fillStyle(0xfbcfe8, 1);
    fgGfx.fillCircle(tipStemX + dirX * 8, tipStemY - 7, 5);
    fgGfx.fillCircle(tipStemX + dirX * 14, tipStemY - 11, 4.5);
    fgGfx.fillStyle(0xdb2777, 1);
    fgGfx.fillCircle(tipStemX + dirX * 11, tipStemY - 9, 2.5);
  } else if (treeStyle === 'basalt') {
    // Glowing ember crystal
    fgGfx.fillStyle(0xef4444, 0.9);
    fgGfx.fillCircle(tipStemX + dirX * 10, tipStemY - 8, 4);
    fgGfx.fillStyle(0xfbbf24, 1);
    fgGfx.fillCircle(tipStemX + dirX * 10, tipStemY - 8, 2);
  }
}

/**
 * Draws the lush foreground crown foliage in front of the upper trunk,
 * ensuring the trunk naturally disappears into the canopy without blunt edges.
 */
/**
 * Deprecated: Canopy is now natively rendered in front of the trunk (depth 3 vs depth 2),
 * eliminating fixed, unmovable leaf patches stuck on top of the trunk.
 */
export function drawTreeCrownFront(
  _tree: {
    trunkX: number;
    style: string;
    scale?: number;
    topY?: number;
    canopyX?: number;
    canopyY?: number;
    canopyRadius?: number;
    leafDensity?: number;
  },
  _fgGfx: Phaser.GameObjects.Graphics,
  _rnd: Phaser.Math.RandomDataGenerator
) {
  // No-op: The canopy already naturally sits in front of the trunk.
}

/**
 * Renders a lush, solid, connected stylized canopy mass with volumetric foliage billows.
 * Eliminates disjoint floating circles in favor of cohesive, overlapping organic foliage clouds.
 */
export function drawConnectedCanopy(
  tree: TreeDef,
  canopy: Phaser.GameObjects.Graphics,
  rnd: Phaser.Math.RandomDataGenerator,
  V: (x: number, y: number) => Phaser.Math.Vector2
) {
  const scale = tree.scale ?? 1.0;
  const baseY = tree.trunkY ?? 625;
  const defaultTop = tree.style === 'birch' ? baseY - 365 : (tree.style === 'kapok' ? baseY - 395 : (tree.style === 'pine' ? baseY - 385 : (tree.style === 'sakura' ? baseY - 355 : baseY - 325)));
  const topY = tree.topY ?? defaultTop;
  const canX = tree.canopyX ?? tree.trunkX;
  const canY = tree.canopyY ?? (topY - 80 * scale);
  const baseRad = (tree.canopyRadius ?? (tree.style === 'kapok' ? 240 : (tree.style === 'pine' ? 160 : 180))) * scale;
  
  // Density genuinely affects canopy fullness and thickness!
  const density = tree.leafDensity ?? 1.0;
  const densFactor = Phaser.Math.Clamp(density, 0.4, 2.5);
  const canRad = baseRad * (0.8 + 0.2 * densFactor);
  const billowScale = 0.75 + 0.25 * densFactor;
  const pal = getLeafPalette(tree.style);

  // Helper to draw a cohesive, 4-tier shaded foliage billow (no disjoint circles!)
  const drawFoliageBillow = (
    bx: number,
    by: number,
    rx: number,
    ry: number,
    sunAngle = -Math.PI * 0.75 // light coming from sun at top-left
  ) => {
    rx *= billowScale;
    ry *= billowScale;
    const cosL = Math.cos(sunAngle);
    const sinL = Math.sin(sunAngle);

    // 1. Solid deep ambient shadow backing (ensures zero background gaps)
    canopy.fillStyle(pal.back, 0.98);
    canopy.fillEllipse(bx, by + 4 * scale, rx * 2.05, ry * 2.05);

    // 2. Rich midtone body volume (slightly elevated from base)
    canopy.fillStyle(pal.mid, 0.98);
    canopy.fillEllipse(bx + cosL * 2 * scale, by + sinL * 2 * scale, rx * 1.95, ry * 1.95);

    // 3. Sunlit upper shell (directed towards sun)
    canopy.fillStyle(pal.fore, 0.95);
    canopy.fillEllipse(
      bx + cosL * (rx * 0.22),
      by + sinL * (ry * 0.22),
      rx * 1.6,
      ry * 1.5
    );

    // 4. Brilliant sun highlight crest
    canopy.fillStyle(pal.highlight, 0.9);
    canopy.fillEllipse(
      bx + cosL * (rx * 0.38),
      by + sinL * (ry * 0.38),
      rx * 1.15,
      ry * 0.95
    );

    // 5. Delicate accent rim
    canopy.fillStyle(pal.accent, 0.75);
    canopy.fillEllipse(
      bx + cosL * (rx * 0.48),
      by + sinL * (ry * 0.48),
      rx * 0.65,
      ry * 0.45
    );
  };

  if (tree.style === 'pine') {
    // -------------------------------------------------------------
    // PINE: Tiered Conical Conifer Needle Skirts (True Evergreen)
    // -------------------------------------------------------------
    const tiers = Math.max(4, Math.round(6 * densFactor));
    const spireTop = canY - canRad * 1.1;
    const skirtBottom = canY + canRad * 0.6;
    const totalH = skirtBottom - spireTop;

    // Draw tiers from top to bottom
    for (let t = 0; t < tiers; t++) {
      const progress = t / (tiers - 1);
      const tierY = spireTop + progress * totalH;
      const tierW = (canRad * 0.35 + progress * canRad * 1.15);
      const tierH = 42 * scale * (0.8 + progress * 0.4);

      // Backing shadow skirt
      canopy.fillStyle(pal.back, 1);
      canopy.fillPoints([
        V(canX, tierY - tierH * 0.6),
        V(canX + tierW * 0.6, tierY - tierH * 0.1),
        V(canX + tierW, tierY + tierH * 0.5),
        V(canX + tierW * 0.7, tierY + tierH * 0.35),
        V(canX + tierW * 0.35, tierY + tierH * 0.45),
        V(canX, tierY + tierH * 0.3),
        V(canX - tierW * 0.35, tierY + tierH * 0.45),
        V(canX - tierW * 0.7, tierY + tierH * 0.35),
        V(canX - tierW, tierY + tierH * 0.5),
        V(canX - tierW * 0.6, tierY - tierH * 0.1),
      ], true);

      // Midtone needle mass
      canopy.fillStyle(pal.mid, 0.98);
      canopy.fillPoints([
        V(canX, tierY - tierH * 0.55),
        V(canX + tierW * 0.55, tierY - tierH * 0.12),
        V(canX + tierW * 0.92, tierY + tierH * 0.38),
        V(canX + tierW * 0.65, tierY + tierH * 0.25),
        V(canX + tierW * 0.3, tierY + tierH * 0.35),
        V(canX, tierY + tierH * 0.2),
        V(canX - tierW * 0.3, tierY + tierH * 0.35),
        V(canX - tierW * 0.65, tierY + tierH * 0.25),
        V(canX - tierW * 0.92, tierY + tierH * 0.38),
        V(canX - tierW * 0.55, tierY - tierH * 0.12),
      ], true);

      // Sunlit needle frills on the upper left flank
      canopy.fillStyle(pal.fore, 0.95);
      canopy.fillPoints([
        V(canX, tierY - tierH * 0.5),
        V(canX - tierW * 0.1, tierY - tierH * 0.2),
        V(canX - tierW * 0.8, tierY + tierH * 0.2),
        V(canX - tierW * 0.5, tierY + tierH * 0.1),
        V(canX - tierW * 0.2, tierY + tierH * 0.15),
        V(canX, tierY + tierH * 0.05),
      ], true);

      // Highlight frost/sun tips
      canopy.fillStyle(pal.highlight, 0.85);
      canopy.fillCircle(canX - tierW * 0.7, tierY + tierH * 0.18, 5 * scale);
      canopy.fillCircle(canX - tierW * 0.4, tierY + tierH * 0.1, 4 * scale);
    }
  } else if (tree.style === 'kapok') {
    // -------------------------------------------------------------
    // KAPOK: Stepped Rainforest Plateau Shelves (Grand Emergent)
    // -------------------------------------------------------------
    const decks = [
      { yOff: -0.52, spanX: 0.65, rx: 0.38, ry: 0.26 },  // Top central plateau
      { yOff: -0.15, spanX: 1.25, rx: 0.55, ry: 0.32 },  // Vast middle emergent shelf
      { yOff: 0.22, spanX: 1.10, rx: 0.48, ry: 0.28 },   // Broad lower flank shelf
    ];

    for (const deck of decks) {
      const cy = canY + deck.yOff * canRad;
      const count = 5;
      for (let i = 0; i < count; i++) {
        const t = (i / (count - 1)) * 2 - 1;
        const cx = canX + t * deck.spanX * canRad;
        const dip = Math.abs(t) * 12 * scale;
        drawFoliageBillow(
          cx,
          cy + dip,
          deck.rx * canRad * (1 - Math.abs(t) * 0.25),
          deck.ry * canRad * (1 - Math.abs(t) * 0.2)
        );
      }
    }
  } else if (tree.style === 'birch') {
    // -------------------------------------------------------------
    // BIRCH: Weeping, Airy Elegant Arching Billows
    // -------------------------------------------------------------
    const birchBillows = [
      [0, -0.48, 0.48, 0.44],
      [-0.38, -0.28, 0.42, 0.42],
      [0.38, -0.28, 0.42, 0.42],
      [0, -0.08, 0.55, 0.48],
      [-0.52, 0.12, 0.38, 0.40],
      [0.52, 0.12, 0.38, 0.40],
      [-0.28, 0.32, 0.38, 0.38],
      [0.28, 0.32, 0.38, 0.38],
      [0, 0.36, 0.42, 0.36],
    ];
    for (const [dx, dy, rx, ry] of birchBillows) {
      drawFoliageBillow(canX + dx * canRad * 0.88, canY + dy * canRad * 1.05, rx * canRad * 0.9, ry * canRad * 0.95);
    }
  } else if (tree.style === 'mangrove') {
    // -------------------------------------------------------------
    // MANGROVE: Wide Dense Connected Umbrella Dome
    // -------------------------------------------------------------
    const mangroveBillows = [
      [0, -0.38, 0.68, 0.42],
      [-0.55, -0.20, 0.58, 0.38],
      [0.55, -0.20, 0.58, 0.38],
      [0, -0.02, 0.78, 0.45],
      [-0.78, 0.08, 0.50, 0.35],
      [0.78, 0.08, 0.50, 0.35],
      [-0.42, 0.24, 0.55, 0.36],
      [0.42, 0.24, 0.55, 0.36],
      [0, 0.28, 0.65, 0.38],
    ];
    for (const [dx, dy, rx, ry] of mangroveBillows) {
      drawFoliageBillow(canX + dx * canRad * 1.15, canY + dy * canRad * 0.85, rx * canRad * 1.05, ry * canRad * 0.88);
    }


  } else if (tree.style === 'sakura') {
    // -------------------------------------------------------------
    // SAKURA: Soft Dreamy Connected Cherry Blossom Billow Clouds
    // -------------------------------------------------------------
    const sakuraBillows = [
      [0, -0.42, 0.60, 0.50],
      [-0.45, -0.24, 0.52, 0.46],
      [0.45, -0.24, 0.52, 0.46],
      [0, -0.04, 0.70, 0.54],
      [-0.65, 0.10, 0.46, 0.42],
      [0.65, 0.10, 0.46, 0.42],
      [-0.36, 0.30, 0.50, 0.44],
      [0.36, 0.30, 0.50, 0.44],
      [0, 0.34, 0.55, 0.44],
    ];
    for (const [dx, dy, rx, ry] of sakuraBillows) {
      drawFoliageBillow(canX + dx * canRad, canY + dy * canRad * 0.95, rx * canRad, ry * canRad);
    }
    // Soft blossom petal drifts
    for (let p = 0; p < 12; p++) {
      const px = canX + (rnd.frac() * 2 - 1) * canRad * 0.9;
      const py = canY + (rnd.frac() * 2 - 1) * canRad * 0.6;
      canopy.fillStyle(0xfbcfe8, 0.85);
      canopy.fillEllipse(px, py, 6 * scale, 3.5 * scale);
    }
  } else if (tree.style === 'basalt') {
    // -------------------------------------------------------------
    // BASALT: Volcanic Obsidian Plateau with Magma Fissures
    // -------------------------------------------------------------
    const basaltBlocks = [
      [0, -0.38, 0.65, 0.42],
      [-0.48, -0.18, 0.52, 0.38],
      [0.48, -0.18, 0.52, 0.38],
      [0, 0.02, 0.75, 0.48],
      [-0.65, 0.16, 0.45, 0.36],
      [0.65, 0.16, 0.45, 0.36],
      [0, 0.32, 0.62, 0.40],
    ];
    for (const [dx, dy, rx, ry] of basaltBlocks) {
      drawFoliageBillow(canX + dx * canRad, canY + dy * canRad, rx * canRad, ry * canRad);
    }
    // Glowing ember veins
    canopy.lineStyle(2.5 * scale, 0xef4444, 0.85);
    canopy.lineBetween(canX - canRad * 0.4, canY - canRad * 0.1, canX, canY + canRad * 0.1);
    canopy.lineBetween(canX, canY + canRad * 0.1, canX + canRad * 0.4, canY - canRad * 0.05);
    canopy.lineStyle(1.2 * scale, 0xfbbf24, 0.95);
    canopy.lineBetween(canX - canRad * 0.35, canY - canRad * 0.08, canX, canY + canRad * 0.1);
    canopy.lineBetween(canX, canY + canRad * 0.1, canX + canRad * 0.35, canY - canRad * 0.04);
  } else {
    // -------------------------------------------------------------
    // OAK / DEFAULT: Lush Majestic Volumetric Cloud Canopy
    // -------------------------------------------------------------
    const oakBillows = [
      [0, -0.44, 0.64, 0.52],        // Upper apex crown
      [-0.46, -0.26, 0.54, 0.48],    // Upper left shoulder
      [0.46, -0.26, 0.54, 0.48],     // Upper right shoulder
      [0, -0.06, 0.74, 0.56],        // Central massive core volume
      [-0.68, 0.08, 0.48, 0.44],     // Outer left mid billow
      [0.68, 0.08, 0.48, 0.44],      // Outer right mid billow
      [-0.38, 0.28, 0.54, 0.45],     // Lower left sweep
      [0.38, 0.28, 0.54, 0.45],      // Lower right sweep
      [0, 0.34, 0.58, 0.46],         // Lower center mantle
    ];
    for (const [dx, dy, rx, ry] of oakBillows) {
      drawFoliageBillow(canX + dx * canRad, canY + dy * canRad, rx * canRad, ry * canRad);
    }
  }

  // Extra rich outer density billows when density is dialed up!
  if (densFactor > 1.05 && tree.style !== 'pine') {
    const extraCount = Math.round(5 * (densFactor - 1.0));
    for (let e = 0; e < extraCount; e++) {
      const angle = (e / extraCount) * Math.PI * 1.6 - Math.PI * 0.8;
      const dist = canRad * 0.78;
      const ex = canX + Math.cos(angle) * dist;
      const ey = canY + Math.sin(angle) * dist * 0.65;
      drawFoliageBillow(ex, ey, canRad * 0.36, canRad * 0.28);
    }
  }
}

/**
 * Draws a standalone placed leaf cluster anywhere in the scene.
 */
export function drawStandaloneLeafCluster(
  cluster: { x: number; y: number; scale?: number; style?: string },
  defaultStyle: string,
  canopyGfx: Phaser.GameObjects.Graphics,
  fgGfx: Phaser.GameObjects.Graphics
) {
  const style = cluster.style || defaultStyle;
  const pal = getLeafPalette(style);
  const scale = cluster.scale ?? 1.0;
  const x = cluster.x;
  const y = cluster.y;

  // Background volume
  canopyGfx.fillStyle(pal.back, 0.9);
  canopyGfx.fillEllipse(x, y + 4, 60 * scale, 42 * scale);
  canopyGfx.fillStyle(pal.mid, 0.95);
  canopyGfx.fillEllipse(x, y, 52 * scale, 36 * scale);

  // Foreground highlights & leaf sprig
  fgGfx.fillStyle(pal.fore, 0.95);
  fgGfx.fillEllipse(x + 4 * scale, y - 4 * scale, 40 * scale, 28 * scale);
  fgGfx.fillStyle(pal.highlight, 0.9);
  fgGfx.fillEllipse(x + 6 * scale, y - 6 * scale, 24 * scale, 16 * scale);

  // Center accent bud
  fgGfx.fillStyle(pal.accent, 0.95);
  fgGfx.fillCircle(x + 8 * scale, y - 8 * scale, 5 * scale);
}

/**
 * High-fidelity unified renderer for the entire tree structure:
 * Dynamic scale, trunk height trimming, full canopy movement, and foreground crown overlap.
 */
export function renderWholeTreeStructure(
  tree: TreeDef,
  canopy: Phaser.GameObjects.Graphics,
  trunkGfx: Phaser.GameObjects.Graphics,
  fgGfx: Phaser.GameObjects.Graphics,
  rnd: Phaser.Math.RandomDataGenerator,
  V: (x: number, y: number) => Phaser.Math.Vector2
) {
  const scale = tree.scale ?? 1.0;
  const baseY = tree.trunkY ?? 625;
  const tx = tree.trunkX;
  const defaultTop = tree.style === 'birch' ? baseY - 365 : (tree.style === 'kapok' ? baseY - 395 : (tree.style === 'pine' ? baseY - 385 : (tree.style === 'sakura' ? baseY - 355 : baseY - 325)));
  const topY = tree.topY ?? defaultTop;
  const canX = tree.canopyX ?? tx;
  const canY = tree.canopyY ?? (topY - 80 * scale);
  const canRad = (tree.canopyRadius ?? (tree.style === 'kapok' ? 240 : 180)) * scale;
  const density = tree.leafDensity ?? 1.0;

  // 1. Draw Connected Stylized Canopy (no disjoint circles!)
  drawConnectedCanopy(tree, canopy, rnd, V);

  // 2. Draw Style-Specific Trunk, Bark, and Roots
  if (tree.style === 'oak') {
    const tw = 30 * scale;
    const bw = 90 * scale;
    trunkGfx.fillStyle(0x5a3418, 1);
    trunkGfx.fillPoints([
      V(tx - bw, baseY),
      V(tx - bw * 0.5, (baseY + topY) / 2 + 30),
      V(tx - tw, topY),
      V(tx + tw, topY),
      V(tx + bw * 0.7, (baseY + topY) / 2 + 25),
      V(tx + bw * 1.05, baseY),
    ], true);
    trunkGfx.fillStyle(0x3e200c, 1);
    trunkGfx.fillPoints([
      V(tx + bw * 0.1, baseY),
      V(tx + tw, topY),
      V(tx + tw * 1.25, topY),
      V(tx + bw * 1.05, baseY),
    ], true);
    trunkGfx.lineStyle(3 * scale, 0x2b1507, 0.7);
    trunkGfx.lineBetween(tx - bw * 0.4, baseY - 5, tx - tw * 0.5, topY + 40);
    trunkGfx.lineBetween(tx, baseY - 5, tx + 10 * scale, topY + 20);
    trunkGfx.lineBetween(tx + bw * 0.45, baseY - 10, tx + tw * 0.8, topY + 60);
    trunkGfx.lineStyle(3.5 * scale, 0x854d24, 0.55);
    trunkGfx.lineBetween(tx - bw * 0.6, baseY - 15, tx - tw * 0.2, topY + 20);
  } else if (tree.style === 'birch') {
    const tw = 14 * scale;
    const bw = 27 * scale;
    trunkGfx.fillStyle(0xe2e8f0, 1);
    trunkGfx.fillPoints([
      V(tx - bw, baseY),
      V(tx - bw * 0.55, (baseY + topY) / 2 + 40),
      V(tx - tw, topY),
      V(tx + tw, topY),
      V(tx + bw * 0.55, (baseY + topY) / 2 + 40),
      V(tx + bw, baseY),
    ], true);
    trunkGfx.fillStyle(0xc7d2fe, 0.45);
    trunkGfx.fillPoints([
      V(tx - bw, baseY),
      V(tx - bw * 0.55, (baseY + topY) / 2 + 40),
      V(tx - tw, topY),
      V(tx - tw * 0.4, topY),
      V(tx - bw * 0.2, (baseY + topY) / 2 + 40),
      V(tx - bw * 0.5, baseY),
    ], true);
    trunkGfx.lineStyle(2.5 * scale, 0x1e293b, 0.85);
    for (let y = topY + 30; y < baseY - 10; y += 22) {
      const xOff = (y % 44 === 0 ? 0 : 5) * scale;
      trunkGfx.lineBetween(tx - tw + xOff, y, tx + tw + xOff, y + 1);
    }
  } else if (tree.style === 'mangrove') {
    const roots = [
      [-85, baseY, -50, (baseY + topY) / 2 + 20, -10, topY + 60],
      [-45, baseY, -25, (baseY + topY) / 2 + 10, -5, topY + 60],
      [5, baseY, 0, (baseY + topY) / 2, 0, topY + 60],
      [55, baseY, 30, (baseY + topY) / 2 + 10, 5, topY + 60],
      [100, baseY, 65, (baseY + topY) / 2 + 30, 10, topY + 60],
    ];
    for (const [r0, ry0, rcx, rcy, r1, ry1] of roots) {
      trunkGfx.lineStyle(12 * scale, 0x1e2715, 1);
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(tx + r0 * scale, ry0),
        new Phaser.Math.Vector2(tx + rcx * scale, rcy),
        new Phaser.Math.Vector2(tx + r1 * scale, ry1)
      );
      curve.draw(trunkGfx);
      trunkGfx.lineStyle(7 * scale, 0x3d4f29, 0.7);
      curve.draw(trunkGfx);
    }
    trunkGfx.fillStyle(0x283618, 1);
    trunkGfx.fillEllipse(tx, topY + 60, 50 * scale, 35 * scale);
  } else if (tree.style === 'kapok') {
    const tw = 35 * scale;
    const bw = 150 * scale;
    trunkGfx.fillStyle(0x323c22, 1);
    trunkGfx.fillPoints([
      V(tx - bw, baseY),
      V(tx - bw * 0.3, (baseY + topY) / 2 + 30),
      V(tx - tw, topY),
      V(tx + tw, topY),
      V(tx + bw * 0.35, (baseY + topY) / 2 + 30),
      V(tx + bw, baseY),
    ], true);
    trunkGfx.fillStyle(0x1a2110, 1);
    trunkGfx.fillPoints([
      V(tx - 20 * scale, baseY),
      V(tx, (baseY + topY) / 2 + 20),
      V(tx + tw * 0.3, topY),
      V(tx + tw, topY),
      V(tx + bw * 0.35, (baseY + topY) / 2 + 30),
      V(tx + bw, baseY),
    ], true);
    trunkGfx.lineStyle(4 * scale, 0x141a0b, 0.85);
    trunkGfx.lineBetween(tx - bw * 0.9, baseY - 5, tx - tw, topY + 40);
    trunkGfx.lineBetween(tx, baseY, tx - 5 * scale, topY + 30);
    trunkGfx.lineBetween(tx + bw * 0.9, baseY - 5, tx + tw, topY + 40);
  } else if (tree.style === 'sakura') {
    const tw = 20 * scale;
    const bw = 40 * scale;
    trunkGfx.fillStyle(0x4a2522, 1);
    trunkGfx.fillPoints([
      V(tx - bw, baseY),
      V(tx - bw * 0.5, (baseY + topY) / 2 + 50),
      V(tx - tw, topY + 70),
      V(tx - tw * 1.5, topY),
      V(tx, topY),
      V(tx + tw, topY + 80),
      V(tx + bw * 0.7, (baseY + topY) / 2 + 50),
      V(tx + bw, baseY),
    ], true);
    trunkGfx.fillStyle(0x271412, 1);
    trunkGfx.fillPoints([
      V(tx - 10 * scale, baseY),
      V(tx + 5 * scale, (baseY + topY) / 2 + 50),
      V(tx + tw * 0.5, topY + 70),
      V(tx + tw, topY + 80),
      V(tx + bw * 0.7, (baseY + topY) / 2 + 50),
      V(tx + bw, baseY),
    ], true);
    trunkGfx.lineStyle(3 * scale, 0x7c3a2d, 0.5);
    trunkGfx.lineBetween(tx - bw * 0.6, baseY - 10, tx + 5 * scale, topY + 90);
  } else if (tree.style === 'pine') {
    const tw = 12 * scale;
    const bw = 35 * scale;
    trunkGfx.fillStyle(0x382d24, 1);
    trunkGfx.fillPoints([
      V(tx - bw, baseY),
      V(tx - bw * 0.5, (baseY + topY) / 2 + 50),
      V(tx - tw, topY),
      V(tx + tw, topY),
      V(tx + bw * 0.5, (baseY + topY) / 2 + 50),
      V(tx + bw, baseY),
    ], true);
    trunkGfx.lineStyle(2.5 * scale, 0x221a14, 0.8);
    trunkGfx.lineBetween(tx - 15 * scale, baseY - 15, tx - 5 * scale, (baseY + topY) / 2);
    trunkGfx.lineBetween(tx - 5 * scale, (baseY + topY) / 2, tx, topY + 10);
  } else if (tree.style === 'basalt') {
    const drawBasaltCol = (bx: number, by: number, bw: number, bh: number) => {
      trunkGfx.fillStyle(0x18181b, 1);
      trunkGfx.fillRect(bx - bw / 2, by, bw, bh);
      trunkGfx.fillStyle(0x27272a, 1);
      trunkGfx.fillRect(bx - bw / 2 + 4, by, bw / 2 - 4, bh);
      trunkGfx.fillStyle(0x3f3f46, 1);
      trunkGfx.fillPoints([
        V(bx, by - 14 * scale),
        V(bx + bw / 2, by - 6 * scale),
        V(bx + bw / 2, by + 4 * scale),
        V(bx, by - 4 * scale),
        V(bx - bw / 2, by + 4 * scale),
        V(bx - bw / 2, by - 6 * scale),
      ], true);
    };

    const colW = 60 * scale;
    drawBasaltCol(tx - 45 * scale, topY + 90, colW, baseY - (topY + 90));
    drawBasaltCol(tx + 45 * scale, topY + 140, colW * 1.1, baseY - (topY + 140));
    drawBasaltCol(tx, topY, colW * 1.25, baseY - topY);

    trunkGfx.lineStyle(3 * scale, 0xef4444, 0.95);
    trunkGfx.lineBetween(tx, baseY - 5, tx, topY);
    trunkGfx.lineStyle(1.5 * scale, 0xfbbf24, 1);
    trunkGfx.lineBetween(tx, baseY - 5, tx, topY);
  }
}

