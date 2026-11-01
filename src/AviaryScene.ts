import Phaser from 'phaser';
import { drawBranchLeaves, drawTreeCrownFront, drawStandaloneLeafCluster, renderWholeTreeStructure } from './BranchFoliage';
import { makeTextures } from './art';
import {
  playSirenSound,
  playWeaponSound,
  playVictoryChirp,
  playFoodDropSound,
  playBirdEatSound,
  playCoinCollectSound,
  playGemCollectSound,
  playEggDropSound,
  playPettingSound,
  playBirdEvolveSound,
  playHungryChirpSound,
  playShopBuySound,
  playShopErrorSound,
  playEggPieceSound,
  playStageClearFanfare,
  playPredatorSpawnSound,
  playPredatorHurtSound,
  playPredatorDefeatedSound,
  playMissileExplosionSound,
  playButtonClickSound,
} from './audio';
import { unlockAchievement } from './achievements';
import { LogbookUI } from './LogbookUI';
import {
  BIRD_CATALOGUE,
  BirdSpeciesDef,
  EMPORIUM_SLOTS,
  GEM_PACKS,
  PAYMENTS_LIVE,
  PETS,
  PetDef,
  PredatorKind,
  SavedBird,
  WaveEnemy,
  difficulty,
  eggPieceCost,
  getDailyPetStoreBirds,
  getSpeciesDef,
  getTimeUntilNextStoreRotation,
  getUnlockedPets,
  getWorldAndStage,
  loadSave,
  maxPets,
  patchSave,
  themeFor,
} from './data';
import {
  LevelLayoutDef,
  loadLevelLayout,
  getDefaultLevelDesign,
  TreeDef,
  BranchDef,
} from './LevelDesignData';
import { LevelDesigner } from './LevelDesigner';

export const W = 1280;
export const H = 720;
const BAR_Y = 626; // top of toolbar
const FONT = 'Trebuchet MS, Verdana, sans-serif';

const STAGE_SCALE = [0.75, 0.88, 1.02, 1.10];
const STAGE_COIN = [0, 10, 25, 80];
const STAGE_UNITS = [4, 10, 20]; // total food units needed to reach stage 1, 2, 3
const MAX_BIRDS = 999;
const FOOD_COST = 5;
const FOOD_FILL = [55, 75, 100];
const FOOD_TEX = ['seed', 'corn', 'berry'];
const QUALITY_COST = [150, 250];
const QUANTITY_COST = [100, 150, 250, 400];

// 5 Weapon Tiers: 0=Stick, 1=Slingshot, 2=Bow, 3=Rifle, 4=Laser
export const WEAPON_NAMES = ['Wooden Stick', 'Slingshot', 'Hunting Bow', 'Rifle Blaster', 'Laser Blaster'];
export const WEAPON_TEX = ['weapon_stick', 'weapon_slingshot', 'weapon_bow', 'weapon_rifle', 'weapon_laser'];
export const WEAPON_COST = [150, 350, 800, 1800];
export const WEAPON_DMG = [1, 2, 4, 7, 12];

interface Spot {
  x: number;
  y: number;
  nest: boolean;
  reserved?: boolean;
  bird?: Bird;
  egg?: Phaser.GameObjects.Image;
  eggT: number;
  eggMother?: Bird;
  nestStage?: number;
  nestGfx?: Phaser.GameObjects.Graphics;
  nestRaidCooldown?: number;
}

interface Food {
  img: Phaser.GameObjects.Image;
  fill: number;
  units: number;
  landed: boolean;
  life: number;
  groundY: number;
  eaten: boolean;
  spinAngle?: number;
  isCinderAcorn?: boolean;
  isPetFood?: boolean;
  vy?: number;
  sway?: number;
}

interface Coin {
  img: Phaser.GameObjects.Image;
  value: number;
  landed: boolean;
  groundY: number;
  life: number;
  collected: boolean;
  isGem?: boolean;
  phase?: number;
}

interface Missile {
  img: Phaser.GameObjects.Image;
  target: Bird;
  speed: number;
  destroyed: boolean;
}

function makeFlyer(scene: Phaser.Scene, key: string, x: number, y: number, depth: number, stage = 2) {
  const s = Math.min(2, Math.max(0, stage));
  const bodyKey = scene.textures.exists(`bird_${key}_${s}`) ? `bird_${key}_${s}` : `bird_${key}`;
  const wingKey = scene.textures.exists(`wing_${key}_${s}`) ? `wing_${key}_${s}` : `wing_${key}`;

  const wingX = s === 0 ? -4 : s === 1 ? -6 : -8;
  const wingY = s === 0 ? 3 : s === 1 ? 4 : 5;

  // Clean, charming 2D Flyer (Original Concept)
  const body = scene.add.image(0, 0, bodyKey);
  const wing = scene.add.image(wingX, wingY, wingKey).setOrigin(0.78, 0.5);

  // Hidden stubs for compatibility
  const wingBack = scene.add.image(0, 0, wingKey).setVisible(false);
  const bodyShadow = scene.add.image(0, 0, bodyKey).setVisible(false);
  const wingShadow = scene.add.image(0, 0, wingKey).setVisible(false);

  const flip = scene.add.container(0, 0, [body, wing]);
  const spr = scene.add.container(x, y, [flip]).setDepth(depth);
  return { body, bodyShadow, wing, wingBack, wingShadow, flip, spr };
}

// ---------------------------------------------------------------- birds
type BirdState = 'wander' | 'seek' | 'toSpot' | 'rest' | 'fetchTwig' | 'buildNest';

export class Bird {
  spr: Phaser.GameObjects.Container;
  flip: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  bodyShadow: Phaser.GameObjects.Image;
  wing: Phaser.GameObjects.Image;
  wingBack?: Phaser.GameObjects.Image;
  wingShadow: Phaser.GameObjects.Image;
  crown: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Image;
  state: BirdState = 'wander';
  buildTarget?: Spot;
  stage: number;
  species: BirdSpeciesDef;
  units = 0;
  fullness = 75 + Math.random() * 20;
  metabolism = 0.88 + Math.random() * 0.24;
  sick = 0;
  dead = false;
  coinT: number;
  layT = 20;
  songT = 14 + Math.random() * 8;
  dir = 1;
  tx = 0;
  ty = 0;
  pause = 0;
  restT = 0;
  restElapsed = 0;
  spot?: Spot;
  parent?: Bird;
  phase = Math.random() * 10;

  name = '';
  easterEgg: string | null = null;
  accessory?: Phaser.GameObjects.Image;
  glasses?: Phaser.GameObjects.Image;
  eyepatch?: Phaser.GameObjects.Image;
  umbrella?: Phaser.GameObjects.Image;
  googly1?: Phaser.GameObjects.Image;
  googly2?: Phaser.GameObjects.Image;
  nameTag?: Phaser.GameObjects.Text;
  eyelid: Phaser.GameObjects.Image;
  beakTwig: Phaser.GameObjects.Image;
  blinkTimer = 2.5 + Math.random() * 3.5;
  shadow: Phaser.GameObjects.Container;
  tailTwitchTimer = 2 + Math.random() * 4;
  bubbleT = 8 + Math.random() * 8;
  loopT = 0;
  hidden = false;
  hometown: string;
  purchaseDate: string;
  mentalState: string;
  additionalNotes: string;
  private wasHungry = false;

  constructor(
    private scene: AviaryScene,
    x: number,
    y: number,
    stage: number,
    public mama = false,
    public rare = false,
    speciesKey = 'sparrow',
    public isFeeder = false
  ) {
    this.stage = stage;
    this.species = getSpeciesDef(speciesKey);
    if (this.species.behavior === 'breeder') this.mama = true;
    this.coinT = 4 + Math.random() * 5;
    const texKey = this.mama ? 'mama' : this.species.key;
    const f = makeFlyer(scene, texKey, x, y, 10, stage);
    this.body = f.body;
    this.bodyShadow = f.bodyShadow;
    this.wing = f.wing;
    this.wingBack = f.wingBack;
    this.wingShadow = f.wingShadow;
    this.flip = f.flip;
    this.spr = f.spr;
    this.crown = scene.add.image(2, -34, 'crown').setRotation(0.2).setVisible(stage === 3 && !this.mama && !this.isFeeder);
    this.flip.add(this.crown);
    this.badge = scene.add.image(-10, -46, 'spark').setTint(0xffd23f).setVisible(rare);
    this.flip.add(this.badge);
    this.eyelid = scene.add.image(10, -5, 'bird_eyelid').setScale(0.85).setVisible(false);
    this.flip.add(this.eyelid);
    this.beakTwig = scene.add.image(33, -1, 'sparrow_twig').setOrigin(0.45, 0.55).setScale(0.95).setVisible(false);
    this.flip.add(this.beakTwig);

    // Clean single soft ground shadow
    const shadowC = scene.add.container(x, y + 36).setDepth(4);
    if (stage === 0 && !isFeeder) {
      unlockAchievement('first_chick', scene);
    }
    const sOuter = scene.add.ellipse(0, 0, 44, 14, 0x050e1c, 0.22);
    shadowC.add(sOuter);
    this.shadow = shadowC;

    const hometowns: Record<string, string> = {
      sparrow: 'Orlando, Fla.',
      canary: 'Canary Islands',
      mama: 'Blossom Sanctuary',
      piranha_finch: 'Alpine Cliff Peaks',
      phoenix: 'Volcanic Mystic Peak',
      owl: 'Sherwood Forest',
    };
    this.hometown = hometowns[this.species.key] ?? 'Canopy Aviary';
    this.purchaseDate = 'OCT 25, 2026';
    const states = ['TOTALLY STOKED', 'HAPPY & CHIRPY', 'FEELING REGAL', 'CONTENT', 'DREAMING OF SEEDS', 'CURIOUS EXPLORER'];
    this.mentalState = states[Math.floor(Math.random() * states.length)];
    const notes: Record<string, string> = {
      sparrow: 'LIKES ENTOMOLOGY, WINDOW TINTING, AND SINGING.',
      canary: 'CAN SING THE ENTIRE FIRST MOVEMENT OF BEETHOVEN’S 5TH.',
      mama: 'LOVES WEAVING COMPACT TWIG NESTS AND TEACHING FLEDGLINGS.',
      piranha_finch: 'DIVES AT 240 MPH. PREFERS FRESH FEEDER CHICKS OVER SEEDS.',
      phoenix: 'IMMORTAL GLOW. REFUSES TO SLEEP IN COLD ROOMS.',
      owl: 'HAS READ ENCYCLOPEDIA BRITANNICA TWICE.',
    };
    this.additionalNotes = notes[this.species.key] ?? 'LOVES BIRD SEED AND SOARING.';

    this.pickSky();
  }

  get isBreeder() {
    return this.mama || this.species.behavior === 'breeder';
  }

  updateTextures() {
    const texKey = this.mama ? 'mama' : this.species.key;
    const s = Math.min(2, Math.max(0, this.stage));
    const bodyKey = this.scene.textures.exists(`bird_${texKey}_${s}`) ? `bird_${texKey}_${s}` : `bird_${texKey}`;
    const wingKey = this.scene.textures.exists(`wing_${texKey}_${s}`) ? `wing_${texKey}_${s}` : `wing_${texKey}`;

    this.body.setTexture(bodyKey);
    this.wing.setTexture(wingKey);
    this.wing.setVisible(true);

    const wingX = s === 0 ? -4 : s === 1 ? -6 : -8;
    const wingY = s === 0 ? 3 : s === 1 ? 4 : 5;
    this.wing.setPosition(wingX, wingY).setOrigin(0.78, 0.5);

    this.eyelid.setPosition(s === 0 ? 8 : s === 1 ? 10 : 13, s === 0 ? -4 : s === 1 ? -5 : -6);
    this.beakTwig.setPosition(s === 0 ? 22 : s === 1 ? 28 : 33, s === 0 ? -1 : s === 1 ? 0 : -1);
    this.beakTwig.setOrigin(0.45, 0.55);
    this.beakTwig.setScale(s === 0 ? 0.75 : s === 1 ? 0.85 : 0.95);
    this.crown.setPosition(4, -36);
    this.crown.setVisible(this.stage === 3 && !this.mama && !this.isFeeder);
  }

  /** Instantly grows the bird one stage (growth potion). */
  growNow() {
    if (this.isFeeder) return;
    if (!this.isBreeder && this.stage < 3) {
      this.addUnits(STAGE_UNITS[this.stage] - this.units);
      this.updateTextures();
      if (this.stage >= 2) {
        unlockAchievement('first_adult', this.scene);
      }
    }
  }

  get scale() {
    return this.isBreeder ? 0.88 : STAGE_SCALE[this.stage];
  }

  private footOffset(nest: boolean) {
    const s = Math.min(2, Math.max(0, this.stage));
    const localFeet = s === 0 ? 26 : s === 1 ? 32 : 37;
    // On a regular branch, feet rest right on the top wood surface (sp.y + 1)
    // In a nest, the bird sits slightly settled down into the nesting bowl (~10px deeper)
    const settle = nest ? 10 * this.scale : 0;
    return (localFeet * this.scale) - 1 - settle;
  }

  private pickSky() {
    // Meaningful bird flight:
    // 1. If well-fed, 35% chance to seek out an empty branch spot to rest and preen!
    if (this.fullness > 65 && Math.random() < 0.35) {
      const emptySpot = this.scene.spots.find((s) => !s.bird && !s.reserved && (!this.isBreeder || s.nest));
      if (emptySpot) {
        emptySpot.bird = this;
        this.spot = emptySpot;
        this.state = 'toSpot';
        return;
      }
    }

    // 2. 30% chance to flock and cruise alongside another flockmate!
    const flockmates = this.scene.birds.filter((b) => b !== this && !b.dead);
    if (flockmates.length > 0 && Math.random() < 0.3) {
      const buddy = Phaser.Utils.Array.GetRandom(flockmates);
      const ang = Math.random() * Math.PI * 2;
      const r = Phaser.Math.Between(45, 110);
      this.tx = Phaser.Math.Clamp(buddy.spr.x + Math.cos(ang) * r, 80, W - 80);
      this.ty = Phaser.Math.Clamp(buddy.spr.y + Math.sin(ang) * r, 90, 480);
      return;
    }

    // 3. Cruising flight path
    this.tx = Phaser.Math.Between(80, W - 80);
    this.ty = Phaser.Math.Between(90, 480);
  }

  leaveSpot() {
    if (this.spot) {
      this.spot.bird = undefined;
      this.spot = undefined;
    }
    if (this.buildTarget) {
      this.buildTarget.reserved = false;
      this.buildTarget = undefined;
    }
  }

  addUnits(n: number) {
    if (this.isFeeder) return;
    this.units += n * (this.rare ? 2 : 1);
    // Regular feeding only matures birds to Adult (Stage 2). Stage 3 (King Songbird) is a special late-game coronation!
    if (!this.isBreeder && this.stage < 2 && this.units >= STAGE_UNITS[this.stage]) {
      this.stage++;
      this.updateTextures();
      playBirdEvolveSound();
      this.scene.burst(this.spr.x, this.spr.y, 0xffe45e, 14);
      this.scene.floatText(this.spr.x, this.spr.y - 40, 'Grew up!', '#fff3c4', '#8a5a00');
      if (this.stage === 2) {
        unlockAchievement('first_adult', this.scene);
      }
    }
  }

  applyName(newName: string) {
    this.name = newName.trim();
    const low = this.name.toLowerCase();

    this.accessory?.destroy();
    this.accessory = undefined;
    this.eyepatch?.destroy();
    this.eyepatch = undefined;
    this.glasses?.destroy();
    this.glasses = undefined;

    this.easterEgg = null;
    this.body.clearTint();
    this.wing.clearTint();

    if (low === 'icarus') {
      this.easterEgg = 'icarus';
      this.body.setTint(0xffaa00);
      this.wing.setTint(0xff5500);
    } else if (low === 'archimedes') {
      this.easterEgg = 'archimedes';
      this.body.setTint(0xfafafa);
      this.wing.setTint(0xeeeeee);
      this.glasses = this.scene.add.image(14, -2, 'glasses_archimedes').setScale(0.85);
      this.flip.add(this.glasses);
    } else if (low === 'woodstock') {
      this.easterEgg = 'woodstock';
      this.body.setTint(0xffeb3b);
      this.wing.setTint(0xfdd835);
    } else if (low === 'hedwig') {
      this.easterEgg = 'hedwig';
      this.body.setTint(0xffffff);
      this.wing.setTint(0xefefef);
    } else if (low === 'twitter' || low === 'larry') {
      this.easterEgg = 'twitter';
      this.body.setTint(0x1da1f2);
      this.wing.setTint(0x0c85d0);
    } else if (low === 'polly') {
      this.easterEgg = 'polly';
      this.accessory = this.scene.add.image(14, -36, 'hat_pirate').setScale(0.9);
      this.eyepatch = this.scene.add.image(18, -4, 'eyepatch').setScale(0.75);
      this.flip.add([this.accessory, this.eyepatch]);
    } else if (low === 'santa' || low === 'kringle') {
      this.easterEgg = 'santa';
      this.accessory = this.scene.add.image(12, -40, 'hat_santa').setScale(0.9);
      this.flip.add(this.accessory);
    } else if (low === 'phoenix') {
      this.easterEgg = 'phoenix';
      this.body.setTint(0xff3d00);
      this.wing.setTint(0xff9100);
    } else if (low === 'nemo' || low === 'prego') {
      this.easterEgg = 'nemo';
      this.body.setTint(0xff6d00);
      this.wing.setTint(0xffffff);
    }

    if (this.name) {
      if (!this.nameTag) {
        this.nameTag = this.scene.add
          .text(0, -56, this.name, {
            fontFamily: FONT,
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#1a0d05',
            strokeThickness: 3,
          })
          .setOrigin(0.5);
        this.spr.add(this.nameTag);
      } else {
        this.nameTag.setText(this.name);
        this.nameTag.setVisible(true);
      }
    } else if (this.nameTag) {
      this.nameTag.setVisible(false);
    }
  }

  setGooglyEyes(enabled: boolean) {
    if (enabled) {
      if (!this.googly1 || !this.googly2) {
        this.googly1 = this.scene.add.image(12, -4, 'googly_eye').setScale(0.7);
        this.googly2 = this.scene.add.image(22, -6, 'googly_eye').setScale(0.85);
        this.flip.add([this.googly1, this.googly2]);
      }
      this.googly1.setVisible(true);
      this.googly2.setVisible(true);
    } else {
      this.googly1?.setVisible(false);
      this.googly2?.setVisible(false);
    }
  }

  setUmbrella(enabled: boolean) {
    if (enabled) {
      if (!this.umbrella) {
        this.umbrella = this.scene.add.image(-12, -44, 'umbrella').setScale(0.9);
        this.flip.add(this.umbrella);
      }
      this.umbrella.setVisible(true);
    } else {
      this.umbrella?.setVisible(false);
    }
  }

  private moveTo(tx: number, ty: number, speed: number, dt: number) {
    const d = Phaser.Math.Distance.Between(this.spr.x, this.spr.y, tx, ty);
    if (d < 6) return true;
    const vx = ((tx - this.spr.x) / d) * speed;
    const vy = ((ty - this.spr.y) / d) * speed;
    this.spr.x += vx * dt;
    this.spr.y += vy * dt;
    if (Math.abs(tx - this.spr.x) > 12) {
      this.dir = tx > this.spr.x ? 1 : -1;
    }

    this.spr.setScale(this.scale, this.scale);

    // Natural Aerodynamic Dive Pitch:
    // When seeking food downward, tilt into the dive smoothly!
    // The parent container spr is rotated: when facing right (dir=1), rotate clockwise (+).
    // When facing left (dir=-1), rotate counter-clockwise (-).
    // In both cases, the beak dives downward and tail tilts upward! Never dive with butt!
    if (this.state === 'seek' && vy > 30) {
      const divePitch = Math.min(0.85, (vy / speed) * 0.95);
      this.spr.rotation = Phaser.Math.Linear(this.spr.rotation, this.dir * divePitch, 0.22);
    } else {
      this.spr.rotation = Phaser.Math.Linear(this.spr.rotation, 0, 0.18);
    }
    this.flip.rotation = 0;

    return d - speed * dt < 6;
  }

  update(dt: number, t: number) {
    if (this.hidden) {
      this.spr.setVisible(false);
      return;
    }
    const inCombat = this.scene.predators.some((p) => !p.dying && p.kind !== 'glutton');
    if (!inCombat) {
      const baseHunger = this.isBreeder ? 4.0 : this.stage === 0 ? 5.2 : 4.4;
      const hungerRate = baseHunger * this.metabolism;
      this.fullness = Math.max(0, this.fullness - hungerRate * dt);
      if (this.fullness <= 0) {
        this.sick += dt;
        // Insaniquarium-style starving: solid pale sickly ash-grey (distinct from hungry green, no strobe flashing)
        const sickColor = 0x88929e;
        this.body.setTint(sickColor);
        this.wing.setTint(sickColor);
        this.spr.rotation = 0.22 * this.dir + Math.sin(t * 0.02) * 0.08; // weak struggling wobble

        // Insaniquarium-fast starvation death (3.0s window!)
        const maxSick = this.scene.sandbox ? (this.isFeeder ? 8 : 999999) : 3.0;
        if (this.sick > maxSick) {
          this.scene.killBird(this, 'starved');
          return;
        }
      } else {
        this.sick = 0;
        if (this.fullness < 50) {
          if (!this.wasHungry) {
            playHungryChirpSound();
            this.wasHungry = true;
          }
          // Insaniquarium hungry warning: distinct vibrant lime green!
          this.body.setTint(0x84cc16);
          this.wing.setTint(0x84cc16);
        } else {
          this.wasHungry = false;
          if (!this.easterEgg) {
            this.body.clearTint();
            this.wing.clearTint();
          }
        }
      }
    }
    if (this.rare) this.badge.setScale(1.4 + 0.4 * Math.sin(t * 0.006));
    this.layT -= dt;
    this.flip.scaleX = this.dir;

    // Lifelike blinking animation
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.eyelid.setVisible(true);
      if (this.blinkTimer <= -0.12) {
        this.eyelid.setVisible(false);
        this.blinkTimer = 3.2 + Math.random() * 4.0;
      }
    }

    // 2.5D Dynamic Multi-Tier Altitude Ground & Branch Shadow
    this.shadow.setVisible(!this.hidden && !this.dead);
    this.shadow.x = this.spr.x;

    let surfaceY = 594;
    if (this.state === 'rest' && this.spot) {
      surfaceY = this.spot.y + 1;
      this.shadow.y = surfaceY;
      this.shadow.setScale(this.scale * 0.75, this.scale * 0.35);
      this.shadow.setAlpha(0.38);
    } else {
      // Find nearest perch or canopy branch surface below the bird
      for (const sp of this.scene.spots) {
        if (Math.abs(sp.x - this.spr.x) < 38 && sp.y > this.spr.y && sp.y < surfaceY) {
          surfaceY = sp.y;
        }
      }
      this.shadow.y = surfaceY;
      const altitude = Math.max(0, surfaceY - this.spr.y);
      const altNorm = Phaser.Math.Clamp(altitude / 450, 0, 1);
      // High altitude: wider, softer; low altitude: tighter, darker, sharper
      const shadowScaleX = (0.7 + altNorm * 0.65) * this.scale;
      const shadowScaleY = (0.35 + altNorm * 0.25) * this.scale;
      const shadowAlpha = Phaser.Math.Clamp(0.38 - altNorm * 0.26, 0.08, 0.38);
      this.shadow.setScale(shadowScaleX, shadowScaleY);
      this.shadow.setAlpha(shadowAlpha);
    }

    // Maintain consistent top-left ambient light angle for body shadow
    this.bodyShadow.x = 5 * this.dir;
    this.bodyShadow.y = 7;

    // Easter Egg Flight Quirks
    if (this.easterEgg === 'icarus') {
      this.ty = Phaser.Math.Between(40, 110);
      if (Math.random() < 0.12) this.scene.burst(this.spr.x, this.spr.y, 0xffd700, 1);
    } else if (this.easterEgg === 'woodstock') {
      this.loopT += dt;
      this.flip.scaleY = Math.sin(this.loopT * 1.8) > 0.1 ? -1 : 1;
      this.spr.y += Math.sin(t * 0.012) * 1.6;
    } else if (this.easterEgg === 'twitter') {
      if (Math.random() < 0.07) this.scene.burst(this.spr.x, this.spr.y, 0x1da1f2, 1);
    } else if (this.easterEgg === 'nemo') {
      if (Math.random() < 0.08) this.scene.burst(this.spr.x, this.spr.y, 0x00e5ff, 1);
    } else if (this.easterEgg === 'polly') {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 16 + Math.random() * 12;
        this.scene.pollyChat(this);
      }
    }

    // Disco Mode Headbob
    if (this.scene.discoMode) {
      this.spr.y += Math.sin(t * 0.015 + this.phase) * 1.5;
    }

    const hungry = this.fullness < 65;
    const isHunter = this.species.behavior === 'carnivore' || this.species.behavior === 'apex';
    if (hungry && this.state !== 'seek') {
      if (isHunter) {
        const prey = this.scene.nearestPrey(this.spr.x, this.spr.y, this);
        if (prey) {
          this.leaveSpot();
          this.state = 'seek';
        }
      } else if (this.scene.foods.some((f) => !f.eaten && (this.species.behavior !== 'gourmet' || f.units >= 3))) {
        this.leaveSpot();
        this.state = 'seek';
      }
    }

    let flying = true;
    switch (this.state) {
      case 'seek': {
        if (isHunter) {
          const prey = this.scene.nearestPrey(this.spr.x, this.spr.y, this);
          if (prey) {
            const reached = this.moveTo(prey.spr.x, prey.spr.y, 210, dt);
            if (reached || Phaser.Math.Distance.Between(this.spr.x, this.spr.y, prey.spr.x, prey.spr.y) < 28) {
              this.scene.eatPrey(this, prey);
              this.state = 'wander';
              this.pause = 0.8;
            }
            break;
          }
          // Hunters (Falcon & Owl) only hunt live birds; they never eat grain or seeds!
          this.state = 'wander';
          this.pause = 0.6;
          break;
        }
        const f = this.scene.nearestFood(this.spr.x, this.spr.y, this.species.behavior === 'gourmet');
        if (!f || !hungry) {
          this.state = 'wander';
          this.pause = 0.3;
          break;
        }
        const isDescending = f.img.y > this.spr.y + 25;
        const seekSpeed = isDescending ? 270 : 190;
        const reached = this.moveTo(f.img.x, f.img.y - 10 * this.scale, seekSpeed, dt);
        if (reached || Phaser.Math.Distance.Between(this.spr.x, this.spr.y, f.img.x, f.img.y) < 22) {
          this.scene.eatFood(f, this);
          this.state = 'wander';
          this.pause = 1.0 + Math.random() * 0.8;
        }
        break;
      }
      case 'wander': {
        if (this.pause > 0) {
          this.pause -= dt;
          this.flip.rotation = 0;
          this.spr.rotation = 0;
          this.spr.y += Math.sin(t * 0.005 + this.phase) * 0.35;
          if (this.pause <= 0) this.chooseNext();
        } else if (this.moveTo(this.tx, this.ty, 110, dt)) {
          this.pause = 0.3 + Math.random() * 0.7;
        }
        break;
      }
      case 'fetchTwig': {
        if (hungry || this.fullness < 70) {
          this.leaveSpot();
          this.state = 'wander';
          break;
        }
        if (this.scene.frogmouth && this.scene.frogmouth.active) {
          const bugDist = Phaser.Math.Distance.Between(this.spr.x, this.spr.y, this.scene.frogmouth.x, this.scene.frogmouth.y);
          if (bugDist < 65) {
            this.scene.peekStickBug();
          }
        }
        if (this.moveTo(this.tx, this.ty, 160, dt)) {
          this.scene.burst(this.spr.x, this.spr.y, 0x8a5528, 6);
          this.scene.burst(this.spr.x, this.spr.y, 0x3fae55, 4);
          this.scene.floatText(this.spr.x, this.spr.y - 25, '🌿 Found Twigs!', '#86efac', '#14532d');
          if (this.buildTarget && (!this.buildTarget.bird || this.buildTarget.bird === this)) {
            this.state = 'buildNest';
            this.tx = this.buildTarget.x;
            this.ty = this.buildTarget.y - this.footOffset(true);
            this.pause = 0.2;
          } else {
            this.leaveSpot();
            this.state = 'wander';
          }
        }
        break;
      }
      case 'buildNest': {
        if (hungry || this.fullness < 70) {
          this.leaveSpot();
          this.state = 'wander';
          break;
        }
        const target = this.buildTarget;
        if (!target) {
          this.state = 'wander';
          break;
        }
        if (this.moveTo(target.x, target.y - this.footOffset(true), 150, dt)) {
          flying = false;
          this.flip.rotation = 0;
          this.spr.rotation = 0;
          this.scene.tweens.add({
            targets: this.flip,
            y: -3,
            duration: 80,
            yoyo: true,
            repeat: 5,
          });
          target.nestStage = Math.min(6, (target.nestStage ?? 0) + 1);
          this.scene.drawNest(target);
          this.scene.burst(target.x, target.y + 4, 0x8a5528, 12);
          this.scene.burst(target.x, target.y + 4, 0x3fae55, 6);
          if (target.nestStage === 6) {
            this.scene.burst(target.x, target.y - 15, 0xffd54f, 16);
            this.scene.floatText(target.x, target.y - 35, '🪺 Nest Completed! +50', '#ffd54f', '#78350f');
            this.scene.coins += 50;
            this.scene.refreshUi();
            this.scene.toast(`${this.species.name} completed a cozy nesting cup! +50 feathers!`);
          } else {
            this.scene.floatText(target.x, target.y - 35, `🧺 Weaving Nest (${target.nestStage}/6)`, '#e2e8f0', '#1e293b');
          }
          this.state = 'rest';
          this.spot = target;
          target.bird = this;
          target.reserved = false;
          this.buildTarget = undefined;
          this.restT = 4 + Math.random() * 4;
          this.restElapsed = 0;
        }
        break;
      }
      case 'toSpot': {
        const sp = this.spot;
        if (!sp) {
          this.state = 'wander';
          break;
        }
        if (this.moveTo(sp.x, sp.y - this.footOffset(sp.nest), 130, dt)) {
          this.state = 'rest';
          this.restT = 7 + Math.random() * 8;
          this.restElapsed = 0;
          this.flip.rotation = 0;
          this.spr.rotation = 0;
          this.scene.burst(sp.x, sp.y, 0x3fae55, 3);
        }
        break;
      }
      case 'rest': {
        flying = false;
        const sp = this.spot;
        if (!sp) {
          this.state = 'wander';
          break;
        }
        this.spr.x = sp.x;
        this.spr.y = sp.y - this.footOffset(sp.nest);
        this.restT -= dt;
        this.restElapsed += dt;

        this.flip.rotation = 0;
        this.spr.rotation = 0;
        this.tailTwitchTimer -= dt;
        if (this.tailTwitchTimer <= 0) {
          this.tailTwitchTimer = 3.2 + Math.random() * 3.5;
          this.scene.tweens.add({
            targets: this.flip,
            y: -2.5,
            duration: 85,
            yoyo: true,
          });
        }

        // Mama Songbird: When well-fed, lays egg in a completed cozy nest cup, then takes flight to find another nest!
        if (this.isBreeder && sp.nest && (sp.nestStage ?? 0) >= 6 && !sp.egg && this.layT <= 0 && this.restElapsed > 2.0 && this.fullness >= 65) {
          this.scene.layEgg(sp, this);
          this.layT = this.scene.sandbox ? 18 : 22;
          this.leaveSpot();
          this.state = 'wander';
          this.pause = 0.5;
          break;
        }

        if (this.restT <= 0) {
          this.leaveSpot();
          this.state = 'wander';
          this.pause = 0.2;
        }
        break;
      }
    }

    if (flying && this.state !== 'rest') {
      this.spr.y += Math.sin(t * 0.005 + this.phase) * 0.22;
    }

    this.beakTwig.setVisible(this.state === 'buildNest');

    const flapRate = this.stage === 0 ? 0.046 : this.stage === 1 ? 0.034 : 0.024;
    const flapAmp = this.stage === 0 ? 0.95 : this.stage === 1 ? 0.88 : 0.78;

    this.body.y = 0;
    this.bodyShadow.y = 7;
    this.body.setScale(1);
    this.bodyShadow.setScale(1);
    this.wing.setScale(1);
    this.wingShadow.setScale(1);
    if (this.wingBack) this.wingBack.setScale(1);

    const isDiving = this.state === 'seek' && Math.abs(this.spr.rotation) > 0.18;

    if (isDiving) {
      // Aerodynamic dive plunge: wings tucked back tight along the body!
      this.wing.rotation = Phaser.Math.Linear(this.wing.rotation, 0.22, 0.25);
    } else if (flying) {
      // Natural wing flapping rotating around shoulder socket
      const wingAngle = Math.sin(t * flapRate + this.phase) * flapAmp;
      this.wing.rotation = wingAngle;
    } else {
      // Perched / Resting: folded back neatly
      const foldAngle = -0.05 + Math.sin(t * 0.003 + this.phase) * 0.03;
      this.wing.rotation = foldAngle;
    }

    // Songster chirp: Canary sings and prompts nearby birds to drop currency
    if (this.species.behavior === 'singer' && this.fullness >= 35) {
      this.songT -= dt;
      if (this.songT <= 0) {
        this.songT = 22 + Math.random() * 10;
        this.scene.birdChirp(this);
      }
    }

    // Currency drops: strictly timed interval independent of feeding
    if (!this.isBreeder && !isHunter && this.stage >= 1) {
      this.coinT -= dt;
      if (this.coinT <= 0) {
        if (this.sick === 0) {
          this.dropCurrency();
        }
        const baseInterval = this.scene.sandbox
          ? (this.stage === 3 ? 75 : 65) // Balanced: 65 - 85s in My Aviary
          : (this.stage === 3 ? 12 : 11);
        this.coinT = baseInterval + Math.random() * 8;
      }
    }
  }

  dropCurrency() {
    if (this.stage === 0) return; // Baby birds never drop feathers!
    if (this.species.key === 'phoenix') {
      if (this.scene.sandbox) {
        if (this.fullness < 40) return;
        this.scene.dropGem(this.spr.x, this.spr.y + 20 * this.scale, 3, 'drop_solar_ember');
      } else {
        this.scene.dropCoin(this.spr.x, this.spr.y + 20 * this.scale, 500, 'drop_solar_ember');
      }
      this.scene.burst(this.spr.x, this.spr.y + 10, 0xffd54f, 8);
      return;
    }
    if (this.easterEgg === 'hedwig') {
      if (this.scene.sandbox) {
        if (this.fullness < 40) return;
        this.scene.dropGem(this.spr.x, this.spr.y + 20 * this.scale, 2, 'drop_envelope');
      } else {
        this.scene.dropCoin(this.spr.x, this.spr.y + 20 * this.scale, 250);
      }
      return;
    }
    if (this.easterEgg === 'santa') {
      if (this.scene.sandbox) {
        if (this.fullness < 40) return;
        this.scene.dropGem(this.spr.x, this.spr.y + 20 * this.scale, 2, 'drop_candycane');
      } else {
        this.scene.dropCoin(this.spr.x, this.spr.y + 20 * this.scale, 150);
      }
      return;
    }
    if (this.scene.sandbox) {
      // In My Aviary: Only well-fed, happy birds (fullness >= 65) drop gems!
      if (this.fullness < 65) return;
      const amt = this.species.behavior === 'gourmet' ? 2 : this.stage === 3 ? 1 + (Math.random() < 0.25 ? 1 : 0) : 1;
      const tex = this.species.behavior === 'gourmet' ? 'goldegg' : 'gem';
      this.scene.dropGem(this.spr.x, this.spr.y + 20 * this.scale, amt, tex);
    } else {
      if (this.species.behavior === 'gourmet') {
        this.scene.dropCoin(this.spr.x, this.spr.y + 20 * this.scale, 250);
      } else {
        const base = STAGE_COIN[this.stage] * (this.rare ? 2 : 1);
        this.scene.dropCoin(this.spr.x, this.spr.y + 20 * this.scale, Math.round(base * this.species.coinMultiplier));
      }
    }
  }

  private chooseNext() {
    // 1. Between feeding: only satiated birds that reached medium size (stage >= 1, fullness >= 75) gather twigs and weave nests!
    if (this.stage >= 1 && this.fullness >= 75 && !this.scene.predators.some((p) => !p.dying && p.kind !== 'glutton')) {
      const unfinished = this.scene.spots.find((s) => s.nest && (s.nestStage ?? 0) < 6 && !s.bird && !s.reserved);
      const buildChance = this.isBreeder ? 0.85 : 0.45;
      if (unfinished && Math.random() < buildChance) {
        unfinished.reserved = true;
        this.buildTarget = unfinished;
        this.state = 'fetchTwig';
        this.tx = Phaser.Math.Between(220, W - 220);
        this.ty = 582; // Down to the forest floor/foliage to gather twigs!
        return;
      }
    }

    const free = this.scene.spots.filter((s) => !s.bird && !s.reserved && !(s.nest && s.egg));
    if (free.length > 0 && Math.random() < 0.45) {
      const nests = free.filter((s) => s.nest && (s.nestStage ?? 0) >= 6);
      const pool = this.isBreeder && this.layT <= 0 && nests.length > 0 ? nests : free;
      const s = Phaser.Utils.Array.GetRandom(pool);
      s.bird = this;
      this.spot = s;
      this.state = 'toSpot';
    } else {
      this.pickSky();
      this.state = 'wander';
    }
  }
}

function makeGroundOrBranchPredator(scene: Phaser.Scene, kind: string, x: number, y: number, depth: number) {
  const spr = scene.add.container(x, y).setDepth(depth);
  const flip = scene.add.container(0, 0);
  spr.add(flip);
  const body = scene.add.image(0, 0, 'enemy_' + kind);
  flip.add(body);
  const dummyWing = scene.add.image(0, 0, 'seed').setVisible(false);
  return { spr, flip, body, wing: dummyWing };
}

// ----------------------------------------------------------- predators
export class Predator {
  kind: PredatorKind;
  spr: Phaser.GameObjects.Container;
  flip: Phaser.GameObjects.Container;
  wing: Phaser.GameObjects.Image;
  body: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  bar: Phaser.GameObjects.Graphics;
  hp: number;
  maxHp: number;
  stun = 0;
  kx = 0;
  ky = 0;
  dir = 1;
  dying = false;
  gone = false;
  pause = 0;
  target?: Bird;
  wx = 0;
  wy = 0;
  phase = Math.random() * 10;
  foodsEaten = 0;
  maxFoods = 10;
  private missileCooldown = 5.0;
  private catLeaping = false;
  private catVy = 0;
  private catCrouchT = 0;
  private spiderT = 0;
  private wyvernState: 'stalk' | 'swoop' | 'recover' = 'stalk';
  private wyvernTimer = 4.0;
  private wyvernTargetX = 500;
  private wyvernTargetY = 400;
  private hawkState: 'circle' | 'swoop' | 'climb' = 'circle';
  private hawkCircleCenterX = 500;
  private hawkCircleCenterY = 170;
  private hawkCircleRadius = 150;
  private hawkCircleDir = 1;
  private hawkAngle = 0;
  private hawkScanTimer = 2.5;
  private hawkSwoopTimer = 2.2;
  private hawkClimbTimer = 1.6;
  private hawkLockedBird?: Bird;
  private snakeState: 'stalk' | 'hide' | 'strike' | 'recover' = 'stalk';
  private snakeTimer = 2.5;
  private snakeTarget?: Bird;
  private snakeRattleT = 0;
  vultureState: 'active' | 'dormant' = 'active';
  vultureTimer = 10.0;
  vultureHitCount = 0;
  private batTimer = 0;
  private batSwoop = false;
  private batTarget?: Bird;
  batWingL?: Phaser.GameObjects.Image;
  batWingR?: Phaser.GameObjects.Image;

  constructor(private scene: AviaryScene, kind: PredatorKind, hp: number) {
    this.kind = kind;
    this.hp = hp;
    this.maxHp = hp;
    if (kind === 'bat') {
      const spawnX = Math.random() < 0.5 ? -80 : W + 80;
      const spawnY = Phaser.Math.Between(130, 240);
      const spr = scene.add.container(spawnX, spawnY).setDepth(14);
      const flip = scene.add.container(0, 0);
      spr.add(flip);

      // Dynamic articulated bat with separate flapping wings!
      const wingL = scene.add.image(-10, -2, 'enemy_bat_wing_left').setOrigin(0.92, 0.54);
      const wingR = scene.add.image(10, -2, 'enemy_bat_wing_right').setOrigin(0.08, 0.54);
      const body = scene.add.image(0, 0, 'enemy_bat_body');
      flip.add([wingL, wingR, body]);

      this.body = body;
      this.wing = wingL;
      this.batWingL = wingL;
      this.batWingR = wingR;
      this.flip = flip;
      this.spr = spr;
      this.spr.setScale(hp > 30 ? 1.7 : 1.2);
    } else if (kind === 'vulture' || kind === 'bombardier') {
      const spawnX = Math.random() < 0.5 ? -80 : W + 80;
      const spawnY = Phaser.Math.Between(130, 240);
      const spr = scene.add.container(spawnX, spawnY).setDepth(14);
      const flip = scene.add.container(0, 0);
      spr.add(flip);
      const tex = kind === 'bombardier' ? 'enemy_bombardier' : 'enemy_vulture_active';
      const body = scene.add.image(0, 0, tex);
      flip.add(body);
      const dummyWing = scene.add.image(0, 0, 'seed').setVisible(false);
      this.body = body;
      this.wing = dummyWing;
      this.flip = flip;
      this.spr = spr;
      this.spr.setScale(kind === 'bombardier' ? 1.25 : 1.2);
    } else {
      const isFlyer = kind === 'hawk' || kind === 'crow' || kind === 'wyvern';
      if (isFlyer) {
        const left = Math.random() < 0.5;
        const f = makeFlyer(scene, kind, left ? -80 : W + 80, 130, 14);
        this.body = f.body;
        this.wing = f.wing;
        this.flip = f.flip;
        this.spr = f.spr;
        this.spr.setScale(kind === 'wyvern' ? 1.85 : 1.5);
      } else {
        let spawnX = Math.random() < 0.5 ? -60 : W + 60;
        let spawnY = 590;
        if (kind === 'snake') {
          spawnX = Phaser.Math.Between(600, 780);
          spawnY = 140;
        } else if (kind === 'spider') {
          spawnX = Phaser.Math.Between(200, W - 200);
          spawnY = -40;
        } else if (kind === 'raccoon') {
          spawnX = 720;
          spawnY = 580;
        } else if (kind === 'glutton') {
          spawnX = Phaser.Math.Between(200, W - 200);
          spawnY = 320;
        }
        const p = makeGroundOrBranchPredator(scene, kind, spawnX, spawnY, 14);
        this.body = p.body;
        this.wing = p.wing;
        this.flip = p.flip;
        this.spr = p.spr;
        if (kind === 'spider') this.spr.setScale(1.2);
        if (kind === 'glutton') this.spr.setScale(1.1);
      }
    }
    this.bar = scene.add.graphics().setDepth(15);
    this.wx = Phaser.Math.Between(100, W - 100);
    this.wy = 300;
  }

  get radius() {
    switch (this.kind) {
      case 'wyvern': return 78;
      case 'hawk': return 62;
      case 'crow': return 48;
      case 'cat': return 45;
      case 'snake': return 40;
      case 'raccoon': return 46;
      case 'spider': return 44;
      case 'weasel': return 40;
      case 'glutton': return 52;
      case 'bombardier': return 48;
      case 'vulture': return 50;
      case 'bat': return 42;
    }
  }

  enterVultureDormant() {
    this.vultureState = 'dormant';
    this.vultureTimer = 6.0;
    this.vultureHitCount = 0;
    this.body.setTexture('enemy_vulture_dormant');
    this.scene.burst(this.spr.x, this.spr.y, 0x38bdf8, 20);
    this.scene.floatText(this.spr.x, this.spr.y - 50, '😴 FULL & SAVORING! (DO NOT HIT!)', '#38bdf8', '#082f49');
    this.scene.toast('The Gourmet Vulture entered a food coma! STOP attacking or you will heal him!');
  }

  enterVultureActive() {
    this.vultureState = 'active';
    this.vultureTimer = 10.0;
    this.vultureHitCount = 0;
    this.body.setTexture('enemy_vulture_active');
    this.scene.burst(this.spr.x, this.spr.y, 0xef4444, 20);
    this.scene.floatText(this.spr.x, this.spr.y - 50, '🔥 HUNGRY AGAIN! CARVING TIME! 🔥', '#f87171', '#450a0a');
    this.scene.toast('The Gourmet Vulture woke up! ATTACK NOW before he rests again!');
  }

  hit(dmg: number, fromX: number, fromY: number) {
    if (this.dying) return;
    if (this.kind === 'glutton') {
      this.stun = 0.2;
      this.scene.toast('Gorgon is immune to weapons! Feed him until he bursts!');
      this.scene.floatText(this.spr.x, this.spr.y - 30, 'IMMUNE! FEED ME!', '#fbbf24', '#78350f');
      playWeaponSound(0);
      return;
    }
    if (this.kind === 'vulture') {
      if (this.vultureState === 'dormant') {
        const healAmt = 15;
        this.hp = Math.min(this.maxHp, this.hp + healAmt);
        this.scene.burst(this.spr.x, this.spr.y, 0x22c55e, 16);
        this.scene.floatText(this.spr.x, this.spr.y - 45, `⚠️ HEALED! +${healAmt} HP 💚`, '#4ade80', '#14532d');
        this.scene.toast('Cease fire! Attacking the Gourmet Vulture while resting heals him!');
        playWeaponSound(0);
        return;
      }
      this.vultureHitCount++;
      if (this.vultureHitCount >= 7) {
        this.enterVultureDormant();
      }
    }
    this.hp -= dmg;
    playPredatorHurtSound();
    this.stun = 0.16;
    if (this.kind === 'hawk' && this.hawkState === 'swoop') {
      this.hawkState = 'climb';
      this.hawkClimbTimer = 1.4;
      this.hawkLockedBird = undefined;
      this.scene.floatText(this.spr.x, this.spr.y - 30, 'SWOOP INTERRUPTED!', '#ffd54f', '#78350f');
    }
    if (this.kind === 'snake' && (this.snakeState === 'hide' || this.snakeState === 'strike')) {
      this.spr.setAlpha(1.0);
      this.snakeState = 'recover';
      this.snakeTimer = 1.8;
      this.scene.floatText(this.spr.x, this.spr.y - 30, 'AMBUSH BROKEN!', '#ffd54f', '#78350f');
    }
    const a = Math.atan2(this.spr.y - fromY, this.spr.x - fromX);
    this.kx = Math.cos(a) * 75;
    this.ky = Math.sin(a) * 75 - 25;
    this.body.setTint(0xff5050);
    this.wing.setTint(0xff5050);
    this.scene.time.delayedCall(120, () => {
      this.body.clearTint();
      this.wing.clearTint();
    });
    if (this.hp <= 0) {
      this.dying = true;
      this.bar.clear();
      this.scene.onPredatorDown(this);
    }
  }

  private moveTo(tx: number, ty: number, speed: number, dt: number) {
    const d = Phaser.Math.Distance.Between(this.spr.x, this.spr.y, tx, ty);
    if (d < 8) return true;
    const vx = ((tx - this.spr.x) / d) * speed;
    const vy = ((ty - this.spr.y) / d) * speed;
    this.spr.x += vx * dt;
    this.spr.y += vy * dt;
    if (Math.abs(vx) > 8) this.dir = vx > 0 ? 1 : -1;
    this.spr.rotation = Phaser.Math.Clamp((vy / speed) * 0.3 * this.dir, -0.5, 0.5);
    return d < speed * dt + 8;
  }

  update(dt: number, t: number) {
    this.flip.scaleX = this.dir;
    this.wing.rotation = Math.sin(t * 0.03 + this.phase) * 0.9 - 0.2;

    if (this.dying) {
      this.spr.y += 420 * dt;
      this.spr.rotation += 6 * dt;
      if (this.batWingL && this.batWingR) {
        this.batWingL.rotation += 8 * dt;
        this.batWingR.rotation -= 8 * dt;
      }
      if (this.spr.y > H + 100) this.gone = true;
      return;
    }

    // health bar
    this.bar.clear();
    if (this.hp < this.maxHp || (this.kind === 'vulture' && this.vultureState === 'dormant')) {
      const w = 70;
      this.bar.fillStyle(0x000000, 0.5);
      this.bar.fillRoundedRect(this.spr.x - w / 2, this.spr.y - this.radius - 14, w, 9, 4);
      const barColor = this.kind === 'vulture' && this.vultureState === 'dormant' ? 0x38bdf8 : 0xe0243a;
      this.bar.fillStyle(barColor, 1);
      this.bar.fillRoundedRect(this.spr.x - w / 2 + 1, this.spr.y - this.radius - 13, (w - 2) * Math.max(0, this.hp / this.maxHp), 7, 3);
    }

    if (this.stun > 0) {
      this.stun -= dt;
      this.spr.x += this.kx * dt;
      this.spr.y += this.ky * dt;
      this.kx *= 0.92;
      this.ky *= 0.92;
      this.spr.x = Phaser.Math.Clamp(this.spr.x, -100, W + 100);
      this.spr.y = Phaser.Math.Clamp(this.spr.y, 40, 600);
      return;
    }
    if (this.pause > 0) {
      this.pause -= dt;
      return;
    }

    if (this.kind === 'wyvern') this.updateWyvern(dt, t);
    else if (this.kind === 'hawk') this.updateHawk(dt, t);
    else if (this.kind === 'crow') this.updateCrow(dt);
    else if (this.kind === 'cat') this.updateCat(dt);
    else if (this.kind === 'snake') this.updateSnake(dt, t);
    else if (this.kind === 'raccoon') this.updateRaccoon(dt);
    else if (this.kind === 'spider') this.updateSpider(dt, t);
    else if (this.kind === 'weasel') this.updateWeasel(dt, t);
    else if (this.kind === 'glutton') this.updateGlutton(dt, t);
    else if (this.kind === 'bombardier') this.updateBombardier(dt, t);
    else if (this.kind === 'vulture') this.updateVulture(dt);
    else if (this.kind === 'bat') this.updateBat(dt, t);
  }

  private updateBat(dt: number, t: number) {
    // Dynamic wing swinging/flapping animation!
    const flapSpeed = this.batSwoop ? 0.045 : 0.026;
    const flapAmp = this.batSwoop ? 0.88 : 0.65;
    const flap = Math.sin(t * flapSpeed + this.phase);

    if (this.batWingL && this.batWingR) {
      this.batWingL.rotation = -flap * flapAmp;
      this.batWingR.rotation = flap * flapAmp;
      const flex = 0.88 + Math.cos(t * flapSpeed + this.phase) * 0.22;
      this.batWingL.scaleY = flex;
      this.batWingR.scaleY = flex;
    }

    this.spr.rotation = Math.sin(t * 0.018 + this.phase) * 0.22 * this.dir;

    this.batTimer -= dt;
    if (this.batTimer <= 0) {
      this.batTimer = 2.5 + Math.random() * 2.0;
      // 60% chance to target a bird to swoop on
      const victim = this.scene.nearestBird(this.spr.x, this.spr.y);
      if (victim && !victim.dead && Math.random() < 0.65) {
        this.batTarget = victim;
        this.batSwoop = true;
        this.scene.burst(this.spr.x, this.spr.y, 0x818cf8, 4);
        if (Math.random() < 0.35) {
          this.scene.floatText(this.spr.x, this.spr.y - 25, '🦇 *SCREECH!*', '#c084fc', '#2e1065');
        }
      } else {
        this.batSwoop = false;
        this.batTarget = undefined;
        this.wx = Phaser.Math.Between(150, W - 150);
        this.wy = Phaser.Math.Between(100, 360);
      }
    }

    if (this.batSwoop && this.batTarget && !this.batTarget.dead) {
      // Direct flutter swoop toward target
      const tx = this.batTarget.spr.x + Math.sin(t * 0.015) * 15;
      const ty = this.batTarget.spr.y;
      const reached = this.moveTo(tx, ty, 205, dt);
      if (reached || Phaser.Math.Distance.Between(this.spr.x, this.spr.y, this.batTarget.spr.x, this.batTarget.spr.y) < 32) {
        this.scene.killBird(this.batTarget, 'eaten');
        this.scene.toast('A bat swooped down and bit a bird!');
        this.scene.floatText(this.spr.x, this.spr.y - 30, 'BAT BITE! 🦇', '#ef4444', '#450a0a');
        this.batSwoop = false;
        this.batTarget = undefined;
        this.batTimer = 3.5;
        this.wy = 120;
      }
    } else {
      // Erratic fluttering flight across the canopy
      const flutterX = this.wx + Math.sin(t * 0.003 + this.phase) * 120;
      const flutterY = this.wy + Math.cos(t * 0.004 + this.phase) * 45;
      this.moveTo(flutterX, flutterY, 140, dt);
    }
  }

  private updateWyvern(dt: number, t: number) {
    this.wyvernTimer -= dt;

    if (this.wyvernState === 'stalk') {
      // Sweeping glide in upper stratosphere, surveying flock
      const targetX = W / 2 + Math.sin(t * 0.0016 + this.phase) * 380;
      const targetY = 120 + Math.cos(t * 0.0025 + this.phase) * 50;
      this.moveTo(targetX, targetY, 150, dt);

      // Every 3-4 seconds, picks a target and dive-bombs!
      if (this.wyvernTimer <= 0) {
        this.wyvernTimer = 1.8;
        this.wyvernState = 'swoop';
        const tg = this.scene.nearestBird(this.spr.x, this.spr.y);
        this.wyvernTargetX = tg ? tg.spr.x : Phaser.Math.Between(200, W - 200);
        this.wyvernTargetY = tg ? Math.min(tg.spr.y, 560) : 480;
        this.scene.cameras.main.shake(160, 0.004);
        this.scene.floatText(this.spr.x, this.spr.y - 40, '🔥 APEX DIVE! 🔥', '#ef4444', '#7f1d1d');
      }
    } else if (this.wyvernState === 'swoop') {
      // High-velocity diagonal dive leaving flame embers
      if (Math.random() < 0.4) {
        this.scene.burst(this.spr.x, this.spr.y, 0xf97316, 2);
      }
      const arrived = this.moveTo(this.wyvernTargetX, this.wyvernTargetY, 390, dt);
      const b = this.scene.nearestBird(this.spr.x, this.spr.y);
      if (b && Phaser.Math.Distance.Between(this.spr.x, this.spr.y, b.spr.x, b.spr.y) < 60) {
        this.scene.killBird(b, 'eaten');
        this.scene.toast('The Elder Wyvern devoured a bird in a blazing dive!');
      }
      if (arrived || this.wyvernTimer <= 0 || this.spr.y >= 540) {
        this.wyvernState = 'recover';
        this.wyvernTimer = 1.4;
      }
    } else if (this.wyvernState === 'recover') {
      // Powerful upward swoop back to the sky
      const topX = this.dir > 0 ? W - 100 : 100;
      this.moveTo(topX, 100, 260, dt);
      if (this.wyvernTimer <= 0 || this.spr.y <= 130) {
        this.wyvernState = 'stalk';
        this.wyvernTimer = 3.5 + Math.random() * 2.0;
      }
    }
  }

  private updateHawk(dt: number, _t: number) {
    if (this.hawkState === 'circle') {
      // 1. Fly continuously in circles overhead until it locks onto a bird
      this.hawkAngle += this.hawkCircleDir * 1.85 * dt;
      const targetX = this.hawkCircleCenterX + Math.cos(this.hawkAngle) * this.hawkCircleRadius;
      const targetY = this.hawkCircleCenterY + Math.sin(this.hawkAngle) * (this.hawkCircleRadius * 0.55);

      // Facing direction and wing bank tilt matching circular velocity vector
      const vx = -Math.sin(this.hawkAngle) * this.hawkCircleDir;
      const vy = Math.cos(this.hawkAngle) * this.hawkCircleDir * 0.55;
      this.dir = vx > 0 ? 1 : -1;
      this.spr.rotation = Phaser.Math.Clamp((vy / 1.5) * 0.45 * this.dir, -0.45, 0.45);

      this.spr.x += (targetX - this.spr.x) * 6 * dt;
      this.spr.y += (targetY - this.spr.y) * 6 * dt;

      // Periodically scan for birds to lock onto
      this.hawkScanTimer -= dt;
      if (this.hawkScanTimer <= 0) {
        // Hawks circle high and are free to hunt and lock onto any bird!
        const victim = this.scene.nearestBird(this.spr.x, this.spr.y);
        if (victim && !victim.dead) {
          // Locked onto a bird! Screech & prepare fast swoop
          this.hawkLockedBird = victim;
          this.hawkState = 'swoop';
          this.hawkSwoopTimer = 2.0;
          this.scene.burst(this.spr.x, this.spr.y, 0xf59e0b, 10);
          this.scene.floatText(this.spr.x, this.spr.y - 30, '🎯 LOCKED ON TARGET!', '#ef4444', '#7f1d1d');
          playWeaponSound(0);
        } else {
          // Re-center circle slightly and continue circling
          this.hawkScanTimer = 1.2 + Math.random() * 1.0;
          this.hawkCircleCenterX = Phaser.Math.Clamp(this.hawkCircleCenterX + (Math.random() - 0.5) * 90, 240, W - 240);
          if (Math.random() < 0.22) {
            this.scene.floatText(this.spr.x, this.spr.y - 30, '🦅 Circling the aviary...', '#f59e0b', '#451a03');
          }
        }
      }
    } else if (this.hawkState === 'swoop') {
      // 2. High-speed direct swoop down to catch the locked bird!
      const target = this.hawkLockedBird;
      const tx = target && !target.dead ? target.spr.x : this.spr.x + this.dir * 120;
      const ty = target && !target.dead ? target.spr.y : 580;

      const speed = 400 + this.scene.level * 12;
      this.moveTo(tx, ty, speed, dt);

      // Trailing wing gusts
      if (Math.random() < 0.3) {
        this.scene.burst(this.spr.x, this.spr.y, 0xe2e8f0, 2);
      }

      this.hawkSwoopTimer -= dt;
      const dist = target && !target.dead ? Phaser.Math.Distance.Between(this.spr.x, this.spr.y, target.spr.x, target.spr.y) : 999;
      if (dist < 52 && target && !target.dead) {
        // Caught the bird! Hawks are free to snatch any bird!
        this.scene.killBird(target, 'eaten');
        this.scene.toast('The hawk swooped in and snatched a bird!');
        this.scene.floatText(this.spr.x, this.spr.y - 30, 'SNATCHED!', '#ef4444', '#450a0a');
        this.hawkLockedBird = undefined;
        this.hawkState = 'climb';
        this.hawkClimbTimer = 1.3;
        this.pause = 0.3;
      } else if (this.hawkSwoopTimer <= 0 || this.spr.y >= 560 || !target || target.dead) {
        // Missed swoop, pull up into climb!
        this.hawkLockedBird = undefined;
        this.hawkState = 'climb';
        this.hawkClimbTimer = 1.5;
      }
    } else if (this.hawkState === 'climb') {
      // 3. Smooth upward climb back to the upper airspace to circle again
      const climbSpeed = 260;
      const targetX = this.dir > 0 ? Math.min(W - 140, this.spr.x + 120) : Math.max(140, this.spr.x - 120);
      this.moveTo(targetX, 150, climbSpeed, dt);

      this.hawkClimbTimer -= dt;
      if (this.spr.y <= 170 || this.hawkClimbTimer <= 0) {
        // Resume circular flight!
        this.hawkState = 'circle';
        this.hawkCircleCenterX = Phaser.Math.Between(280, W - 280);
        this.hawkCircleCenterY = Phaser.Math.Between(130, 180);
        this.hawkCircleRadius = Phaser.Math.Between(130, 180);
        this.hawkCircleDir = Math.random() < 0.5 ? 1 : -1;
        this.hawkAngle = Math.atan2(this.spr.y - this.hawkCircleCenterY, this.spr.x - this.hawkCircleCenterX);
        this.hawkScanTimer = 1.4 + Math.random() * 1.2;
      }
    }
  }

  private updateCrow(dt: number) {
    const t = this.scene.crowTarget(this.spr.x, this.spr.y);
    if (!t) {
      if (this.moveTo(this.wx, this.wy, 90, dt)) {
        this.wx = Phaser.Math.Between(80, W - 80);
        this.wy = Phaser.Math.Between(260, 540);
        this.pause = 0.5;
      }
      return;
    }
    this.moveTo(t.x, t.y - 16, 130, dt);
    if (Phaser.Math.Distance.Between(this.spr.x, this.spr.y, t.x, t.y - 16) < 22) {
      t.eat();
      this.pause = 0.6;
    }
  }

  private updateCat(dt: number) {
    if (this.catLeaping) {
      this.spr.y += this.catVy * dt;
      this.catVy += 840 * dt; // strong ballistic gravity
      this.spr.x += this.dir * 380 * dt; // fast leap
      this.spr.rotation = Phaser.Math.Clamp((this.catVy / 400) * 0.45 * this.dir, -0.65, 0.65);
      const b = this.scene.nearestBird(this.spr.x, this.spr.y);
      if (b && Phaser.Math.Distance.Between(this.spr.x, this.spr.y, b.spr.x, b.spr.y) < 52) {
        this.scene.killBird(b, 'eaten');
        this.scene.toast('The cat caught a bird in a high-speed ambush leap!');
        this.pause = 0.5;
      }
      if (this.spr.y >= 590) {
        this.spr.y = 590;
        this.spr.rotation = 0;
        this.catLeaping = false;
        this.pause = 0.4;
      }
      return;
    }

    const tg = this.scene.nearestBird(this.spr.x, this.spr.y);
    if (!tg) {
      if (this.moveTo(this.wx, 590, 130, dt)) this.wx = Phaser.Math.Between(100, W - 100);
      return;
    }

    const dx = tg.spr.x - this.spr.x;
    this.dir = dx > 0 ? 1 : -1;

    // Sneaky crouch & aggressive ambush trigger
    if (Math.abs(dx) < 340 && tg.spr.y < 540) {
      this.catCrouchT += dt;
      this.spr.setScale(1.15, 0.82); // crouches low in foliage
      if (this.catCrouchT > 0.18) {
        this.catCrouchT = 0;
        this.catLeaping = true;
        this.catVy = -580;
        this.spr.setScale(1.1, 1.1);
        this.scene.burst(this.spr.x, this.spr.y, 0x1f2937, 8);
        this.scene.floatText(this.spr.x, this.spr.y - 20, 'POUNCE!', '#f59e0b', '#451a03');
      }
      return;
    }

    this.catCrouchT = 0;
    this.spr.setScale(1.1, 1.1);
    this.spr.x += this.dir * 175 * dt;
  }

  private updateSnake(dt: number, t: number) {
    // Tree Viper strictly stays on the tree branches and trunk!
    const treeX = this.spr.x < W / 2 ? 160 : 1120;
    const treeSpots = this.scene.spots.filter((s) => Math.abs(s.x - treeX) < 290);
    const homeSpot = treeSpots[0] ?? { x: treeX, y: 380 };

    if (this.snakeState === 'stalk') {
      // 1. Stalking: Slithers along tree boughs toward a perched or branch-near bird
      this.spr.setAlpha(1.0);
      const treeBirds = this.scene.birds.filter(
        (b) => !b.dead && Math.abs(b.spr.x - treeX) < 250 && b.spr.y >= 260 && b.spr.y <= 560
      );
      const tg = treeBirds.length > 0 ? treeBirds[0] : undefined;
      this.snakeTarget = tg;

      let targetX = homeSpot.x;
      let targetY = homeSpot.y;
      if (tg) {
        targetX = tg.spr.x > this.spr.x ? tg.spr.x - 45 : tg.spr.x + 45;
        targetY = tg.spr.y + 4;
      } else {
        const patrolSpot = treeSpots[Math.floor((t * 0.0003) % treeSpots.length)] ?? homeSpot;
        targetX = patrolSpot.x;
        targetY = patrolSpot.y;
      }

      // Constrain firmly within tree canopy & branch bounds
      const minX = treeX === 160 ? 60 : 860;
      const maxX = treeX === 160 ? 385 : 1210;
      targetX = Phaser.Math.Clamp(targetX, minX, maxX);
      targetY = Phaser.Math.Clamp(targetY, 300, 550);

      this.moveTo(targetX, targetY, 95, dt);

      this.snakeTimer -= dt;
      const dist = tg ? Phaser.Math.Distance.Between(this.spr.x, this.spr.y, tg.spr.x, tg.spr.y) : 999;
      if ((tg && dist < 120) || this.snakeTimer <= 0) {
        // Enters stealth camouflage in the tree foliage!
        this.snakeState = 'hide';
        this.snakeTimer = 2.0;
        this.snakeRattleT = 0;
        this.spr.setAlpha(0.22);
      }
    } else if (this.snakeState === 'hide') {
      // 2. Hide / Camouflage: Coils in the leaves with subtle foliage rustle warning!
      this.snakeTimer -= dt;
      this.snakeRattleT -= dt;

      // Subtle foliage vibration
      this.flip.rotation = Math.sin(t * 0.035) * 0.14;
      if (this.snakeRattleT <= 0) {
        this.snakeRattleT = 0.5;
        // Rustling green leaves near the tree branch
        this.scene.burst(this.spr.x + Phaser.Math.Between(-15, 15), this.spr.y + Phaser.Math.Between(-10, 10), 0x22c55e, 4);
        this.scene.floatText(this.spr.x, this.spr.y - 30, '🍃 *rustle...*', '#86efac', '#14532d');
      }

      if (this.snakeTimer <= 0) {
        // Ambush sprung! Uncloaks & springs!
        this.snakeState = 'strike';
        this.snakeTimer = 0.95;
        this.spr.setAlpha(1.0);
        this.scene.floatText(this.spr.x, this.spr.y - 35, '⚡ STRIKE! 🐍', '#ef4444', '#450a0a');
        this.scene.cameras.main.shake(120, 0.004);
      }
    } else if (this.snakeState === 'strike') {
      // 3. Lightning Jump Attack: Springs with lethal venom!
      this.snakeTimer -= dt;
      const tg = this.snakeTarget;
      const targetX = tg && !tg.dead ? tg.spr.x : this.spr.x + this.dir * 140;
      const targetY = tg && !tg.dead ? tg.spr.y : this.spr.y;
      this.moveTo(targetX, targetY, 520, dt);

      if (tg && !tg.dead && Phaser.Math.Distance.Between(this.spr.x, this.spr.y, tg.spr.x, tg.spr.y) < 55) {
        // Lethal venom: devours / destroys bird!
        this.scene.killBird(tg, 'eaten');
        this.scene.burst(this.spr.x, this.spr.y, 0x16a34a, 16);
        this.scene.burst(this.spr.x, this.spr.y, 0xef4444, 12);
        this.scene.toast('The Tree Viper struck with lethal venom!');
        this.scene.floatText(this.spr.x, this.spr.y - 35, '🐍 LETHAL VENOM! 💀', '#ef4444', '#450a0a');
        this.snakeTarget = undefined;
        this.snakeState = 'recover';
        this.snakeTimer = 2.0;
      } else if (this.snakeTimer <= 0) {
        this.snakeTarget = undefined;
        this.snakeState = 'recover';
        this.snakeTimer = 1.8;
      }
    } else if (this.snakeState === 'recover') {
      // 4. Slithers back along the bough to coil on a secure branch
      this.spr.setAlpha(1.0);
      this.moveTo(homeSpot.x, homeSpot.y, 110, dt);
      this.snakeTimer -= dt;
      if (this.snakeTimer <= 0) {
        this.snakeState = 'stalk';
        this.snakeTimer = 3.0;
      }
    }
  }

  private updateRaccoon(dt: number) {
    const c = this.scene.nearestGroundCoin(this.spr.x);
    if (c) {
      this.moveTo(c.img.x, 590, 90, dt);
      if (Math.abs(c.img.x - this.spr.x) < 26) {
        this.scene.removeCoin(c);
        this.scene.toast('The raccoon stole a coin!');
      }
      return;
    }
    const tg = this.scene.nearestBird(this.spr.x, this.spr.y);
    if (tg && tg.stage === 0) {
      this.moveTo(tg.spr.x, 590, 85, dt);
      if (Phaser.Math.Distance.Between(this.spr.x, this.spr.y, tg.spr.x, tg.spr.y) < 40) {
        this.scene.killBird(tg, 'eaten');
        this.scene.toast('The raccoon snatched a baby chick!');
        this.pause = 1.2;
      }
      return;
    }
    if (this.moveTo(this.wx, 590, 75, dt)) this.wx = Phaser.Math.Between(100, W - 100);
  }

  private updateSpider(dt: number, t: number) {
    this.spiderT += dt;
    // Creeping bobbing on silk thread
    this.spr.y = 220 + Math.sin(t * 0.0025) * 150;
    this.spr.x += Math.sin(t * 0.0018) * 60 * dt;
    this.spr.rotation = Math.sin(t * 0.005) * 0.12;

    if (this.spiderT > 8) {
      this.spiderT = 0;
      this.scene.spawnSpiderWeb(this.spr.x, this.spr.y);
    }
    const b = this.scene.nearestBird(this.spr.x, this.spr.y);
    if (b && Phaser.Math.Distance.Between(this.spr.x, this.spr.y, b.spr.x, b.spr.y) < 50) {
      this.scene.killBird(b, 'eaten');
      this.scene.toast('The giant spider snared a bird in silk!');
      this.pause = 1.0;
    }
  }

  private updateWeasel(dt: number, t: number) {
    const tg = this.scene.nearestBird(this.spr.x, this.spr.y);
    const tx = tg ? tg.spr.x : this.wx;
    const ty = tg ? Math.min(tg.spr.y, 590) : 590;
    const speed = 310; // high-speed aggressive serpentine sprint
    const dx = tx - this.spr.x;
    const dy = ty - this.spr.y;
    this.dir = dx > 0 ? 1 : -1;
    this.spr.x += this.dir * speed * dt;
    if (Math.abs(dy) > 10) {
      this.spr.y += Math.sign(dy) * 180 * dt;
    }
    this.spr.y += Math.sin(t * 0.035) * 3;
    if (tg && Phaser.Math.Distance.Between(this.spr.x, this.spr.y, tg.spr.x, tg.spr.y) < 46) {
      this.scene.killBird(tg, 'eaten');
      this.scene.toast('The sly weasel ambushed your bird!');
      this.pause = 0.4;
    }
    if (Math.abs(this.spr.x - this.wx) < 20) this.wx = Phaser.Math.Between(80, W - 80);
  }

  private updateGlutton(dt: number, _t: number) {
    this.bar.clear();
    const w = 70;
    this.bar.fillStyle(0x000000, 0.6);
    this.bar.fillRoundedRect(this.spr.x - w / 2, this.spr.y - this.radius - 14, w, 9, 4);
    this.bar.fillStyle(0x84cc16, 1);
    this.bar.fillRoundedRect(this.spr.x - w / 2 + 1, this.spr.y - this.radius - 13, (w - 2) * Math.min(1, this.foodsEaten / this.maxFoods), 7, 3);

    // Glutton seeks food pellets on screen (Gus mechanic!)
    const food = this.scene.nearestFood(this.spr.x, this.spr.y);
    if (food && !food.eaten) {
      const reached = this.moveTo(food.img.x, food.img.y, 120, dt);
      if (reached || Phaser.Math.Distance.Between(this.spr.x, this.spr.y, food.img.x, food.img.y) < 28) {
        this.scene.eatGluttonFood(food, this);
        this.pause = 0.3;
      }
      return;
    }

    // If no food, slowly wanders toward birds to force player feeding
    const prey = this.scene.nearestBird(this.spr.x, this.spr.y);
    if (prey && !prey.dead) {
      const reached = this.moveTo(prey.spr.x, prey.spr.y, 75, dt);
      if (reached || Phaser.Math.Distance.Between(this.spr.x, this.spr.y, prey.spr.x, prey.spr.y) < 26) {
        this.scene.killBird(prey, 'eaten');
        this.pause = 0.8;
      }
    } else {
      this.moveTo(this.wx, this.wy, 70, dt);
      if (Phaser.Math.Distance.Between(this.spr.x, this.spr.y, this.wx, this.wy) < 20) {
        this.wx = Phaser.Math.Between(100, W - 100);
        this.wy = Phaser.Math.Between(150, 480);
      }
    }
  }

  private updateBombardier(dt: number, t: number) {
    // Dynamic Figure-8 (Infinity-Loop) Aerial Strafing pattern
    const fx = W / 2 + Math.sin(t * 0.0022 + this.phase) * 380;
    const fy = 115 + Math.sin(2 * (t * 0.0022 + this.phase)) * 50;
    this.moveTo(fx, fy, 190, dt);

    // Jet engine exhaust smoke contrails
    if (Math.random() < 0.35) {
      this.scene.burst(this.spr.x - this.dir * 35, this.spr.y + 12, 0x64748b, 2);
    }

    this.missileCooldown -= dt;
    if (this.missileCooldown <= 0) {
      this.missileCooldown = 6.0 + Math.random() * 2.5;
      const livingBirds = this.scene.birds.filter((b) => !b.dead);
      if (livingBirds.length > 0) {
        const target = Phaser.Utils.Array.GetRandom(livingBirds);
        // Dramatic target lock-on warning
        this.scene.burst(target.spr.x, target.spr.y, 0xef4444, 12);
        this.scene.floatText(target.spr.x, target.spr.y - 30, '🎯 TARGET LOCKED! ⚠️', '#ef4444', '#450a0a');
        this.scene.cameras.main.shake(140, 0.004);
        this.scene.toast('🚨 LETHAL GUIDED MISSILE INCOMING! Click to intercept!');
        this.scene.launchMissile(this.spr.x, this.spr.y + 15, target);
        this.scene.floatText(this.spr.x, this.spr.y - 25, '🚀 MISSILE LAUNCHED!', '#ef4444', '#450a0a');
      }
    }
  }

  private updateVulture(dt: number) {
    this.vultureTimer -= dt;

    if (this.vultureState === 'active') {
      if (this.vultureTimer <= 0) {
        this.enterVultureDormant();
        return;
      }

      const prey = this.scene.nearestBird(this.spr.x, this.spr.y);
      if (prey && !prey.dead) {
        const dist = Phaser.Math.Distance.Between(this.spr.x, this.spr.y, prey.spr.x, prey.spr.y);
        const lungeSpeed = dist < 140 ? 220 : 130; // aggressive snapping lunge when close
        const reached = this.moveTo(prey.spr.x, prey.spr.y, lungeSpeed, dt);
        if (reached || dist < 36) {
          this.scene.killBird(prey, 'eaten');
          this.scene.floatText(this.spr.x, this.spr.y - 40, 'CHOMP! DELICIOUS!', '#ef4444', '#450a0a');
          this.pause = 0.8;
          this.enterVultureDormant();
        }
      } else {
        this.moveTo(this.wx, this.wy, 90, dt);
        if (Phaser.Math.Distance.Between(this.spr.x, this.spr.y, this.wx, this.wy) < 20) {
          this.wx = Phaser.Math.Between(150, W - 150);
          this.wy = Phaser.Math.Between(120, 380);
        }
      }
    } else {
      if (this.vultureTimer <= 0) {
        this.enterVultureActive();
        return;
      }

      this.spr.y += Math.sin(this.phase + this.vultureTimer * 3) * 18 * dt;
      this.spr.x += Math.cos(this.phase + this.vultureTimer * 1.5) * 25 * dt;
      this.spr.rotation = Math.sin(this.vultureTimer * 2) * 0.08;

      if (Math.random() < 0.04) {
        this.scene.floatText(
          this.spr.x + Phaser.Math.Between(-20, 20),
          this.spr.y - 35,
          'zzz',
          '#7dd3fc',
          '#0284c7'
        );
      }
    }
  }
}

// ----------------------------------------------------------------- pets
export class Pet {
  key: string;
  img: Phaser.GameObjects.Image;
  timer = 0;
  tx = 0;
  pause = 0;
  dir = 1;
  wy = 0;
  flyer?: ReturnType<typeof makeFlyer>;

  constructor(private scene: AviaryScene, key: string) {
    this.key = key;
    this.timer = 5 + Math.random() * 5;
    switch (key) {
      case 'hedgehog':
        this.img = scene.add.image(300, 618, 'pet_hedgehog').setOrigin(0.5, 1).setScale(0.8).setDepth(11);
        break;
      case 'badger':
        this.img = scene.add.image(380, 618, 'pet_badger').setOrigin(0.5, 1).setScale(0.85).setDepth(11);
        this.timer = 35;
        break;
      case 'porcupine':
        this.img = scene.add.image(520, 616, 'pet_porcupine').setOrigin(0.5, 1).setScale(0.85).setDepth(11);
        break;
      case 'mama':
      case 'quail': {
        // Mama Dove: An active flying bird companion!
        const startX = Phaser.Math.Between(180, 500);
        const startY = Phaser.Math.Between(160, 320);
        this.flyer = makeFlyer(scene, 'mama', startX, startY, 11, 2);
        this.flyer.spr.setScale(0.88);
        this.img = this.flyer.body;
        this.shadow = scene.add.image(startX, 620, 'shadow').setDepth(1).setScale(0.55, 0.22).setAlpha(0.28);
        this.tx = startX;
        this.wy = startY;
        this.mamaState = 'fly';
        this.timer = 18;
        break;
      }
      case 'woodpecker': {
        // Pip hitches to the ancient oak tree trunk (TX_L = 160)!
        const trunkX = 186;
        const trunkY = 385;
        this.img = scene.add.image(trunkX, trunkY, 'pet_woodpecker').setScale(0.85).setDepth(11);
        this.img.setFlipX(true); // Facing trunk bark to excavate home
        this.img.setRotation(-0.1); // Clinging vertically
        this.timer = 3.5;
        break;
      }
      case 'butterfly':
        this.img = scene.add.image(200, 220, 'pet_butterfly').setScale(0.9).setDepth(11);
        this.wy = 220;
        break;
      case 'magpie':
        this.img = scene.add.image(100, 180, 'pet_magpie').setScale(0.85).setDepth(11);
        this.wy = 180;
        this.timer = 22;
        break;
      case 'snail':
        this.img = scene.add.image(620, 480, 'pet_snail').setScale(0.85).setDepth(11);
        break;
      case 'mole':
        this.img = scene.add.image(660, 620, 'pet_mole').setOrigin(0.5, 1).setScale(0.85).setDepth(11);
        this.timer = 18;
        break;
      case 'hound':
        this.img = scene.add.image(420, 616, 'pet_hound').setOrigin(0.5, 1).setScale(0.85).setDepth(11);
        break;
      case 'owl': {
        const spOwl = scene.spots[4] ?? scene.spots[0];
        this.img = scene.add.image(spOwl.x, spOwl.y - 30, 'pet_owl').setScale(0.85).setDepth(11);
        break;
      }
      case 'frog':
        this.img = scene.add.image(560, 620, 'pet_frog').setOrigin(0.5, 1).setScale(0.85).setDepth(11);
        break;
      case 'hummingbird':
        this.img = scene.add.image(500, 280, 'pet_hummingbird').setScale(0.85).setDepth(11);
        this.wy = 280;
        break;
      case 'firefly':
        this.img = scene.add.image(440, 320, 'pet_firefly').setScale(0.85).setDepth(11);
        this.wy = 320;
        break;
      case 'ferret':
        this.img = scene.add.image(600, 616, 'pet_ferret').setOrigin(0.5, 1).setScale(0.85).setDepth(11);
        break;
      case 'squirrel':
        this.img = scene.add.image(790, 612, 'pet_squirrel').setOrigin(0.5, 1).setScale(0.8).setDepth(11);
        this.timer = 1.5;
        break;
      case 'hen':
        this.img = scene.add.image(450, 622, 'pet_hen').setOrigin(0.5, 1).setScale(0.9).setDepth(11);
        this.timer = 25;
        break;
      case 'phoenix_chick':
        this.img = scene.add.image(350, 616, 'pet_phoenix_chick').setOrigin(0.5, 1).setScale(0.85).setDepth(11);
        break;
      case 'chameleon':
        this.img = scene.add.image(750, 480, 'pet_chameleon').setScale(0.85).setDepth(11);
        break;
      default: {
        const sp = scene.spots[5];
        this.flyer = makeFlyer(scene, 'nightingale', sp.x, sp.y - 34, 11);
        this.flyer.spr.setScale(0.85);
        this.flyer.wing.rotation = 0.15;
        this.img = this.flyer.body;
        this.timer = 20;
      }
    }
    this.tx = this.img.x;
  }

  shadow?: Phaser.GameObjects.Image;
  mamaSpot?: Spot;
  mamaState: 'fly' | 'perch' | 'layEgg' = 'fly';
  mamaRestT = 0;
  mamaPoopT = 35 + Math.random() * 25;
  phase = Math.random() * Math.PI * 2;

  private pipSpots = [
    { x: 186, y: 340 },
    { x: 186, y: 385 }, // Cavity site!
    { x: 186, y: 435 },
    { x: 186, y: 485 },
  ];
  private pipIdx = 1;
  private pipHopT = 4.0;
  private pipBuildTime = 0; // 5-minute (300s) build timer!
  private pipCavityProgress = 0;
  private pipCavityFinished = false;
  private pipCavityGfx?: Phaser.GameObjects.Graphics;
  private pipServicedBirds = new Map<Bird, number>();

  destroy() {
    this.img?.destroy();
    this.pipCavityGfx?.destroy();
    this.flyer?.spr?.destroy();
    this.shadow?.destroy();
    if (this.mamaSpot) {
      this.mamaSpot.bird = undefined;
      this.mamaSpot = undefined;
    }
  }

  update(dt: number, t: number) {
    switch (this.key) {
      case 'hedgehog': return this.updateHedgehog(dt, t);
      case 'badger': return this.updateBadger(dt, t);
      case 'porcupine': return this.updatePorcupine(dt, t);
      case 'mama':
      case 'quail': return this.updateMama(dt, t);
      case 'woodpecker': return this.updateWoodpecker(dt, t);
      case 'butterfly': return this.updateButterfly(dt, t);
      case 'magpie': return this.updateMagpie(dt, t);
      case 'snail': return this.updateSnail(dt, t);
      case 'mole': return this.updateMole(dt, t);
      case 'hound': return this.updateHound(dt, t);
      case 'owl': return this.updateOwl(dt, t);
      case 'frog': return this.updateFrog(dt, t);
      case 'hummingbird': return this.updateHummingbird(dt, t);
      case 'firefly': return this.updateFirefly(dt, t);
      case 'ferret': return this.updateFerret(dt, t);
      case 'squirrel': return this.updateSquirrel(dt, t);
      case 'hen': return this.updateHen(dt, t);
      case 'phoenix_chick': return this.updatePhoenixChick(dt, t);
      case 'chameleon': return this.updateChameleon(dt, t);
      default: return this.updateSinger(dt, t);
    }
  }

  private walk(tx: number, speed: number, dt: number, t: number) {
    const dx = tx - this.img.x;
    if (Math.abs(dx) < 4) return true;
    this.img.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    this.img.setFlipX(dx < 0);
    this.img.y += Math.sin(t * 0.02) * 0.4;
    return false;
  }

  private updateHedgehog(dt: number, t: number) {
    const c = this.scene.nearestGroundCoin(this.img.x);
    if (c) {
      this.walk(c.img.x, 115, dt, t);
      if (Math.abs(c.img.x - this.img.x) < 24) this.scene.collectCoin(c, this.img.x, this.img.y - 20);
    } else if (this.pause > 0) {
      this.pause -= dt;
      // Sniffing idle animation
      this.img.scaleX = 0.8 + Math.sin(t * 0.02) * 0.05;
    } else if (this.walk(this.tx, 45, dt, t)) {
      this.tx = Phaser.Math.Between(60, W - 60);
      this.pause = 1 + Math.random() * 2;
    }
  }

  private updateBadger(dt: number, t: number) {
    if (this.walk(this.tx, 38, dt, t)) {
      this.tx = Phaser.Math.Between(100, W - 100);
      this.pause = 1.5;
    }
    this.timer -= dt;
    if (this.timer <= 3.0 && Math.random() < 0.2) {
      this.scene.burst(this.img.x + (this.img.flipX ? 15 : -15), this.img.y - 5, 0x78350f, 2);
    }
    if (this.timer <= 0) {
      this.timer = 45;
      this.scene.burst(this.img.x, this.img.y - 10, 0x8d6e63, 14);
      this.scene.dropCoin(this.img.x, this.img.y - 20, 20, 'truffle');
      this.scene.floatText(this.img.x, this.img.y - 35, '🪶 Truffle Unearthed! +20', '#fbbf24', '#29180f');
    }
  }

  private updatePorcupine(dt: number, t: number) {
    this.walk(this.tx, 30, dt, t);
    if (Math.abs(this.img.x - this.tx) < 10) this.tx = Phaser.Math.Between(80, W - 80);
    const p = this.scene.nearestPredator(this.img.x, this.img.y);
    if (p && Phaser.Math.Distance.Between(this.img.x, this.img.y, p.spr.x, p.spr.y) < 65) {
      p.hit(4, this.img.x, this.img.y);
      this.scene.burst(p.spr.x, p.spr.y, 0xe5e7eb, 8);
      this.scene.floatText(p.spr.x, p.spr.y - 20, 'QUILL STAB! -4', '#ffffff', '#b91c1c');
    }
  }

  private updateMama(dt: number, t: number) {
    const f = this.flyer;
    if (!f) return;

    // 1. Egg laying timer (every ~20s)
    this.timer -= dt;

    // 2. Periodic natural bird droppings ("fly and shit")
    this.mamaPoopT -= dt;
    if (this.mamaPoopT <= 0) {
      this.mamaPoopT = 40 + Math.random() * 30;
      this.dropMamaPoop(f.spr.x, f.spr.y + 10);
    }

    // Dynamic ground shadow
    if (this.shadow) {
      this.shadow.x = f.spr.x;
      this.shadow.y = 620;
      const alt = Math.max(0, 620 - f.spr.y);
      const altNorm = Phaser.Math.Clamp(alt / 450, 0, 1);
      this.shadow.setScale((0.6 + altNorm * 0.4) * 0.88, (0.3 + altNorm * 0.2) * 0.88);
      this.shadow.setAlpha(Phaser.Math.Clamp(0.32 - altNorm * 0.2, 0.08, 0.32));
    }

    switch (this.mamaState) {
      case 'fly': {
        // Natural wing flapping
        f.wing.rotation = Math.sin(t * 0.034 + this.phase) * 0.82;

        const dx = this.tx - f.spr.x;
        const dy = this.wy - f.spr.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 8) {
          const speed = 125;
          this.dir = dx >= 0 ? 1 : -1;
          f.flip.scaleX = this.dir;
          f.spr.x += (dx / dist) * speed * dt;
          f.spr.y += (dy / dist) * speed * dt;
          f.spr.rotation = Phaser.Math.Linear(f.spr.rotation, (dy / dist) * 0.25 * this.dir, 0.15);
        } else {
          // Reached sky waypoint
          f.spr.rotation = 0;

          // Check if ready to lay an egg in a completed nest!
          if (this.timer <= 0) {
            const nest = this.scene.spots.find((s) => s.nest && (s.nestStage ?? 0) >= 6 && !s.egg && !s.bird);
            if (nest) {
              this.mamaSpot = nest;
              nest.bird = { dead: false } as any; // reserve temporarily
              this.mamaState = 'layEgg';
              this.tx = nest.x;
              this.wy = nest.y - 12;
              break;
            } else if (this.timer < -8) {
              // If no completed nest available after waiting, hatch a chick mid-air!
              this.timer = 20;
              this.scene.burst(f.spr.x, f.spr.y - 14, 0xffd54f, 12);
              const b = new Bird(this.scene, f.spr.x, f.spr.y - 25, 0, false, false, 'sparrow', true);
              this.scene.birds.push(b);
              this.scene.floatText(f.spr.x, f.spr.y - 35, '🥚 Free Songbird Chick Hatched!', '#ffd54f', '#422817');
            }
          }

          // 25% chance to perch on an empty branch spot to rest and preen for a few seconds
          if (Math.random() < 0.25) {
            const emptyBranch = this.scene.spots.find((s) => !s.bird && !s.reserved && !(s.nest && s.egg));
            if (emptyBranch) {
              this.mamaSpot = emptyBranch;
              emptyBranch.bird = { dead: false } as any; // occupy temporarily
              this.mamaState = 'perch';
              this.mamaRestT = 4.0 + Math.random() * 4.0;
              this.tx = emptyBranch.x;
              this.wy = emptyBranch.y - (emptyBranch.nest ? 12 : 6);
              break;
            }
          }

          // Pick next wander destination in the sky
          this.tx = Phaser.Math.Between(100, W - 100);
          this.wy = Phaser.Math.Between(130, 460);
        }
        break;
      }

      case 'perch': {
        // Resting on branch: wing folded back neatly
        f.wing.rotation = -0.05 + Math.sin(t * 0.004) * 0.03;
        f.spr.rotation = 0;
        this.mamaRestT -= dt;

        // Occasional preening / tail twitch
        if (Math.sin(t * 0.012) > 0.94) {
          f.flip.y = -2;
        } else {
          f.flip.y = 0;
        }

        if (this.mamaRestT <= 0) {
          // Release perch spot so others can use it and take flight!
          if (this.mamaSpot) {
            this.mamaSpot.bird = undefined;
            this.mamaSpot = undefined;
          }
          this.mamaState = 'fly';
          this.tx = Phaser.Math.Between(100, W - 100);
          this.wy = Phaser.Math.Between(120, 360);
          this.scene.burst(f.spr.x, f.spr.y, 0xffffff, 4);
        }
        break;
      }

      case 'layEgg': {
        // Fly directly down to nest cup
        f.wing.rotation = Math.sin(t * 0.034 + this.phase) * 0.82;
        const dx = this.tx - f.spr.x;
        const dy = this.wy - f.spr.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 6) {
          f.flip.scaleX = dx >= 0 ? 1 : -1;
          f.spr.x += (dx / dist) * 140 * dt;
          f.spr.y += (dy / dist) * 140 * dt;
        } else {
          // Settled in nest! Lay egg!
          const nest = this.mamaSpot;
          if (nest && nest.nest && !nest.egg) {
            this.scene.layEgg(nest);
            this.scene.burst(nest.x, nest.y - 12, 0xffd54f, 16);
            this.scene.floatText(nest.x, nest.y - 35, '🥚 Mama Dove laid a warm egg in the nest!', '#ffd54f', '#422817');
            this.scene.toast('Mama Dove laid a warm egg in a cozy nest cup!');
          }
          this.timer = 20;

          // Free the nest spot so other birds can incubate the egg!
          if (this.mamaSpot) {
            this.mamaSpot.bird = undefined;
            this.mamaSpot = undefined;
          }
          // Take flight immediately!
          this.mamaState = 'fly';
          this.tx = Phaser.Math.Between(100, W - 100);
          this.wy = Phaser.Math.Between(120, 360);
          this.scene.burst(f.spr.x, f.spr.y, 0x3fae55, 6);
        }
        break;
      }
    }
  }

  private dropMamaPoop(x: number, y: number) {
    const poop = this.scene.add.text(x, y, '🤍', { fontSize: '13px' }).setDepth(12).setOrigin(0.5);
    this.scene.tweens.add({
      targets: poop,
      y: 618,
      duration: 950,
      ease: 'Quad.easeIn',
      onComplete: () => {
        poop.destroy();
        this.scene.burst(x, 618, 0xffffff, 5);
        this.scene.burst(x, 618, 0x86efac, 3);
        this.scene.floatText(x, 600, '💩 *splat!*', '#ffffff', '#1e293b');
      },
    });
  }

  private drawPipCavity() {
    if (!this.pipCavityGfx) {
      this.pipCavityGfx = this.scene.add.graphics().setDepth(4);
    }
    const g = this.pipCavityGfx;
    g.clear();
    const cx = 160;
    const cy = 385;
    if (this.pipCavityProgress <= 0) return;

    if (this.pipCavityProgress < 30) {
      // Stage 1: Chipped bark notch
      g.fillStyle(0x3e200c, 0.95);
      g.fillEllipse(cx, cy, 10, 14);
      g.lineStyle(2, 0xa66e3b, 0.8);
      g.strokeEllipse(cx, cy, 10, 14);
    } else if (this.pipCavityProgress < 60) {
      // Stage 2: Cavity hollow opening
      g.fillStyle(0x271408, 0.95);
      g.fillEllipse(cx, cy, 16, 22);
      g.lineStyle(2, 0xa66e3b, 0.85);
      g.strokeEllipse(cx, cy, 16, 22);
    } else if (this.pipCavityProgress < 100) {
      // Stage 3: Deep hollow chamber
      g.fillStyle(0x1a0d05, 1);
      g.fillEllipse(cx, cy, 22, 30);
      g.lineStyle(3, 0xb87d46, 0.9);
      g.strokeEllipse(cx, cy, 22, 30);
    } else {
      // Stage 4: Finished cozy woodpecker roost cavity home!
      g.fillStyle(0x100803, 1);
      g.fillEllipse(cx, cy, 26, 36);
      g.fillStyle(0x080402, 1);
      g.fillEllipse(cx - 2, cy - 2, 20, 28);
      // Soft sawdust bedding at bottom
      g.fillStyle(0xcaa060, 0.8);
      g.fillEllipse(cx, cy + 12, 18, 8);
      // Beveled bark rim
      g.lineStyle(3, 0xc48246, 0.95);
      g.strokeEllipse(cx, cy, 26, 36);
    }
  }

  private updateWoodpecker(dt: number, t: number) {
    // 1. Excavating home on the oak tree trunk (Takes 5 minutes = 300 seconds!)
    if (this.pipBuildTime < 300) {
      this.pipBuildTime += dt;
      this.pipCavityProgress = Math.min(100, (this.pipBuildTime / 300) * 100);
      this.drawPipCavity();

      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 12 + Math.random() * 6; // Periodically chips with splinters
        this.scene.burst(166, 385, 0xcaa060, 6);
        this.scene.burst(166, 385, 0x7c4d28, 4);
        const minsLeft = Math.ceil((300 - this.pipBuildTime) / 60);
        const pct = Math.floor(this.pipCavityProgress);
        this.scene.floatText(192, 355, `🪵 Chipping Hollow (${pct}% - ~${minsLeft}m left)`, '#fde047', '#451a03');
      }

      if (this.pipBuildTime >= 300 && !this.pipCavityFinished) {
        this.pipCavityFinished = true;
        this.pipCavityProgress = 100;
        this.drawPipCavity();
        this.scene.burst(160, 385, 0x4ade80, 20);
        this.scene.burst(160, 385, 0xffd54f, 16);
        this.scene.floatText(192, 355, '🏡 Woodpecker Home Finished! (5 min)', '#4ade80', '#14532d');
        this.scene.toast('Pip finished excavating his cozy tree-hollow roost after 5 minutes of hard work!');
      }
    }

    // 2. Trunk Movement: Hop vertically between bark spots on the oak tree
    this.pipHopT -= dt;
    if (this.pipHopT <= 0) {
      this.pipHopT = 4.2 + Math.random() * 3.0;
      this.pipIdx = (this.pipIdx + 1) % this.pipSpots.length;
      const target = this.pipSpots[this.pipIdx];
      this.scene.burst(this.img.x, this.img.y, 0xffffff, 3);
      this.scene.tweens.add({
        targets: this.img,
        x: target.x,
        y: target.y,
        duration: 320,
        ease: 'Cubic.easeOut',
      });
    }

    // Woodpecker drumming animation against the tree bark
    const drumming = Math.sin(t * 0.04) > 0.35;
    this.img.rotation = -0.1 + (drumming ? Math.sin(t * 0.08) * 0.2 : 0);
    if (drumming && Math.random() < 0.12) {
      this.scene.burst(this.img.x - 14, this.img.y - 8, 0xcaa060, 1);
    }

    // 3. Spreading seeds whenever ANY bird turns green:
    // Tracks serviced birds individually so newly hungry birds get food immediately!
    for (const [bird] of this.pipServicedBirds) {
      if (bird.dead || bird.fullness >= 50) {
        this.pipServicedBirds.delete(bird);
      }
    }

    const now = this.scene.time.now;
    const hungryBirds = this.scene.birds.filter((b) => {
      if (b.dead || b.fullness >= 50) return false;
      const lastFed = this.pipServicedBirds.get(b);
      return lastFed === undefined || (now - lastFed > 7000);
    });

    if (hungryBirds.length > 0) {
      for (const b of hungryBirds) {
        this.pipServicedBirds.set(b, now);
      }

      const greenCount = hungryBirds.length;
      this.scene.burst(this.img.x - 16, this.img.y, 0xc8b27a, 14);
      this.scene.floatText(this.img.x, this.img.y - 32, `🌿 Pip drummed ${greenCount} tree-top seed${greenCount > 1 ? 's' : ''}!`, '#38bdf8', '#0f172a');

      // Dispense exactly greenCount Level 1 seeds randomly from top canopy of that oak tree (TX_L = 160)!
      for (let i = 0; i < greenCount; i++) {
        this.scene.time.delayedCall(i * 120, () => {
          const dropX = Phaser.Math.Clamp(160 + Phaser.Math.Between(-110, 110), 55, 275);
          const dropY = Phaser.Math.Between(75, 140);
          this.scene.dropFood(dropX, dropY, true, 1);
          this.scene.burst(dropX, dropY, 0x86efac, 5);
          this.scene.burst(dropX, dropY, 0x3fae55, 3);
        });
      }
    }
  }

  private updateButterfly(dt: number, t: number) {
    this.img.scaleX = (0.5 + 0.5 * Math.abs(Math.sin(t * 0.02))) * 0.9;
    const c = this.scene.nearestCoin(this.img.x, this.img.y);
    let tx = this.tx;
    let ty = this.wy;
    let speed = 70;
    if (c) {
      tx = c.img.x;
      ty = c.img.y;
      speed = 170;
    } else if (Math.abs(this.img.x - this.tx) < 12) {
      this.tx = Phaser.Math.Between(60, W - 60);
      this.wy = Phaser.Math.Between(100, 450);
    }
    const d = Phaser.Math.Distance.Between(this.img.x, this.img.y, tx, ty);
    if (d > 4) {
      this.img.x += ((tx - this.img.x) / d) * speed * dt;
      this.img.y += ((ty - this.img.y) / d) * speed * dt + Math.sin(t * 0.01) * 0.6;
    }
    if (c && d < 26) this.scene.collectCoin(c, this.img.x, this.img.y);
  }

  private updateMagpie(dt: number, t: number) {
    this.img.x += Math.cos(t * 0.002) * 80 * dt;
    this.img.y += Math.sin(t * 0.003) * 60 * dt;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 24;
      this.scene.burst(this.img.x, this.img.y, 0x38bdf8, 12);
      this.scene.dropCoin(this.img.x, this.img.y + 20, 200, 'coin_gold');
      this.scene.floatText(this.img.x, this.img.y - 30, 'Grimm Brought Loot! +200c', '#38bdf8', '#0f172a');
    }
  }

  private updateSnail(dt: number, t: number) {
    this.img.x += 12 * dt;
    if (this.img.x > W - 100) this.img.x = 100;
  }

  private updateMole(dt: number, t: number) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 20;
      this.scene.throwPinecone(this.img.x, this.img.y - 20);
    }
  }

  private updateHound(dt: number, t: number) {
    this.walk(this.tx, 45, dt, t);
    if (Math.abs(this.img.x - this.tx) < 10) this.tx = Phaser.Math.Between(150, W - 150);
    const p = this.scene.nearestPredator(this.img.x, this.img.y);
    if (p && this.pause <= 0) {
      this.pause = 10;
      this.scene.barkAllPredators();
      this.scene.floatText(this.img.x, this.img.y - 40, 'WOOF! Stunned Predators!', '#f59e0b', '#78350f');
    } else if (this.pause > 0) {
      this.pause -= dt;
    }
  }

  private updateOwl(dt: number, t: number) {
    this.img.y = this.img.y + Math.sin(t * 0.003) * 0.05;
  }

  private updateFrog(dt: number, t: number) {
    const p = this.scene.nearestPredator(this.img.x, this.img.y);
    if (p && p.spr.y > 380 && this.pause <= 0) {
      this.pause = 3.5;
      this.scene.tweens.add({
        targets: this.img,
        y: p.spr.y,
        duration: 250,
        yoyo: true,
        onYoyo: () => {
          p.hit(5, this.img.x, this.img.y);
          this.scene.floatText(p.spr.x, p.spr.y - 20, 'FROG HEADBUTT! -5', '#22c55e', '#14532d');
        },
      });
    } else if (this.pause > 0) {
      this.pause -= dt;
    }
  }

  private updateHummingbird(dt: number, t: number) {
    this.img.x += Math.sin(t * 0.006) * 120 * dt;
    this.img.y = 280 + Math.cos(t * 0.004) * 40;
    // Bounces falling seeds back upward
    for (const f of this.scene.foods) {
      if (!f.landed && Phaser.Math.Distance.Between(this.img.x, this.img.y, f.img.x, f.img.y) < 60) {
        f.img.y = Math.max(120, f.img.y - 120);
        this.scene.burst(f.img.x, f.img.y, 0x059669, 6);
      }
    }
  }

  private updateFirefly(dt: number, t: number) {
    this.img.x += Math.cos(t * 0.003) * 70 * dt;
    this.img.y += Math.sin(t * 0.004) * 50 * dt;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 16;
      const b = this.scene.birds.find((bd) => bd.stage >= 2 && !bd.dead);
      if (b) {
        this.scene.burst(b.spr.x, b.spr.y, 0xfde047, 10);
        this.scene.dropCoin(b.spr.x, b.spr.y + 20, 100, 'spark');
        this.scene.floatText(b.spr.x, b.spr.y - 30, 'Solar Spark! +100c', '#facc15', '#78350f');
      }
    }
  }

  private updateFerret(dt: number, t: number) {
    const p = this.scene.nearestPredator(this.img.x, this.img.y);
    if (p) {
      this.walk(p.spr.x, 180, dt, t);
      if (Phaser.Math.Distance.Between(this.img.x, this.img.y, p.spr.x, p.spr.y) < 50) {
        p.hit(2, this.img.x, this.img.y);
        this.scene.floatText(p.spr.x, p.spr.y - 20, 'FERRET BITE! -2', '#f97316', '#7c2d12');
      }
    } else {
      this.walk(this.tx, 60, dt, t);
      if (Math.abs(this.img.x - this.tx) < 10) this.tx = Phaser.Math.Between(100, W - 100);
    }
  }

  private updateSquirrel(dt: number, t: number) {
    this.img.y = 612 + Math.sin(t * 0.004) * 0.8;
    this.timer -= dt;
    if (this.timer <= 0) {
      const p = this.scene.nearestPredator(this.img.x, this.img.y);
      if (p) {
        this.timer = 1.2;
        this.img.setFlipX(p.spr.x < this.img.x);
        this.scene.throwAcorn(this.img.x, this.img.y - 50, p);
      } else {
        this.timer = 0.5;
      }
    }
  }

  private updateHen(dt: number, t: number) {
    if (this.pause > 0) {
      this.pause -= dt;
    } else if (this.walk(this.tx, 30, dt, t)) {
      this.tx = Phaser.Math.Between(150, 760);
      this.pause = 1 + Math.random() * 2;
    }
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 28;
      this.scene.burst(this.img.x, this.img.y - 30, 0xffd23f, 10);
      this.scene.dropCoin(this.img.x, this.img.y - 30, 250);
    }
  }

  private updatePhoenixChick(dt: number, t: number) {
    this.walk(this.tx, 35, dt, t);
    if (Math.abs(this.img.x - this.tx) < 10) this.tx = Phaser.Math.Between(100, W - 100);
    // Revives any bird starving to death
    for (const b of this.scene.birds) {
      if (b.fullness <= 1 && !b.dead) {
        b.fullness = 60;
        this.scene.burst(b.spr.x, b.spr.y, 0xf97316, 18);
        this.scene.floatText(b.spr.x, b.spr.y - 40, 'PHOENIX REVIVAL!', '#facc15', '#b91c1c');
        break;
      }
    }
  }

  private updateChameleon(dt: number, t: number) {
    this.img.y = 480 + Math.sin(t * 0.003) * 2;
  }

  private updateSinger(dt: number, t: number) {
    this.timer -= dt;
    const f = this.flyer;
    if (!f) return;
    f.spr.y += Math.sin(t * 0.003) * 0.05;
    if (this.timer <= 0) {
      this.timer = 32;
      this.scene.sing(f.spr.x, f.spr.y);
    }
  }
}

// ------------------------------------------------------------------- Sugar Glider (World 4 Non-Bird Glider)
export class SugarGlider {
  scene: AviaryScene;
  spr: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  flip: Phaser.GameObjects.Container;
  state: 'perch' | 'glide' = 'perch';
  tx = 0;
  ty = 0;
  dir = 1;
  stateTimer = 2.0;
  dropTimer: number;

  constructor(scene: AviaryScene, x: number, y: number) {
    this.scene = scene;
    this.tx = x;
    this.ty = y;
    this.dropTimer = 8.0 + Math.random() * 6.0;

    this.shadow = scene.add.image(x, 595, 'shadow_bird_adult').setDepth(3).setAlpha(0.28).setScale(0.7, 0.35);

    this.body = scene.add.image(0, 0, 'sugar_glider_perch');
    this.flip = scene.add.container(0, 0, [this.body]);
    this.spr = scene.add.container(x, y, [this.flip]).setDepth(16);
    this.spr.setSize(52, 40).setInteractive({ useHandCursor: true });

    this.spr.on('pointerdown', () => {
      this.scene.burst(this.spr.x, this.spr.y, 0xfbcfe8, 14);
      this.scene.floatText(this.spr.x, this.spr.y - 25, '🐿️ SQUEAK! ✨', '#fbcfe8', '#4c0519');
      this.scene.tweens.add({
        targets: this.flip,
        rotation: this.dir * Math.PI * 2,
        duration: 400,
        ease: 'Cubic.easeOut',
      });
    });

    this.chooseNextSpot();
  }

  chooseNextSpot() {
    const spots = this.scene.spots;
    if (spots.length > 0 && Math.random() < 0.75) {
      const sp = Phaser.Utils.Array.GetRandom(spots);
      this.tx = sp.x + (Math.random() - 0.5) * 36;
      this.ty = sp.y - 14;
    } else {
      this.tx = Phaser.Math.Between(140, W - 140);
      this.ty = Phaser.Math.Between(150, 480);
    }
    this.state = 'glide';
    this.stateTimer = 5.0;
    this.body.setTexture('sugar_glider_glide');
  }

  update(dt: number, t: number) {
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = 14.0 + Math.random() * 8.0;
      this.dropCinderAcorn();
    }

    if (this.state === 'perch') {
      this.stateTimer -= dt;
      this.body.y = Math.sin(t * 0.007) * 1.5;
      if (this.stateTimer <= 0) {
        this.chooseNextSpot();
      }
    } else if (this.state === 'glide') {
      const dx = this.tx - this.spr.x;
      const dy = this.ty - this.spr.y;
      const dist = Math.hypot(dx, dy);

      if (dx > 4) this.dir = 1;
      else if (dx < -4) this.dir = -1;
      this.flip.scaleX = this.dir;

      const speed = 195;
      const step = speed * dt;

      const angle = Math.atan2(dy, Math.abs(dx));
      this.flip.rotation = this.dir * Phaser.Math.Clamp(angle, -0.55, 0.55);

      if (dist <= step || dist < 14) {
        this.spr.x = this.tx;
        this.spr.y = this.ty;
        this.state = 'perch';
        this.stateTimer = 2.5 + Math.random() * 3.5;
        this.body.setTexture('sugar_glider_perch');
        this.flip.rotation = 0;
      } else {
        this.spr.x += (dx / dist) * step;
        this.spr.y += (dy / dist) * step + Math.sin(t * 0.008) * 0.5;
      }
    }

    this.shadow.x = this.spr.x;
    const altitude = Math.max(0, 595 - this.spr.y);
    const altNorm = Phaser.Math.Clamp(altitude / 450, 0, 1);
    this.shadow.setScale((0.6 + altNorm * 0.4) * 0.7, (0.3 + altNorm * 0.2) * 0.35);
    this.shadow.setAlpha(Phaser.Math.Clamp(0.28 - altNorm * 0.18, 0.08, 0.28));
  }

  dropCinderAcorn() {
    this.scene.burst(this.spr.x, this.spr.y, 0xff5722, 12);
    this.scene.burst(this.spr.x, this.spr.y, 0xffd700, 8);
    this.scene.floatText(this.spr.x, this.spr.y - 22, '🔥 Cinder Acorn!', '#ff7a29', '#450a0a');
    this.scene.dropCinderAcorn(this.spr.x, this.spr.y + 10);
  }

  destroy() {
    this.shadow.destroy();
    this.spr.destroy();
  }
}

// ------------------------------------------------------------------- UI
type ButtonState = 'normal' | 'selected' | 'disabled';

interface Btn {
  c: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  state: ButtonState | '';
  draw(s: ButtonState): void;
}

interface Shop {
  btn: Btn;
  icon: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  tiny: Phaser.GameObjects.Text;
  cost: () => number;
  /** Paid with gems instead of coins. */
  gem?: boolean;
  enabled: () => boolean;
  texts: () => { sub: string; tiny: string; icon?: string; title?: string };
  buy: () => void;
}

export interface SuspendedGameInfo {
  mode: 'campaign' | 'sandbox' | 'timeTrial' | 'challenge';
  level: number;
  flockCount: number;
  coins: number;
  gems: number;
  weapon: number;
  eggs: number;
  petKeys: string[];
  timeTrialTime?: number;
  challengeId?: string;
  label: string;
  stageName: string;
}

interface SceneData {
  level?: number;
  pets?: string[];
  sandbox?: boolean;
  timeTrial?: boolean;
  challengeId?: string;
  restoredCoins?: number;
  restoredWeapon?: number;
  restoredEggs?: number;
  restoredBirdCount?: number;
  promptResume?: boolean;
}

export class AviaryScene extends Phaser.Scene {
  static suspendedGame?: SuspendedGameInfo;
  gamePaused = false;
  private pauseModalContainer?: Phaser.GameObjects.Container;
  public currentLayout!: LevelLayoutDef;
  public levelDesigner!: LevelDesigner;
  private treeCanopyGfx?: Phaser.GameObjects.Graphics;
  private treeTrunkGfx?: Phaser.GameObjects.Graphics;
  private treeFgGfx?: Phaser.GameObjects.Graphics;
  private sceneryImages: Phaser.GameObjects.Image[] = [];
  level = 1;
  petKeys: string[] = [];
  coins = 100;
  quality = 1;
  maxFood = 1;
  weapon = 0;
  eggs = 0;
  ended = false;
  spots: Spot[] = [];
  birds: Bird[] = [];
  foods: Food[] = [];
  coinList: Coin[] = [];
  predators: Predator[] = [];
  pets: Pet[] = [];
  gliders: SugarGlider[] = [];
  waveIndex = 0;
  waveTimer = 0;
  waveWarning = false;
  warningTimer = 0;
  pendingEnemies: WaveEnemy[] = [];
  warningContainer?: Phaser.GameObjects.Container;
  warningVignette?: Phaser.GameObjects.Graphics;
  warningTitleText?: Phaser.GameObjects.Text;
  warningSubText?: Phaser.GameObjects.Text;
  warningCountdownText?: Phaser.GameObjects.Text;
  lastSirenBeepSec = -1;
  hadPredators = false;
  missiles: Missile[] = [];
  webs: Phaser.GameObjects.Image[] = [];
  pinecones: Phaser.GameObjects.Image[] = [];
  private lastFoodWarn = 0;
  private lastAttack = -9999;
  sandbox = false;
  timeTrial = false;
  challengeId?: string;
  batsDefeated = 0;
  timeTrialTime = 180;
  private timerText?: Phaser.GameObjects.Text;
  private challengeGoalText?: Phaser.GameObjects.Text;
  gems = 0;
  private potionMode = false;
  public modal = false;
  private modalItems: Phaser.GameObjects.GameObject[] = [];
  private gemText?: Phaser.GameObjects.Text;
  private topGemText?: Phaser.GameObjects.Text;
  private coinText?: Phaser.GameObjects.Text;
  private birdText!: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Container | Phaser.GameObjects.Text;
  private shops: Shop[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private initData?: SceneData;

  discoMode = false;
  derpMode = false;
  private discoBall?: Phaser.GameObjects.Image;
  private discoOverlay?: Phaser.GameObjects.Rectangle;
  private discoLights: Phaser.GameObjects.Arc[] = [];
  private rainDanceT = 0;
  private rainStreaks: Phaser.GameObjects.Line[] = [];
  private rainbow?: Phaser.GameObjects.Graphics;
  private cloudClicks = 0;
  private frogmouthClicks = 0;
  frogmouth?: Phaser.GameObjects.Container;
  private cheatBuffer = '';
  private sunbeams?: Phaser.GameObjects.Graphics;
  private ambientMotes: Phaser.GameObjects.Arc[] = [];
  private foregroundVines?: Phaser.GameObjects.Graphics;
  private bgImage?: Phaser.GameObjects.Image;

  constructor() {
    super('Aviary');
  }

  init(data: SceneData) {
    this.initData = data;
    this.gamePaused = false;
    this.ended = false;
    this.sandbox = !!data.sandbox;
    this.timeTrial = !!data.timeTrial;
    this.challengeId = data.challengeId;
    this.batsDefeated = 0;
    this.timeTrialTime = 300;
    this.timerText = undefined;
    this.challengeGoalText = undefined;
    const sv = loadSave();
    this.gems = sv.gems;
    this.potionMode = false;
    this.modal = false;
    this.modalItems = [];
    this.gemText = undefined;
    this.topGemText = undefined;
    this.coinText = undefined;
    this.birdText = undefined as any;
    this.hint = undefined;
    this.shops = [];
    this.clouds = [];
    this.birds = [];
    this.foods = [];
    this.coinList = [];
    this.predators = [];
    this.pets = [];
    this.gliders = [];
    this.missiles = [];
    this.webs = [];
    this.pinecones = [];
    this.sceneryImages = [];
    this.spots = [];
    this.treeTrunkGfx = undefined;
    this.treeCanopyGfx = undefined;
    this.treeFgGfx = undefined;
    this.pauseModalContainer = undefined;
    this.warningContainer = undefined;
    this.sunbeams = undefined;
    this.ambientMotes = [];
    this.foregroundVines = undefined;
    this.discoMode = false;
    this.derpMode = false;
    this.discoBall = undefined;
    this.discoOverlay = undefined;
    this.discoLights = [];
    this.rainDanceT = 0;
    this.rainStreaks = [];
    this.rainbow = undefined;
    this.cloudClicks = 0;
    this.frogmouthClicks = 0;
    this.frogmouth = undefined;
    this.cheatBuffer = '';
    this.level = this.sandbox
      ? (sv.sandbox?.wallpaper ?? 1)
      : this.challengeId === 'night_bats'
      ? 2
      : this.timeTrial
      ? (data.level ?? 1)
      : (data.level ?? sv.level ?? 1);
    const sb = sv.sandbox;
    if (this.sandbox) {
      this.quality = sb?.quality ?? 1;
      this.maxFood = sb?.maxFood ?? 1;
      this.weapon = sb?.weapon ?? 0;
      this.coins = 0;
      // In My Aviary, companions are strictly limited to 3 max!
      const unlocked = getUnlockedPets(sv.level).map((p) => p.key);
      const savedPets = (sb?.pets ?? []).filter((k) => unlocked.includes(k));
      if (savedPets.length > 0) {
        this.petKeys = savedPets.slice(0, 3);
      } else {
        this.petKeys = unlocked.slice(0, 3);
      }
    } else {
      this.quality = 1;
      this.maxFood = 1;
      this.weapon = data.restoredWeapon ?? 0;
      this.coins = data.restoredCoins ?? 200;
      this.eggs = data.restoredEggs ?? 0;
      this.petKeys = this.challengeId === 'night_bats'
        ? ['owl', 'hedgehog', 'squirrel']
        : this.timeTrial
        ? (data.pets ?? ['hedgehog', 'butterfly', 'squirrel']).slice(0, 3)
        : (data.pets ?? []).slice(0, 3);
    }
    this.eggs = 0;
    this.ended = false;
    this.spots = [];
    this.birds = [];
    this.foods = [];
    this.coinList = [];
    this.predators = [];
    this.pets = [];
    this.gliders.forEach((g) => g.destroy());
    this.gliders = [];
    this.shops = [];
    this.clouds = [];
    this.waveIndex = 0;
    this.waveWarning = false;
    this.warningTimer = 0;
    this.warningContainer = undefined;
    this.warningVignette = undefined;
    this.warningTitleText = undefined;
    this.warningSubText = undefined;
    this.warningCountdownText = undefined;
    this.pendingEnemies = [];
    this.hadPredators = false;
    const d = difficulty(this.level);
    this.waveTimer = this.sandbox
      ? Infinity
      : this.challengeId === 'night_bats'
      ? 8
      : this.timeTrial
      ? 25
      : d.firstWaveDelay;
    this.webs = [];
    this.pinecones = [];
    this.missiles = [];
  }

  hasCompanion(key: string): boolean {
    return this.pets.some((p) => p.key === key);
  }

  barkAllPredators() {
    this.predators.forEach((p) => {
      p.stun = 1.8;
      this.burst(p.spr.x, p.spr.y, 0xf59e0b, 10);
    });
  }

  spawnSpiderWeb(x: number, y: number) {
    const web = this.add.image(x, y, 'spider_web').setDepth(8).setInteractive({ useHandCursor: true });
    web.on('pointerdown', () => {
      this.burst(web.x, web.y, 0xffffff, 12);
      this.webs = this.webs.filter((w) => w !== web);
      web.destroy();
    });
    this.webs.push(web);
  }

  throwPinecone(x: number, y: number) {
    const pc = this.add.image(x, y, 'pinecone').setDepth(8).setInteractive({ useHandCursor: true });
    pc.on('pointerdown', () => {
      this.burst(pc.x, pc.y, 0xf59e0b, 16);
      this.dropCoin(pc.x - 20, pc.y, 100, 'coin_gold');
      this.dropCoin(pc.x, pc.y - 15, 100, 'coin_gold');
      this.dropCoin(pc.x + 20, pc.y, 100, 'coin_gold');
      this.pinecones = this.pinecones.filter((p) => p !== pc);
      pc.destroy();
    });
    this.pinecones.push(pc);
  }

  preload() {
    // Pure procedural & generative vector textures
  }

  create() {
    this.coinText = undefined;
    this.gemText = undefined;
    this.topGemText = undefined;
    this.birdText = undefined as any;
    this.shops = [];
    this.birds = [];
    this.foods = [];
    this.coinList = [];
    this.predators = [];
    this.pets = [];
    this.gliders = [];
    this.missiles = [];
    this.webs = [];
    this.pinecones = [];
    this.sceneryImages = [];
    this.spots = [];
    this.treeTrunkGfx = undefined;
    this.treeCanopyGfx = undefined;
    this.treeFgGfx = undefined;
    this.ended = false;
    this.gamePaused = false;
    this.modal = false;

    const save = loadSave();
    makeTextures(this);

    const ws = getWorldAndStage(this.level);
    const layoutKey = this.sandbox
      ? 'sandbox'
      : this.challengeId
      ? `challenge_${this.challengeId}`
      : `world_${ws.worldId}_stage_${ws.stageNum}`;
    this.currentLayout = loadLevelLayout(layoutKey, this.sandbox ? 1 : ws.worldId);
    this.levelDesigner = new LevelDesigner(this);
    this.input.keyboard?.on('keydown-F2', () => this.levelDesigner.toggle());

    this.drawBackground();
    this.drawTree();
    this.initStickBug();
    this.buildToolbar();
    this.buildHud();

    if (this.sandbox) {
      const saved = loadSave().sandbox?.birds;
      const list: SavedBird[] =
        saved && saved.length > 0
          ? saved
          : [
              { stage: 0, units: 0, mama: false, rare: false, species: 'sparrow' },
              { stage: 0, units: 0, mama: false, rare: false, species: 'canary' },
            ];
      list.forEach((sb) => {
        const b = new Bird(
          this,
          Phaser.Math.Between(150, 750),
          Phaser.Math.Between(120, 400),
          sb.stage,
          sb.mama,
          sb.rare,
          sb.species ?? 'sparrow'
        );
        b.units = sb.units;
        if (sb.name) b.applyName(sb.name);
        if (sb.hidden) {
          b.hidden = true;
          b.spr.setVisible(false);
          b.shadow?.setVisible(false);
        }
        if (sb.hometown) b.hometown = sb.hometown;
        if (sb.purchaseDate) b.purchaseDate = sb.purchaseDate;
        if (sb.mentalState) b.mentalState = sb.mentalState;
        if (sb.additionalNotes) b.additionalNotes = sb.additionalNotes;
        this.birds.push(b);
      });
      this.time.addEvent({ delay: 4000, loop: true, callback: () => this.saveSandbox() });
    } else {
      const restoredCount = this.initData?.restoredBirdCount;
      if (restoredCount !== undefined && restoredCount > 0) {
        for (let i = 0; i < restoredCount; i++) {
          const stage = this.level === 1 ? 0 : 1;
          const bx = 340 + (i % 4) * 140;
          const by = 230 + (i % 2) * 60;
          this.birds.push(new Bird(this, bx, by, stage, false, false, 'sparrow'));
        }
      } else if (this.level === 1) {
        this.birds.push(new Bird(this, 500, 260, 0, false, false, 'sparrow'));
      } else {
        this.birds.push(
          new Bird(this, 380, 250, 1, false, false, 'sparrow'),
          new Bird(this, 620, 300, 1, false, false, 'sparrow')
        );
      }
    }
    for (const k of this.petKeys) {
      if (k === 'nightingale') this.spots[5].reserved = true;
      this.pets.push(new Pet(this, k));
    }

    // Wake and sleep event listeners for seamless menu pausing & resuming
    this.events.on('wake', () => {
      window.removeEventListener('keydown', this.onKeyDown);
      window.addEventListener('keydown', this.onKeyDown);
      this.refreshUi();
      this.openPauseModal(true);
    });

    if (this.initData?.promptResume) {
      this.openPauseModal(true);
    }

    this.events.on('sleep', () => {
      window.removeEventListener('keydown', this.onKeyDown);
    });

    window.addEventListener('keydown', this.onKeyDown);
    this.events.once('shutdown', () => window.removeEventListener('keydown', this.onKeyDown));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.ended || this.modal || this.gamePaused || p.y >= BAR_Y) return;
      if (this.potionMode) {
        this.usePotion(p.x, p.y);
        return;
      }
      // In My Aviary, clicking on a bird pets it with chirps & hearts (does NOT open a modal!)
      if (this.sandbox) {
        for (const b of this.birds) {
          if (b.dead || b.hidden) continue;
          if (Phaser.Math.Distance.Between(p.x, p.y, b.spr.x, b.spr.y) < 45 * b.scale) {
            if (b.isFeeder) {
              this.floatText(b.spr.x, b.spr.y - 25, '🌾 Feeder Chick', '#ffffff', '#3a2412');
              this.burst(b.spr.x, b.spr.y, 0xffd54f, 4);
              return;
            }
            const displayName = b.name ? b.name : b.species.name;
            playPettingSound();
            this.floatText(b.spr.x, b.spr.y - 25, `♥ ${displayName} ♥`, '#ff69b4', '#4a0e2e');
            this.burst(b.spr.x, b.spr.y, 0xff69b4, 6);
            return;
          }
        }
      }
      // Check if clicked an incoming missile to intercept it!
      const now = this.time.now;
      for (const m of this.missiles) {
        if (m.destroyed) continue;
        if (Phaser.Math.Distance.Between(p.x, p.y, m.img.x, m.img.y) < 42) {
          this.interceptMissile(m);
          this.lastAttack = now;
          return;
        }
      }

      // 1. Check if Gorgon the Glutton is present
      const glutton = this.predators.find((pr) => !pr.dying && pr.kind === 'glutton');
      if (glutton) {
        // In Glutton presence, clicks always drop food seeds directly into his path!
        // Never blocks clicks with "IMMUNE"!
        this.dropFood(p.x, p.y);
        this.floatText(p.x, p.y - 15, '🌽 FEED GORGON!', '#84cc16', '#1a2e05');
        return;
      }

      // 2. Check for regular combat predators (Fighting Mode vs Normal Mode)
      const combatPredators = this.predators.filter((pr) => !pr.dying && pr.kind !== 'glutton');
      if (combatPredators.length > 0) {
        // FIGHTING MODE:
        // Clicks fire weapons at predators. Does NOT drop food in open air, preventing wasted coins!
        let hitAny = false;
        for (const pr of combatPredators) {
          const d = Phaser.Math.Distance.Between(p.x, p.y, pr.spr.x, pr.spr.y);
          if (d < pr.radius + 40) {
            const dmg = WEAPON_DMG[this.weapon];
            pr.hit(dmg, p.x, p.y);
            playWeaponSound(this.weapon);
            this.playAttackFx(this.weapon, p.x, p.y, pr);
            hitAny = true;
            break;
          }
        }
        if (!hitAny) {
          // Fired at airspace towards cursor
          playWeaponSound(this.weapon);
          this.playAttackFx(this.weapon, p.x, p.y, undefined);
        }
        this.lastAttack = now;
        return;
      }

      // 3. Peaceful Mode: Normal food dropping
      if (now - this.lastAttack < 300) return;
      this.dropFood(p.x, p.y);
    });
    this.refreshUi();
  }

  // ---------- scenery ----------
  private drawBackground() {
    const ws = getWorldAndStage(this.level);
    const th = themeFor(this.level);

    const g = this.add.graphics().setDepth(0);

    // 1. Sky Gradient
    g.fillGradientStyle(th.sky1, th.sky1, th.sky2, th.sky2, 1);
    g.fillRect(0, 0, W, 580);

    // 2. Radiant Sun with Multi-layered Corona
    g.fillStyle(th.sun, 0.18);
    g.fillCircle(170, 110, 130);
    g.fillStyle(th.sun, 0.35);
    g.fillCircle(170, 110, 85);
    g.fillStyle(th.sun, 0.7);
    g.fillCircle(170, 110, 52);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(170, 110, 32);

    // 3. Volumetric 2.5D Sunbeams (God-Rays streaming down through canopy)
    const rays = this.add.graphics().setDepth(1);
    rays.setBlendMode(Phaser.BlendModes.ADD);
    rays.fillStyle(th.sun, 0.08);
    const rayAngles = [-0.48, -0.26, -0.08, 0.12, 0.32, 0.52];
    const sunX = 170;
    const sunY = 110;
    for (const ang of rayAngles) {
      rays.fillTriangle(
        sunX, sunY,
        sunX + Math.cos(ang + 0.45) * 850, sunY + Math.sin(ang + 0.45) * 850,
        sunX + Math.cos(ang + 0.58) * 880, sunY + Math.sin(ang + 0.58) * 880
      );
    }
    this.sunbeams = rays;

    // 4. Distant Mountain Range (Atmospheric Depth Layer 1)
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

    // 5. Midground Rolling Forest Hills (Atmospheric Depth Layer 2)
    g.fillStyle(th.hillFar, 0.92);
    g.fillEllipse(280, 560, 850, 190);
    g.fillEllipse(960, 570, 920, 200);

    g.fillStyle(th.hillNear, 1);
    g.fillEllipse(120, 620, 720, 170);
    g.fillEllipse(640, 630, 860, 160);
    g.fillEllipse(1140, 620, 720, 170);

    // 6. Forest Floor Base
    g.fillStyle(th.ground, 1);
    g.fillRect(0, 580, W, 48);
    g.fillStyle(th.ground2, 1);
    g.fillRect(0, 598, W, 28);

    // 7. Ground Grass Tufts & Wildflowers
    const cols = [th.ground2, th.hillNear, th.ground];
    for (let i = 0; i < 280; i++) {
      const x = Math.random() * W;
      const y = 578 + Math.random() * 46;
      g.fillStyle(Phaser.Utils.Array.GetRandom(cols), 1);
      g.fillTriangle(x, y, x + 4, y, x + 2, y - 10 - Math.random() * 10);
    }
    const petals = [0xff7aa2, 0xffffff, 0xffd23f, 0xb48cff];
    for (let i = 0; i < 32; i++) {
      const x = Math.random() * W;
      const y = 590 + Math.random() * 30;
      g.fillStyle(Phaser.Utils.Array.GetRandom(petals), 1);
      g.fillCircle(x, y, 4);
      g.fillStyle(0xffe45e, 1);
      g.fillCircle(x, y, 1.8);
    }

    // --- 2.5D Midground Depth Scenery Props (Driven by Level Layout) ---
    this.drawSceneryProps();

    // 8. Clouds
    this.clouds = [];
    const hasSecretCloud = Math.random() < 0.35; // 35% chance per stage
    const secretIndex = hasSecretCloud ? Phaser.Math.Between(0, 4) : -1;

    for (let i = 0; i < 5; i++) {
      const c = this.add.image(Math.random() * W, 40 + Math.random() * 200, 'cloud').setAlpha(0.88).setDepth(1);
      const baseScale = 0.55 + Math.random() * 0.45;
      c.setScale(baseScale);
      c.setData('baseScale', baseScale);
      c.setData('isSecret', i === secretIndex);
      // Discreet interaction: NO hand cursor, blends naturally into the sky
      c.setInteractive();
      c.on('pointerdown', () => this.onCloudClick(c));
      this.clouds.push(c);
    }

    // 9. Ambient Drifting Motes / Particles (Depth 25)
    this.ambientMotes = [];
    const moteColor = ws.worldId === 3 ? 0xfbcfe8 : ws.worldId === 4 ? 0xf97316 : th.sun;
    const moteCount = ws.worldId === 4 ? 30 : 22;
    for (let i = 0; i < moteCount; i++) {
      const mote = this.add.circle(
        Phaser.Math.Between(20, W - 20),
        Phaser.Math.Between(20, 560),
        ws.worldId === 3 ? 2.5 + Math.random() * 2 : 1.5 + Math.random() * 2,
        moteColor,
        0.35 + Math.random() * 0.4
      ).setDepth(25);
      this.ambientMotes.push(mote);
    }

    // Top vines removed so all top HUD & toolbar buttons are clean and unobstructed
    if (this.challengeId === 'night_bats') {
      this.createNightAtmosphere();
    }
  }

  public drawSceneryProps() {
    for (const img of this.sceneryImages) {
      img.destroy();
    }
    this.sceneryImages = [];

    if (!this.currentLayout?.scenery) return;
    for (const sc of this.currentLayout.scenery) {
      const img = this.add
        .image(sc.x, sc.y, sc.texture)
        .setDepth(sc.depth ?? 1)
        .setScale(sc.scale ?? 1.0)
        .setFlipX(!!sc.flipX);
      this.sceneryImages.push(img);
    }
  }

  public redrawLevelLayout() {
    this.drawSceneryProps();
    this.drawTree();
  }

  public reloadDefaultLayout() {
    const ws = getWorldAndStage(this.level);
    const layoutKey = this.sandbox
      ? 'sandbox'
      : this.challengeId
      ? `challenge_${this.challengeId}`
      : `world_${ws.worldId}_stage_${ws.stageNum}`;
    this.currentLayout = getDefaultLevelDesign(this.sandbox ? 1 : ws.worldId, layoutKey);
    this.redrawLevelLayout();
  }

  private createNightAtmosphere() {
    // 1. Deep Midnight Blue Ambient Sky Filter
    const night = this.add.graphics().setDepth(2);
    night.fillStyle(0x070b1e, 0.76);
    night.fillRect(0, 0, W, H);

    // 2. Luminous Silver Crescent Moon
    const moon = this.add.graphics().setDepth(3);
    // Outer Moon Aura
    moon.fillStyle(0x93c5fd, 0.18);
    moon.fillCircle(W - 140, 95, 38);
    // Moon body
    moon.fillStyle(0xf8fafc, 0.95);
    moon.fillCircle(W - 140, 95, 26);
    // Dark cutout for delicate crescent
    moon.fillStyle(0x070b1e, 1);
    moon.fillCircle(W - 128, 88, 22);

    // 3. Twinkling Night Stars
    for (let i = 0; i < 28; i++) {
      const sx = Phaser.Math.Between(30, W - 30);
      const sy = Phaser.Math.Between(25, 340);
      const star = this.add.circle(sx, sy, Math.random() < 0.25 ? 2.2 : 1.2, 0xe0e7ff, 0.4 + Math.random() * 0.5).setDepth(3);
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: 900 + Math.random() * 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // 4. Glowing Midnight Fireflies
    for (let i = 0; i < 14; i++) {
      const fx = Phaser.Math.Between(80, W - 80);
      const fy = Phaser.Math.Between(180, 560);
      const fly = this.add.circle(fx, fy, 2.5, 0x67e8f9, 0.75).setDepth(22);
      this.tweens.add({
        targets: fly,
        x: fx + Phaser.Math.Between(-40, 40),
        y: fy + Phaser.Math.Between(-30, 30),
        alpha: { from: 0.2, to: 0.9 },
        duration: 2200 + Math.random() * 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private onCloudClick(c: Phaser.GameObjects.Image) {
    const isSecret = c.getData('isSecret');
    const baseScale = (c.getData('baseScale') as number) || 0.8;

    // Fixed non-compounding bounce tween (prevents cloud from being smeared or stretched!)
    this.tweens.killTweensOf(c);
    c.setScale(baseScale);
    this.tweens.add({
      targets: c,
      scaleX: baseScale * 1.15,
      scaleY: baseScale * 0.9,
      duration: 110,
      yoyo: true,
      onComplete: () => c.setScale(baseScale),
    });

    if (isSecret) {
      this.cloudClicks++;
      this.burst(c.x + Phaser.Math.Between(-15, 15), c.y + 15, 0x60a5fa, 2);
      if (this.cloudClicks >= 5) {
        this.cloudClicks = 0;
        c.setData('isSecret', false); // Trigger once per level
        this.startRainDance();
      }
    }
  }

  peekStickBug() {
    if (!this.frogmouth || !this.frogmouth.active) return;
    const img = this.frogmouth.getAt(0) as Phaser.GameObjects.Image;
    if (img && img.active) {
      const ws = getWorldAndStage(this.level);
      const worldId = this.sandbox ? 1 : ws.worldId;
      img.setTexture(`stick_bug_peeking_${worldId}`);
      this.time.delayedCall(2200, () => {
        if (img && img.active) img.setTexture(`stick_bug_hidden_${worldId}`);
      });
    }
  }

  checkNestRaid(pred: Predator, dt: number) {
    if (pred.dying || pred.stun > 0) return;
    for (const s of this.spots) {
      if (!s.nest || (s.nestStage ?? 0) <= 0) continue;
      const d = Phaser.Math.Distance.Between(pred.spr.x, pred.spr.y, s.x, s.y);
      if (d < pred.radius + 32) {
        s.nestRaidCooldown = (s.nestRaidCooldown ?? 0) - dt;
        if (s.nestRaidCooldown <= 0) {
          s.nestRaidCooldown = 1.6;
          s.nestStage = Math.max(0, (s.nestStage ?? 1) - 1);
          this.drawNest(s);
          this.burst(s.x, s.y, 0x8a5528, 14);
          this.burst(s.x, s.y, 0xef4444, 8);
          this.cameras.main.shake(120, 0.0035);

          if (s.egg) {
            s.egg.destroy();
            s.egg = undefined;
            this.floatText(s.x, s.y - 45, '🥚 EGG DESTROYED!', '#ef4444', '#450a0a');
            this.toast('A predator smashed an egg in the nest!');
          } else if (s.nestStage <= 0) {
            s.reserved = false;
            this.floatText(s.x, s.y - 35, '💥 NEST DESTROYED!', '#ef4444', '#450a0a');
            this.toast('A predator completely demolished a nest!');
          } else {
            this.floatText(s.x, s.y - 35, `💥 NEST TRAMPLED! (${s.nestStage}/6)`, '#f97316', '#7c2d12');
            this.toast('A predator is attacking a nest! Drive it away!');
          }
        }
      }
    }
  }

  drawNest(s: Spot) {
    if (!s.nestGfx) {
      s.nestGfx = this.add.graphics().setDepth(4);
    }
    const g = s.nestGfx;
    g.clear();
    const stage = s.nestStage ?? 0;

    if (stage <= 0) {
      // Natural empty branch fork - zero weird circles or indicators!
      return;
    } else if (stage === 1) {
      // Stage 1: First 3-4 rough brown twigs laid across the branch fork
      g.lineStyle(3.5, 0x5a3418, 1);
      g.lineBetween(s.x - 24, s.y + 6, s.x + 22, s.y + 2);
      g.lineBetween(s.x - 18, s.y - 1, s.x + 16, s.y + 9);
      g.lineBetween(s.x - 10, s.y + 11, s.x + 18, s.y - 2);
    } else if (stage === 2) {
      // Stage 2: Criss-crossed stick platform with pine needles
      g.lineStyle(3.5, 0x4e2c14, 1);
      g.lineBetween(s.x - 30, s.y + 8, s.x + 28, s.y + 3);
      g.lineBetween(s.x - 26, s.y - 1, s.x + 24, s.y + 10);
      g.lineBetween(s.x - 20, s.y + 12, s.x + 20, s.y - 2);
      g.lineBetween(s.x - 8, s.y + 14, s.x + 15, s.y + 1);
      g.lineStyle(2.2, 0x8a5528, 1);
      g.lineBetween(s.x - 28, s.y + 6, s.x + 26, s.y + 2);
      g.lineBetween(s.x - 16, s.y + 3, s.x + 22, s.y + 8);
      // Small moss patch
      g.fillStyle(0x4a7c59, 0.9);
      g.fillCircle(s.x - 6, s.y + 6, 4);
    } else if (stage === 3) {
      // Stage 3: Shallow wicker outline rim forming circular bowl
      g.fillStyle(0x3e200c, 0.85);
      g.fillEllipse(s.x, s.y + 8, 64, 18);
      g.lineStyle(3.2, 0x5a3418, 1);
      g.lineBetween(s.x - 32, s.y + 7, s.x + 32, s.y + 7);
      g.lineBetween(s.x - 28, s.y + 12, s.x + 28, s.y + 12);
      g.lineStyle(2.2, 0x8f6234, 1);
      for (let i = 0; i < 6; i++) {
        g.lineBetween(s.x - 24 + i * 9.5, s.y + 13, s.x - 20 + i * 9.5, s.y + 3);
      }
      g.fillStyle(0x4a7c59, 0.95);
      g.fillCircle(s.x - 12, s.y + 7, 4.5);
    } else if (stage === 4) {
      // Stage 4: Woven wooden bowl with rising sides and moss clumps
      g.fillStyle(0x4e2c14, 1);
      g.fillEllipse(s.x, s.y + 8, 76, 24);
      g.fillStyle(0x7c4e28, 1);
      g.fillEllipse(s.x, s.y + 4, 64, 17);
      g.lineStyle(2.5, 0x3d210d, 1);
      for (let i = 0; i < 7; i++) {
        g.lineBetween(s.x - 30 + i * 10, s.y + 14, s.x - 24 + i * 10, s.y + 2);
      }
      g.lineStyle(2, 0x9c663b, 1);
      g.lineBetween(s.x - 32, s.y + 6, s.x + 32, s.y + 6);
      g.lineBetween(s.x - 26, s.y + 11, s.x + 26, s.y + 11);
      g.fillStyle(0x4a7c59, 1);
      g.fillCircle(s.x - 18, s.y + 8, 5);
      g.fillCircle(s.x + 18, s.y + 7, 4.5);
    } else if (stage === 5) {
      // Stage 5: Deep thick woven cup with birch bark and velvety moss
      g.fillStyle(0x3e200c, 1);
      g.fillEllipse(s.x, s.y + 9, 82, 28);
      g.fillStyle(0x6e3d1b, 1);
      g.fillEllipse(s.x, s.y + 5, 72, 21);
      g.lineStyle(2.5, 0x2b1507, 1);
      for (let i = 0; i < 8; i++) {
        g.lineBetween(s.x - 34 + i * 9.5, s.y + 16, s.x - 28 + i * 9.5, s.y + 3);
        g.lineBetween(s.x - 28 + i * 9.5, s.y + 16, s.x - 34 + i * 9.5, s.y + 3);
      }
      g.lineStyle(2.2, 0x93592b, 1);
      g.lineBetween(s.x - 35, s.y + 6, s.x + 35, s.y + 6);
      g.lineBetween(s.x - 29, s.y + 12, s.x + 29, s.y + 12);
      // Soft straw lining
      g.fillStyle(0xc9a464, 1);
      g.fillEllipse(s.x, s.y + 4, 52, 13);
      // Moss accents
      g.fillStyle(0x386641, 1);
      g.fillCircle(s.x - 22, s.y + 8, 5);
      g.fillCircle(s.x + 22, s.y + 7, 5);
    } else {
      // Stage 6: Master Sanctuary Cup (Completed! Cozy golden-straw and down padding, NO eggs inside)
      g.fillStyle(0x341a0a, 1);
      g.fillEllipse(s.x, s.y + 10, 88, 32);
      g.fillStyle(0x5e3316, 1);
      g.fillEllipse(s.x, s.y + 6, 80, 25);
      // Layered wicker braiding
      g.lineStyle(2.5, 0x241105, 1);
      for (let i = 0; i < 9; i++) {
        g.lineBetween(s.x - 38 + i * 9.5, s.y + 18, s.x - 32 + i * 9.5, s.y + 3);
        g.lineBetween(s.x - 32 + i * 9.5, s.y + 18, s.x - 38 + i * 9.5, s.y + 3);
      }
      g.lineStyle(2.5, 0x93592b, 1);
      g.lineBetween(s.x - 38, s.y + 7, s.x + 38, s.y + 7);
      g.lineBetween(s.x - 32, s.y + 13, s.x + 32, s.y + 13);
      // Warm golden-straw down lining (cozy bed for Mama egg)
      g.fillStyle(0xd9b87c, 1);
      g.fillEllipse(s.x, s.y + 4, 60, 16);
      g.fillStyle(0xf5e1a4, 1);
      g.fillEllipse(s.x, s.y + 2, 46, 11);
      // Lush forest moss rim
      g.fillStyle(0x2d6a4f, 1);
      g.fillCircle(s.x - 26, s.y + 8, 5.5);
      g.fillCircle(s.x + 26, s.y + 8, 5.5);
      g.fillCircle(s.x - 12, s.y + 12, 4.5);
      g.fillCircle(s.x + 12, s.y + 12, 4.5);
    }
  }

  public drawTree() {
    const ws = getWorldAndStage(this.level);
    const worldId = this.sandbox ? 1 : ws.worldId;

    if (!this.treeTrunkGfx || !this.treeTrunkGfx.scene) this.treeTrunkGfx = this.add.graphics().setDepth(2);
    if (!this.treeCanopyGfx || !this.treeCanopyGfx.scene) this.treeCanopyGfx = this.add.graphics().setDepth(3);
    if (!this.treeFgGfx || !this.treeFgGfx.scene) this.treeFgGfx = this.add.graphics().setDepth(4);

    const canopy = this.treeCanopyGfx;
    const trunkGfx = this.treeTrunkGfx;
    const fgGfx = this.treeFgGfx;

    canopy.clear();
    trunkGfx.clear();
    fgGfx.clear();

    // Clean up old nest graphics
    for (const s of this.spots) {
      if (s.nestGfx) {
        s.nestGfx.destroy();
        s.nestGfx = undefined;
      }
    }
    this.spots = [];

    const rnd = new Phaser.Math.RandomDataGenerator(['aviary_tree_v3_' + worldId]);
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
    };

    // Draw all trees in current layout
    for (const tree of this.currentLayout.trees) {
      this.drawSingleTree(tree, canopy, trunkGfx, fgGfx, rnd, V);

      for (let bIdx = 0; bIdx < tree.branches.length; bIdx++) {
        const b = tree.branches[bIdx];
        drawBranchLeaves(b, tree.style, canopy, fgGfx, bIdx);
        drawCurvedBough(b, tree.style);
        if (b.nest) {
          const nx = b.nestX ?? b.x;
          const ny = b.nestY ?? b.y;
          const nestSpot: Spot = {
            x: nx,
            y: ny,
            nest: true,
            eggT: 0,
            nestStage: 0,
          };
          this.spots.push(nestSpot);
          this.drawNest(nestSpot);

          // If the branch perch is spaced away from the nest bowl, allow perching on the tip too!
          if (Phaser.Math.Distance.Between(b.x, b.y, nx, ny) > 24) {
            this.spots.push({
              x: b.x,
              y: b.y,
              nest: false,
              eggT: 0,
              nestStage: 0,
            });
          }
        } else {
          const spot: Spot = {
            x: b.x,
            y: b.y,
            nest: false,
            eggT: 0,
            nestStage: 0,
          };
          this.spots.push(spot);
          this.drawNest(spot);
        }
      }
    }

    // Free standalone perches & nests placed anywhere on screen!
    if (this.currentLayout.freePerches) {
      for (const fp of this.currentLayout.freePerches) {
        const spot: Spot = {
          x: fp.x,
          y: fp.y,
          nest: !!fp.isNest,
          eggT: 0,
          nestStage: 0,
        };
        this.spots.push(spot);
        if (fp.isNest) {
          this.drawNest(spot);
        }
        if (fp.leaves) {
          drawStandaloneLeafCluster(
            { x: fp.x, y: fp.y + 4, scale: 0.65 },
            this.currentLayout.trees[0]?.style || 'oak',
            canopy,
            fgGfx
          );
        }
      }
    }

    // Standalone leafy foliage puffs placed anywhere on screen!
    if (this.currentLayout.leafClusters) {
      for (const lc of this.currentLayout.leafClusters) {
        drawStandaloneLeafCluster(
          lc,
          this.currentLayout.trees[0]?.style || 'oak',
          canopy,
          fgGfx
        );
      }
    }
  }

  private initStickBug() {
    if (this.frogmouth) {
      this.frogmouth.destroy();
      this.frogmouth = undefined;
    }
    const ws = getWorldAndStage(this.level);
    const worldId = this.sandbox ? 1 : ws.worldId;

    // Environmental Secret: The Suspicious "Stick" (Camouflaged Stick Bug per World)
    const spawnStickBug = Math.random() < 0.35;
    if (spawnStickBug) {
      const onGround = Math.random() < 0.45;
      let bugX: number;
      let bugY: number;
      let rot: number;
      if (onGround) {
        bugX = Phaser.Math.Between(340, 680);
        bugY = 584;
        rot = 0.08;
      } else {
        if (worldId === 1) {
          bugX = 160; bugY = 430; rot = -0.32;
        } else if (worldId === 2) {
          bugX = 865; bugY = 415; rot = 0.25;
        } else if (worldId === 3) {
          bugX = 360; bugY = 410; rot = -0.42;
        } else {
          bugX = 220; bugY = 420; rot = -0.28;
        }
      }
      const frogContainer = this.add.container(bugX, bugY).setDepth(onGround ? 11 : 6);
      const frogImg = this.add.image(0, 0, `stick_bug_hidden_${worldId}`).setRotation(rot);
      frogContainer.add(frogImg);
      frogContainer.setSize(44, 24).setInteractive({ useHandCursor: true });
      this.frogmouth = frogContainer;
      this.frogmouthClicks = 0;

      // Periodic peek: eyes open curiously for 2.2 seconds then close again
      this.time.addEvent({
        delay: Phaser.Math.Between(8000, 13000),
        loop: true,
        callback: () => {
          if (!frogContainer.active) return;
          this.peekStickBug();
        },
      });

      frogContainer.on('pointerdown', () => {
        this.frogmouthClicks++;
        this.peekStickBug();
        this.tweens.add({
          targets: frogContainer,
          rotation: rot + (Math.random() - 0.5) * 0.4,
          scaleX: 1.2,
          scaleY: 0.8,
          duration: 90,
          yoyo: true,
        });
        this.floatText(frogContainer.x, frogContainer.y - 20, 'O_O', '#ffffff', '#3a2412');

        if (this.frogmouthClicks >= 2) {
          this.frogmouthClicks = -9999;
          unlockAchievement('frogmouth_spotter', this);
          this.burst(frogContainer.x, frogContainer.y, 0xffd700, 16);
          this.floatText(frogContainer.x, frogContainer.y - 30, 'SQUAWK!', '#ffe600', '#000000');
          this.toast('🪵 You discovered the camouflaged Stick Bug! +Golden Pinecone!');

          if (this.sandbox) {
            this.dropGem(frogContainer.x, frogContainer.y, 10, 'drop_pinecone');
          } else {
            this.dropCoin(frogContainer.x, frogContainer.y, 50);
          }

          this.tweens.add({
            targets: frogContainer,
            x: bugX + (bugX > W / 2 ? 180 : -180),
            y: bugY - 140,
            rotation: -1.2,
            duration: 1100,
            ease: 'Quad.easeIn',
            onComplete: () => frogContainer.destroy(),
          });
        }
      });
    }
  }


  private drawSingleTree(
    tree: TreeDef,
    canopy: Phaser.GameObjects.Graphics,
    trunkGfx: Phaser.GameObjects.Graphics,
    fgGfx: Phaser.GameObjects.Graphics,
    rnd: Phaser.Math.RandomDataGenerator,
    V: (x: number, y: number) => Phaser.Math.Vector2
  ) {
    renderWholeTreeStructure(tree, canopy, trunkGfx, fgGfx, rnd, V);
  }

  // ---------- UI ----------
  private makeButton(x: number, y: number, w: number, h: number, onClick: () => void): Btn {
    const bg = this.add.graphics();
    const c = this.add.container(x, y, [bg]).setDepth(55);
    const btn: Btn = {
      c,
      bg,
      state: '',
      draw: (s: ButtonState) => {
        bg.clear();
        const fill = s === 'selected' ? 0xffd86b : s === 'disabled' ? 0x8a7a6a : 0xf4e2bd;
        bg.fillStyle(0x3a2412, 1);
        bg.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 12);
        bg.fillStyle(fill, 1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
        bg.lineStyle(3, s === 'selected' ? 0xff9a1f : 0xa87a4a, 1);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
        c.setAlpha(s === 'disabled' ? 0.88 : 1);
      },
    };
    btn.draw('normal');
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', onClick);
    return btn;
  }

  private addShop(
    index: number,
    title: string,
    icon: string,
    iconScale: number,
    def: Pick<Shop, 'cost' | 'enabled' | 'texts' | 'buy' | 'gem'>,
    totalButtons = 7
  ) {
    const leftMargin = 175;
    const rightMargin = W - 15; // 1265
    const availableW = rightMargin - leftMargin; // 1090
    const spacing = Math.min(136, availableW / totalButtons);
    const w = Math.min(118, spacing - 8);
    const totalRowW = spacing * totalButtons;
    const startX = leftMargin + spacing / 2 + (availableW - totalRowW) / 2;
    const x = startX + index * spacing;
    const btn = this.makeButton(x, 676, w, 78, () => {
      if (this.ended || this.modal) return;
      if (!def.enabled()) {
        playShopErrorSound();
        return this.toast(this.reason(def.texts().tiny));
      }
      if ((def.gem ? this.gems : this.coins) < def.cost()) {
        playShopErrorSound();
        return this.toast(def.gem ? 'Not enough gems!' : 'Not enough coins!');
      }
      playShopBuySound();
      def.buy();
      this.refreshUi();
    });
    const img = this.add.image(-w / 2 + 22, -4, icon).setScale(iconScale);
    const t = (dx: number, dy: number, size: number, color: string) => this.add.text(dx, dy, '', { fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color }).setOrigin(0.5);
    const tt = t(10, -22, totalButtons > 7 ? 12 : 13, '#4a2c12');
    tt.setText(title);
    const sub = t(10, -3, 16, '#7a4a22');
    const tiny = t(0, 26, totalButtons > 7 ? 11 : 12, '#5a3a1c');
    btn.c.add([img, tt, sub, tiny]);
    this.shops.push({ btn, icon: img, title: tt, sub, tiny, ...def });
  }

  private reason(tiny: string) {
    if (tiny.includes('Needs Falcon')) {
      return 'You need a baby-eating predator (like Peregrine Falcon) to spawn feeder chicks!';
    }
    if (tiny.includes('Active') || tiny.includes('1:1')) {
      return '1:1 ratio reached: Wait for your carnivores to eat existing feeder chicks!';
    }
    return tiny;
  }

  sacredPhoenixRitual(candidate: Bird) {
    this.toast('Sacrificing King Songbird to the Sacred Pyre...');

    // Create glowing pyre altar at top center
    const pyre = this.add.image(W / 2, 175, 'pyre_altar').setScale(1.6).setDepth(25);
    this.tweens.add({ targets: pyre, scale: 1.8, duration: 600, yoyo: true, repeat: 2 });

    // Stop bird from wandering and fly to the pyre
    candidate.leaveSpot();
    candidate.state = 'wander';

    this.tweens.add({
      targets: candidate.spr,
      x: W / 2,
      y: 165,
      duration: 1200,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        // Swirling flame particles and screenshake
        this.cameras.main.shake(350, 0.007);
        for (let i = 0; i < 28; i++) {
          this.burst(W / 2, 165, [0xff5722, 0xffd700, 0xffa000, 0xffffff][i % 4], 16);
        }

        // King Songbird dies in the holy flames
        candidate.dead = true;
        candidate.shadow?.destroy();
        candidate.spr.destroy();
        this.birds = this.birds.filter((b) => b !== candidate);
        this.floatText(W / 2, 135, '🔥 KING SACRIFICED! 🔥', '#ef4444', '#450a0a');

        this.time.delayedCall(400, () => {
          // REBORN AS PHOENIX!
          const phoenix = new Bird(this, W / 2, 160, 3, false, true, 'phoenix');
          this.birds.push(phoenix);
          unlockAchievement('phoenix_rising', this);

          this.burst(W / 2, 160, 0xffd54f, 30);
          this.burst(W / 2, 160, 0xff5722, 24);
          this.floatText(W / 2, 105, '🔥 REBORN AS A PHOENIX! 🔥', '#ffd54f', '#d84315');
          this.toast('The King Songbird gave its life and rose from the ashes as the Golden Phoenix!');

          // Immediate solar ember drop
          this.dropCoin(W / 2, 185, 200, 'drop_solar_ember');
          this.refreshUi();
        });

        // Fade out pyre altar
        this.tweens.add({
          targets: pyre,
          alpha: 0,
          scale: 0.8,
          delay: 800,
          duration: 900,
          onComplete: () => pyre.destroy(),
        });
      },
    });
  }

  private buildToolbar() {
    const bar = this.add.graphics().setDepth(50);
    bar.fillStyle(0x5b3a21, 1);
    bar.fillRect(0, BAR_Y, W, H - BAR_Y);
    bar.fillStyle(0x8a5a33, 1);
    bar.fillRect(0, BAR_Y, W, 6);
    bar.lineStyle(2, 0x4a2e19, 0.6);
    for (let i = 0; i < 6; i++) bar.lineBetween(0, BAR_Y + 22 + i * 14, W, BAR_Y + 22 + i * 14);

    if (this.sandbox) {
      const gBox = this.add.container(85, 676).setDepth(55);
      const gbg = this.add.graphics();
      gbg.fillStyle(0x0f172a, 0.94);
      gbg.fillRoundedRect(-68, -24, 136, 48, 14);
      gbg.lineStyle(2, 0xd4a034, 1);
      gbg.strokeRoundedRect(-68, -24, 136, 48, 14);
      const gIcon = this.add.image(-42, 0, 'gem').setScale(1.15);
      this.gemText = this.add.text(-20, 0, this.gems.toLocaleString(), {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#7df9ff',
        stroke: '#073763',
        strokeThickness: 3,
      }).setOrigin(0, 0.5);
      gBox.add([gbg, gIcon, this.gemText]);
      gBox.setSize(136, 48).setInteractive({ useHandCursor: true });
      gBox.on('pointerdown', () => this.openGemModal());

      this.sandboxShops();
      return;
    }

    const cBox = this.add.container(85, 676).setDepth(55);
    const cbg = this.add.graphics();
    cbg.fillStyle(0x27170c, 0.94);
    cbg.fillRoundedRect(-68, -24, 136, 48, 14);
    cbg.lineStyle(2, 0xffa726, 0.95);
    cbg.strokeRoundedRect(-68, -24, 136, 48, 14);
    const cIcon = this.add.image(-42, 0, 'currency_dollar').setScale(0.95);
    this.coinText = this.add.text(-20, 0, '0', {
      fontFamily: FONT,
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#fff3c4',
      stroke: '#3a2412',
      strokeThickness: 4,
    }).setOrigin(0, 0.5);
    cBox.add([cbg, cIcon, this.coinText]);

    const ws = getWorldAndStage(this.level);
    const worldId = ws.worldId;

    // Total buttons:
    // World 1: 5 buttons (Quality, More Food, Sparrow, Slingshot, Egg)
    // World 2: 6 buttons (Quality, More Food, Sparrow, Piranha, Slingshot, Egg)
    // World 3: 7 buttons (Quality, More Food, Sparrow, Mama, Piranha, Slingshot, Egg)
    // World 4: 8 buttons (Quality, More Food, Sparrow, Mama, Piranha, Phoenix, Slingshot, Egg)
    const hasEgg = !this.timeTrial && !this.challengeId;
    const baseCount = worldId === 1 ? 4 : worldId === 2 ? 5 : worldId === 3 ? 6 : 7;
    const totalButtons = baseCount + (hasEgg ? 1 : 0);

    let idx = 0;

    // Slot 0: Food Quality
    this.addShop(idx++, 'Food Quality', 'seed', 1.5, {
      cost: () => QUALITY_COST[this.quality - 1] ?? 0,
      enabled: () => this.quality < 3,
      texts: () => ({ sub: this.quality < 3 ? String(QUALITY_COST[this.quality - 1]) : 'MAX', tiny: this.quality < 3 ? `Level ${this.quality}/3` : 'Best food!', icon: FOOD_TEX[this.quality - 1] }),
      buy: () => {
        this.coins -= QUALITY_COST[this.quality - 1];
        this.quality++;
        if (this.sandbox) this.saveSandbox();
      },
    }, totalButtons);

    // Slot 1: More Food
    this.addShop(idx++, 'More Food', 'seed', 1.5, {
      cost: () => QUANTITY_COST[this.maxFood - 1] ?? 0,
      enabled: () => this.maxFood < 5,
      texts: () => ({ sub: this.maxFood < 5 ? String(QUANTITY_COST[this.maxFood - 1]) : 'MAX', tiny: `Drop up to ${this.maxFood}/5` }),
      buy: () => {
        this.coins -= QUANTITY_COST[this.maxFood - 1];
        this.maxFood++;
        if (this.sandbox) this.saveSandbox();
      },
    }, totalButtons);

    // Slot 2: Baby Sparrow
    this.addShop(idx++, 'Baby Bird', 'bird_sparrow_0', 0.55, {
      cost: () => 35,
      enabled: () => true,
      texts: () => ({ sub: '35', tiny: 'Grows up!' }),
      buy: () => {
        this.coins -= 35;
        this.birds.push(new Bird(this, Phaser.Math.Between(100, 600), -40, 0, false, false, 'sparrow'));
      },
    }, totalButtons);

    // Slot 3 in World 3+: Mama Songbird (Breeder)
    if (worldId >= 3) {
      this.addShop(idx++, 'Mama Songbird', 'bird_mama', 0.5, {
        cost: () => 200,
        enabled: () => true,
        texts: () => ({ sub: '200', tiny: 'Lays songbird eggs' }),
        buy: () => {
          this.coins -= 200;
          this.birds.push(new Bird(this, Phaser.Math.Between(100, 600), -40, 2, true, false, 'mama'));
        },
      }, totalButtons);
    }

    // Slot in World 2+: Peregrine Falcon (Carnivore Raptor)
    if (worldId >= 2) {
      this.addShop(idx++, 'Peregrine Falcon', 'bird_piranha_finch', 0.5, {
        cost: () => 400,
        enabled: () => true,
        texts: () => ({ sub: '400', tiny: 'Hunts chicks -> Diamond' }),
        buy: () => {
          this.coins -= 400;
          this.birds.push(new Bird(this, Phaser.Math.Between(100, 600), -40, 2, false, false, 'piranha_finch'));
        },
      }, totalButtons);
    }

    // Slot in World 4: Sugar Glider (Gliding non-bird that drops Cinder Acorns)
    if (worldId >= 4) {
      this.addShop(idx++, 'Sugar Glider', 'sugar_glider_icon', 0.95, {
        cost: () => 450,
        enabled: () => true,
        texts: () => ({
          sub: '450',
          tiny: 'Drops Cinder Acorns',
        }),
        buy: () => {
          this.coins -= 450;
          const sg = new SugarGlider(this, Phaser.Math.Between(150, W - 150), 120);
          this.gliders.push(sg);
          this.toast('🐿️ Sugar Glider joined! Cinder Acorns burn chicks, but rebirth adults into Phoenixes!');
        },
      }, totalButtons);
    }

    // Weapon Upgrade: Stick (Tier 0) -> Slingshot (Tier 1) -> Bow (Tier 2) -> Rifle (Tier 3) -> Laser (Tier 4)
    const initialWeaponTex = this.weapon < WEAPON_COST.length ? WEAPON_TEX[this.weapon + 1] : WEAPON_TEX[4];
    const initialWeaponName = this.weapon < WEAPON_COST.length ? WEAPON_NAMES[this.weapon + 1] : WEAPON_NAMES[4];

    this.addShop(idx++, initialWeaponName, initialWeaponTex, 0.85, {
      cost: () => WEAPON_COST[this.weapon] ?? 0,
      enabled: () => this.weapon < WEAPON_COST.length,
      texts: () => {
        const canUpgrade = this.weapon < WEAPON_COST.length;
        const nextName = canUpgrade ? WEAPON_NAMES[this.weapon + 1] : WEAPON_NAMES[4];
        const nextTex = canUpgrade ? WEAPON_TEX[this.weapon + 1] : WEAPON_TEX[4];
        return {
          title: nextName,
          sub: canUpgrade ? String(WEAPON_COST[this.weapon]) : 'MAX',
          tiny: canUpgrade ? `Damage ${WEAPON_DMG[this.weapon + 1]}` : 'Max Power!',
          icon: nextTex,
        };
      },
      buy: () => {
        const cost = WEAPON_COST[this.weapon];
        this.coins -= cost;
        this.weapon++;
        if (this.weapon >= 4) {
          unlockAchievement('weapon_master', this);
        }
        if (this.sandbox) this.saveSandbox();
        playWeaponSound(this.weapon);
        this.toast(`Upgraded to ${WEAPON_NAMES[this.weapon]}! (${WEAPON_DMG[this.weapon]} damage)`);
      },
    }, totalButtons);

    // Single progressive Egg Piece (Campaign only, not Time Trial or Challenge)
    if (hasEgg) {
      this.addShop(idx++, 'Egg', 'egg', 1.0, {
        cost: () => eggPieceCost(this.level, this.eggs),
        enabled: () => this.eggs < 3,
        texts: () => {
          const cost = eggPieceCost(this.level, this.eggs);
          return {
            sub: this.eggs >= 3 ? 'Hatched!' : String(cost),
            tiny: this.eggs >= 3 ? 'Victory!' : `Piece ${this.eggs + 1}/3`,
            icon: this.eggs >= 2 ? 'goldegg' : 'egg',
          };
        },
        buy: () => {
          const cost = eggPieceCost(this.level, this.eggs);
          this.coins -= cost;
          this.eggs++;
          playEggPieceSound(this.eggs);
          this.burst(W / 2, H / 2, 0xffd700, 16);
          if (this.eggs < 3) {
            this.toast(`Egg piece ${this.eggs}/3 acquired!`);
          } else {
            this.toast('Egg completed! Hatching pet helper!');
            this.win();
          }
        },
      }, totalButtons);
    }
  }

  private sandboxShops() {
    const totalButtons = 9;
    let idx = 0;

    // 0: Food Quality (15 Gems)
    this.addShop(idx++, 'Food Quality', 'seed', 1.4, {
      cost: () => 15,
      gem: true,
      enabled: () => this.quality < 3,
      texts: () => ({
        sub: this.quality < 3 ? '15' : 'MAX',
        tiny: this.quality < 3 ? `Tier ${this.quality}/3` : 'Best Food!',
        icon: FOOD_TEX[this.quality - 1],
      }),
      buy: () => {
        this.gems -= 15;
        this.quality++;
        this.saveSandbox();
        this.toast(`Food Quality upgraded to Tier ${this.quality}!`);
      },
    }, totalButtons);

    // 1: More Food (15 Gems)
    this.addShop(idx++, 'More Food', 'seed', 1.4, {
      cost: () => 15,
      gem: true,
      enabled: () => this.maxFood < 5,
      texts: () => ({
        sub: this.maxFood < 5 ? '15' : 'MAX',
        tiny: `Drop ${this.maxFood}/5 Seeds`,
      }),
      buy: () => {
        this.gems -= 15;
        this.maxFood++;
        this.saveSandbox();
        this.toast(`Max seeds increased to ${this.maxFood}!`);
      },
    }, totalButtons);

    // 2: Bird Shop (opens the 3 daily rotating birds modal!)
    this.addShop(idx++, 'Bird Shop', 'bird_sparrow', 0.5, {
      cost: () => 0,
      gem: true,
      enabled: () => true,
      texts: () => ({
        sub: 'STORE',
        tiny: 'Emporium',
      }),
      buy: () => {
        this.openPetStoreModal();
      },
    }, totalButtons);

    // 3: Feeder Chick (FREE - 1:1 ratio with baby-eating predators like Peregrine Falcon)
    this.addShop(idx++, 'Feeder Chick', 'bird_sparrow_0', 0.55, {
      cost: () => 0,
      gem: false,
      enabled: () => {
        const predatorCount = this.birds.filter(
          (b) => !b.dead && !b.isFeeder && b.species.behavior === 'carnivore'
        ).length;
        const activeFeeders = this.birds.filter((b) => !b.dead && b.isFeeder).length;
        return predatorCount > 0 && activeFeeders < predatorCount;
      },
      texts: () => {
        const predatorCount = this.birds.filter(
          (b) => !b.dead && !b.isFeeder && b.species.behavior === 'carnivore'
        ).length;
        const activeFeeders = this.birds.filter((b) => !b.dead && b.isFeeder).length;
        if (predatorCount === 0) {
          return {
            sub: 'FREE',
            tiny: 'Needs Falcon',
          };
        }
        if (activeFeeders >= predatorCount) {
          return {
            sub: '1:1 MAX',
            tiny: `${activeFeeders}/${predatorCount} Active`,
          };
        }
        return {
          sub: 'FREE',
          tiny: `${activeFeeders}/${predatorCount} Ready`,
        };
      },
      buy: () => {
        const predatorCount = this.birds.filter(
          (b) => !b.dead && !b.isFeeder && b.species.behavior === 'carnivore'
        ).length;
        const activeFeeders = this.birds.filter((b) => !b.dead && b.isFeeder).length;
        if (predatorCount === 0) {
          return this.toast('You need a baby-eating predator (like Peregrine Falcon) to spawn feeder chicks!');
        }
        if (activeFeeders >= predatorCount) {
          return this.toast(`1:1 Ratio: Wait for your ${predatorCount} carnivore${predatorCount > 1 ? 's' : ''} to feed!`);
        }
        const chick = new Bird(this, Phaser.Math.Between(150, W - 150), -30, 0, false, false, 'sparrow', true);
        this.birds.push(chick);
        this.saveSandbox();
        this.refreshUi();
        this.toast(`Spawned Free Feeder Chick! (${activeFeeders + 1}/${predatorCount})`);
      },
    }, totalButtons);

    // 4: Bird Setup (opens the 20-porthole dossier modal with Rename/Hide/Sell)
    this.addShop(idx++, 'Bird Setup', 'crown', 0.75, {
      cost: () => 0,
      gem: true,
      enabled: () => true,
      texts: () => {
        const petCount = this.birds.filter((b) => !b.isFeeder && !b.dead).length;
        return {
          sub: 'SETUP',
          tiny: `${petCount} Registered`,
        };
      },
      buy: () => {
        this.openBirdSetupModal();
      },
    }, totalButtons);

    // 5: Companions (opens the 3-pet limit roster modal)
    this.addShop(idx++, 'Companions', 'pet_snail', 0.7, {
      cost: () => 0,
      gem: true,
      enabled: () => true,
      texts: () => ({
        sub: `${this.petKeys.length}/3`,
        tiny: 'Active Pets',
      }),
      buy: () => {
        this.openPetSelectionModal();
      },
    }, totalButtons);

    // 6: Growth Tonic (5 Gems - instantly grows an immature bird to the next stage!)
    this.addShop(idx++, 'Growth Tonic', 'potion', 1.0, {
      cost: () => 5,
      gem: true,
      enabled: () => this.birds.some((b) => !b.isFeeder && b.stage < 2 && !b.dead),
      texts: () => {
        const canGrow = this.birds.some((b) => !b.isFeeder && b.stage < 2 && !b.dead);
        return {
          sub: '5',
          tiny: canGrow ? 'Grow 1 Bird' : 'All Adults',
        };
      },
      buy: () => {
        const candidates = this.birds.filter((b) => !b.isFeeder && b.stage < 2 && !b.dead);
        if (candidates.length === 0) return this.toast('All birds are already fully grown adults!');
        this.gems -= 5;
        const target = Phaser.Utils.Array.GetRandom(candidates);
        target.growNow();
        this.burst(target.spr.x, target.spr.y, 0x00f0ff, 18);
        this.saveSandbox();
        this.toast(`${target.name || target.species.name} drank Growth Tonic and grew!`);
      },
    }, totalButtons);

    // 7: Wallpapers / Themes (opens themes modal)
    this.addShop(idx++, 'Wallpapers', 'chest', 0.8, {
      cost: () => 0,
      gem: true,
      enabled: () => true,
      texts: () => ({
        sub: 'THEMES',
        tiny: 'Themes & Music',
      }),
      buy: () => {
        this.openThemesModal();
      },
    }, totalButtons);

    // 8: Terrarium Level Designer
    this.addShop(idx++, 'Designer', 'crown', 0.8, {
      cost: () => 0,
      gem: true,
      enabled: () => true,
      texts: () => ({
        sub: 'DESIGN',
        tiny: 'Trees & Decor',
      }),
      buy: () => {
        this.levelDesigner.open();
      },
    }, totalButtons);
  }

  openPetSelectionModal() {
    this.modal = true;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(80).setInteractive();
    this.modalItems.push(shade);

    const pw = 920;
    const ph = 580;
    const panel = this.add.graphics().setDepth(81);
    panel.fillStyle(0x22140a, 1);
    panel.fillRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    panel.lineStyle(5, 0xd4a034, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    this.modalItems.push(panel);

    const title = this.add.text(W / 2, H / 2 - ph / 2 + 36, 'COMPANION ROSTER (MAX 3)', {
      fontFamily: FONT,
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffdd77',
      stroke: '#1a0d05',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(82);
    this.modalItems.push(title);

    const unlocked = getUnlockedPets(loadSave().level);
    const activeKeys = [...this.petKeys];

    const cols = 4;
    const cardW = 195;
    const cardH = 105;
    const startX = W / 2 - 325;
    const startY = H / 2 - 170;

    const cards: Phaser.GameObjects.Container[] = [];

    const redrawCards = () => {
      cards.forEach((c) => c.destroy());
      cards.length = 0;

      unlocked.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = startX + col * 215;
        const cy = startY + row * 120;
        const c = this.add.container(cx, cy).setDepth(82);
        const isActive = activeKeys.includes(p.key);

        const bg = this.add.graphics();
        bg.fillStyle(isActive ? 0x2e1a47 : 0x3d2715, 1);
        bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
        bg.lineStyle(2.5, isActive ? 0xffd54f : 0x8a5b23, 1);
        bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);

        const img = this.add.image(-cardW / 2 + 34, 0, 'pet_' + p.key).setScale(0.85);
        const name = this.add.text(-cardW / 2 + 70, -32, p.name, {
          fontFamily: FONT,
          fontSize: '15px',
          fontStyle: 'bold',
          color: isActive ? '#ffea75' : '#ffffff',
        });
        const role = this.add.text(-cardW / 2 + 70, -12, p.role, {
          fontFamily: FONT,
          fontSize: '11px',
          color: '#ffd54f',
        });
        const status = this.add.text(-cardW / 2 + 70, 16, isActive ? '✓ ACTIVE' : '+ SELECT', {
          fontFamily: FONT,
          fontSize: '12px',
          fontStyle: 'bold',
          color: isActive ? '#86efac' : '#cbd5e1',
        });

        c.add([bg, img, name, role, status]);
        c.setSize(cardW, cardH).setInteractive({ useHandCursor: true });
        c.on('pointerdown', () => {
          if (isActive) {
            const pos = activeKeys.indexOf(p.key);
            activeKeys.splice(pos, 1);
          } else {
            if (activeKeys.length >= 3) {
              return this.toast('Maximum 3 companions allowed! Deselect one first.');
            }
            activeKeys.push(p.key);
          }
          redrawCards();
        });

        cards.push(c);
        this.modalItems.push(c);
      });
    };
    redrawCards();

    // Confirm button
    const confirmBtn = this.add.container(W / 2, H / 2 + ph / 2 - 40).setDepth(83);
    const cbg = this.add.graphics();
    cbg.fillStyle(0x6a1b9a, 1);
    cbg.fillRoundedRect(-120, -22, 240, 44, 22);
    cbg.lineStyle(3, 0xffd54f, 1);
    cbg.strokeRoundedRect(-120, -22, 240, 44, 22);
    const ctxt = this.add.text(0, 0, 'SAVE COMPANIONS', {
      fontFamily: FONT,
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffea75',
      stroke: '#240733',
      strokeThickness: 3,
    }).setOrigin(0.5);
    confirmBtn.add([cbg, ctxt]);
    confirmBtn.setSize(240, 44).setInteractive({ useHandCursor: true });
    confirmBtn.on('pointerdown', () => {
      this.petKeys = activeKeys.slice(0, 3);
      this.pets.forEach((p) => p.destroy());
      this.pets = [];
      for (const k of this.petKeys) {
        if (k === 'nightingale') this.spots[5].reserved = true;
        this.pets.push(new Pet(this, k));
      }
      this.saveSandbox();
      this.toast('Active companions updated!');
      this.closeModal();
    });
    this.modalItems.push(confirmBtn);

    const closeBtn = this.add.container(W / 2 + pw / 2 - 32, H / 2 - ph / 2 + 32).setDepth(83);
    const clbg = this.add.graphics();
    clbg.fillStyle(0xb71c1c, 1);
    clbg.fillCircle(0, 0, 18);
    const clx = this.add.text(0, 0, '✕', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    closeBtn.add([clbg, clx]);
    closeBtn.setSize(36, 36).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeModal());
    this.modalItems.push(closeBtn);
  }

  openFeedModal() {
    this.modal = true;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(80).setInteractive();
    this.modalItems.push(shade);

    const pw = 740;
    const ph = 480;
    const panel = this.add.graphics().setDepth(81);
    panel.fillStyle(0x22140a, 1);
    panel.fillRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    panel.lineStyle(5, 0xd4a034, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    this.modalItems.push(panel);

    const title = this.add.text(W / 2, H / 2 - ph / 2 + 36, 'FEED & FLOCK SUPPLIES', {
      fontFamily: FONT,
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffdd77',
      stroke: '#1a0d05',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(82);
    this.modalItems.push(title);

    // Food Quality Card
    const qCard = this.add.container(W / 2 - 180, H / 2 - 40).setDepth(82);
    const qbg = this.add.graphics();
    qbg.fillStyle(0x3a2312, 1);
    qbg.fillRoundedRect(-110, -110, 220, 220, 16);
    qbg.lineStyle(2.5, 0xd4a034, 1);
    qbg.strokeRoundedRect(-110, -110, 220, 220, 16);
    const qIcon = this.add.image(0, -45, FOOD_TEX[this.quality - 1]).setScale(2.0);
    const qTitle = this.add.text(0, 0, 'Food Quality', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const qLevel = this.add.text(0, 25, `Level ${this.quality}/3 (${['Seeds', 'Corn', 'Berries'][this.quality - 1]})`, { fontFamily: FONT, fontSize: '13px', color: '#ffd54f' }).setOrigin(0.5);
    const qBtn = this.add.graphics();
    qBtn.fillStyle(this.quality < 3 ? 0x6a1b9a : 0x555555, 1);
    qBtn.fillRoundedRect(-80, 50, 160, 36, 18);
    const qBtnTxt = this.add.text(0, 68, this.quality < 3 ? 'UPGRADE (15💎)' : 'MAX LEVEL', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffea75' }).setOrigin(0.5);
    qCard.add([qbg, qIcon, qTitle, qLevel, qBtn, qBtnTxt]);
    qCard.setSize(220, 220).setInteractive({ useHandCursor: this.quality < 3 });
    qCard.on('pointerdown', () => {
      if (this.quality >= 3) return;
      if (this.gems < 15) return this.toast('Need 15 Gems! Visit Store or Gem Store.');
      this.gems -= 15;
      this.quality++;
      this.saveSandbox();
      this.refreshUi();
      this.closeModal();
      this.toast(`Upgraded Food Quality to Level ${this.quality}!`);
    });
    this.modalItems.push(qCard);

    // Food Quantity Card
    const mCard = this.add.container(W / 2 + 180, H / 2 - 40).setDepth(82);
    const mbg = this.add.graphics();
    mbg.fillStyle(0x3a2312, 1);
    mbg.fillRoundedRect(-110, -110, 220, 220, 16);
    mbg.lineStyle(2.5, 0xd4a034, 1);
    mbg.strokeRoundedRect(-110, -110, 220, 220, 16);
    const mIcon = this.add.image(0, -45, 'seed').setScale(2.0);
    const mTitle = this.add.text(0, 0, 'Max Food Drops', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const mLevel = this.add.text(0, 25, `Capacity: ${this.maxFood}/5 Seeds`, { fontFamily: FONT, fontSize: '13px', color: '#ffd54f' }).setOrigin(0.5);
    const mBtn = this.add.graphics();
    mBtn.fillStyle(this.maxFood < 5 ? 0x6a1b9a : 0x555555, 1);
    mBtn.fillRoundedRect(-80, 50, 160, 36, 18);
    const mBtnTxt = this.add.text(0, 68, this.maxFood < 5 ? 'UPGRADE (15💎)' : 'MAX CAPACITY', { fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffea75' }).setOrigin(0.5);
    mCard.add([mbg, mIcon, mTitle, mLevel, mBtn, mBtnTxt]);
    mCard.setSize(220, 220).setInteractive({ useHandCursor: this.maxFood < 5 });
    mCard.on('pointerdown', () => {
      if (this.maxFood >= 5) return;
      if (this.gems < 15) return this.toast('Need 15 Gems! Visit Store or Gem Store.');
      this.gems -= 15;
      this.maxFood++;
      this.saveSandbox();
      this.refreshUi();
      this.closeModal();
      this.toast(`Max food capacity increased to ${this.maxFood}!`);
    });
    this.modalItems.push(mCard);

    // Feeder Chick Row (1:1 Ratio with Baby-Eating Carnivore Predators, FREE 0💎)
    const predatorBirds = this.birds.filter(
      (b) => !b.dead && !b.isFeeder && b.species.behavior === 'carnivore'
    );
    const predatorCount = predatorBirds.length;
    const activeFeeders = this.birds.filter((b) => !b.dead && b.isFeeder).length;
    const canSpawn = predatorCount > 0 && activeFeeders < predatorCount;

    const feederBtn = this.add.container(W / 2, H / 2 + 130).setDepth(82);
    const fbg = this.add.graphics();
    fbg.fillStyle(canSpawn ? 0x27170c : 0x1c1917, 1);
    fbg.fillRoundedRect(-210, -22, 420, 44, 22);
    fbg.lineStyle(2, canSpawn ? 0xd4a034 : 0x44403c, 1);
    fbg.strokeRoundedRect(-210, -22, 420, 44, 22);

    let feederLabel = `🐣 Spawn Free Feeder Chick (${activeFeeders}/${predatorCount} Active - FREE)`;
    if (predatorCount === 0) {
      feederLabel = '🐣 Feeder Chick (Requires Baby-Eating Predator in Aviary)';
    } else if (activeFeeders >= predatorCount) {
      feederLabel = `🐣 Feeder Limit Reached (${activeFeeders}/${predatorCount} 1:1 Ratio)`;
    }

    const ftxt = this.add.text(0, 0, feederLabel, {
      fontFamily: FONT,
      fontSize: '13px',
      fontStyle: 'bold',
      color: canSpawn ? '#ffea75' : '#78716c',
    }).setOrigin(0.5);
    feederBtn.add([fbg, ftxt]);
    feederBtn.setSize(420, 44).setInteractive({ useHandCursor: canSpawn });
    feederBtn.on('pointerdown', () => {
      if (!canSpawn) {
        if (predatorCount === 0) {
          this.toast('You need a baby-eating predator (like Peregrine Falcon) to spawn feeder chicks!');
        } else {
          this.toast(`1:1 ratio: Wait for your carnivores to eat the active feeder chicks (${activeFeeders}/${predatorCount})!`);
        }
        return;
      }
      // FREE! 0 gems!
      const chick = new Bird(this, Phaser.Math.Between(150, 750), -40, 0, false, false, 'sparrow', true);
      this.birds.push(chick);
      this.saveSandbox();
      this.refreshUi();
      this.toast(`Feeder chick arrived! (${activeFeeders + 1}/${predatorCount} for carnivore birds)`);
      this.closeModal();
    });
    this.modalItems.push(feederBtn);

    // Close button
    const closeBtn = this.add.container(W / 2 + pw / 2 - 32, H / 2 - ph / 2 + 32).setDepth(83);
    const cbg = this.add.graphics();
    cbg.fillStyle(0xb71c1c, 1);
    cbg.fillCircle(0, 0, 18);
    const cx = this.add.text(0, 0, '✕', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    closeBtn.add([cbg, cx]);
    closeBtn.setSize(36, 36).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeModal());
    this.modalItems.push(closeBtn);
  }

  openThemesModal() {
    this.modal = true;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(80).setInteractive();
    this.modalItems.push(shade);

    const pw = 800;
    const ph = 480;
    const panel = this.add.graphics().setDepth(81);
    panel.fillStyle(0x22140a, 1);
    panel.fillRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    panel.lineStyle(5, 0xd4a034, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    this.modalItems.push(panel);

    const title = this.add.text(W / 2, H / 2 - ph / 2 + 36, 'AVIARY WALLPAPERS', {
      fontFamily: FONT,
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffdd77',
      stroke: '#1a0d05',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(82);
    this.modalItems.push(title);

    const themeDefs = [
      { name: 'Sunny Meadow', level: 1, desc: 'Lush green hills and bright sunny sky' },
      { name: 'Rainforest Canopy', level: 5, desc: 'Deep emerald jungle mist and vibrant flora' },
      { name: 'Blossom Sanctuary', level: 9, desc: 'Sweet cherry blossoms and pastel dawn' },
      { name: 'Volcanic Peaks', level: 13, desc: 'Fiery glowing skies and dramatic mountain crags' },
    ];

    themeDefs.forEach((td, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = W / 2 - 180 + col * 360;
      const cy = H / 2 - 60 + row * 150;

      const card = this.add.container(cx, cy).setDepth(82);
      const bg = this.add.graphics();
      const isCurrent = Math.floor((this.level - 1) / 4) === Math.floor((td.level - 1) / 4);

      bg.fillStyle(isCurrent ? 0x2e1a47 : 0x3d2715, 1);
      bg.fillRoundedRect(-160, -55, 320, 110, 14);
      bg.lineStyle(2.5, isCurrent ? 0xffd54f : 0x8a5b23, 1);
      bg.strokeRoundedRect(-160, -55, 320, 110, 14);

      const name = this.add.text(-140, -38, td.name, {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: isCurrent ? '#ffea75' : '#ffffff',
      });
      const desc = this.add.text(-140, -10, td.desc, {
        fontFamily: FONT,
        fontSize: '12px',
        color: '#d4c0aa',
        wordWrap: { width: 280 },
      });
      const badge = this.add.text(-140, 24, isCurrent ? '✓ CURRENT THEME' : 'TAP TO APPLY', {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: isCurrent ? '#86efac' : '#ffd54f',
      });

      card.add([bg, name, desc, badge]);
      card.setSize(320, 110).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        this.level = td.level;
        this.saveSandbox();
        this.toast(`Applied ${td.name} wallpaper!`);
        this.closeModal();
        this.scene.restart({ sandbox: true, level: td.level });
      });

      this.modalItems.push(card);
    });

    const closeBtn = this.add.container(W / 2 + pw / 2 - 32, H / 2 - ph / 2 + 32).setDepth(83);
    const cbg = this.add.graphics();
    cbg.fillStyle(0xb71c1c, 1);
    cbg.fillCircle(0, 0, 18);
    const cx = this.add.text(0, 0, '✕', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    closeBtn.add([cbg, cx]);
    closeBtn.setSize(36, 36).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeModal());
    this.modalItems.push(closeBtn);
  }

  saveSandbox() {
    if (!this.sandbox) return;
    const list: SavedBird[] = this.birds
      .filter((b) => !b.isFeeder && !b.dead)
      .map((b) => ({
        stage: b.stage,
        units: b.units,
        mama: b.isBreeder,
        rare: b.rare,
        species: b.species.key,
        name: b.name || undefined,
        hidden: b.hidden || undefined,
        hometown: b.hometown,
        purchaseDate: b.purchaseDate,
        mentalState: b.mentalState,
        additionalNotes: b.additionalNotes,
      }));
    patchSave({
      gems: this.gems,
      sandbox: {
        birds: list,
        pets: this.petKeys.slice(0, 3),
        quality: this.quality,
        maxFood: this.maxFood,
        weapon: this.weapon,
        wallpaper: this.level,
      },
    });
  }

  nearestPrey(x: number, y: number, hunter: Bird): Bird | undefined {
    let best: Bird | undefined;
    let bd = Infinity;
    for (const b of this.birds) {
      if (b === hunter || b.dead) continue;
      // In Sandbox mode, predators specifically target feeder birds to protect permanent pets!
      if (this.sandbox && !b.isFeeder) continue;

      if (hunter.species.behavior === 'apex') {
        // Apex hunts carnivores or feeder birds
        if (b.species.behavior === 'carnivore' || b.stage >= 1 || b.isFeeder) {
          const d = Phaser.Math.Distance.Between(x, y, b.spr.x, b.spr.y);
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
      } else if (hunter.species.behavior === 'carnivore') {
        // Falcon (carnivore) strictly hunts ONLY baby chicks (stage === 0)!
        // Never adult birds, medium birds, breeders, or fellow carnivores!
        if (b.stage === 0 && !b.isBreeder && b.species.behavior !== 'carnivore') {
          const d = Phaser.Math.Distance.Between(x, y, b.spr.x, b.spr.y);
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
      }
    }
    return best;
  }

  eatPrey(hunter: Bird, prey: Bird) {
    if (hunter.species.behavior === 'carnivore' && prey.stage !== 0) {
      return; // Safety guard: Falcon strictly only eats baby chicks (stage 0)
    }
    if (hunter.species.behavior === 'carnivore') {
      unlockAchievement('falcon_feeder', this);
    }
    this.killBird(prey, 'eaten');
    hunter.fullness = 100;
    this.burst(prey.spr.x, prey.spr.y, 0x0b5394, 18);
    if (this.sandbox) {
      if (hunter.species.behavior === 'apex') {
        this.dropGem(hunter.spr.x, hunter.spr.y, 15, 'chest');
        this.floatText(hunter.spr.x, hunter.spr.y - 40, 'APEX CHOMP! +15 Gems', '#ffd700', '#4a3625');
        this.toast(`The Apex ${hunter.species.name} devoured prey and dropped a Gem Chest!`);
      } else {
        this.dropGem(hunter.spr.x, hunter.spr.y, 4, 'gem_diamond');
        this.floatText(hunter.spr.x, hunter.spr.y - 40, 'CHOMP! +4 Gems', '#00f0ff', '#073763');
        this.toast(`The ${hunter.species.name} hunted a chick and dropped a Diamond Gem!`);
      }
    } else {
      if (hunter.species.behavior === 'apex') {
        this.dropCoin(hunter.spr.x, hunter.spr.y, 1000 * (hunter.rare ? 2 : 1));
        this.floatText(hunter.spr.x, hunter.spr.y - 40, 'APEX CHOMP! +1000', '#ffd700', '#4a3625');
      } else {
        this.dropCoin(hunter.spr.x, hunter.spr.y, 200 * (hunter.rare ? 2 : 1));
        this.floatText(hunter.spr.x, hunter.spr.y - 40, 'CHOMP! +Diamond', '#ffd700', '#073763');
      }
      this.toast(`The ${hunter.species.name} hunted a chick and dropped a Diamond!`);
    }
  }

  openPetStoreModal() {
    this.modal = true;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(80).setInteractive();
    this.modalItems.push(shade);

    const pw = 1160;
    const ph = 630;
    const panel = this.add.graphics().setDepth(81);
    // Outer wooden frame with gold inlay
    panel.fillStyle(0x28160a, 1);
    panel.fillRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    panel.lineStyle(5, 0xd4a034, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    panel.lineStyle(2, 0x8a5b23, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2 + 6, H / 2 - ph / 2 + 6, pw - 12, ph - 12, 18);

    // Decorative header ribbon
    panel.fillStyle(0x421f0b, 1);
    panel.fillRoundedRect(W / 2 - 320, H / 2 - ph / 2 + 14, 640, 56, 16);
    panel.lineStyle(3, 0xf1c40f, 1);
    panel.strokeRoundedRect(W / 2 - 320, H / 2 - ph / 2 + 14, 640, 56, 16);
    this.modalItems.push(panel);

    const title = this.add
      .text(W / 2, H / 2 - ph / 2 + 34, 'BIRD EMPORIUM', {
        fontFamily: FONT,
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffdd77',
        stroke: '#1a0d05',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(82);

    const subtitle = this.add
      .text(
        W / 2,
        H / 2 - ph / 2 + 55,
        'Clara\'s Sanctuary Market • Adopt exotic species, brews & biomes for your Aviary',
        { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#ecd7bb' }
      )
      .setOrigin(0.5)
      .setDepth(82);

    this.modalItems.push(title, subtitle);

    // Clara Keeper quotes
    const keeperQuotes = [
      'Welcome to the Bird Emporium! Every species here thrives in your Sanctuary.',
      'Did you know? Peregrine Falcons only hunt feeder chicks, but drop lustrous diamonds!',
      'The Golden Phoenix blesses the entire aviary with sacred 500c Solar Embers!',
      'Great Horned Owls hunt carnivore birds and drop giant gem treasure chests!',
      'The Elixir of Growth immediately matures all young fledglings in your flock!',
      'A new sanctuary wallpaper gives your aviary that majestic wild atmosphere!',
      'Canaries sing uplifting melodies that inspire everyone around them to drop coins!',
    ];
    let quoteIndex = Phaser.Math.Between(0, keeperQuotes.length - 1);

    // Gem Vault display reference for live updates
    const gemVaultBox = this.add.graphics().setDepth(82);
    gemVaultBox.fillStyle(0x1a0f07, 0.95);
    gemVaultBox.fillRoundedRect(W / 2 - 160, H / 2 + ph / 2 - 58, 320, 44, 22);
    gemVaultBox.lineStyle(3, 0xf1c40f, 1);
    gemVaultBox.strokeRoundedRect(W / 2 - 160, H / 2 + ph / 2 - 58, 320, 44, 22);
    this.modalItems.push(gemVaultBox);

    const gemIconMain = this.add.image(W / 2 - 115, H / 2 + ph / 2 - 36, 'gem').setScale(1.1).setDepth(83);
    const gemText = this.add
      .text(W / 2 - 85, H / 2 + ph / 2 - 36, `${this.gems.toLocaleString()} GEMS`, {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffea75',
      })
      .setOrigin(0, 0.5)
      .setDepth(83);
    this.modalItems.push(gemIconMain, gemText);

    // + BUY GEMS Button on bottom-right of bottom bar
    const getGemsBtn = this.add.container(W / 2 + 250, H / 2 + ph / 2 - 36).setDepth(82);
    const ggbg = this.add.graphics();
    ggbg.fillStyle(0x2e7d32, 1);
    ggbg.fillRoundedRect(-70, -20, 140, 40, 20);
    ggbg.lineStyle(2, 0xa5d6a7, 1);
    ggbg.strokeRoundedRect(-70, -20, 140, 40, 20);
    const ggtxt = this.add
      .text(0, 0, '+ GET GEMS', {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    getGemsBtn.add([ggbg, ggtxt]);
    getGemsBtn.setSize(140, 40).setInteractive({ useHandCursor: true });
    getGemsBtn.on('pointerdown', () => this.openGemModal());
    this.modalItems.push(getGemsBtn);

    // Purple BACK button matching Insaniquarium's Fish Emporium
    const backBtn = this.add.container(W / 2 - pw / 2 + 95, H / 2 + ph / 2 - 36).setDepth(82);
    const bbg = this.add.graphics();
    bbg.fillStyle(0x6a1b9a, 1);
    bbg.fillRoundedRect(-75, -22, 150, 44, 22);
    bbg.lineStyle(3.5, 0xffd54f, 1);
    bbg.strokeRoundedRect(-75, -22, 150, 44, 22);
    const btxt = this.add
      .text(0, 0, 'BACK', {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffea75',
        stroke: '#2a0845',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    backBtn.add([bbg, btxt]);
    backBtn.setSize(150, 44).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => {
      bbg.clear();
      bbg.fillStyle(0x8e24aa, 1);
      bbg.fillRoundedRect(-75, -22, 150, 44, 22);
      bbg.lineStyle(3.5, 0xffffff, 1);
      bbg.strokeRoundedRect(-75, -22, 150, 44, 22);
    });
    backBtn.on('pointerout', () => {
      bbg.clear();
      bbg.fillStyle(0x6a1b9a, 1);
      bbg.fillRoundedRect(-75, -22, 150, 44, 22);
      bbg.lineStyle(3.5, 0xffd54f, 1);
      bbg.strokeRoundedRect(-75, -22, 150, 44, 22);
    });
    backBtn.on('pointerdown', () => this.closeModal());
    this.modalItems.push(backBtn);

    // Center Grotto: Clara the Sanctuary Warden & speech bubble
    const claraX = W / 2 - 130;
    const claraY = H / 2 + 70;
    const clara = this.add.image(claraX, claraY, 'emporium_keeper').setScale(1.15).setDepth(82);
    clara.setInteractive({ useHandCursor: true });

    // Speech bubble for Clara
    const bubbleW = 340;
    const bubbleH = 110;
    const bubbleX = claraX + 230;
    const bubbleY = claraY - 15;
    const bubble = this.add.graphics().setDepth(82);
    bubble.fillStyle(0xfffdf6, 1);
    bubble.fillRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 16);
    bubble.lineStyle(3, 0xcaa060, 1);
    bubble.strokeRoundedRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 16);
    // Speech bubble tail
    bubble.fillTriangle(-bubbleW / 2, 10, -bubbleW / 2, -10, -bubbleW / 2 - 18, 0);
    bubble.lineBetween(-bubbleW / 2, -10, -bubbleW / 2 - 18, 0);
    bubble.lineBetween(-bubbleW / 2, 10, -bubbleW / 2 - 18, 0);

    const claraName = this.add
      .text(0, -bubbleH / 2 + 18, 'CLARA THE SANCTUARY WARDEN', {
        fontFamily: FONT,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#a06015',
      })
      .setOrigin(0.5);

    const speechText = this.add
      .text(0, 10, keeperQuotes[quoteIndex], {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#2a1a0f',
        align: 'center',
        wordWrap: { width: bubbleW - 30 },
      })
      .setOrigin(0.5);

    const bubbleCont = this.add.container(bubbleX, bubbleY, [bubble, claraName, speechText]).setDepth(82);
    bubbleCont.setSize(bubbleW, bubbleH).setInteractive({ useHandCursor: true });

    const advanceQuote = () => {
      quoteIndex = (quoteIndex + 1) % keeperQuotes.length;
      speechText.setText(keeperQuotes[quoteIndex]);
      this.tweens.add({
        targets: clara,
        scaleY: 1.25,
        duration: 120,
        yoyo: true,
      });
    };
    clara.on('pointerdown', advanceQuote);
    bubbleCont.on('pointerdown', advanceQuote);
    this.modalItems.push(clara, bubbleCont);

    // Alcove positions map (matching Insaniquarium reference layout):
    // Left column: A (Top-Left), B (Mid-Left), Upgrade (Bottom-Left)
    // Top row: C (Top 1), D (Top 2), E (Top 3), F (Top 4)
    // Bottom-Right: Backdrop
    const slotCoords: Record<string, { x: number; y: number; w: number; h: number }> = {
      A: { x: W / 2 - pw / 2 + 105, y: H / 2 - ph / 2 + 145, w: 165, h: 125 },
      B: { x: W / 2 - pw / 2 + 105, y: H / 2 - ph / 2 + 280, w: 165, h: 125 },
      upgrade: { x: W / 2 - pw / 2 + 105, y: H / 2 - ph / 2 + 415, w: 165, h: 125 },
      C: { x: W / 2 - 275, y: H / 2 - ph / 2 + 145, w: 165, h: 125 },
      D: { x: W / 2 - 95, y: H / 2 - ph / 2 + 145, w: 165, h: 125 },
      E: { x: W / 2 + 85, y: H / 2 - ph / 2 + 145, w: 165, h: 125 },
      F: { x: W / 2 + 265, y: H / 2 - ph / 2 + 145, w: 165, h: 125 },
      backdrop: { x: W / 2 + pw / 2 - 105, y: H / 2 - ph / 2 + 280, w: 175, h: 155 },
    };

    const rarityBadgeColors: Record<string, number> = {
      COMMON: 0x558b2f,
      CARNIVORE: 0xc62828,
      SONGBIRD: 0xf57f17,
      BREEDER: 0x8e24aa,
      LEGENDARY: 0xef6c00,
      APEX: 0x4a148c,
      UPGRADE: 0x00838f,
      WALLPAPER: 0x2e7d32,
    };

    // Render each alcove
    EMPORIUM_SLOTS.forEach((slot) => {
      const pos = slotCoords[slot.id];
      if (!pos) return;

      const card = this.add.container(pos.x, pos.y).setDepth(82);

      // Deep niche / arched alcove
      const badgeKey = slot.badge || 'ITEM';
      const bColor = rarityBadgeColors[badgeKey] ?? 0x558b2f;
      const abg = this.add.graphics();
      abg.fillStyle(0x190d05, 0.95);
      abg.fillRoundedRect(-pos.w / 2, -pos.h / 2, pos.w, pos.h, 14);
      abg.lineStyle(2.5, bColor, 1);
      abg.strokeRoundedRect(-pos.w / 2, -pos.h / 2, pos.w, pos.h, 14);

      // Category / Rarity pill
      const pill = this.add.graphics();
      pill.fillStyle(bColor, 1);
      pill.fillRoundedRect(-pos.w / 2 + 10, -pos.h / 2 + 6, pos.w - 20, 16, 8);
      const bTxt = this.add
        .text(0, -pos.h / 2 + 14, badgeKey, {
          fontFamily: FONT,
          fontSize: '9.5px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5);

      // Item Thumbnail
      const spr = this.add.image(0, -pos.h / 2 + 48, slot.icon);
      if (slot.category === 'bird') {
        spr.setScale(0.85);
        if (slot.speciesKey) {
          const w = this.add.image(-7, -pos.h / 2 + 52, 'wing_' + slot.speciesKey).setScale(0.85).setOrigin(0.78, 0.5);
          card.add(w);
        }
      } else if (slot.category === 'upgrade') {
        spr.setScale(0.85);
      } else {
        spr.setScale(0.7);
      }

      // Name
      const nameTxt = this.add
        .text(0, pos.h / 2 - 36, slot.name, {
          fontFamily: FONT,
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: pos.w - 10 },
        })
        .setOrigin(0.5);

      // Price button
      const canAfford = this.gems >= slot.cost;
      const pbtn = this.add.graphics();
      pbtn.fillStyle(canAfford ? 0xf5a623 : 0x4a3b2b, 1);
      pbtn.fillRoundedRect(-pos.w / 2 + 12, pos.h / 2 - 22, pos.w - 24, 18, 9);
      pbtn.lineStyle(1.5, canAfford ? 0xfff0b3 : 0x6d5740, 1);
      pbtn.strokeRoundedRect(-pos.w / 2 + 12, pos.h / 2 - 22, pos.w - 24, 18, 9);

      const pIcon = this.add.image(-pos.w / 2 + 25, pos.h / 2 - 13, 'gem').setScale(0.55);
      const pTxt = this.add
        .text(10, pos.h / 2 - 13, `${slot.cost.toLocaleString()}`, {
          fontFamily: FONT,
          fontSize: '11px',
          fontStyle: 'bold',
          color: canAfford ? '#1a0d05' : '#a19282',
        })
        .setOrigin(0.5);

      card.add([abg, pill, bTxt, spr, nameTxt, pbtn, pIcon, pTxt]);
      card.setSize(pos.w, pos.h).setInteractive({ useHandCursor: canAfford });

      // Hover feedback
      card.on('pointerover', () => {
        card.setScale(1.05);
        speechText.setText(`[${slot.name}]: ${slot.desc}`);
      });
      card.on('pointerout', () => {
        card.setScale(1.0);
        speechText.setText(keeperQuotes[quoteIndex]);
      });

      // Purchase handler
      card.on('pointerdown', () => {
        if (this.gems < slot.cost) {
          return this.toast(`Need ${slot.cost.toLocaleString()} gems! Visit the Gem Store.`);
        }

        if (slot.category === 'bird') {
          this.gems -= slot.cost;
          const isMama = slot.speciesKey === 'mama';
          const b = new Bird(
            this,
            Phaser.Math.Between(200, 700),
            -40,
            isMama ? 2 : 0,
            isMama,
            false,
            slot.speciesKey
          );
          this.birds.push(b);
          this.saveSandbox();
          this.refreshUi();
          this.burst(b.spr.x, 200, 0xffd700, 24);
          this.toast(`Adopted a ${slot.name}! (-${slot.cost.toLocaleString()} Gems)`);
          this.closeModal();
          this.promptBirdNamingModal(b);
          return;
        } else if (slot.category === 'upgrade') {
          this.gems -= slot.cost;
          let count = 0;
          for (const b of this.birds) {
            if (!b.dead && !b.mama && b.stage < 3) {
              b.growNow();
              this.burst(b.spr.x, b.spr.y, 0xb48cff, 20);
              count++;
            }
          }
          this.saveSandbox();
          this.refreshUi();
          this.toast(`Elixir applied! Matured ${count} growing bird${count === 1 ? '' : 's'}!`);
        } else if (slot.category === 'backdrop') {
          this.gems -= slot.cost;
          this.level = 9; // Blossom Sanctuary World theme
          this.saveSandbox();
          this.toast('Unlocked and applied the Blossom Sanctuary Wallpaper!');
        }

        gemText.setText(`${this.gems.toLocaleString()} GEMS`);
      });

      this.modalItems.push(card);
    });

    // Close button (top right)
    const closeBtn = this.add.container(W / 2 + pw / 2 - 28, H / 2 - ph / 2 + 28).setDepth(83);
    const cbg = this.add.graphics();
    cbg.fillStyle(0xb71c1c, 1);
    cbg.fillCircle(0, 0, 18);
    cbg.lineStyle(2, 0xffcdd2, 1);
    cbg.strokeCircle(0, 0, 18);
    const cx = this.add
      .text(0, 0, '✕', { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    closeBtn.add([cbg, cx]);
    closeBtn.setSize(36, 36).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeModal());
    this.modalItems.push(closeBtn);
  }

  promptBirdNamingModal(b: Bird, onDone?: () => void) {
    this.modal = true;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setDepth(85).setInteractive();
    this.modalItems.push(shade);

    const pw = 580;
    const ph = 380;
    const panel = this.add.graphics().setDepth(86);
    panel.fillStyle(0x24140b, 1);
    panel.fillRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 20);
    panel.lineStyle(4, 0xd4a034, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 20);
    panel.lineStyle(2, 0x8a5b23, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2 + 5, H / 2 - ph / 2 + 5, pw - 10, ph - 10, 16);
    this.modalItems.push(panel);

    // Title banner
    const title = this.add
      .text(W / 2, H / 2 - ph / 2 + 35, '✨ NAME YOUR NEW PET! ✨', {
        fontFamily: FONT,
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffea75',
        stroke: '#3e1f08',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(87);
    this.modalItems.push(title);

    const sub = this.add
      .text(
        W / 2,
        H / 2 - ph / 2 + 70,
        `You adopted a lovely ${b.species.name}!\nEvery bird in your sanctuary deserves a memorable name.`,
        {
          fontFamily: FONT,
          fontSize: '14px',
          align: 'center',
          color: '#fed7aa',
        }
      )
      .setOrigin(0.5)
      .setDepth(87);
    this.modalItems.push(sub);

    // Bird preview icon
    const texKey = b.mama ? 'mama' : b.species.key;
    const bodyKey = this.textures.exists(`bird_${texKey}`) ? `bird_${texKey}` : 'bird_sparrow';
    const wingKey = this.textures.exists(`wing_${texKey}`) ? `wing_${texKey}` : 'wing_sparrow';
    const birdPreview = this.add.container(W / 2 - 165, H / 2 - 20).setDepth(87);
    const bodyImg = this.add.image(0, 0, bodyKey).setScale(1.25);
    const wingImg = this.add.image(-6, 4, wingKey).setScale(1.25).setOrigin(0.78, 0.5);
    birdPreview.add([bodyImg, wingImg]);
    this.modalItems.push(birdPreview);

    // Suggestions pool based on species
    const speciesNames: Record<string, string[]> = {
      sparrow: ['Pip', 'Chirpy', 'Barnaby', 'Oliver', 'Penny', 'Rusty', 'Twiggy', 'Bramble'],
      canary: ['Sunny', 'Lemon', 'Goldie', 'Buttercup', 'Apollo', 'Blondie', 'Milo'],
      piranha_finch: ['Ruby', 'Biter', 'Jasper', 'Crimson', 'Nibbler', 'Scarlet', 'Spike'],
      mama: ['Mama Dove', 'Grace', 'Matron Dove', 'Penelope', 'Haven', 'Paloma'],
      falcon: ['Hunter', 'Talon', 'Swift', 'Shadow', 'Zephyr', 'Valkyrie', 'Peregrine'],
      owl: ['Hoot', 'Athena', 'Archimedes', 'Moonbeam', 'Barnaby', 'Wisdom'],
      kingfisher: ['Cobalt', 'River', 'Azure', 'Splash', 'Indigo', 'Marina'],
      phoenix: ['Ignis', 'Blaze', 'Sol', 'Ember', 'Ashen', 'Solaris'],
    };
    const pool = speciesNames[b.species.key] || ['Pip', 'Sunny', 'Barnaby', 'Chirpy', 'Bella', 'Zephyr', 'Cobalt', 'Skye'];
    let currentChosenName = Phaser.Utils.Array.GetRandom(pool);

    // Name display box
    const nameBoxW = 240;
    const nameBoxH = 46;
    const nameBoxX = W / 2 + 50;
    const nameBoxY = H / 2 - 25;

    const nbg = this.add.graphics().setDepth(87);
    nbg.fillStyle(0x130a05, 0.95);
    nbg.fillRoundedRect(nameBoxX - nameBoxW / 2, nameBoxY - nameBoxH / 2, nameBoxW, nameBoxH, 12);
    nbg.lineStyle(2.5, 0xffd54f, 1);
    nbg.strokeRoundedRect(nameBoxX - nameBoxW / 2, nameBoxY - nameBoxH / 2, nameBoxW, nameBoxH, 12);
    this.modalItems.push(nbg);

    const nameText = this.add
      .text(nameBoxX, nameBoxY, currentChosenName, {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(88);
    this.modalItems.push(nameText);

    // Type Custom Name Button
    const typeBtn = this.add.container(nameBoxX + nameBoxW / 2 + 25, nameBoxY).setDepth(87);
    const tbg = this.add.graphics();
    tbg.fillStyle(0x4a148c, 1);
    tbg.fillRoundedRect(-18, -18, 36, 36, 10);
    tbg.lineStyle(2, 0xce93d8, 1);
    tbg.strokeRoundedRect(-18, -18, 36, 36, 10);
    const tIcon = this.add.text(0, 0, '⌨️', { fontSize: '16px' }).setOrigin(0.5);
    typeBtn.add([tbg, tIcon]);
    typeBtn.setSize(36, 36).setInteractive({ useHandCursor: true });
    typeBtn.on('pointerdown', () => {
      const typed = window.prompt(`Enter a name for your new ${b.species.name}:`, currentChosenName);
      if (typed && typed.trim().length > 0) {
        currentChosenName = typed.trim();
        nameText.setText(currentChosenName);
      }
    });
    this.modalItems.push(typeBtn);

    // Quick suggestion pills row
    const pillsContainer = this.add.container(W / 2, H / 2 + 45).setDepth(87);
    const sampleChoices = Phaser.Utils.Array.Shuffle([...pool]).slice(0, 3);
    sampleChoices.forEach((sName, i) => {
      const px = (i - 1) * 125;
      const pbg = this.add.graphics();
      pbg.fillStyle(0x3e2415, 1);
      pbg.fillRoundedRect(-52, -16, 104, 32, 16);
      pbg.lineStyle(1.5, 0xd4a034, 0.8);
      pbg.strokeRoundedRect(-52, -16, 104, 32, 16);
      const ptxt = this.add
        .text(0, 0, sName, {
          fontFamily: FONT,
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffea75',
        })
        .setOrigin(0.5);
      const pBtn = this.add.container(px, 0, [pbg, ptxt]);
      pBtn.setSize(104, 32).setInteractive({ useHandCursor: true });
      pBtn.on('pointerdown', () => {
        currentChosenName = sName;
        nameText.setText(currentChosenName);
      });
      pillsContainer.add(pBtn);
    });
    this.modalItems.push(pillsContainer);

    // Randomize suggestion button (dice)
    const randBtn = this.add.container(W / 2 + 215, H / 2 + 45).setDepth(87);
    const rbg = this.add.graphics();
    rbg.fillStyle(0x1e3a5f, 1);
    rbg.fillCircle(0, 0, 16);
    rbg.lineStyle(2, 0x60a5fa, 1);
    rbg.strokeCircle(0, 0, 16);
    const rTxt = this.add.text(0, 0, '🎲', { fontSize: '15px' }).setOrigin(0.5);
    randBtn.add([rbg, rTxt]);
    randBtn.setSize(32, 32).setInteractive({ useHandCursor: true });
    randBtn.on('pointerdown', () => {
      currentChosenName = Phaser.Utils.Array.GetRandom(pool);
      nameText.setText(currentChosenName);
    });
    this.modalItems.push(randBtn);

    // Big Golden CONFIRM NAME button
    const confirmBtn = this.add.container(W / 2, H / 2 + 120).setDepth(87);
    const cbg = this.add.graphics();
    cbg.fillStyle(0x2e7d32, 1);
    cbg.fillRoundedRect(-120, -22, 240, 44, 22);
    cbg.lineStyle(3, 0xffd54f, 1);
    cbg.strokeRoundedRect(-120, -22, 240, 44, 22);
    const ctxt = this.add
      .text(0, 0, 'CONFIRM NAME ✨', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#14532d',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    confirmBtn.add([cbg, ctxt]);
    confirmBtn.setSize(240, 44).setInteractive({ useHandCursor: true });

    confirmBtn.on('pointerdown', () => {
      b.applyName(currentChosenName);
      this.saveSandbox();
      this.refreshUi();
      this.closeModal();
      this.burst(b.spr.x, b.spr.y > 0 ? b.spr.y : 220, 0xffd700, 20);
      this.floatText(
        b.spr.x,
        (b.spr.y > 0 ? b.spr.y : 220) - 35,
        `Welcome, ${b.name}! 🐦`,
        '#ffd54f',
        '#3e200c'
      );
      this.toast(`Welcome to the aviary, ${b.name} the ${b.species.name}!`);
      if (onDone) onDone();
    });
    this.modalItems.push(confirmBtn);
  }

  usePotion(x: number, y: number) {
    let best: Bird | undefined;
    let minD = 75;
    for (const b of this.birds) {
      if (b.dead || b.mama || b.stage >= 3) continue;
      const d = Phaser.Math.Distance.Between(x, y, b.spr.x, b.spr.y);
      if (d < minD) {
        minD = d;
        best = b;
      }
    }
    if (best) {
      best.growNow();
      this.burst(best.spr.x, best.spr.y, 0xb48cff, 16);
      this.floatText(best.spr.x, best.spr.y - 30, 'LEVEL UP!', '#b48cff', '#ffffff');
      this.potionMode = false;
      this.toast('Potion used! Bird grew!');
      this.saveSandbox();
    } else {
      this.toast('Click directly on a bird to grow it!');
    }
  }

  openGemModal() {
    this.modal = true;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(80).setInteractive();
    this.modalItems.push(shade);

    const panel = this.add.graphics().setDepth(81);
    panel.fillStyle(0x4a2e19, 1);
    panel.fillRoundedRect(W / 2 - 320, 120, 640, 480, 24);
    panel.lineStyle(4, 0xd49b42, 1);
    panel.strokeRoundedRect(W / 2 - 320, 120, 640, 480, 24);
    this.modalItems.push(panel);

    const title = this.add.text(W / 2, 170, 'GEM STORE', { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: '#ffd700', stroke: '#1a0d05', strokeThickness: 6 }).setOrigin(0.5).setDepth(82);
    const note = this.add.text(W / 2, 215, PAYMENTS_LIVE ? 'Instant delivery to your Aviary' : '(Dev Test Mode: Click to get free gems!)', { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: PAYMENTS_LIVE ? '#ffffff' : '#7df9ff' }).setOrigin(0.5).setDepth(82);
    this.modalItems.push(title, note);

    GEM_PACKS.forEach((pack, i) => {
      const cx = W / 2 - 190 + i * 190;
      const cy = 340;
      const card = this.add.container(cx, cy).setDepth(82);
      const bg = this.add.graphics();
      bg.fillStyle(0x6b4423, 1);
      bg.fillRoundedRect(-80, -90, 160, 180, 16);
      bg.lineStyle(3, 0xf6c85f, 1);
      bg.strokeRoundedRect(-80, -90, 160, 180, 16);

      const icon = this.add.image(0, -45, 'gem').setScale(1.6);
      const amt = this.add.text(0, 0, `+${pack.gems}`, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      const desc = this.add.text(0, 24, 'Gems', { fontFamily: FONT, fontSize: '15px', color: '#ffde99' }).setOrigin(0.5);

      const buyBtn = this.add.graphics();
      buyBtn.fillStyle(0x388e3c, 1);
      buyBtn.fillRoundedRect(-65, 45, 130, 36, 10);
      const priceTxt = this.add.text(0, 63, pack.price, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

      card.add([bg, icon, amt, desc, buyBtn, priceTxt]);
      card.setSize(160, 180).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        this.gems += pack.gems;
        this.saveSandbox();
        this.refreshUi();
        this.toast(`Added +${pack.gems} Gems!`);
        this.closeModal();
      });
      this.modalItems.push(card);
    });

    const closeBtn = this.add.container(W / 2 + 280, 155).setDepth(83);
    const cbg = this.add.graphics();
    cbg.fillStyle(0xb71c1c, 1);
    cbg.fillCircle(0, 0, 20);
    const cx = this.add.text(0, 0, '✕', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    closeBtn.add([cbg, cx]);
    closeBtn.setSize(40, 40).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeModal());
    this.modalItems.push(closeBtn);
  }

  closeModal() {
    this.modal = false;
    this.modalItems.forEach((item) => item.destroy());
    this.modalItems = [];
  }

  openBirdSetupModal(initialBird?: Bird) {
    this.modal = true;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8).setDepth(80).setInteractive();
    this.modalItems.push(shade);

    const pw = 1180;
    const ph = 645;
    const panel = this.add.graphics().setDepth(81);
    // Outer wooden cabinet with brass trim
    panel.fillStyle(0x22140a, 1);
    panel.fillRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    panel.lineStyle(5, 0xd4a034, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, 24);
    panel.lineStyle(2, 0x7a4d1d, 1);
    panel.strokeRoundedRect(W / 2 - pw / 2 + 6, H / 2 - ph / 2 + 6, pw - 12, ph - 12, 18);
    // Inner navy velvet tank backdrop
    panel.fillStyle(0x0b1f33, 1);
    panel.fillRoundedRect(W / 2 - pw / 2 + 12, H / 2 - ph / 2 + 12, pw - 24, ph - 24, 16);
    this.modalItems.push(panel);

    // Title Banner: BIRD SETUP
    const banner = this.add.container(W / 2, H / 2 - ph / 2 + 38).setDepth(82);
    const bbg = this.add.graphics();
    bbg.fillStyle(0x3e1d08, 1);
    bbg.fillRoundedRect(-160, -22, 320, 44, 14);
    bbg.lineStyle(3, 0xffd54f, 1);
    bbg.strokeRoundedRect(-160, -22, 320, 44, 14);
    const btxt = this.add.text(0, 0, 'BIRD SETUP', {
      fontFamily: FONT,
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffea75',
      stroke: '#1a0d05',
      strokeThickness: 5,
    }).setOrigin(0.5);
    banner.add([bbg, btxt]);
    this.modalItems.push(banner);

    // Filter pet birds (non-feeder, non-dead)
    const petBirds = this.birds.filter((b) => !b.isFeeder && !b.dead);
    let selectedIndex = 0;
    if (initialBird) {
      const idx = petBirds.indexOf(initialBird);
      if (idx !== -1) selectedIndex = idx;
    }

    // Top Right: HIDE ALL / SHOW ALL button
    const hideAllBtn = this.add.container(W / 2 + pw / 2 - 100, H / 2 - ph / 2 + 38).setDepth(82);
    const habg = this.add.graphics();
    const hatxt = this.add.text(0, 0, '', {
      fontFamily: FONT,
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffea75',
      stroke: '#240733',
      strokeThickness: 3,
    }).setOrigin(0.5);
    hideAllBtn.add([habg, hatxt]);
    hideAllBtn.setSize(140, 36).setInteractive({ useHandCursor: true });
    this.modalItems.push(hideAllBtn);

    const updateHideAllBtn = () => {
      const allHidden = petBirds.length > 0 && petBirds.every((b) => b.hidden);
      habg.clear();
      habg.fillStyle(0x6a1b9a, 1);
      habg.fillRoundedRect(-68, -18, 136, 36, 18);
      habg.lineStyle(2.5, 0xffd54f, 1);
      habg.strokeRoundedRect(-68, -18, 136, 36, 18);
      hatxt.setText(allHidden ? 'SHOW ALL' : 'HIDE ALL');
    };
    updateHideAllBtn();

    hideAllBtn.on('pointerdown', () => {
      const allHidden = petBirds.length > 0 && petBirds.every((b) => b.hidden);
      petBirds.forEach((b) => {
        b.hidden = !allHidden;
        b.spr.setVisible(allHidden);
      });
      this.saveSandbox();
      updateHideAllBtn();
      renderSlots();
      renderShowcase();
    });

    // 20 Porthole slots containers
    const slotContainers: Phaser.GameObjects.Container[] = [];
    const slotPositions = [
      // Left side: 2 columns of 5 (Col 0 and Col 1)
      ...[0, 1, 2, 3, 4].flatMap((row) => [
        { x: W / 2 - 470, y: H / 2 - 180 + row * 92 },
        { x: W / 2 - 365, y: H / 2 - 180 + row * 92 },
      ]),
      // Right side: 2 columns of 5 (Col 2 and Col 3)
      ...[0, 1, 2, 3, 4].flatMap((row) => [
        { x: W / 2 + 365, y: H / 2 - 180 + row * 92 },
        { x: W / 2 + 470, y: H / 2 - 180 + row * 92 },
      ]),
    ];

    const renderSlots = () => {
      slotContainers.forEach((c) => c.destroy());
      slotContainers.length = 0;

      slotPositions.forEach((pos, i) => {
        const slotC = this.add.container(pos.x, pos.y).setDepth(82);
        const sbg = this.add.graphics();
        const isSelected = i === selectedIndex;
        const b = petBirds[i];

        // Outer brass oval bezel
        sbg.fillStyle(0x000000, 0.45);
        sbg.fillEllipse(0, 3, 92, 74);
        sbg.fillStyle(0x784f18, 1);
        sbg.fillEllipse(0, 0, 92, 74);
        sbg.fillStyle(isSelected ? 0xffea75 : 0xc28f2c, 1);
        sbg.fillEllipse(0, 0, 88, 70);
        sbg.lineStyle(isSelected ? 3.5 : 2, isSelected ? 0xffd700 : 0x5a340e, 1);
        sbg.strokeEllipse(0, 0, 88, 70);

        // Inner aquatic bubble backdrop
        sbg.fillStyle(b ? (b.hidden ? 0x1f1418 : 0x0e2e4a) : 0x081523, 1);
        sbg.fillEllipse(0, 0, 80, 62);
        sbg.fillStyle(0xffffff, 0.08);
        sbg.fillEllipse(-12, -14, 35, 16);

        slotC.add(sbg);

        if (b) {
          // Miniature bird preview
          const miniBody = this.add.image(0, 0, b.mama ? 'bird_mama' : 'bird_' + b.species.key).setScale(0.62);
          const miniWing = this.add.image(-5, 3, b.mama ? 'wing_mama' : 'wing_' + b.species.key).setScale(0.62).setOrigin(0.78, 0.5);
          if (b.body.isTinted) miniBody.setTint(b.body.tintTopLeft);
          if (b.wing.isTinted) miniWing.setTint(b.wing.tintTopLeft);
          slotC.add([miniBody, miniWing]);

          if (b.stage === 3 && !b.mama) {
            slotC.add(this.add.image(8, -20, 'crown').setScale(0.6).setRotation(0.2));
          }
          if (b.rare) {
            slotC.add(this.add.image(-8, -20, 'spark').setScale(0.55).setTint(0xffd23f));
          }

          if (b.hidden) {
            const hBadge = this.add.graphics();
            hBadge.fillStyle(0xd32f2f, 0.88);
            hBadge.fillRoundedRect(-28, 12, 56, 16, 8);
            const hTxt = this.add.text(0, 20, 'HIDDEN', {
              fontFamily: FONT,
              fontSize: '9px',
              fontStyle: 'bold',
              color: '#ffffff',
            }).setOrigin(0.5);
            slotC.add([hBadge, hTxt]);
          }

          slotC.setSize(92, 74).setInteractive({ useHandCursor: true });
          slotC.on('pointerdown', () => {
            selectedIndex = i;
            renderSlots();
            renderShowcase();
          });
        }

        this.modalItems.push(slotC);
        slotContainers.push(slotC);
      });
    };

    // Center showcase container
    let showcaseItems: Phaser.GameObjects.GameObject[] = [];

    const renderShowcase = () => {
      showcaseItems.forEach((item) => item.destroy());
      showcaseItems = [];

      const currentBird = petBirds[selectedIndex];
      const cx = W / 2;

      if (!currentBird) {
        const noBirdTxt = this.add.text(cx, H / 2, 'NO BIRDS IN AVIARY\nVisit the Bird Emporium (STORE) to adopt birds!', {
          fontFamily: FONT,
          fontSize: '22px',
          fontStyle: 'bold',
          color: '#ffd54f',
          align: 'center',
        }).setOrigin(0.5).setDepth(82);
        showcaseItems.push(noBirdTxt);
        this.modalItems.push(noBirdTxt);
        return;
      }

      // 1. Bird Name at top of showcase
      const birdDisplayName = currentBird.name ? `"${currentBird.name.toUpperCase()}"` : currentBird.species.name.toUpperCase();
      const nameTxt = this.add.text(cx, H / 2 - 215, birdDisplayName, {
        fontFamily: FONT,
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffe57f',
        stroke: '#1a0d05',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(82);
      showcaseItems.push(nameTxt);

      // 2. Large Oval Showcase Window
      const ow = 260;
      const oh = 160;
      const oy = H / 2 - 110;

      const showFrame = this.add.graphics().setDepth(82);
      showFrame.fillStyle(0x000000, 0.45);
      showFrame.fillEllipse(cx, oy + 4, ow + 6, oh + 6);
      showFrame.fillStyle(0x784f18, 1);
      showFrame.fillEllipse(cx, oy, ow + 4, oh + 4);
      showFrame.fillStyle(0xd4a034, 1);
      showFrame.fillEllipse(cx, oy, ow, oh);
      showFrame.lineStyle(3, 0xffe57f, 1);
      showFrame.strokeEllipse(cx, oy, ow, oh);
      // Inner glowing water/sky
      showFrame.fillStyle(0x0a2d4d, 1);
      showFrame.fillEllipse(cx, oy, ow - 16, oh - 16);
      showFrame.fillStyle(0x0284c7, 0.28);
      showFrame.fillEllipse(cx, oy - 15, ow - 35, oh - 40);
      showFrame.fillStyle(0xffffff, 0.12);
      showFrame.fillEllipse(cx - 35, oy - 35, 70, 32);
      showcaseItems.push(showFrame);

      // Floating animated bubbles in showcase
      for (let bi = 0; bi < 5; bi++) {
        const bx = cx - 60 + bi * 30 + (bi % 2 ? 10 : -10);
        const by = oy + 35 - bi * 12;
        const bCircle = this.add.circle(bx, by, 3 + (bi % 3) * 1.5, 0xffffff, 0.35).setDepth(83);
        this.tweens.add({
          targets: bCircle,
          y: by - 40,
          alpha: 0,
          duration: 1800 + bi * 300,
          repeat: -1,
        });
        showcaseItems.push(bCircle);
      }

      // Animated bird preview in center
      const birdPreviewC = this.add.container(cx, oy).setDepth(84);
      const prevBody = this.add.image(0, 0, currentBird.mama ? 'bird_mama' : 'bird_' + currentBird.species.key).setScale(1.4);
      const prevWing = this.add.image(-11, 7, currentBird.mama ? 'wing_mama' : 'wing_' + currentBird.species.key).setScale(1.4).setOrigin(0.78, 0.5);
      if (currentBird.body.isTinted) prevBody.setTint(currentBird.body.tintTopLeft);
      if (currentBird.wing.isTinted) prevWing.setTint(currentBird.wing.tintTopLeft);
      birdPreviewC.add([prevBody, prevWing]);

      // Flapping wing tween
      this.tweens.add({
        targets: prevWing,
        angle: 18,
        duration: 220,
        yoyo: true,
        repeat: -1,
      });

      // Subtle body hover tween
      this.tweens.add({
        targets: birdPreviewC,
        y: oy - 6,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      if (currentBird.stage === 3 && !currentBird.mama) {
        birdPreviewC.add(this.add.image(18, -48, 'crown').setScale(1.2).setRotation(0.25));
      }
      if (currentBird.glasses) {
        birdPreviewC.add(this.add.image(16, -2, 'glasses_archimedes').setScale(1.1));
      }
      if (currentBird.accessory) {
        const tex = currentBird.accessory.texture.key;
        birdPreviewC.add(this.add.image(14, -44, tex).setScale(1.1));
      }
      if (currentBird.eyepatch) {
        birdPreviewC.add(this.add.image(20, -4, 'eyepatch').setScale(0.95));
      }
      if (currentBird.rare) {
        birdPreviewC.add(this.add.image(-12, -46, 'spark').setScale(1.1).setTint(0xffd23f));
      }
      showcaseItems.push(birdPreviewC);

      // 3. Dossier Plaque
      const py = H / 2 + 65;
      const dossier = this.add.graphics().setDepth(82);
      dossier.fillStyle(0x1a1007, 1);
      dossier.fillRoundedRect(cx - 225, py - 65, 450, 130, 12);
      dossier.lineStyle(2.5, 0x8a5b23, 1);
      dossier.strokeRoundedRect(cx - 225, py - 65, 450, 130, 12);
      dossier.lineStyle(1, 0xd4a034, 0.7);
      dossier.strokeRoundedRect(cx - 221, py - 61, 442, 122, 10);
      showcaseItems.push(dossier);

      const labelStyle = { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#ffd54f' };
      const valStyle = { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#ffffff' };

      const l1 = this.add.text(cx - 205, py - 52, 'PURCHASED:', labelStyle).setDepth(83);
      const v1 = this.add.text(cx - 105, py - 52, currentBird.purchaseDate || 'OCT 25, 2026', valStyle).setDepth(83);

      const l2 = this.add.text(cx - 205, py - 28, 'HOMETOWN:', labelStyle).setDepth(83);
      const v2 = this.add.text(cx - 105, py - 28, (currentBird.hometown || 'Canopy Aviary').toUpperCase(), valStyle).setDepth(83);

      const l3 = this.add.text(cx - 205, py - 4, 'MENTAL STATE:', labelStyle).setDepth(83);
      const v3 = this.add.text(cx - 90, py - 4, (currentBird.mentalState || 'TOTALLY STOKED').toUpperCase(), { ...valStyle, color: '#86efac' }).setDepth(83);

      const l4 = this.add.text(cx - 205, py + 20, 'ADDITIONAL NOTES:', labelStyle).setDepth(83);
      const v4 = this.add.text(cx - 205, py + 36, (currentBird.additionalNotes || currentBird.species.desc).toUpperCase(), {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#e2e8f0',
        wordWrap: { width: 410 },
      }).setDepth(83);

      showcaseItems.push(l1, v1, l2, v2, l3, v3, l4, v4);

      // 4. Action Buttons: [ HIDE / SHOW ], [ RENAME ], [ RELEASE ]
      const ay = H / 2 + 175;

      // Button 1: HIDE / SHOW
      const hideBtn = this.add.container(cx - 145, ay).setDepth(83);
      const hbg = this.add.graphics();
      hbg.fillStyle(0x6a1b9a, 1);
      hbg.fillRoundedRect(-58, -19, 116, 38, 19);
      hbg.lineStyle(2.5, 0xffd54f, 1);
      hbg.strokeRoundedRect(-58, -19, 116, 38, 19);
      const htxt = this.add.text(0, 0, currentBird.hidden ? 'SHOW' : 'HIDE', {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffea75',
        stroke: '#240733',
        strokeThickness: 3,
      }).setOrigin(0.5);
      hideBtn.add([hbg, htxt]);
      hideBtn.setSize(116, 38).setInteractive({ useHandCursor: true });
      hideBtn.on('pointerdown', () => {
        currentBird.hidden = !currentBird.hidden;
        currentBird.spr.setVisible(!currentBird.hidden);
        currentBird.shadow?.setVisible(!currentBird.hidden);
        this.saveSandbox();
        this.refreshUi();
        renderSlots();
        renderShowcase();
        updateHideAllBtn();
      });
      showcaseItems.push(hideBtn);

      // Button 2: RENAME
      const renameBtn = this.add.container(cx, ay).setDepth(83);
      const rbg = this.add.graphics();
      rbg.fillStyle(0x6a1b9a, 1);
      rbg.fillRoundedRect(-58, -19, 116, 38, 19);
      rbg.lineStyle(2.5, 0xffd54f, 1);
      rbg.strokeRoundedRect(-58, -19, 116, 38, 19);
      const rtxt = this.add.text(0, 0, 'RENAME', {
        fontFamily: FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffea75',
        stroke: '#240733',
        strokeThickness: 3,
      }).setOrigin(0.5);
      renameBtn.add([rbg, rtxt]);
      renameBtn.setSize(116, 38).setInteractive({ useHandCursor: true });
      renameBtn.on('pointerdown', () => {
        const typed = window.prompt('Enter a new name for this bird:', currentBird.name);
        if (typed !== null) {
          currentBird.applyName(typed);
          this.saveSandbox();
          renderSlots();
          renderShowcase();
        }
      });
      showcaseItems.push(renameBtn);

      // Button 3: RELEASE / SELL
      const sellPrice = Math.max(10, Math.round(currentBird.species.gemCost * 0.5));
      const sellBtn = this.add.container(cx + 145, ay).setDepth(83);
      const sbg = this.add.graphics();
      sbg.fillStyle(0x6a1b9a, 1);
      sbg.fillRoundedRect(-58, -19, 116, 38, 19);
      sbg.lineStyle(2.5, 0xffd54f, 1);
      sbg.strokeRoundedRect(-58, -19, 116, 38, 19);
      const stxt = this.add.text(0, 0, `SELL (${sellPrice}💎)`, {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#7df9ff',
        stroke: '#240733',
        strokeThickness: 3,
      }).setOrigin(0.5);
      sellBtn.add([sbg, stxt]);
      sellBtn.setSize(116, 38).setInteractive({ useHandCursor: true });
      sellBtn.on('pointerdown', () => {
        const confirmName = currentBird.name ? `"${currentBird.name}"` : currentBird.species.name;
        if (window.confirm(`Release ${confirmName} for ${sellPrice} Gems?`)) {
          currentBird.dead = true;
          currentBird.shadow?.destroy();
          currentBird.spr.destroy();
          this.birds = this.birds.filter((b) => b !== currentBird);
          this.gems += sellPrice;
          this.saveSandbox();
          this.refreshUi();
          const remaining = this.birds.filter((b) => !b.isFeeder && !b.dead);
          selectedIndex = Math.min(selectedIndex, Math.max(0, remaining.length - 1));
          renderSlots();
          renderShowcase();
          updateHideAllBtn();
        }
      });
      showcaseItems.push(sellBtn);

      showcaseItems.forEach((item) => this.modalItems.push(item));
    };

    // 5. Bottom Purple Button: RETURN TO AVIARY
    const returnBtn = this.add.container(W / 2, H / 2 + ph / 2 - 40).setDepth(83);
    const retBg = this.add.graphics();
    retBg.fillStyle(0x6a1b9a, 1);
    retBg.fillRoundedRect(-130, -22, 260, 44, 22);
    retBg.lineStyle(3.5, 0xffd54f, 1);
    retBg.strokeRoundedRect(-130, -22, 260, 44, 22);
    const retTxt = this.add.text(0, 0, 'RETURN TO AVIARY', {
      fontFamily: FONT,
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffea75',
      stroke: '#240733',
      strokeThickness: 4,
    }).setOrigin(0.5);
    returnBtn.add([retBg, retTxt]);
    returnBtn.setSize(260, 44).setInteractive({ useHandCursor: true });
    returnBtn.on('pointerdown', () => this.closeModal());
    this.modalItems.push(returnBtn);

    renderSlots();
    renderShowcase();
  }

  pollyChat(polly: Bird) {
    const quotes = ['"Pieces of eight!"', '"Crackers!"', '"Shiver me timbers!"', '"Squawk! Gold!"'];
    const q = Phaser.Utils.Array.GetRandom(quotes);
    this.floatText(polly.spr.x, polly.spr.y - 45, q, '#ffd700', '#000000');
    this.burst(polly.spr.x, polly.spr.y - 30, 0xffd700, 4);
  }

  startRainDance() {
    if (this.rainDanceT > 0) return;
    this.rainDanceT = 10;
    unlockAchievement('rainmaker', this);

    // Rainbow in sky
    if (!this.rainbow) {
      const rb = this.add.graphics().setDepth(2);
      const colors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3];
      for (let i = 0; i < colors.length; i++) {
        rb.lineStyle(5, colors[i], 0.35);
        rb.beginPath();
        rb.arc(W / 2, 580, 420 - i * 5, Math.PI, 0, false);
        rb.strokePath();
      }
      this.rainbow = rb;
    }
    this.rainbow.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: this.rainbow, alpha: 1, duration: 800 });

    // Rain streaks
    for (let i = 0; i < 35; i++) {
      const rx = Phaser.Math.Between(20, W - 20);
      const ry = Phaser.Math.Between(20, 560);
      const line = this.add.line(rx, ry, 0, 0, -3, 14, 0xffffff, 0.45).setDepth(15);
      this.rainStreaks.push(line);
    }

    // Birds open umbrellas
    this.birds.forEach((b) => b.setUmbrella(true));
  }

  triggerBreadCheat() {
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 180, () => {
        const bx = Phaser.Math.Between(100, W - 100);
        const img = this.add.image(bx, 20, 'drop_baguette').setDepth(8);
        this.foods.push({
          img,
          fill: 100,
          units: 3,
          landed: false,
          life: 14,
          groundY: 592 + Math.random() * 22,
          eaten: false,
        });
        this.burst(bx, 30, 0xf5d6a7, 6);
      });
    }
  }

  triggerMurderCheat() {
    const startX = -120;
    const startY = 160;
    for (let i = 0; i < 7; i++) {
      const offsetX = -Math.abs(i - 3) * 55;
      const offsetY = (i - 3) * 35;
      const f = makeFlyer(this, 'crow', startX + offsetX, startY + offsetY, 18);
      f.spr.setScale(0.95);
      f.body.setTint(0x1a1a24);
      f.wing.setTint(0x0a0a14);

      this.tweens.add({
        targets: f.spr,
        x: W + 150 + offsetX,
        duration: 3200 + Math.random() * 300,
        ease: 'Linear',
        onComplete: () => f.spr.destroy(),
      });

      this.time.delayedCall(1200 + i * 220, () => {
        const dropX = f.spr.x;
        const dropY = Math.min(f.spr.y, 450);
        const isKey = i % 2 === 0;
        const tex = isKey ? 'drop_trinket_key' : 'drop_trinket_ring';
        if (this.sandbox) {
          this.dropGem(dropX, dropY, isKey ? 3 : 5, tex);
        } else {
          this.dropCoin(dropX, dropY, isKey ? 150 : 250);
        }
        this.burst(dropX, dropY, 0xffd700, 5);
      });
    }
  }

  triggerDiscoCheat() {
    this.discoMode = !this.discoMode;
    if (this.discoMode) {
      unlockAchievement('disco_frenzy', this);
      if (!this.discoOverlay) {
        this.discoOverlay = this.add.rectangle(W / 2, H / 2, W, H, 0x3d1052, 0.42).setDepth(20);
      }
      this.discoOverlay.setVisible(true);

      if (!this.discoBall) {
        this.discoBall = this.add.image(W / 2, 40, 'discoball').setDepth(21).setScale(1.4);
      }
      this.discoBall.setVisible(true);

      if (this.discoLights.length === 0) {
        const cols = [0xff007f, 0x00f0ff, 0xffd700, 0x76ff03];
        for (let i = 0; i < 4; i++) {
          const arc = this.add.circle(W / 2, 350, 110, cols[i], 0.28).setDepth(20);
          this.discoLights.push(arc);
        }
      }
      this.discoLights.forEach((l) => l.setVisible(true));
      this.burst(W / 2, 80, 0xffffff, 14);
    } else {
      this.discoOverlay?.setVisible(false);
      this.discoBall?.setVisible(false);
      this.discoLights.forEach((l) => l.setVisible(false));
    }
  }

  triggerDerpCheat() {
    this.derpMode = !this.derpMode;
    this.birds.forEach((b) => b.setGooglyEyes(this.derpMode));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (this.pauseModalContainer) {
        this.closePauseModal();
        return;
      }
      if (!this.modal && !this.ended) {
        this.openPauseModal();
        return;
      }
    }
    if (this.modal || this.gamePaused) return;
    this.cheatBuffer = (this.cheatBuffer + e.key.toUpperCase()).slice(-10);
    if (this.cheatBuffer.endsWith('BREAD')) {
      this.triggerBreadCheat();
    } else if (this.cheatBuffer.endsWith('MURDER')) {
      this.triggerMurderCheat();
    } else if (this.cheatBuffer.endsWith('DISCO')) {
      this.triggerDiscoCheat();
    } else if (this.cheatBuffer.endsWith('DERP')) {
      this.triggerDerpCheat();
    }
  };

  private buildHud() {
    const ws = getWorldAndStage(this.level);
    const pill = this.add.graphics().setDepth(40);
    pill.fillStyle(0x000000, 0.28);
    pill.fillRoundedRect(W - 195, 14, 180, 44, 22);

    // Left container: Menu button
    const menuBtn = this.add.container(58, 36).setDepth(42);
    const mbg = this.add.graphics();
    mbg.fillStyle(0x27170c, 0.92);
    mbg.fillRoundedRect(-38, -18, 76, 36, 12);
    mbg.lineStyle(2, 0xffa726, 0.9);
    mbg.strokeRoundedRect(-38, -18, 76, 36, 12);
    menuBtn.add([
      mbg,
      this.add
        .text(0, 0, 'MENU', {
          fontFamily: FONT,
          fontSize: '16px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5),
    ]);
    menuBtn.setSize(76, 36).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => {
      if (this.pauseModalContainer) {
        this.closePauseModal();
      } else {
        this.openPauseModal();
      }
    });

    const modePillW = 230;
    pill.fillRoundedRect(106, 14, modePillW, 44, 22);
    const modeLabel = this.sandbox
      ? 'My Aviary'
      : this.challengeId === 'night_bats'
      ? '🦇 Night of Bats'
      : this.timeTrial
      ? `${ws.label} Timed ⏱️`
      : `${ws.label}`;
    const modeTxt = this.add
      .text(106 + modePillW / 2, 36, modeLabel, {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(41);
    if (modeTxt.width > modePillW - 24) {
      modeTxt.setScale((modePillW - 24) / modeTxt.width);
    }

    if (this.sandbox) {
      pill.fillRoundedRect(346, 14, 140, 44, 22);
      this.add.image(370, 36, 'gem').setDepth(41);
      this.topGemText = this.add.text(394, 36, '', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5).setDepth(41);
    } else if (this.timeTrial) {
      pill.fillRoundedRect(346, 14, 140, 44, 22);
      this.timerText = this.add
        .text(416, 36, '⏱️ 5:00', {
          fontFamily: FONT,
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#ffd54f',
        })
        .setOrigin(0.5)
        .setDepth(41);
    } else if (this.challengeId === 'night_bats') {
      const chalW = 230;
      pill.fillRoundedRect(346, 14, chalW, 44, 22);
      this.challengeGoalText = this.add
        .text(346 + chalW / 2, 36, '🦇 Wave 1/4 (Slay Bats!)', {
          fontFamily: FONT,
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#f0abfc',
        })
        .setOrigin(0.5)
        .setDepth(41);
    }

    this.birdText = this.add.text(W - 105, 36, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(41);

    let initialHint = 'Click the sky to drop food. Hover over coins to collect them!';
    if (this.challengeId === 'night_bats') {
      initialHint = 'Challenge: Vanquish all nocturnal bat waves and defeat the Vampire Bat King!';
    } else if (!this.sandbox) {
      if (ws.worldId === 1 && ws.stageNum === 1) {
        initialHint = 'Tutorial: Click sky to drop seeds for your hungry chick!';
      } else if (ws.worldId === 2) {
        initialHint = 'Tip: Buy baby Sparrows to feed your hungry Peregrine Falcons!';
      } else if (ws.worldId === 3) {
        initialHint = 'Tip: Mama Dove lays eggs that hatch into free baby birds!';
      } else if (ws.worldId === 4) {
        initialHint = 'Tip: Rebirth mature King Sparrows into Phoenixes via the Pyre!';
      }
    }

    const hintContainer = this.add.container(W / 2, 74).setDepth(43);
    const hintTxt = this.add.text(0, 0, `💡 ${initialHint}`, {
      fontFamily: FONT,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#f8fafc',
    }).setOrigin(0.5);
    const hw = Math.min(W - 200, hintTxt.width + 36);
    const hbg = this.add.graphics();
    hbg.fillStyle(0x0f172a, 0.84);
    hbg.fillRoundedRect(-hw / 2, -16, hw, 32, 16);
    hbg.lineStyle(1.5, 0x38bdf8, 0.7);
    hbg.strokeRoundedRect(-hw / 2, -16, hw, 32, 16);
    hintContainer.add([hbg, hintTxt]);
    this.hint = hintContainer;
    this.tweens.add({
      targets: hintContainer,
      alpha: 0,
      delay: 5500,
      duration: 1000,
      onComplete: () => {
        try { hintContainer.destroy(); } catch {}
      },
    });
  }

  refreshUi() {
    if (this.coinText && this.coinText.scene && this.coinText.active) {
      try {
        this.coinText.setText(this.coins.toLocaleString());
        this.coinText.setScale(Math.min(1, 88 / Math.max(1, this.coinText.width)));
      } catch (e) {
        console.warn('refreshUi coinText error:', e);
      }
    }
    if (this.gemText && this.gemText.scene && this.gemText.active) {
      try {
        this.gemText.setText(this.gems.toLocaleString());
        this.gemText.setScale(Math.min(1, 88 / Math.max(1, this.gemText.width)));
      } catch (e) {
        console.warn('refreshUi gemText error:', e);
      }
    }
    if (this.topGemText && this.topGemText.scene && this.topGemText.active) {
      try {
        this.topGemText.setText(this.gems.toLocaleString());
        this.topGemText.setScale(Math.min(1, 80 / Math.max(1, this.topGemText.width)));
      } catch (e) {
        console.warn('refreshUi topGemText error:', e);
      }
    }
    if (this.birdText && this.birdText.scene && this.birdText.active) {
      try {
        if (this.sandbox) {
          const petCount = this.birds.filter((b) => !b.isFeeder).length;
          const feederCount = this.birds.filter((b) => b.isFeeder).length;
          this.birdText.setText(feederCount > 0 ? `Flock ${petCount} (+${feederCount})` : `Flock ${petCount}`);
        } else {
          this.birdText.setText(`Flock ${this.birds.length}`);
        }
      } catch (e) {
        console.warn('refreshUi birdText error:', e);
      }
    }
    for (const s of this.shops) {
      const t = s.texts();
      try {
        if (s.sub && s.sub.scene && s.sub.active) s.sub.setText(t.sub);
        if (s.tiny && s.tiny.scene && s.tiny.active) s.tiny.setText(t.tiny);
        if (t.icon && s.icon && s.icon.scene && s.icon.active) s.icon.setTexture(t.icon);
        if (t.title && s.title && s.title.scene && s.title.active) s.title.setText(t.title);
      } catch (e) {
        console.warn('refreshUi shop error:', e);
      }
    }
  }

  private setBtn(b: Btn, s: ButtonState) {
    if (b.state !== s) {
      b.state = s;
      b.draw(s);
    }
  }

  toast(msg: string) {
    const t = this.add.text(W / 2, 540, msg, { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#fff', stroke: '#8a2b2b', strokeThickness: 6 }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: 480, alpha: 0, duration: 1400, onComplete: () => t.destroy() });
  }

  floatText(x: number, y: number, s: string, color: string, stroke: string) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color, stroke, strokeThickness: 4 }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  // ---------- game actions ----------
  dropFood(x: number, y: number, free = false, forcedQuality?: number) {
    const playerFoodCount = this.foods.filter((f) => !f.eaten && !f.isPetFood).length;
    if (playerFoodCount >= this.maxFood && !free) {
      if (this.time.now - this.lastFoodWarn > 2500) {
        this.lastFoodWarn = this.time.now;
        this.toast(this.maxFood < 5 ? 'Wait for the food to be eaten, or buy More Food!' : 'Wait for the food to be eaten!');
      }
      return;
    }
    if (!this.sandbox && !free) {
      if (this.coins < FOOD_COST) return this.toast('Not enough coins!');
      this.coins -= FOOD_COST;
    }
    const qLevel = forcedQuality ?? this.quality;
    const q = Math.max(0, Math.min(2, qLevel - 1));
    playFoodDropSound(q);
    const img = this.add.image(x, y, FOOD_TEX[q]).setDepth(8);
    if (q === 0) {
      img.setOrigin(0.225, 0.5);
    }
    this.foods.push({
      img,
      fill: FOOD_FILL[q],
      units: qLevel,
      landed: false,
      life: 10,
      groundY: 592 + Math.random() * 22,
      eaten: false,
      spinAngle: Math.random() * Math.PI * 2,
      vy: 30,
      isPetFood: free,
    });
    this.refreshUi();
  }

  dropCinderAcorn(x: number, y: number) {
    const img = this.add.image(x, y, 'cinder_acorn').setDepth(9);
    this.tweens.add({
      targets: img,
      scaleX: 1.15,
      scaleY: 0.9,
      duration: 350,
      yoyo: true,
      repeat: -1,
    });
    this.foods.push({
      img,
      fill: 100,
      units: 4,
      landed: false,
      life: 14,
      groundY: 592 + Math.random() * 22,
      eaten: false,
      spinAngle: Math.random() * Math.PI * 2,
      isCinderAcorn: true,
      vy: 20,
    });
    this.refreshUi();
  }

  nearestFood(x: number, y: number, gourmetOnly = false): Food | undefined {
    let best: Food | undefined;
    let bd = Infinity;
    for (const f of this.foods) {
      if (f.eaten) continue;
      if (gourmetOnly && f.units < 3) continue; // Toucan only eats berries
      const d = Phaser.Math.Distance.Between(x, y, f.img.x, f.img.y);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  removeFood(f: Food) {
    f.eaten = true;
    f.img.destroy();
    this.foods = this.foods.filter((o) => o !== f);
  }

  eatFood(f: Food, bird: Bird) {
    if (f.eaten) return;
    playBirdEatSound();
    this.burst(f.img.x, f.img.y, 0xffe45e, 5);
    this.removeFood(f);

    // Cinder Acorn: dropped by Sugar Glider!
    // If non-adult (stage < 2) eats it -> burns and dies!
    // If adult (stage >= 2) eats it -> consumed by holy fire and reborn as Golden Phoenix!
    if (f.isCinderAcorn) {
      if (bird.species.key === 'phoenix') {
        this.burst(bird.spr.x, bird.spr.y, 0xffd700, 20);
        this.burst(bird.spr.x, bird.spr.y, 0xff5722, 16);
        this.floatText(bird.spr.x, bird.spr.y - 35, '🔥 SOLAR RADIANCE! 🔥', '#ffd54f', '#d84315');
        this.dropCoin(bird.spr.x, bird.spr.y + 15, 200, 'drop_solar_ember');
        return;
      }
      if (bird.stage < 2) {
        this.cameras.main.shake(180, 0.005);
        this.burst(bird.spr.x, bird.spr.y, 0xff5722, 24);
        this.burst(bird.spr.x, bird.spr.y, 0x444444, 18);
        bird.dead = true;
        bird.shadow?.destroy();
        bird.spr.destroy();
        this.birds = this.birds.filter((b) => b !== bird);
        this.floatText(bird.spr.x, bird.spr.y - 25, '🔥 TOO SPICY! SCORCHED! 💀', '#ef4444', '#450a0a');
        this.toast('A young bird was too small to handle the burning Cinder Acorn and perished!');
        this.refreshUi();
        return;
      } else {
        this.cameras.main.shake(320, 0.008);
        for (let i = 0; i < 28; i++) {
          this.burst(bird.spr.x, bird.spr.y, [0xff5722, 0xffd700, 0xffa000, 0xffffff][i % 4], 16);
        }
        const bx = bird.spr.x;
        const by = bird.spr.y;
        bird.dead = true;
        bird.shadow?.destroy();
        bird.spr.destroy();
        this.birds = this.birds.filter((b) => b !== bird);
        this.floatText(bx, by - 35, '🔥 CONSUMED BY HOLY FLAMES! 🔥', '#ef4444', '#450a0a');

        this.time.delayedCall(400, () => {
          const phoenix = new Bird(this, bx, Math.max(120, by - 20), 3, false, true, 'phoenix');
          this.birds.push(phoenix);
          unlockAchievement('phoenix_rising', this);
          this.burst(bx, by, 0xffd54f, 32);
          this.burst(bx, by, 0xff5722, 28);
          this.floatText(bx, by - 45, '🔥 REBORN AS A PHOENIX! 🔥', '#ffd54f', '#d84315');
          this.toast('The adult bird burned in holy flames and rose from the ashes as the Golden Phoenix!');
          this.dropCoin(bx, by + 20, 200, 'drop_solar_ember');
          this.refreshUi();
        });
        return;
      }
    }

    bird.fullness = 100; // Fully restores belly so bird stays satisfied
    bird.addUnits(f.units);
    bird.pause = 1.2 + Math.random() * 0.8;
    bird.state = 'wander';

    // Natural joyful peck hop (NO stretching or squashing the bird model!):
    this.tweens.add({
      targets: bird.flip,
      y: -6,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    // Special Coronation: King Songbird coronation ritual!
    // Available later in game (World 3+ / level >= 7, or in My Aviary sandbox):
    // When an Adult bird (stage === 2) eats a Tier 3 Golden Berry (f.units >= 3)
    // while in or near a completed cozy nest cup (stage 6):
    const laterInGame = this.sandbox || this.level >= 7;
    const nearCompletedNest = this.spots.some(
      (s) => s.nest && (s.nestStage ?? 0) >= 6 && Phaser.Math.Distance.Between(bird.spr.x, bird.spr.y, s.x, s.y) < 75
    );
    if (laterInGame && bird.stage === 2 && !bird.isBreeder && f.units >= 3 && nearCompletedNest) {
      bird.stage = 3;
      bird.updateTextures();
      playBirdEvolveSound();
      this.burst(bird.spr.x, bird.spr.y, 0xffd700, 26);
      this.burst(bird.spr.x, bird.spr.y - 20, 0xffffff, 16);
      this.floatText(bird.spr.x, bird.spr.y - 45, '👑 CORONATION! KING SONGBIRD! 👑', '#ffd700', '#78350f');
      this.toast('👑 An Adult Songbird was crowned King in the royal nest! Drops royal diamond feathers!');
      this.cameras.main.shake(160, 0.004);
    }

    // Phoenix Easter Egg: Reborn in a burst of flames!
    if (bird.easterEgg === 'phoenix') {
      this.burst(bird.spr.x, bird.spr.y, 0x444444, 15);
      bird.spr.setAlpha(0.25);
      this.time.delayedCall(450, () => {
        if (bird.dead) return;
        bird.spr.setAlpha(1);
        this.burst(bird.spr.x, bird.spr.y, 0xff5722, 24);
        this.floatText(bird.spr.x, bird.spr.y - 45, 'REBORN!', '#ff9100', '#d84315');
      });
    }
  }

  nearestBird(x: number, y: number): Bird | undefined {
    let best: Bird | undefined;
    let bd = Infinity;
    for (const b of this.birds) {
      if (b.dead) continue;
      const d = Phaser.Math.Distance.Between(x, y, b.spr.x, b.spr.y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  nearestBabyBird(x: number, y: number): Bird | undefined {
    let best: Bird | undefined;
    let bd = Infinity;
    for (const b of this.birds) {
      if (b.dead) continue;
      // Hawk ONLY eats baby birds (stage 0) or feeder chicks!
      if (b.stage === 0 || b.isFeeder) {
        const d = Phaser.Math.Distance.Between(x, y, b.spr.x, b.spr.y);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
    }
    return best;
  }

  nearestPredator(x: number, y: number): Predator | undefined {
    let best: Predator | undefined;
    let bd = 750;
    for (const p of this.predators) {
      if (p.dying) continue;
      const d = Phaser.Math.Distance.Between(x, y, p.spr.x, p.spr.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  /** What a crow wants to eat: nearest food or coin lying around. */
  crowTarget(x: number, y: number): { x: number; y: number; eat: () => void } | undefined {
    let best: { x: number; y: number; eat: () => void } | undefined;
    let bd = Infinity;
    for (const f of this.foods) {
      const d = Phaser.Math.Distance.Between(x, y, f.img.x, f.img.y);
      if (d < bd) {
        bd = d;
        best = { x: f.img.x, y: f.img.y, eat: () => this.removeFood(f) };
      }
    }
    for (const c of this.coinList) {
      if (c.collected || !c.landed) continue;
      const d = Phaser.Math.Distance.Between(x, y, c.img.x, c.img.y);
      if (d < bd) {
        bd = d;
        best = {
          x: c.img.x,
          y: c.img.y,
          eat: () => {
            c.collected = true;
            this.burst(c.img.x, c.img.y, 0x555555, 6);
            c.img.destroy();
          },
        };
      }
    }
    return best;
  }

  throwAcorn(x: number, y: number, target: Predator) {
    const a = this.add.image(x, y, 'acorn').setDepth(16);
    this.tweens.add({
      targets: a,
      x: target.spr.x,
      y: target.spr.y,
      rotation: 8,
      duration: 450,
      onComplete: () => {
        a.destroy();
        if (!target.dying && !target.gone) {
          target.hit(1, x, y);
          this.burst(target.spr.x, target.spr.y, 0xc8934f, 5);
        }
      },
    });
  }

  killBird(b: Bird, cause: 'eaten' | 'starved') {
    if (b.dead) return;
    b.dead = true;
    b.shadow?.destroy();
    b.leaveSpot();
    this.birds = this.birds.filter((o) => o !== b);
    if (cause === 'eaten') {
      this.burst(b.spr.x, b.spr.y, 0xffffff, 14);
      b.spr.destroy();
      this.toast('A bird was eaten!');
    } else {
      this.toast('A bird starved!');
      const groundY = 594 + Math.random() * 8;
      const fallDist = Math.max(20, groundY - b.spr.y);
      // Realistic freefall gravity acceleration (t = sqrt(2d/g), g ≈ 1600 px/s²)
      const fallDuration = Phaser.Math.Clamp(Math.sqrt((2 * fallDist) / 1600) * 1000, 220, 850);
      const tumbleAngle = b.spr.rotation + (b.dir >= 0 ? 1 : -1) * Math.PI * 0.95;

      this.tweens.add({
        targets: b.spr,
        x: b.spr.x + b.dir * 18,
        y: groundY,
        rotation: tumbleAngle,
        duration: fallDuration,
        ease: 'Quad.easeIn',
        onComplete: () => {
          // Thud impact with the ground: dust puff & feather motes
          this.burst(b.spr.x, groundY, 0xa89f91, 8);
          this.burst(b.spr.x, groundY, 0xdcd6cd, 6);
          this.cameras.main.shake(90, 0.0025);

          // Small limp bounce upon ground impact
          this.tweens.add({
            targets: b.spr,
            y: groundY - 7,
            duration: 80,
            yoyo: true,
            ease: 'Quad.easeOut',
            onComplete: () => {
              // Lies on the ground briefly, then fades away into dust
              this.tweens.add({
                targets: b.spr,
                alpha: 0,
                delay: 1100,
                duration: 600,
                onComplete: () => b.spr.destroy(),
              });
            },
          });
        },
      });
    }
    this.refreshUi();
    if (this.birds.length === 0) this.lose();
  }

  coinKey(v: number) {
    // 500+ = Solar Ember, 250+ = Golden Egg, 75+ = Royal Peacock Feather, 20+ = Gold Feather (Adult), <20 = Silver Feather (Medium)
    return v >= 500 ? 'drop_solar_ember' : v >= 250 ? 'goldegg' : v >= 75 ? 'feather_peacock' : v >= 20 ? 'feather_gold' : 'feather_silver';
  }

  dropCoin(x: number, y: number, value: number, texOverride?: string) {
    playEggDropSound();
    const tex = texOverride ?? this.coinKey(value);
    const img = this.add.image(x, y, tex).setDepth(12);
    if (value < 100 && !texOverride) img.setScale(0.9);
    this.coinList.push({
      img,
      value,
      landed: false,
      groundY: 596 + Math.random() * 20,
      life: 5.5,
      collected: false,
      isGem: false,
      phase: Math.random() * 6.28,
    });
  }

  dropGem(x: number, y: number, value: number, texKey = 'gem') {
    playEggDropSound();
    const img = this.add.image(x, y, texKey).setDepth(12);
    if (texKey === 'gem') img.setScale(1.1);
    this.coinList.push({ img, value, landed: false, groundY: 596 + Math.random() * 20, life: 7.0, collected: false, isGem: true });
  }

  nearestCoin(x: number, y: number): Coin | undefined {
    let best: Coin | undefined;
    let bd = Infinity;
    for (const c of this.coinList) {
      if (c.collected) continue;
      const d = Phaser.Math.Distance.Between(x, y, c.img.x, c.img.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  nearestGroundCoin(x: number): Coin | undefined {
    let best: Coin | undefined;
    let bd = Infinity;
    for (const c of this.coinList) {
      if (c.collected || !c.landed) continue;
      const d = Math.abs(x - c.img.x);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  removeCoin(c: Coin) {
    if (c.collected) return;
    c.collected = true;
    c.img.destroy();
    this.coinList = this.coinList.filter((o) => o !== c);
  }

  collectCoin(c: Coin, fx?: number, fy?: number) {
    if (c.collected) return;
    c.collected = true;
    const x = fx ?? c.img.x;
    const y = fy ?? c.img.y;
    if (c.isGem || this.sandbox) {
      playGemCollectSound();
      this.gems += c.value;
      this.saveSandbox();
      this.burst(c.img.x, c.img.y, 0x00f0ff, 6);
      this.floatText(x, y - 10, '+' + c.value + ' Gems', '#7df9ff', '#004d66');
      this.tweens.add({ targets: c.img, x: 40, y: 676, scale: 0.3, duration: 350, ease: 'Quad.easeIn', onComplete: () => c.img.destroy() });
    } else {
      playCoinCollectSound();
      this.coins += c.value;
      if (this.coins >= 1000) {
        unlockAchievement('coin_hoarder', this);
      }
      this.burst(c.img.x, c.img.y, 0xfde047, 6);
      this.burst(c.img.x, c.img.y, 0xffffff, 4);
      this.floatText(x, y - 10, '🪶 +' + c.value, '#fef08a', '#854d0e');
      this.tweens.add({ targets: c.img, x: 40, y: 676, scale: 0.3, duration: 350, ease: 'Quad.easeIn', onComplete: () => c.img.destroy() });
    }
    this.refreshUi();
  }

  layEgg(spot: Spot, mother?: Bird) {
    playEggDropSound();
    spot.egg = this.add.image(spot.x, spot.y - 4, 'egg').setDepth(5).setScale(0.9);
    spot.eggT = 15;
    spot.eggMother = mother;
    this.burst(spot.x, spot.y - 10, 0xffffff, 6);
    if (mother) this.toast(`${mother.species.name} laid an egg in the nest!`);
  }

  birdChirp(canary: Bird) {
    playVictoryChirp();
    const x = canary.spr.x;
    const y = canary.spr.y;
    for (let i = 0; i < 3; i++) {
      const n = this.add
        .text(x + Phaser.Math.Between(-20, 20), y - 25, i % 2 ? '♫' : '♪', {
          fontFamily: FONT,
          fontSize: '24px',
          color: '#ffe45e',
          stroke: '#8a5a00',
          strokeThickness: 3,
        })
        .setDepth(60);
      this.tweens.add({
        targets: n,
        y: n.y - 45 - Math.random() * 20,
        alpha: 0,
        duration: 1100,
        delay: i * 150,
        onComplete: () => n.destroy(),
      });
    }
    for (const b of this.birds) {
      if (b !== canary && !b.isBreeder && b.stage >= 1 && !b.dead) {
        if (Phaser.Math.Distance.Between(x, y, b.spr.x, b.spr.y) < 320) {
          b.dropCurrency();
        }
      }
    }
  }

  sing(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const n = this.add.text(x + Phaser.Math.Between(-30, 30), y - 20, i % 2 ? '\u266A' : '\u266B', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#6b4aa0', strokeThickness: 4 }).setDepth(60);
      this.tweens.add({ targets: n, y: n.y - 90 - Math.random() * 40, x: n.x + Phaser.Math.Between(-60, 60), alpha: 0, duration: 1600, delay: i * 120, onComplete: () => n.destroy() });
    }
    this.toast('Melody sings!');
    this.birds.forEach((b, i) => {
      if (!b.isBreeder && b.stage >= 1) this.time.delayedCall(300 + i * 120, () => !b.dead && b.dropCurrency());
    });
  }

  playAttackFx(tier: number, clickX: number, clickY: number, target?: Predator) {
    const tx = target ? target.spr.x : clickX;
    const ty = target ? target.spr.y : clickY;
    const dmg = WEAPON_DMG[tier];

    switch (tier) {
      case 0: {
        // Wooden Stick: Stick sprite swings down over target
        const stick = this.add.image(tx + 22, ty - 32, 'weapon_stick').setDepth(35).setScale(1.2).setRotation(-0.6);
        this.tweens.add({
          targets: stick,
          rotation: 0.7,
          x: tx,
          y: ty - 10,
          duration: 90,
          onComplete: () => {
            this.burst(tx, ty, 0x6d4c41, 7);
            this.burst(tx, ty, 0x43a047, 5);
            stick.destroy();
          },
        });
        this.floatText(tx, ty - 35, `WHACK! -${dmg}`, '#ffffff', '#4e342e');
        break;
      }
      case 1: {
        // Slingshot: Pebble projectile streaks to target
        const pebble = this.add.image(clickX - 35, clickY + 30, 'pebble').setDepth(35).setScale(1.1);
        this.tweens.add({
          targets: pebble,
          x: tx,
          y: ty,
          duration: 80,
          onComplete: () => {
            this.burst(tx, ty, 0x9e9e9e, 8);
            pebble.destroy();
          },
        });
        this.floatText(tx, ty - 35, `SNAP! -${dmg}`, '#ffd54f', '#b45309');
        break;
      }
      case 2: {
        // Hunting Bow: Arrow streaks into target
        const arrow = this.add.image(tx - 70, ty, 'arrow').setDepth(35).setScale(1.2);
        this.tweens.add({
          targets: arrow,
          x: tx,
          duration: 75,
          onComplete: () => {
            this.burst(tx, ty, 0xff5252, 10);
            this.burst(tx, ty, 0xffffff, 5);
            arrow.destroy();
          },
        });
        this.floatText(tx, ty - 35, `THWACK! -${dmg}`, '#f97316', '#7c2d12');
        break;
      }
      case 3: {
        // Rifle: Gunshot blast and smoke
        this.burst(tx, ty, 0xffa000, 14);
        this.burst(tx, ty, 0x64748b, 8);
        this.cameras.main.shake(100, 0.004);
        this.floatText(tx, ty - 35, `BANG! -${dmg}`, '#ef4444', '#450a0a');
        break;
      }
      case 4:
      default: {
        // Laser Blaster: Neon laser beam from cursor to predator
        const laser = this.add.graphics().setDepth(38);
        laser.lineStyle(4, 0x00f0ff, 1);
        laser.lineBetween(clickX, H - 90, tx, ty);
        laser.lineStyle(1.5, 0xffffff, 1);
        laser.lineBetween(clickX, H - 90, tx, ty);
        this.tweens.add({
          targets: laser,
          alpha: 0,
          duration: 120,
          onComplete: () => laser.destroy(),
        });
        this.burst(tx, ty, 0x00f0ff, 18);
        this.cameras.main.shake(120, 0.005);
        this.floatText(tx, ty - 35, `ZAP! -${dmg}`, '#00ffff', '#1e1b4b');
        break;
      }
    }
  }

  startWaveWarning(enemies: WaveEnemy[]) {
    if (this.waveWarning || enemies.length === 0 || this.ended) return;
    this.waveWarning = true;
    this.warningTimer = 4.5;
    this.pendingEnemies = enemies;
    this.lastSirenBeepSec = -1;

    // Dismiss any active tutorial hint so it never collides with predator alerts
    if (this.hint && (this.hint as any).destroy) {
      try { (this.hint as any).destroy(); } catch {}
      this.hint = undefined;
    }

    // Red pulsating screen border vignette
    if (!this.warningVignette || !this.warningVignette.scene) {
      this.warningVignette = this.add.graphics().setDepth(50);
    }
    this.warningVignette.clear();
    this.warningVignette.lineStyle(16, 0xef4444, 0.65);
    this.warningVignette.strokeRect(8, 8, W - 16, H - 16);
    this.warningVignette.fillStyle(0xef4444, 0.08);
    this.warningVignette.fillRect(0, 0, W, H);
    this.warningVignette.setVisible(true);

    const enemyNames = enemies.map((e) => e.label).join(' & ');

    // Warning alert banner container
    if (!this.warningContainer || !this.warningContainer.scene || !this.warningSubText?.scene) {
      if (this.warningContainer) {
        try {
          this.warningContainer.destroy(true);
        } catch {
          /* ignore */
        }
      }
      const bannerBg = this.add.graphics();
      bannerBg.fillStyle(0x1a0505, 0.94);
      bannerBg.fillRoundedRect(-270, -38, 540, 76, 16);
      bannerBg.lineStyle(3, 0xef4444, 1);
      bannerBg.strokeRoundedRect(-270, -38, 540, 76, 16);

      const sirenL = this.add.image(-235, -2, 'siren_light').setScale(1.15);
      const sirenR = this.add.image(235, -2, 'siren_light').setScale(1.15);

      this.warningTitleText = this.add
        .text(0, -18, '🚨 WARNING: PREDATOR INCOMING! 🚨', {
          fontFamily: FONT,
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#fecaca',
          stroke: '#991b1b',
          strokeThickness: 3,
        })
        .setOrigin(0.5);

      this.warningSubText = this.add
        .text(0, 3, `${enemyNames} sighted nearby!`, {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#ffffff',
          stroke: '#1e293b',
          strokeThickness: 2,
        })
        .setOrigin(0.5);

      this.warningCountdownText = this.add
        .text(0, 22, 'INVASION IN 4s...', {
          fontFamily: FONT,
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#ffd54f',
          stroke: '#78350f',
          strokeThickness: 2,
        })
        .setOrigin(0.5);

      this.warningContainer = this.add.container(W / 2, 85, [
        bannerBg,
        sirenL,
        sirenR,
        this.warningTitleText,
        this.warningSubText,
        this.warningCountdownText,
      ]).setDepth(60);
    } else {
      this.warningSubText.setText(`${enemyNames} sighted nearby!`);
      this.warningContainer.setVisible(true);
    }

    playSirenSound();
  }

  dismissWaveWarning() {
    this.waveWarning = false;
    if (this.warningContainer?.scene) {
      this.warningContainer.setVisible(false);
    }
    if (this.warningVignette?.scene) {
      this.warningVignette.setVisible(false);
    }
  }

  spawnPredator(kind: PredatorKind, hp: number): Predator {
    playPredatorSpawnSound(kind);
    const p = new Predator(this, kind, hp);
    this.predators.push(p);
    return p;
  }

  onPredatorDown(p: Predator) {
    playPredatorDefeatedSound();
    let reward = 40;
    let label = 'The predator was chased away!';
    if (p.kind === 'wyvern') {
      reward = 150;
      label = '🔥 The Volcanic Wyvern was defeated!';
    } else if (p.kind === 'cat') {
      reward = 40;
      label = 'The alley cat was scared away!';
    } else if (p.kind === 'snake') {
      reward = 40;
      label = 'The tree viper was driven off!';
    } else if (p.kind === 'raccoon') {
      reward = 50;
      label = 'The raccoon dropped its sack and fled!';
    } else if (p.kind === 'spider') {
      reward = 45;
      label = 'The giant spider scuttled back up!';
    } else if (p.kind === 'weasel') {
      reward = 40;
      label = 'The sly weasel was repelled!';
    } else if (p.kind === 'glutton') {
      reward = 80;
      label = '💥 Gorgon the Glutton burst from overeating!';
    } else if (p.kind === 'bombardier') {
      reward = 80;
      label = '💥 The Bombardier Raptor was shot down!';
    } else if (p.kind === 'vulture') {
      reward = 100;
      label = '👨‍🍳 The Gourmet Vulture dropped his platter and fled!';
    } else if (p.kind === 'bat') {
      reward = 60;
      label = '🦇 The nocturnal bat was driven into the shadows!';
      this.dropCoin(p.spr.x, p.spr.y, 150, 'drop_moonstone');
      this.batsDefeated = (this.batsDefeated || 0) + 1;
      if (this.batsDefeated >= 5) {
        unlockAchievement('bat_hunter', this);
        const sv = loadSave();
        const ch = sv.challenges ?? {};
        if (ch['night_bats_unlocked'] !== 'unlocked') {
          ch['night_bats_unlocked'] = 'unlocked';
          patchSave({ challenges: ch });
          this.toast('🦇 Secret Challenge Unlocked: Night of the Bats!');
        }
      }
    } else if (p.kind === 'crow') {
      reward = 25;
      label = 'The crow was chased away!';
    } else {
      reward = 50;
      label = 'The hawk was chased away!';
    }

    this.dropCoin(p.spr.x, Math.min(p.spr.y, 560), reward, p.kind === 'wyvern' ? 'drop_solar_ember' : undefined);
    this.burst(p.spr.x, p.spr.y, 0xffd23f, p.kind === 'wyvern' ? 24 : 12);
    if (p.kind === 'vulture') {
      this.floatText(p.spr.x, p.spr.y - 45, 'BON APPÉTIT! +100', '#f59e0b', '#78350f');
    }
    if (p.kind === 'wyvern') {
      this.cameras.main.shake(300, 0.008);
    }
    this.toast(label);
  }

  eatGluttonFood(f: Food, p: Predator) {
    if (f.eaten) return;
    this.removeFood(f);
    p.foodsEaten++;
    this.burst(p.spr.x, p.spr.y, 0x84cc16, 8);
    playWeaponSound(0);

    // Expand belly
    const scaleFactor = 1.0 + (p.foodsEaten / p.maxFoods) * 0.65;
    p.spr.setScale(scaleFactor);
    this.floatText(p.spr.x, p.spr.y - 35, `BURP! ${p.foodsEaten}/${p.maxFoods}`, '#84cc16', '#1a2e05');

    if (p.foodsEaten >= p.maxFoods) {
      this.burstGlutton(p);
    }
  }

  burstGlutton(p: Predator) {
    p.dying = true;
    p.bar.clear();
    this.cameras.main.shake(400, 0.012);
    this.burst(p.spr.x, p.spr.y, 0xffd700, 28);
    this.burst(p.spr.x, p.spr.y, 0x84cc16, 24);
    this.floatText(p.spr.x, p.spr.y - 45, '💥 GORGON BURST! 💥', '#ffdd57', '#d90429');
    this.toast('Gorgon overate and exploded into magnificent treasure!');

    this.dropCoin(p.spr.x - 24, p.spr.y, 30);
    this.dropCoin(p.spr.x + 24, p.spr.y, 30);
    this.dropCoin(p.spr.x, p.spr.y - 15, 30);
    if (this.sandbox) {
      this.dropGem(p.spr.x, p.spr.y - 10, 4);
    } else {
      this.dropCoin(p.spr.x, p.spr.y, 60);
    }
    this.onPredatorDown(p);
  }

  launchMissile(x: number, y: number, target: Bird) {
    const img = this.add.image(x, y, 'homing_missile').setDepth(20).setScale(1.2).setInteractive({ useHandCursor: true });
    const m: Missile = { img, target, speed: 135, destroyed: false };
    img.on('pointerdown', () => this.interceptMissile(m));
    this.missiles.push(m);
    this.burst(x, y, 0xff5722, 10);
    this.burst(x, y, 0xffd54f, 8);
    playWeaponSound(0);
  }

  interceptMissile(m: Missile) {
    if (m.destroyed) return;
    m.destroyed = true;
    playMissileExplosionSound();
    const mx = m.img.x;
    const my = m.img.y;
    m.img.destroy();
    this.missiles = this.missiles.filter((o) => o !== m);
    this.burst(mx, my, 0xff5722, 22);
    this.burst(mx, my, 0xffd54f, 18);
    this.cameras.main.shake(160, 0.005);
    this.floatText(mx, my - 20, '💥 INTERCEPTED! +50c', '#ffd54f', '#78350f');
    this.coins += 50;
    this.refreshUi();
    playWeaponSound(1);
    this.toast('Direct intercept! Saved your bird +50 coins!');
  }

  burst(x: number, y: number, color: number, n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'spark').setTint(color).setDepth(30).setScale(0.6);
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 25;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, alpha: 0, scale: 0.1, duration: 500, onComplete: () => s.destroy() });
    }
  }

  // ---------- win / lose ----------
  private overlay(title: string, lines: string[], color: string) {
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(70);
    const panel = this.add.graphics().setDepth(71);
    panel.fillStyle(0x5b3a21, 1);
    panel.fillRoundedRect(W / 2 - 330, 170, 660, 360, 24);
    panel.lineStyle(5, 0x8a5a33, 1);
    panel.strokeRoundedRect(W / 2 - 330, 170, 660, 360, 24);
    this.add.text(W / 2, 230, title, { fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color, stroke: '#3a2412', strokeThickness: 8 }).setOrigin(0.5).setDepth(72);
    lines.forEach((l, i) => this.add.text(W / 2, 300 + i * 36, l, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#ffffff', align: 'center' }).setOrigin(0.5).setDepth(72));
    return shade;
  }

  private bigButton(label: string, y: number, onClick: () => void) {
    const btn = this.add.container(W / 2, y).setDepth(72);
    const g = this.add.graphics();
    g.fillStyle(0x2a6b25, 1);
    g.fillRoundedRect(-120, -22, 240, 64, 18);
    g.fillStyle(0x58c552, 1);
    g.fillRoundedRect(-120, -28, 240, 64, 18);
    btn.add([g, this.add.text(0, 4, label, { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#fff', stroke: '#2a6b25', strokeThickness: 5 }).setOrigin(0.5)]);
    btn.setSize(240, 64).setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      playButtonClickSound();
      onClick();
    });
  }

  private win() {
    this.ended = true;
    playStageClearFanfare();
    if (this.timeTrial) {
      this.endTimeTrial();
      return;
    }
    if (this.sandbox) return;

    if (this.level === 4) unlockAchievement('world1_clear', this);
    if (this.level === 8) unlockAchievement('world2_clear', this);

    const sv = loadSave();
    const nextLevel = Math.max(sv.level, this.level + 1);
    const ws = getWorldAndStage(this.level);
    const gemBonus = ws.isLastStageOfWorld ? 15 : 5;
    patchSave({ level: nextLevel, gems: this.gems + gemBonus });
    this.gems += gemBonus;

    const pet = PETS[this.level - 1];
    const lines = pet
      ? [
          `${ws.label} Complete! Rescued Companion:`,
          `${pet.name} the ${pet.role}:`,
          `“${pet.desc}”`,
          `+${gemBonus} Gems earned!`,
        ]
      : [
          `Stage cleared! All egg pieces assembled.`,
          `Get ready for ${ws.world.name} Stage ${ws.stageNum + 1}!`,
          `+${gemBonus} Gems earned!`,
        ];

    this.time.delayedCall(600, () => {
      AviaryScene.suspendedGame = undefined;
      patchSave({ suspendedSession: undefined });
      this.overlay(ws.isLastStageOfWorld ? `World ${ws.worldId} Conquered!` : `${ws.label} Complete!`, lines, '#ffe45e');
      if (pet) this.add.image(W / 2, 405, 'pet_' + pet.key).setDepth(72).setScale(1.2);
      this.bigButton(ws.isLastStageOfWorld ? 'NEXT WORLD' : 'NEXT STAGE', 495, () =>
        this.scene.start('Menu', { level: this.level + 1 })
      );
    });
  }

  private lose() {
    this.ended = true;
    AviaryScene.suspendedGame = undefined;
    patchSave({ suspendedSession: undefined });
    this.time.delayedCall(800, () => {
      this.overlay('Game Over', ['All of your birds are gone.', 'Keep them fed and chase off predators!'], '#ff8a80');
      this.bigButton('TRY AGAIN', 460, () =>
        this.scene.restart({
          ...this.initData,
          level: this.level,
          pets: this.petKeys,
          challengeId: this.challengeId,
          timeTrial: this.timeTrial,
          sandbox: this.sandbox,
        })
      );
    });
  }

  private openLogbookModal() {
    this.modal = true;
    new LogbookUI(this, {
      onClose: () => {
        this.modal = false;
      },
      isModal: true,
    });
  }

  private closePauseModal() {
    if (this.pauseModalContainer) {
      this.pauseModalContainer.destroy();
      this.pauseModalContainer = undefined;
    }
    this.modal = false;
    this.gamePaused = false;
  }

  private openPauseModal(isReturn = false) {
    if (this.ended) return;
    if (this.pauseModalContainer) {
      this.pauseModalContainer.destroy();
      this.pauseModalContainer = undefined;
    }

    this.modal = true;
    this.gamePaused = true;

    const ws = getWorldAndStage(this.level);
    const livingBirds = this.birds.filter((b) => !b.dead).length;

    const container = this.add.container(0, 0).setDepth(80);
    this.pauseModalContainer = container;

    // Dark backdrop overlay (blocks clicks to game elements behind)
    const bg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.68).setInteractive();
    container.add(bg);

    // Dialog Card
    const cardW = 460;
    const cardH = 490;
    const cardX = W / 2;
    const cardY = H / 2;

    const panel = this.add.graphics();
    // Shadow
    panel.fillStyle(0x000000, 0.45);
    panel.fillRoundedRect(cardX - cardW / 2 + 6, cardY - cardH / 2 + 8, cardW, cardH, 24);
    // Outer Border & Wood Fill
    panel.fillStyle(0x27170c, 0.98);
    panel.fillRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    panel.lineStyle(4, 0xffa726, 1);
    panel.strokeRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 24);
    // Inner bevel
    panel.lineStyle(1.5, 0x5a341a, 0.8);
    panel.strokeRoundedRect(cardX - cardW / 2 + 8, cardY - cardH / 2 + 8, cardW - 16, cardH - 16, 18);
    container.add(panel);

    // Title banner
    const titleText = isReturn ? 'WELCOME BACK!' : 'GAME PAUSED';
    const title = this.add
      .text(cardX, cardY - cardH / 2 + 42, titleText, {
        fontFamily: FONT,
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#ffd54f',
        stroke: '#3e1e07',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    container.add(title);

    // Subtitle & Stage Name
    const stageDesc = this.sandbox
      ? 'Sanctuary Aviary'
      : this.timeTrial
      ? 'Time Trial Challenge'
      : this.challengeId === 'night_bats'
      ? '🦇 Challenge: Night of the Bats'
      : `${ws.label} • ${ws.stage.name}`;
    const subtitle = this.add
      .text(cardX, cardY - cardH / 2 + 75, stageDesc, {
        fontFamily: FONT,
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    container.add(subtitle);

    // Status pill
    const statPill = this.add.graphics();
    statPill.fillStyle(0x1a0f08, 0.8);
    statPill.fillRoundedRect(cardX - 175, cardY - cardH / 2 + 96, 350, 30, 15);
    statPill.lineStyle(1, 0x8d5c34, 0.6);
    statPill.strokeRoundedRect(cardX - 175, cardY - cardH / 2 + 96, 350, 30, 15);
    container.add(statPill);

    const statTextStr = this.sandbox
      ? `🐦 ${livingBirds} Birds  •  💎 ${this.gems} Gems`
      : this.timeTrial
      ? `⏱️ ${Math.floor(this.timeTrialTime)}s Remaining  •  🪙 ${this.coins} Coins`
      : this.challengeId === 'night_bats'
      ? `🦇 Wave ${Math.min(4, this.waveIndex + 1)}/4  •  Defeat Bat King!`
      : `🐦 ${livingBirds} Birds Alive  •  🪙 ${this.coins} Coins  •  🥚 ${this.eggs}/3 Eggs`;
    const statText = this.add
      .text(cardX, cardY - cardH / 2 + 111, statTextStr, {
        fontFamily: FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fed7aa',
      })
      .setOrigin(0.5);
    container.add(statText);

    // Helper button factory
    const makeBtn = (
      yOffset: number,
      label: string,
      color: number,
      borderColor: number,
      textColor: string,
      onClick: () => void
    ) => {
      const btn = this.add.container(cardX, cardY + yOffset);
      const bg = this.add.graphics();
      const bw = 330;
      const bh = 46;

      bg.fillStyle(0x000000, 0.35);
      bg.fillRoundedRect(-bw / 2 + 2, -bh / 2 + 3, bw, bh, 14);
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
      bg.lineStyle(2.5, borderColor, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);

      const txt = this.add
        .text(0, 0, label, {
          fontFamily: FONT,
          fontSize: '17px',
          fontStyle: 'bold',
          color: textColor,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);

      btn.add([bg, txt]);
      btn.setSize(bw, bh).setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => {
        this.tweens.add({ targets: btn, scale: 1.03, duration: 80 });
      });
      btn.on('pointerout', () => {
        this.tweens.add({ targets: btn, scale: 1.0, duration: 80 });
      });
      btn.on('pointerdown', onClick);
      container.add(btn);
      return btn;
    };

    // Button 1: RESUME LEVEL (Primary Green)
    makeBtn(-60, '▶   RESUME LEVEL', 0x166534, 0x22c55e, '#f0fdf4', () => {
      this.closePauseModal();
      this.floatText(W / 2, H / 2 - 80, 'GAME RESUMED ▶', '#4ade80', '#14532d');
    });

    // Button 2: LEVEL DESIGNER (Sky Blue & Royal Indigo)
    makeBtn(-5, '🎨   LEVEL DESIGNER', 0x1e3a8a, 0x38bdf8, '#f0f9ff', () => {
      this.closePauseModal();
      this.levelDesigner.open();
    });

    // Button 3: RESTART LEVEL (Amber / Orange)
    const restartLabel = this.sandbox ? '🎨   SELECT WALLPAPER' : '🔄   RESTART LEVEL';
    makeBtn(50, restartLabel, 0x9a3412, 0xf97316, '#fff7ed', () => {
      this.closePauseModal();
      if (this.sandbox) {
        this.openThemesModal();
      } else {
        AviaryScene.suspendedGame = undefined;
        patchSave({ suspendedSession: undefined });
        this.scene.restart({
          ...this.initData,
          level: this.level,
          pets: this.petKeys,
          challengeId: this.challengeId,
          timeTrial: this.timeTrial,
          sandbox: this.sandbox,
        });
      }
    });

    // Button 4: FIELD LOGBOOK (Purple / Mahogany)
    makeBtn(105, '📖   FIELD LOGBOOK', 0x581c87, 0xa855f7, '#faf5ff', () => {
      this.closePauseModal();
      this.openLogbookModal();
    });

    // Button 5: RETURN TO MAIN MENU (Slate Navy)
    makeBtn(160, '🏕️   MAIN MENU (PAUSE)', 0x1e293b, 0x64748b, '#f8fafc', () => {
      this.closePauseModal();
      this.goToMenu();
    });
  }

  goToMenu() {
    if (this.sandbox) {
      this.saveSandbox();
    }
    const ws = getWorldAndStage(this.level);
    AviaryScene.suspendedGame = {
      mode: this.sandbox ? 'sandbox' : this.timeTrial ? 'timeTrial' : 'campaign',
      level: this.level,
      coins: this.coins,
      gems: this.gems,
      weapon: this.weapon,
      eggs: this.eggs,
      petKeys: [...this.petKeys],
      timeTrialTime: this.timeTrialTime,
      flockCount: this.birds.filter((b) => !b.dead).length,
      label: this.sandbox ? 'My Aviary' : this.timeTrial ? 'Time Trial' : ws.label,
      stageName: this.sandbox ? 'Sanctuary' : this.timeTrial ? 'Score Attack' : ws.stage.name,
    };
    this.gamePaused = true;
    this.modal = false;

    // Save suspended campaign session persistently in localStorage
    if (!this.sandbox && !this.timeTrial) {
      patchSave({
        suspendedSession: {
          level: this.level,
          coins: this.coins,
          weapon: this.weapon,
          eggs: this.eggs,
          petKeys: [...this.petKeys],
          birdCount: this.birds.filter((b) => !b.dead).length,
          stageName: ws.stage.name,
          label: ws.label,
        },
      });
    }

    this.scene.stop('Aviary');
    this.scene.start('Menu', { view: 'main_menu' });
  }

  winNightChallenge() {
    this.ended = true;
    unlockAchievement('bat_challenge_clear', this);
    const sv = loadSave();
    const ch = sv.challenges || {};
    ch['night_bats'] = 'completed';
    const bonusGems = 35;
    patchSave({ challenges: ch, gems: (sv.gems || 0) + bonusGems });
    this.gems = (sv.gems || 0) + bonusGems;

    this.time.delayedCall(500, () => {
      this.overlay(
        '🦇 NIGHT SURVIVED! 🌙',
        [
          'The Vampire Bat King has been vanquished!',
          'Your flock survived the deep midnight swarm!',
          `Challenge Reward: +${bonusGems} Gems!`,
          '🏆 Unlocked Trophy: Nocturnal Navigator',
        ],
        '#c084fc'
      );
      this.bigButton('PLAY AGAIN', 480, () => this.scene.restart({ challengeId: 'night_bats' }));
      const menuBtn = this.add.container(W / 2, 550).setDepth(73);
      const mg = this.add.graphics();
      mg.fillStyle(0x3b0764, 1);
      mg.fillRoundedRect(-120, -10, 240, 50, 16);
      mg.fillStyle(0x7e22ce, 1);
      mg.fillRoundedRect(-120, -14, 240, 50, 16);
      menuBtn.add([
        mg,
        this.add
          .text(0, 11, 'CHALLENGES', {
            fontFamily: FONT,
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#fff',
          })
          .setOrigin(0.5),
      ]);
      menuBtn.setSize(240, 50).setInteractive({ useHandCursor: true });
      menuBtn.on('pointerdown', () => this.scene.start('Menu', { view: 'challenges' }));
    });
  }

  private endTimeTrial() {
    this.ended = true;
    AviaryScene.suspendedGame = undefined;
    patchSave({ suspendedSession: undefined });
    const sv = loadSave();
    const stageScores = sv.timeTrialScores || {};
    const currentStageBest = stageScores[this.level] ?? 0;
    const isStageRecord = this.coins > currentStageBest;
    const newStageBest = Math.max(currentStageBest, this.coins);
    stageScores[this.level] = newStageBest;
    const newOverallBest = Math.max(sv.timeTrialHighScore ?? 0, this.coins);
    const gemsAwarded = Math.max(5, Math.floor(this.coins / 100));

    patchSave({
      timeTrialScores: stageScores,
      timeTrialHighScore: newOverallBest,
      gems: (sv.gems || 0) + gemsAwarded,
      level: Math.max(1, sv.level),
    });
    this.gems = (sv.gems || 0) + gemsAwarded;

    if (this.coins >= 1500) {
      unlockAchievement('speed_demon', this);
    }

    const ws = getWorldAndStage(this.level);
    this.time.delayedCall(400, () => {
      this.overlay(
        `⏱️ ${ws.label} Timed - Time's Up!`,
        [
          `Final Score: ${this.coins} Coins`,
          `Stage Record: ${newStageBest} Coins ${isStageRecord ? '🏆 NEW RECORD!' : ''}`,
          `Reward: +${gemsAwarded} Gems!`,
        ],
        '#ffd54f'
      );
      this.bigButton('PLAY AGAIN', 480, () => this.scene.restart({ timeTrial: true, level: this.level }));
      const menuBtn = this.add.container(W / 2, 550).setDepth(73);
      const mg = this.add.graphics();
      mg.fillStyle(0x1f5f8f, 1);
      mg.fillRoundedRect(-120, -10, 240, 50, 16);
      mg.fillStyle(0x3fa7e8, 1);
      mg.fillRoundedRect(-120, -14, 240, 50, 16);
      menuBtn.add([
        mg,
        this.add
          .text(0, 11, 'CHALLENGES', {
            fontFamily: FONT,
            fontSize: '22px',
            fontStyle: 'bold',
            color: '#fff',
          })
          .setOrigin(0.5),
      ]);
      menuBtn.setSize(240, 50).setInteractive({ useHandCursor: true });
      menuBtn.on('pointerdown', () => this.scene.start('Menu', { view: 'challenges' }));
    });
  }

  // ---------- main loop ----------
  update(time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05);

    for (const c of this.clouds) {
      c.x += 8 * dt * c.scale;
      if (c.x > W + 120) c.x = -120;
    }

    // 2.5D Drifting Particles & Ambient Motes
    const ws = getWorldAndStage(this.level);
    for (const m of this.ambientMotes) {
      if (ws.worldId === 4) {
        // Volcanic rising cinder embers
        m.y -= 26 * dt;
        m.x += Math.sin(time * 0.003 + m.y) * 0.65;
        if (m.y < -10) m.y = 590;
        if (m.x > W + 20) m.x = -20;
        if (m.x < -20) m.x = W + 20;
      } else if (ws.worldId === 3) {
        // Drifting cherry blossom petals
        m.x += 20 * dt;
        m.y += 14 * dt + Math.sin(time * 0.003 + m.x) * 0.55;
        if (m.x > W + 20) m.x = -20;
        if (m.y > 580) m.y = Phaser.Math.Between(10, 80);
      } else {
        m.x += 16 * dt;
        m.y += 10 * dt + Math.sin(time * 0.002 + m.x) * 0.35;
        if (m.x > W + 20) m.x = -20;
        if (m.y > 580) m.y = Phaser.Math.Between(10, 80);
      }
    }

    // Volumetric Sunbeams gentle pulse
    if (this.sunbeams) {
      this.sunbeams.alpha = 0.85 + 0.15 * Math.sin(time * 0.0015);
    }
    if (this.ended || this.modal || this.gamePaused) return;

    // Challenge Goal Status Update
    if (this.challengeGoalText && this.challengeId === 'night_bats') {
      const batKingAlive = this.predators.some((p) => !p.gone && p.kind === 'bat' && p.maxHp > 30);
      if (batKingAlive) {
        this.challengeGoalText.setText('👑 Slay Vampire Bat King!');
        this.challengeGoalText.setColor('#ef4444');
      } else if (this.waveIndex >= 4) {
        this.challengeGoalText.setText('🦇 Slay remaining bats!');
        this.challengeGoalText.setColor('#e879f9');
      } else {
        this.challengeGoalText.setText(`🦇 Wave ${Math.min(4, this.waveIndex + 1)}/4 (Slay Bats!)`);
        this.challengeGoalText.setColor('#f0abfc');
      }
    }

    if (this.timeTrial && !this.ended && !this.modal) {
      this.timeTrialTime -= dt;
      if (this.timeTrialTime <= 0) {
        this.timeTrialTime = 0;
        this.endTimeTrial();
        return;
      }
      const mins = Math.floor(this.timeTrialTime / 60);
      const secs = Math.floor(this.timeTrialTime % 60);
      this.timerText?.setText(`⏱️ ${mins}:${secs < 10 ? '0' : ''}${secs}`);
      if (this.timeTrialTime < 30) {
        this.timerText?.setColor('#ff5252');
      }
    }

    // Disco Mode lights sweep & ball rotation
    if (this.discoMode) {
      this.discoBall?.setRotation(Math.sin(time * 0.003) * 0.25);
      const cols = [0xff007f, 0x00f0ff, 0xffd700, 0x76ff03];
      this.discoLights.forEach((light, i) => {
        const a = time * 0.002 + i * (Math.PI / 2);
        light.x = W / 2 + Math.cos(a) * 360;
        light.y = 350 + Math.sin(a * 1.5) * 140;
        light.fillColor = cols[(Math.floor(time * 0.0015) + i) % cols.length];
      });
    }

    // Rain Dance (Sunshower) animation
    if (this.rainDanceT > 0) {
      this.rainDanceT -= dt;
      for (const r of this.rainStreaks) {
        r.y += 350 * dt;
        if (r.y > 600) r.y = Phaser.Math.Between(10, 80);
      }
      if (this.rainDanceT <= 0) {
        this.rainbow?.setVisible(false);
        this.rainStreaks.forEach((r) => r.destroy());
        this.rainStreaks = [];
        this.birds.forEach((b) => b.setUmbrella(false));
      }
    }

    // Unified Wave Director & Warning Alert System
    if (!this.sandbox && this.birds.filter((b) => !b.dead).length >= 8) {
      unlockAchievement('flock_eight', this);
    }
    const d = difficulty(this.level);
    if (this.waveWarning) {
      this.warningTimer -= dt;
      const secLeft = Math.max(1, Math.ceil(this.warningTimer));
      if (secLeft !== this.lastSirenBeepSec) {
        this.lastSirenBeepSec = secLeft;
        if (this.warningCountdownText?.scene) {
          this.warningCountdownText.setText(`INVASION IN ${secLeft}s...`);
        }
        playSirenSound();
        if (this.warningContainer?.scene) {
          this.tweens.add({
            targets: this.warningContainer,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 90,
            yoyo: true,
          });
        }
      }

      // Vignette pulsing red
      if (this.warningVignette) {
        this.warningVignette.alpha = 0.5 + 0.4 * Math.sin(time * 0.012);
      }

      if (this.warningTimer <= 0) {
        this.dismissWaveWarning();
        for (const e of this.pendingEnemies) {
          this.spawnPredator(e.kind, e.hp);
        }
        this.cameras.main.shake(250, 0.007);
        this.toast(`⚠️ ${this.pendingEnemies.map((e) => e.label).join(' & ')} arrived! Click to fight!`);
        this.pendingEnemies = [];
        this.hadPredators = true;
      }
    } else if (!this.sandbox && !this.ended && this.predators.length === 0) {
      if (this.hadPredators) {
        // Just cleared previous wave!
        this.hadPredators = false;
        playVictoryChirp();
        if (this.challengeId === 'night_bats' && this.waveIndex >= 4) {
          this.winNightChallenge();
          return;
        }
        this.toast(this.challengeId === 'night_bats' ? '🦇 Bat swarm repelled! Prepare for next nocturnal wave...' : 'Flock safe! The predators have retreated.');
        this.waveTimer = this.challengeId === 'night_bats' ? 14 : d.waveInterval + Math.random() * 6;
      } else if (d.firstWaveDelay < 90000 || this.challengeId === 'night_bats') {
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
          let enemies: WaveEnemy[] = [];
          if (this.challengeId === 'night_bats') {
            const w = this.waveIndex++;
            if (w === 0) {
              enemies = [
                { kind: 'bat', hp: 12, label: 'Nocturnal Scout Bat' },
                { kind: 'bat', hp: 12, label: 'Nocturnal Scout Bat' },
              ];
            } else if (w === 1) {
              enemies = [
                { kind: 'bat', hp: 15, label: 'Shadow Bat' },
                { kind: 'bat', hp: 15, label: 'Shadow Bat' },
                { kind: 'bat', hp: 15, label: 'Shadow Bat' },
              ];
            } else if (w === 2) {
              enemies = [
                { kind: 'bat', hp: 18, label: 'Swarm Bat' },
                { kind: 'bat', hp: 18, label: 'Swarm Bat' },
                { kind: 'bat', hp: 18, label: 'Swarm Bat' },
                { kind: 'bat', hp: 18, label: 'Swarm Bat' },
              ];
            } else if (w === 3) {
              enemies = [
                { kind: 'bat', hp: 45, label: '👑 Vampire Bat King' },
                { kind: 'bat', hp: 18, label: 'Vampire Thrall Bat' },
                { kind: 'bat', hp: 18, label: 'Vampire Thrall Bat' },
              ];
            }
          } else {
            enemies = d.getWaveEnemies(this.waveIndex++);
          }
          if (enemies && enemies.length > 0) {
            this.startWaveWarning(enemies);
          } else {
            this.waveTimer = 999999;
          }
        }
      }
    }

    for (const b of [...this.birds]) b.update(dt, time);
    for (const p of this.pets) p.update(dt, time);
    for (const g of this.gliders) g.update(dt, time);
    for (const p of this.predators) {
      p.update(dt, time);
      if (!p.dying && p.stun <= 0) {
        this.checkNestRaid(p, dt);
      }
    }
    this.predators = this.predators.filter((p) => {
      if (p.gone) {
        p.spr.destroy();
        p.bar.destroy();
        return false;
      }
      return true;
    });

    // Guided homing missiles from Bombardier Raptor (Destructor mechanic!)
    for (const m of this.missiles) {
      if (m.destroyed) continue;
      const tx = m.target.dead ? W / 2 : m.target.spr.x;
      const ty = m.target.dead ? 300 : m.target.spr.y;
      const angle = Phaser.Math.Angle.Between(m.img.x, m.img.y, tx, ty);
      m.img.rotation = angle;
      m.img.x += Math.cos(angle) * m.speed * dt;
      m.img.y += Math.sin(angle) * m.speed * dt;

      if (Math.random() < 0.28) {
        this.burst(m.img.x, m.img.y, 0x64748b, 1);
      }

      if (Phaser.Math.Distance.Between(m.img.x, m.img.y, tx, ty) < 28) {
        m.destroyed = true;
        m.img.destroy();
        this.burst(tx, ty, 0xef4444, 25);
        this.burst(tx, ty, 0xff5722, 20);
        this.cameras.main.shake(300, 0.01);
        this.floatText(tx, ty - 35, '💥 DIRECT HIT! ONE-HIT KILL!', '#ef4444', '#450a0a');
        if (!m.target.dead) {
          // Missiles kill in one hit!
          this.killBird(m.target, 'eaten');
          this.toast('A lethal guided missile obliterated your bird in one hit!');
        }
      }
    }
    this.missiles = this.missiles.filter((m) => !m.destroyed);

    const foodFallSpeed = this.hasCompanion('snail') ? 52 : 85;
    for (const f of this.foods) {
      if (!f.landed) {
        if (f.units === 1) {
          // Horizontal helicopter rotor autorotation (Maple samara spin)
          f.spinAngle = (f.spinAngle ?? 0) + 24 * dt;
          f.img.scaleX = Math.cos(f.spinAngle);
          f.img.rotation = -0.15 + 0.12 * Math.sin(f.spinAngle);
          f.img.y += foodFallSpeed * dt;
          f.img.x += Math.sin(f.spinAngle) * 14 * dt; // Gentle spiral aerodynamic drift
          if (f.img.y >= f.groundY) {
            f.img.y = f.groundY;
            f.landed = true;
            f.life = 2.0; // Disappear 2 seconds after landing on the ground
            f.img.scaleX = 1;
            f.img.rotation = 0.2;
          }
        } else if (f.isCinderAcorn) {
          // Heavy volcanic cinder acorn falls with gravity
          const gravity = this.hasCompanion('snail') ? 140 : 300;
          const terminalVel = this.hasCompanion('snail') ? 100 : 230;
          f.vy = Math.min((f.vy ?? 30) + gravity * dt, terminalVel);
          f.img.y += f.vy * dt;
          f.img.rotation += 2.2 * dt;

          if (Math.random() < 0.22) {
            this.burst(f.img.x, f.img.y, 0xff5722, 1);
          }
          if (f.img.y >= f.groundY) {
            f.img.y = f.groundY;
            f.landed = true;
            f.vy = 0;
            f.life = 2.0;
            f.img.rotation = 0;
          }
        } else {
          // Parachuted Corn & Sweet Berries: Drift down slowly, gently swaying on leaf parachutes!
          const chuteSpeed = this.hasCompanion('snail') ? 38 : 58;
          f.sway = (f.sway ?? Math.random() * 6.28) + 3.2 * dt;
          f.img.y += chuteSpeed * dt;
          f.img.x += Math.sin(f.sway) * 16 * dt; // gentle aerodynamic swaying
          f.img.rotation = Math.sin(f.sway) * 0.14; // soft parachute rocking

          if (f.img.y >= f.groundY) {
            f.img.y = f.groundY;
            f.landed = true;
            f.life = 2.0; // Disappear 2 seconds after landing on the ground
            f.img.rotation = 0;
          }
        }
      } else {
        f.life -= dt;
        if (f.life < 0.75) f.img.setAlpha(Math.floor(f.life * 8) % 2 ? 0.25 : 1); // snappy blink before vanishing
      }
    }
    this.foods = this.foods.filter((f) => {
      if (f.life <= 0) {
        this.burst(f.img.x, f.img.y, 0xcab594, 3);
        f.img.destroy();
        f.eaten = true;
        return false;
      }
      return true;
    });

    // Guided homing missiles from Bombardier Raptor (Destructor mechanic!)
    for (const m of this.missiles) {
      if (m.destroyed) continue;
      const tx = m.target.dead ? W / 2 : m.target.spr.x;
      const ty = m.target.dead ? 300 : m.target.spr.y;
      const angle = Phaser.Math.Angle.Between(m.img.x, m.img.y, tx, ty);
      m.img.rotation = angle;
      m.img.x += Math.cos(angle) * m.speed * dt;
      m.img.y += Math.sin(angle) * m.speed * dt;

      if (Math.random() < 0.28) {
        this.burst(m.img.x, m.img.y, 0x64748b, 1);
      }

      if (Phaser.Math.Distance.Between(m.img.x, m.img.y, tx, ty) < 28) {
        m.destroyed = true;
        m.img.destroy();
        this.burst(tx, ty, 0xef4444, 25);
        this.burst(tx, ty, 0xff5722, 20);
        this.cameras.main.shake(300, 0.01);
        this.floatText(tx, ty - 35, '💥 DIRECT HIT! ONE-HIT KILL!', '#ef4444', '#450a0a');
        if (!m.target.dead) {
          // Missiles kill in one hit!
          this.killBird(m.target, 'eaten');
          this.toast('A lethal guided missile obliterated your bird in one hit!');
        }
      }
    }
    this.missiles = this.missiles.filter((m) => !m.destroyed);

    // coins sink slowly, fade on the ground, and are collected on hover
    const p = this.input.activePointer;
    const pointerActive = p.y < BAR_Y && (!p.wasTouch || p.isDown);
    const coinFallSpeed = this.hasCompanion('snail') ? 78 : 130;
    for (const c of this.coinList) {
      if (c.collected) continue;
      if (!c.landed) {
        c.img.y += coinFallSpeed * dt;
        // Soft lateral feather fluttering wobble
        c.phase = (c.phase ?? 0) + 4.2 * dt;
        c.img.x += Math.sin(c.phase) * 44 * dt;
        c.img.rotation = Math.sin(c.phase * 0.85) * 0.32;
        if (c.img.y >= c.groundY) {
          c.img.y = c.groundY;
          c.landed = true;
          c.img.rotation = 0.28; // gently resting feather tilt on ground
        }
      } else {
        c.life -= dt;
        if (c.life < 2.5) {
          c.img.setAlpha(Math.floor(c.life * 8) % 2 ? 0.2 : 1); // rapid urgent blink before vanishing
        }
        if (c.life <= 0) {
          this.burst(c.img.x, c.img.y, 0x9ca3af, 5); // puff of dust when expired
          c.collected = true;
          c.img.destroy();
          continue;
        }
      }
      if (pointerActive && Phaser.Math.Distance.Between(p.x, p.y, c.img.x, c.img.y) < 38) this.collectCoin(c);
    }
    this.coinList = this.coinList.filter((c) => !c.collected);

    // eggs hatching
    for (const s of this.spots) {
      if (!s.egg) continue;
      s.egg.rotation = Math.sin(time * 0.01) * 0.05 * (s.eggT < 5 ? 3 : 1);
      // If a bird is currently resting in the nest, it keeps the egg warm!
      const warmthMult = s.bird && !s.bird.dead ? 1.85 : 1.0;
      s.eggT -= dt * warmthMult;
      if (s.eggT <= 0) {
        this.burst(s.x, s.y - 10, 0xfff5dc, 10);
        s.egg.destroy();
        s.egg = undefined;
        const isFeederInSandbox = this.sandbox;
        const baby = new Bird(this, s.x, s.y - 20, 0, false, false, 'sparrow', isFeederInSandbox);
        baby.parent = s.eggMother;
        this.birds.push(baby);
        s.eggMother = undefined;
        this.toast(this.sandbox ? 'Mama Songbird hatched a Feeder Chick!' : 'A baby songbird hatched!');
        this.refreshUi();
      } else if (s.eggT < 0) {
        s.eggT = 0;
      }
    }

    for (const s of this.shops) this.setBtn(s.btn, !s.enabled() || (s.gem ? this.gems : this.coins) < s.cost() ? 'disabled' : 'normal');
  }
}

