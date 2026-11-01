/**
 * LevelDesignData.ts
 * Unified declarative level layout system for Insaterrarium.
 * Controls tree positions, trunk styles, branch perches, nests, and background scenery decorations.
 */

export type TreeStyle = 'oak' | 'birch' | 'mangrove' | 'kapok' | 'sakura' | 'pine' | 'basalt';

export interface BranchDef {
  x: number;              // Perch X coordinate (where birds sit/feed)
  y: number;              // Perch Y coordinate
  nest: boolean;          // Whether an egg nest is attached here
  nestX?: number;         // Custom X position of the nest bowl (defaults to x)
  nestY?: number;         // Custom Y position of the nest bowl (defaults to y)
  from: [number, number]; // [x, y] coordinates on the trunk where branch sprouts
  startW: number;         // Thickness at the trunk socket (e.g. 28-36)
  endW: number;           // Thickness at the branch tip (e.g. 12-16)
  isBirch?: boolean;      // White birch paper bark texture
  leaves?: boolean;       // Whether leafy foliage sprouts on this branch (defaults to true)
}

export interface TreeDef {
  id: string;
  name: string;
  style: TreeStyle;
  trunkX: number;         // Horizontal position of trunk base
  trunkY?: number;        // Vertical position of trunk base (default 620)
  scale?: number;         // Overall scale multiplier (e.g. 0.4x to 2.5x, default 1.0)
  topY?: number;          // Top Y elevation / trim the top (e.g. 120 to 520, default 300)
  canopyX?: number;       // Horizontal center of canopy (defaults to trunkX)
  canopyY?: number;       // Elevation of the canopy crown (e.g. 60 to 450, default 210)
  canopyRadius?: number;  // Spread radius of the canopy foliage (e.g. 60 to 360, default 180)
  leafDensity?: number;   // Density multiplier for leaves (e.g. 0.3 to 2.5, default 1.0)
  branches: BranchDef[];  // Perches & branches attached to this tree
}

export interface FreePerchDef {
  id: string;
  x: number;
  y: number;
  isNest?: boolean;       // whether this spot is an egg nest or a perch
  leaves?: boolean;       // whether foliage sprouts around this perch
}

export interface LeafClusterDef {
  id: string;
  x: number;
  y: number;
  scale?: number;
  style?: TreeStyle;
}

export interface SceneryItemDef {
  id: string;
  texture: string;
  x: number;
  y: number;
  scale: number;
  flipX: boolean;
  depth: number;          // 1 = Midground behind branches, 4 = Foreground in front of trunk
}

export interface LevelLayoutDef {
  levelKey: string;       // e.g. "world_1_stage_1", "sandbox", "challenge_bats"
  worldId: number;
  trees: TreeDef[];
  freePerches?: FreePerchDef[];   // Standalone perches & nests anywhere
  leafClusters?: LeafClusterDef[]; // Free leafy foliage puffs anywhere
  scenery: SceneryItemDef[];
}

export interface SceneryPaletteOption {
  texture: string;
  name: string;
  category: 'Rocks' | 'Flora' | 'Farm' | 'Decor';
  icon: string;
}

export const SCENERY_PALETTE: SceneryPaletteOption[] = [
  // --- Natural Formations & Rocks ---
  { texture: 'scenery_stone_moss', name: 'Mossy Boulder', category: 'Rocks', icon: '🪨' },
  { texture: 'scenery_stone_crag', name: 'Mountain Crag', category: 'Rocks', icon: '⛰️' },
  { texture: 'scenery_stone_volcanic', name: 'Volcanic Obsidian', category: 'Rocks', icon: '🌋' },
  { texture: 'scenery_stone_pebbles', name: 'Pebble Cluster', category: 'Rocks', icon: '⚪' },

  // --- Flora & Forest ---
  { texture: 'scenery_mushrooms', name: 'Forest Toadstools', category: 'Flora', icon: '🍄' },
  { texture: 'scenery_fern', name: 'Lush Fern', category: 'Flora', icon: '🌿' },
  { texture: 'scenery_flower_bush', name: 'Flowering Bush', category: 'Flora', icon: '🌸' },
  { texture: 'scenery_hanging_vine', name: 'Hanging Ivy Vine', category: 'Flora', icon: '🍃' },

  // --- Farm, Countryside & Creatures ---
  { texture: 'scenery_anthill', name: 'Busy Ant Hill', category: 'Farm', icon: '🐜' },
  { texture: 'scenery_barn', name: 'Country Red Barn', category: 'Farm', icon: '🏚️' },
  { texture: 'scenery_windmill', name: 'Farm Windmill', category: 'Farm', icon: '💨' },
  { texture: 'scenery_hay_bale', name: 'Hay Bale Stack', category: 'Farm', icon: '🌾' },
  { texture: 'scenery_crop_patch', name: 'Vegetable Crop Patch', category: 'Farm', icon: '🥕' },
  { texture: 'scenery_fence', name: 'Rustic Post Fence', category: 'Farm', icon: '🪵' },
  { texture: 'scenery_water_well', name: 'Cobblestone Well', category: 'Farm', icon: '🪣' },
  { texture: 'scenery_beehive', name: 'Honey Beehive', category: 'Farm', icon: '🐝' },
  { texture: 'scenery_scarecrow', name: 'Garden Scarecrow', category: 'Farm', icon: '🧑‍🌾' },

  // --- Atmosphere & Decor ---
  { texture: 'scenery_campfire', name: 'Stone Campfire', category: 'Decor', icon: '🔥' },
  { texture: 'scenery_crystal', name: 'Mystic Crystal Cluster', category: 'Decor', icon: '💎' },
  { texture: 'scenery_lantern', name: 'Garden Lantern', category: 'Decor', icon: '🏮' },
];

/** Default built-in layouts for each world */
export function getDefaultLevelDesign(worldId: number, levelKey: string): LevelLayoutDef {
  if (worldId === 1) {
    return {
      levelKey,
      worldId: 1,
      trees: [
        {
          id: 'tree_w1_oak',
          name: 'Grandfather Oak',
          style: 'oak',
          trunkX: 140,
          branches: [
            { x: 260, y: 320, nest: false, from: [150, 390], startW: 30, endW: 14, isBirch: false },
            { x: 320, y: 430, nest: true,  from: [165, 470], startW: 34, endW: 16, isBirch: false },
            { x: 230, y: 520, nest: false, from: [160, 550], startW: 28, endW: 14, isBirch: false },
            { x: 65,  y: 400, nest: false, from: [120, 440], startW: 28, endW: 14, isBirch: false },
            { x: 390, y: 460, nest: true,  from: [180, 510], startW: 34, endW: 16, isBirch: false },
          ],
        },
        {
          id: 'tree_w1_birch',
          name: 'Silver Birch',
          style: 'birch',
          trunkX: 1140,
          branches: [
            { x: 1020, y: 330, nest: false, from: [1125, 380], startW: 24, endW: 12, isBirch: true },
            { x: 950,  y: 420, nest: true,  from: [1120, 460], startW: 28, endW: 15, isBirch: true },
            { x: 1220, y: 400, nest: false, from: [1155, 440], startW: 24, endW: 12, isBirch: true },
            { x: 880,  y: 480, nest: true,  from: [1115, 520], startW: 28, endW: 15, isBirch: true },
            { x: 1060, y: 530, nest: false, from: [1130, 560], startW: 24, endW: 12, isBirch: true },
          ],
        },
      ],
      scenery: [
        { id: 'sc_1', texture: 'scenery_stone_moss', x: 260, y: 584, scale: 0.9, flipX: false, depth: 1 },
        { id: 'sc_2', texture: 'scenery_stone_moss', x: 1020, y: 588, scale: 0.85, flipX: true, depth: 1 },
        { id: 'sc_3', texture: 'scenery_stone_pebbles', x: 480, y: 594, scale: 1.0, flipX: false, depth: 1 },
        { id: 'sc_4', texture: 'scenery_stone_pebbles', x: 760, y: 592, scale: 1.0, flipX: true, depth: 1 },
        { id: 'sc_5', texture: 'scenery_mushrooms', x: 340, y: 586, scale: 0.95, flipX: false, depth: 1 },
        { id: 'sc_6', texture: 'scenery_fern', x: 180, y: 580, scale: 1.0, flipX: false, depth: 1 },
      ],
    };
  }

  if (worldId === 2) {
    return {
      levelKey,
      worldId: 2,
      trees: [
        {
          id: 'tree_w2_mangrove',
          name: 'Stilt Mangrove',
          style: 'mangrove',
          trunkX: 120,
          branches: [
            { x: 240, y: 310, nest: false, from: [120, 350], startW: 32, endW: 15, isBirch: false },
            { x: 310, y: 410, nest: true,  from: [130, 430], startW: 36, endW: 16, isBirch: false },
            { x: 70,  y: 380, nest: false, from: [110, 410], startW: 28, endW: 14, isBirch: false },
            { x: 380, y: 480, nest: true,  from: [140, 490], startW: 36, endW: 16, isBirch: false },
            { x: 210, y: 530, nest: false, from: [130, 520], startW: 28, endW: 14, isBirch: false },
          ],
        },
        {
          id: 'tree_w2_kapok',
          name: 'Giant Kapok',
          style: 'kapok',
          trunkX: 880,
          branches: [
            { x: 760,  y: 330, nest: false, from: [860, 360], startW: 34, endW: 15, isBirch: false },
            { x: 690,  y: 420, nest: true,  from: [850, 440], startW: 38, endW: 17, isBirch: false },
            { x: 990,  y: 360, nest: false, from: [910, 390], startW: 30, endW: 14, isBirch: false },
            { x: 620,  y: 490, nest: true,  from: [840, 500], startW: 36, endW: 16, isBirch: false },
            { x: 800,  y: 530, nest: false, from: [860, 530], startW: 30, endW: 14, isBirch: false },
          ],
        },
      ],
      scenery: [
        { id: 'sc_1', texture: 'scenery_stone_moss', x: 140, y: 576, scale: 1.2, flipX: false, depth: 1 },
        { id: 'sc_2', texture: 'scenery_stone_moss', x: 380, y: 586, scale: 0.95, flipX: false, depth: 1 },
        { id: 'sc_3', texture: 'scenery_stone_moss', x: 880, y: 584, scale: 1.1, flipX: true, depth: 1 },
        { id: 'sc_4', texture: 'scenery_stone_moss', x: 1120, y: 574, scale: 1.25, flipX: true, depth: 1 },
        { id: 'sc_5', texture: 'scenery_fern', x: 440, y: 580, scale: 1.15, flipX: false, depth: 1 },
        { id: 'sc_6', texture: 'scenery_hanging_vine', x: 260, y: 220, scale: 1.1, flipX: false, depth: 1 },
        { id: 'sc_7', texture: 'scenery_hanging_vine', x: 1040, y: 230, scale: 1.1, flipX: true, depth: 1 },
      ],
    };
  }

  if (worldId === 3) {
    return {
      levelKey,
      worldId: 3,
      trees: [
        {
          id: 'tree_w3_sakura',
          name: 'Weeping Sakura',
          style: 'sakura',
          trunkX: 340,
          branches: [
            { x: 210, y: 360, nest: false, from: [330, 390], startW: 28, endW: 14, isBirch: false },
            { x: 460, y: 390, nest: true,  from: [360, 430], startW: 34, endW: 16, isBirch: false },
            { x: 130, y: 440, nest: false, from: [320, 450], startW: 28, endW: 14, isBirch: false },
            { x: 530, y: 470, nest: true,  from: [370, 490], startW: 34, endW: 16, isBirch: false },
            { x: 270, y: 520, nest: false, from: [340, 520], startW: 26, endW: 13, isBirch: false },
          ],
        },
        {
          id: 'tree_w3_pine',
          name: 'Sculpted Matsu Pine',
          style: 'pine',
          trunkX: 1060,
          branches: [
            { x: 910,  y: 310, nest: false, from: [1060, 350], startW: 30, endW: 15, isBirch: false },
            { x: 870,  y: 410, nest: true,  from: [1040, 430], startW: 34, endW: 16, isBirch: false },
            { x: 1190, y: 360, nest: false, from: [1080, 400], startW: 28, endW: 14, isBirch: false },
            { x: 800,  y: 490, nest: true,  from: [1030, 500], startW: 36, endW: 16, isBirch: false },
            { x: 980,  y: 530, nest: false, from: [1050, 540], startW: 28, endW: 14, isBirch: false },
          ],
        },
      ],
      scenery: [
        { id: 'sc_1', texture: 'scenery_stone_crag', x: 190, y: 568, scale: 1.1, flipX: false, depth: 1 },
        { id: 'sc_2', texture: 'scenery_stone_crag', x: 440, y: 580, scale: 0.85, flipX: true, depth: 1 },
        { id: 'sc_3', texture: 'scenery_stone_crag', x: 840, y: 580, scale: 0.9, flipX: false, depth: 1 },
        { id: 'sc_4', texture: 'scenery_stone_crag', x: 1080, y: 568, scale: 1.15, flipX: true, depth: 1 },
        { id: 'sc_5', texture: 'scenery_flower_bush', x: 620, y: 580, scale: 1.05, flipX: false, depth: 1 },
        { id: 'sc_6', texture: 'scenery_lantern', x: 740, y: 560, scale: 1.0, flipX: false, depth: 1 },
      ],
    };
  }

  // World 4: Volcanic Mystic Peaks
  return {
    levelKey,
    worldId: 4,
    trees: [
      {
        id: 'tree_w4_basalt_left',
        name: 'Obsidian Column Spire (Left)',
        style: 'basalt',
        trunkX: 215,
        branches: [
          { x: 130, y: 410, nest: false, from: [205, 440], startW: 32, endW: 15, isBirch: false },
          { x: 360, y: 390, nest: true,  from: [235, 430], startW: 36, endW: 16, isBirch: false },
          { x: 250, y: 310, nest: false, from: [220, 350], startW: 28, endW: 14, isBirch: false },
          { x: 160, y: 520, nest: false, from: [210, 545], startW: 28, endW: 14, isBirch: false },
          { x: 320, y: 490, nest: true,  from: [235, 510], startW: 34, endW: 16, isBirch: false },
        ],
      },
      {
        id: 'tree_w4_basalt_right',
        name: 'Obsidian Column Spire (Right)',
        style: 'basalt',
        trunkX: 980,
        branches: [
          { x: 870,  y: 320, nest: false, from: [965, 360], startW: 32, endW: 15, isBirch: false },
          { x: 840,  y: 420, nest: true,  from: [960, 450], startW: 36, endW: 16, isBirch: false },
          { x: 1120, y: 340, nest: false, from: [995, 370], startW: 28, endW: 14, isBirch: false },
          { x: 870,  y: 500, nest: true,  from: [965, 520], startW: 34, endW: 16, isBirch: false },
          { x: 1090, y: 470, nest: false, from: [990, 490], startW: 28, endW: 14, isBirch: false },
        ],
      },
    ],
    scenery: [
      { id: 'sc_1', texture: 'scenery_stone_volcanic', x: 150, y: 570, scale: 1.25, flipX: false, depth: 1 },
      { id: 'sc_2', texture: 'scenery_stone_volcanic', x: 420, y: 582, scale: 0.9, flipX: true, depth: 1 },
      { id: 'sc_3', texture: 'scenery_stone_volcanic', x: 860, y: 582, scale: 0.95, flipX: false, depth: 1 },
      { id: 'sc_4', texture: 'scenery_stone_volcanic', x: 1110, y: 570, scale: 1.3, flipX: true, depth: 1 },
      { id: 'sc_5', texture: 'scenery_crystal', x: 290, y: 576, scale: 1.0, flipX: false, depth: 1 },
      { id: 'sc_6', texture: 'scenery_crystal', x: 990, y: 574, scale: 1.15, flipX: true, depth: 1 },
    ],
  };
}

const STORAGE_PREFIX = 'insaterrarium_layout_v1_';

/**
 * Calculates the exact horizontal trunk bark edge coordinate for any tree style at height Y.
 * Ensures branches connect flush with the trunk surface.
 */
export function getTrunkEdgeAtY(
  tree: TreeDef,
  y: number,
  side: 'left' | 'right' | 'auto' = 'auto',
  targetX?: number
): number {
  const actualSide =
    side === 'auto'
      ? targetX !== undefined
        ? targetX > tree.trunkX
          ? 'right'
          : 'left'
        : 'right'
      : side;

  const clampedY = Math.min(625, Math.max(240, y));
  const t = Math.min(1, Math.max(0, (625 - clampedY) / (625 - 280)));

  let halfW = 35;
  let centerOffset = 0;

  switch (tree.style) {
    case 'oak':
      halfW = 90 - t * 60; // 90 at base -> 30 at top
      break;
    case 'birch':
      halfW = 26 - t * 12; // 26 at base -> 14 at top
      break;
    case 'mangrove':
      if (clampedY < 360) {
        halfW = 25;
      } else {
        const rootT = (clampedY - 360) / (625 - 360);
        halfW = 25 + rootT * 70; // 25 at knot -> 95 at base
      }
      break;
    case 'kapok':
      halfW = 150 - t * 115; // 150 at flared base -> 35 at top
      break;
    case 'sakura':
      halfW = 30 - t * 12;
      centerOffset = Math.sin(t * Math.PI) * 25; // Calligraphic S-curve
      break;
    case 'pine':
      halfW = 32 - t * 16;
      break;
    case 'basalt':
      halfW = 42;
      break;
    default:
      halfW = 35;
  }

  const cx = tree.trunkX + centerOffset;
  return Math.round(actualSide === 'right' ? cx + halfW : cx - halfW);
}

/** Load layout from local storage or fallback to default */
export function loadLevelLayout(levelKey: string, worldId: number): LevelLayoutDef {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + levelKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.trees) && Array.isArray(parsed.scenery)) {
        return parsed as LevelLayoutDef;
      }
    }
  } catch (err) {
    console.warn('Failed to load custom layout from localStorage:', err);
  }
  return getDefaultLevelDesign(worldId, levelKey);
}

/** Save layout directly to local storage */
export function saveLevelLayout(layout: LevelLayoutDef): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + layout.levelKey, JSON.stringify(layout));
  } catch (err) {
    console.error('Failed to save level layout:', err);
  }
}

/** Revert to built-in default layout */
export function resetLevelLayout(levelKey: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + levelKey);
  } catch (err) {
    console.error('Failed to remove custom level layout:', err);
  }
}
