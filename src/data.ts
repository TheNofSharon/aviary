export interface Theme {
  name: string;
  sky1: number;
  sky2: number;
  hillFar: number;
  hillNear: number;
  ground: number;
  ground2: number;
  leaf: [number, number, number];
  sun: number;
}

export const THEMES: Theme[] = [
  // World 1: Sunny Meadow
  { name: 'Sunny Meadow', sky1: 0x59b8f2, sky2: 0xcdeeff, hillFar: 0x9bd8a0, hillNear: 0x6cc46a, ground: 0x58b858, ground2: 0x4aa84c, leaf: [0x2f8f46, 0x3fae55, 0x57c96a], sun: 0xffe45e },
  // World 2: Rainforest Canopy
  { name: 'Rainforest Canopy', sky1: 0x1b7060, sky2: 0x76c893, hillFar: 0x2d6a4f, hillNear: 0x1b4332, ground: 0x2d6a4f, ground2: 0x20503c, leaf: [0x134611, 0x2e7d32, 0x52b788], sun: 0xffea00 },
  // World 3: Blossom Sanctuary
  { name: 'Blossom Sanctuary', sky1: 0xf391b5, sky2: 0xffe0ec, hillFar: 0xb5838d, hillNear: 0x8f5d69, ground: 0x6d597a, ground2: 0x5b4867, leaf: [0xe56b6f, 0xea9ab2, 0xffccd5], sun: 0xfff0b8 },
  // World 4: Volcanic Mystic Peaks
  { name: 'Volcanic Mystic Peaks', sky1: 0x2e0854, sky2: 0xd84315, hillFar: 0x4a154b, hillNear: 0x2b0938, ground: 0x3e1828, ground2: 0x2a0e1c, leaf: [0xff5722, 0xff7043, 0xffb74d], sun: 0xffe57f },
  // World 5: The Abyssal Eclipse
  { name: 'The Abyssal Eclipse', sky1: 0x090514, sky2: 0x2e0854, hillFar: 0x180b2c, hillNear: 0x0f071d, ground: 0x1f0e38, ground2: 0x140824, leaf: [0x581c87, 0x7e22ce, 0xa855f7], sun: 0xf43f5e },
];

export interface StageDef {
  stage: number;
  name: string;
  briefing: string;
  baseEggCost: number;
}

export interface WorldDef {
  id: number;
  name: string;
  theme: Theme;
  subtitle: string;
  mechanicTitle: string;
  mechanicDesc: string;
  stages: StageDef[];
  rewardPetKey: string;
}

export const WORLDS: WorldDef[] = [
  {
    id: 1,
    name: 'Sunny Meadow',
    theme: THEMES[0],
    subtitle: 'Flock Basics & Tutorial',
    mechanicTitle: 'Tutorial & Flock Basics',
    mechanicDesc: 'Drop seeds to feed hungry birds, collect silver & gold coins, and fend off hawks!',
    rewardPetKey: 'hedgehog',
    stages: [
      { stage: 1, name: 'Welcome to the Aviary', briefing: 'Click to drop seeds. Feed the baby Sparrow until it grows up, then buy the Egg pieces!', baseEggCost: 60 },
      { stage: 2, name: 'Hawks in the Clouds', briefing: 'Wild hawks are attacking! Tap the hawk repeatedly to protect your birds.', baseEggCost: 120 },
      { stage: 3, name: 'Golden Plumage', briefing: 'Upgrade your seeds and feed your birds into mature Adult Sparrows to drop valuable golden plumage plumes.', baseEggCost: 220 },
      { stage: 4, name: 'Meadow Finale', briefing: 'Fend off fierce hawk waves and complete the golden egg to hatch Spike the Hedgehog!', baseEggCost: 380 },
    ],
  },
  {
    id: 2,
    name: 'Rainforest Canopy',
    theme: THEMES[1],
    subtitle: 'The Carnivore Peregrine Falcon',
    mechanicTitle: 'Carnivore Peregrine Falcon',
    mechanicDesc: 'Peregrine Falcons do NOT eat seeds! They hunt baby chicks and drop gleaming 200c Diamonds.',
    rewardPetKey: 'butterfly',
    stages: [
      { stage: 1, name: 'Hunters of the Canopy', briefing: 'Introducing the Peregrine Falcon! Buy baby sparrows to feed it and collect its diamonds.', baseEggCost: 600 },
      { stage: 2, name: 'Thieving Crows', briefing: 'Fast shadow crows dive down to steal coins and food! Tap them before they snatch your loot.', baseEggCost: 850 },
      { stage: 3, name: 'Food Chain Mastery', briefing: 'Balance seed-eating sparrows with voracious falcons to generate diamond fortunes.', baseEggCost: 1150 },
      { stage: 4, name: 'Canopy Finale', briefing: 'Survive heavy crow & hawk aerial assaults to hatch Flutter the Butterfly!', baseEggCost: 1500 },
    ],
  },
  {
    id: 3,
    name: 'Blossom Sanctuary',
    theme: THEMES[2],
    subtitle: 'Breeder Mama Songbird',
    mechanicTitle: 'Breeder Mama Songbird',
    mechanicDesc: 'Mama Songbird flies and nests freely, never needs feeding, and lays eggs in cozy nests that hatch into songbirds!',
    rewardPetKey: 'squirrel',
    stages: [
      { stage: 1, name: 'The Nest Mother', briefing: 'Introducing Mama Songbird! She flies freely, never needs feeding, and lays eggs in cozy nests that hatch into songbirds.', baseEggCost: 1600 },
      { stage: 2, name: 'Breeder Symbiosis', briefing: 'Let Mama Songbird supply continuous chicks to grow your flock and feed your Raptors!', baseEggCost: 2100 },
      { stage: 3, name: 'Sanctuary Incursion', briefing: 'Heavy dual-hawk and creeping viper raids are testing your flock defenses.', baseEggCost: 2600 },
      { stage: 4, name: 'Sanctuary Finale', briefing: 'Protect your flock through intense predator waves to hatch Nutty the Squirrel!', baseEggCost: 3200 },
    ],
  },
  {
    id: 4,
    name: 'Volcanic Mystic Peaks',
    theme: THEMES[3],
    subtitle: 'The Gliding Canopy & Phoenix Rebirth',
    mechanicTitle: 'The Sugar Glider & Cinder Acorns',
    mechanicDesc: 'Adopt the Sugar Glider! It glides across trees dropping fiery Cinder Acorns. Young birds perish if they eat it, but Adult birds burn and REBORN as the immortal Golden Phoenix!',
    rewardPetKey: 'hen',
    stages: [
      { stage: 1, name: 'The Sugar Glider', briefing: 'Adopt the high-flying Sugar Glider! Keep chicks away from its scorching Cinder Acorns, but let adult birds feast to birth a Phoenix!', baseEggCost: 3500 },
      { stage: 2, name: 'Circle of Rebirth', briefing: 'Breed chicks with Mama Songbird, hunt with Raptors, and let adult birds eat Cinder Acorns to summon divine Phoenixes!', baseEggCost: 4200 },
      { stage: 3, name: 'Volcanic Wyvern Attack', briefing: 'A massive Volcanic Wyvern has descended from the fiery crater! Aim your slingshot true!', baseEggCost: 5000 },
      { stage: 4, name: 'The Master Aviary Ascendance', briefing: 'Complete the ultimate Golden Egg to earn the Golden Hen, Nightingale, and Master Aviary Trophy!', baseEggCost: 6000 },
    ],
  },
  {
    id: 5,
    name: 'The Abyssal Eclipse',
    theme: THEMES[4],
    subtitle: 'The Titan Showdown: Sovereign Shadow Roc',
    mechanicTitle: 'The Final Titan: Malakor',
    mechanicDesc: 'The ultimate battle! All 16 unlocked companions enter the aviary together. Defend them from void missiles and destroy the Eclipse Sovereign!',
    rewardPetKey: 'master_trophy',
    stages: [
      {
        stage: 1,
        name: 'Sovereign Shadow Roc',
        briefing: 'Darkness has consumed the sky! Malakor, the ancient Eclipse Sovereign, has descended to annihilate the aviary. All 16 companions have assembled—protect them, shoot down void orbs, and defeat Malakor to become the Master Aviary Keeper!',
        baseEggCost: 10000,
      },
    ],
  },
];

export interface PetDef {
  key: string;
  name: string;
  role: string;
  desc: string;
  stageReq: number;
  stageLabel: string;
}

/** 16 Stage Companions (1 unlocked after each stage) + Bonus Master Champions. */
export const PETS: PetDef[] = [
  // World 1 Companions
  { key: 'hedgehog', name: 'Spike', role: 'Ground Coin Collector', desc: 'Scuttles along the forest floor to scoop up falling and ground coins.', stageReq: 1, stageLabel: '1-1' },
  { key: 'badger', name: 'Barnaby', role: 'Truffle Forager', desc: 'Occasionally digs into the soil to unearth wild truffles worth 20 feathers.', stageReq: 2, stageLabel: '1-2' },
  { key: 'squirrel', name: 'Nutty', role: 'Acorn Sniper', desc: 'Stands guard on perches and hurls acorns at predators to stun and damage them.', stageReq: 3, stageLabel: '1-3' },
  { key: 'porcupine', name: 'Bristle', role: 'Quill Defender', desc: 'Bristles razor-sharp quills to bounce and damage low-diving and leaping predators.', stageReq: 4, stageLabel: '1-4' },

  // World 2 Companions
  { key: 'mama', name: 'Mama Dove', role: 'Flock Mother', desc: 'Flies freely and periodically lays warm eggs in completed nests that hatch into songbirds without needing food!', stageReq: 5, stageLabel: '2-1' },
  { key: 'woodpecker', name: 'Pip', role: 'Canopy Drummer', desc: 'Takes 5 minutes to excavate a tree-hollow roost. Drums the oak canopy to drop basic Level 1 seeds whenever birds are hungry.', stageReq: 6, stageLabel: '2-2' },
  { key: 'butterfly', name: 'Flutter', role: 'Sky Sweeper', desc: 'Flutters through the sky and catches airborne coins and floating seeds mid-air.', stageReq: 7, stageLabel: '2-3' },
  { key: 'magpie', name: 'Grimm', role: 'Treasure Thief', desc: 'Scavenges outside the aviary to periodically bring back shiny stolen loot bags worth 200c.', stageReq: 8, stageLabel: '2-4' },

  // World 3 Companions
  { key: 'snail', name: 'Mossy', role: 'Time Dilator', desc: 'Emits a calming aura that slows down falling coins and seeds by 40% so nothing gets lost.', stageReq: 9, stageLabel: '3-1' },
  { key: 'mole', name: 'Rocky', role: 'Demolitionist', desc: 'Tosses explosive pinecones up from underground burrows that burst into coins when clicked.', stageReq: 10, stageLabel: '3-2' },
  { key: 'hound', name: 'Bramble', role: 'Flock Protector', desc: 'Barks fiercely to stun predators for 1.5s and herds chicks into safe hollows.', stageReq: 11, stageLabel: '3-3' },
  { key: 'owl', name: 'Hoot', role: 'Night Sentry', desc: 'Flashes radar warning rings where predators are about to spawn and reveals enemy HP.', stageReq: 12, stageLabel: '3-4' },

  // World 4 Companions
  { key: 'frog', name: 'Bouncer', role: 'Canopy Springer', desc: 'Leaps high off branches to headbutt descending predators back into the upper sky.', stageReq: 13, stageLabel: '4-1' },
  { key: 'hummingbird', name: 'Zephyr', role: 'Updraft Blower', desc: 'Flaps furious wings under falling seeds to blow them back upward toward hungry birds.', stageReq: 14, stageLabel: '4-2' },
  { key: 'firefly', name: 'Sparky', role: 'Solar Energizer', desc: 'Illuminates the canopy and charges mature birds to drop rare glowing sparks.', stageReq: 15, stageLabel: '4-3' },
  { key: 'ferret', name: 'Fang', role: 'Apex Biter', desc: 'Fierce aerial acrobat! Leaps directly onto invading predators with vicious bite attacks.', stageReq: 16, stageLabel: '4-4' },

  // Bonus Master Champions (Trophy Room & Sanctuary)
  { key: 'hen', name: 'Goldie', role: 'Golden Egg Layer', desc: 'Lays golden eggs worth 250 coins.', stageReq: 17, stageLabel: 'Bonus' },
  { key: 'nightingale', name: 'Melody', role: 'Grand Siren', desc: 'Her celestial song inspires all birds to drop bonus currency.', stageReq: 18, stageLabel: 'Master' },
  { key: 'phoenix_chick', name: 'Asher', role: 'Solar Angel', desc: 'Periodically casts holy embers to revive starved birds.', stageReq: 19, stageLabel: 'Master' },
  { key: 'chameleon', name: 'Echo', role: 'Shapeshifter', desc: 'Can morph into any companion on click!', stageReq: 20, stageLabel: 'Master' },
];

export function getUnlockedPets(saveLevel: number): PetDef[] {
  const unlockedCount = Math.min(PETS.length, Math.max(0, saveLevel - 1));
  return PETS.slice(0, unlockedCount);
}

/** Converts a flat linear level number (1..16+) into world and stage data. */
export function getWorldAndStage(level: number) {
  const totalStagesPerWorld = 4;
  const clampedLevel = Math.max(1, level);
  if (clampedLevel >= 17) {
    const world = WORLDS[4];
    const stage = world.stages[0];
    return {
      world,
      stage,
      worldId: 5,
      stageNum: 1,
      stageIndex: 0,
      label: 'World 5-1 (The Final Showdown)',
      isLastStageOfWorld: true,
      isFinalBoss: true,
    };
  }
  const worldIndex = Math.min(3, Math.floor((clampedLevel - 1) / totalStagesPerWorld));
  const stageIndex = Math.min(3, (clampedLevel - 1) % totalStagesPerWorld);
  const world = WORLDS[worldIndex];
  const stage = world.stages[stageIndex];
  const label = `World ${world.id}-${stage.stage}`;
  const isLastStageOfWorld = stageIndex === totalStagesPerWorld - 1;
  const isFinalBoss = false;

  return {
    world,
    stage,
    worldId: world.id,
    stageNum: stage.stage,
    stageIndex,
    label,
    isLastStageOfWorld,
    isFinalBoss,
  };
}

export function themeFor(level: number): Theme {
  const ws = getWorldAndStage(level);
  return ws.world.theme;
}

/** Price of egg piece (piece 0 = 1/3, piece 1 = 2/3, piece 2 = 3/3). */
export function eggPieceCost(level: number, pieceIndex: number): number {
  const ws = getWorldAndStage(level);
  const base = ws.stage.baseEggCost;
  const mult = [1.0, 1.5, 2.2][pieceIndex] ?? 1.0;
  return Math.round(base * mult);
}

/** Legacy helper for MenuScene / display */
export function eggCost(level: number) {
  return eggPieceCost(level, 0);
}

export function maxPets(_level?: number) {
  return 3;
}

export type PredatorKind = 'hawk' | 'crow' | 'wyvern' | 'cat' | 'snake' | 'raccoon' | 'spider' | 'weasel' | 'glutton' | 'bombardier' | 'vulture' | 'bat';

export interface WaveEnemy {
  kind: PredatorKind;
  hp: number;
  label: string;
}

export interface Difficulty {
  firstWaveDelay: number;
  waveInterval: number;
  getWaveEnemies: (waveIndex: number) => WaveEnemy[];
  isBossStage?: boolean;
}

export function difficulty(level: number): Difficulty {
  const ws = getWorldAndStage(level);

  // World 1-1 is a peaceful tutorial with NO predators!
  if (ws.worldId === 1 && ws.stageNum === 1) {
    return {
      firstWaveDelay: 999999,
      waveInterval: 999999,
      getWaveEnemies: () => [],
    };
  }

  // World 1: Hawks & Prowling Alley Cats (calm introduction scaling to tough finale)
  if (ws.worldId === 1) {
    return {
      firstWaveDelay: 42 - ws.stageNum * 2,
      waveInterval: 50 - ws.stageNum * 2,
      getWaveEnemies: (waveIndex: number) => {
        if (ws.stageNum === 2) {
          // World 1-2: 1 Hawk, scaling with waves
          return [{ kind: 'hawk', hp: 16 + waveIndex * 3, label: 'Wild Hawk' }];
        }
        if (ws.stageNum === 3) {
          // World 1-3: Cats & Hawks, wave 2+ introduces duos
          if (waveIndex === 0) {
            return [{ kind: 'cat', hp: 24, label: 'Prowling Alley Cat' }];
          }
          if (waveIndex === 1) {
            return [{ kind: 'hawk', hp: 22, label: 'Wild Hawk' }];
          }
          return [
            { kind: 'cat', hp: 26 + waveIndex, label: 'Prowling Alley Cat' },
            { kind: 'hawk', hp: 20 + waveIndex, label: 'Wild Hawk' },
          ];
        }
        // Stage 1-4 World 1 Finale Boss Wave
        if (waveIndex === 0) {
          return [
            { kind: 'cat', hp: 32, label: 'Alley Cat Alpha' },
            { kind: 'hawk', hp: 22, label: 'Wild Hawk' },
          ];
        }
        return [
          { kind: 'cat', hp: 36 + waveIndex * 2, label: 'Alley Cat Alpha' },
          { kind: 'cat', hp: 26, label: 'Prowling Alley Cat' },
          { kind: 'hawk', hp: 24 + waveIndex, label: 'Wild Hawk' },
        ];
      },
    };
  }

  // World 2: Rainforest Canopy - Crows, Snakes, Raccoons, Bombardiers
  if (ws.worldId === 2) {
    return {
      firstWaveDelay: 36 - ws.stageNum * 2,
      waveInterval: 44 - ws.stageNum * 2,
      getWaveEnemies: (waveIndex: number) => {
        if (ws.stageNum === 1) {
          if (waveIndex === 0) {
            return [
              { kind: 'spider', hp: 32, label: 'Weaver Spider' },
              { kind: 'hawk', hp: 26, label: 'Jungle Hawk' },
            ];
          }
          return [
            { kind: 'spider', hp: 36 + waveIndex * 2, label: 'Weaver Spider' },
            { kind: 'spider', hp: 30, label: 'Weaver Spider' },
          ];
        }
        if (ws.stageNum === 2) {
          if (waveIndex === 0) {
            return [
              { kind: 'snake', hp: 38, label: 'Tree Viper' },
              { kind: 'raccoon', hp: 32, label: 'Masked Tree Raccoon' },
            ];
          }
          return [
            { kind: 'snake', hp: 44 + waveIndex * 2, label: 'Tree Viper' },
            { kind: 'snake', hp: 36, label: 'Tree Viper' },
          ];
        }
        if (ws.stageNum === 3) {
          if (waveIndex === 0) {
            return [
              { kind: 'bombardier', hp: 48, label: 'Bombardier Osprey' },
              { kind: 'raccoon', hp: 36, label: 'Masked Tree Raccoon' },
            ];
          }
          return [
            { kind: 'bombardier', hp: 54 + waveIndex * 2, label: 'Bombardier Osprey' },
            { kind: 'snake', hp: 40 + waveIndex, label: 'Tree Viper' },
          ];
        }
        // Stage 2-4 Finale
        if (waveIndex === 0) {
          return [
            { kind: 'cat', hp: 46, label: 'Jungle Panther' },
            { kind: 'bombardier', hp: 52, label: 'Bombardier Osprey' },
          ];
        }
        return [
          { kind: 'bombardier', hp: 58 + waveIndex * 3, label: 'Bombardier Osprey' },
          { kind: 'bombardier', hp: 48, label: 'Bombardier Osprey' },
          { kind: 'snake', hp: 42, label: 'Tree Viper' },
        ];
      },
    };
  }

  // World 3: Blossom Sanctuary - Spiders, Weasels, Gorgon the Glutton, Gourmet Vulture
  if (ws.worldId === 3) {
    return {
      firstWaveDelay: 32 - ws.stageNum,
      waveInterval: 40 - ws.stageNum,
      getWaveEnemies: (waveIndex: number) => {
        if (ws.stageNum === 1) {
          return [
            { kind: 'spider', hp: 54 + waveIndex * 4, label: 'Canopy Silk Spider' },
            { kind: 'spider', hp: 48 + waveIndex * 2, label: 'Canopy Silk Spider' },
          ];
        }
        if (ws.stageNum === 2) {
          return waveIndex === 0
            ? [
                { kind: 'glutton', hp: 14, label: 'Gorgon the Glutton' },
                { kind: 'weasel', hp: 48, label: 'Sly Woodland Weasel' },
              ]
            : [
                { kind: 'glutton', hp: 16, label: 'Gorgon the Glutton' },
                { kind: 'weasel', hp: 54 + waveIndex * 2, label: 'Sly Woodland Weasel' },
                { kind: 'spider', hp: 50, label: 'Canopy Silk Spider' },
              ];
        }
        if (ws.stageNum === 3) {
          return [
            { kind: 'glutton', hp: 16, label: 'Gorgon the Glutton' },
            { kind: 'weasel', hp: 56 + waveIndex * 2, label: 'Sly Woodland Weasel' },
            { kind: 'spider', hp: 52 + waveIndex * 2, label: 'Canopy Silk Spider' },
          ];
        }
        // Stage 3-4 Gourmet Vulture Boss Finale
        if (waveIndex === 0) {
          return [
            { kind: 'vulture', hp: 100, label: 'Gourmet Vulture' },
            { kind: 'weasel', hp: 52, label: 'Sly Woodland Weasel' },
          ];
        }
        return [
          { kind: 'vulture', hp: 125 + waveIndex * 5, label: 'Gourmet Vulture' },
          { kind: 'glutton', hp: 16, label: 'Gorgon the Glutton' },
          { kind: 'spider', hp: 54 + waveIndex * 2, label: 'Canopy Silk Spider' },
        ];
      },
    };
  }

  // World 4: Volcanic Mystic Peaks - Wyverns, Magma Vipers, Elder Wyvern
  const isBoss = ws.stageNum >= 3;
  return {
    firstWaveDelay: 28 - ws.stageNum,
    waveInterval: 36 - ws.stageNum,
    isBossStage: isBoss,
    getWaveEnemies: (waveIndex: number) => {
      if (ws.stageNum === 1) {
        return waveIndex === 0
          ? [
              { kind: 'cat', hp: 70, label: 'Volcanic Feline' },
              { kind: 'snake', hp: 65, label: 'Magma Viper' },
            ]
          : [
              { kind: 'cat', hp: 80 + waveIndex * 4, label: 'Volcanic Feline' },
              { kind: 'snake', hp: 72 + waveIndex * 3, label: 'Magma Viper' },
              { kind: 'bombardier', hp: 62, label: 'Volcanic Bombardier' },
            ];
      }
      if (ws.stageNum === 2) {
        return [
          { kind: 'vulture', hp: 130 + waveIndex * 8, label: 'Gourmet Vulture' },
          { kind: 'bombardier', hp: 68 + waveIndex * 4, label: 'Volcanic Bombardier' },
          { kind: 'snake', hp: 70, label: 'Magma Viper' },
        ];
      }
      if (ws.stageNum === 3) {
        return [
          { kind: 'wyvern', hp: 175 + waveIndex * 15, label: 'Volcanic Wyvern' },
          { kind: 'cat', hp: 76 + waveIndex * 3, label: 'Volcanic Feline' },
          { kind: 'bombardier', hp: 70, label: 'Volcanic Bombardier' },
        ];
      }
      // World 4-4 Grand Finale Final Boss!
      if (waveIndex === 0) {
        return [
          { kind: 'wyvern', hp: 260, label: 'Elder Volcanic Wyvern' },
          { kind: 'bombardier', hp: 75, label: 'Volcanic Bombardier' },
        ];
      }
      return [
        { kind: 'wyvern', hp: 320 + waveIndex * 20, label: 'Elder Volcanic Wyvern' },
        { kind: 'wyvern', hp: 180, label: 'Infernal Wyvern Drake' },
        { kind: 'bombardier', hp: 82, label: 'Volcanic Bombardier' },
      ];
    },
  };
}

const KEY = 'aviary-save-v1';

export interface SavedBird {
  stage: number;
  units: number;
  rare: boolean;
  species: string;
  name?: string;
  mama?: boolean;
  hidden?: boolean;
  hometown?: string;
  purchaseDate?: string;
  mentalState?: string;
  additionalNotes?: string;
}

export type BirdBehavior = 'standard' | 'breeder' | 'carnivore' | 'gourmet' | 'apex' | 'singer';

export interface BirdSpeciesDef {
  key: string;
  name: string;
  role: string;
  desc: string;
  foodDiet: string;
  body: number;
  belly: number;
  wing: number;
  beak?: number;
  crest?: boolean;
  teeth?: boolean;
  horns?: boolean;
  angry?: boolean;
  gemCost: number;
  coinMultiplier: number;
  behavior: BirdBehavior;
  rarity: 'Common' | 'Rare' | 'Exotic' | 'Legendary';
}

export const BIRD_CATALOGUE: BirdSpeciesDef[] = [
  {
    key: 'sparrow',
    name: 'Songbird',
    role: 'Acrobatic Flyer & Weaver',
    desc: 'Graceful teal and golden songbird. Dives down for seeds, gathers twigs, and weaves cozy nests!',
    foodDiet: 'Seeds & Grains',
    body: 0x00b4a0,
    belly: 0xffd166,
    wing: 0xf3722c,
    beak: 0xffb703,
    gemCost: 25,
    coinMultiplier: 1.0,
    behavior: 'standard',
    rarity: 'Common',
  },
  {
    key: 'canary',
    name: 'Yellow Canary',
    role: 'Songster',
    desc: 'Eats seeds. Sings cheerful songs that cheer up nearby birds to drop coins and gems!',
    foodDiet: 'Seeds & Grains',
    body: 0xffe45e,
    belly: 0xfff6bf,
    wing: 0xf0c030,
    gemCost: 40,
    coinMultiplier: 1.2,
    behavior: 'singer',
    rarity: 'Common',
  },
  {
    key: 'mama',
    name: 'Mama Songbird',
    role: 'Breeder',
    desc: 'Flies freely and lays eggs in cozy nests that hatch into songbird chicks! Needs regular feeding to stay healthy.',
    foodDiet: 'Parachute Seeds & Corn (Needs regular feeding)',
    body: 0xff8fb0,
    belly: 0xfff0f5,
    wing: 0xd9577f,
    crest: true,
    gemCost: 75,
    coinMultiplier: 1.4,
    behavior: 'breeder',
    rarity: 'Rare',
  },
  {
    key: 'tree_creeper',
    name: 'Tree Creeper',
    role: 'Beetle Forager',
    desc: 'Hops along bark and perches. Crunches baby chicks to drop Golden Tree Beetles worth 150c!',
    foodDiet: 'Live Feeder Chicks',
    body: 0x6d4c41,
    belly: 0xf5ebe0,
    wing: 0x4e342e,
    beak: 0xd7ccc8,
    gemCost: 90,
    coinMultiplier: 2.0,
    behavior: 'carnivore',
    rarity: 'Rare',
  },
  {
    key: 'toucan',
    name: 'Rainbow Toucan',
    role: 'Beetle Muncher',
    desc: 'The Beetle Muncher! Swoops mid-air to catch Golden Tree Beetles and drops dazzling Forest Pearls worth 500c!',
    foodDiet: 'Golden Tree Beetles',
    body: 0x22222b,
    belly: 0xffd966,
    wing: 0x111116,
    beak: 0xff9900,
    gemCost: 110,
    coinMultiplier: 3.5,
    behavior: 'gourmet',
    rarity: 'Exotic',
  },
  {
    key: 'piranha_finch',
    name: 'Peregrine Falcon',
    role: 'Apex Raptor Hunter',
    desc: 'The fastest bird in the skies! Dives at 240 mph to hunt feeder chicks and drop Brilliant Diamonds!',
    foodDiet: 'Live Feeder Chicks',
    body: 0x37465f,
    belly: 0xf5f5fa,
    wing: 0x283246,
    beak: 0xffd700,
    angry: true,
    gemCost: 160,
    coinMultiplier: 3.5,
    behavior: 'carnivore',
    rarity: 'Exotic',
  },
  {
    key: 'owl',
    name: 'Great Horned Owl',
    role: 'Apex Raptor',
    desc: 'The king of the forest! Hunts Carnivore birds and drops massive Treasure Chests!',
    foodDiet: 'Feeder Birds & Carnivores',
    body: 0x4a3625,
    belly: 0xd5c4a1,
    wing: 0x2c1f14,
    beak: 0xf0b030,
    horns: true,
    gemCost: 320,
    coinMultiplier: 5.0,
    behavior: 'apex',
    rarity: 'Legendary',
  },
  {
    key: 'infiltrator',
    name: 'Suspicious Finch',
    role: 'Rare Songbird (?)',
    desc: 'Something about this bird is slightly unusual. It cannot fly very high, purrs when fed, and tries its absolute best.',
    foodDiet: 'Seeds (Purrs for treats)',
    body: 0xe67e22,
    belly: 0xfdebd0,
    wing: 0xb9770e,
    beak: 0xf4d03f,
    gemCost: 99,
    coinMultiplier: 2.0,
    behavior: 'standard',
    rarity: 'Legendary',
  },
  {
    key: 'phoenix',
    name: 'Golden Phoenix',
    role: 'Solar Deity',
    desc: 'Reborn from the sacred pyre! Radiates celestial fire and periodically drops dazzling 500c Sun Embers.',
    foodDiet: 'Sweet Berries & Sacred Sparks',
    body: 0xd32f2f,
    belly: 0xffd54f,
    wing: 0xff6f00,
    beak: 0xffeb3b,
    crest: true,
    gemCost: 380,
    coinMultiplier: 5.0,
    behavior: 'standard',
    rarity: 'Legendary',
  },
];

export function getSpeciesDef(key: string): BirdSpeciesDef {
  return BIRD_CATALOGUE.find((b) => b.key === key) ?? BIRD_CATALOGUE[0];
}

/**
 * Returns the 3 birds featured in the Pet Store today,
 * deterministically based on UTC calendar date.
 */
export function getDailyPetStoreBirds(dateStr?: string): BirdSpeciesDef[] {
  const dayStr = dateStr ?? new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dayStr.length; i++) {
    hash = (hash * 31 + dayStr.charCodeAt(i)) >>> 0;
  }
  const pool = [...BIRD_CATALOGUE];
  const selected: BirdSpeciesDef[] = [];
  while (selected.length < 3 && pool.length > 0) {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    const idx = hash % pool.length;
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected;
}

/** Returns formatted string "Xh Ym" until midnight UTC when the shop rotates. */
export function getTimeUntilNextStoreRotation(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const diffMs = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

// ------------------------------------------------ THE BIRD EMPORIUM
// Direct aviary translation of Insaniquarium's Fish Emporium
export interface EmporiumSlotDef {
  id: string; // 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'upgrade' | 'backdrop'
  name: string;
  category: 'bird' | 'upgrade' | 'backdrop';
  speciesKey?: string;
  cost: number;
  icon: string;
  desc: string;
  badge?: string;
}

export const EMPORIUM_SLOTS: EmporiumSlotDef[] = [
  // Slot A: 25 Gems (Top-Left Niche)
  {
    id: 'A',
    name: 'House Sparrow',
    category: 'bird',
    speciesKey: 'sparrow',
    cost: 25,
    icon: 'bird_sparrow',
    desc: 'Cheerful common sparrow. Grows into an adult and drops silver/gold coins.',
    badge: 'COMMON',
  },
  // Slot B: 100 Gems (Mid-Left Niche)
  {
    id: 'B',
    name: 'Peregrine Falcon',
    category: 'bird',
    speciesKey: 'piranha_finch',
    cost: 100,
    icon: 'bird_piranha_finch',
    desc: 'Apex raptor hunter! Dives to hunt feeder chicks and drops valuable 200c Diamonds.',
    badge: 'CARNIVORE',
  },
  // Slot C: 500 Gems (Top Niche 1)
  {
    id: 'C',
    name: 'Yellow Canary',
    category: 'bird',
    speciesKey: 'canary',
    cost: 500,
    icon: 'bird_canary',
    desc: 'Golden songbird! Sings melodic songs that prompt nearby birds to drop extra currency.',
    badge: 'SONGBIRD',
  },
  // Slot D: 1,000 Gems (Top Niche 2)
  {
    id: 'D',
    name: 'Mama Songbird',
    category: 'bird',
    speciesKey: 'mama',
    cost: 1000,
    icon: 'bird_mama',
    desc: 'Flies freely and lays warm eggs in completed nests that hatch into songbirds.',
    badge: 'BREEDER',
  },
  // Slot E: 10,000 Gems (Top Niche 3)
  {
    id: 'E',
    name: 'Golden Phoenix',
    category: 'bird',
    speciesKey: 'phoenix',
    cost: 10000,
    icon: 'bird_phoenix',
    desc: 'Immortal firebird! Radiates divine golden embers worth 500c currency.',
    badge: 'LEGENDARY',
  },
  // Slot F: 25,000 Gems (Top Niche 4)
  {
    id: 'F',
    name: 'Great Horned Owl',
    category: 'bird',
    speciesKey: 'owl',
    cost: 25000,
    icon: 'bird_owl',
    desc: 'Master apex predator! Hunts carnivores and drops giant gem treasure chests.',
    badge: 'APEX',
  },
  // Upgrade Slot: 20,000 Gems (Bottom-Left Niche)
  {
    id: 'upgrade',
    name: 'Elixir of Growth',
    category: 'upgrade',
    cost: 20000,
    icon: 'emporium_potion',
    desc: 'Ancient alchemical tonic! Instantly matures and boosts every growing bird in your aviary.',
    badge: 'UPGRADE',
  },
  // Backdrop Slot: 15,000 Gems (Bottom-Right Niche)
  {
    id: 'backdrop',
    name: 'Blossom Sanctuary',
    category: 'backdrop',
    cost: 15000,
    icon: 'backdrop_preview',
    desc: 'Unlocks the dreamy Blossom Sanctuary botanical wallpaper for your aviary.',
    badge: 'WALLPAPER',
  },
];

export interface SuspendedSession {
  level: number;
  coins: number;
  weapon: number;
  eggs: number;
  petKeys: string[];
  birdCount: number;
  quality?: number;
  maxFood?: number;
  birds?: SavedBird[];
  stageName?: string;
  label?: string;
}

export interface Save {
  level: number;
  /** Player's custom profile name (defaults to 'Keeper'). */
  playerName?: string;
  /** Premium currency, exclusively used in "My Aviary". */
  gems: number;
  /** Scenery aspect ratio preference: '16:9' (Widescreen) or '4:3' (Classic). */
  aspectRatio?: '16:9' | '4:3';
  /** The persistent sandbox aviary. */
  sandbox?: {
    birds: SavedBird[];
    pets?: string[];
    quality?: number;
    maxFood?: number;
    weapon?: number;
    wallpaper?: number;
  };
  /** Overall Time Trial high score in coins. */
  timeTrialHighScore?: number;
  /** Per-stage Time Trial high scores keyed by flat stage level (1 to 16). */
  timeTrialScores?: Record<number, number>;
  /** Unlocked achievements keyed by achievement id with timestamp. */
  achievements?: Record<string, number>;
  /** Unlocked special challenges keyed by challenge id with status ('unlocked' | 'completed'). */
  challenges?: Record<string, 'unlocked' | 'completed'>;
  /** Persistent session saved when leaving mid-game to menu */
  suspendedSession?: SuspendedSession;
  /** Audio toggles */
  soundEnabled?: boolean;
  musicEnabled?: boolean;
}

/**
 * Set to true only once real payments (Stripe on the web, or the App Store / Google Play
 * in-app purchases for the mobile apps) are wired up. While false, gem packs are free test grants.
 */
export const PAYMENTS_LIVE = false;

export interface GemPack {
  gems: number;
  price: string;
}

export const GEM_PACKS: GemPack[] = [
  { gems: 50, price: '$0.99' },
  { gems: 300, price: '$4.99' },
  { gems: 700, price: '$9.99' },
];

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { level: 1, gems: 0, ...(JSON.parse(raw) as Partial<Save>) };
  } catch {
    /* ignore */
  }
  return { level: 1, gems: 0 };
}

/** Update only some fields of the save. */
export function patchSave(p: Partial<Save>) {
  writeSave({ ...loadSave(), ...p });
}

export function writeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
