import Phaser from 'phaser';
import { BIRD_CATALOGUE } from './data';

interface BirdLook {
  body: number;
  belly: number;
  wing: number;
  crest?: boolean;
  angry?: boolean;
  beak?: number;
  teeth?: boolean;
  horns?: boolean;
}

/** Growth stages: chick -> fledgling -> adult -> king. */
export const STAGE_LOOKS: BirdLook[] = [
  { body: 0x00b4a0, belly: 0xffd166, wing: 0xf3722c },
  { body: 0x009688, belly: 0xffe45e, wing: 0xe76f51 },
  { body: 0x00b4a0, belly: 0xffd166, wing: 0xf3722c, crest: true },
  { body: 0x00cbb5, belly: 0xffaa33, wing: 0xf77f00, crest: true },
];

const SPECIAL_LOOKS: Record<string, BirdLook> = {
  mama: { body: 0xff8fb0, belly: 0xfff0f5, wing: 0xd9577f },
  nightingale: { body: 0x9e7bd1, belly: 0xffe0f0, wing: 0x6b4aa0, crest: true },
  hawk: { body: 0x6b4a2f, belly: 0xe8dcc8, wing: 0x3e2a18, angry: true, beak: 0xffd23f },
  crow: { body: 0x2a2a35, belly: 0x44444f, wing: 0x1a1a22, angry: true, beak: 0xb0b0b8 },
  phoenix: { body: 0xd32f2f, belly: 0xffd54f, wing: 0xff6f00, crest: true, beak: 0xffeb3b },
  wyvern: { body: 0x3e1828, belly: 0xd84315, wing: 0x1f0814, angry: true, beak: 0xff5722, horns: true },
};

declare global {
  namespace Phaser.GameObjects {
    interface Graphics {
      _penX?: number;
      _penY?: number;
      quadraticCurveTo(cx: number, cy: number, x: number, y: number, segments?: number): this;
      bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number, segments?: number): this;
    }
  }
}

// Polyfill quadraticCurveTo and bezierCurveTo on Phaser Graphics so smooth curves can be drawn
const GProto = Phaser.GameObjects.Graphics.prototype as any;
if (!GProto.quadraticCurveTo) {
  const origMoveTo = GProto.moveTo;
  const origLineTo = GProto.lineTo;
  const origArc = GProto.arc;

  GProto.moveTo = function (x: number, y: number) {
    this._penX = x;
    this._penY = y;
    return origMoveTo.call(this, x, y);
  };

  GProto.lineTo = function (x: number, y: number) {
    this._penX = x;
    this._penY = y;
    return origLineTo.call(this, x, y);
  };

  GProto.arc = function (x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean, overshoot?: number) {
    this._penX = x + radius * Math.cos(endAngle);
    this._penY = y + radius * Math.sin(endAngle);
    return origArc.call(this, x, y, radius, startAngle, endAngle, anticlockwise, overshoot);
  };

  GProto.quadraticCurveTo = function (cx: number, cy: number, x: number, y: number, segments = 8) {
    const x0 = this._penX ?? 0;
    const y0 = this._penY ?? 0;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const inv = 1 - t;
      const px = inv * inv * x0 + 2 * inv * t * cx + t * t * x;
      const py = inv * inv * y0 + 2 * inv * t * cy + t * t * y;
      this.lineTo(px, py);
    }
    return this;
  };

  GProto.bezierCurveTo = function (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number, segments = 12) {
    const x0 = this._penX ?? 0;
    const y0 = this._penY ?? 0;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const inv = 1 - t;
      const px = inv * inv * inv * x0 + 3 * inv * inv * t * cp1x + 3 * inv * t * t * cp2x + t * t * t * x;
      const py = inv * inv * inv * y0 + 3 * inv * inv * t * cp1y + 3 * inv * t * t * cp2y + t * t * t * y;
      this.lineTo(px, py);
    }
    return this;
  };
}

// Safeguard Phaser Frame.prototype.updateUVs against null/destroyed data in WebGL text rendering
const FrameProto = (Phaser.Textures.Frame as any)?.prototype;
if (FrameProto && !FrameProto.__uvs_safeguarded) {
  FrameProto.__uvs_safeguarded = true;
  const origUpdateUVs = FrameProto.updateUVs;
  FrameProto.updateUVs = function () {
    if (!this.data) {
      this.data = {
        cut: { x: this.cutX || 0, y: this.cutY || 0, w: this.cutWidth || 0, h: this.cutHeight || 0, r: 0, b: 0 },
        trim: false,
        sourceSize: { w: this.width || 0, h: this.height || 0 },
        spriteSourceSize: { x: 0, y: 0, w: this.cutWidth || 0, h: this.cutHeight || 0, r: 0, b: 0 },
        radius: 0,
        drawImage: { x: 0, y: 0, width: this.cutWidth || 0, height: this.cutHeight || 0 },
        is3Slice: false,
        scale9: false,
        scale9Borders: { x: 0, y: 0, w: 0, h: 0 },
      };
    } else if (!this.data.drawImage) {
      this.data.drawImage = { x: 0, y: 0, width: this.cutWidth || 0, height: this.cutHeight || 0 };
    }
    return origUpdateUVs.call(this);
  };
}

/** Registers fluid sprite sheet animations for the normal bird (sparrow) evolution sequence. */
export function registerSparrowAnims(scene: Phaser.Scene) {
  for (let s = 0; s <= 2; s++) {
    const sheetKey = `sparrow_${s}_sheet`;
    if (!scene.textures.exists(sheetKey)) continue;

    // Row 0: Flying wing flapping cycle (frames 0 to 5)
    if (!scene.anims.exists(`sparrow_${s}_fly`)) {
      scene.anims.create({
        key: `sparrow_${s}_fly`,
        frames: scene.anims.generateFrameNumbers(sheetKey, { start: 0, end: 5 }),
        frameRate: s === 0 ? 11 : s === 1 ? 10 : 9,
        repeat: -1,
      });
    }

    // Row 1: Twig carrying / nest weaving cycle (frames 6 to 11)
    if (!scene.anims.exists(`sparrow_${s}_twig`)) {
      scene.anims.create({
        key: `sparrow_${s}_twig`,
        frames: scene.anims.generateFrameNumbers(sheetKey, { start: 6, end: 11 }),
        frameRate: s === 0 ? 11 : s === 1 ? 10 : 9,
        repeat: -1,
      });
    }

    // Row 2: Aerodynamic dive / attack plunge cycle (frames 12 to 17)
    if (!scene.anims.exists(`sparrow_${s}_dive`)) {
      scene.anims.create({
        key: `sparrow_${s}_dive`,
        frames: scene.anims.generateFrameNumbers(sheetKey, { start: 12, end: 17 }),
        frameRate: 14,
        repeat: -1,
      });
    }
  }
}

export const HI_RES_SCALE = 3;

function gfx(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const origGenerateTexture = g.generateTexture;

  g.generateTexture = function (key: string | HTMLCanvasElement, width?: number, height?: number): Phaser.GameObjects.Graphics {
    if (typeof key === 'string' && width !== undefined && height !== undefined) {
      g.setScale(HI_RES_SCALE);
      origGenerateTexture.call(g, key, Math.round(width * HI_RES_SCALE), Math.round(height * HI_RES_SCALE));
      g.setScale(1);

      const tex = scene.textures.get(key);
      if (tex) {
        const frame = tex.get('__BASE') as any;
        if (frame && frame.source) {
          frame.source.resolution = HI_RES_SCALE;
          frame.width = width;
          frame.height = height;
          frame.halfWidth = Math.floor(width * 0.5);
          frame.halfHeight = Math.floor(height * 0.5);
          frame.centerX = Math.floor(width / 2);
          frame.centerY = Math.floor(height / 2);
          if (frame.data && frame.data.sourceSize) {
            frame.data.sourceSize.w = width;
            frame.data.sourceSize.h = height;
          }
        }
      }
      return g;
    }
    return origGenerateTexture.call(g, key, width, height);
  };

  return g;
}

/** Pure 2D Procedural Cartoon Art Engine (Simple & Charming Original Concept with Distinct Species Silhouettes) */
function drawSimpleBird(scene: Phaser.Scene, key: string, s: BirdLook, stage: number) {
  const g = gfx(scene);

  const sc = stage === 0 ? 0.72 : stage === 1 ? 0.86 : 1.0;
  const cw = stage === 0 ? 84 : stage === 1 ? 92 : 100;
  const ch = stage === 0 ? 76 : stage === 1 ? 82 : 86;
  const cx = stage === 0 ? 40 : stage === 1 ? 45 : 50;
  const cy = stage === 0 ? 40 : stage === 1 ? 44 : 46;

  const isCat = key === 'infiltrator';
  const isOwl = key === 'owl' || s.horns;
  const isToucan = key === 'toucan';
  const isTreeCreeper = key === 'tree_creeper';
  const isPhoenix = key === 'phoenix';
  const isFalcon = key === 'piranha_finch' || key === 'falcon';
  const isCanary = key === 'canary';
  const isMama = key === 'mama';
  const isHawk = key === 'hawk' || (s.angry && !isFalcon);

  // 1. Cute Little Feet
  const footY = cy + Math.round(34 * sc);
  g.lineStyle(stage === 0 ? 2 : 2.8, 0xf0902a, 1);
  g.lineBetween(cx - Math.round(6 * sc), footY - Math.round(10 * sc), cx - Math.round(6 * sc), footY);
  g.lineBetween(cx + Math.round(8 * sc), footY - Math.round(10 * sc), cx + Math.round(8 * sc), footY);
  g.lineBetween(cx - Math.round(6 * sc), footY, cx - Math.round(10 * sc), footY + 1);
  g.lineBetween(cx + Math.round(8 * sc), footY, cx + Math.round(4 * sc), footY + 1);

  // 2. Distinct Tail Silhouettes
  const tailW = Math.round(24 * sc);
  if (isPhoenix && stage >= 1) {
    // Flowing ribbon streamers with golden ember tips
    g.lineStyle(3, 0xff6f00, 1);
    g.lineBetween(cx - Math.round(24 * sc), cy + Math.round(6 * sc), cx - Math.round(48 * sc), cy + Math.round(18 * sc));
    g.lineBetween(cx - Math.round(48 * sc), cy + Math.round(18 * sc), cx - Math.round(72 * sc), cy + Math.round(36 * sc));
    g.lineStyle(2.2, 0xffd54f, 1);
    g.lineBetween(cx - Math.round(22 * sc), cy + Math.round(10 * sc), cx - Math.round(60 * sc), cy + Math.round(42 * sc));
    g.fillStyle(0xffd54f, 1);
    g.fillCircle(cx - Math.round(72 * sc), cy + Math.round(36 * sc), 4);
    g.fillStyle(0xff3d00, 1);
    g.fillCircle(cx - Math.round(60 * sc), cy + Math.round(42 * sc), 3);
  } else if (isMama) {
    // Fan-shaped gentle dove tail
    g.fillStyle(s.wing, 1);
    g.fillTriangle(cx - 20, cy + 4, cx - 44, cy - 2, cx - 46, cy + 14);
    g.fillTriangle(cx - 20, cy + 8, cx - 46, cy + 14, cx - 38, cy + 22);
  } else if (isFalcon) {
    // Long steering wedge raptor tail
    g.fillStyle(s.wing, 1);
    g.fillTriangle(cx - 22, cy + 2, cx - 48, cy - 4, cx - 44, cy + 16);
    g.fillTriangle(cx - 22, cy + 6, cx - 44, cy + 16, cx - 36, cy + 22);
  } else if (isCanary) {
    // Slender split songster tail
    g.fillStyle(s.wing, 1);
    g.fillTriangle(cx - 18, cy + 6, cx - 44, cy + 2, cx - 40, cy + 12);
    g.fillTriangle(cx - 18, cy + 8, cx - 40, cy + 14, cx - 38, cy + 20);
  } else {
    // Garden songbird notched tail
    g.fillStyle(s.wing, 1);
    g.fillTriangle(
      cx - Math.round(22 * sc), cy + Math.round(4 * sc),
      cx - Math.round(22 * sc) - tailW, cy - Math.round(12 * sc),
      cx - Math.round(22 * sc) - tailW + 4, cy + Math.round(14 * sc)
    );
    if (stage >= 1) {
      g.fillTriangle(
        cx - Math.round(20 * sc), cy + Math.round(8 * sc),
        cx - Math.round(20 * sc) - Math.round(tailW * 0.8), cy + Math.round(18 * sc),
        cx - Math.round(20 * sc) - tailW + 8, cy + Math.round(8 * sc)
      );
    }
  }

  // 3. Head Crest, Ears, or Horns
  const headTopY = cy - Math.round(24 * sc);
  if (isCat) {
    // Pointed cat ears
    g.fillStyle(s.body, 1);
    g.fillTriangle(cx - 14, headTopY + 8, cx - 10, headTopY - 14, cx - 2, headTopY + 6);
    g.fillTriangle(cx + 2, headTopY + 6, cx + 10, headTopY - 14, cx + 14, headTopY + 8);
    g.fillStyle(0xffb6c1, 1);
    g.fillTriangle(cx - 12, headTopY + 7, cx - 10, headTopY - 10, cx - 4, headTopY + 5);
    g.fillTriangle(cx + 4, headTopY + 5, cx + 10, headTopY - 10, cx + 12, headTopY + 7);
  } else if (isOwl) {
    // Prominent owl ear horns
    g.fillStyle(s.wing, 1);
    g.fillTriangle(cx - 18, headTopY + 8, cx - 14, headTopY - 16, cx - 4, headTopY + 6);
    g.fillTriangle(cx + 4, headTopY + 6, cx + 14, headTopY - 16, cx + 18, headTopY + 8);
  } else if (isPhoenix) {
    // Majestic triple flame crest plumes
    g.fillStyle(0xff6f00, 1);
    g.fillTriangle(cx - 6, headTopY + 6, cx, headTopY - 24, cx + 6, headTopY + 6);
    g.fillStyle(0xffeb3b, 1);
    g.fillTriangle(cx + 2, headTopY + 6, cx + 10, headTopY - 18, cx + 14, headTopY + 8);
    g.fillStyle(0xff3d00, 1);
    g.fillTriangle(cx - 14, headTopY + 8, cx - 10, headTopY - 18, cx - 2, headTopY + 6);
  } else if (isCanary) {
    // Petite delicate crown crest tuft
    g.fillStyle(s.wing, 1);
    g.fillTriangle(cx + 2, headTopY + 6, cx + 8, headTopY - 10, cx + 14, headTopY + 6);
  } else if (isMama || s.crest) {
    // Graceful songbird double plume
    g.fillStyle(s.wing, 1);
    g.fillTriangle(cx - 6, headTopY + 6, cx, headTopY - (stage === 0 ? 10 : 16), cx + 6, headTopY + 6);
    g.fillTriangle(cx + 2, headTopY + 6, cx + (stage === 0 ? 6 : 10), headTopY - (stage === 0 ? 8 : 12), cx + 12, headTopY + 8);
  }

  // 4. Distinct Body Silhouettes
  const bw = Math.round(35 * sc);
  const bh = Math.round(31 * sc);
  if (isOwl) {
    // Heavy barrel shape
    g.fillStyle(s.body, 1);
    g.fillEllipse(cx, cy, (bw + 4) * 2, (bh + 3) * 2);
    // Facial disc
    g.fillStyle(s.belly, 1);
    g.fillEllipse(cx + 4, cy - 6, 42 * sc, 30 * sc);
  } else if (isCanary) {
    // Slender upright silhouette
    g.fillStyle(s.body, 1);
    g.fillEllipse(cx, cy, (bw - 5) * 2, (bh + 2) * 2);
  } else if (isToucan) {
    // Stocky tropical body
    g.fillStyle(s.body, 1);
    g.fillEllipse(cx - 2, cy, bw * 2, bh * 2);
  } else {
    // Smooth rounded silhouette
    g.fillStyle(s.body, 1);
    g.fillEllipse(cx, cy, bw * 2, bh * 2);
  }

  // 5. Belly
  const bellyW = Math.round((isCanary ? 18 : 24) * sc);
  const bellyH = Math.round(19 * sc);
  g.fillStyle(s.belly, 1);
  g.fillEllipse(cx + Math.round(4 * sc), cy + Math.round(6 * sc), bellyW * 2, bellyH * 2);

  // Falcon Chest Barring
  if (isFalcon) {
    g.lineStyle(1.4, 0x505f78, 0.75);
    for (const offY of [1, 6, 11, 16]) {
      const byy = cy + Math.round(offY * sc);
      g.lineBetween(cx - Math.round(2 * sc), byy, cx + Math.round(18 * sc), byy);
    }
  }

  // 6. Facial Features & Cheeks
  if (!isOwl) {
    const blushR = Math.round(6 * sc);
    g.fillStyle(0xff8fa3, 0.65);
    g.fillCircle(cx + Math.round(14 * sc), cy + Math.round(8 * sc), blushR);
  }

  // Toucan Cyan Eye Patch
  if (isToucan) {
    g.fillStyle(0x38bdf8, 1);
    g.fillCircle(cx + Math.round(16 * sc), cy - Math.round(8 * sc), Math.round(12 * sc));
  }

  // Falcon Helmet / Dark Mask
  if (isFalcon) {
    g.fillStyle(0x1e2837, 1);
    g.fillTriangle(
      cx + Math.round(4 * sc), headTopY + 10,
      cx + Math.round(24 * sc), cy - Math.round(16 * sc),
      cx + Math.round(20 * sc), cy + Math.round(4 * sc)
    );
  }

  // 7. Eyes
  const eyeX = cx + Math.round(16 * sc);
  const eyeY = cy - Math.round(8 * sc);
  const eyeR = Math.round(9 * sc);
  if (isOwl) {
    // Giant forward golden eyes
    g.fillStyle(0xffd54f, 1);
    g.fillCircle(eyeX + 2, eyeY, eyeR + 2);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(eyeX + 2, eyeY, Math.round(6.5 * sc));
    g.fillStyle(0xffffff, 1);
    g.fillCircle(eyeX + 4, eyeY - 2, Math.max(1, Math.round(2.5 * sc)));
  } else if (isFalcon) {
    // Fierce raptor golden eye with dark brow
    g.fillStyle(0xffd700, 1);
    g.fillCircle(eyeX, eyeY, eyeR);
    g.fillStyle(0x111116, 1);
    g.fillCircle(eyeX + 1, eyeY, Math.round(5.5 * sc));
    g.fillStyle(0xffffff, 1);
    g.fillCircle(eyeX + 2.5, eyeY - 2, Math.max(1, Math.round(2 * sc)));
    g.fillStyle(0x111116, 1);
    g.fillTriangle(eyeX - eyeR, eyeY - eyeR - 1, eyeX + eyeR + 2, eyeY - eyeR + 4, eyeX - eyeR, eyeY - eyeR + 3);
  } else {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(eyeX, eyeY, eyeR);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(eyeX + 2, eyeY + 1, Math.round(6 * sc));
    g.fillStyle(0xffffff, 1);
    g.fillCircle(eyeX + 3.5, eyeY - 2, Math.max(1, Math.round(2.4 * sc)));
  }

  if (s.angry || isHawk) {
    g.fillStyle(0x1a1a1a, 1);
    g.fillTriangle(eyeX - eyeR, eyeY - eyeR - 1, eyeX + eyeR + 3, eyeY - eyeR + 5, eyeX - eyeR, eyeY - eyeR + 4);
  }

  // Whiskers & Nose if Cat (Infiltrator)
  if (isCat) {
    g.fillStyle(0xffb6c1, 1);
    g.fillTriangle(cx + 25, cy - 5, cx + 29, cy - 2, cx + 25, cy + 1);
    g.lineStyle(1.4, 0xffffff, 0.9);
    g.lineBetween(cx + Math.round(18 * sc), cy + Math.round(3 * sc), cx + Math.round(36 * sc), cy + Math.round(1 * sc));
    g.lineBetween(cx + Math.round(18 * sc), cy + Math.round(8 * sc), cx + Math.round(35 * sc), cy + Math.round(12 * sc));
  }

  // 8. Distinct Beaks
  const beakX = cx + Math.round(30 * sc);
  const beakY = cy - Math.round(4 * sc);
  if (isToucan) {
    // MASSIVE Curved Toucan Bill!
    const tbLen = stage === 0 ? 28 : stage === 1 ? 38 : 48;
    g.fillStyle(0xffb703, 1);
    g.fillTriangle(beakX, beakY - 7, beakX + tbLen, beakY + 3, beakX, beakY + 12);
    // Scarlet red tip
    g.fillStyle(0xd90429, 1);
    g.fillTriangle(beakX + tbLen - 16, beakY, beakX + tbLen, beakY + 3, beakX + tbLen - 12, beakY + 10);
    // Dark ridge
    g.lineStyle(1.8, 0x241408, 0.85);
    g.lineBetween(beakX, beakY + 3, beakX + tbLen - 4, beakY + 5);
  } else if (isTreeCreeper) {
    // Slender decurved bark-foraging beak for extracting tree beetles
    const tcbLen = stage === 0 ? 15 : stage === 1 ? 21 : 27;
    g.fillStyle(0xd7ccc8, 1);
    g.fillTriangle(beakX, beakY - 3, beakX + tcbLen, beakY + 4, beakX, beakY + 3);
    g.lineStyle(1.6, 0x8d6e63, 1);
    g.lineBetween(beakX, beakY, beakX + tcbLen, beakY + 4);
  } else if (isFalcon) {
    // Sharp Hooked Raptor Tearing Beak with Tomial Tooth Notch!
    const fbLen = stage === 0 ? 14 : stage === 1 ? 18 : 22;
    g.fillStyle(0xffd700, 1);
    g.fillTriangle(beakX, beakY - 5, beakX + fbLen, beakY + 2, beakX, beakY + 6);
    // Sharp curved tearing hook
    g.fillStyle(0x1a1a1a, 1);
    g.fillTriangle(beakX + fbLen - 6, beakY + 1, beakX + fbLen, beakY + 2, beakX + fbLen - 2, beakY + 10);
  } else if (isCanary) {
    // Slender open singing beak
    g.fillStyle(s.beak ?? 0xffa62b, 1);
    g.fillTriangle(beakX, beakY - 6, beakX + 16, beakY - 2, beakX, beakY);
    g.fillTriangle(beakX, beakY + 1, beakX + 14, beakY + 3, beakX, beakY + 6);
  } else if (isOwl) {
    // Short curved owl beak
    g.fillStyle(s.beak ?? 0xf0b030, 1);
    g.fillTriangle(beakX - 2, beakY - 4, beakX + 10, beakY, beakX - 2, beakY + 5);
    g.fillTriangle(beakX + 4, beakY - 1, beakX + 10, beakY, beakX + 6, beakY + 7);
  } else if (isHawk) {
    // Hooked hawk beak
    g.fillStyle(s.beak ?? 0xffd23f, 1);
    g.fillTriangle(beakX, beakY - 6, beakX + 18, beakY + 3, beakX, beakY + 6);
    g.fillTriangle(beakX + 12, beakY + 2, beakX + 16, beakY + 9, beakX + 6, beakY + 5);
  } else {
    // Cute conical beak
    const bLen = stage === 0 ? 12 : stage === 1 ? 16 : 20;
    g.fillStyle(s.beak ?? 0xffa62b, 1);
    g.fillTriangle(beakX, beakY - Math.round(7 * sc), beakX + bLen, beakY, beakX, beakY + Math.round(7 * sc));
  }

  g.generateTexture(`bird_${key}_${stage}`, cw, ch);
  if (stage === 2) {
    g.generateTexture(`bird_${key}`, cw, ch);
  }
  g.destroy();

  // 9. Distinct Wing Shapes (Shoulder on RIGHT, tapering to flight feathers on LEFT)
  const wwG = gfx(scene);
  const wWidth = stage === 0 ? 36 : stage === 1 ? 42 : (isFalcon ? 52 : isPhoenix ? 50 : 48);
  const wHeight = stage === 0 ? 22 : stage === 1 ? 24 : 26;
  const shoulderX = Math.round(wWidth * 0.78);
  const shoulderY = Math.round(wHeight * 0.5);

  wwG.fillStyle(s.wing, 1);
  // Rounded shoulder joint
  wwG.fillEllipse(shoulderX, shoulderY, Math.round(wWidth * 0.44), wHeight - 2);
  // Flight feather blade extending backwards to the left
  wwG.fillTriangle(
    shoulderX, 2,
    shoulderX, wHeight - 2,
    2, Math.round(wHeight * 0.6)
  );
  // Primary notch
  wwG.fillTriangle(
    Math.round(wWidth * 0.45), wHeight - 1,
    shoulderX, wHeight - 3,
    6, Math.round(wHeight * 0.85)
  );
  // Sheen highlight
  wwG.fillStyle(0xffffff, 0.3);
  wwG.fillEllipse(shoulderX - 4, shoulderY - 3, Math.round(wWidth * 0.38), Math.round(wHeight * 0.38));

  wwG.generateTexture(`wing_${key}_${stage}`, wWidth, wHeight);
  if (stage === 2) {
    wwG.generateTexture(`wing_${key}`, wWidth, wHeight);
  }
  wwG.destroy();
}

function birdTex(scene: Phaser.Scene, key: string, s: BirdLook) {
  drawSimpleBird(scene, key, s, 0);
  drawSimpleBird(scene, key, s, 1);
  drawSimpleBird(scene, key, s, 2);
}

function featherTex(
  scene: Phaser.Scene,
  key: string,
  baseColor: number,
  highlightColor: number,
  stemColor: number,
  accentColor?: number
) {
  const g = gfx(scene);
  const w = 32;
  const h = 36;
  const cx = 16;
  const cy = 18;

  // Outer soft plume silhouette
  g.fillStyle(baseColor, 1);
  g.fillEllipse(cx + 1, cy - 2, 20, 28);

  // Vane barbs / inner fluffy plume
  g.fillStyle(highlightColor, 1);
  g.fillEllipse(cx - 2, cy - 4, 14, 22);

  // Optional eye-spot or iridescent core
  if (accentColor !== undefined) {
    g.fillStyle(accentColor, 1);
    g.fillCircle(cx, cy - 6, 4.5);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - 1, cy - 7, 1.8);
  } else {
    // Soft inner down sheen
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(cx - 2, cy - 6, 6, 12);
  }

  // Central curving rachis / quill stem
  g.lineStyle(2, stemColor, 1);
  g.beginPath();
  g.moveTo(cx - 3, cy + 15);
  g.lineTo(cx, cy);
  g.lineTo(cx + 3, cy - 14);
  g.strokePath();

  // Calamus / quill base
  g.fillStyle(0xf5ebe0, 1);
  g.fillCircle(cx - 3, cy + 15, 1.8);

  g.generateTexture(key, w, h);
  g.destroy();
}

function coinTex(scene: Phaser.Scene, key: string, outer: number, inner: number, ring: number) {
  const g = gfx(scene);
  g.fillStyle(outer, 1);
  g.fillCircle(14, 14, 14);
  g.fillStyle(inner, 1);
  g.fillCircle(14, 14, 11.5);
  g.lineStyle(2, ring, 1);
  g.strokeCircle(14, 14, 8);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(9, 9, 3);
  g.generateTexture(key, 28, 28);
  g.destroy();
}

/** Draws every sprite procedurally so the game needs no image files. */
export function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('coin_gold')) return;

  for (const sp of BIRD_CATALOGUE) birdTex(scene, sp.key, sp);
  STAGE_LOOKS.forEach((l, i) => birdTex(scene, 's' + i, l));
  for (const k of Object.keys(SPECIAL_LOOKS)) birdTex(scene, k, SPECIAL_LOOKS[k]);

  // Natural Bird Feathers Currency (Replaces coins with elegant, fluttering down plumes)
  featherTex(scene, 'feather_silver', 0x94a3b8, 0xe2e8f0, 0x64748b);
  featherTex(scene, 'coin_silver', 0x94a3b8, 0xe2e8f0, 0x64748b);

  featherTex(scene, 'feather_gold', 0xd97706, 0xfde047, 0x92400e);
  featherTex(scene, 'coin_gold', 0xd97706, 0xfde047, 0x92400e);

  featherTex(scene, 'feather_peacock', 0x0284c7, 0x10b981, 0x0f172a, 0xfbbf24);
  featherTex(scene, 'chest', 0x0284c7, 0x10b981, 0x0f172a, 0xfbbf24);

  featherTex(scene, 'feather_phoenix', 0xb91c1c, 0xf97316, 0x450a0a, 0xfde047);

  let g = gfx(scene);
  g.fillStyle(0xe39b00, 1);
  g.fillEllipse(16, 21, 30, 38);
  g.fillStyle(0xffd84a, 1);
  g.fillEllipse(16, 20, 26, 34);
  g.fillStyle(0xffffff, 0.8);
  g.fillEllipse(10, 12, 6, 10);
  g.generateTexture('goldegg', 32, 42);
  g.destroy();

  // currency_dollar (Crisp, unmistakable shiny gold coin with embossed $ symbol for HUD & shop)
  g = gfx(scene);
  g.fillStyle(0x190d05, 0.4);
  g.fillCircle(19, 21, 16);
  g.fillStyle(0xd97706, 1);
  g.fillCircle(18, 18, 16);
  g.fillStyle(0xf59e0b, 1);
  g.fillCircle(18, 18, 14);
  g.fillStyle(0xfde047, 1);
  g.fillCircle(18, 18, 11);
  g.fillStyle(0xb45309, 1);
  g.fillRect(17, 8, 2.5, 20); // vertical $ bar
  g.fillRect(13, 11, 9, 2.2);
  g.fillRect(13, 11, 2.5, 5);
  g.fillRect(13, 16, 9, 2.2);
  g.fillRect(20, 17, 2.5, 5);
  g.fillRect(13, 22, 9, 2.2);
  g.generateTexture('currency_dollar', 38, 38);
  g.destroy();

  // Maple Samara (Helicopter Seed) - Horizontal Rotor Orientation
  g = gfx(scene);
  g.fillStyle(0xdfd4b8, 0.9);
  g.fillEllipse(24, 12, 26, 10);
  g.fillStyle(0xc8b27a, 0.95);
  g.fillTriangle(9, 11, 38, 8, 26, 6);
  g.lineStyle(1.2, 0x8d6e63, 0.75);
  g.lineBetween(9, 12, 37, 10);
  g.lineBetween(15, 12, 25, 16);
  g.lineBetween(22, 11, 31, 15);
  g.lineBetween(28, 10, 36, 14);
  g.fillStyle(0x5d4037, 1);
  g.fillEllipse(9, 12, 10, 8);
  g.fillStyle(0x8d6e63, 1);
  g.fillEllipse(8, 11, 6, 5);
  g.generateTexture('seed', 40, 24);
  g.destroy();

  // Corn with leaf parachute (drifts down gently from the sky)
  g = gfx(scene);
  g.fillStyle(0x22c55e, 1);
  g.fillEllipse(15, 6, 24, 10);
  g.fillStyle(0x16a34a, 1);
  g.fillEllipse(15, 5, 18, 6);
  g.lineStyle(1, 0xdcfce7, 0.85);
  g.lineBetween(6, 7, 12, 17);
  g.lineBetween(24, 7, 18, 17);
  g.fillStyle(0xe0a800, 1);
  g.fillEllipse(15, 24, 14, 17);
  g.fillStyle(0xffe45e, 1);
  g.fillEllipse(14, 23, 10, 13);
  g.lineStyle(1, 0xe0a800, 1);
  g.lineBetween(14, 17, 14, 28);
  g.generateTexture('corn', 30, 36);
  g.destroy();

  // Berry with leaf parachute (sweet canopy fruit gliding down softly)
  g = gfx(scene);
  g.fillStyle(0x22c55e, 1);
  g.fillEllipse(17, 6, 26, 10);
  g.fillStyle(0x16a34a, 1);
  g.fillEllipse(17, 5, 20, 6);
  g.lineStyle(1, 0xdcfce7, 0.85);
  g.lineBetween(7, 7, 13, 17);
  g.lineBetween(27, 7, 21, 17);
  g.fillStyle(0xe0243a, 1);
  g.fillCircle(13, 24, 8);
  g.fillCircle(20, 24, 6);
  g.fillStyle(0xffffff, 0.75);
  g.fillCircle(10, 21, 2);
  g.generateTexture('berry', 34, 36);
  g.destroy();

  // cinder_acorn (Fiery Phoenix-rebirthing nut dropped by Sugar Glider)
  g = gfx(scene);
  g.fillStyle(0xff5722, 0.45);
  g.fillCircle(16, 18, 14);
  g.fillStyle(0xd84315, 1);
  g.fillEllipse(16, 20, 16, 18);
  g.fillStyle(0xffa000, 1);
  g.fillEllipse(16, 19, 11, 13);
  g.fillStyle(0xfff176, 1);
  g.fillCircle(16, 18, 4);
  g.fillStyle(0x3e2723, 1);
  g.fillRoundedRect(7, 8, 18, 8, 3);
  g.lineStyle(1.5, 0xff5722, 1);
  g.lineBetween(16, 8, 16, 3);
  g.generateTexture('cinder_acorn', 32, 34);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xfff5dc, 1);
  g.fillEllipse(14, 18, 24, 30);
  g.fillStyle(0xe2c9a0, 1);
  g.fillCircle(9, 20, 2);
  g.fillCircle(18, 13, 2);
  g.fillCircle(17, 24, 1.6);
  g.generateTexture('egg', 28, 36);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0x8a5528, 1);
  g.fillEllipse(8, 11, 13, 14);
  g.fillStyle(0xc8934f, 1);
  g.fillEllipse(8, 12, 9, 10);
  g.fillStyle(0x5a3418, 1);
  g.fillEllipse(8, 5, 15, 7);
  g.fillRect(7, 0, 2, 4);
  g.generateTexture('acorn', 16, 18);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xffc700, 1);
  g.fillTriangle(2, 20, 4, 4, 11, 14);
  g.fillTriangle(10, 14, 17, 0, 24, 14);
  g.fillTriangle(23, 14, 30, 4, 32, 20);
  g.fillRect(2, 14, 30, 7);
  g.fillStyle(0xe0243a, 1);
  g.fillCircle(17, 17, 2.5);
  g.generateTexture('crown', 34, 22);
  g.destroy();

  // --- Weapons: Stick, Slingshot, Bow, Rifle, Laser ---
  g = gfx(scene);
  g.lineStyle(6, 0x6d4c41, 1);
  g.lineBetween(8, 30, 28, 6);
  g.lineStyle(2, 0x4e342e, 1);
  g.lineBetween(12, 26, 15, 23);
  g.lineBetween(21, 15, 24, 12);
  g.lineStyle(3, 0x6d4c41, 1);
  g.lineBetween(20, 16, 26, 12);
  g.fillStyle(0x43a047, 1);
  g.fillEllipse(28, 10, 8, 4);
  g.fillEllipse(25, 6, 7, 3);
  g.lineStyle(1, 0x2e7d32, 1);
  g.lineBetween(24, 10, 31, 10);
  g.generateTexture('weapon_stick', 36, 36);
  g.destroy();

  g = gfx(scene);
  g.lineStyle(5.5, 0x8a5528, 1);
  g.lineBetween(16, 38, 16, 22);
  g.lineBetween(16, 22, 6, 8);
  g.lineBetween(16, 22, 26, 8);
  g.lineStyle(2.5, 0xe53935, 1);
  g.lineBetween(6, 8, 16, 16);
  g.lineBetween(26, 8, 16, 16);
  g.fillStyle(0x4e342e, 1);
  g.fillCircle(16, 16, 4);
  g.fillStyle(0x9e9e9e, 1);
  g.fillCircle(16, 15, 2.5);
  g.generateTexture('slingshot', 32, 40);
  g.generateTexture('weapon_slingshot', 32, 40);
  g.destroy();

  g = gfx(scene);
  g.lineStyle(4, 0x8d5b28, 1);
  g.lineBetween(8, 5, 22, 18);
  g.lineBetween(22, 18, 8, 31);
  g.lineStyle(5, 0x5c3818, 1);
  g.lineBetween(8, 5, 11, 8);
  g.lineBetween(8, 31, 11, 28);
  g.lineStyle(1.5, 0xffffff, 0.95);
  g.lineBetween(8, 5, 8, 31);
  g.lineStyle(2, 0xbcaaa4, 1);
  g.lineBetween(6, 18, 30, 18);
  g.fillStyle(0x78909c, 1);
  g.fillTriangle(34, 18, 29, 14, 29, 22);
  g.fillStyle(0xe53935, 1);
  g.fillTriangle(7, 18, 4, 14, 10, 14);
  g.fillTriangle(7, 18, 4, 22, 10, 22);
  g.generateTexture('weapon_bow', 36, 36);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0x6d4c41, 1);
  g.fillRoundedRect(4, 12, 14, 10, 3);
  g.fillStyle(0x475569, 1);
  g.fillRect(14, 11, 25, 5);
  g.fillRect(12, 14, 8, 5);
  g.fillRect(37, 8, 2, 4);
  g.lineStyle(1.5, 0xd97706, 1);
  g.lineBetween(14, 17, 18, 21);
  g.lineBetween(18, 21, 20, 16);
  g.generateTexture('weapon_rifle', 42, 26);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xd90429, 1);
  g.fillRoundedRect(8, 14, 8, 12, 3);
  g.fillStyle(0xe2e8f0, 1);
  g.fillRoundedRect(12, 8, 16, 10, 4);
  g.fillStyle(0x00f0ff, 1);
  g.fillRect(16, 9, 3, 8);
  g.fillRect(21, 9, 3, 8);
  g.fillStyle(0x94a3b8, 1);
  g.fillTriangle(28, 8, 38, 11, 28, 16);
  g.fillStyle(0x00ffff, 1);
  g.fillCircle(37, 13, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(37, 13, 1.5);
  g.generateTexture('weapon_laser', 40, 28);
  g.destroy();

  g = gfx(scene);
  g.lineStyle(2, 0xd7ccc8, 1);
  g.lineBetween(2, 5, 24, 5);
  g.fillStyle(0x90a4ae, 1);
  g.fillTriangle(29, 5, 23, 2, 23, 8);
  g.fillStyle(0xef4444, 1);
  g.fillTriangle(4, 5, 1, 2, 7, 2);
  g.fillTriangle(4, 5, 1, 8, 7, 8);
  g.generateTexture('arrow', 30, 10);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0x334155, 1);
  g.fillRoundedRect(4, 20, 24, 8, 2);
  g.fillStyle(0xef4444, 1);
  g.fillRoundedRect(7, 6, 18, 15, 6);
  g.fillStyle(0xffffff, 0.8);
  g.fillEllipse(12, 10, 4, 7);
  g.generateTexture('siren_light', 32, 32);
  g.destroy();

  g = gfx(scene);
  // Organic puffy cumulus cloud with gentle rounded shading (no flat smeared rectangle)
  g.fillStyle(0xf1f5f9, 0.95);
  g.fillCircle(48, 54, 26);
  g.fillCircle(82, 58, 28);
  g.fillCircle(124, 58, 28);
  g.fillCircle(156, 52, 24);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(54, 48, 28);
  g.fillCircle(90, 38, 36);
  g.fillCircle(132, 40, 32);
  g.fillCircle(154, 48, 24);
  g.fillCircle(88, 54, 30);
  g.fillCircle(122, 54, 28);
  g.generateTexture('cloud', 196, 92);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(5, 5, 5);
  g.generateTexture('spark', 10, 10);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0x4fc3f7, 1);
  g.fillTriangle(15, 2, 2, 11, 28, 11);
  g.fillStyle(0x0288d1, 1);
  g.fillTriangle(2, 11, 28, 11, 15, 28);
  g.fillStyle(0xb3e5fc, 1);
  g.fillTriangle(15, 2, 8, 11, 15, 11);
  g.fillStyle(0x29b6f6, 1);
  g.fillTriangle(8, 11, 22, 11, 15, 28);
  g.generateTexture('gem', 30, 30);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xe0f7fa, 1);
  g.fillTriangle(16, 2, 4, 11, 28, 11);
  g.fillStyle(0x00e5ff, 1);
  g.fillTriangle(4, 11, 28, 11, 16, 30);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(16, 2, 10, 11, 16, 11);
  g.fillStyle(0x84ffff, 1);
  g.fillTriangle(10, 11, 22, 11, 16, 30);
  g.generateTexture('gem_diamond', 32, 32);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xdfeaf2, 1);
  g.fillRoundedRect(8, 0, 10, 10, 2);
  g.fillStyle(0x8a5528, 1);
  g.fillRect(8, 0, 10, 4);
  g.fillStyle(0xb48cff, 1);
  g.fillCircle(13, 22, 11);
  g.fillStyle(0xe6d4ff, 1);
  g.fillCircle(9, 19, 3);
  g.generateTexture('potion', 26, 34);
  g.destroy();

  // Santa hat
  g = gfx(scene);
  g.fillStyle(0xd32f2f, 1);
  g.fillTriangle(4, 24, 18, 2, 32, 24);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(2, 22, 32, 8, 4);
  g.fillCircle(18, 3, 5);
  g.generateTexture('hat_santa', 36, 32);
  g.destroy();

  // Archimedes wire-rim glasses
  g = gfx(scene);
  g.lineStyle(2, 0xd4af37, 1);
  g.strokeCircle(9, 9, 8);
  g.strokeCircle(25, 9, 8);
  g.lineBetween(17, 9, 17, 9);
  g.fillStyle(0xe0f7fa, 0.4);
  g.fillCircle(9, 9, 7);
  g.fillCircle(25, 9, 7);
  g.generateTexture('glasses_archimedes', 34, 18);
  g.destroy();

  // Pirate hat & eyepatch
  g = gfx(scene);
  g.fillStyle(0x1a1a1a, 1);
  g.fillEllipse(20, 16, 38, 18);
  g.fillTriangle(2, 22, 20, 4, 38, 22);
  g.lineStyle(2, 0xffd700, 1);
  g.lineBetween(6, 20, 34, 20);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(20, 12, 3);
  g.fillRect(19, 14, 2, 4);
  g.generateTexture('hat_pirate', 40, 24);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0x111111, 1);
  g.fillCircle(8, 8, 6);
  g.lineStyle(1.5, 0x111111, 1);
  g.lineBetween(0, 4, 16, 12);
  g.generateTexture('eyepatch', 16, 16);
  g.destroy();

  // Natural bird eyelid for lifelike blinking animation
  g = gfx(scene);
  g.fillStyle(0x00796b, 1);
  g.fillEllipse(9, 6, 16, 9);
  g.lineStyle(1.5, 0x142823, 1);
  g.strokeEllipse(9, 6, 16, 9);
  g.generateTexture('bird_eyelid', 18, 12);
  g.destroy();

  // sparrow_twig (Branch fetched by bird for nest building matching Reference Sheets Row 2!)
  g = gfx(scene);
  g.lineStyle(3.2, 0x5a3418, 1);
  g.beginPath();
  g.moveTo(2, 14);
  g.lineTo(28, 8);
  g.strokePath();
  g.lineStyle(2.4, 0x5a3418, 1);
  g.beginPath();
  g.moveTo(18, 10);
  g.lineTo(26, 2);
  g.strokePath();
  g.fillStyle(0x4ade80, 1);
  g.fillCircle(28, 8, 2.5);
  g.fillCircle(26, 2, 2);
  g.generateTexture('sparrow_twig', 32, 18);
  g.destroy();

  // Hedwig Hogwarts wax-sealed envelope
  g = gfx(scene);
  g.fillStyle(0xfff8e7, 1);
  g.fillRoundedRect(2, 2, 32, 22, 3);
  g.lineStyle(1.5, 0xd7ccc8, 1);
  g.strokeRoundedRect(2, 2, 32, 22, 3);
  g.lineBetween(2, 2, 18, 14);
  g.lineBetween(34, 2, 18, 14);
  g.fillStyle(0xb71c1c, 1);
  g.fillCircle(18, 13, 4);
  g.fillStyle(0xffd700, 1);
  g.fillCircle(18, 13, 1.5);
  g.generateTexture('drop_envelope', 36, 26);
  g.destroy();

  // Candy cane
  g = gfx(scene);
  g.lineStyle(6, 0xffffff, 1);
  g.beginPath();
  g.moveTo(7, 28);
  g.lineTo(7, 10);
  g.arc(13, 10, 6, Math.PI, 0, false);
  g.strokePath();
  g.lineStyle(3, 0xd32f2f, 1);
  for (let i = 0; i < 4; i++) {
    g.lineBetween(4, 24 - i * 5, 10, 22 - i * 5);
  }
  g.generateTexture('drop_candycane', 22, 30);
  g.destroy();

  // Golden Pinecone (environmental secret)
  g = gfx(scene);
  g.fillStyle(0xb78103, 1);
  g.fillEllipse(15, 18, 24, 30);
  g.fillStyle(0xffd700, 1);
  for (let y = 8; y <= 26; y += 6) {
    for (let x = 7; x <= 23; x += 6) {
      g.fillCircle(x, y, 3.5);
    }
  }
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(10, 10, 2);
  g.generateTexture('drop_pinecone', 30, 36);
  g.destroy();

  // Baguette bread crumb (BREAD cheat)
  g = gfx(scene);
  g.fillStyle(0xc68a4c, 1);
  g.fillEllipse(18, 12, 34, 18);
  g.fillStyle(0xf5d6a7, 1);
  g.fillEllipse(18, 12, 28, 12);
  g.lineStyle(2, 0x8d5b2d, 1);
  g.lineBetween(10, 7, 14, 16);
  g.lineBetween(18, 7, 22, 16);
  g.lineBetween(26, 7, 30, 16);
  g.generateTexture('drop_baguette', 36, 24);
  g.destroy();

  // Shiny key & ring (MURDER crow trinkets)
  g = gfx(scene);
  g.lineStyle(2, 0xc0c0c0, 1);
  g.strokeCircle(8, 10, 6);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(7, 9, 2);
  g.fillRect(14, 9, 14, 2);
  g.fillRect(22, 11, 2, 4);
  g.fillRect(26, 11, 2, 5);
  g.generateTexture('drop_trinket_key', 30, 20);
  g.destroy();

  g = gfx(scene);
  g.lineStyle(3, 0xffd700, 1);
  g.strokeCircle(12, 14, 9);
  g.fillStyle(0xe91e63, 1);
  g.fillTriangle(12, 2, 7, 8, 17, 8);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(12, 5, 2);
  g.generateTexture('drop_trinket_ring', 24, 24);
  g.destroy();

  // Disco Ball (DISCO cheat)
  g = gfx(scene);
  g.lineStyle(2, 0xcccccc, 1);
  g.lineBetween(20, 0, 20, 10);
  g.fillStyle(0xbbbbbb, 1);
  g.fillCircle(20, 26, 16);
  g.lineStyle(1, 0x555555, 0.5);
  for (let i = -12; i <= 12; i += 5) {
    g.lineBetween(20 + i, 12, 20 + i, 40);
    g.lineBetween(6, 26 + i, 34, 26 + i);
  }
  g.fillStyle(0xffffff, 0.9);
  g.fillRect(15, 18, 3, 3);
  g.fillRect(24, 22, 3, 3);
  g.fillRect(18, 30, 3, 3);
  g.generateTexture('discoball', 40, 44);
  g.destroy();

  // Umbrella (Rain dance)
  g = gfx(scene);
  g.fillStyle(0xff6b81, 1);
  g.fillCircle(16, 14, 14);
  g.fillStyle(0x59b8f2, 1);
  g.fillRect(2, 14, 28, 14);
  g.lineStyle(2, 0x8a5528, 1);
  g.lineBetween(16, 8, 16, 26);
  g.beginPath();
  g.arc(13, 26, 3, 0, Math.PI, false);
  g.strokePath();
  g.generateTexture('umbrella', 32, 32);
  g.destroy();

  // Googly eye (DERP cheat)
  g = gfx(scene);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(10, 10, 9);
  g.lineStyle(1.5, 0x000000, 1);
  g.strokeCircle(10, 10, 9);
  g.fillStyle(0x000000, 1);
  g.fillCircle(8, 11, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(9, 9, 2);
  g.generateTexture('googly_eye', 20, 20);
  g.destroy();

  // Tawny Frogmouth Stick Bug - Disguised for each World's unique tree bark
  const stickBugThemes = [
    { id: 1, bgCol: 0x5c381e, lineCol: 0x3d2311, knotCol: 0x422613, fleckCol: 0x4d7c0f, eyeCol: 0xffe600, pupilCol: 0x0a0a0a },
    { id: 2, bgCol: 0x313d1e, lineCol: 0x1f2713, knotCol: 0x242e16, fleckCol: 0x10b981, eyeCol: 0xfacc15, pupilCol: 0x0a0a0a },
    { id: 3, bgCol: 0x442b26, lineCol: 0x271613, knotCol: 0x331e1a, fleckCol: 0xfbcfe8, eyeCol: 0xf472b6, pupilCol: 0x1c0514 },
    { id: 4, bgCol: 0x221f26, lineCol: 0x110f14, knotCol: 0x17141a, fleckCol: 0xef4444, eyeCol: 0xff4500, pupilCol: 0xffd700 },
  ];

  for (const st of stickBugThemes) {
    // Hidden
    g = gfx(scene);
    g.fillStyle(st.bgCol, 1);
    g.fillRoundedRect(2, 4, 40, 16, 6);
    g.lineStyle(1.5, st.lineCol, 1);
    g.lineBetween(6, 9, 36, 9);
    g.lineBetween(8, 14, 34, 14);
    g.fillStyle(st.knotCol, 1);
    g.fillCircle(18, 12, 2.5);
    g.fillStyle(st.fleckCol, 0.85);
    g.fillCircle(10, 6, 1.6);
    g.fillCircle(30, 16, 1.6);
    if (st.id === 4) {
      // Volcanic magma crack
      g.lineStyle(1.2, 0xef4444, 0.9);
      g.lineBetween(14, 11, 26, 11);
    }
    g.generateTexture(`stick_bug_hidden_${st.id}`, 44, 24);
    if (st.id === 1) g.generateTexture('stick_bug_hidden', 44, 24);
    g.destroy();

    // Peeking
    g = gfx(scene);
    g.fillStyle(st.bgCol, 1);
    g.fillRoundedRect(2, 4, 40, 16, 6);
    g.lineStyle(1.5, st.lineCol, 1);
    g.lineBetween(6, 9, 36, 9);
    g.lineBetween(8, 14, 34, 14);
    g.fillStyle(st.knotCol, 1);
    g.fillCircle(18, 12, 2.5);
    g.fillStyle(st.fleckCol, 0.85);
    g.fillCircle(10, 6, 1.6);
    g.fillCircle(30, 16, 1.6);
    if (st.id === 4) {
      g.lineStyle(1.2, 0xef4444, 0.9);
      g.lineBetween(14, 11, 26, 11);
    }
    // Eyes
    g.fillStyle(st.eyeCol, 1);
    g.fillCircle(14, 11, 5);
    g.fillCircle(26, 11, 5);
    g.fillStyle(st.pupilCol, 1);
    g.fillCircle(14.5, 11, 2.8);
    g.fillCircle(26.5, 11, 2.8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(15.5, 10, 1.2);
    g.fillCircle(27.5, 10, 1.2);
    g.generateTexture(`stick_bug_peeking_${st.id}`, 44, 24);
    if (st.id === 1) {
      g.generateTexture('stick_bug_peeking', 44, 24);
      g.generateTexture('frogmouth_stick', 44, 24);
    }
    g.destroy();
  }

  // Sacred Phoenix Pyre Altar
  g = gfx(scene);
  g.fillStyle(0x3e2723, 1);
  g.fillRect(10, 28, 24, 12);
  g.fillStyle(0x5d4037, 1);
  g.fillRoundedRect(6, 22, 32, 10, 4);
  g.fillStyle(0x8d6e63, 1);
  g.fillEllipse(22, 22, 28, 12);
  g.fillStyle(0xd84315, 1);
  g.fillTriangle(12, 20, 22, 0, 32, 20);
  g.fillStyle(0xff9800, 1);
  g.fillTriangle(15, 20, 22, 4, 29, 20);
  g.fillStyle(0xffeb3b, 1);
  g.fillTriangle(18, 20, 22, 8, 26, 20);
  g.generateTexture('pyre_altar', 44, 42);
  g.destroy();

  // Solar Ember (Phoenix drop, 500c)
  g = gfx(scene);
  g.fillStyle(0xff3d00, 0.35);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0xff6d00, 0.7);
  g.fillCircle(16, 16, 12);
  g.fillStyle(0xffd600, 1);
  g.fillCircle(16, 16, 8.5);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(14, 13, 3);
  g.generateTexture('drop_solar_ember', 32, 32);
  g.destroy();

  // Golden Tree Beetle (Cruncher drop, 150c)
  g = gfx(scene);
  // Legs
  g.lineStyle(1.8, 0x854d0e, 1);
  g.lineBetween(8, 10, 3, 7);
  g.lineBetween(8, 16, 2, 16);
  g.lineBetween(8, 22, 4, 25);
  g.lineBetween(24, 10, 29, 7);
  g.lineBetween(24, 16, 30, 16);
  g.lineBetween(24, 22, 28, 25);
  // Antennae
  g.lineBetween(13, 8, 8, 2);
  g.lineBetween(19, 8, 24, 2);
  // Carapace / Body (Iridescent Golden Bronze & Emerald)
  g.fillStyle(0xd97706, 1);
  g.fillEllipse(16, 17, 18, 22);
  g.fillStyle(0x84cc16, 0.7);
  g.fillEllipse(16, 17, 14, 18);
  g.fillStyle(0xfde047, 1);
  g.fillEllipse(16, 17, 10, 14);
  // Wing split seam
  g.lineStyle(1.5, 0x78350f, 0.9);
  g.lineBetween(16, 8, 16, 26);
  // Head & Eyes
  g.fillStyle(0x92400e, 1);
  g.fillCircle(16, 8, 4.5);
  g.fillStyle(0x000000, 1);
  g.fillCircle(13, 7, 1.5);
  g.fillCircle(19, 7, 1.5);
  // Specular sheen
  g.fillStyle(0xffffff, 0.85);
  g.fillEllipse(13, 14, 3, 6);
  g.generateTexture('drop_beetle', 32, 32);
  g.destroy();

  // Luminous Forest Pearl (Toucan drop, 500c)
  g = gfx(scene);
  // Radiant soft aura
  g.fillStyle(0x38bdf8, 0.25);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0xf472b6, 0.28);
  g.fillCircle(16, 16, 13);
  // Pearl luster sphere
  g.fillStyle(0xf1f5f9, 1);
  g.fillCircle(16, 16, 11);
  g.fillStyle(0xe0e7ff, 0.8);
  g.fillCircle(16, 16, 9.5);
  g.fillStyle(0xfff1f2, 0.7);
  g.fillCircle(15, 15, 7.5);
  // Pearlescent gleam star
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(12, 12, 3.5);
  g.fillCircle(18, 19, 1.8);
  g.generateTexture('drop_pearl', 32, 32);
  g.destroy();

  // Amber Nectar Pod (Ember Shrike drop, 200c - Food for Sugar Glider)
  g = gfx(scene);
  // Warm golden amber aura
  g.fillStyle(0xf59e0b, 0.28);
  g.fillCircle(16, 17, 15);
  // Honey teardrop droplet body
  g.fillStyle(0xd97706, 1);
  g.fillEllipse(16, 19, 18, 20);
  g.fillStyle(0xfbbf24, 1);
  g.fillEllipse(16, 20, 14, 15);
  // Droplet tip tapering up
  g.fillStyle(0xd97706, 1);
  g.fillTriangle(10, 16, 22, 16, 16, 4);
  g.fillStyle(0xfde047, 0.92);
  g.fillTriangle(12, 17, 20, 17, 16, 7);
  // Specular gleam
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(13, 15, 3.2);
  g.fillCircle(18, 22, 1.6);
  g.generateTexture('drop_nectar', 32, 32);
  g.destroy();

  // ---- pets ----
  g = gfx(scene);
  g.fillStyle(0x5a4030, 1);
  for (let a = Math.PI; a <= Math.PI * 2 + 0.2; a += 0.28) {
    const x = 36 + Math.cos(a) * 30;
    const y = 30 + Math.sin(a) * 22;
    g.fillTriangle(x - 4, y + 3, x + 4, y + 3, x + Math.cos(a) * 9, y + Math.sin(a) * 9 - 2);
  }
  g.fillEllipse(36, 32, 60, 38);
  g.fillStyle(0xc9a078, 1);
  g.fillEllipse(30, 46, 14, 8);
  g.fillEllipse(52, 46, 14, 8);
  g.fillStyle(0xf0d2a8, 1);
  g.fillEllipse(62, 36, 32, 24);
  g.fillStyle(0x222222, 1);
  g.fillCircle(76, 37, 3.5);
  g.fillCircle(68, 30, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(69, 29, 1);
  g.fillStyle(0xff8fa3, 0.6);
  g.fillCircle(64, 40, 4);
  g.generateTexture('pet_hedgehog', 82, 52);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xd9772b, 1);
  g.fillEllipse(18, 48, 32, 60);
  g.fillStyle(0xf2a85a, 1);
  g.fillEllipse(18, 44, 18, 44);
  g.fillStyle(0xe38b3c, 1);
  g.fillEllipse(40, 56, 34, 44);
  g.fillStyle(0xfff0d8, 1);
  g.fillEllipse(44, 60, 20, 28);
  g.fillStyle(0xe38b3c, 1);
  g.fillCircle(44, 28, 16);
  g.fillTriangle(32, 20, 34, 4, 42, 16);
  g.fillTriangle(48, 16, 54, 4, 58, 20);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(50, 26, 5);
  g.fillStyle(0x222222, 1);
  g.fillCircle(51, 27, 3);
  g.fillCircle(58, 32, 2.5);
  g.fillStyle(0xff8fa3, 0.6);
  g.fillCircle(52, 35, 4);
  g.fillStyle(0xc8934f, 1);
  g.fillEllipse(48, 62, 10, 12);
  g.generateTexture('pet_squirrel', 66, 84);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xff7ac8, 1);
  g.fillEllipse(16, 16, 26, 24);
  g.fillEllipse(44, 16, 26, 24);
  g.fillStyle(0xb48cff, 1);
  g.fillEllipse(19, 35, 18, 18);
  g.fillEllipse(41, 35, 18, 18);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(14, 14, 4);
  g.fillCircle(46, 14, 4);
  g.fillStyle(0x4a2c12, 1);
  g.fillRoundedRect(27, 10, 6, 32, 3);
  g.lineStyle(2, 0x4a2c12, 1);
  g.lineBetween(30, 10, 24, 2);
  g.lineBetween(30, 10, 36, 2);
  g.generateTexture('pet_butterfly', 60, 46);
  g.destroy();

  g = gfx(scene);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(14, 40, 0, 20, 8, 52);
  g.fillEllipse(40, 46, 64, 46);
  g.fillStyle(0xe8e0d0, 1);
  g.fillEllipse(34, 48, 32, 22);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(64, 28, 15);
  g.fillStyle(0xe0243a, 1);
  g.fillCircle(60, 12, 5);
  g.fillCircle(67, 10, 5);
  g.fillCircle(73, 14, 4);
  g.fillCircle(72, 42, 4);
  g.fillStyle(0xffa62b, 1);
  g.fillTriangle(76, 24, 90, 30, 76, 35);
  g.fillStyle(0x222222, 1);
  g.fillCircle(68, 25, 3);
  g.lineStyle(3, 0xf0902a, 1);
  g.lineBetween(34, 66, 34, 74);
  g.lineBetween(48, 66, 48, 74);
  g.generateTexture('pet_hen', 92, 76);

  // pet_nightingale
  g.clear();
  g.fillStyle(0x9e7bd1, 1);
  g.fillEllipse(36, 42, 50, 36);
  g.fillStyle(0xffe0f0, 1);
  g.fillEllipse(44, 46, 32, 24);
  g.fillStyle(0x9e7bd1, 1);
  g.fillCircle(54, 25, 18);
  g.fillStyle(0xba68c8, 1);
  g.fillCircle(48, 12, 6);
  g.fillCircle(56, 10, 6);
  g.fillCircle(64, 13, 5);
  g.fillStyle(0x222222, 1);
  g.fillCircle(58, 23, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(59, 22, 1);
  g.fillStyle(0xffb300, 1);
  g.fillTriangle(68, 23, 80, 27, 68, 31);
  g.fillStyle(0x6b4aa0, 1);
  g.fillEllipse(28, 42, 34, 18);
  g.lineStyle(2, 0xffb300, 1);
  g.lineBetween(32, 58, 32, 66);
  g.lineBetween(42, 58, 42, 66);
  g.generateTexture('pet_nightingale', 88, 72);

  // ---------- New Companions (1-1 to 4-4) ----------
  // pet_badger (Barnaby)
  g.clear();
  g.fillStyle(0x374151, 1);
  g.fillEllipse(38, 32, 60, 32);
  g.fillStyle(0x1f2937, 1);
  g.fillEllipse(56, 26, 28, 22);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(52, 16, 74, 25, 52, 22);
  g.fillTriangle(52, 34, 74, 27, 52, 30);
  g.fillStyle(0x111827, 1);
  g.fillCircle(66, 24, 2.5);
  g.fillStyle(0x000000, 1);
  g.fillCircle(73, 26, 3);
  g.lineStyle(3, 0x111827, 1);
  g.lineBetween(26, 44, 26, 50);
  g.lineBetween(48, 44, 48, 50);
  g.generateTexture('pet_badger', 80, 52);

  // pet_porcupine (Bristle)
  g.clear();
  g.fillStyle(0x4b382a, 1);
  g.fillEllipse(36, 30, 52, 32);
  g.fillStyle(0x6b4a2e, 1);
  g.fillCircle(56, 30, 14);
  g.fillStyle(0x111111, 1);
  g.fillCircle(61, 28, 2.5);
  g.fillCircle(67, 31, 2);
  g.lineStyle(2, 0xe5e7eb, 1);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.2 - i * 0.22;
    g.lineBetween(32 + Math.cos(a) * 16, 28 + Math.sin(a) * 12, 32 + Math.cos(a) * 32, 28 + Math.sin(a) * 24);
  }
  g.generateTexture('pet_porcupine', 78, 50);

  // pet_quail (Flora)
  g.clear();
  g.fillStyle(0x8d6e63, 1);
  g.fillEllipse(32, 36, 46, 34);
  g.fillStyle(0xd7ccc8, 1);
  g.fillEllipse(38, 40, 28, 20);
  g.fillStyle(0x6d4c41, 1);
  g.fillCircle(46, 22, 14);
  g.fillStyle(0x222222, 1);
  g.fillCircle(49, 20, 2.5);
  g.fillStyle(0xffb300, 1);
  g.fillTriangle(56, 20, 65, 23, 56, 26);
  g.lineStyle(2.5, 0x3e2723, 1);
  g.lineBetween(46, 12, 42, 3);
  g.fillStyle(0x3e2723, 1);
  g.fillCircle(42, 3, 3.5);
  g.generateTexture('pet_quail', 68, 58);

  // pet_mama (Mama Dove - Nest Mother Companion)
  g.clear();
  g.fillStyle(0x5c3818, 1);
  g.fillEllipse(36, 46, 56, 26);
  g.fillStyle(0x78350f, 1);
  g.fillEllipse(36, 42, 48, 18);
  g.fillStyle(0x3e2723, 1);
  g.fillEllipse(36, 40, 40, 14);
  g.fillStyle(0xfffbeb, 1);
  g.fillEllipse(28, 38, 14, 10);
  g.fillEllipse(44, 38, 14, 10);
  g.fillStyle(0xa16207, 1);
  g.fillCircle(27, 37, 1);
  g.fillCircle(30, 39, 1.2);
  g.fillCircle(43, 37, 1);
  g.fillCircle(46, 39, 1.2);
  g.fillStyle(0xd6d3d1, 1);
  g.fillEllipse(36, 28, 38, 26);
  g.fillStyle(0xa8a29e, 1);
  g.fillEllipse(26, 28, 24, 14);
  g.fillStyle(0xe7e5e4, 1);
  g.fillCircle(46, 18, 12);
  g.fillStyle(0x1c1917, 1);
  g.fillCircle(49, 16, 2.5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(50, 15, 1);
  g.fillStyle(0xfca5a5, 1);
  g.fillTriangle(54, 16, 62, 19, 54, 21);
  g.generateTexture('pet_mama', 74, 62);

  // pet_woodpecker (Pip)
  g.clear();
  g.fillStyle(0x1e293b, 1);
  g.fillEllipse(30, 42, 36, 46);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(34, 44, 20, 32);
  g.fillStyle(0x1e293b, 1);
  g.fillCircle(38, 22, 16);
  g.fillStyle(0xef4444, 1);
  g.fillTriangle(30, 8, 48, 8, 38, 18);
  g.fillStyle(0x222222, 1);
  g.fillCircle(42, 20, 3);
  g.fillStyle(0x94a3b8, 1);
  g.fillTriangle(50, 20, 64, 23, 50, 26);
  g.generateTexture('pet_woodpecker', 66, 72);

  // pet_magpie (Grimm)
  g.clear();
  g.fillStyle(0x0f172a, 1);
  g.fillEllipse(34, 38, 48, 30);
  g.fillTriangle(14, 40, -4, 52, 16, 48);
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(38, 42, 26, 18);
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(50, 24, 15);
  g.fillStyle(0x38bdf8, 1);
  g.fillEllipse(28, 36, 26, 14);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(54, 22, 3);
  g.fillStyle(0x000000, 1);
  g.fillCircle(55, 22, 1.5);
  g.fillStyle(0x1e293b, 1);
  g.fillTriangle(60, 22, 73, 26, 60, 28);
  g.generateTexture('pet_magpie', 76, 64);

  // pet_snail (Mossy)
  g.clear();
  g.fillStyle(0x34d399, 0.9);
  g.fillEllipse(32, 34, 48, 16);
  g.fillStyle(0x22c55e, 1);
  g.fillCircle(48, 28, 8);
  g.lineStyle(2, 0x22c55e, 1);
  g.lineBetween(48, 26, 54, 14);
  g.lineBetween(52, 27, 60, 16);
  g.fillStyle(0x000000, 1);
  g.fillCircle(54, 14, 2);
  g.fillCircle(60, 16, 2);
  g.fillStyle(0x15803d, 1);
  g.fillCircle(24, 22, 16);
  g.lineStyle(2.5, 0x86efac, 0.8);
  g.strokeCircle(24, 22, 11);
  g.strokeCircle(24, 22, 6);
  g.generateTexture('pet_snail', 64, 46);

  // pet_mole (Rocky)
  g.clear();
  g.fillStyle(0x27272a, 1);
  g.fillEllipse(32, 28, 48, 32);
  g.fillStyle(0x3f3f46, 1);
  g.fillCircle(50, 26, 14);
  g.fillStyle(0xfb7185, 1);
  g.fillCircle(61, 26, 4.5);
  g.fillStyle(0x18181b, 1);
  g.fillCircle(53, 23, 2);
  g.fillStyle(0xfbcfe8, 1);
  g.fillEllipse(30, 40, 14, 8);
  g.fillEllipse(48, 38, 14, 8);
  g.generateTexture('pet_mole', 68, 48);

  // pet_hound (Bramble)
  g.clear();
  g.fillStyle(0xb45309, 1);
  g.fillEllipse(40, 36, 56, 34);
  g.fillCircle(62, 26, 16);
  g.fillStyle(0x78350f, 1);
  g.fillEllipse(56, 28, 10, 18);
  g.fillStyle(0x1f2937, 1);
  g.fillCircle(66, 22, 3);
  g.fillCircle(73, 27, 4);
  g.fillStyle(0xef4444, 1);
  g.fillRect(52, 35, 10, 4);
  g.lineStyle(3, 0x92400e, 1);
  g.lineBetween(16, 34, 6, 20);
  g.generateTexture('pet_hound', 84, 60);

  // pet_owl (Hoot)
  g.clear();
  g.fillStyle(0x78350f, 1);
  g.fillEllipse(30, 36, 42, 46);
  g.fillStyle(0xfde68a, 1);
  g.fillEllipse(30, 40, 26, 30);
  g.fillStyle(0x78350f, 1);
  g.fillTriangle(14, 20, 22, 6, 26, 20);
  g.fillTriangle(34, 20, 38, 6, 46, 20);
  g.fillStyle(0xf59e0b, 1);
  g.fillCircle(22, 24, 9);
  g.fillCircle(38, 24, 9);
  g.fillStyle(0x000000, 1);
  g.fillCircle(22, 24, 5);
  g.fillCircle(38, 24, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(24, 22, 2);
  g.fillCircle(40, 22, 2);
  g.fillStyle(0xf59e0b, 1);
  g.fillTriangle(27, 28, 33, 28, 30, 36);
  g.generateTexture('pet_owl', 60, 64);

  // pet_frog (Bouncer)
  g.clear();
  g.fillStyle(0x16a34a, 1);
  g.fillEllipse(30, 30, 42, 28);
  g.fillStyle(0xbbf7d0, 1);
  g.fillEllipse(30, 34, 26, 16);
  g.fillStyle(0x15803d, 1);
  g.fillCircle(20, 16, 9);
  g.fillCircle(40, 16, 9);
  g.fillStyle(0xfacc15, 1);
  g.fillCircle(20, 16, 6);
  g.fillCircle(40, 16, 6);
  g.fillStyle(0x000000, 1);
  g.fillCircle(20, 16, 3);
  g.fillCircle(40, 16, 3);
  g.generateTexture('pet_frog', 60, 48);

  // pet_hummingbird (Zephyr)
  g.clear();
  g.fillStyle(0x059669, 1);
  g.fillEllipse(28, 30, 32, 20);
  g.fillStyle(0xe11d48, 1);
  g.fillCircle(36, 28, 6);
  g.fillStyle(0x059669, 1);
  g.fillCircle(36, 22, 10);
  g.fillStyle(0x000000, 1);
  g.fillCircle(39, 20, 2.5);
  g.lineStyle(2, 0x1f2937, 1);
  g.lineBetween(44, 22, 60, 25);
  g.fillStyle(0xa7f3d0, 0.6);
  g.fillEllipse(22, 16, 20, 8);
  g.generateTexture('pet_hummingbird', 64, 50);

  // pet_firefly (Sparky)
  g.clear();
  g.fillStyle(0x1f2937, 1);
  g.fillEllipse(26, 22, 20, 22);
  g.fillStyle(0xfef08a, 0.4);
  g.fillCircle(18, 34, 16);
  g.fillStyle(0xfde047, 1);
  g.fillEllipse(18, 34, 16, 14);
  g.fillStyle(0x111827, 1);
  g.fillCircle(36, 16, 8);
  g.fillStyle(0xffffff, 0.7);
  g.fillEllipse(28, 14, 18, 8);
  g.generateTexture('pet_firefly', 56, 50);

  // pet_ferret (Fang)
  g.clear();
  g.fillStyle(0xd97706, 1);
  g.fillEllipse(38, 28, 54, 24);
  g.fillStyle(0xfef3c7, 1);
  g.fillEllipse(44, 32, 28, 14);
  g.fillStyle(0xb45309, 1);
  g.fillCircle(58, 20, 12);
  g.fillStyle(0x1f2937, 1);
  g.fillRect(52, 18, 12, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(59, 19, 2);
  g.fillStyle(0x000000, 1);
  g.fillCircle(60, 19, 1);
  g.fillStyle(0xf43f5e, 1);
  g.fillCircle(66, 22, 2);
  g.generateTexture('pet_ferret', 82, 46);

  // pet_phoenix_chick (Asher)
  g.clear();
  g.fillStyle(0xf97316, 1);
  g.fillEllipse(32, 36, 40, 34);
  g.fillStyle(0xfef08a, 1);
  g.fillEllipse(34, 40, 24, 20);
  g.fillStyle(0xe11d48, 1);
  g.fillCircle(44, 22, 14);
  g.fillStyle(0xfacc15, 1);
  g.fillTriangle(38, 10, 44, 0, 48, 12);
  g.fillTriangle(44, 12, 52, 2, 54, 14);
  g.fillStyle(0x222222, 1);
  g.fillCircle(47, 20, 2.5);
  g.fillStyle(0xfbbf24, 1);
  g.fillTriangle(52, 20, 62, 23, 52, 26);
  g.generateTexture('pet_phoenix_chick', 66, 64);

  // pet_chameleon (Echo)
  g.clear();
  g.fillStyle(0x06b6d4, 1);
  g.fillEllipse(36, 28, 40, 24);
  g.fillCircle(50, 22, 12);
  g.fillStyle(0xa5f3fc, 1);
  g.fillCircle(52, 20, 5);
  g.fillStyle(0x000000, 1);
  g.fillCircle(53, 20, 2.5);
  g.lineStyle(3, 0x0891b2, 1);
  g.lineBetween(18, 30, 8, 38);
  g.lineBetween(8, 38, 14, 44);
  g.generateTexture('pet_chameleon', 68, 50);

  // ---------- Sugar Glider (World 4 Non-Bird Glider) ----------
  // sugar_glider_perch (Sitting / resting on branch or trunk)
  g.clear();
  // Fluffy bushy tail
  g.fillStyle(0x64748b, 1);
  g.fillEllipse(14, 28, 20, 12);
  g.fillStyle(0x475569, 1);
  g.fillEllipse(10, 24, 16, 8);
  // Body (slate grey)
  g.fillStyle(0x94a3b8, 1);
  g.fillEllipse(32, 28, 26, 22);
  // Creamy white belly
  g.fillStyle(0xf8fafc, 1);
  g.fillEllipse(36, 31, 16, 14);
  // Head
  g.fillStyle(0x94a3b8, 1);
  g.fillCircle(45, 20, 13);
  // Dark dorsal stripe
  g.fillStyle(0x1e293b, 1);
  g.fillRect(35, 10, 5, 24);
  // Ears
  g.fillStyle(0x64748b, 1);
  g.fillTriangle(38, 12, 42, 2, 46, 12);
  g.fillTriangle(46, 12, 50, 3, 54, 13);
  g.fillStyle(0xf472b6, 1); // pink inner ear
  g.fillTriangle(40, 11, 42, 5, 45, 11);
  g.fillTriangle(48, 11, 50, 6, 52, 12);
  // Cute giant dark eye with catchlight
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(47, 18, 5.5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(45.5, 16.5, 2);
  g.fillCircle(48.5, 19.5, 1);
  // Pink nose
  g.fillStyle(0xf43f5e, 1);
  g.fillCircle(56, 21, 2);
  // Little paws
  g.fillStyle(0xfbcfe8, 1);
  g.fillCircle(28, 38, 3);
  g.fillCircle(40, 38, 3);
  g.generateTexture('sugar_glider_perch', 62, 44);

  // sugar_glider_glide (Wings/patagium spread wide gliding through air)
  g.clear();
  // Patagium gliding skin flaps (wings between paws)
  g.fillStyle(0x64748b, 1);
  g.fillTriangle(14, 18, 48, 6, 50, 42);
  g.fillTriangle(14, 30, 48, 6, 50, 42);
  g.fillStyle(0x94a3b8, 1);
  g.fillEllipse(34, 24, 38, 28);
  // Creamy belly center
  g.fillStyle(0xf8fafc, 1);
  g.fillEllipse(34, 24, 16, 20);
  // Dark central back/head stripe
  g.fillStyle(0x1e293b, 1);
  g.fillRect(32, 6, 4, 36);
  // Head
  g.fillStyle(0x94a3b8, 1);
  g.fillCircle(34, 10, 10);
  // Ears
  g.fillStyle(0xf472b6, 1);
  g.fillCircle(27, 6, 3);
  g.fillCircle(41, 6, 3);
  // Big black eyes on sides
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(29, 9, 3.5);
  g.fillCircle(39, 9, 3.5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(28, 8, 1.2);
  g.fillCircle(38, 8, 1.2);
  // Pink nose tip
  g.fillStyle(0xf43f5e, 1);
  g.fillCircle(34, 4, 2);
  // Tail streaming straight behind
  g.fillStyle(0x475569, 1);
  g.fillEllipse(34, 46, 8, 18);
  g.generateTexture('sugar_glider_glide', 68, 58);

  // sugar_glider_icon (Shop button thumbnail)
  g.clear();
  g.fillStyle(0x94a3b8, 1);
  g.fillCircle(22, 22, 17);
  g.fillStyle(0xf8fafc, 1);
  g.fillEllipse(22, 26, 18, 14);
  g.fillStyle(0x1e293b, 1);
  g.fillRect(20, 5, 4, 18);
  g.fillStyle(0x64748b, 1);
  g.fillTriangle(10, 14, 14, 4, 19, 13);
  g.fillTriangle(25, 13, 30, 4, 34, 14);
  g.fillStyle(0xf472b6, 1);
  g.fillTriangle(12, 13, 14, 7, 17, 13);
  g.fillTriangle(27, 13, 30, 7, 32, 13);
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(15, 20, 4.5);
  g.fillCircle(29, 20, 4.5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(13.8, 18.5, 1.8);
  g.fillCircle(27.8, 18.5, 1.8);
  g.fillStyle(0xf43f5e, 1);
  g.fillCircle(22, 24, 2);
  g.generateTexture('sugar_glider_icon', 44, 44);

  // ---------- Cinder Gecko / Flame Chameleon (World 4 Non-Bird Intermediate) ----------
  // cinder_gecko_perch (Resting on trunk / branch with prehensile tail and alert turret eye)
  g.clear();
  // Curled prehensile tail
  g.lineStyle(4.5, 0x9a3412, 1);
  g.beginPath();
  g.arc(14, 28, 9, 0, Math.PI * 1.6, false);
  g.strokePath();
  g.fillStyle(0xd97706, 1);
  g.fillCircle(14, 37, 2.5); // tail curled tip
  // Reptilian Torso (burnt sienna / magma amber)
  g.fillStyle(0x7c2d12, 1);
  g.fillEllipse(36, 26, 26, 18);
  // Fiery glowing belly
  g.fillStyle(0xf97316, 1);
  g.fillEllipse(38, 28, 20, 12);
  // Spines along back
  g.fillStyle(0xfde047, 1);
  g.fillTriangle(26, 18, 28, 12, 30, 18);
  g.fillTriangle(33, 17, 35, 11, 37, 17);
  g.fillTriangle(40, 18, 42, 13, 44, 18);
  // Clawed Gecko Limbs gripping bark
  g.lineStyle(3.2, 0x9a3412, 1);
  g.lineBetween(28, 30, 24, 40);
  g.lineBetween(44, 30, 48, 40);
  // Suction toe pads
  g.fillStyle(0xf97316, 1);
  g.fillCircle(22, 41, 2.8);
  g.fillCircle(25, 42, 2.8);
  g.fillCircle(47, 41, 2.8);
  g.fillCircle(50, 42, 2.8);
  // Chameleon Casque Head
  g.fillStyle(0x7c2d12, 1);
  g.fillEllipse(50, 21, 16, 14);
  g.fillTriangle(44, 14, 52, 9, 54, 18); // raised helmet crest
  g.fillStyle(0xea580c, 1);
  g.fillTriangle(45, 14, 51, 11, 52, 17);
  // Bulging Turret Eye
  g.fillStyle(0xc2410c, 1);
  g.fillCircle(51, 19, 5.5);
  g.fillStyle(0xfde047, 1);
  g.fillCircle(51.5, 19, 4.2);
  g.fillStyle(0x000000, 1);
  g.fillRect(51, 16, 1.8, 6); // vertical reptile slit pupil
  g.fillStyle(0xffffff, 1);
  g.fillCircle(50.5, 17.5, 1.2);
  // Throat pouch
  g.fillStyle(0xf97316, 0.9);
  g.fillEllipse(52, 26, 7, 5);
  g.generateTexture('cinder_gecko_perch', 68, 48);

  // cinder_gecko_crawl (Active crawling gait with flexed limbs)
  g.clear();
  // Extended tail waving with momentum
  g.lineStyle(4, 0x9a3412, 1);
  g.lineBetween(10, 32, 24, 24);
  g.fillStyle(0xd97706, 1);
  g.fillCircle(9, 33, 2.5);
  // Stretched crawling body
  g.fillStyle(0x7c2d12, 1);
  g.fillEllipse(38, 24, 30, 16);
  g.fillStyle(0xf97316, 1);
  g.fillEllipse(40, 25, 24, 10);
  // Spines
  g.fillStyle(0xfde047, 1);
  g.fillTriangle(28, 16, 30, 10, 32, 16);
  g.fillTriangle(36, 15, 38, 9, 40, 15);
  g.fillTriangle(44, 16, 46, 11, 48, 16);
  // Stepping splayed legs
  g.lineStyle(3.2, 0x9a3412, 1);
  g.lineBetween(30, 26, 22, 36);
  g.lineBetween(48, 26, 56, 36);
  g.fillStyle(0xf97316, 1);
  g.fillCircle(20, 37, 2.8);
  g.fillCircle(58, 37, 2.8);
  // Head
  g.fillStyle(0x7c2d12, 1);
  g.fillEllipse(54, 20, 16, 13);
  g.fillTriangle(48, 13, 56, 8, 58, 17);
  // Turret Eye
  g.fillStyle(0xc2410c, 1);
  g.fillCircle(55, 18, 5.2);
  g.fillStyle(0xfde047, 1);
  g.fillCircle(55.5, 18, 4);
  g.fillStyle(0x000000, 1);
  g.fillRect(55, 15, 1.8, 6);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(54.5, 16.5, 1.2);
  g.generateTexture('cinder_gecko_crawl', 74, 46);

  // cinder_gecko_icon (Shop button thumbnail)
  g.clear();
  g.fillStyle(0x7c2d12, 1);
  g.fillCircle(22, 24, 18);
  // Head crest
  g.fillStyle(0x9a3412, 1);
  g.fillTriangle(14, 14, 24, 4, 30, 14);
  g.fillStyle(0xf97316, 1);
  g.fillTriangle(16, 14, 23, 7, 28, 14);
  // Muzzle & Snout
  g.fillStyle(0xc2410c, 1);
  g.fillEllipse(28, 28, 14, 10);
  // Big Turret Eye
  g.fillStyle(0x9a3412, 1);
  g.fillCircle(18, 20, 7.5);
  g.fillStyle(0xfde047, 1);
  g.fillCircle(18.5, 20, 6);
  g.fillStyle(0x000000, 1);
  g.fillRect(18, 15, 2.2, 10);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(17, 17, 1.8);
  // Glowing tongue tip curled out of snout
  g.lineStyle(2.5, 0xf43f5e, 1);
  g.lineBetween(32, 30, 38, 28);
  g.fillStyle(0xfb7185, 1);
  g.fillCircle(38, 28, 2.5);
  g.generateTexture('cinder_gecko_icon', 44, 44);

  // ---------- Non-Bird Predators & Props ----------
  // enemy_cat
  g.clear();
  g.fillStyle(0x1f2937, 1);
  g.fillEllipse(44, 42, 56, 32);
  g.fillStyle(0x111827, 1);
  g.fillCircle(68, 30, 18);
  g.fillTriangle(60, 20, 66, 6, 72, 20);
  g.fillTriangle(70, 20, 76, 6, 82, 20);
  g.fillStyle(0x22c55e, 1);
  g.fillEllipse(66, 28, 5, 7);
  g.fillEllipse(75, 28, 5, 7);
  g.fillStyle(0x000000, 1);
  g.fillRect(65, 25, 2, 6);
  g.fillRect(74, 25, 2, 6);
  g.lineStyle(3, 0x111827, 1);
  g.lineBetween(18, 44, 6, 24);
  g.lineStyle(2, 0xffffff, 1);
  g.lineBetween(58, 54, 64, 58);
  g.generateTexture('enemy_cat', 90, 65);

  // enemy_snake
  g.clear();
  g.lineStyle(12, 0x15803d, 1);
  g.lineBetween(14, 24, 40, 14);
  g.lineBetween(40, 14, 64, 28);
  g.lineBetween(64, 28, 86, 18);
  g.fillStyle(0x166534, 1);
  g.fillTriangle(78, 10, 96, 18, 78, 26);
  g.fillStyle(0xfacc15, 1);
  g.fillCircle(85, 15, 3);
  g.fillStyle(0x000000, 1);
  g.fillRect(84, 13, 2, 4);
  g.lineStyle(1.5, 0xef4444, 1);
  g.lineBetween(96, 18, 104, 18);
  g.lineBetween(104, 18, 108, 15);
  g.lineBetween(104, 18, 108, 21);
  g.generateTexture('enemy_snake', 110, 45);

  // enemy_raccoon
  g.clear();
  g.fillStyle(0x4b5563, 1);
  g.fillEllipse(42, 44, 52, 42);
  g.fillStyle(0x374151, 1);
  g.fillCircle(62, 30, 18);
  g.fillStyle(0x111827, 1);
  g.fillRect(52, 26, 22, 8);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(58, 29, 3);
  g.fillCircle(68, 29, 3);
  g.fillStyle(0x000000, 1);
  g.fillCircle(58, 29, 1.5);
  g.fillCircle(68, 29, 1.5);
  g.fillStyle(0xb45309, 1);
  g.fillCircle(24, 48, 16);
  g.fillStyle(0xfef08a, 1);
  g.fillCircle(24, 44, 4);
  g.generateTexture('enemy_raccoon', 85, 75);

  // enemy_spider
  g.clear();
  g.lineStyle(1.5, 0xffffff, 0.85);
  g.lineBetween(48, 0, 48, 30);
  g.lineStyle(3, 0x18181b, 1);
  g.beginPath();
  g.moveTo(40, 26); g.lineTo(22, 10); g.lineTo(8, 22);
  g.strokePath();
  g.beginPath();
  g.moveTo(38, 30); g.lineTo(16, 26); g.lineTo(4, 46);
  g.strokePath();
  g.beginPath();
  g.moveTo(38, 36); g.lineTo(18, 50); g.lineTo(12, 70);
  g.strokePath();
  g.beginPath();
  g.moveTo(40, 42); g.lineTo(24, 66); g.lineTo(20, 80);
  g.strokePath();

  g.beginPath();
  g.moveTo(56, 26); g.lineTo(74, 10); g.lineTo(88, 22);
  g.strokePath();
  g.beginPath();
  g.moveTo(58, 30); g.lineTo(80, 26); g.lineTo(92, 46);
  g.strokePath();
  g.beginPath();
  g.moveTo(58, 36); g.lineTo(78, 50); g.lineTo(84, 70);
  g.strokePath();
  g.beginPath();
  g.moveTo(56, 42); g.lineTo(72, 66); g.lineTo(76, 80);
  g.strokePath();

  g.fillStyle(0x7c3aed, 1);
  g.fillCircle(22, 10, 2.5); g.fillCircle(74, 10, 2.5);
  g.fillCircle(16, 26, 2.5); g.fillCircle(80, 26, 2.5);
  g.fillCircle(18, 50, 2.5); g.fillCircle(78, 50, 2.5);
  g.fillCircle(24, 66, 2.5); g.fillCircle(72, 66, 2.5);

  g.fillStyle(0x2e1065, 1);
  g.fillEllipse(48, 50, 36, 32);
  g.fillStyle(0xef4444, 1);
  g.fillTriangle(48, 42, 43, 52, 53, 52);
  g.fillTriangle(48, 58, 43, 48, 53, 48);

  g.fillStyle(0x18181b, 1);
  g.fillCircle(48, 32, 14);

  g.fillStyle(0x3f3f46, 1);
  g.fillTriangle(44, 38, 47, 47, 43, 48);
  g.fillTriangle(52, 38, 49, 47, 53, 48);
  g.fillStyle(0x22c55e, 0.9);
  g.fillCircle(44, 50, 2);

  g.fillStyle(0xef4444, 1);
  g.fillCircle(45, 27, 2.8);
  g.fillCircle(51, 27, 2.8);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(46, 26, 1);
  g.fillCircle(52, 26, 1);
  g.fillStyle(0xdc2626, 1);
  g.fillCircle(41, 25, 1.8);
  g.fillCircle(55, 25, 1.8);
  g.fillCircle(42, 31, 1.5);
  g.fillCircle(54, 31, 1.5);
  g.generateTexture('enemy_spider', 96, 84);

  // enemy_weasel
  g.clear();
  g.fillStyle(0x9a3412, 1);
  g.fillEllipse(44, 30, 60, 22);
  g.fillStyle(0xffedd5, 1);
  g.fillEllipse(48, 34, 34, 12);
  g.fillStyle(0x7c2d12, 1);
  g.fillCircle(70, 22, 13);
  g.fillStyle(0x000000, 1);
  g.fillCircle(74, 20, 2.5);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(75, 26, 80, 28, 77, 31);
  g.generateTexture('enemy_weasel', 88, 50);

  // spider_web
  g.clear();
  g.lineStyle(1.5, 0xffffff, 0.7);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.lineBetween(35, 35, 35 + Math.cos(a) * 32, 35 + Math.sin(a) * 32);
  }
  g.strokeCircle(35, 35, 12);
  g.strokeCircle(35, 35, 22);
  g.strokeCircle(35, 35, 31);
  g.generateTexture('spider_web', 70, 70);

  // truffle
  g.clear();
  g.fillStyle(0x29180f, 1);
  g.fillCircle(11, 11, 9);
  g.fillStyle(0x52331f, 1);
  g.fillCircle(9, 9, 4);
  g.fillStyle(0xfbbf24, 0.8);
  g.fillCircle(14, 13, 2);
  g.generateTexture('truffle', 22, 22);

  // pinecone
  g.clear();
  g.fillStyle(0x78350f, 1);
  g.fillEllipse(12, 16, 18, 22);
  g.fillStyle(0xb45309, 1);
  for (let i = 0; i < 4; i++) {
    g.fillTriangle(6, 8 + i * 5, 18, 8 + i * 5, 12, 13 + i * 5);
  }
  g.fillStyle(0xf59e0b, 1);
  g.fillCircle(12, 4, 3);
  g.generateTexture('pinecone', 24, 30);

  // enemy_glutton
  g.clear();
  g.fillStyle(0x365314, 1);
  g.fillEllipse(48, 48, 68, 56);
  g.fillStyle(0x84cc16, 0.9);
  g.fillEllipse(46, 54, 48, 38);
  g.fillStyle(0x1a2e05, 1);
  g.fillEllipse(66, 44, 32, 26);
  g.fillStyle(0xfef08a, 1);
  g.fillTriangle(60, 35, 64, 41, 62, 35);
  g.fillTriangle(68, 34, 72, 40, 70, 34);
  g.fillTriangle(62, 53, 66, 47, 64, 53);
  g.fillTriangle(70, 52, 74, 46, 72, 52);
  g.fillStyle(0xfef08a, 1);
  g.fillCircle(58, 24, 8);
  g.fillStyle(0xd90429, 1);
  g.fillCircle(60, 24, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(61, 23, 1.5);
  g.fillStyle(0x4d7c0f, 1);
  g.fillTriangle(20, 34, 4, 20, 26, 44);
  g.generateTexture('enemy_glutton', 96, 88);

  // enemy_bombardier
  g.clear();
  g.fillStyle(0x334155, 1);
  g.fillTriangle(55, 34, 4, 14, 28, 56);
  g.fillTriangle(65, 34, 116, 14, 92, 56);
  g.fillStyle(0x475569, 1);
  g.fillTriangle(55, 36, 14, 20, 32, 50);
  g.fillTriangle(65, 36, 106, 20, 88, 50);

  g.fillStyle(0x1e293b, 1);
  g.fillEllipse(60, 38, 52, 26);
  g.fillStyle(0xb45309, 1);
  g.fillRoundedRect(42, 28, 36, 18, 4);

  g.fillStyle(0x0f172a, 1);
  g.fillCircle(78, 28, 13);
  g.fillStyle(0x94a3b8, 1);
  g.fillTriangle(84, 24, 102, 30, 84, 34);
  g.fillTriangle(96, 30, 102, 36, 92, 33);
  g.fillStyle(0xf59e0b, 1);
  g.fillRoundedRect(76, 22, 14, 6, 2);
  g.fillStyle(0x38bdf8, 1);
  g.fillRect(80, 23, 5, 4);

  g.fillStyle(0x0f172a, 1);
  g.fillRoundedRect(22, 40, 24, 13, 3);
  g.fillStyle(0xfacc15, 1);
  g.fillRect(28, 40, 3, 13);
  g.fillRect(34, 40, 3, 13);
  g.fillStyle(0xef4444, 1);
  g.fillCircle(46, 44, 3);
  g.fillCircle(46, 50, 3);
  g.fillStyle(0xf97316, 1);
  g.fillTriangle(22, 43, 14, 46, 22, 49);

  g.fillStyle(0x0f172a, 1);
  g.fillRoundedRect(74, 40, 24, 13, 3);
  g.fillStyle(0xfacc15, 1);
  g.fillRect(80, 40, 3, 13);
  g.fillRect(86, 40, 3, 13);
  g.fillStyle(0xef4444, 1);
  g.fillCircle(98, 44, 3);
  g.fillCircle(98, 50, 3);
  g.fillStyle(0xf97316, 1);
  g.fillTriangle(74, 43, 66, 46, 74, 49);
  g.generateTexture('enemy_bombardier', 120, 70);

  // enemy_vulture_active
  g.clear();
  g.fillStyle(0x1c1917, 1);
  g.fillTriangle(48, 48, 6, 20, 24, 66);
  g.fillStyle(0x292524, 1);
  g.fillTriangle(56, 48, 98, 20, 80, 66);
  g.fillStyle(0x292524, 1);
  g.fillEllipse(52, 54, 46, 42);
  g.fillStyle(0xe2e8f0, 1);
  g.fillEllipse(52, 38, 28, 14);
  g.fillStyle(0xbe123c, 1);
  g.fillRect(48, 26, 9, 14);
  g.fillCircle(52, 22, 13);
  g.fillStyle(0xd97706, 1);
  g.fillTriangle(58, 20, 78, 25, 58, 28);
  g.fillTriangle(74, 25, 78, 30, 70, 26);
  g.fillStyle(0xdc2626, 1);
  g.fillTriangle(44, 42, 60, 42, 52, 58);
  g.fillStyle(0xffffff, 1);
  g.fillRect(48, 44, 4, 4);
  g.fillRect(52, 48, 4, 4);
  g.fillStyle(0xef4444, 1);
  g.fillCircle(58, 18, 4.5);
  g.fillStyle(0x000000, 1);
  g.fillCircle(59, 18, 2);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(60, 17, 1);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(42, 8, 20, 6, 2);
  g.fillCircle(45, 4, 7);
  g.fillCircle(52, 2, 8);
  g.fillCircle(59, 4, 7);
  g.fillStyle(0xf59e0b, 1);
  g.fillRect(42, 12, 20, 2);
  g.fillStyle(0x78350f, 1);
  g.fillRect(17, 52, 5, 12);
  g.fillStyle(0xcbd5e1, 1);
  g.fillTriangle(17, 52, 22, 52, 19, 32);
  g.fillStyle(0x78350f, 1);
  g.fillRect(82, 52, 5, 12);
  g.fillStyle(0xcbd5e1, 1);
  g.fillRect(81, 36, 7, 16);
  g.generateTexture('enemy_vulture_active', 104, 92);

  // enemy_vulture_dormant
  g.clear();
  g.fillStyle(0x38bdf8, 0.25);
  g.fillCircle(52, 48, 46);
  g.fillStyle(0x38bdf8, 0.4);
  g.fillCircle(52, 48, 36);
  g.fillStyle(0x334155, 1);
  g.fillCircle(52, 50, 28);
  g.fillStyle(0x1e293b, 1);
  g.fillEllipse(36, 52, 18, 34);
  g.fillEllipse(68, 52, 18, 34);
  g.fillStyle(0xf1f5f9, 1);
  g.fillEllipse(52, 34, 24, 12);
  g.fillStyle(0xf472b6, 1);
  g.fillCircle(52, 24, 12);
  g.lineStyle(2, 0x831843, 1);
  g.beginPath();
  g.arc(56, 23, 4, Math.PI, 0);
  g.strokePath();
  g.fillStyle(0xfb7185, 0.6);
  g.fillCircle(58, 27, 4);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(38, 10, 18, 5, 2);
  g.fillCircle(41, 6, 6);
  g.fillCircle(47, 4, 7);
  g.fillCircle(53, 6, 6);
  g.fillStyle(0x38bdf8, 1);
  g.fillRect(38, 13, 18, 2);
  g.fillStyle(0xf59e0b, 1);
  g.fillRect(40, 50, 24, 4);
  g.fillCircle(65, 52, 6);
  g.fillStyle(0xbae6fd, 0.85);
  g.fillCircle(74, 16, 4);
  g.fillCircle(82, 10, 6);
  g.generateTexture('enemy_vulture_dormant', 104, 92);

  // homing_missile
  g.clear();
  g.fillStyle(0xef4444, 1);
  g.fillRect(6, 6, 18, 6);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(24, 6, 30, 9, 24, 12);
  g.fillTriangle(6, 6, 2, 2, 8, 6);
  g.fillTriangle(6, 12, 2, 16, 8, 12);
  g.fillStyle(0xffd54f, 1);
  g.fillCircle(3, 9, 3);
  g.generateTexture('homing_missile', 32, 18);

  // emporium_keeper
  g.clear();
  g.fillStyle(0xffe0bd, 1);
  g.fillCircle(50, 42, 24);
  g.fillRect(44, 62, 12, 12);
  g.fillStyle(0xffb4a2, 0.85);
  g.fillCircle(38, 46, 5);
  g.fillCircle(62, 46, 5);
  g.lineStyle(2, 0x8d5b28, 1);
  g.lineBetween(44, 52, 50, 56);
  g.lineBetween(50, 56, 56, 52);
  g.fillStyle(0x2d3748, 1);
  g.fillEllipse(42, 40, 4, 6);
  g.fillEllipse(58, 40, 4, 6);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(43, 38, 1.5);
  g.fillCircle(59, 38, 1.5);
  g.fillStyle(0x2d6a4f, 1);
  g.fillEllipse(50, 24, 56, 14);
  g.fillRoundedRect(30, 8, 40, 20, 6);
  g.fillStyle(0x78350f, 1);
  g.fillRect(30, 22, 40, 5);
  g.fillStyle(0xffd54f, 1);
  g.fillTriangle(64, 20, 76, 2, 68, 22);
  g.fillStyle(0xb45309, 1);
  g.fillRoundedRect(20, 68, 60, 42, 10);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(44, 68, 50, 80, 56, 68);
  g.fillStyle(0x334155, 1);
  g.fillRoundedRect(42, 76, 16, 18, 4);
  g.fillStyle(0xffe0bd, 1);
  g.fillEllipse(84, 82, 14, 9);
  g.generateTexture('emporium_keeper', 100, 115);

  // emporium_potion
  g.clear();
  g.fillStyle(0x38bdf8, 0.4);
  g.fillRoundedRect(10, 18, 28, 30, 8);
  g.fillStyle(0xffd700, 0.95);
  g.fillRoundedRect(12, 24, 24, 22, 6);
  g.fillStyle(0x64748b, 1);
  g.fillRect(18, 8, 12, 10);
  g.fillStyle(0xef4444, 1);
  g.fillRect(16, 15, 16, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(20, 28, 2);
  g.fillCircle(28, 36, 1.5);
  g.generateTexture('emporium_potion', 48, 54);

  // backdrop_preview
  g.clear();
  g.fillStyle(0x78350f, 1);
  g.fillRoundedRect(2, 2, 76, 52, 4);
  g.fillStyle(0x38bdf8, 1);
  g.fillRect(6, 6, 68, 44);
  g.fillStyle(0xf472b6, 1);
  g.fillCircle(40, 28, 16);
  g.fillStyle(0x22c55e, 1);
  g.fillEllipse(40, 45, 64, 16);
  g.generateTexture('backdrop_preview', 80, 56);

  // enemy_bat (Nocturnal swooping predator)
  g.clear();
  // Outstretched Scalloped Bat Wings
  g.fillStyle(0x191024, 1);
  // Left Wing
  g.beginPath();
  g.moveTo(42, 34);
  g.lineTo(8, 10);
  g.lineTo(14, 44);
  g.lineTo(24, 38);
  g.lineTo(32, 44);
  g.lineTo(42, 38);
  g.closePath();
  g.fillPath();
  // Right Wing
  g.beginPath();
  g.moveTo(54, 34);
  g.lineTo(88, 10);
  g.lineTo(82, 44);
  g.lineTo(72, 38);
  g.lineTo(64, 44);
  g.lineTo(54, 38);
  g.closePath();
  g.fillPath();

  // Leathery wing bones / ribs
  g.lineStyle(2, 0x4c356b, 0.85);
  g.lineBetween(40, 32, 10, 12);
  g.lineBetween(10, 12, 14, 42);
  g.lineBetween(10, 12, 24, 37);
  g.lineBetween(10, 12, 32, 42);
  g.lineBetween(56, 32, 86, 12);
  g.lineBetween(86, 12, 82, 42);
  g.lineBetween(86, 12, 72, 37);
  g.lineBetween(86, 12, 64, 42);

  // Bat Body & Head (Plump fluffy dark violet)
  g.fillStyle(0x2a1b38, 1);
  g.fillEllipse(48, 38, 30, 24);
  g.fillCircle(48, 25, 14);

  // Pointy Bat Ears
  g.fillStyle(0x2a1b38, 1);
  g.fillTriangle(38, 22, 34, 6, 46, 16);
  g.fillTriangle(58, 22, 62, 6, 50, 16);
  // Warm Inner Ears
  g.fillStyle(0xf472b6, 0.7);
  g.fillTriangle(39, 20, 36, 9, 44, 16);
  g.fillTriangle(57, 20, 60, 9, 52, 16);

  // Glowing Crimson Vampire Eyes
  g.fillStyle(0xef4444, 1);
  g.fillEllipse(43, 24, 4.5, 5);
  g.fillEllipse(53, 24, 4.5, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(44, 23, 1.6);
  g.fillCircle(54, 23, 1.6);

  // Little black nose & sharp white fangs
  g.fillStyle(0x0f0b14, 1);
  g.fillCircle(48, 28, 2.2);
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(45, 30, 47, 30, 46, 35);
  g.fillTriangle(49, 30, 51, 30, 50, 35);
  g.generateTexture('enemy_bat', 96, 64);

  // --- Dynamic Articulated Bat Components for Wing Flapping ---
  // 1. enemy_bat_body (Standalone body with fluffy chest, ears, glowing eyes, fangs, little feet)
  g.clear();
  // Fluffy round bat body
  g.fillStyle(0x221530, 1);
  g.fillEllipse(32, 40, 28, 24);
  // Soft belly shading
  g.fillStyle(0x352349, 0.9);
  g.fillEllipse(32, 42, 20, 16);

  // Little bat feet / claws at the bottom
  g.fillStyle(0x130a1c, 1);
  g.fillCircle(27, 51, 2.5);
  g.fillCircle(37, 51, 2.5);

  // Bat Head
  g.fillStyle(0x2a1b38, 1);
  g.fillCircle(32, 27, 15);

  // Pointy Bat Ears
  g.fillStyle(0x2a1b38, 1);
  g.fillTriangle(22, 24, 18, 8, 30, 18);
  g.fillTriangle(42, 24, 46, 8, 34, 18);
  // Pink Inner Ears
  g.fillStyle(0xf472b6, 0.75);
  g.fillTriangle(23, 22, 20, 11, 28, 18);
  g.fillTriangle(41, 22, 44, 11, 36, 18);

  // Glowing Crimson Vampire Eyes
  g.fillStyle(0xef4444, 1);
  g.fillEllipse(27, 26, 4.5, 5);
  g.fillEllipse(37, 26, 4.5, 5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(28, 25, 1.6);
  g.fillCircle(38, 25, 1.6);

  // Cute bat nose
  g.fillStyle(0x0f0b14, 1);
  g.fillCircle(32, 30, 2.2);

  // Sharp vampire fangs
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(29, 32, 31, 32, 30, 37);
  g.fillTriangle(33, 32, 35, 32, 34, 37);
  g.generateTexture('enemy_bat_body', 64, 60);

  // 2. enemy_bat_wing_left (Shoulder on right edge at x=44, y=26)
  g.clear();
  g.fillStyle(0x191024, 1);
  g.beginPath();
  g.moveTo(44, 26);
  g.lineTo(6, 6);
  g.lineTo(12, 42);
  g.lineTo(22, 35);
  g.lineTo(32, 41);
  g.lineTo(44, 30);
  g.closePath();
  g.fillPath();

  // Leathery wing ribs & highlights
  g.lineStyle(2, 0x513873, 0.9);
  g.lineBetween(44, 26, 8, 8);
  g.lineBetween(8, 8, 12, 40);
  g.lineBetween(8, 8, 22, 34);
  g.lineBetween(8, 8, 32, 39);
  // Subtle membrane shading
  g.fillStyle(0x312046, 0.35);
  g.fillTriangle(44, 26, 8, 8, 22, 34);
  g.generateTexture('enemy_bat_wing_left', 48, 48);

  // 3. enemy_bat_wing_right (Shoulder on left edge at x=4, y=26)
  g.clear();
  g.fillStyle(0x191024, 1);
  g.beginPath();
  g.moveTo(4, 26);
  g.lineTo(42, 6);
  g.lineTo(36, 42);
  g.lineTo(26, 35);
  g.lineTo(16, 41);
  g.lineTo(4, 30);
  g.closePath();
  g.fillPath();

  // Leathery wing ribs & highlights
  g.lineStyle(2, 0x513873, 0.9);
  g.lineBetween(4, 26, 40, 8);
  g.lineBetween(40, 8, 36, 40);
  g.lineBetween(40, 8, 26, 34);
  g.lineBetween(40, 8, 16, 39);
  // Subtle membrane shading
  g.fillStyle(0x312046, 0.35);
  g.fillTriangle(4, 26, 40, 8, 26, 34);
  g.generateTexture('enemy_bat_wing_right', 48, 48);

  // --- 2.5D Scenery Props (Depth stones, boulders, and terrain accents) ---
  // scenery_stone_moss (Smooth river boulder with volumetric highlight & velvet moss)
  g.clear();
  // Ambient ground contact shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(40, 48, 68, 14);
  // Main stone mass (cool slate grey)
  g.fillStyle(0x475569, 1);
  g.fillEllipse(40, 36, 64, 32);
  // Volumetric upper light highlight
  g.fillStyle(0x94a3b8, 0.7);
  g.fillEllipse(36, 28, 48, 18);
  // Lush forest moss cap on top
  g.fillStyle(0x2e7d32, 0.95);
  g.fillEllipse(36, 24, 52, 14);
  g.fillStyle(0x66bb6a, 0.85);
  g.fillEllipse(32, 21, 38, 8);
  g.generateTexture('scenery_stone_moss', 80, 56);

  // scenery_stone_crag (Rugged mountain rock crag with sharp stone facets)
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(48, 64, 82, 16);
  // Dark base facet
  g.fillStyle(0x334155, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(10, 60),
    new Phaser.Math.Vector2(24, 20),
    new Phaser.Math.Vector2(52, 8),
    new Phaser.Math.Vector2(84, 28),
    new Phaser.Math.Vector2(88, 62),
  ], true);
  // Light sunlit facet
  g.fillStyle(0x64748b, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(24, 20),
    new Phaser.Math.Vector2(52, 8),
    new Phaser.Math.Vector2(56, 60),
    new Phaser.Math.Vector2(10, 60),
  ], true);
  // Crisp ridge highlight line
  g.lineStyle(2, 0xcbd5e1, 0.8);
  g.lineBetween(52, 8, 24, 20);
  g.lineBetween(52, 8, 56, 60);
  g.generateTexture('scenery_stone_crag', 96, 72);

  // scenery_stone_volcanic (Jagged obsidian rock with smoldering magma veins)
  g.clear();
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(40, 56, 72, 16);
  // Pitch-black obsidian body
  g.fillStyle(0x18181b, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(8, 52),
    new Phaser.Math.Vector2(20, 16),
    new Phaser.Math.Vector2(44, 6),
    new Phaser.Math.Vector2(72, 22),
    new Phaser.Math.Vector2(76, 54),
  ], true);
  // Basalt facet shading
  g.fillStyle(0x27272a, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(20, 16),
    new Phaser.Math.Vector2(44, 6),
    new Phaser.Math.Vector2(42, 52),
    new Phaser.Math.Vector2(8, 52),
  ], true);
  // Glowing magma fissure crack
  g.lineStyle(2.5, 0xef4444, 0.95);
  g.lineBetween(44, 12, 38, 32);
  g.lineBetween(38, 32, 52, 50);
  g.lineStyle(1.5, 0xfbbf24, 1);
  g.lineBetween(44, 12, 38, 32);
  g.lineBetween(38, 32, 52, 50);
  g.generateTexture('scenery_stone_volcanic', 80, 64);

  // scenery_stone_pebbles (Cluster of smooth pebbles)
  g.clear();
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(24, 26, 42, 10);
  g.fillStyle(0x52525b, 1);
  g.fillCircle(16, 20, 9);
  g.fillStyle(0x71717a, 1);
  g.fillCircle(14, 18, 5);
  g.fillStyle(0x3f3f46, 1);
  g.fillCircle(30, 22, 7);
  g.fillStyle(0x52525b, 1);
  g.fillCircle(29, 20, 4);
  g.generateTexture('scenery_stone_pebbles', 48, 32);

  // scenery_mushrooms (Forest red toadstools with white polka dots)
  g.clear();
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(32, 42, 54, 10);
  // Main stalk
  g.fillStyle(0xf1f5f9, 1);
  g.fillRoundedRect(25, 20, 14, 22, 6);
  g.fillStyle(0xe2e8f0, 1);
  g.fillRoundedRect(31, 20, 8, 22, 4);
  // Main red cap
  g.fillStyle(0xb91c1c, 1);
  g.fillEllipse(32, 18, 44, 24);
  g.fillStyle(0xdc2626, 1);
  g.fillEllipse(30, 16, 40, 20);
  g.fillStyle(0xef4444, 1);
  g.fillEllipse(28, 13, 30, 12);
  // White spots
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(24, 14, 3.5);
  g.fillCircle(35, 12, 3);
  g.fillCircle(42, 16, 2.8);
  g.fillCircle(18, 18, 2.5);
  g.fillCircle(30, 8, 2.8);
  // Baby mushroom next to it
  g.fillStyle(0xf1f5f9, 1);
  g.fillRoundedRect(48, 28, 8, 14, 3);
  g.fillStyle(0xb91c1c, 1);
  g.fillEllipse(52, 26, 18, 12);
  g.fillStyle(0xef4444, 1);
  g.fillEllipse(51, 25, 16, 10);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(50, 24, 2);
  g.fillCircle(54, 26, 1.8);
  g.generateTexture('scenery_mushrooms', 64, 48);

  // scenery_fern (Graceful woodland fern fronds)
  g.clear();
  g.fillStyle(0x000000, 0.22);
  g.fillEllipse(28, 50, 44, 8);
  // Main stems
  g.lineStyle(2.5, 0x14532d, 1);
  g.beginPath();
  g.moveTo(28, 50);
  g.lineTo(12, 16);
  g.moveTo(28, 50);
  g.lineTo(44, 14);
  g.moveTo(28, 50);
  g.lineTo(28, 10);
  g.strokePath();
  // Fern pinnules/leaflets
  const drawFernLeaves = (fx: number, fy: number, angleDeg: number, w: number, col: number) => {
    g.fillStyle(col, 0.92);
    g.fillEllipse(fx, fy, w, 6);
  };
  drawFernLeaves(18, 24, -30, 16, 0x15803d);
  drawFernLeaves(22, 32, -30, 20, 0x16a34a);
  drawFernLeaves(14, 18, -40, 12, 0x4ade80);
  drawFernLeaves(38, 22, 30, 16, 0x15803d);
  drawFernLeaves(34, 30, 30, 20, 0x16a34a);
  drawFernLeaves(42, 16, 40, 12, 0x4ade80);
  drawFernLeaves(28, 12, 0, 14, 0x22c55e);
  drawFernLeaves(28, 20, 0, 18, 0x16a34a);
  drawFernLeaves(28, 28, 0, 22, 0x15803d);
  g.generateTexture('scenery_fern', 56, 56);

  // scenery_flower_bush (Flowering lush bush)
  g.clear();
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(32, 42, 56, 12);
  // Foliage lobes
  g.fillStyle(0x14532d, 1);
  g.fillCircle(18, 30, 16);
  g.fillCircle(46, 30, 16);
  g.fillCircle(32, 22, 18);
  g.fillStyle(0x16a34a, 1);
  g.fillCircle(20, 26, 14);
  g.fillCircle(44, 26, 14);
  g.fillCircle(32, 18, 16);
  g.fillStyle(0x4ade80, 0.7);
  g.fillCircle(30, 15, 10);
  // Flower blossoms
  const flower = (bx: number, by: number, petalCol: number) => {
    g.fillStyle(petalCol, 1);
    g.fillCircle(bx - 3, by, 3);
    g.fillCircle(bx + 3, by, 3);
    g.fillCircle(bx, by - 3, 3);
    g.fillCircle(bx, by + 3, 3);
    g.fillStyle(0xfef08a, 1);
    g.fillCircle(bx, by, 2.5);
  };
  flower(20, 20, 0xf472b6);
  flower(44, 22, 0xf43f5e);
  flower(32, 12, 0xfbbf24);
  flower(30, 28, 0xa855f7);
  flower(42, 34, 0x38bdf8);
  g.generateTexture('scenery_flower_bush', 64, 48);

  // scenery_hanging_vine (Hanging ivy foliage)
  g.clear();
  g.lineStyle(3, 0x14532d, 1);
  g.beginPath();
  g.moveTo(20, 0);
  g.lineTo(16, 24);
  g.lineTo(24, 48);
  g.lineTo(18, 76);
  g.strokePath();
  const vineLeaf = (vx: number, vy: number, s: number) => {
    g.fillStyle(0x15803d, 1);
    g.fillEllipse(vx, vy, s * 1.4, s);
    g.fillStyle(0x4ade80, 0.85);
    g.fillEllipse(vx - 1, vy - 1, s * 0.9, s * 0.6);
  };
  vineLeaf(14, 12, 8);
  vineLeaf(25, 20, 9);
  vineLeaf(12, 32, 10);
  vineLeaf(26, 42, 9);
  vineLeaf(14, 54, 8);
  vineLeaf(24, 64, 7);
  vineLeaf(18, 74, 5);
  g.generateTexture('scenery_hanging_vine', 40, 80);

  // scenery_crystal (Mystic glowing crystal cluster)
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(24, 58, 42, 10);
  // Basalt rock base
  g.fillStyle(0x1e293b, 1);
  g.fillRoundedRect(8, 48, 32, 12, 4);
  // Main crystal
  g.fillStyle(0x7e22ce, 1);
  g.fillTriangle(24, 8, 14, 50, 34, 50);
  g.fillStyle(0xa855f7, 1);
  g.fillTriangle(24, 8, 20, 50, 34, 50);
  g.fillStyle(0xe9d5ff, 0.8);
  g.fillTriangle(24, 8, 22, 30, 26, 30);
  // Left angled crystal
  g.fillStyle(0x6b21a8, 1);
  g.fillTriangle(12, 22, 6, 50, 20, 50);
  g.fillStyle(0x9333ea, 1);
  g.fillTriangle(12, 22, 13, 50, 20, 50);
  // Right angled crystal
  g.fillStyle(0x581c87, 1);
  g.fillTriangle(36, 26, 28, 50, 42, 50);
  g.fillStyle(0x7c3aed, 1);
  g.fillTriangle(36, 26, 33, 50, 42, 50);
  g.generateTexture('scenery_crystal', 48, 64);

  // scenery_lantern (Garden lantern with glowing amber core)
  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(20, 52, 28, 8);
  // Wooden post & base
  g.fillStyle(0x3e200c, 1);
  g.fillRect(18, 24, 4, 30);
  g.fillRoundedRect(12, 50, 16, 4, 2);
  // Hanging arm
  g.fillRect(10, 10, 18, 3);
  g.fillRect(10, 10, 3, 10);
  // Roof cap
  g.fillStyle(0x271408, 1);
  g.fillTriangle(10, 18, 2, 23, 18, 23);
  // Glowing paper lantern
  g.fillStyle(0xd97706, 1);
  g.fillRoundedRect(4, 23, 12, 14, 3);
  g.fillStyle(0xfde047, 1);
  g.fillRoundedRect(5, 24, 10, 12, 2);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(10, 30, 3);
  g.generateTexture('scenery_lantern', 40, 56);

  // --- Farm & Countryside Scenery Props ---
  // scenery_anthill (Sandy loam anthill mound with crater entrance & busy ants)
  g.clear();
  g.fillStyle(0x000000, 0.32);
  g.fillEllipse(40, 52, 68, 14);
  // Base earth mound
  g.fillStyle(0x78350f, 1);
  g.fillEllipse(40, 44, 62, 26);
  // Upper cone mound
  g.fillStyle(0xb45309, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(14, 50),
    new Phaser.Math.Vector2(28, 26),
    new Phaser.Math.Vector2(40, 20),
    new Phaser.Math.Vector2(52, 26),
    new Phaser.Math.Vector2(66, 50),
  ], true);
  // Sunlit warm sandy highlight
  g.fillStyle(0xd97706, 0.9);
  g.fillEllipse(35, 36, 36, 18);
  // Sand grains & tiny pebbles
  g.fillStyle(0x451a03, 0.8);
  g.fillCircle(24, 42, 2);
  g.fillCircle(48, 44, 2.5);
  g.fillCircle(38, 32, 1.8);
  g.fillStyle(0xfde047, 0.6);
  g.fillCircle(30, 36, 1.5);
  g.fillCircle(44, 30, 1.5);
  // Crater hole at top
  g.fillStyle(0x271408, 1);
  g.fillEllipse(40, 22, 14, 7);
  g.fillStyle(0x0f0804, 1);
  g.fillEllipse(40, 23, 10, 5);
  g.lineStyle(1.5, 0xf59e0b, 0.7);
  g.strokeEllipse(40, 22, 14, 7);
  // Busy tiny black ants crawling!
  const drawAnt = (ax: number, ay: number) => {
    g.fillStyle(0x18181b, 1);
    g.fillCircle(ax - 2.5, ay, 1.6);
    g.fillCircle(ax, ay, 1.4);
    g.fillCircle(ax + 3, ay - 0.5, 2);
    g.lineStyle(1, 0x18181b, 0.9);
    g.lineBetween(ax - 1, ay, ax - 3, ay + 3);
    g.lineBetween(ax + 1, ay, ax + 3, ay + 3);
    g.lineBetween(ax, ay, ax, ay - 3);
  };
  drawAnt(52, 34);
  drawAnt(33, 23);
  // Ant on the ground with a green leaf crumb
  drawAnt(20, 48);
  g.fillStyle(0x22c55e, 1);
  g.fillTriangle(23, 44, 26, 42, 25, 47);
  g.generateTexture('scenery_anthill', 80, 60);

  // scenery_barn (Rustic red country barn with gambrel roof & white X doors)
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(48, 72, 86, 14);
  // Concrete/stone foundation plinth
  g.fillStyle(0x475569, 1);
  g.fillRoundedRect(16, 68, 64, 6, 2);
  // Red clapboard barn body
  g.fillStyle(0xb91c1c, 1);
  g.fillRect(18, 34, 60, 36);
  // Vertical plank lines
  g.lineStyle(1, 0x991b1b, 0.7);
  for (let px = 24; px <= 72; px += 6) {
    g.lineBetween(px, 34, px, 70);
  }
  // Gambrel roof - lower steep slope
  g.fillStyle(0x1e293b, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(12, 36),
    new Phaser.Math.Vector2(24, 16),
    new Phaser.Math.Vector2(72, 16),
    new Phaser.Math.Vector2(84, 36),
  ], true);
  // Gambrel roof - upper peak slope
  g.fillStyle(0x334155, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(24, 16),
    new Phaser.Math.Vector2(48, 5),
    new Phaser.Math.Vector2(72, 16),
  ], true);
  // White roof trim / fascia overhang
  g.lineStyle(2, 0xf8fafc, 1);
  g.lineBetween(12, 36, 24, 16);
  g.lineBetween(24, 16, 48, 5);
  g.lineBetween(48, 5, 72, 16);
  g.lineBetween(72, 16, 84, 36);
  // White double barn door frame
  g.fillStyle(0xf8fafc, 1);
  g.fillRoundedRect(35, 44, 26, 26, 2);
  // Left door panel (red)
  g.fillStyle(0x991b1b, 1);
  g.fillRect(37, 46, 10, 22);
  // Right door panel (red)
  g.fillRect(49, 46, 10, 22);
  // White "X" cross-bucks on doors
  g.lineStyle(1.5, 0xf8fafc, 1);
  g.lineBetween(37, 46, 47, 68);
  g.lineBetween(37, 68, 47, 46);
  g.lineBetween(49, 46, 59, 68);
  g.lineBetween(49, 68, 59, 46);
  // Iron door handles
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(45, 57, 1.5);
  g.fillCircle(51, 57, 1.5);
  // Hayloft window with golden straw peeking out
  g.fillStyle(0x0f172a, 1);
  g.fillRoundedRect(42, 20, 12, 12, 3);
  g.lineStyle(1.5, 0xf8fafc, 1);
  g.strokeRoundedRect(42, 20, 12, 12, 3);
  // Straw clump spill
  g.fillStyle(0xfde047, 1);
  g.fillEllipse(48, 32, 10, 4);
  g.fillStyle(0xeab308, 1);
  g.fillCircle(45, 33, 2);
  g.fillCircle(51, 33, 2);
  // Rooftop cupola & weather vane
  g.fillStyle(0xf8fafc, 1);
  g.fillRect(45, 2, 6, 4);
  g.fillStyle(0x0f172a, 1);
  g.lineStyle(1.5, 0xd97706, 1);
  g.lineBetween(48, 0, 48, 3);
  g.lineBetween(45, 1, 51, 1);
  g.generateTexture('scenery_barn', 96, 80);

  // scenery_windmill (Rustic farm windmill with wooden lattice & spinning canvas sails)
  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(40, 88, 56, 12);
  // Tapered stone/timber tower body
  g.fillStyle(0xe2e8f0, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(24, 86),
    new Phaser.Math.Vector2(31, 38),
    new Phaser.Math.Vector2(49, 38),
    new Phaser.Math.Vector2(56, 86),
  ], true);
  // Shaded right facet
  g.fillStyle(0xcbd5e1, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(40, 86),
    new Phaser.Math.Vector2(40, 38),
    new Phaser.Math.Vector2(49, 38),
    new Phaser.Math.Vector2(56, 86),
  ], true);
  // Wooden timber beams around tower
  g.lineStyle(1.5, 0x78350f, 0.8);
  g.lineBetween(26, 70, 54, 70);
  g.lineBetween(29, 52, 51, 52);
  // Wooden entrance door at base
  g.fillStyle(0x713f12, 1);
  g.fillRoundedRect(35, 68, 10, 18, 4);
  g.fillStyle(0xfde047, 1);
  g.fillCircle(42, 77, 1.2);
  // Small attic window
  g.fillStyle(0x0284c7, 1);
  g.fillRect(37, 44, 6, 6);
  g.lineStyle(1, 0xffffff, 0.9);
  g.strokeRect(37, 44, 6, 6);
  // Conical roof cap
  g.fillStyle(0x991b1b, 1);
  g.fillTriangle(40, 24, 27, 38, 53, 38);
  g.fillStyle(0xdc2626, 1);
  g.fillTriangle(40, 24, 27, 38, 40, 38);
  // Rotor center hub
  g.fillStyle(0x451a03, 1);
  g.fillCircle(40, 38, 4.5);
  // 4 Windmill Sail Arms & Canvas
  const drawSail = (x1: number, y1: number, x2: number, y2: number, cx: number, cy: number) => {
    // Wooden spar
    g.lineStyle(2, 0x451a03, 1);
    g.lineBetween(40, 38, x2, y2);
    // Canvas cloth
    g.fillStyle(0xfffbeb, 0.95);
    g.fillPoints([
      new Phaser.Math.Vector2(40, 38),
      new Phaser.Math.Vector2(x2, y2),
      new Phaser.Math.Vector2(cx, cy),
    ], true);
    g.lineStyle(1, 0xd4d4d8, 0.8);
    g.strokePoints([
      new Phaser.Math.Vector2(40, 38),
      new Phaser.Math.Vector2(x2, y2),
      new Phaser.Math.Vector2(cx, cy),
    ], true);
  };
  drawSail(40, 38, 16, 14, 26, 10);
  drawSail(40, 38, 64, 14, 68, 24);
  drawSail(40, 38, 64, 62, 54, 66);
  drawSail(40, 38, 16, 62, 12, 52);
  // Hub pin
  g.fillStyle(0xfde047, 1);
  g.fillCircle(40, 38, 2);
  g.generateTexture('scenery_windmill', 80, 96);

  // scenery_hay_bale (Stack of golden harvest hay bales tied with twine & pitchfork)
  g.clear();
  g.fillStyle(0x000000, 0.28);
  g.fillEllipse(36, 48, 62, 12);
  // Bottom horizontal cylindrical bale
  g.fillStyle(0xca8a04, 1);
  g.fillEllipse(46, 38, 42, 20);
  g.fillStyle(0xeab308, 1);
  g.fillEllipse(44, 37, 40, 18);
  // Rolled circular face on left
  g.fillStyle(0xa16207, 1);
  g.fillEllipse(24, 38, 20, 20);
  g.fillStyle(0xca8a04, 1);
  g.fillEllipse(23, 38, 17, 17);
  // Spiral straw pattern on face
  g.lineStyle(1.5, 0x78350f, 0.8);
  g.strokeCircle(23, 38, 5);
  g.strokeCircle(23, 38, 2);
  // Twine binder strings
  g.lineStyle(1.5, 0xd97706, 1);
  g.lineBetween(36, 28, 36, 48);
  g.lineBetween(52, 28, 52, 48);
  // Top stacked bale
  g.fillStyle(0xeab308, 1);
  g.fillEllipse(42, 23, 36, 18);
  g.fillStyle(0xfacc15, 1);
  g.fillEllipse(40, 22, 34, 16);
  g.fillStyle(0xa16207, 1);
  g.fillEllipse(24, 23, 16, 16);
  g.fillStyle(0xca8a04, 1);
  g.fillEllipse(23, 23, 13, 13);
  g.lineStyle(1.5, 0x78350f, 0.8);
  g.strokeCircle(23, 23, 4);
  // Straw texture highlights
  g.lineStyle(1, 0xfef08a, 0.9);
  g.lineBetween(32, 20, 48, 20);
  g.lineBetween(30, 24, 52, 24);
  // Stray straw wisps
  g.lineBetween(14, 46, 10, 49);
  g.lineBetween(62, 44, 68, 46);
  // Leaning pitchfork
  g.lineStyle(2, 0x78350f, 1);
  g.lineBetween(10, 12, 18, 50);
  // Silver fork head
  g.lineStyle(1.5, 0x94a3b8, 1);
  g.lineBetween(8, 14, 14, 11);
  g.lineBetween(8, 8, 8, 14);
  g.lineBetween(11, 7, 11, 13);
  g.lineBetween(14, 6, 14, 12);
  g.generateTexture('scenery_hay_bale', 72, 56);

  // scenery_crop_patch (Rich garden soil mound with ripe carrots & a fat round pumpkin)
  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(40, 44, 72, 12);
  // Dark loam soil mound
  g.fillStyle(0x3f220f, 1);
  g.fillRoundedRect(8, 24, 64, 22, 10);
  g.fillStyle(0x5b3317, 1);
  g.fillEllipse(40, 32, 58, 14);
  g.fillStyle(0x78431e, 0.8);
  g.fillEllipse(36, 30, 48, 8);
  // Carrots poking through dirt
  // Carrot 1
  g.fillStyle(0xea580c, 1);
  g.fillEllipse(20, 28, 8, 6);
  g.fillStyle(0xf97316, 1);
  g.fillEllipse(20, 27, 6, 4);
  // Carrot 1 leafy fronds
  g.fillStyle(0x16a34a, 1);
  g.fillTriangle(20, 14, 16, 26, 20, 26);
  g.fillStyle(0x4ade80, 1);
  g.fillTriangle(20, 14, 20, 26, 24, 26);
  // Carrot 2
  g.fillStyle(0xea580c, 1);
  g.fillEllipse(34, 30, 9, 6);
  g.fillStyle(0xf97316, 1);
  g.fillEllipse(34, 29, 7, 4);
  // Carrot 2 leafy fronds
  g.fillStyle(0x15803d, 1);
  g.fillTriangle(34, 16, 30, 28, 34, 28);
  g.fillStyle(0x22c55e, 1);
  g.fillTriangle(34, 16, 34, 28, 38, 28);
  // Fat round pumpkin on the right
  g.fillStyle(0xc2410c, 1);
  g.fillCircle(56, 30, 13);
  // Pumpkin ribs / lobes
  g.fillStyle(0xea580c, 1);
  g.fillEllipse(56, 30, 18, 24);
  g.fillStyle(0xf97316, 1);
  g.fillEllipse(56, 30, 11, 24);
  g.fillStyle(0xfb923c, 0.9);
  g.fillEllipse(54, 28, 6, 18);
  // Curly green pumpkin vine stem
  g.lineStyle(2.5, 0x15803d, 1);
  g.lineBetween(56, 19, 57, 14);
  g.lineStyle(1.5, 0x4ade80, 1);
  g.lineBetween(57, 14, 62, 16);
  g.generateTexture('scenery_crop_patch', 80, 52);

  // scenery_fence (Rustic post-and-rail wooden farm fence with little base wildflowers)
  g.clear();
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(42, 42, 74, 8);
  // Two vertical fence posts
  g.fillStyle(0x78350f, 1);
  g.fillRoundedRect(14, 10, 10, 34, 2);
  g.fillRoundedRect(60, 10, 10, 34, 2);
  // Post highlights & chamfered top caps
  g.fillStyle(0x92400e, 1);
  g.fillTriangle(14, 10, 19, 6, 24, 10);
  g.fillTriangle(60, 10, 65, 6, 70, 10);
  g.fillRect(16, 12, 3, 30);
  g.fillRect(62, 12, 3, 30);
  // Two horizontal split rails
  // Top rail
  g.fillStyle(0x854d0e, 1);
  g.fillRoundedRect(4, 16, 76, 7, 2);
  g.fillStyle(0xa16207, 1);
  g.fillRect(4, 17, 76, 2.5);
  // Bottom rail
  g.fillStyle(0x713f12, 1);
  g.fillRoundedRect(4, 28, 76, 7, 2);
  g.fillStyle(0x854d0e, 1);
  g.fillRect(4, 29, 76, 2.5);
  // Iron peg bolts
  g.fillStyle(0x1e293b, 1);
  g.fillCircle(19, 19, 1.5);
  g.fillCircle(19, 31, 1.5);
  g.fillCircle(65, 19, 1.5);
  g.fillCircle(65, 31, 1.5);
  // Base flowers & grass sprouts
  g.fillStyle(0x22c55e, 1);
  g.fillTriangle(12, 44, 10, 36, 14, 44);
  g.fillTriangle(68, 44, 71, 36, 66, 44);
  g.fillStyle(0xf472b6, 1);
  g.fillCircle(10, 36, 2.5);
  g.fillCircle(71, 36, 2.5);
  g.generateTexture('scenery_fence', 84, 48);

  // scenery_water_well (Cobblestone wishing well with bucket & timber shingled roof)
  g.clear();
  g.fillStyle(0x000000, 0.32);
  g.fillEllipse(34, 68, 54, 12);
  // Cobblestone round base
  g.fillStyle(0x334155, 1);
  g.fillRoundedRect(14, 42, 40, 26, 6);
  // Individual rounded stones
  g.fillStyle(0x64748b, 1);
  g.fillRoundedRect(16, 44, 10, 6, 2);
  g.fillRoundedRect(28, 44, 12, 6, 2);
  g.fillRoundedRect(42, 44, 10, 6, 2);
  g.fillRoundedRect(20, 52, 12, 6, 2);
  g.fillRoundedRect(34, 52, 14, 6, 2);
  g.fillRoundedRect(16, 60, 14, 6, 2);
  g.fillRoundedRect(32, 60, 12, 6, 2);
  // Stone top rim
  g.fillStyle(0x94a3b8, 1);
  g.fillEllipse(34, 42, 42, 10);
  // Dark deep water interior with sky-blue reflection
  g.fillStyle(0x0f172a, 1);
  g.fillEllipse(34, 42, 34, 7);
  g.fillStyle(0x38bdf8, 0.8);
  g.fillEllipse(34, 43, 20, 4);
  // Two timber vertical posts
  g.fillStyle(0x5c2e0b, 1);
  g.fillRect(17, 16, 4, 30);
  g.fillRect(47, 16, 4, 30);
  // Cross axle with coiled hemp rope
  g.fillStyle(0xd97706, 1);
  g.fillRect(21, 25, 26, 6);
  // Iron crank handle
  g.lineStyle(2, 0x1e293b, 1);
  g.lineBetween(47, 28, 54, 28);
  g.lineBetween(54, 28, 54, 34);
  // Suspended wooden bucket
  g.lineStyle(1, 0xd97706, 1);
  g.lineBetween(34, 30, 34, 36);
  g.fillStyle(0x78350f, 1);
  g.fillRoundedRect(30, 35, 8, 8, 2);
  g.fillStyle(0x38bdf8, 1);
  g.fillCircle(34, 36, 2);
  // Shingled roof canopy
  g.fillStyle(0x78350f, 1);
  g.fillTriangle(34, 4, 8, 18, 60, 18);
  g.fillStyle(0x9a3412, 1);
  g.fillTriangle(34, 4, 8, 18, 34, 18);
  g.lineStyle(2, 0x451a03, 1);
  g.lineBetween(8, 18, 60, 18);
  g.generateTexture('scenery_water_well', 68, 76);

  // scenery_beehive (Golden straw skep apiary on wooden stool stand with buzzy bees)
  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(28, 56, 44, 10);
  // Wooden stool bench stand
  g.fillStyle(0x78350f, 1);
  g.fillRect(12, 46, 32, 4);
  g.fillRect(15, 48, 3, 10);
  g.fillRect(38, 48, 3, 10);
  // Layered golden coiled straw skep dome
  g.fillStyle(0xb45309, 1);
  g.fillEllipse(28, 44, 32, 10);
  g.fillStyle(0xd97706, 1);
  g.fillEllipse(28, 36, 30, 10);
  g.fillStyle(0xf59e0b, 1);
  g.fillEllipse(28, 28, 26, 10);
  g.fillStyle(0xfbbf24, 1);
  g.fillEllipse(28, 20, 20, 9);
  // Top braided loop handle
  g.fillStyle(0xd97706, 1);
  g.fillCircle(28, 13, 5);
  g.fillStyle(0x000000, 0.4);
  g.fillCircle(28, 13, 2);
  // Coiled straw rib lines
  g.lineStyle(1.5, 0x92400e, 0.7);
  g.strokeEllipse(28, 44, 32, 10);
  g.strokeEllipse(28, 36, 30, 10);
  g.strokeEllipse(28, 28, 26, 10);
  // Entrance slit hole
  g.fillStyle(0x451a03, 1);
  g.fillRoundedRect(25, 39, 6, 7, 3);
  // Golden honey droplet
  g.fillStyle(0xf59e0b, 1);
  g.fillCircle(28, 48, 2);
  // Cute hovering honeybees
  const drawBee = (bx: number, by: number) => {
    // Yellow/black striped body
    g.fillStyle(0xfacc15, 1);
    g.fillEllipse(bx, by, 5, 3.5);
    g.fillStyle(0x18181b, 1);
    g.fillRect(bx - 0.5, by - 1.5, 1.5, 3);
    // Translucent wings
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(bx, by - 2.5, 3, 2);
  };
  drawBee(38, 22);
  drawBee(15, 28);
  drawBee(36, 38);
  g.generateTexture('scenery_beehive', 56, 64);

  // scenery_scarecrow (Garden scarecrow with denim overalls, straw hat & button eyes)
  g.clear();
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(30, 64, 36, 8);
  // Central wooden post
  g.fillStyle(0x5c2e0b, 1);
  g.fillRect(28, 20, 4, 46);
  // Horizontal crossbar arm stick
  g.fillRect(8, 28, 44, 3);
  // Denim overalls body
  g.fillStyle(0x0284c7, 1);
  g.fillRoundedRect(22, 25, 16, 22, 3);
  // Red fabric patch on knee/belly
  g.fillStyle(0xef4444, 1);
  g.fillRect(24, 34, 4, 4);
  // Left sleeve with bursting straw tuft
  g.fillStyle(0x0369a1, 1);
  g.fillRect(12, 26, 11, 6);
  g.fillStyle(0xfde047, 1);
  g.fillTriangle(12, 26, 7, 29, 12, 32);
  // Right sleeve with bursting straw tuft
  g.fillStyle(0x0369a1, 1);
  g.fillRect(37, 26, 11, 6);
  g.fillStyle(0xfde047, 1);
  g.fillTriangle(48, 26, 53, 29, 48, 32);
  // Rope belt
  g.lineStyle(2, 0xd97706, 1);
  g.lineBetween(22, 40, 38, 40);
  // Burlap sack head
  g.fillStyle(0xd4a373, 1);
  g.fillCircle(30, 18, 8);
  // Button eyes
  g.fillStyle(0x1e293b, 1);
  g.fillCircle(28, 17, 1.4);
  g.fillCircle(32, 17, 1.4);
  // Stitched smile
  g.lineStyle(1, 0x78350f, 1);
  g.beginPath();
  g.arc(30, 19, 3, 0.2, Math.PI - 0.2);
  g.strokePath();
  // Straw hair poke
  g.lineStyle(1.5, 0xfde047, 1);
  g.lineBetween(24, 13, 21, 16);
  g.lineBetween(36, 13, 39, 16);
  // Floppy farm straw hat
  g.fillStyle(0xca8a04, 1);
  g.fillEllipse(30, 13, 28, 6);
  g.fillStyle(0xa16207, 1);
  g.fillRoundedRect(24, 4, 12, 9, 3);
  g.fillStyle(0xdc2626, 1);
  g.fillRect(24, 10, 12, 2.5);
  g.generateTexture('scenery_scarecrow', 60, 72);

  // scenery_campfire (Stone circle fire pit with burning logs & glowing flames)
  g.clear();
  g.fillStyle(0x000000, 0.32);
  g.fillEllipse(32, 42, 54, 12);
  // Warm orange ground ambient light
  g.fillStyle(0xf97316, 0.25);
  g.fillEllipse(32, 40, 48, 10);
  // Ring of river cobblestones
  const drawFireStone = (sx: number, sy: number, r: number) => {
    g.fillStyle(0x475569, 1);
    g.fillCircle(sx, sy, r);
    g.fillStyle(0x94a3b8, 0.8);
    g.fillCircle(sx - 1, sy - 1, r * 0.6);
  };
  drawFireStone(14, 42, 4.5);
  drawFireStone(22, 45, 5);
  drawFireStone(32, 46, 5.5);
  drawFireStone(42, 45, 5);
  drawFireStone(50, 42, 4.5);
  drawFireStone(18, 37, 4);
  drawFireStone(46, 37, 4);
  // Charred crossed logs
  g.lineStyle(5, 0x271408, 1);
  g.lineBetween(18, 38, 44, 28);
  g.lineBetween(46, 38, 20, 28);
  // Red hot glowing coals in center
  g.fillStyle(0xdc2626, 1);
  g.fillCircle(32, 35, 7);
  g.fillStyle(0xf97316, 1);
  g.fillCircle(32, 35, 4.5);
  // Layered flickering fire flames
  g.fillStyle(0xea580c, 0.95);
  g.fillTriangle(32, 6, 20, 36, 44, 36);
  g.fillStyle(0xf59e0b, 1);
  g.fillTriangle(31, 10, 23, 34, 41, 34);
  g.fillStyle(0xfde047, 1);
  g.fillTriangle(32, 14, 26, 32, 38, 32);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(32, 28, 3.5);
  // Floating fiery spark particles
  g.fillStyle(0xfef08a, 1);
  g.fillCircle(26, 8, 1.5);
  g.fillCircle(38, 6, 1.5);
  g.fillCircle(33, 2, 1.2);
  g.generateTexture('scenery_campfire', 64, 52);

  // drop_moonstone (Nocturnal bat loot, 150c)
  g.clear();
  g.fillStyle(0x818cf8, 0.3);
  g.fillCircle(16, 16, 15);
  g.fillStyle(0x38bdf8, 0.6);
  g.fillCircle(16, 16, 12);
  g.fillStyle(0xc084fc, 0.9);
  g.fillCircle(16, 16, 9);
  g.fillStyle(0xe0e7ff, 1);
  g.fillTriangle(16, 5, 25, 14, 16, 27);
  g.fillStyle(0xffffff, 0.95);
  g.fillTriangle(16, 5, 7, 14, 16, 27);
  g.fillTriangle(12, 10, 20, 10, 16, 17);
  g.generateTexture('drop_moonstone', 32, 32);

  // icon_trophy (Golden Trophy for Achievements)
  g.clear();
  // Pedestal base
  g.fillStyle(0x78350f, 1);
  g.fillRoundedRect(10, 34, 24, 8, 2);
  g.fillStyle(0xb45309, 1);
  g.fillRect(14, 28, 16, 7);
  // Gold Cup
  g.fillStyle(0xf59e0b, 1);
  g.fillRoundedRect(12, 6, 20, 22, 6);
  g.fillStyle(0xfde047, 1);
  g.fillCircle(22, 14, 8);
  // Cup Handles
  g.lineStyle(3, 0xd97706, 1);
  g.beginPath();
  g.arc(10, 14, 6, -Math.PI / 2, Math.PI / 2);
  g.strokePath();
  g.beginPath();
  g.arc(34, 14, 6, Math.PI / 2, -Math.PI / 2);
  g.strokePath();
  // Shiny star on cup
  g.fillStyle(0xffffff, 1);
  g.fillCircle(22, 14, 2.5);
  g.generateTexture('icon_trophy', 44, 44);

  g.destroy();
}
