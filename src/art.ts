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

// ============================================================================
// HIGH-DEFINITION 2.5D ILLUSTRATED CANVAS ART ENGINE (Gemini 4 Argon Edition)
// Uses native HTML5 Canvas2D radial/linear gradients, anti-aliased Bezier
// anatomy, layered feather plumage, studio catchlights, and volumetric shading.
// ============================================================================

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function rgba(hex: number, a = 1): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function mixHex(c1: number, c2: number, t: number): number {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

function lighten(hex: number, amt: number): number {
  return mixHex(hex, 0xffffff, Math.min(1, Math.max(0, amt)));
}

function darken(hex: number, amt: number): number {
  return mixHex(hex, 0x05050a, Math.min(1, Math.max(0, amt)));
}

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
) {
  if (scene.textures.exists(key)) {
    scene.textures.remove(key);
  }
  const pw = Math.round(width * HI_RES_SCALE);
  const ph = Math.round(height * HI_RES_SCALE);
  const cTex = scene.textures.createCanvas(key, pw, ph);
  if (!cTex) return;
  const ctx = cTex.getContext();
  ctx.save();
  ctx.clearRect(0, 0, pw, ph);
  ctx.scale(HI_RES_SCALE, HI_RES_SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  drawFn(ctx, width, height);
  ctx.restore();
  cTex.refresh();

  const frame = cTex.get('__BASE') as any;
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

function drawEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawStudioEye(ctx: CanvasRenderingContext2D, ex: number, ey: number, er: number, irisCol: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  drawEllipse(ctx, ex, ey + 0.8, er + 1.0, er + 1.0);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  drawEllipse(ctx, ex, ey, er, er);
  ctx.fill();
  ctx.fillStyle = irisCol;
  drawEllipse(ctx, ex, ey, er * 0.82, er * 0.82);
  ctx.fill();
  ctx.fillStyle = '#090a0f';
  drawEllipse(ctx, ex, ey, er * 0.52, er * 0.52);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  drawEllipse(ctx, ex - er * 0.25, ey - er * 0.28, Math.max(1.0, er * 0.26), Math.max(0.9, er * 0.22));
  ctx.fill();
}

/**
 * Draws a richly shaded, anatomically sculpted avian model for every species and growth stage (0, 1, 2)
 * plus its multi-feathered articulated wing texture.
 */
function drawSimpleBird(scene: Phaser.Scene, key: string, s: BirdLook, stage: number) {
  const sc = stage === 0 ? 0.72 : stage === 1 ? 0.86 : 1.0;
  const cw = stage === 0 ? 84 : stage === 1 ? 92 : 100;
  const ch = stage === 0 ? 76 : stage === 1 ? 82 : 86;
  const cx = stage === 0 ? 40 : stage === 1 ? 45 : 50;
  const cy = stage === 0 ? 40 : stage === 1 ? 44 : 46;

  const isCat = key === 'infiltrator';
  const isWyvern = key === 'wyvern';
  const isOwl = (key === 'owl' || s.horns) && !isWyvern;
  const isToucan = key === 'toucan';
  const isTreeCreeper = key === 'tree_creeper';
  const isPhoenix = key === 'phoenix';
  const isFalcon = key === 'piranha_finch' || key === 'falcon';
  const isCanary = key === 'canary';
  const isMama = key === 'mama';
  const isCrow = key === 'crow';
  const isHawk = key === 'hawk' || (s.angry && !isFalcon && !isCrow && !isWyvern);

  const renderBirdBody = (ctx: CanvasRenderingContext2D) => {
    const footY = cy + Math.round(34 * sc);
    const headTopY = cy - Math.round(24 * sc);
    const bw = Math.round(34 * sc);
    const bh = Math.round(30 * sc);

    // -------------------------------------------------------------------------
    // 1. ARTICULATED AVIAN TALONS / FEET (or Cat Paws for Infiltrator)
    // -------------------------------------------------------------------------
    if (isCat) {
      // Plush ginger & white kitty paws
      for (const lx of [cx - 7 * sc, cx + 8 * sc]) {
        ctx.fillStyle = rgba(darken(s.body, 0.2));
        drawEllipse(ctx, lx, footY - 4 * sc, 4.5 * sc, 5.5 * sc);
        ctx.fill();
        ctx.fillStyle = rgba(0xfff5eb);
        drawEllipse(ctx, lx + 1.2 * sc, footY - 0.5 * sc, 4.8 * sc, 3 * sc);
        ctx.fill();
        ctx.strokeStyle = rgba(darken(s.body, 0.45), 0.7);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    } else {
      const legCol = isFalcon || isHawk || isOwl ? 0xf59e0b : isCrow || isWyvern ? 0x374151 : 0xf08c28;
      const legDark = darken(legCol, 0.35);
      for (const [idx, lx] of [cx - 6 * sc, cx + 8 * sc].entries()) {
        // Feathered tibial cuff at top of leg
        ctx.fillStyle = rgba(darken(s.body, idx === 0 ? 0.18 : 0.06));
        drawEllipse(ctx, lx, footY - 10 * sc, 4.2 * sc, 4.5 * sc);
        ctx.fill();

        // Tarsus shank
        ctx.strokeStyle = rgba(idx === 0 ? legDark : legCol);
        ctx.lineWidth = (stage === 0 ? 2.2 : 2.9);
        ctx.beginPath();
        ctx.moveTo(lx, footY - 9 * sc);
        ctx.lineTo(lx + 1 * sc, footY - 1 * sc);
        ctx.stroke();

        // Forward gripping toes + back hallux
        ctx.lineWidth = (stage === 0 ? 1.8 : 2.3);
        ctx.beginPath();
        ctx.moveTo(lx - 4.5 * sc, footY + 0.5);
        ctx.quadraticCurveTo(lx + 1 * sc, footY - 1.5, lx + 6.5 * sc, footY + 0.8);
        ctx.moveTo(lx + 1 * sc, footY - 1);
        ctx.lineTo(lx + 4.5 * sc, footY + 1.5);
        ctx.stroke();

        // Tiny curved keratin claws
        ctx.strokeStyle = rgba(0x1e1b18, 0.85);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(lx + 6.5 * sc, footY + 0.8);
        ctx.lineTo(lx + 8 * sc, footY + 2.2);
        ctx.moveTo(lx - 4.5 * sc, footY + 0.5);
        ctx.lineTo(lx - 5.8 * sc, footY + 1.8);
        ctx.stroke();
      }
    }

    // -------------------------------------------------------------------------
    // 2. SCULPTED SPECIES TAILS (Multi-feather rectrices & flowing plumes)
    // -------------------------------------------------------------------------
    ctx.save();
    if (isPhoenix) {
      // Three sinuous S-curved celestial fire ribbon plumes with glowing ember eyespots
      const plumes = [
        { dy: -2, endX: -48 * sc, endY: 16 * sc, cp1x: -32 * sc, cp1y: -10 * sc, cp2x: -40 * sc, cp2y: 24 * sc, col: 0xff3d00, tip: 0xffeb3b, w: 4.2 * sc },
        { dy: 4, endX: -52 * sc, endY: 28 * sc, cp1x: -30 * sc, cp1y: 4 * sc, cp2x: -42 * sc, cp2y: 34 * sc, col: 0xff9100, tip: 0xfff59d, w: 3.6 * sc },
        { dy: 9, endX: -40 * sc, endY: 35 * sc, cp1x: -26 * sc, cp1y: 18 * sc, cp2x: -34 * sc, cp2y: 38 * sc, col: 0xd50000, tip: 0xffab00, w: 3.0 * sc },
      ];
      for (const p of plumes) {
        const grad = ctx.createLinearGradient(cx - 18 * sc, cy, cx + p.endX, cy + p.endY);
        grad.addColorStop(0, rgba(s.body));
        grad.addColorStop(0.55, rgba(p.col));
        grad.addColorStop(1, rgba(p.tip));
        ctx.strokeStyle = grad;
        ctx.lineWidth = p.w;
        ctx.beginPath();
        ctx.moveTo(cx - 18 * sc, cy + p.dy * sc);
        ctx.bezierCurveTo(cx + p.cp1x, cy + p.cp1y, cx + p.cp2x, cy + p.cp2y, cx + p.endX, cy + p.endY);
        ctx.stroke();

        // Glowing solar eyespot at tip of each streamer
        const ex = cx + p.endX;
        const ey = cy + p.endY;
        const eGrad = ctx.createRadialGradient(ex, ey, 0.5, ex, ey, 5.5 * sc);
        eGrad.addColorStop(0, '#ffffff');
        eGrad.addColorStop(0.45, rgba(p.tip));
        eGrad.addColorStop(1, rgba(p.col, 0));
        ctx.fillStyle = eGrad;
        drawEllipse(ctx, ex, ey, 5.5 * sc, 5.5 * sc);
        ctx.fill();
      }
    } else if (isCat) {
      // Plush curving ginger tabby cat tail with tiger stripes
      ctx.lineWidth = 8.5 * sc;
      ctx.strokeStyle = rgba(darken(s.body, 0.25));
      ctx.beginPath();
      ctx.moveTo(cx - 22 * sc, cy + 8 * sc);
      ctx.bezierCurveTo(cx - 38 * sc, cy + 12 * sc, cx - 48 * sc, cy - 8 * sc, cx - 40 * sc, cy - 20 * sc);
      ctx.stroke();

      ctx.lineWidth = 6.8 * sc;
      ctx.strokeStyle = rgba(s.body);
      ctx.stroke();

      // Tabby tail rings
      ctx.lineWidth = 2.2 * sc;
      ctx.strokeStyle = rgba(darken(s.body, 0.35));
      for (const [rx, ry] of [[-33, 6], [-40, -1], [-42, -10]]) {
        ctx.beginPath();
        ctx.moveTo(cx + (rx - 2) * sc, cy + (ry - 2) * sc);
        ctx.lineTo(cx + (rx + 3) * sc, cy + (ry + 2) * sc);
        ctx.stroke();
      }
    } else if (isWyvern) {
      // Barbed draconic tail with crimson spade tip
      ctx.lineWidth = 6 * sc;
      ctx.strokeStyle = rgba(s.body);
      ctx.beginPath();
      ctx.moveTo(cx - 20 * sc, cy + 6 * sc);
      ctx.quadraticCurveTo(cx - 38 * sc, cy + 16 * sc, cx - 46 * sc, cy + 2 * sc);
      ctx.stroke();
      ctx.fillStyle = rgba(0xff3d00);
      ctx.beginPath();
      ctx.moveTo(cx - 46 * sc, cy + 2 * sc);
      ctx.lineTo(cx - 50 * sc, cy - 6 * sc);
      ctx.lineTo(cx - 40 * sc, cy - 2 * sc);
      ctx.lineTo(cx - 42 * sc, cy + 8 * sc);
      ctx.closePath();
      ctx.fill();
    } else {
      // Layered fanned avian rectrices (3 overlapping tail feathers)
      const tailLen = (isFalcon ? 27 : isMama ? 25 : isCanary ? 24 : 22) * sc;
      const angles = isMama ? [-0.28, -0.05, 0.2, 0.42] : isCanary ? [-0.3, 0.22] : [-0.24, 0.02, 0.28];
      angles.forEach((ang, idx) => {
        ctx.save();
        ctx.translate(cx - 18 * sc, cy + 5 * sc);
        ctx.rotate(ang);
        const fCol = idx % 2 === 0 ? darken(s.wing, 0.12) : lighten(s.wing, 0.08);
        const tGrad = ctx.createLinearGradient(0, 0, -tailLen, 0);
        tGrad.addColorStop(0, rgba(darken(fCol, 0.2)));
        tGrad.addColorStop(0.75, rgba(fCol));
        tGrad.addColorStop(1, rgba(isMama ? 0xfff0f5 : isFalcon ? 0xe2e8f0 : lighten(fCol, 0.25)));

        ctx.fillStyle = tGrad;
        ctx.strokeStyle = rgba(darken(s.wing, 0.45), 0.85);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -3.5 * sc);
        ctx.quadraticCurveTo(-tailLen * 0.6, -6.5 * sc, -tailLen, -2 * sc);
        ctx.quadraticCurveTo(-tailLen * 1.06, 0, -tailLen, 3 * sc);
        ctx.quadraticCurveTo(-tailLen * 0.6, 6.5 * sc, 0, 3.5 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Raptor / Owl tail barring
        if (isFalcon || isOwl || isHawk) {
          ctx.strokeStyle = rgba(0x111827, 0.65);
          ctx.lineWidth = 1.8 * sc;
          for (const bx of [-tailLen * 0.38, -tailLen * 0.68]) {
            ctx.beginPath();
            ctx.moveTo(bx, -4 * sc);
            ctx.lineTo(bx, 4 * sc);
            ctx.stroke();
          }
        }

        // Feather central shaft (rachis)
        ctx.strokeStyle = rgba(lighten(s.wing, 0.35), 0.55);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(-2 * sc, 0);
        ctx.lineTo(-tailLen * 0.9, 0.3);
        ctx.stroke();
        ctx.restore();
      });

      // Toucan scarlet undertail covert patch
      if (isToucan) {
        ctx.fillStyle = rgba(0xe11d48);
        drawEllipse(ctx, cx - 22 * sc, cy + 9 * sc, 7 * sc, 4.5 * sc, -0.2);
        ctx.fill();
      }
    }
    ctx.restore();

    // -------------------------------------------------------------------------
    // 3. BACK CREST PLUMES / HORNS / EARS (Behind Head Silhouette)
    // -------------------------------------------------------------------------
    if (isPhoenix) {
      // Back & middle sweeping flame crown plumes
      const crownFlames = [
        { dx: -9 * sc, tx: -18 * sc, ty: -20 * sc, col1: 0xd50000, col2: 0xff6d00 },
        { dx: -2 * sc, tx: -8 * sc, ty: -24 * sc, col1: 0xff6d00, col2: 0xffea00 },
        { dx: 5 * sc, tx: 3 * sc, ty: -20 * sc, col1: 0xffab00, col2: 0xfff9c4 },
      ];
      for (const cf of crownFlames) {
        const cGrad = ctx.createLinearGradient(cx + cf.dx, headTopY + 6 * sc, cx + cf.tx, headTopY + cf.ty);
        cGrad.addColorStop(0, rgba(cf.col1));
        cGrad.addColorStop(1, rgba(cf.col2));
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.moveTo(cx + cf.dx - 4 * sc, headTopY + 8 * sc);
        ctx.quadraticCurveTo(cx + cf.dx - 6 * sc, headTopY - 6 * sc, cx + cf.tx, headTopY + cf.ty);
        ctx.quadraticCurveTo(cx + cf.dx + 4 * sc, headTopY - 4 * sc, cx + cf.dx + 5 * sc, headTopY + 8 * sc);
        ctx.closePath();
        ctx.fill();
      }
    } else if (isMama || (s.crest && !isCanary)) {
      // Sweeping royal double-plume teardrop crest
      const cH = (stage === 0 ? 11 : 17) * sc;
      for (const [i, off] of [[0, -4 * sc], [1, 3 * sc]] as [number, number][]) {
        const col = i === 0 ? darken(s.wing, 0.1) : lighten(s.wing, 0.12);
        ctx.fillStyle = rgba(col);
        ctx.strokeStyle = rgba(darken(s.wing, 0.4), 0.8);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(cx + off, headTopY + 7 * sc);
        ctx.quadraticCurveTo(cx + off - 4 * sc, headTopY - cH * 0.5, cx + off - (8 - i * 3) * sc, headTopY - cH + i * 3 * sc);
        ctx.quadraticCurveTo(cx + off + 6 * sc, headTopY - cH * 0.4, cx + off + 7 * sc, headTopY + 7 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (isCanary) {
      // Swept-back golden canary crown tuft
      ctx.fillStyle = rgba(lighten(s.body, 0.15));
      ctx.strokeStyle = rgba(darken(s.wing, 0.35), 0.8);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx + 2 * sc, headTopY + 5 * sc);
      ctx.quadraticCurveTo(cx - 2 * sc, headTopY - 11 * sc, cx - 10 * sc, headTopY - 7 * sc);
      ctx.quadraticCurveTo(cx - 4 * sc, headTopY, cx - 8 * sc, headTopY + 3 * sc);
      ctx.quadraticCurveTo(cx, headTopY + 5 * sc, cx + 10 * sc, headTopY + 6 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (isWyvern) {
      // Curved obsidian dragon horns
      ctx.fillStyle = rgba(0x1f0814);
      ctx.strokeStyle = rgba(0xff5722, 0.8);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - 4 * sc, headTopY + 7 * sc);
      ctx.quadraticCurveTo(cx - 12 * sc, headTopY - 8 * sc, cx - 22 * sc, headTopY - 12 * sc);
      ctx.quadraticCurveTo(cx - 10 * sc, headTopY + 2 * sc, cx + 4 * sc, headTopY + 7 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // -------------------------------------------------------------------------
    // 4. ANATOMICALLY SCULPTED HEAD & TORSO SILHOUETTE (3D Volumetric Gradients)
    // -------------------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    if (isOwl) {
      // Broad, majestic barrel-chested owl silhouette
      const ow = (bw + 3 * sc);
      const oh = (bh + 2 * sc);
      ctx.ellipse(cx + 1 * sc, cy, ow, oh, -0.06, 0, Math.PI * 2);
    } else if (isCanary) {
      // Upright, graceful songbird silhouette with distinct head & puffed chest
      ctx.moveTo(cx - 24 * sc, cy + 12 * sc); // rump
      ctx.bezierCurveTo(cx - 28 * sc, cy - 4 * sc, cx - 16 * sc, cy - 16 * sc, cx - 6 * sc, cy - 22 * sc); // back to nape
      ctx.bezierCurveTo(cx + 2 * sc, cy - 30 * sc, cx + 22 * sc, cy - 28 * sc, cx + 27 * sc, cy - 12 * sc); // domed crown
      ctx.bezierCurveTo(cx + 31 * sc, cy + 4 * sc, cx + 24 * sc, cy + 25 * sc, cx + 4 * sc, cy + 28 * sc); // puffed breast
      ctx.bezierCurveTo(cx - 12 * sc, cy + 30 * sc, cx - 21 * sc, cy + 22 * sc, cx - 24 * sc, cy + 12 * sc); // underbelly
      ctx.closePath();
    } else if (isFalcon || isHawk) {
      // Sleek, broad-shouldered aerodynamic raptor silhouette
      ctx.moveTo(cx - 30 * sc, cy + 10 * sc); // tapered tail base
      ctx.bezierCurveTo(cx - 32 * sc, cy - 8 * sc, cx - 16 * sc, cy - 22 * sc, cx + 2 * sc, cy - 26 * sc); // muscular mantle
      ctx.bezierCurveTo(cx + 16 * sc, cy - 29 * sc, cx + 29 * sc, cy - 22 * sc, cx + 32 * sc, cy - 6 * sc); // flat raptor crown
      ctx.bezierCurveTo(cx + 35 * sc, cy + 12 * sc, cx + 22 * sc, cy + 28 * sc, cx + 2 * sc, cy + 28 * sc); // deep keel breast
      ctx.bezierCurveTo(cx - 14 * sc, cy + 28 * sc, cx - 26 * sc, cy + 20 * sc, cx - 30 * sc, cy + 10 * sc);
      ctx.closePath();
    } else {
      // Sculpted organic songbird / toucan / dove silhouette (head + nape + puffed chest + tapered rump)
      ctx.moveTo(cx - 31 * sc, cy + 8 * sc); // tapered rump
      ctx.bezierCurveTo(cx - 34 * sc, cy - 10 * sc, cx - 18 * sc, cy - 22 * sc, cx - 4 * sc, cy - 25 * sc); // back & nape
      ctx.bezierCurveTo(cx + 10 * sc, cy - 30 * sc, cx + 26 * sc, cy - 25 * sc, cx + 31 * sc, cy - 8 * sc); // forehead & crown
      ctx.bezierCurveTo(cx + 35 * sc, cy + 10 * sc, cx + 24 * sc, cy + 28 * sc, cx + 3 * sc, cy + 29 * sc); // full round chest
      ctx.bezierCurveTo(cx - 15 * sc, cy + 30 * sc, cx - 28 * sc, cy + 20 * sc, cx - 31 * sc, cy + 8 * sc); // belly to rump
      ctx.closePath();
    }

    // 3-Stop 3D Radial Lighting Gradient on Body
    const bodyLight = isToucan ? 0x334155 : lighten(s.body, 0.28);
    const bodyMid = isToucan ? 0x0f172a : s.body;
    const bodyDark = isToucan ? 0x020617 : darken(s.body, 0.32);
    const bGrad = ctx.createRadialGradient(
      cx + 8 * sc,
      cy - 12 * sc,
      3 * sc,
      cx - 2 * sc,
      cy + 2 * sc,
      38 * sc
    );
    bGrad.addColorStop(0, rgba(bodyLight));
    bGrad.addColorStop(0.55, rgba(bodyMid));
    bGrad.addColorStop(1, rgba(bodyDark));

    ctx.fillStyle = bGrad;
    ctx.fill();

    // Clip interior details to body silhouette
    ctx.save();
    ctx.clip();

    // Top-left sunlit specular rim glow along crown & mantle
    const rimGrad = ctx.createLinearGradient(cx, cy - 28 * sc, cx, cy);
    rimGrad.addColorStop(0, rgba(0xffffff, isToucan ? 0.22 : 0.32));
    rimGrad.addColorStop(1, rgba(0xffffff, 0));
    ctx.fillStyle = rimGrad;
    drawEllipse(ctx, cx + 4 * sc, cy - 18 * sc, 26 * sc, 12 * sc, -0.15);
    ctx.fill();

    // -------------------------------------------------------------------------
    // 5. LUSH BREAST / BELLY PATCH & SPECIES PLUMAGE MARKINGS
    // -------------------------------------------------------------------------
    if (isToucan) {
      // Iconic Toco/Keel-billed Toucan Golden-Yellow Throat & Chest Bib with Scarlet Band!
      const bibGrad = ctx.createRadialGradient(cx + 22 * sc, cy - 4 * sc, 2 * sc, cx + 16 * sc, cy + 4 * sc, 24 * sc);
      bibGrad.addColorStop(0, '#fffbeb');
      bibGrad.addColorStop(0.35, '#fde047');
      bibGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = bibGrad;
      drawEllipse(ctx, cx + 18 * sc, cy + 3 * sc, 19 * sc, 18 * sc, 0.1);
      ctx.fill();

      // Crimson-red pectoral border band below the yellow bib
      ctx.strokeStyle = rgba(0xe11d48, 0.95);
      ctx.lineWidth = 3.2 * sc;
      ctx.beginPath();
      ctx.arc(cx + 18 * sc, cy + 2 * sc, 18.5 * sc, 0.35, Math.PI - 0.45);
      ctx.stroke();
    } else {
      // Soft radial-gradient breast & underbelly
      const belX = cx + (isCanary ? 8 : 7) * sc;
      const belY = cy + 8 * sc;
      const belW = (isCanary ? 19 : 24) * sc;
      const belH = 20 * sc;
      const belGrad = ctx.createRadialGradient(belX + 5 * sc, belY - 5 * sc, 2 * sc, belX, belY, belW);
      belGrad.addColorStop(0, rgba(lighten(s.belly, 0.35)));
      belGrad.addColorStop(0.65, rgba(s.belly));
      belGrad.addColorStop(1, rgba(darken(s.belly, 0.15), 0.92));

      ctx.fillStyle = belGrad;
      drawEllipse(ctx, belX, belY, belW, belH, -0.08);
      ctx.fill();

      // Species-specific chest & back feather textures
      if (isFalcon) {
        // Authentic Peregrine Falcon dark slate malar helmet + horizontal barred chest chevrons
        ctx.strokeStyle = rgba(0x334155, 0.72);
        ctx.lineWidth = 1.5 * sc;
        for (const ry of [0, 5, 10, 15, 20]) {
          const yy = cy + ry * sc;
          ctx.beginPath();
          ctx.moveTo(cx - 2 * sc, yy);
          ctx.quadraticCurveTo(cx + 12 * sc, yy + 2.5 * sc, cx + 26 * sc, yy - 0.5 * sc);
          ctx.stroke();
        }
      } else if (isOwl) {
        // Woodland owl bark-streaked chevron feathering on breast
        ctx.strokeStyle = rgba(darken(s.body, 0.25), 0.65);
        ctx.lineWidth = 1.5 * sc;
        for (const [ox, oy] of [[0, 6], [9, 5], [18, 7], [-3, 14], [6, 13], [15, 15], [3, 21], [12, 21]]) {
          ctx.beginPath();
          ctx.moveTo(cx + (ox - 3) * sc, cy + (oy - 2) * sc);
          ctx.lineTo(cx + ox * sc, cy + (oy + 1.5) * sc);
          ctx.lineTo(cx + (ox + 3) * sc, cy + (oy - 2) * sc);
          ctx.stroke();
        }
      } else if (isTreeCreeper) {
        // Speckled woodland bark-forager spots on dorsal mantle + supercilium stripe
        ctx.fillStyle = rgba(0xfff8e7, 0.75);
        for (const [sx, sy] of [[-18, -6], [-11, -11], [-22, 1], [-14, -1], [-6, -15]]) {
          drawEllipse(ctx, cx + sx * sc, cy + sy * sc, 2.6 * sc, 1.3 * sc, -0.3);
          ctx.fill();
        }
      } else if (isCat) {
        // Ginger tabby tiger stripes along the back & crown
        ctx.strokeStyle = rgba(darken(s.body, 0.35), 0.78);
        ctx.lineWidth = 2.6 * sc;
        for (const sx of [-18, -10, -2]) {
          ctx.beginPath();
          ctx.moveTo(cx + sx * sc, cy - 24 * sc);
          ctx.quadraticCurveTo(cx + (sx - 3) * sc, cy - 10 * sc, cx + (sx - 1) * sc, cy - 2 * sc);
          ctx.stroke();
        }
      } else if (isPhoenix) {
        // Shimmering golden solar scale-feathers on breast
        ctx.strokeStyle = rgba(0xff6f00, 0.55);
        ctx.lineWidth = 1.3 * sc;
        for (const [px, py] of [[4, 4], [13, 3], [21, 5], [8, 11], [17, 11], [12, 18]]) {
          ctx.beginPath();
          ctx.arc(cx + px * sc, cy + py * sc, 4.5 * sc, 0.15, Math.PI - 0.15);
          ctx.stroke();
        }
      } else {
        // Soft downy breast feather scallops for Songbird, Canary, Mama, etc.
        ctx.strokeStyle = rgba(darken(s.belly, 0.22), 0.45);
        ctx.lineWidth = 1.2 * sc;
        for (const [fx, fy] of [[5, 5], [14, 4], [9, 12], [18, 11], [12, 19]]) {
          ctx.beginPath();
          ctx.arc(cx + fx * sc, cy + fy * sc, 4.2 * sc, 0.2, Math.PI - 0.2);
          ctx.stroke();
        }
      }
    }

    // -------------------------------------------------------------------------
    // 6. FACIAL DISCS, PEREGRINE HELMET MASK, & CHEEK BLUSH
    // -------------------------------------------------------------------------
    if (isFalcon) {
      // Authentic Peregrine dark slate hood & iconic teardrop malar cheek bar
      ctx.fillStyle = rgba(0x1e293b, 0.94);
      ctx.beginPath();
      ctx.moveTo(cx - 12 * sc, cy - 26 * sc);
      ctx.lineTo(cx + 34 * sc, cy - 26 * sc);
      ctx.lineTo(cx + 34 * sc, cy - 2 * sc);
      // Malar teardrop lobe dropping below the eye
      ctx.quadraticCurveTo(cx + 18 * sc, cy + 2 * sc, cx + 16 * sc, cy + 11 * sc);
      ctx.quadraticCurveTo(cx + 9 * sc, cy + 11 * sc, cx + 9 * sc, cy - 2 * sc);
      // Bright white cheek indent behind the malar bar
      ctx.quadraticCurveTo(cx + 2 * sc, cy - 10 * sc, cx - 12 * sc, cy - 8 * sc);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore(); // end body clip

    // Crisp, painterly outer contour stroke around body
    ctx.strokeStyle = rgba(darken(isToucan ? 0x1e293b : s.body, 0.48), 0.9);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    // Stage 0 Baby Chick fluffy head-down wisps!
    if (stage === 0 && !isCat && !isOwl && !isPhoenix) {
      ctx.strokeStyle = rgba(lighten(s.body, 0.25));
      ctx.lineWidth = 1.8;
      for (const [dx, dy, tx, ty] of [[2, -20, 0, -26], [6, -20, 7, -27], [10, -19, 13, -24]]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy + dy);
        ctx.quadraticCurveTo(cx + tx, cy + ty, cx + tx + 2, cy + ty - 1);
        ctx.stroke();
      }
    }

    // -------------------------------------------------------------------------
    // 7. OWL FACIAL DISC & EAR TUFTS / CAT EARS (Foreground Head Features)
    // -------------------------------------------------------------------------
    if (isOwl) {
      // Twin overlapping warm buff-cream facial discs with dark rimming
      for (const ox of [cx + 7 * sc, cx + 20 * sc]) {
        const dGrad = ctx.createRadialGradient(ox, cy - 7 * sc, 2 * sc, ox, cy - 7 * sc, 13 * sc);
        dGrad.addColorStop(0, rgba(lighten(s.belly, 0.25)));
        dGrad.addColorStop(0.75, rgba(s.belly));
        dGrad.addColorStop(1, rgba(darken(s.body, 0.15)));
        ctx.fillStyle = dGrad;
        ctx.strokeStyle = rgba(darken(s.body, 0.45), 0.85);
        ctx.lineWidth = 1.4;
        drawEllipse(ctx, ox, cy - 7 * sc, 12.5 * sc, 13.5 * sc);
        ctx.fill();
        ctx.stroke();
      }

      // Prominent feathered Great Horned Owl ear-tufts (plumicorns)
      for (const [ex, tx, ang] of [
        [cx - 4 * sc, cx - 13 * sc, -1],
        [cx + 18 * sc, cx + 27 * sc, 1],
      ]) {
        ctx.fillStyle = rgba(darken(s.wing, 0.05));
        ctx.strokeStyle = rgba(darken(s.wing, 0.45));
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(ex - 6 * sc, headTopY + 8 * sc);
        ctx.quadraticCurveTo(ex + ang * 3 * sc, headTopY - 6 * sc, tx, headTopY - 14 * sc);
        ctx.quadraticCurveTo(ex + ang * 7 * sc, headTopY - 2 * sc, ex + 6 * sc, headTopY + 9 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Buff inner ear feather highlight
        ctx.fillStyle = rgba(s.belly, 0.75);
        ctx.beginPath();
        ctx.moveTo(ex - 2 * sc, headTopY + 7 * sc);
        ctx.lineTo(tx - ang * 2 * sc, headTopY - 9 * sc);
        ctx.lineTo(ex + 3 * sc, headTopY + 7 * sc);
        ctx.closePath();
        ctx.fill();
      }
    } else if (isCat) {
      // Expressive pointed ginger tabby ears with pink inner conchae & ear fluff
      for (const [ex, tx] of [
        [cx - 3 * sc, cx - 7 * sc],
        [cx + 13 * sc, cx + 17 * sc],
      ]) {
        ctx.fillStyle = rgba(s.body);
        ctx.strokeStyle = rgba(darken(s.body, 0.45));
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ex - 7 * sc, headTopY + 8 * sc);
        ctx.quadraticCurveTo(ex - 5 * sc, headTopY - 6 * sc, tx, headTopY - 13 * sc);
        ctx.quadraticCurveTo(ex + 6 * sc, headTopY - 5 * sc, ex + 7 * sc, headTopY + 8 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Soft pink inner ear
        ctx.fillStyle = rgba(0xfda4af);
        ctx.beginPath();
        ctx.moveTo(ex - 4 * sc, headTopY + 7 * sc);
        ctx.lineTo(tx, headTopY - 9 * sc);
        ctx.lineTo(ex + 4 * sc, headTopY + 7 * sc);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Soft rosy cheek blush on cute species
    if (!isOwl && !isFalcon && !isHawk && !isCrow && !isWyvern) {
      const blushX = cx + 13 * sc;
      const blushY = cy + 4 * sc;
      const blushGrad = ctx.createRadialGradient(blushX, blushY, 0.5, blushX, blushY, 6.5 * sc);
      blushGrad.addColorStop(0, rgba(0xff758f, 0.65));
      blushGrad.addColorStop(1, rgba(0xff758f, 0));
      ctx.fillStyle = blushGrad;
      drawEllipse(ctx, blushX, blushY, 6.5 * sc, 5 * sc);
      ctx.fill();
    }

    // Tree Creeper pale supercilium eyebrow stripe
    if (isTreeCreeper) {
      ctx.strokeStyle = rgba(0xfff8e7, 0.9);
      ctx.lineWidth = 2.4 * sc;
      ctx.beginPath();
      ctx.moveTo(cx + 5 * sc, cy - 15 * sc);
      ctx.quadraticCurveTo(cx + 16 * sc, cy - 19 * sc, cx + 25 * sc, cy - 13 * sc);
      ctx.stroke();
    }

    // -------------------------------------------------------------------------
    // 8. MULTI-LAYERED EXPRESSIVE STUDIO EYES
    // -------------------------------------------------------------------------
    const drawStudioEye = (ex: number, ey: number, er: number, irisTop: number, irisBot: number, slit = false) => {
      // Toucan turquoise bare orbital skin ring
      if (isToucan) {
        const ringGrad = ctx.createRadialGradient(ex, ey, er * 0.6, ex, ey, er * 1.48);
        ringGrad.addColorStop(0, '#38bdf8');
        ringGrad.addColorStop(0.75, '#0284c7');
        ringGrad.addColorStop(1, '#0369a1');
        ctx.fillStyle = ringGrad;
        drawEllipse(ctx, ex, ey, er * 1.45, er * 1.4);
        ctx.fill();
      }

      // Subtle orbital shadow
      ctx.fillStyle = rgba(0x000000, 0.28);
      drawEllipse(ctx, ex, ey + 0.8 * sc, er + 1.2 * sc, er + 1.2 * sc);
      ctx.fill();

      // Sclera / outer eye ring
      ctx.fillStyle = isOwl || isFalcon || isHawk ? rgba(0xfef08a) : '#ffffff';
      drawEllipse(ctx, ex, ey, er, er);
      ctx.fill();

      // Rich radial/linear gradient Iris
      const ir = er * (isOwl ? 0.88 : 0.82);
      const ix = ex + (isOwl ? 0.5 : 1.2) * sc;
      const iy = ey + 0.3 * sc;
      const iGrad = ctx.createLinearGradient(ix, iy - ir, ix, iy + ir);
      iGrad.addColorStop(0, rgba(irisTop));
      iGrad.addColorStop(1, rgba(irisBot));
      ctx.fillStyle = iGrad;
      drawEllipse(ctx, ix, iy, ir, ir);
      ctx.fill();

      // Pupil (vertical feline/dragon slit or deep round avian pupil)
      ctx.fillStyle = '#090a0f';
      if (slit) {
        drawEllipse(ctx, ix + 0.5 * sc, iy, ir * 0.34, ir * 0.82);
      } else {
        drawEllipse(ctx, ix + 0.5 * sc, iy, ir * 0.66, ir * 0.66);
      }
      ctx.fill();

      // Primary upper-left studio catchlight
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, ix - ir * 0.25, iy - ir * 0.3, Math.max(1.3, er * 0.28), Math.max(1.1, er * 0.24), -0.3);
      ctx.fill();

      // Secondary lower-right warm reflection dot
      ctx.fillStyle = rgba(0xffffff, 0.78);
      drawEllipse(ctx, ix + ir * 0.35, iy + ir * 0.32, Math.max(0.8, er * 0.13), Math.max(0.8, er * 0.13));
      ctx.fill();

      // Crisp upper lash/eyelid rim line
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(ex, ey, er, Math.PI * 1.08, Math.PI * 1.95);
      ctx.stroke();

      // Gentle eyelashes for Mama Dove
      if (isMama) {
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ex - er * 0.6, ey - er * 0.75);
        ctx.lineTo(ex - er * 0.95, ey - er * 1.15);
        ctx.moveTo(ex - er * 0.15, ey - er * 0.95);
        ctx.lineTo(ex - er * 0.35, ey - er * 1.35);
        ctx.stroke();
      }
    };

    const eyeX = cx + Math.round(14.5 * sc);
    const eyeY = cy - Math.round(8 * sc);
    const eyeR = (stage === 0 ? 8.6 : 8.0) * sc;
    // Far-side 3/4 perspective eye peeking on the far side of the head (gives true 3D head volume!)
    const farEyeX = cx + Math.round(26.5 * sc);
    const farEyeY = cy - Math.round(8.5 * sc);
    const farEyeRx = eyeR * 0.46;
    const farEyeRy = eyeR * 0.78;

    const drawFar3DEye = (irisTop: number, irisBot: number, slit = false) => {
      ctx.save();
      if (isToucan) {
        ctx.fillStyle = '#0284c7';
        drawEllipse(ctx, farEyeX, farEyeY, farEyeRx * 1.35, farEyeRy * 1.25);
        ctx.fill();
      }
      ctx.fillStyle = isOwl || isFalcon || isHawk ? rgba(0xfef08a) : '#f8fafc';
      drawEllipse(ctx, farEyeX, farEyeY, farEyeRx, farEyeRy);
      ctx.fill();
      const iGrad = ctx.createLinearGradient(farEyeX, farEyeY - farEyeRy, farEyeX, farEyeY + farEyeRy);
      iGrad.addColorStop(0, rgba(irisTop));
      iGrad.addColorStop(1, rgba(irisBot));
      ctx.fillStyle = iGrad;
      drawEllipse(ctx, farEyeX + 0.6 * sc, farEyeY, farEyeRx * 0.82, farEyeRy * 0.82);
      ctx.fill();
      ctx.fillStyle = '#090a0f';
      drawEllipse(ctx, farEyeX + 0.9 * sc, farEyeY, farEyeRx * (slit ? 0.35 : 0.62), farEyeRy * (slit ? 0.8 : 0.62));
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, farEyeX, farEyeY - farEyeRy * 0.3, Math.max(0.9, farEyeRx * 0.35), Math.max(0.9, farEyeRy * 0.22));
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.1;
      drawEllipse(ctx, farEyeX, farEyeY, farEyeRx, farEyeRy);
      ctx.stroke();
      ctx.restore();
    };

    if (isOwl) {
      // Binocular twin forward-facing golden nocturnal owl eyes!
      drawStudioEye(cx + 8 * sc, cy - 7 * sc, 7.2 * sc, 0xf59e0b, 0xfef08a);
      drawStudioEye(cx + 21 * sc, cy - 7 * sc, 7.6 * sc, 0xf59e0b, 0xfef08a);
    } else if (isCat) {
      drawFar3DEye(0x16a34a, 0xa3e635, true);
      drawStudioEye(eyeX, eyeY, eyeR, 0x16a34a, 0xa3e635, true);
    } else if (isFalcon || isHawk) {
      drawFar3DEye(0xd97706, 0xfde047);
      drawStudioEye(eyeX, eyeY, eyeR * 0.92, 0xd97706, 0xfde047);
      // Fierce supraorbital raptor brow ridge
      ctx.fillStyle = rgba(isFalcon ? 0x0f172a : darken(s.body, 0.35));
      ctx.beginPath();
      ctx.moveTo(eyeX - eyeR * 1.15, eyeY - eyeR * 0.95);
      ctx.lineTo(eyeX + eyeR * 1.15, eyeY - eyeR * 0.35);
      ctx.lineTo(eyeX + eyeR * 1.0, eyeY - eyeR * 0.95);
      ctx.lineTo(eyeX - eyeR * 0.9, eyeY - eyeR * 1.25);
      ctx.closePath();
      ctx.fill();
    } else if (isPhoenix || isWyvern) {
      drawFar3DEye(0xef4444, 0xfef08a, isWyvern);
      drawStudioEye(eyeX, eyeY, eyeR, 0xef4444, 0xfef08a, isWyvern);
    } else if (isToucan) {
      drawFar3DEye(0x1e3a8a, 0x38bdf8);
      drawStudioEye(eyeX, eyeY, eyeR * 0.88, 0x1e3a8a, 0x38bdf8);
    } else {
      drawFar3DEye(0x291d12, 0x78350f);
      drawStudioEye(eyeX, eyeY, eyeR, 0x291d12, 0x78350f);
    }

    if (s.angry && !isFalcon && !isHawk) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(eyeX - eyeR, eyeY - eyeR);
      ctx.lineTo(eyeX + eyeR + 2, eyeY - eyeR * 0.3);
      ctx.lineTo(eyeX - eyeR, eyeY - eyeR * 0.45);
      ctx.closePath();
      ctx.fill();
    }

    // -------------------------------------------------------------------------
    // 9. SCULPTED 3D TWO-MANDIBLE BEAKS (with Curved 3D Root, Nares & Highlights)
    // -------------------------------------------------------------------------
    const beakX = cx + Math.round(25 * sc);
    const beakY = cy - Math.round(3.5 * sc);

    if (isToucan) {
      // ICONIC CURVED TROPICAL RAINBOW TOUCAN BILL!
      const tbLen = stage === 0 ? 28 : stage === 1 ? 37 : 46;
      const tbTop = beakY - 9 * sc;
      const tbBot = beakY + 11 * sc;

      // 3D curved black basal band wrapping around the face
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(beakX - 1 * sc, tbTop);
      ctx.quadraticCurveTo(beakX - 5 * sc, beakY, beakX - 1 * sc, tbBot);
      ctx.lineTo(beakX + 3.5 * sc, tbBot);
      ctx.quadraticCurveTo(beakX, beakY, beakX + 4 * sc, tbTop + 0.5);
      ctx.closePath();
      ctx.fill();

      // Upper Maxilla with lush tropical gradient (Sunny Gold -> Tangy Orange -> Crimson Tip)
      const uGrad = ctx.createLinearGradient(beakX, beakY, beakX + tbLen, beakY + 4 * sc);
      uGrad.addColorStop(0, '#facc15');
      uGrad.addColorStop(0.55, '#fb923c');
      uGrad.addColorStop(0.8, '#f97316');
      uGrad.addColorStop(0.83, '#e11d48');
      uGrad.addColorStop(1, '#9f1239');

      ctx.fillStyle = uGrad;
      ctx.beginPath();
      ctx.moveTo(beakX + 2 * sc, tbTop);
      ctx.bezierCurveTo(
        beakX + tbLen * 0.55,
        tbTop - 3 * sc,
        beakX + tbLen * 0.92,
        beakY - 3 * sc,
        beakX + tbLen,
        beakY + 5 * sc
      );
      ctx.quadraticCurveTo(beakX + tbLen * 0.5, beakY + 3 * sc, beakX + 1 * sc, beakY + 3 * sc);
      ctx.quadraticCurveTo(beakX - 1.5 * sc, (tbTop + beakY) * 0.5, beakX + 2 * sc, tbTop);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1e1b18';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Glossy lime-white dorsal culmen highlight
      ctx.fillStyle = rgba(0xfef9c3, 0.58);
      ctx.beginPath();
      ctx.moveTo(beakX + 4 * sc, tbTop + 1.5 * sc);
      ctx.quadraticCurveTo(beakX + tbLen * 0.5, tbTop - 0.5 * sc, beakX + tbLen * 0.82, beakY + 0.5 * sc);
      ctx.quadraticCurveTo(beakX + tbLen * 0.45, tbTop + 3 * sc, beakX + 4 * sc, tbTop + 4 * sc);
      ctx.closePath();
      ctx.fill();

      // Lower Mandible
      const lGrad = ctx.createLinearGradient(beakX, beakY + 3 * sc, beakX + tbLen * 0.92, beakY + 8 * sc);
      lGrad.addColorStop(0, '#eab308');
      lGrad.addColorStop(0.65, '#ea580c');
      lGrad.addColorStop(0.82, '#be123c');
      lGrad.addColorStop(1, '#881337');
      ctx.fillStyle = lGrad;
      ctx.beginPath();
      ctx.moveTo(beakX + 1 * sc, beakY + 3 * sc);
      ctx.quadraticCurveTo(beakX + tbLen * 0.5, beakY + 3 * sc, beakX + tbLen * 0.93, beakY + 5.5 * sc);
      ctx.bezierCurveTo(
        beakX + tbLen * 0.72,
        tbBot + 1 * sc,
        beakX + tbLen * 0.35,
        tbBot + 1 * sc,
        beakX + 1.5 * sc,
        tbBot
      );
      ctx.quadraticCurveTo(beakX - 1 * sc, (beakY + tbBot) * 0.5, beakX + 1 * sc, beakY + 3 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (isFalcon || isHawk) {
      // SHARP HOOKED RAPTOR BEAK WITH GOLDEN CERE & DARK TEARING TIP
      const fbLen = (stage === 0 ? 15 : stage === 1 ? 19 : 22) * sc;
      // Waxy yellow 3D cere at beak base
      ctx.fillStyle = '#facc15';
      drawEllipse(ctx, beakX + 1 * sc, beakY - 1 * sc, 4.5 * sc, 5.5 * sc, -0.15);
      ctx.fill();

      // Hooked Upper Maxilla (Gold base -> Slate-Black hooked tip)
      const rGrad = ctx.createLinearGradient(beakX + 2 * sc, beakY, beakX + fbLen, beakY + 6 * sc);
      rGrad.addColorStop(0, '#fde047');
      rGrad.addColorStop(0.45, '#94a3b8');
      rGrad.addColorStop(0.75, '#1e293b');
      rGrad.addColorStop(1, '#090a0f');

      ctx.fillStyle = rGrad;
      ctx.strokeStyle = '#090a0f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(beakX + 1 * sc, beakY - 5.5 * sc);
      ctx.bezierCurveTo(
        beakX + fbLen * 0.65,
        beakY - 6 * sc,
        beakX + fbLen * 1.05,
        beakY - 1 * sc,
        beakX + fbLen * 0.88,
        beakY + 8.5 * sc // sharp downward tearing hook!
      );
      ctx.lineTo(beakX + fbLen * 0.58, beakY + 2.5 * sc); // tomial tooth notch
      ctx.lineTo(beakX + 1 * sc, beakY + 2 * sc);
      ctx.quadraticCurveTo(beakX - 1.5 * sc, beakY - 2 * sc, beakX + 1 * sc, beakY - 5.5 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lower raptor mandible
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(beakX + 1 * sc, beakY + 2 * sc);
      ctx.lineTo(beakX + fbLen * 0.62, beakY + 2.5 * sc);
      ctx.quadraticCurveTo(beakX + fbLen * 0.35, beakY + 6.5 * sc, beakX + 1 * sc, beakY + 5.5 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Nostril on cere
      ctx.fillStyle = '#451a03';
      drawEllipse(ctx, beakX + 2 * sc, beakY - 2 * sc, 1.1 * sc, 0.9 * sc);
      ctx.fill();
    } else if (isTreeCreeper) {
      // SLENDER DECURVED BARK-PROBING BILL
      const tcbLen = (stage === 0 ? 16 : stage === 1 ? 22 : 28) * sc;
      ctx.fillStyle = '#8d6e63';
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(beakX, beakY - 3.8 * sc);
      ctx.quadraticCurveTo(beakX + tcbLen * 0.6, beakY - 3 * sc, beakX + tcbLen, beakY + 6.5 * sc);
      ctx.quadraticCurveTo(beakX + tcbLen * 0.55, beakY + 1.5 * sc, beakX, beakY + 2.5 * sc);
      ctx.quadraticCurveTo(beakX - 2 * sc, beakY - 0.5 * sc, beakX, beakY - 3.8 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pale lower mandible base
      ctx.fillStyle = '#efebe9';
      ctx.beginPath();
      ctx.moveTo(beakX, beakY + 0.5 * sc);
      ctx.quadraticCurveTo(beakX + tcbLen * 0.5, beakY + 1 * sc, beakX + tcbLen * 0.85, beakY + 5.2 * sc);
      ctx.quadraticCurveTo(beakX + tcbLen * 0.45, beakY + 3.5 * sc, beakX, beakY + 3.2 * sc);
      ctx.closePath();
      ctx.fill();
    } else if (isOwl) {
      // CURVED NOCTURNAL OWL HOOKED BEAK TUCKED BETWEEN DISCS
      const ox = cx + 14.5 * sc;
      const oy = cy - 2 * sc;
      const oGrad = ctx.createLinearGradient(ox, oy - 4 * sc, ox, oy + 7 * sc);
      oGrad.addColorStop(0, '#fde68a');
      oGrad.addColorStop(0.6, '#d97706');
      oGrad.addColorStop(1, '#451a03');
      ctx.fillStyle = oGrad;
      ctx.strokeStyle = '#271408';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ox - 3.5 * sc, oy - 3 * sc);
      ctx.quadraticCurveTo(ox, oy - 5 * sc, ox + 4 * sc, oy - 3 * sc);
      ctx.quadraticCurveTo(ox + 3 * sc, oy + 3 * sc, ox + 0.5 * sc, oy + 7 * sc);
      ctx.quadraticCurveTo(ox - 2.5 * sc, oy + 3 * sc, ox - 3.5 * sc, oy - 3 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (isCat) {
      // INFILTRATOR: Cute pink cat nose & whiskers + fake tie-on cardboard bird beak!
      // Elastic disguise string around head
      ctx.strokeStyle = rgba(0x1f2937, 0.85);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(beakX + 1 * sc, beakY - 2 * sc);
      ctx.lineTo(cx - 8 * sc, cy - 12 * sc);
      ctx.stroke();

      // Fake 3D cone cardboard beak with curved base
      const cGrad = ctx.createLinearGradient(beakX, beakY - 6 * sc, beakX + 12 * sc, beakY + 5 * sc);
      cGrad.addColorStop(0, '#fcd34d');
      cGrad.addColorStop(0.6, '#f59e0b');
      cGrad.addColorStop(1, '#b45309');
      ctx.fillStyle = cGrad;
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(beakX + 1 * sc, beakY - 5.5 * sc);
      ctx.lineTo(beakX + 16 * sc, beakY - 0.5 * sc);
      ctx.lineTo(beakX + 1 * sc, beakY + 4.5 * sc);
      ctx.quadraticCurveTo(beakX - 2.5 * sc, beakY - 0.5 * sc, beakX + 1 * sc, beakY - 5.5 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Cute kitty pink nose, ":3" mouth, and white whiskers right below!
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.moveTo(cx + 22 * sc, cy - 3 * sc);
      ctx.lineTo(cx + 26 * sc, cy - 3 * sc);
      ctx.lineTo(cx + 24 * sc, cy);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = rgba(0xffffff, 0.92);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(cx + 19 * sc, cy + 2 * sc);
      ctx.lineTo(cx + 34 * sc, cy);
      ctx.moveTo(cx + 18 * sc, cy + 5 * sc);
      ctx.lineTo(cx + 33 * sc, cy + 6 * sc);
      ctx.moveTo(cx + 17 * sc, cy + 8 * sc);
      ctx.lineTo(cx + 31 * sc, cy + 11 * sc);
      ctx.stroke();
    } else if (isCanary) {
      // OPEN MELODIOUS 3D SINGING BEAK WITH CUTE PINK TONGUE!
      const bLen = (stage === 0 ? 13 : stage === 1 ? 16 : 19) * sc;
      const bCol = s.beak ?? 0xffa62b;
      // Inside mouth cavity & pink tongue
      ctx.fillStyle = '#881337';
      ctx.beginPath();
      ctx.moveTo(beakX - 1 * sc, beakY - 2.5 * sc);
      ctx.lineTo(beakX + bLen * 0.72, beakY);
      ctx.lineTo(beakX - 1 * sc, beakY + 4.5 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fb7185';
      drawEllipse(ctx, beakX + 4 * sc, beakY + 2 * sc, 3.8 * sc, 1.6 * sc);
      ctx.fill();

      // Upper singing mandible with 3D curved face root
      const uGrad = ctx.createLinearGradient(beakX, beakY - 6 * sc, beakX + bLen, beakY);
      uGrad.addColorStop(0, rgba(lighten(bCol, 0.3)));
      uGrad.addColorStop(1, rgba(bCol));
      ctx.fillStyle = uGrad;
      ctx.strokeStyle = rgba(darken(bCol, 0.45));
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(beakX, beakY - 6 * sc);
      ctx.quadraticCurveTo(beakX + bLen * 0.55, beakY - 6.5 * sc, beakX + bLen, beakY - 2 * sc);
      ctx.lineTo(beakX - 1 * sc, beakY - 0.5 * sc);
      ctx.quadraticCurveTo(beakX - 3 * sc, beakY - 3.5 * sc, beakX, beakY - 6 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Lower singing mandible
      ctx.fillStyle = rgba(darken(bCol, 0.1));
      ctx.beginPath();
      ctx.moveTo(beakX - 1 * sc, beakY + 1.5 * sc);
      ctx.lineTo(beakX + bLen * 0.88, beakY + 3.5 * sc);
      ctx.quadraticCurveTo(beakX + bLen * 0.45, beakY + 6.5 * sc, beakX, beakY + 5.5 * sc);
      ctx.quadraticCurveTo(beakX - 2.5 * sc, beakY + 3.5 * sc, beakX - 1 * sc, beakY + 1.5 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // SCULPTED 3D CONICAL SONGBIRD / DOVE / PHOENIX BEAK (Curved 3D Root + Upper/Lower Planes)
      const bLen = (stage === 0 ? 13 : stage === 1 ? 16 : 20) * sc;
      const bCol = s.beak ?? 0xffa62b;

      // Upper Maxilla with 3D curved base wrapping around cheek
      const uGrad = ctx.createLinearGradient(beakX - 2 * sc, beakY - 6.5 * sc, beakX + bLen, beakY + 1 * sc);
      uGrad.addColorStop(0, rgba(lighten(bCol, 0.35)));
      uGrad.addColorStop(0.6, rgba(bCol));
      uGrad.addColorStop(1, rgba(darken(bCol, 0.12)));
      ctx.fillStyle = uGrad;
      ctx.strokeStyle = rgba(darken(bCol, 0.45));
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(beakX, beakY - 6.2 * sc);
      ctx.quadraticCurveTo(beakX + bLen * 0.55, beakY - 5.5 * sc, beakX + bLen, beakY + 0.5 * sc);
      ctx.quadraticCurveTo(beakX + bLen * 0.45, beakY + 1.8 * sc, beakX - 1.5 * sc, beakY + 0.8 * sc);
      ctx.quadraticCurveTo(beakX - 3.5 * sc, beakY - 3 * sc, beakX, beakY - 6.2 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glossy dorsal culmen ridge highlight
      ctx.fillStyle = rgba(0xffffff, 0.42);
      ctx.beginPath();
      ctx.moveTo(beakX + 1 * sc, beakY - 5 * sc);
      ctx.quadraticCurveTo(beakX + bLen * 0.45, beakY - 4.2 * sc, beakX + bLen * 0.82, beakY - 0.3 * sc);
      ctx.quadraticCurveTo(beakX + bLen * 0.4, beakY - 2 * sc, beakX + 1 * sc, beakY - 2.8 * sc);
      ctx.closePath();
      ctx.fill();

      // Lower Mandible (3D underside shadow plane)
      ctx.fillStyle = rgba(darken(bCol, 0.18));
      ctx.beginPath();
      ctx.moveTo(beakX - 1.5 * sc, beakY + 0.8 * sc);
      ctx.quadraticCurveTo(beakX + bLen * 0.45, beakY + 1.8 * sc, beakX + bLen * 0.9, beakY + 1.2 * sc);
      ctx.quadraticCurveTo(beakX + bLen * 0.45, beakY + 6.5 * sc, beakX, beakY + 5.2 * sc);
      ctx.quadraticCurveTo(beakX - 2.8 * sc, beakY + 3.2 * sc, beakX - 1.5 * sc, beakY + 0.8 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tiny nostril & culmen highlight
      ctx.fillStyle = rgba(darken(bCol, 0.55));
      drawEllipse(ctx, beakX + 3 * sc, beakY - 2.2 * sc, 1 * sc, 0.7 * sc, -0.2);
      ctx.fill();
    }
  };

  makeCanvas(scene, `bird_${key}_${stage}`, cw, ch, renderBirdBody);
  if (stage === 2) {
    makeCanvas(scene, `bird_${key}`, cw, ch, renderBirdBody);
  }

  // ---------------------------------------------------------------------------
  // 9B. TRUE 3D FRONTAL-YAW TURN MODEL (`bird_${key}_${stage}_turn`)
  //     Used when the bird rotates from left-to-right or right-to-left so it
  //     genuinely turns toward the camera in 3D instead of 2D-flipping!
  // ---------------------------------------------------------------------------
  const renderBirdTurn = (ctx: CanvasRenderingContext2D) => {
    const footY = cy + Math.round(34 * sc);
    const headTopY = cy - Math.round(25 * sc);
    const rBodyW = Math.round(28 * sc);
    const rBodyH = Math.round(30 * sc);

    // 1. Foreshortened 3D Tail Fan peeking behind the body
    if (isPhoenix) {
      for (const dx of [-12 * sc, 0, 12 * sc]) {
        const g = ctx.createLinearGradient(cx, cy, cx + dx * 1.4, cy + 32 * sc);
        g.addColorStop(0, '#ff3d00');
        g.addColorStop(1, '#ffee58');
        ctx.strokeStyle = g;
        ctx.lineWidth = 3.5 * sc;
        ctx.beginPath();
        ctx.moveTo(cx + dx * 0.4, cy + 12 * sc);
        ctx.quadraticCurveTo(cx + dx, cy + 24 * sc, cx + dx * 1.3, cy + 34 * sc);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = rgba(darken(s.wing, 0.18));
      ctx.strokeStyle = rgba(darken(s.wing, 0.45));
      ctx.lineWidth = 1.2;
      for (const ang of [-0.25, 0, 0.25]) {
        ctx.save();
        ctx.translate(cx, cy + 16 * sc);
        ctx.rotate(ang);
        drawEllipse(ctx, 0, 10 * sc, 4.5 * sc, 10 * sc);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Both 3D Talons / Feet Symmetrically Below Chest
    const legCol = isFalcon || isHawk || isOwl ? 0xf59e0b : isCrow || isWyvern ? 0x374151 : 0xf08c28;
    for (const lx of [cx - 8 * sc, cx + 8 * sc]) {
      if (isCat) {
        ctx.fillStyle = rgba(0xfff5eb);
        drawEllipse(ctx, lx, footY - 1 * sc, 4.5 * sc, 3.2 * sc);
        ctx.fill();
      } else {
        ctx.fillStyle = rgba(darken(s.body, 0.12));
        drawEllipse(ctx, lx, footY - 10 * sc, 4 * sc, 4.2 * sc);
        ctx.fill();
        ctx.strokeStyle = rgba(legCol);
        ctx.lineWidth = stage === 0 ? 2.2 : 2.8;
        ctx.beginPath();
        ctx.moveTo(lx, footY - 9 * sc);
        ctx.lineTo(lx, footY);
        ctx.moveTo(lx - 4 * sc, footY + 0.8);
        ctx.lineTo(lx + 4 * sc, footY + 0.8);
        ctx.stroke();
      }
    }

    // 3. Frontal Crest / Horns / Ears (Symmetrical 3D Crown)
    if (isPhoenix) {
      for (const [dx, h] of [[-6 * sc, 18 * sc], [0, 23 * sc], [6 * sc, 18 * sc]]) {
        const cGrad = ctx.createLinearGradient(cx + dx, headTopY + 6 * sc, cx + dx * 1.2, headTopY - h);
        cGrad.addColorStop(0, '#ff3d00');
        cGrad.addColorStop(1, '#fff176');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.moveTo(cx + dx - 3.5 * sc, headTopY + 6 * sc);
        ctx.quadraticCurveTo(cx + dx, headTopY - h * 0.5, cx + dx * 1.2, headTopY - h);
        ctx.quadraticCurveTo(cx + dx + 3.5 * sc, headTopY - h * 0.4, cx + dx + 3.5 * sc, headTopY + 6 * sc);
        ctx.closePath();
        ctx.fill();
      }
    } else if (isMama || s.crest || isCanary) {
      ctx.fillStyle = rgba(lighten(s.wing, 0.12));
      ctx.strokeStyle = rgba(darken(s.wing, 0.4));
      ctx.lineWidth = 1.1;
      for (const dx of [-3.5 * sc, 3.5 * sc]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * 0.5, headTopY + 6 * sc);
        ctx.quadraticCurveTo(cx + dx * 1.8, headTopY - 8 * sc, cx + dx * 1.2, headTopY - 14 * sc);
        ctx.quadraticCurveTo(cx, headTopY - 4 * sc, cx, headTopY + 6 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // 4. Sculpted 3D Spherical Frontal Body & Head Mass
    const bodyLight = isToucan ? 0x334155 : lighten(s.body, 0.3);
    const bodyMid = isToucan ? 0x0f172a : s.body;
    const bodyDark = isToucan ? 0x020617 : darken(s.body, 0.35);
    const bGrad = ctx.createRadialGradient(cx, cy - 10 * sc, 3 * sc, cx, cy + 2 * sc, 34 * sc);
    bGrad.addColorStop(0, rgba(bodyLight));
    bGrad.addColorStop(0.55, rgba(bodyMid));
    bGrad.addColorStop(1, rgba(bodyDark));

    ctx.save();
    ctx.fillStyle = bGrad;
    ctx.strokeStyle = rgba(darken(isToucan ? 0x1e293b : s.body, 0.5), 0.92);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - rBodyH);
    ctx.bezierCurveTo(cx + rBodyW * 1.02, cy - rBodyH, cx + rBodyW * 1.12, cy + rBodyH * 0.2, cx + rBodyW * 0.85, cy + rBodyH * 0.78);
    ctx.bezierCurveTo(cx + rBodyW * 0.45, cy + rBodyH * 1.05, cx - rBodyW * 0.45, cy + rBodyH * 1.05, cx - rBodyW * 0.85, cy + rBodyH * 0.78);
    ctx.bezierCurveTo(cx - rBodyW * 1.12, cy + rBodyH * 0.2, cx - rBodyW * 1.02, cy - rBodyH, cx, cy - rBodyH);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.clip();

    // Frontal 3D Chest & Belly Patch
    if (isToucan) {
      const bibGrad = ctx.createRadialGradient(cx, cy - 2 * sc, 2 * sc, cx, cy + 2 * sc, 21 * sc);
      bibGrad.addColorStop(0, '#fffbeb');
      bibGrad.addColorStop(0.45, '#fde047');
      bibGrad.addColorStop(1, '#f59e0b');
      ctx.fillStyle = bibGrad;
      drawEllipse(ctx, cx, cy + 2 * sc, 19 * sc, 17 * sc);
      ctx.fill();
      ctx.strokeStyle = '#e11d48';
      ctx.lineWidth = 3.2 * sc;
      ctx.beginPath();
      ctx.arc(cx, cy + 1 * sc, 18.5 * sc, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else {
      const belGrad = ctx.createRadialGradient(cx, cy + 4 * sc, 2 * sc, cx, cy + 9 * sc, 22 * sc);
      belGrad.addColorStop(0, rgba(lighten(s.belly, 0.38)));
      belGrad.addColorStop(0.65, rgba(s.belly));
      belGrad.addColorStop(1, rgba(darken(s.belly, 0.18)));
      ctx.fillStyle = belGrad;
      drawEllipse(ctx, cx, cy + 9 * sc, 21 * sc, 19 * sc);
      ctx.fill();

      if (isFalcon) {
        // Frontal Peregrine slate helmet & twin malar cheek bars + barred breast
        ctx.fillStyle = rgba(0x1e293b, 0.94);
        drawEllipse(ctx, cx, cy - 17 * sc, 26 * sc, 14 * sc);
        ctx.fill();
        for (const side of [-1, 1]) {
          drawEllipse(ctx, cx + side * 12 * sc, cy - 1 * sc, 4 * sc, 9 * sc, side * 0.12);
          ctx.fill();
        }
        ctx.strokeStyle = rgba(0x334155, 0.7);
        ctx.lineWidth = 1.4 * sc;
        for (const ry of [4, 9, 14, 19]) {
          ctx.beginPath();
          ctx.moveTo(cx - 14 * sc, cy + ry * sc);
          ctx.quadraticCurveTo(cx, cy + (ry + 2.5) * sc, cx + 14 * sc, cy + ry * sc);
          ctx.stroke();
        }
      }
    }

    ctx.restore(); // unclip
    ctx.stroke();
    ctx.restore();

    // 5. Owl Discs / Cat Ears in Frontal 3D View
    if (isOwl || isCat) {
      for (const side of [-1, 1]) {
        const ex = cx + side * 12 * sc;
        ctx.fillStyle = rgba(isOwl ? darken(s.wing, 0.05) : s.body);
        ctx.strokeStyle = rgba(darken(s.body, 0.45));
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(ex - 6 * sc, headTopY + 8 * sc);
        ctx.lineTo(ex + side * 6 * sc, headTopY - 13 * sc);
        ctx.lineTo(ex + 6 * sc, headTopY + 8 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      if (isOwl) {
        for (const side of [-1, 1]) {
          ctx.fillStyle = rgba(lighten(s.belly, 0.2));
          ctx.strokeStyle = rgba(darken(s.body, 0.4));
          ctx.lineWidth = 1.3;
          drawEllipse(ctx, cx + side * 9.5 * sc, cy - 7 * sc, 10.5 * sc, 11.5 * sc);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // 6. Symmetrical Binocular 3D Eyes Looking Forward!
    const drawFrontEye = (ex: number, ey: number, er: number, irisTop: number, irisBot: number, slit = false) => {
      if (isToucan) {
        const ringGrad = ctx.createRadialGradient(ex, ey, er * 0.6, ex, ey, er * 1.45);
        ringGrad.addColorStop(0, '#38bdf8');
        ringGrad.addColorStop(1, '#0369a1');
        ctx.fillStyle = ringGrad;
        drawEllipse(ctx, ex, ey, er * 1.4, er * 1.35);
        ctx.fill();
      }
      ctx.fillStyle = rgba(0x000000, 0.26);
      drawEllipse(ctx, ex, ey + 0.8 * sc, er + 1 * sc, er + 1 * sc);
      ctx.fill();
      ctx.fillStyle = isOwl || isFalcon || isHawk ? rgba(0xfef08a) : '#ffffff';
      drawEllipse(ctx, ex, ey, er, er);
      ctx.fill();
      const ir = er * 0.84;
      const iGrad = ctx.createLinearGradient(ex, ey - ir, ex, ey + ir);
      iGrad.addColorStop(0, rgba(irisTop));
      iGrad.addColorStop(1, rgba(irisBot));
      ctx.fillStyle = iGrad;
      drawEllipse(ctx, ex, ey, ir, ir);
      ctx.fill();
      ctx.fillStyle = '#090a0f';
      drawEllipse(ctx, ex, ey, ir * (slit ? 0.34 : 0.64), ir * (slit ? 0.82 : 0.64));
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, ex - ir * 0.25, ey - ir * 0.3, Math.max(1.2, er * 0.26), Math.max(1.0, er * 0.22));
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ex, ey, er, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    };

    const fEyeR = (stage === 0 ? 7.4 : 7.0) * sc;
    for (const side of [-1, 1]) {
      const ex = cx + side * (isOwl ? 9.5 : 10.5) * sc;
      const ey = cy - 8 * sc;
      if (isCat) {
        drawFrontEye(ex, ey, fEyeR, 0x16a34a, 0xa3e635, true);
      } else if (isOwl || isFalcon || isHawk) {
        drawFrontEye(ex, ey, fEyeR, 0xd97706, 0xfde047);
      } else if (isPhoenix || isWyvern) {
        drawFrontEye(ex, ey, fEyeR, 0xef4444, 0xfef08a, isWyvern);
      } else if (isToucan) {
        drawFrontEye(ex, ey, fEyeR * 0.9, 0x1e3a8a, 0x38bdf8);
      } else {
        drawFrontEye(ex, ey, fEyeR, 0x291d12, 0x78350f);
      }
      // Rosy cheeks on both sides
      if (!isOwl && !isFalcon && !isHawk && !isCrow && !isWyvern) {
        ctx.fillStyle = rgba(0xff758f, 0.5);
        drawEllipse(ctx, cx + side * 14 * sc, cy + 2 * sc, 5 * sc, 3.8 * sc);
        ctx.fill();
      }
    }

    // 7. Foreshortened 3D Frontal Beak Pointing Toward the Viewer!
    const fBeakY = cy - 3 * sc;
    if (isToucan) {
      // Foreshortened 3D Toucan Rainbow Bill curving forward & down
      const tGrad = ctx.createLinearGradient(cx, fBeakY - 9 * sc, cx, fBeakY + 15 * sc);
      tGrad.addColorStop(0, '#facc15');
      tGrad.addColorStop(0.55, '#fb923c');
      tGrad.addColorStop(0.8, '#e11d48');
      tGrad.addColorStop(1, '#881337');
      ctx.fillStyle = tGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - 8.5 * sc, fBeakY - 5 * sc);
      ctx.quadraticCurveTo(cx, fBeakY - 11 * sc, cx + 8.5 * sc, fBeakY - 5 * sc);
      ctx.quadraticCurveTo(cx + 9 * sc, fBeakY + 8 * sc, cx, fBeakY + 15 * sc);
      ctx.quadraticCurveTo(cx - 9 * sc, fBeakY + 8 * sc, cx - 8.5 * sc, fBeakY - 5 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Central culmen highlight ridge
      ctx.fillStyle = rgba(0xfef9c3, 0.55);
      drawEllipse(ctx, cx, fBeakY - 1 * sc, 3 * sc, 8 * sc);
      ctx.fill();
    } else if (isFalcon || isHawk || isOwl) {
      // Foreshortened hooked 3D raptor/owl beak
      ctx.fillStyle = '#facc15';
      drawEllipse(ctx, cx, fBeakY - 3 * sc, 5.5 * sc, 3.2 * sc);
      ctx.fill();
      const rGrad = ctx.createLinearGradient(cx, fBeakY - 4 * sc, cx, fBeakY + 9 * sc);
      rGrad.addColorStop(0, '#fde047');
      rGrad.addColorStop(0.5, '#64748b');
      rGrad.addColorStop(1, '#090a0f');
      ctx.fillStyle = rGrad;
      ctx.strokeStyle = '#090a0f';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 5 * sc, fBeakY - 2 * sc);
      ctx.quadraticCurveTo(cx, fBeakY - 5 * sc, cx + 5 * sc, fBeakY - 2 * sc);
      ctx.quadraticCurveTo(cx + 4 * sc, fBeakY + 4 * sc, cx, fBeakY + 9.5 * sc);
      ctx.quadraticCurveTo(cx - 4 * sc, fBeakY + 4 * sc, cx - 5 * sc, fBeakY - 2 * sc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 3D Conical Frontal Songbird / Canary / Dove / Phoenix Beak (Upper & Lower 3D Diamond Cone)
      const bCol = s.beak ?? 0xffa62b;
      // Lower mandible shadow cone
      ctx.fillStyle = rgba(darken(bCol, 0.2));
      ctx.strokeStyle = rgba(darken(bCol, 0.48));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 6.5 * sc, fBeakY);
      ctx.quadraticCurveTo(cx, fBeakY + 7.5 * sc, cx + 6.5 * sc, fBeakY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Upper 3D pyramid/cone maxilla pointing at camera
      const uGrad = ctx.createRadialGradient(cx, fBeakY - 2 * sc, 1, cx, fBeakY, 8 * sc);
      uGrad.addColorStop(0, rgba(lighten(bCol, 0.38)));
      uGrad.addColorStop(0.65, rgba(bCol));
      uGrad.addColorStop(1, rgba(darken(bCol, 0.12)));
      ctx.fillStyle = uGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 7 * sc, fBeakY);
      ctx.quadraticCurveTo(cx, fBeakY - 7 * sc, cx + 7 * sc, fBeakY);
      ctx.quadraticCurveTo(cx, fBeakY + 3.5 * sc, cx - 7 * sc, fBeakY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Specular tip dot pointing at viewer
      ctx.fillStyle = rgba(0xffffff, 0.55);
      drawEllipse(ctx, cx, fBeakY - 1.2 * sc, 2.2 * sc, 1.5 * sc);
      ctx.fill();
    }
  };

  makeCanvas(scene, `bird_${key}_${stage}_turn`, cw, ch, renderBirdTurn);
  if (stage === 2) {
    makeCanvas(scene, `bird_${key}_turn`, cw, ch, renderBirdTurn);
  }

  // ---------------------------------------------------------------------------
  // 10. ARTICULATED MULTI-FEATHER WING (`wing_${key}_${stage}`)
  //     Shoulder pivot on RIGHT (0.78, 0.5), 5 fanned flight feathers on LEFT!
  // ---------------------------------------------------------------------------
  const wWidth = stage === 0 ? 36 : stage === 1 ? 42 : isFalcon ? 52 : isPhoenix ? 50 : 48;
  const wHeight = stage === 0 ? 22 : stage === 1 ? 24 : 26;
  const shoulderX = Math.round(wWidth * 0.78);
  const shoulderY = Math.round(wHeight * 0.5);

  const renderWing = (ctx: CanvasRenderingContext2D) => {
    if (isCat) {
      // Cute ginger tabby front paw/shoulder tucked like a "wing"
      const cGrad = ctx.createLinearGradient(0, 0, wWidth, wHeight);
      cGrad.addColorStop(0, rgba(darken(s.wing, 0.15)));
      cGrad.addColorStop(0.7, rgba(s.wing));
      cGrad.addColorStop(1, rgba(0xfff5eb));
      ctx.fillStyle = cGrad;
      ctx.strokeStyle = rgba(darken(s.wing, 0.45));
      ctx.lineWidth = 1.3;
      drawEllipse(ctx, wWidth * 0.52, shoulderY, wWidth * 0.4, wHeight * 0.36, -0.1);
      ctx.fill();
      ctx.stroke();
      return;
    }

    if (isWyvern) {
      // Leathery dragon bat-wing with bone spars and thumb claw
      ctx.fillStyle = rgba(s.wing);
      ctx.strokeStyle = rgba(0xff5722, 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(shoulderX + 4, shoulderY - 4);
      ctx.lineTo(3, 3);
      ctx.quadraticCurveTo(12, shoulderY, 6, wHeight - 2);
      ctx.quadraticCurveTo(shoulderX * 0.6, shoulderY + 3, shoulderX + 4, shoulderY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }

    // 5 fanned primary & secondary flight feathers radiating from shoulderX
    const numPrimaries = stage === 0 ? 4 : 5;
    for (let i = numPrimaries - 1; i >= 0; i--) {
      const t = i / Math.max(1, numPrimaries - 1); // 0 = top longest primary, 1 = lower secondary
      const tipX = 2 + t * (wWidth * 0.28);
      const tipY = 3 + t * (wHeight - 5);
      const fBaseCol = isPhoenix
        ? mixHex(0xd50000, 0xffab00, 1 - t * 0.6)
        : mixHex(lighten(s.wing, 0.12), darken(s.wing, 0.18), t);
      const fTipCol = isPhoenix
        ? 0xfff176
        : isFalcon
          ? 0x0f172a
          : isMama
            ? 0xfff0f5
            : lighten(s.wing, 0.26);

      const fGrad = ctx.createLinearGradient(shoulderX, shoulderY, tipX, tipY);
      fGrad.addColorStop(0, rgba(darken(fBaseCol, 0.15)));
      fGrad.addColorStop(0.7, rgba(fBaseCol));
      fGrad.addColorStop(1, rgba(fTipCol));

      ctx.fillStyle = fGrad;
      ctx.strokeStyle = rgba(darken(s.wing, 0.48), 0.85);
      ctx.lineWidth = 1.1;

      ctx.beginPath();
      ctx.moveTo(shoulderX, shoulderY - 3 + t * 5);
      ctx.quadraticCurveTo((shoulderX + tipX) * 0.5, tipY - 3.5, tipX, tipY);
      ctx.quadraticCurveTo((shoulderX + tipX) * 0.55, tipY + 3.8, shoulderX, shoulderY + 3 + t * 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Central feather shaft (rachis)
      ctx.strokeStyle = rgba(lighten(fTipCol, 0.35), 0.55);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(shoulderX - 4, shoulderY + (t - 0.3) * 4);
      ctx.lineTo(tipX + 3, tipY);
      ctx.stroke();
    }

    // Rounded scapular / shoulder covert cap on the right
    const covGrad = ctx.createRadialGradient(
      shoulderX + 2,
      shoulderY - 3,
      2,
      shoulderX - 2,
      shoulderY,
      wWidth * 0.32
    );
    covGrad.addColorStop(0, rgba(lighten(s.wing, 0.32)));
    covGrad.addColorStop(0.65, rgba(s.wing));
    covGrad.addColorStop(1, rgba(darken(s.wing, 0.25)));

    ctx.fillStyle = covGrad;
    ctx.strokeStyle = rgba(darken(s.wing, 0.45), 0.85);
    ctx.lineWidth = 1.2;
    drawEllipse(ctx, shoulderX - 1, shoulderY, wWidth * 0.22, wHeight * 0.4, -0.12);
    ctx.fill();
    ctx.stroke();

    // Specular covert highlight arc
    ctx.fillStyle = rgba(0xffffff, 0.32);
    drawEllipse(ctx, shoulderX, shoulderY - 3, wWidth * 0.14, wHeight * 0.18, -0.2);
    ctx.fill();
  };

  makeCanvas(scene, `wing_${key}_${stage}`, wWidth, wHeight, renderWing);
  if (stage === 2) {
    makeCanvas(scene, `wing_${key}`, wWidth, wHeight, renderWing);
  }
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
  const w = 32;
  const h = 36;
  makeCanvas(scene, key, w, h, (ctx) => {
    const cx = 16;
    const cy = 18;

    // Soft outer plume with radial/linear sheen
    const pGrad = ctx.createLinearGradient(cx - 8, cy - 14, cx + 8, cy + 14);
    pGrad.addColorStop(0, rgba(lighten(highlightColor, 0.25)));
    pGrad.addColorStop(0.5, rgba(baseColor));
    pGrad.addColorStop(1, rgba(darken(baseColor, 0.3)));

    ctx.fillStyle = pGrad;
    ctx.strokeStyle = rgba(darken(baseColor, 0.48), 0.85);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy + 13);
    ctx.bezierCurveTo(cx - 13, cy + 4, cx - 10, cy - 12, cx + 3, cy - 15);
    ctx.bezierCurveTo(cx + 12, cy - 10, cx + 11, cy + 6, cx - 3, cy + 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner velvety barb glow
    ctx.fillStyle = rgba(highlightColor, 0.85);
    drawEllipse(ctx, cx, cy - 3, 6.5, 10, 0.18);
    ctx.fill();

    // Optional iridescent peacock/phoenix eyespot
    if (accentColor !== undefined) {
      const eGrad = ctx.createRadialGradient(cx + 1, cy - 5, 0.5, cx + 1, cy - 5, 5.5);
      eGrad.addColorStop(0, '#ffffff');
      eGrad.addColorStop(0.4, rgba(accentColor));
      eGrad.addColorStop(1, rgba(darken(accentColor, 0.4), 0.9));
      ctx.fillStyle = eGrad;
      drawEllipse(ctx, cx + 1, cy - 5, 5, 5.5, 0.15);
      ctx.fill();
    } else {
      ctx.fillStyle = rgba(0xffffff, 0.45);
      drawEllipse(ctx, cx - 1, cy - 5, 3, 6.5, 0.18);
      ctx.fill();
    }

    // Curved central rachis shaft & calamus quill
    ctx.strokeStyle = rgba(stemColor);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 15);
    ctx.quadraticCurveTo(cx - 1, cy, cx + 3, cy - 14);
    ctx.stroke();

    ctx.fillStyle = '#fff8f0';
    drawEllipse(ctx, cx - 4, cy + 15, 1.8, 1.8);
    ctx.fill();
  });
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
  g.destroy();

  // goldegg (3D Sculpted Metallic Golden Egg with Specular Rim & Warm Shadow)
  makeCanvas(scene, 'goldegg', 32, 42, (ctx) => {
    const grad = ctx.createRadialGradient(12, 13, 2, 16, 22, 19);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.22, '#fef08a');
    grad.addColorStop(0.58, '#f59e0b');
    grad.addColorStop(1, '#78350f');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(16, 3);
    ctx.bezierCurveTo(27, 3, 30, 19, 29, 28);
    ctx.bezierCurveTo(28, 37, 22, 40, 16, 40);
    ctx.bezierCurveTo(10, 40, 4, 37, 3, 28);
    ctx.bezierCurveTo(2, 19, 5, 3, 16, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glossy 3D catchlight arc
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    drawEllipse(ctx, 11, 13, 3.2, 6.2, 0.25);
    ctx.fill();
  });

  // currency_dollar (3D Embossed Beveled Gold Coin with Specular Sheen)
  makeCanvas(scene, 'currency_dollar', 38, 38, (ctx) => {
    ctx.fillStyle = 'rgba(25, 13, 5, 0.35)';
    drawEllipse(ctx, 19, 20.5, 16, 16);
    ctx.fill();

    const rGrad = ctx.createLinearGradient(4, 4, 32, 32);
    rGrad.addColorStop(0, '#fef08a');
    rGrad.addColorStop(0.45, '#f59e0b');
    rGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = rGrad;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.4;
    drawEllipse(ctx, 18, 18, 15.5, 15.5);
    ctx.fill();
    ctx.stroke();

    const iGrad = ctx.createRadialGradient(14, 13, 2, 18, 18, 12.5);
    iGrad.addColorStop(0, '#fef9c3');
    iGrad.addColorStop(0.65, '#fbbf24');
    iGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = iGrad;
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.2;
    drawEllipse(ctx, 18, 18, 12, 12);
    ctx.fill();
    ctx.stroke();

    // Embossed 3D '$' symbol
    ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef9c3';
    ctx.fillText('$', 18.6, 19.2);
    ctx.fillStyle = '#78350f';
    ctx.fillText('$', 18, 18.5);
  });

  // seed: 3D Maple Samara (Helicopter Seed) - Horizontal Rotor Orientation with Veined Wing & Plump Nutlet
  makeCanvas(scene, 'seed', 40, 24, (ctx) => {
    // Translucent 3D veined samara airfoil wing
    const wGrad = ctx.createLinearGradient(8, 6, 38, 16);
    wGrad.addColorStop(0, '#d6b87c');
    wGrad.addColorStop(0.5, '#ede2c4');
    wGrad.addColorStop(1, '#b59257');
    ctx.fillStyle = wGrad;
    ctx.strokeStyle = '#78532a';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(9, 12);
    ctx.bezierCurveTo(18, 5, 34, 4, 38, 10);
    ctx.bezierCurveTo(39, 15, 27, 19, 11, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Thickened leading-edge aerodynamic spar along top of samara wing
    const sGrad = ctx.createLinearGradient(9, 9, 36, 8);
    sGrad.addColorStop(0, '#6d4522');
    sGrad.addColorStop(1, '#a67b44');
    ctx.strokeStyle = sGrad;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(9, 11.5);
    ctx.quadraticCurveTo(23, 6.5, 37, 9.5);
    ctx.stroke();

    // Delicate branching wing veins
    ctx.strokeStyle = 'rgba(120, 83, 42, 0.55)';
    ctx.lineWidth = 0.85;
    for (const [vx, vy, ex, ey] of [[15, 10, 22, 16], [21, 9, 29, 15.5], [27, 9, 34, 14]]) {
      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.quadraticCurveTo((vx + ex) * 0.5, vy + 2, ex, ey);
      ctx.stroke();
    }

    // 3D spherical nutlet seed pod on the left
    const nGrad = ctx.createRadialGradient(7.5, 10.5, 1, 9, 12.5, 6);
    nGrad.addColorStop(0, '#c6935b');
    nGrad.addColorStop(0.55, '#6e4220');
    nGrad.addColorStop(1, '#3b210d');
    ctx.fillStyle = nGrad;
    ctx.strokeStyle = '#271408';
    ctx.lineWidth = 1.1;
    drawEllipse(ctx, 9, 12.2, 5.2, 4.2, -0.15);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    drawEllipse(ctx, 7.6, 10.8, 1.8, 1.1, -0.2);
    ctx.fill();
  });

  // corn: 3D Golden Sweetcorn Kernel / Cob with Lush Leaf Parachute
  makeCanvas(scene, 'corn', 30, 36, (ctx) => {
    // Gossamer suspension silk threads
    ctx.strokeStyle = 'rgba(220, 252, 231, 0.9)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(6, 7); ctx.lineTo(12, 18);
    ctx.moveTo(24, 7); ctx.lineTo(18, 18);
    ctx.stroke();

    // 3D arched canopy leaf parachute
    const lGrad = ctx.createRadialGradient(15, 4, 2, 15, 6, 13);
    lGrad.addColorStop(0, '#86efac');
    lGrad.addColorStop(0.55, '#22c55e');
    lGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = lGrad;
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 1;
    drawEllipse(ctx, 15, 6, 12, 5);
    ctx.fill();
    ctx.stroke();

    // Plump 3D golden corn cob / kernel cluster
    const cGrad = ctx.createRadialGradient(13, 21, 1.5, 15, 24, 9.5);
    cGrad.addColorStop(0, '#fef9c3');
    cGrad.addColorStop(0.45, '#facc15');
    cGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = cGrad;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.1;
    drawEllipse(ctx, 15, 24, 7.2, 8.8);
    ctx.fill();
    ctx.stroke();

    // Individual kernel grid texture
    ctx.strokeStyle = 'rgba(146, 64, 14, 0.45)';
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(15, 16); ctx.lineTo(15, 32);
    ctx.moveTo(10, 21); ctx.lineTo(20, 21);
    ctx.moveTo(9, 25); ctx.lineTo(21, 25);
    ctx.moveTo(10, 29); ctx.lineTo(20, 29);
    ctx.stroke();
  });

  // berry: 3D Glossy Ruby Canopy Berries with Leaf Parachute
  makeCanvas(scene, 'berry', 34, 36, (ctx) => {
    ctx.strokeStyle = 'rgba(220, 252, 231, 0.9)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(7, 7); ctx.lineTo(13, 18);
    ctx.moveTo(27, 7); ctx.lineTo(21, 18);
    ctx.stroke();

    const lGrad = ctx.createRadialGradient(17, 4, 2, 17, 6, 14);
    lGrad.addColorStop(0, '#86efac');
    lGrad.addColorStop(0.55, '#22c55e');
    lGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = lGrad;
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 1;
    drawEllipse(ctx, 17, 6, 13, 5);
    ctx.fill();
    ctx.stroke();

    // Twin 3D ruby berries
    for (const [bx, by, br] of [[20, 24, 6.2], [13, 24, 7.8]]) {
      const bGrad = ctx.createRadialGradient(bx - 2, by - 2.5, 1, bx, by, br);
      bGrad.addColorStop(0, '#fda4af');
      bGrad.addColorStop(0.35, '#e11d48');
      bGrad.addColorStop(1, '#4c0519');
      ctx.fillStyle = bGrad;
      ctx.strokeStyle = '#4c0519';
      ctx.lineWidth = 1;
      drawEllipse(ctx, bx, by, br, br);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      drawEllipse(ctx, bx - br * 0.35, by - br * 0.35, br * 0.26, br * 0.2, -0.3);
      ctx.fill();
    }
  });

  // cinder_acorn: 3D Volcanic Magma Nut
  makeCanvas(scene, 'cinder_acorn', 32, 34, (ctx) => {
    const aGrad = ctx.createRadialGradient(16, 18, 2, 16, 18, 15);
    aGrad.addColorStop(0, 'rgba(255, 152, 0, 0.65)');
    aGrad.addColorStop(1, 'rgba(255, 87, 34, 0)');
    ctx.fillStyle = aGrad;
    drawEllipse(ctx, 16, 18, 15, 15);
    ctx.fill();

    const nGrad = ctx.createRadialGradient(14, 18, 1.5, 16, 20, 9.5);
    nGrad.addColorStop(0, '#fff9c4');
    nGrad.addColorStop(0.4, '#ff9800');
    nGrad.addColorStop(0.8, '#d84315');
    nGrad.addColorStop(1, '#4e1405');
    ctx.fillStyle = nGrad;
    drawEllipse(ctx, 16, 20, 8, 9.5);
    ctx.fill();

    // Knobby 3D volcanic oak cupule cap
    const cGrad = ctx.createLinearGradient(7, 8, 25, 15);
    cGrad.addColorStop(0, '#5d4037');
    cGrad.addColorStop(1, '#271408');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.roundRect(7, 8, 18, 7.5, 3.5);
    ctx.fill();
  });

  // egg: 3D Sculpted Speckled Sanctuary Egg with Smooth Spherical Lighting
  makeCanvas(scene, 'egg', 28, 36, (ctx) => {
    const eGrad = ctx.createRadialGradient(11, 11, 2, 14, 19, 16);
    eGrad.addColorStop(0, '#ffffff');
    eGrad.addColorStop(0.55, '#fff5dc');
    eGrad.addColorStop(1, '#cbb289');
    ctx.fillStyle = eGrad;
    ctx.strokeStyle = '#8c6f47';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(14, 3);
    ctx.bezierCurveTo(23, 3, 26, 17, 25, 25);
    ctx.bezierCurveTo(24, 32, 19, 34, 14, 34);
    ctx.bezierCurveTo(9, 34, 4, 32, 3, 25);
    ctx.bezierCurveTo(2, 17, 5, 3, 14, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Organic shell speckles
    ctx.fillStyle = 'rgba(168, 134, 92, 0.55)';
    for (const [sx, sy, rx, ry] of [[9, 20, 2, 1.6], [18, 13, 2.2, 1.8], [17, 24, 1.6, 1.4], [12, 27, 1.4, 1.1]]) {
      drawEllipse(ctx, sx, sy, rx, ry, 0.2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    drawEllipse(ctx, 10, 11, 2.4, 4.5, 0.25);
    ctx.fill();
  });

  // acorn: 3D Woodland Oak Acorn
  makeCanvas(scene, 'acorn', 16, 18, (ctx) => {
    const nGrad = ctx.createRadialGradient(6.5, 10, 1, 8, 11.5, 6.5);
    nGrad.addColorStop(0, '#eab676');
    nGrad.addColorStop(0.6, '#9c5a25');
    nGrad.addColorStop(1, '#4a2508');
    ctx.fillStyle = nGrad;
    drawEllipse(ctx, 8, 11.5, 6, 6.2);
    ctx.fill();

    const cGrad = ctx.createLinearGradient(1, 3, 15, 8);
    cGrad.addColorStop(0, '#7c4a21');
    cGrad.addColorStop(1, '#3b1e08');
    ctx.fillStyle = cGrad;
    drawEllipse(ctx, 8, 5.5, 7, 3.5);
    ctx.fill();
    ctx.fillRect(7, 0.5, 2, 3.5);
  });

  // crown: 3D Jeweled Royal King Songbird Crown
  makeCanvas(scene, 'crown', 34, 22, (ctx) => {
    const cGrad = ctx.createLinearGradient(2, 2, 32, 20);
    cGrad.addColorStop(0, '#fef08a');
    cGrad.addColorStop(0.5, '#f59e0b');
    cGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = cGrad;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(3, 19);
    ctx.lineTo(3, 4);
    ctx.lineTo(10, 13);
    ctx.lineTo(17, 1);
    ctx.lineTo(24, 13);
    ctx.lineTo(31, 4);
    ctx.lineTo(31, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Velvet royal band & 3D gemstones
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(4, 15, 26, 3.5);
    for (const [gx, col] of [[9, '#38bdf8'], [17, '#ef4444'], [25, '#38bdf8']] as [number, string][]) {
      ctx.fillStyle = col;
      drawEllipse(ctx, gx, 16, 2.2, 2.2);
      ctx.fill();
    }
  });

  // --- 3D Sculpted Weapons: Stick, Slingshot, Bow, Rifle, Laser ---
  makeCanvas(scene, 'weapon_stick', 36, 36, (ctx) => {
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 7.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(7, 30); ctx.lineTo(28, 7);
    ctx.stroke();
    const sGrad = ctx.createLinearGradient(7, 30, 28, 7);
    sGrad.addColorStop(0, '#5d4037');
    sGrad.addColorStop(0.5, '#8d6e63');
    sGrad.addColorStop(1, '#6d4c41');
    ctx.strokeStyle = sGrad;
    ctx.lineWidth = 5.2;
    ctx.stroke();

    // Sprouting green leaves
    ctx.fillStyle = '#22c55e';
    drawEllipse(ctx, 28, 10, 4.5, 2.4, 0.3); ctx.fill();
    drawEllipse(ctx, 24, 5.5, 4, 2, -0.4); ctx.fill();
  });

  const renderSlingshot = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#3e200c';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 37); ctx.lineTo(16, 22);
    ctx.lineTo(6, 8); ctx.moveTo(16, 22); ctx.lineTo(26, 8);
    ctx.stroke();

    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(6, 8); ctx.lineTo(16, 16); ctx.lineTo(26, 8);
    ctx.stroke();

    const pGrad = ctx.createRadialGradient(15, 14, 0.5, 16, 15, 4);
    pGrad.addColorStop(0, '#cbd5e1');
    pGrad.addColorStop(1, '#475569');
    ctx.fillStyle = pGrad;
    drawEllipse(ctx, 16, 15, 3.8, 3.8);
    ctx.fill();
  };
  makeCanvas(scene, 'slingshot', 32, 40, renderSlingshot);
  makeCanvas(scene, 'weapon_slingshot', 32, 40, renderSlingshot);

  makeCanvas(scene, 'weapon_bow', 36, 36, (ctx) => {
    // Bowstring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9, 4); ctx.lineTo(9, 32);
    ctx.stroke();

    // Sculpted recurve yew bow limbs
    const bGrad = ctx.createLinearGradient(8, 4, 24, 32);
    bGrad.addColorStop(0, '#b45309');
    bGrad.addColorStop(0.5, '#f59e0b');
    bGrad.addColorStop(1, '#78350f');
    ctx.strokeStyle = bGrad;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(9, 4);
    ctx.quadraticCurveTo(26, 18, 9, 32);
    ctx.stroke();

    // Nocked arrow
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 18); ctx.lineTo(30, 18);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(35, 18); ctx.lineTo(28, 14); ctx.lineTo(28, 22); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(8, 18); ctx.lineTo(4, 14); ctx.lineTo(10, 14); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, 18); ctx.lineTo(4, 22); ctx.lineTo(10, 22); ctx.closePath(); ctx.fill();
  });

  makeCanvas(scene, 'weapon_rifle', 42, 26, (ctx) => {
    const sGrad = ctx.createLinearGradient(4, 12, 18, 22);
    sGrad.addColorStop(0, '#9a3412');
    sGrad.addColorStop(1, '#431407');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.roundRect(4, 12, 14, 10, 3);
    ctx.fill();

    const mGrad = ctx.createLinearGradient(14, 9, 14, 17);
    mGrad.addColorStop(0, '#94a3b8');
    mGrad.addColorStop(0.5, '#475569');
    mGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.roundRect(13, 10, 26, 5.5, 2);
    ctx.fill();
    ctx.fillRect(36, 7.5, 2.5, 3.5);
  });

  makeCanvas(scene, 'weapon_laser', 40, 28, (ctx) => {
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.roundRect(7, 14, 8, 12, 3);
    ctx.fill();

    const bGrad = ctx.createLinearGradient(10, 6, 30, 18);
    bGrad.addColorStop(0, '#f8fafc');
    bGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.roundRect(11, 7, 18, 11, 4);
    ctx.fill();

    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(15, 9, 3, 7);
    ctx.fillRect(20, 9, 3, 7);

    const cGrad = ctx.createRadialGradient(36, 12.5, 0.5, 36, 12.5, 4.5);
    cGrad.addColorStop(0, '#ffffff');
    cGrad.addColorStop(0.5, '#00ffff');
    cGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
    ctx.fillStyle = cGrad;
    drawEllipse(ctx, 36, 12.5, 4.5, 4.5);
    ctx.fill();
  });

  makeCanvas(scene, 'arrow', 30, 10, (ctx) => {
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(2, 5); ctx.lineTo(24, 5);
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(29, 5); ctx.lineTo(22, 1.5); ctx.lineTo(22, 8.5); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(5, 5); ctx.lineTo(1, 1.5); ctx.lineTo(8, 1.5); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, 5); ctx.lineTo(1, 8.5); ctx.lineTo(8, 8.5); ctx.closePath(); ctx.fill();
  });

  makeCanvas(scene, 'siren_light', 32, 32, (ctx) => {
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(4, 20, 24, 8, 2.5);
    ctx.fill();
    const sGrad = ctx.createRadialGradient(13, 11, 2, 16, 14, 11);
    sGrad.addColorStop(0, '#fecdd3');
    sGrad.addColorStop(0.4, '#ef4444');
    sGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.roundRect(7, 6, 18, 15, 6);
    ctx.fill();
  });

  // cloud: 3D Volumetric Sunlit Cumulus Cloud with Soft Lavender-Blue Underside Shadow
  makeCanvas(scene, 'cloud', 196, 92, (ctx) => {
    // Soft ambient base shadow puffs
    const sGrad = ctx.createLinearGradient(98, 22, 98, 82);
    sGrad.addColorStop(0, '#ffffff');
    sGrad.addColorStop(0.65, '#f1f5f9');
    sGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = sGrad;
    for (const [cx, cy, r] of [[46, 56, 25], [82, 60, 28], [124, 60, 28], [156, 54, 23], [92, 38, 35], [130, 40, 31], [56, 46, 27]]) {
      drawEllipse(ctx, cx, cy, r, r * 0.92);
      ctx.fill();
    }
    // Sunlit 3D top billows
    for (const [cx, cy, r] of [[56, 44, 24], [90, 34, 32], [128, 37, 28], [152, 48, 20], [92, 50, 26]]) {
      const bGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.28, 2, cx, cy, r);
      bGrad.addColorStop(0, '#ffffff');
      bGrad.addColorStop(0.75, 'rgba(255, 255, 255, 0.92)');
      bGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      ctx.fillStyle = bGrad;
      drawEllipse(ctx, cx, cy, r, r * 0.9);
      ctx.fill();
    }
  });

  makeCanvas(scene, 'spark', 10, 10, (ctx) => {
    const grad = ctx.createRadialGradient(5, 5, 0.5, 5, 5, 5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    drawEllipse(ctx, 5, 5, 5, 5);
    ctx.fill();
  });

  // gem & gem_diamond: 3D Faceted Brilliant-Cut Sanctuary Gems
  const drawFacetedGem = (ctx: CanvasRenderingContext2D, w: number, topCol: string, midCol: string, botCol: string, rimCol: string) => {
    const cx = w / 2;
    ctx.fillStyle = midCol;
    ctx.strokeStyle = rimCol;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(w - 2, 11);
    ctx.lineTo(cx, w - 2);
    ctx.lineTo(2, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crown table facet
    ctx.fillStyle = topCol;
    ctx.beginPath();
    ctx.moveTo(cx, 2); ctx.lineTo(w - 7, 11); ctx.lineTo(7, 11); ctx.closePath();
    ctx.fill();

    // Left sunlit pavilion facet
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, 2); ctx.lineTo(7, 11); ctx.lineTo(cx, 11); ctx.closePath();
    ctx.fill();

    // Right deep pavilion facet
    ctx.fillStyle = botCol;
    ctx.beginPath();
    ctx.moveTo(cx, 11); ctx.lineTo(w - 2, 11); ctx.lineTo(cx, w - 2); ctx.closePath();
    ctx.fill();
  };

  makeCanvas(scene, 'gem', 30, 30, (ctx) => drawFacetedGem(ctx, 30, '#bae6fd', '#38bdf8', '#0369a1', '#0c4a6e'));
  makeCanvas(scene, 'gem_diamond', 32, 32, (ctx) => drawFacetedGem(ctx, 32, '#ffffff', '#67e8f9', '#0891b2', '#164e63'));

  // potion: 3D Glass Alchemist Flask with Glowing Elixir
  makeCanvas(scene, 'potion', 26, 34, (ctx) => {
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.roundRect(9, 1, 8, 5, 1.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(224, 242, 254, 0.65)';
    ctx.fillRect(8, 5, 10, 6);

    const pGrad = ctx.createRadialGradient(10, 19, 1.5, 13, 22, 11);
    pGrad.addColorStop(0, '#f3e8ff');
    pGrad.addColorStop(0.45, '#c084fc');
    pGrad.addColorStop(1, '#581c87');
    ctx.fillStyle = pGrad;
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 1.2;
    drawEllipse(ctx, 13, 22, 10.5, 10.5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    drawEllipse(ctx, 9.5, 18.5, 2.2, 3.4, 0.3);
    ctx.fill();
  });

  makeCanvas(scene, 'hat_santa', 36, 32, (ctx) => {
    const hGrad = ctx.createLinearGradient(6, 4, 30, 24);
    hGrad.addColorStop(0, '#ef4444');
    hGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.moveTo(4, 24); ctx.quadraticCurveTo(16, 2, 20, 3); ctx.lineTo(32, 24); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(2, 22, 32, 8, 4);
    ctx.fill();
    drawEllipse(ctx, 19, 4, 5, 5);
    ctx.fill();
  });

  makeCanvas(scene, 'glasses_archimedes', 34, 18, (ctx) => {
    ctx.fillStyle = 'rgba(186, 230, 253, 0.42)';
    drawEllipse(ctx, 9, 9, 7, 7); ctx.fill();
    drawEllipse(ctx, 25, 9, 7, 7); ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    drawEllipse(ctx, 9, 9, 7.5, 7.5); ctx.stroke();
    drawEllipse(ctx, 25, 9, 7.5, 7.5); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16.5, 9); ctx.lineTo(17.5, 9);
    ctx.stroke();
  });

  makeCanvas(scene, 'hat_pirate', 40, 24, (ctx) => {
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(2, 21);
    ctx.quadraticCurveTo(20, 1, 38, 21);
    ctx.quadraticCurveTo(20, 24, 2, 21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 20, 13, 3.2, 3.2);
    ctx.fill();
  });

  makeCanvas(scene, 'eyepatch', 16, 16, (ctx) => {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 4); ctx.lineTo(16, 12);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 8, 8, 5.5, 5.5);
    ctx.fill();
  });

  makeCanvas(scene, 'bird_eyelid', 18, 12, (ctx) => {
    const eGrad = ctx.createLinearGradient(9, 1, 9, 11);
    eGrad.addColorStop(0, '#38bdf8');
    eGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = eGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.4;
    drawEllipse(ctx, 9, 6, 7.8, 4.5);
    ctx.fill();
    ctx.stroke();
  });

  // sparrow_twig: 3D Sculpted Woodland Twig with Cylindrical Bark & Tender Leaf Buds!
  makeCanvas(scene, 'sparrow_twig', 36, 22, (ctx) => {
    // Drop shadow
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(3, 17); ctx.quadraticCurveTo(17, 13, 31, 10);
    ctx.stroke();

    // Main 3D cylindrical branch twig
    ctx.strokeStyle = '#3b1e08';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(3, 15.5); ctx.quadraticCurveTo(17, 11.5, 31, 8.5);
    ctx.stroke();

    ctx.strokeStyle = '#7c4a21';
    ctx.lineWidth = 2.8;
    ctx.stroke();

    ctx.strokeStyle = '#b47b44';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(4, 14.5); ctx.quadraticCurveTo(17, 10.5, 30, 7.7);
    ctx.stroke();

    // Forked side shoot
    ctx.strokeStyle = '#4a2508';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(18, 11.5); ctx.quadraticCurveTo(22, 6, 27, 3.5);
    ctx.stroke();

    // 3D veined green leaves sprouting from twig tips
    for (const [lx, ly, rot] of [[31, 8, -0.2], [27, 3.5, -0.6]]) {
      const lGrad = ctx.createLinearGradient(lx - 3, ly - 2, lx + 3, ly + 2);
      lGrad.addColorStop(0, '#86efac');
      lGrad.addColorStop(1, '#15803d');
      ctx.fillStyle = lGrad;
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 0.8;
      drawEllipse(ctx, lx, ly, 3.6, 2.1, rot);
      ctx.fill();
      ctx.stroke();
    }
  });

  // ===========================================================================
  // 6 HIGH-DEFINITION 3D SCULPTED NEST STAGES (`nest_stage_1` .. `nest_stage_6`)
  // ===========================================================================
  for (let stage = 1; stage <= 6; stage++) {
    makeCanvas(scene, `nest_stage_${stage}`, 104, 48, (ctx) => {
      const cx = 52;
      const cy = 26;

      const draw3DTwig = (x1: number, y1: number, x2: number, y2: number, w: number, colDark: string, colMid: string, colLight: string) => {
        const mx = (x1 + x2) * 0.5;
        const my = (y1 + y2) * 0.5 + 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(10, 5, 2, 0.35)';
        ctx.lineWidth = w + 1.4;
        ctx.beginPath();
        ctx.moveTo(x1, y1 + 1.5); ctx.quadraticCurveTo(mx, my + 1.5, x2, y2 + 1.5);
        ctx.stroke();

        ctx.strokeStyle = colDark;
        ctx.lineWidth = w + 1.0;
        ctx.beginPath();
        ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2);
        ctx.stroke();

        ctx.strokeStyle = colMid;
        ctx.lineWidth = w * 0.72;
        ctx.stroke();

        ctx.strokeStyle = colLight;
        ctx.lineWidth = w * 0.28;
        ctx.beginPath();
        ctx.moveTo(x1, y1 - w * 0.2); ctx.quadraticCurveTo(mx, my - w * 0.2, x2, y2 - w * 0.2);
        ctx.stroke();
      };

      if (stage === 1) {
        // Stage 1: First 4 3D cylindrical foundation twigs laid across the branch fork
        draw3DTwig(cx - 26, cy + 5, cx + 25, cy + 1, 3.8, '#2b1507', '#5a3418', '#93592b');
        draw3DTwig(cx - 20, cy - 1, cx + 19, cy + 8, 3.5, '#3e200c', '#6e3d1b', '#a86b38');
        draw3DTwig(cx - 14, cy + 9, cx + 21, cy - 2, 3.4, '#2b1507', '#5a3418', '#93592b');
        draw3DTwig(cx - 22, cy + 2, cx + 14, cy + 6, 3.0, '#3e200c', '#7c4a21', '#b47b44');
        return;
      }

      if (stage === 2) {
        // Stage 2: Criss-crossed 3D stick platform with forest moss tufts
        draw3DTwig(cx - 32, cy + 6, cx + 30, cy + 2, 4.0, '#2b1507', '#5a3418', '#93592b');
        draw3DTwig(cx - 28, cy - 2, cx + 26, cy + 9, 3.8, '#3e200c', '#6e3d1b', '#a86b38');
        draw3DTwig(cx - 22, cy + 10, cx + 24, cy - 2, 3.6, '#2b1507', '#5a3418', '#93592b');
        draw3DTwig(cx - 16, cy + 12, cx + 18, cy + 1, 3.4, '#3e200c', '#7c4a21', '#b47b44');
        draw3DTwig(cx - 29, cy + 4, cx + 28, cy + 1, 2.8, '#4a2508', '#8a5528', '#c68a4c');

        const mGrad = ctx.createRadialGradient(cx - 6, cy + 3, 1, cx - 6, cy + 5, 7);
        mGrad.addColorStop(0, '#86efac');
        mGrad.addColorStop(1, '#15803d');
        ctx.fillStyle = mGrad;
        drawEllipse(ctx, cx - 6, cy + 5, 6.5, 4);
        ctx.fill();
        return;
      }

      // Stages 3..6: Sculpted 3D Wicker Bowl Cup with Concave Interior & Braided Twig Rim
      const rx = stage === 3 ? 33 : stage === 4 ? 38 : stage === 5 ? 42 : 45;
      const ry = stage === 3 ? 10 : stage === 4 ? 13 : stage === 5 ? 15 : 17;

      // Ambient contact shadow under the nest cup
      const sGrad = ctx.createRadialGradient(cx, cy + 10, 4, cx, cy + 10, rx * 1.05);
      sGrad.addColorStop(0, 'rgba(10, 5, 2, 0.55)');
      sGrad.addColorStop(1, 'rgba(10, 5, 2, 0)');
      ctx.fillStyle = sGrad;
      drawEllipse(ctx, cx, cy + 10, rx * 1.05, ry * 0.75);
      ctx.fill();

      // 3D Spherical Outer Wicker Bowl Body
      const bGrad = ctx.createRadialGradient(cx - rx * 0.25, cy - 2, 3, cx, cy + 6, rx * 1.1);
      bGrad.addColorStop(0, '#9c663b');
      bGrad.addColorStop(0.55, '#5e3316');
      bGrad.addColorStop(1, '#241105');
      ctx.fillStyle = bGrad;
      ctx.strokeStyle = '#1c0d04';
      ctx.lineWidth = 1.4;
      drawEllipse(ctx, cx, cy + 6, rx, ry);
      ctx.fill();
      ctx.stroke();

      // Woven 3D twig ribs around outer bowl
      const ribCount = stage + 3;
      for (let i = 0; i < ribCount; i++) {
        const t = i / (ribCount - 1) - 0.5;
        const bx = cx + t * rx * 1.65;
        draw3DTwig(
          bx - 6,
          cy + 6 + (1 - Math.abs(t)) * (ry * 0.65),
          bx + 6,
          cy - 1 + Math.abs(t) * 4,
          2.6,
          '#241105',
          '#6e3d1b',
          '#b07543'
        );
      }
      // Horizontal rim twigs
      draw3DTwig(cx - rx * 0.92, cy + 4, cx + rx * 0.92, cy + 4, 3.0, '#241105', '#7c4a21', '#c68a4c');
      if (stage >= 4) {
        draw3DTwig(cx - rx * 0.78, cy + 10, cx + rx * 0.78, cy + 10, 2.8, '#1c0d04', '#5e3316', '#9c663b');
      }

      // 3D Concave Interior Cup Hollow (Deep shadow at top wall, warm bedding at bottom)
      const inRx = rx * 0.76;
      const inRy = ry * 0.58;
      const iGrad = ctx.createLinearGradient(cx, cy - inRy, cx, cy + inRy + 2);
      if (stage >= 5) {
        iGrad.addColorStop(0, '#3e200c');
        iGrad.addColorStop(0.45, '#c9a464');
        iGrad.addColorStop(1, '#fef08a');
      } else {
        iGrad.addColorStop(0, '#1c0d04');
        iGrad.addColorStop(1, '#5e3316');
      }
      ctx.fillStyle = iGrad;
      ctx.strokeStyle = '#2b1507';
      ctx.lineWidth = 1.2;
      drawEllipse(ctx, cx, cy + 1.5, inRx, inRy);
      ctx.fill();
      ctx.stroke();

      // Stage 5 & 6: Soft golden straw swirls, fluffy white down feathers & 3D emerald moss cushions
      if (stage >= 5) {
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
        ctx.lineWidth = 1.3;
        for (let s = 0; s < 4; s++) {
          drawEllipse(ctx, cx + (s - 1.5) * 4, cy + 2, inRx * (0.65 - s * 0.08), inRy * 0.45);
          ctx.stroke();
        }
      }
      if (stage === 6) {
        // Fluffy white down plumes tucked inside the master nest rim
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (const [fx, fy, rot] of [[-14, 1, -0.2], [0, 3, 0], [14, 1, 0.2]]) {
          drawEllipse(ctx, cx + fx, cy + fy, 6, 2.8, rot);
          ctx.fill();
        }
      }

      // Lush 3D forest moss cushions along the rim
      const mossPositions = stage === 3 ? [[-14, 6]] : stage === 4 ? [[-20, 7], [20, 6]] : [[-26, 7], [26, 7], [-10, 11], [12, 11]];
      for (const [mx, my] of mossPositions) {
        const mGrad = ctx.createRadialGradient(cx + mx - 1, cy + my - 1.5, 0.5, cx + mx, cy + my, 6.5);
        mGrad.addColorStop(0, '#86efac');
        mGrad.addColorStop(0.55, '#22c55e');
        mGrad.addColorStop(1, '#14532d');
        ctx.fillStyle = mGrad;
        drawEllipse(ctx, cx + mx, cy + my, 6.2, 4.2);
        ctx.fill();
      }
    });
  }

  // Hedwig Hogwarts wax-sealed envelope
  makeCanvas(scene, 'drop_envelope', 36, 26, (ctx) => {
    const pGrad = ctx.createLinearGradient(2, 2, 34, 24);
    pGrad.addColorStop(0, '#fffbeb');
    pGrad.addColorStop(1, '#fde68a');
    ctx.fillStyle = pGrad;
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.roundRect(2, 2, 32, 22, 3);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, 2); ctx.lineTo(18, 14); ctx.lineTo(34, 2);
    ctx.stroke();

    const wGrad = ctx.createRadialGradient(17, 12, 0.5, 18, 13, 4.5);
    wGrad.addColorStop(0, '#ef4444');
    wGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = wGrad;
    drawEllipse(ctx, 18, 13, 4.5, 4.5);
    ctx.fill();
  });

  makeCanvas(scene, 'drop_candycane', 22, 30, (ctx) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(7, 27); ctx.lineTo(7, 10);
    ctx.arc(13, 10, 6, Math.PI, 0, false);
    ctx.stroke();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  makeCanvas(scene, 'drop_pinecone', 30, 36, (ctx) => {
    const pGrad = ctx.createRadialGradient(12, 14, 2, 15, 19, 15);
    pGrad.addColorStop(0, '#fef08a');
    pGrad.addColorStop(0.5, '#f59e0b');
    pGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = pGrad;
    drawEllipse(ctx, 15, 19, 11.5, 14.5);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.1;
    for (let y = 9; y <= 27; y += 5) {
      for (let x = 7; x <= 23; x += 5) {
        drawEllipse(ctx, x, y, 3.2, 2.5);
        ctx.stroke();
      }
    }
  });

  makeCanvas(scene, 'drop_baguette', 36, 24, (ctx) => {
    const bGrad = ctx.createRadialGradient(16, 9, 2, 18, 12, 16);
    bGrad.addColorStop(0, '#fde68a');
    bGrad.addColorStop(0.6, '#d97706');
    bGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 18, 12, 16, 8);
    ctx.fill();
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1.6;
    for (const sx of [11, 18, 25]) {
      ctx.beginPath();
      ctx.moveTo(sx - 2, 7); ctx.lineTo(sx + 2, 16);
      ctx.stroke();
    }
  });

  makeCanvas(scene, 'drop_trinket_key', 30, 20, (ctx) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2.5;
    drawEllipse(ctx, 8, 10, 5.5, 5.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(13.5, 10); ctx.lineTo(28, 10);
    ctx.moveTo(22, 10); ctx.lineTo(22, 15);
    ctx.moveTo(26, 10); ctx.lineTo(26, 16);
    ctx.stroke();
  });

  makeCanvas(scene, 'drop_trinket_ring', 24, 24, (ctx) => {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    drawEllipse(ctx, 12, 14, 8, 8);
    ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(12, 2); ctx.lineTo(7, 8); ctx.lineTo(17, 8); ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'discoball', 40, 44, (ctx) => {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 0); ctx.lineTo(20, 10);
    ctx.stroke();
    const dGrad = ctx.createRadialGradient(15, 20, 2, 20, 26, 16);
    dGrad.addColorStop(0, '#ffffff');
    dGrad.addColorStop(0.5, '#cbd5e1');
    dGrad.addColorStop(1, '#475569');
    ctx.fillStyle = dGrad;
    drawEllipse(ctx, 20, 26, 16, 16);
    ctx.fill();
  });

  makeCanvas(scene, 'umbrella', 32, 32, (ctx) => {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(16, 4); ctx.lineTo(16, 26);
    ctx.arc(13, 26, 3, 0, Math.PI, false);
    ctx.stroke();
    const uGrad = ctx.createRadialGradient(14, 9, 2, 16, 14, 15);
    uGrad.addColorStop(0, '#fda4af');
    uGrad.addColorStop(0.6, '#f43f5e');
    uGrad.addColorStop(1, '#9f1239');
    ctx.fillStyle = uGrad;
    ctx.beginPath();
    ctx.arc(16, 15, 14, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
  });

  makeCanvas(scene, 'googly_eye', 20, 20, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    drawEllipse(ctx, 10, 10, 8.8, 8.8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 8.5, 11, 4.8, 4.8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 9.5, 9.2, 1.8, 1.8);
    ctx.fill();
  });

  // Tawny Frogmouth Stick Bug - 3D Sculpted Bark Camouflage per World
  const stickBugThemes = [
    { id: 1, bgCol: 0x5c381e, lineCol: 0x3d2311, knotCol: 0x422613, fleckCol: 0x4d7c0f, eyeCol: 0xffe600, pupilCol: 0x0a0a0a },
    { id: 2, bgCol: 0x313d1e, lineCol: 0x1f2713, knotCol: 0x242e16, fleckCol: 0x10b981, eyeCol: 0xfacc15, pupilCol: 0x0a0a0a },
    { id: 3, bgCol: 0x442b26, lineCol: 0x271613, knotCol: 0x331e1a, fleckCol: 0xfbcfe8, eyeCol: 0xf472b6, pupilCol: 0x1c0514 },
    { id: 4, bgCol: 0x221f26, lineCol: 0x110f14, knotCol: 0x17141a, fleckCol: 0xef4444, eyeCol: 0xff4500, pupilCol: 0xffd700 },
  ];

  for (const st of stickBugThemes) {
    const drawStickBug = (ctx: CanvasRenderingContext2D, peeking: boolean) => {
      const bGrad = ctx.createLinearGradient(22, 4, 22, 20);
      bGrad.addColorStop(0, rgba(lighten(st.bgCol, 0.22)));
      bGrad.addColorStop(0.5, rgba(st.bgCol));
      bGrad.addColorStop(1, rgba(darken(st.bgCol, 0.35)));
      ctx.fillStyle = bGrad;
      ctx.strokeStyle = rgba(st.lineCol);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(2, 4, 40, 16, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = rgba(st.fleckCol, 0.9);
      drawEllipse(ctx, 10, 6, 2.2, 1.5); ctx.fill();
      drawEllipse(ctx, 32, 16, 2.2, 1.5); ctx.fill();

      if (peeking) {
        for (const ex of [14, 26]) {
          ctx.fillStyle = rgba(st.eyeCol);
          drawEllipse(ctx, ex, 11, 5, 5); ctx.fill();
          ctx.fillStyle = rgba(st.pupilCol);
          drawEllipse(ctx, ex + 0.5, 11, 2.8, 2.8); ctx.fill();
          ctx.fillStyle = '#ffffff';
          drawEllipse(ctx, ex + 1.5, 9.8, 1.2, 1.2); ctx.fill();
        }
      }
    };

    makeCanvas(scene, `stick_bug_hidden_${st.id}`, 44, 24, (ctx) => drawStickBug(ctx, false));
    if (st.id === 1) makeCanvas(scene, 'stick_bug_hidden', 44, 24, (ctx) => drawStickBug(ctx, false));

    makeCanvas(scene, `stick_bug_peeking_${st.id}`, 44, 24, (ctx) => drawStickBug(ctx, true));
    if (st.id === 1) {
      makeCanvas(scene, 'stick_bug_peeking', 44, 24, (ctx) => drawStickBug(ctx, true));
      makeCanvas(scene, 'frogmouth_stick', 44, 24, (ctx) => drawStickBug(ctx, true));
    }
  }

  // Sacred Phoenix Pyre Altar
  makeCanvas(scene, 'pyre_altar', 44, 42, (ctx) => {
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(10, 28, 24, 12);
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.roundRect(6, 22, 32, 10, 4);
    ctx.fill();
    const fGrad = ctx.createRadialGradient(22, 16, 2, 22, 12, 16);
    fGrad.addColorStop(0, '#ffffff');
    fGrad.addColorStop(0.35, '#fde047');
    fGrad.addColorStop(0.7, '#f97316');
    fGrad.addColorStop(1, '#dc2626');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.moveTo(11, 22);
    ctx.quadraticCurveTo(14, 8, 22, 1);
    ctx.quadraticCurveTo(30, 8, 33, 22);
    ctx.closePath();
    ctx.fill();
  });

  // Solar Ember (Phoenix drop, 500c)
  makeCanvas(scene, 'drop_solar_ember', 32, 32, (ctx) => {
    const eGrad = ctx.createRadialGradient(14, 13, 1.5, 16, 16, 15);
    eGrad.addColorStop(0, '#ffffff');
    eGrad.addColorStop(0.3, '#fef08a');
    eGrad.addColorStop(0.65, '#f97316');
    eGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = eGrad;
    drawEllipse(ctx, 16, 16, 15, 15);
    ctx.fill();
  });

  // Golden Tree Beetle (Cruncher drop, 150c - 3D Iridescent Scarab Carapace)
  makeCanvas(scene, 'drop_beetle', 32, 32, (ctx) => {
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2] of [[8, 10, 3, 7], [8, 16, 2, 16], [8, 22, 4, 25], [24, 10, 29, 7], [24, 16, 30, 16], [24, 22, 28, 25], [13, 8, 8, 2], [19, 8, 24, 2]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const cGrad = ctx.createRadialGradient(13, 14, 1.5, 16, 17, 11);
    cGrad.addColorStop(0, '#fef9c3');
    cGrad.addColorStop(0.35, '#a3e635');
    cGrad.addColorStop(0.7, '#d97706');
    cGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = cGrad;
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.2;
    drawEllipse(ctx, 16, 17, 9, 11);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(16, 8); ctx.lineTo(16, 27);
    ctx.stroke();

    ctx.fillStyle = '#451a03';
    drawEllipse(ctx, 16, 7.5, 4.5, 3.8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    drawEllipse(ctx, 13, 13.5, 2.2, 4.5, 0.2);
    ctx.fill();
  });

  // Luminous Forest Pearl (Toucan drop, 500c)
  makeCanvas(scene, 'drop_pearl', 32, 32, (ctx) => {
    const aGrad = ctx.createRadialGradient(16, 16, 4, 16, 16, 15);
    aGrad.addColorStop(0, 'rgba(244, 114, 182, 0.45)');
    aGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = aGrad;
    drawEllipse(ctx, 16, 16, 15, 15);
    ctx.fill();

    const pGrad = ctx.createRadialGradient(12, 12, 1.5, 16, 16, 11);
    pGrad.addColorStop(0, '#ffffff');
    pGrad.addColorStop(0.45, '#fce7f3');
    pGrad.addColorStop(0.8, '#bae6fd');
    pGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = pGrad;
    drawEllipse(ctx, 16, 16, 10.5, 10.5);
    ctx.fill();
  });

  // Amber Nectar Pod (Ember Shrike drop, 200c - Food for Sugar Glider)
  makeCanvas(scene, 'drop_nectar', 32, 32, (ctx) => {
    const nGrad = ctx.createRadialGradient(13, 16, 1.5, 16, 19, 11);
    nGrad.addColorStop(0, '#ffffff');
    nGrad.addColorStop(0.3, '#fef08a');
    nGrad.addColorStop(0.7, '#f59e0b');
    nGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = nGrad;
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(16, 3);
    ctx.bezierCurveTo(23, 12, 26, 18, 25, 22);
    ctx.bezierCurveTo(24, 27, 20, 29, 16, 29);
    ctx.bezierCurveTo(12, 29, 8, 27, 7, 22);
    ctx.bezierCurveTo(6, 18, 9, 12, 16, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    drawEllipse(ctx, 12.5, 17, 2.2, 4.2, 0.25);
    ctx.fill();
  });

  // Soft ground shadow for Sugar Glider / Cinder Gecko
  makeCanvas(scene, 'shadow_bird_adult', 64, 24, (ctx) => {
    const grad = ctx.createRadialGradient(32, 12, 2, 32, 12, 28);
    grad.addColorStop(0, 'rgba(5, 14, 28, 0.55)');
    grad.addColorStop(1, 'rgba(5, 14, 28, 0)');
    ctx.fillStyle = grad;
    drawEllipse(ctx, 32, 12, 28, 10);
    ctx.fill();
  });

  // =========================================================================
  // UPGRADED 2.5D ILLUSTRATED SANCTUARY COMPANION PETS
  // =========================================================================

  // pet_hedgehog (Spike - Ground Coin Collector)
  makeCanvas(scene, 'pet_hedgehog', 82, 52, (ctx) => {
    // Layered cream-tipped quills fan
    for (let a = Math.PI * 0.92; a <= Math.PI * 2.08; a += 0.16) {
      const qx = 34 + Math.cos(a) * 26;
      const qy = 31 + Math.sin(a) * 19;
      const tx = 34 + Math.cos(a - 0.08) * 37;
      const ty = 31 + Math.sin(a - 0.08) * 28;
      const qGrad = ctx.createLinearGradient(qx, qy, tx, ty);
      qGrad.addColorStop(0, '#3e2723');
      qGrad.addColorStop(0.7, '#6d4c41');
      qGrad.addColorStop(1, '#fef3c7');
      ctx.fillStyle = qGrad;
      ctx.beginPath();
      ctx.moveTo(qx - 3.5, qy + 3);
      ctx.lineTo(tx, ty);
      ctx.lineTo(qx + 3.5, qy + 3);
      ctx.closePath();
      ctx.fill();
    }
    // Rounded quill mantle with 3D radial shading
    const mGrad = ctx.createRadialGradient(32, 22, 4, 34, 30, 30);
    mGrad.addColorStop(0, '#795548');
    mGrad.addColorStop(0.65, '#4e342e');
    mGrad.addColorStop(1, '#271815');
    ctx.fillStyle = mGrad;
    drawEllipse(ctx, 35, 31, 28, 19);
    ctx.fill();

    // Cute warm paws
    ctx.fillStyle = '#d7b38c';
    drawEllipse(ctx, 26, 46, 7, 3.8);
    ctx.fill();
    drawEllipse(ctx, 50, 46, 7, 3.8);
    ctx.fill();

    // Sculpted cream face & pointed snout
    const fGrad = ctx.createRadialGradient(60, 31, 2, 60, 34, 18);
    fGrad.addColorStop(0, '#fff8eb');
    fGrad.addColorStop(0.7, '#f3d5ad');
    fGrad.addColorStop(1, '#c89d6c');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.moveTo(46, 20);
    ctx.quadraticCurveTo(64, 20, 77, 35);
    ctx.quadraticCurveTo(64, 46, 44, 43);
    ctx.closePath();
    ctx.fill();

    // Rounded ear
    ctx.fillStyle = '#c89d6c';
    drawEllipse(ctx, 51, 23, 4.5, 5.5, -0.2);
    ctx.fill();
    ctx.fillStyle = '#fda4af';
    drawEllipse(ctx, 51.5, 23.5, 2.5, 3.2, -0.2);
    ctx.fill();

    // Glossy button nose & studio eye
    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 77, 35, 3.2, 2.8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 76.2, 34, 1.1, 0.8);
    ctx.fill();

    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 63, 29, 3.4, 3.6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 62.2, 27.8, 1.3, 1.1);
    ctx.fill();

    // Rosy cheek
    ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
    drawEllipse(ctx, 61, 36, 4.2, 2.8);
    ctx.fill();
  });

  // pet_squirrel (Nutty - Acorn Sniper)
  makeCanvas(scene, 'pet_squirrel', 66, 84, (ctx) => {
    // Magnificent S-curved plush bushy squirrel tail
    const tGrad = ctx.createRadialGradient(18, 36, 4, 18, 46, 30);
    tGrad.addColorStop(0, '#fb923c');
    tGrad.addColorStop(0.6, '#ea580c');
    tGrad.addColorStop(1, '#9a3412');
    ctx.fillStyle = tGrad;
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(32, 68);
    ctx.bezierCurveTo(6, 70, 0, 36, 12, 18);
    ctx.bezierCurveTo(20, 8, 32, 16, 28, 30);
    ctx.bezierCurveTo(25, 42, 34, 54, 32, 68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Warm cream tail highlight swirl
    ctx.fillStyle = 'rgba(254, 215, 170, 0.5)';
    drawEllipse(ctx, 16, 38, 7, 16, -0.15);
    ctx.fill();

    // Body & cream belly
    const bGrad = ctx.createRadialGradient(42, 48, 3, 40, 54, 22);
    bGrad.addColorStop(0, '#fb923c');
    bGrad.addColorStop(0.7, '#d97706');
    bGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 40, 55, 16, 21);
    ctx.fill();

    ctx.fillStyle = '#fff7ed';
    drawEllipse(ctx, 45, 57, 9.5, 14);
    ctx.fill();

    // Tufted ears & sculpted head
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.moveTo(35, 19); ctx.lineTo(36, 5); ctx.lineTo(43, 16); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(46, 16); ctx.lineTo(52, 5); ctx.lineTo(55, 19); ctx.closePath(); ctx.fill();

    const hGrad = ctx.createRadialGradient(46, 24, 2, 45, 28, 16);
    hGrad.addColorStop(0, '#fdba74');
    hGrad.addColorStop(0.65, '#ea580c');
    hGrad.addColorStop(1, '#9a3412');
    ctx.fillStyle = hGrad;
    drawEllipse(ctx, 45, 28, 15, 13.5);
    ctx.fill();

    // Expressive eye, nose & acorn in paws
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 50, 26, 4.6, 4.8);
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    drawEllipse(ctx, 51, 26.5, 3, 3.2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 50, 25.2, 1.2, 1);
    ctx.fill();

    ctx.fillStyle = '#292524';
    drawEllipse(ctx, 59, 30, 2.2, 1.8);
    ctx.fill();

    // Holding a little golden acorn
    ctx.fillStyle = '#d97706';
    drawEllipse(ctx, 52, 54, 5.5, 6.5, 0.2);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    drawEllipse(ctx, 53, 49, 6.5, 3, 0.2);
    ctx.fill();
  });

  // pet_butterfly (Flutter - Sky Sweeper)
  makeCanvas(scene, 'pet_butterfly', 60, 46, (ctx) => {
    // Iridescent Monarch / Morpho Stained-Glass Wings
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(30, 23);
      ctx.scale(side, 1);

      // Forewing
      const fwGrad = ctx.createRadialGradient(10, -6, 2, 14, -6, 18);
      fwGrad.addColorStop(0, '#fdf4ff');
      fwGrad.addColorStop(0.35, '#f472b6');
      fwGrad.addColorStop(0.75, '#9333ea');
      fwGrad.addColorStop(1, '#3b0764');
      ctx.fillStyle = fwGrad;
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.bezierCurveTo(10, -20, 28, -20, 27, -4);
      ctx.bezierCurveTo(26, 6, 12, 6, 2, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hindwing
      const hwGrad = ctx.createRadialGradient(8, 8, 1, 11, 10, 14);
      hwGrad.addColorStop(0, '#e0f2fe');
      hwGrad.addColorStop(0.45, '#38bdf8');
      hwGrad.addColorStop(0.85, '#6366f1');
      hwGrad.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = hwGrad;
      ctx.beginPath();
      ctx.moveTo(2, 2);
      ctx.bezierCurveTo(14, 2, 22, 12, 16, 19);
      ctx.bezierCurveTo(10, 23, 3, 15, 2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Luminous wing eyespots
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      drawEllipse(ctx, 18, -8, 3.2, 2.6, -0.3);
      ctx.fill();
      drawEllipse(ctx, 22, -3, 1.8, 1.8);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      drawEllipse(ctx, 12, 12, 2.5, 2.5);
      ctx.fill();

      ctx.restore();
    }

    // Velvet thorax, abdomen, & curled antennae
    ctx.fillStyle = '#271815';
    drawEllipse(ctx, 30, 24, 3.2, 13);
    ctx.fill();
    ctx.strokeStyle = '#271815';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(29, 12); ctx.quadraticCurveTo(25, 4, 21, 3);
    ctx.moveTo(31, 12); ctx.quadraticCurveTo(35, 4, 39, 3);
    ctx.stroke();
  });

  // pet_hen (Goldie - Golden Egg Layer)
  makeCanvas(scene, 'pet_hen', 92, 76, (ctx) => {
    // Legs
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(36, 62); ctx.lineTo(36, 73);
    ctx.moveTo(50, 62); ctx.lineTo(50, 73);
    ctx.stroke();

    // Fanned tail feathers
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.3;
    for (const [tx, ty] of [[4, 22], [2, 32], [5, 42]]) {
      ctx.beginPath();
      ctx.moveTo(22, 42);
      ctx.quadraticCurveTo(10, ty - 4, tx, ty);
      ctx.quadraticCurveTo(10, ty + 6, 22, 48);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Plump pearl-white & warm cream nesting hen body
    const bGrad = ctx.createRadialGradient(46, 36, 5, 42, 45, 32);
    bGrad.addColorStop(0, '#ffffff');
    bGrad.addColorStop(0.65, '#fef9c3');
    bGrad.addColorStop(1, '#eab308');
    ctx.fillStyle = bGrad;
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 1.5;
    drawEllipse(ctx, 42, 46, 29, 21);
    ctx.fill();
    ctx.stroke();

    // Sculpted wing with golden feather scallops
    const wGrad = ctx.createLinearGradient(22, 36, 54, 56);
    wGrad.addColorStop(0, '#fef08a');
    wGrad.addColorStop(1, '#ca8a04');
    ctx.fillStyle = wGrad;
    drawEllipse(ctx, 37, 48, 17, 11, 0.12);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 64, 28, 14, 14);
    ctx.fill();
    ctx.stroke();

    // Scalloped crimson comb & wattle
    ctx.fillStyle = '#e11d48';
    for (const [cx, cy, r] of [[58, 13, 4.8], [65, 11, 5.2], [72, 14, 4.2], [71, 39, 4.5]]) {
      drawEllipse(ctx, cx, cy, r, r);
      ctx.fill();
    }

    // Beak & Eye
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(75, 23); ctx.lineTo(89, 28); ctx.lineTo(75, 33); ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 68, 25, 3.2, 3.2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 69, 24, 1.2, 1.2);
    ctx.fill();
  });

  // pet_nightingale (Melody - Grand Siren)
  makeCanvas(scene, 'pet_nightingale', 88, 72, (ctx) => {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(34, 56); ctx.lineTo(34, 66);
    ctx.moveTo(44, 56); ctx.lineTo(44, 66);
    ctx.stroke();

    const bGrad = ctx.createRadialGradient(44, 34, 4, 38, 42, 28);
    bGrad.addColorStop(0, '#d8b4fe');
    bGrad.addColorStop(0.6, '#9333ea');
    bGrad.addColorStop(1, '#4c1d95');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 38, 42, 24, 17);
    ctx.fill();

    ctx.fillStyle = '#fce7f3';
    drawEllipse(ctx, 45, 45, 15, 11);
    ctx.fill();

    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 54, 25, 15, 14);
    ctx.fill();

    // Royal crest plumes
    ctx.fillStyle = '#f472b6';
    for (const [px, py, r] of [[47, 11, 5], [55, 9, 5.5], [62, 12, 4.5]]) {
      drawEllipse(ctx, px, py, r, r);
      ctx.fill();
    }

    // Wing
    ctx.fillStyle = '#581c87';
    drawEllipse(ctx, 29, 42, 16, 8.5, -0.1);
    ctx.fill();

    // Eye & singing golden bill
    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 58, 23, 3.2, 3.2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 59, 21.8, 1.2, 1.2);
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(67, 22); ctx.lineTo(80, 26); ctx.lineTo(67, 30); ctx.closePath();
    ctx.fill();
  });

  // pet_badger (Barnaby)
  makeCanvas(scene, 'pet_badger', 80, 52, (ctx) => {
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(26, 42); ctx.lineTo(26, 50);
    ctx.moveTo(48, 42); ctx.lineTo(48, 50);
    ctx.stroke();

    const bGrad = ctx.createRadialGradient(36, 24, 4, 36, 32, 28);
    bGrad.addColorStop(0, '#6b7280');
    bGrad.addColorStop(0.65, '#374151');
    bGrad.addColorStop(1, '#111827');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 36, 32, 28, 16);
    ctx.fill();

    // Striped badger head
    ctx.fillStyle = '#111827';
    drawEllipse(ctx, 57, 27, 15, 11, 0.1);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(46, 18); ctx.lineTo(73, 25); ctx.lineTo(48, 23); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(46, 34); ctx.lineTo(73, 28); ctx.lineTo(48, 30); ctx.closePath(); ctx.fill();

    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 63, 25, 2.8, 2.8);
    ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 63.5, 25, 1.8, 1.8);
    ctx.fill();
    drawEllipse(ctx, 73, 26.5, 2.8, 2.4);
    ctx.fill();
  });

  // pet_porcupine (Bristle)
  makeCanvas(scene, 'pet_porcupine', 78, 50, (ctx) => {
    // Sharp banded black-and-ivory quills
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI * 0.15 - i * 0.19;
      const x1 = 32 + Math.cos(a) * 14;
      const y1 = 29 + Math.sin(a) * 10;
      const x2 = 32 + Math.cos(a) * 33;
      const y2 = 29 + Math.sin(a) * 24;
      ctx.strokeStyle = i % 2 === 0 ? '#fef3c7' : '#d6d3d1';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    const bGrad = ctx.createRadialGradient(36, 26, 3, 36, 31, 24);
    bGrad.addColorStop(0, '#78350f');
    bGrad.addColorStop(1, '#3e2723');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 36, 31, 24, 15);
    ctx.fill();

    ctx.fillStyle = '#92400e';
    drawEllipse(ctx, 56, 30, 13, 12);
    ctx.fill();
    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 61, 28, 2.8, 2.8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 60.3, 27, 1, 1);
    ctx.fill();
    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 68, 31, 2.4, 2.2);
    ctx.fill();
  });

  // pet_quail (Flora)
  makeCanvas(scene, 'pet_quail', 68, 58, (ctx) => {
    const bGrad = ctx.createRadialGradient(32, 32, 3, 32, 36, 22);
    bGrad.addColorStop(0, '#a1887f');
    bGrad.addColorStop(1, '#4e342e');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 32, 36, 22, 16);
    ctx.fill();
    ctx.fillStyle = '#efebe9';
    drawEllipse(ctx, 38, 40, 13, 9.5);
    ctx.fill();
    ctx.fillStyle = '#6d4c41';
    drawEllipse(ctx, 46, 22, 12, 12);
    ctx.fill();
    // Forward teardrop topknot plume!
    ctx.strokeStyle = '#271815';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(46, 12);
    ctx.quadraticCurveTo(44, 4, 51, 4);
    ctx.stroke();
    ctx.fillStyle = '#271815';
    drawEllipse(ctx, 52, 4.5, 3.2, 2.4, 0.3);
    ctx.fill();

    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 49, 20, 2.6, 2.6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 49.8, 19.2, 1, 1);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(56, 20); ctx.lineTo(65, 23); ctx.lineTo(56, 26); ctx.closePath();
    ctx.fill();
  });

  // pet_mama (Mama Dove - Nest Mother Companion)
  makeCanvas(scene, 'pet_mama', 74, 62, (ctx) => {
    // Woven twig nest base
    const nGrad = ctx.createLinearGradient(8, 36, 64, 56);
    nGrad.addColorStop(0, '#92400e');
    nGrad.addColorStop(0.5, '#78350f');
    nGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = nGrad;
    drawEllipse(ctx, 36, 46, 27, 12);
    ctx.fill();
    ctx.fillStyle = '#3e2723';
    drawEllipse(ctx, 36, 41, 21, 7.5);
    ctx.fill();

    // Warm speckled eggs in nest
    ctx.fillStyle = '#fffbeb';
    drawEllipse(ctx, 28, 38, 6.5, 5);
    ctx.fill();
    drawEllipse(ctx, 44, 38, 6.5, 5);
    ctx.fill();

    // Graceful pearl-white & rose Mama Dove
    const dGrad = ctx.createRadialGradient(38, 22, 2, 36, 28, 20);
    dGrad.addColorStop(0, '#ffffff');
    dGrad.addColorStop(0.7, '#f5f5f4');
    dGrad.addColorStop(1, '#d6d3d1');
    ctx.fillStyle = dGrad;
    drawEllipse(ctx, 36, 28, 18, 12);
    ctx.fill();
    drawEllipse(ctx, 46, 18, 11, 11);
    ctx.fill();

    ctx.fillStyle = '#e7e5e4';
    drawEllipse(ctx, 28, 28, 11, 6.5, -0.1);
    ctx.fill();

    ctx.fillStyle = '#1c1917';
    drawEllipse(ctx, 49, 16, 2.6, 2.6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 49.8, 15, 1, 1);
    ctx.fill();
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.moveTo(55, 16); ctx.lineTo(63, 18.5); ctx.lineTo(55, 21); ctx.closePath();
    ctx.fill();
  });

  // pet_woodpecker (Pip)
  makeCanvas(scene, 'pet_woodpecker', 66, 72, (ctx) => {
    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 30, 42, 17, 22);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    drawEllipse(ctx, 35, 44, 9.5, 15);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 38, 22, 13, 13);
    ctx.fill();
    // Blazing crimson woodpecker crest!
    const cGrad = ctx.createLinearGradient(24, 6, 46, 18);
    cGrad.addColorStop(0, '#f43f5e');
    cGrad.addColorStop(1, '#be123c');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.moveTo(24, 10);
    ctx.quadraticCurveTo(36, 2, 47, 13);
    ctx.lineTo(35, 19);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 42, 20, 3.4, 3.4);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 42.6, 20, 2, 2);
    ctx.fill();

    // Chisel beak
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(49, 19); ctx.lineTo(64, 22.5); ctx.lineTo(49, 25.5); ctx.closePath();
    ctx.fill();
  });

  // pet_magpie (Grimm)
  makeCanvas(scene, 'pet_magpie', 76, 64, (ctx) => {
    // Iridescent long tail
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(20, 38); ctx.lineTo(0, 52); ctx.lineTo(6, 56); ctx.lineTo(24, 44); ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 35, 38, 22, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 39, 42, 13, 9);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 50, 24, 13, 13);
    ctx.fill();

    // Iridescent teal-sapphire wing sheen
    const wGrad = ctx.createLinearGradient(16, 30, 42, 42);
    wGrad.addColorStop(0, '#0284c7');
    wGrad.addColorStop(0.5, '#38bdf8');
    wGrad.addColorStop(1, '#1e3a8a');
    ctx.fillStyle = wGrad;
    drawEllipse(ctx, 29, 36, 13, 6.8, -0.12);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 54, 22, 3, 3);
    ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 54.6, 22, 1.8, 1.8);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(60, 21); ctx.lineTo(74, 25); ctx.lineTo(60, 28); ctx.closePath();
    ctx.fill();
  });

  // pet_snail (Mossy)
  makeCanvas(scene, 'pet_snail', 64, 46, (ctx) => {
    // Soft mint-emerald foot & eyestalks
    const fGrad = ctx.createLinearGradient(8, 26, 58, 42);
    fGrad.addColorStop(0, '#6ee7b7');
    fGrad.addColorStop(1, '#10b981');
    ctx.fillStyle = fGrad;
    drawEllipse(ctx, 33, 35, 24, 7.5);
    ctx.fill();
    drawEllipse(ctx, 49, 28, 7.5, 7.5);
    ctx.fill();

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(48, 24); ctx.lineTo(53, 13);
    ctx.moveTo(52, 25); ctx.lineTo(59, 15);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 53, 13, 2.2, 2.2); ctx.fill();
    drawEllipse(ctx, 59, 15, 2.2, 2.2); ctx.fill();

    // Glossy spiral shell
    const sGrad = ctx.createRadialGradient(21, 18, 2, 24, 22, 16);
    sGrad.addColorStop(0, '#86efac');
    sGrad.addColorStop(0.55, '#16a34a');
    sGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = sGrad;
    drawEllipse(ctx, 24, 22, 15.5, 15.5);
    ctx.fill();

    ctx.strokeStyle = 'rgba(220, 252, 231, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(24, 22, 10, 0, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(24, 22, 5, 0, Math.PI * 1.8);
    ctx.stroke();
  });

  // pet_mole (Rocky)
  makeCanvas(scene, 'pet_mole', 68, 48, (ctx) => {
    const bGrad = ctx.createRadialGradient(32, 22, 3, 32, 28, 24);
    bGrad.addColorStop(0, '#52525b');
    bGrad.addColorStop(1, '#18181b');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 32, 28, 23, 15);
    ctx.fill();
    drawEllipse(ctx, 49, 26, 13, 12);
    ctx.fill();
    // Star-nosed pink snout & digging claws
    ctx.fillStyle = '#fb7185';
    drawEllipse(ctx, 61, 26, 4.2, 3.8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 53, 22, 2, 2);
    ctx.fill();
    ctx.fillStyle = '#fbcfe8';
    drawEllipse(ctx, 28, 40, 6.5, 3.8);
    ctx.fill();
    drawEllipse(ctx, 47, 39, 6.5, 3.8);
    ctx.fill();
  });

  // pet_hound (Bramble)
  makeCanvas(scene, 'pet_hound', 84, 60, (ctx) => {
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(16, 34); ctx.quadraticCurveTo(8, 26, 6, 19);
    ctx.stroke();

    const bGrad = ctx.createRadialGradient(40, 30, 4, 40, 36, 28);
    bGrad.addColorStop(0, '#d97706');
    bGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 40, 36, 26, 16);
    ctx.fill();
    drawEllipse(ctx, 61, 25, 15, 14);
    ctx.fill();
    // Floppy hound ear
    ctx.fillStyle = '#451a03';
    drawEllipse(ctx, 55, 29, 5.5, 10, 0.15);
    ctx.fill();
    // Red collar
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(51, 33); ctx.lineTo(63, 37);
    ctx.stroke();
    // Eye & nose
    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 66, 21, 2.8, 2.8); ctx.fill();
    drawEllipse(ctx, 74, 26, 3.6, 3.2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 66.8, 20, 1, 1); ctx.fill();
  });

  // pet_owl (Hoot)
  makeCanvas(scene, 'pet_owl', 60, 64, (ctx) => {
    const bGrad = ctx.createRadialGradient(30, 30, 4, 30, 36, 24);
    bGrad.addColorStop(0, '#a16207');
    bGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 30, 36, 20, 22);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    drawEllipse(ctx, 30, 41, 13, 14);
    ctx.fill();
    // Ear tufts
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(14, 19); ctx.lineTo(19, 5); ctx.lineTo(26, 18); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(34, 18); ctx.lineTo(41, 5); ctx.lineTo(46, 19); ctx.closePath(); ctx.fill();
    // Giant golden radar eyes
    for (const ex of [22, 38]) {
      ctx.fillStyle = '#fbbf24';
      drawEllipse(ctx, ex, 24, 8.2, 8.2); ctx.fill();
      ctx.fillStyle = '#090a0f';
      drawEllipse(ctx, ex, 24, 4.8, 4.8); ctx.fill();
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, ex + 1.8, 22, 1.8, 1.8); ctx.fill();
    }
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(27, 28); ctx.lineTo(33, 28); ctx.lineTo(30, 35); ctx.closePath();
    ctx.fill();
  });

  // pet_frog (Bouncer)
  makeCanvas(scene, 'pet_frog', 60, 48, (ctx) => {
    const fGrad = ctx.createRadialGradient(30, 24, 3, 30, 30, 22);
    fGrad.addColorStop(0, '#4ade80');
    fGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = fGrad;
    drawEllipse(ctx, 30, 30, 21, 13.5);
    ctx.fill();
    ctx.fillStyle = '#dcfce7';
    drawEllipse(ctx, 30, 34, 13, 7.5);
    ctx.fill();
    for (const ex of [20, 40]) {
      ctx.fillStyle = '#16a34a';
      drawEllipse(ctx, ex, 16, 8, 8); ctx.fill();
      ctx.fillStyle = '#facc15';
      drawEllipse(ctx, ex, 16, 5.5, 5.5); ctx.fill();
      ctx.fillStyle = '#090a0f';
      drawEllipse(ctx, ex, 16, 2.8, 3.8); ctx.fill();
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, ex - 1.2, 14.2, 1.4, 1.4); ctx.fill();
    }
  });

  // pet_hummingbird (Zephyr)
  makeCanvas(scene, 'pet_hummingbird', 64, 50, (ctx) => {
    // Translucent blurred hovering wings
    ctx.fillStyle = 'rgba(167, 243, 208, 0.65)';
    drawEllipse(ctx, 21, 15, 11, 4.5, -0.35);
    ctx.fill();
    drawEllipse(ctx, 24, 19, 9, 3.8, -0.15);
    ctx.fill();

    const bGrad = ctx.createLinearGradient(14, 20, 44, 36);
    bGrad.addColorStop(0, '#34d399');
    bGrad.addColorStop(0.6, '#059669');
    bGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 28, 30, 15, 9, -0.15);
    ctx.fill();
    drawEllipse(ctx, 36, 21, 9.5, 9.5);
    ctx.fill();

    // Ruby throat gorget
    ctx.fillStyle = '#f43f5e';
    drawEllipse(ctx, 38, 27, 5.5, 4.5);
    ctx.fill();

    // Needle nectar bill
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(44, 21); ctx.lineTo(61, 24);
    ctx.stroke();

    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 39, 19.5, 2.2, 2.2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 39.6, 18.8, 0.9, 0.9); ctx.fill();
  });

  // pet_firefly (Sparky)
  makeCanvas(scene, 'pet_firefly', 56, 50, (ctx) => {
    // Radiant bioluminescent lantern glow
    const lGrad = ctx.createRadialGradient(18, 34, 1, 18, 34, 16);
    lGrad.addColorStop(0, '#ffffff');
    lGrad.addColorStop(0.4, '#fde047');
    lGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = lGrad;
    drawEllipse(ctx, 18, 34, 16, 16);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    drawEllipse(ctx, 27, 23, 9.5, 10.5, 0.3);
    ctx.fill();
    drawEllipse(ctx, 36, 16, 7.5, 7.5);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    drawEllipse(ctx, 27, 13, 9.5, 4.2, -0.25);
    ctx.fill();
  });

  // pet_ferret (Fang)
  makeCanvas(scene, 'pet_ferret', 82, 46, (ctx) => {
    const bGrad = ctx.createLinearGradient(10, 18, 66, 38);
    bGrad.addColorStop(0, '#f59e0b');
    bGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 38, 28, 26, 11);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    drawEllipse(ctx, 44, 31, 14, 6.5);
    ctx.fill();
    ctx.fillStyle = '#b45309';
    drawEllipse(ctx, 58, 20, 11.5, 10.5);
    ctx.fill();
    // Bandit mask
    ctx.fillStyle = '#1e293b';
    drawEllipse(ctx, 59, 19.5, 6.5, 3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 60, 19, 1.8, 1.8); ctx.fill();
    ctx.fillStyle = '#f43f5e';
    drawEllipse(ctx, 67, 21.5, 2, 1.8); ctx.fill();
  });

  // pet_phoenix_chick (Asher)
  makeCanvas(scene, 'pet_phoenix_chick', 66, 64, (ctx) => {
    const pGrad = ctx.createRadialGradient(34, 30, 3, 32, 36, 22);
    pGrad.addColorStop(0, '#fde047');
    pGrad.addColorStop(0.55, '#f97316');
    pGrad.addColorStop(1, '#dc2626');
    ctx.fillStyle = pGrad;
    drawEllipse(ctx, 32, 36, 19, 16);
    ctx.fill();
    drawEllipse(ctx, 44, 22, 13, 13);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    drawEllipse(ctx, 35, 39, 11, 9.5);
    ctx.fill();
    // Flame crest
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(38, 11); ctx.lineTo(44, 0); ctx.lineTo(48, 12);
    ctx.lineTo(53, 2); ctx.lineTo(54, 14); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#18181b';
    drawEllipse(ctx, 47, 20, 2.6, 2.6); ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 47.7, 19.2, 1, 1); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(54, 20); ctx.lineTo(63, 23); ctx.lineTo(54, 26); ctx.closePath();
    ctx.fill();
  });

  // pet_chameleon (Echo)
  makeCanvas(scene, 'pet_chameleon', 68, 50, (ctx) => {
    ctx.strokeStyle = '#0891b2';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(16, 35, 7, 0, Math.PI * 1.6);
    ctx.stroke();

    const cGrad = ctx.createLinearGradient(16, 16, 56, 38);
    cGrad.addColorStop(0, '#22d3ee');
    cGrad.addColorStop(0.5, '#06b6d4');
    cGrad.addColorStop(1, '#0e7490');
    ctx.fillStyle = cGrad;
    drawEllipse(ctx, 36, 28, 19, 11.5);
    ctx.fill();
    drawEllipse(ctx, 50, 22, 11.5, 11.5);
    ctx.fill();
    ctx.fillStyle = '#cffafe';
    drawEllipse(ctx, 52, 20, 4.8, 4.8);
    ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 53, 20, 2.2, 2.2);
    ctx.fill();
  });

  // pet_robin (Rusty)
  makeCanvas(scene, 'pet_robin', 66, 52, (ctx) => {
    ctx.fillStyle = '#78350f';
    drawEllipse(ctx, 32, 28, 17, 12.5);
    ctx.fill();
    const rGrad = ctx.createRadialGradient(38, 30, 2, 36, 32, 13);
    rGrad.addColorStop(0, '#fb7185');
    rGrad.addColorStop(1, '#e11d48');
    ctx.fillStyle = rGrad;
    drawEllipse(ctx, 36, 32, 12.5, 9.5);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    drawEllipse(ctx, 46, 18, 10.5, 10.5);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(54, 17); ctx.lineTo(63, 20); ctx.lineTo(54, 23); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 48, 16, 2.8, 2.8); ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 48.6, 16, 1.6, 1.6); ctx.fill();
  });

  // pet_otter (River)
  makeCanvas(scene, 'pet_otter', 74, 50, (ctx) => {
    const oGrad = ctx.createLinearGradient(14, 16, 60, 38);
    oGrad.addColorStop(0, '#92400e');
    oGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = oGrad;
    drawEllipse(ctx, 38, 28, 23, 11.5);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    drawEllipse(ctx, 44, 30, 12, 6.8);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    drawEllipse(ctx, 54, 20, 11.5, 11);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    drawEllipse(ctx, 48, 11, 3.8, 3.8); ctx.fill();
    drawEllipse(ctx, 58, 11, 3.8, 3.8); ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 63, 20, 2.4, 2.2); ctx.fill();
    drawEllipse(ctx, 55, 17, 2.2, 2.2); ctx.fill();
  });

  // pet_cricket (Chirpy)
  makeCanvas(scene, 'pet_cricket', 68, 48, (ctx) => {
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(26, 26); ctx.lineTo(14, 13); ctx.lineTo(16, 38);
    ctx.stroke();

    const cGrad = ctx.createLinearGradient(12, 18, 56, 34);
    cGrad.addColorStop(0, '#4ade80');
    cGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = cGrad;
    drawEllipse(ctx, 32, 28, 18, 8.5);
    ctx.fill();
    drawEllipse(ctx, 48, 22, 10.5, 10.5);
    ctx.fill();

    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(52, 15); ctx.lineTo(65, 4);
    ctx.moveTo(50, 15); ctx.lineTo(58, 2);
    ctx.stroke();

    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 52, 19, 2.2, 2.2);
    ctx.fill();
  });

  // pet_dragonfly (Dart)
  makeCanvas(scene, 'pet_dragonfly', 68, 52, (ctx) => {
    // Gossamer iridescent wings
    ctx.fillStyle = 'rgba(125, 211, 252, 0.65)';
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.7)';
    ctx.lineWidth = 1;
    for (const [wx, wy, rx, ry, rot] of [
      [35, 14, 14, 4.5, -0.2],
      [43, 12, 13, 4, -0.1],
      [35, 38, 13, 4, 0.2],
      [43, 39, 12, 3.8, 0.1],
    ]) {
      drawEllipse(ctx, wx, wy, rx, ry, rot);
      ctx.fill();
      ctx.stroke();
    }

    const dGrad = ctx.createLinearGradient(14, 26, 56, 26);
    dGrad.addColorStop(0, '#38bdf8');
    dGrad.addColorStop(1, '#0369a1');
    ctx.fillStyle = dGrad;
    drawEllipse(ctx, 33, 26, 19, 3.8);
    ctx.fill();
    drawEllipse(ctx, 52, 26, 6.8, 6.8);
    ctx.fill();
    ctx.fillStyle = '#bae6fd';
    drawEllipse(ctx, 55, 23, 2.8, 2.8); ctx.fill();
    drawEllipse(ctx, 55, 29, 2.8, 2.8); ctx.fill();
  });

  // ---------- Sugar Glider (World 4 Non-Bird Glider) ----------
  makeCanvas(scene, 'sugar_glider_perch', 62, 44, (ctx) => {
    // Plush bushy tail
    const tGrad = ctx.createLinearGradient(2, 22, 26, 32);
    tGrad.addColorStop(0, '#334155');
    tGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = tGrad;
    drawEllipse(ctx, 13, 27, 11, 5.5, -0.18);
    ctx.fill();

    // Soft silver-grey body & cream belly
    const bGrad = ctx.createRadialGradient(34, 22, 2, 32, 28, 16);
    bGrad.addColorStop(0, '#cbd5e1');
    bGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 32, 28, 13, 11);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    drawEllipse(ctx, 36, 31, 8, 7);
    ctx.fill();

    // Head & dorsal stripe
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 45, 20, 12.5, 12);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    drawEllipse(ctx, 39, 17, 2.5, 9, -0.3);
    ctx.fill();

    // Rounded ears with pink insides
    for (const [ex, ey] of [[41, 9], [50, 10]]) {
      ctx.fillStyle = '#475569';
      drawEllipse(ctx, ex, ey, 4.2, 5.2, 0.15);
      ctx.fill();
      ctx.fillStyle = '#fda4af';
      drawEllipse(ctx, ex, ey + 0.5, 2.5, 3.2, 0.15);
      ctx.fill();
    }

    // Giant nocturnal sugar-glider eye with studio catchlights
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 47, 18.5, 5.2, 5.4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 45.4, 16.8, 1.9, 1.7);
    ctx.fill();
    drawEllipse(ctx, 48.6, 20, 0.9, 0.9);
    ctx.fill();

    // Pink nose & dainty paws
    ctx.fillStyle = '#f43f5e';
    drawEllipse(ctx, 56, 21, 2, 1.8);
    ctx.fill();
    ctx.fillStyle = '#fbcfe8';
    drawEllipse(ctx, 28, 38, 2.8, 2.2); ctx.fill();
    drawEllipse(ctx, 40, 38, 2.8, 2.2); ctx.fill();
  });

  makeCanvas(scene, 'sugar_glider_glide', 68, 58, (ctx) => {
    // Outstretched patagium gliding membrane
    const pGrad = ctx.createRadialGradient(34, 24, 4, 34, 24, 24);
    pGrad.addColorStop(0, '#cbd5e1');
    pGrad.addColorStop(0.7, '#64748b');
    pGrad.addColorStop(1, '#334155');
    ctx.fillStyle = pGrad;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.quadraticCurveTo(34, 8, 56, 14);
    ctx.quadraticCurveTo(48, 26, 54, 40);
    ctx.quadraticCurveTo(34, 36, 14, 40);
    ctx.quadraticCurveTo(20, 26, 12, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    drawEllipse(ctx, 34, 25, 8.5, 11);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    drawEllipse(ctx, 34, 23, 2, 15);
    ctx.fill();

    // Streaming rudder tail
    ctx.fillStyle = '#475569';
    drawEllipse(ctx, 34, 47, 4.2, 9.5);
    ctx.fill();

    // Head & big eyes
    ctx.fillStyle = '#94a3b8';
    drawEllipse(ctx, 34, 11, 9.5, 9);
    ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 29, 9.5, 3.3, 3.3); ctx.fill();
    drawEllipse(ctx, 39, 9.5, 3.3, 3.3); ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 28, 8.5, 1.2, 1.2); ctx.fill();
    drawEllipse(ctx, 38, 8.5, 1.2, 1.2); ctx.fill();
    ctx.fillStyle = '#f43f5e';
    drawEllipse(ctx, 34, 4.5, 1.8, 1.6); ctx.fill();
  });

  makeCanvas(scene, 'sugar_glider_icon', 44, 44, (ctx) => {
    const grad = ctx.createRadialGradient(22, 20, 2, 22, 22, 18);
    grad.addColorStop(0, '#cbd5e1');
    grad.addColorStop(1, '#475569');
    ctx.fillStyle = grad;
    drawEllipse(ctx, 22, 23, 16, 15);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    drawEllipse(ctx, 22, 27, 9, 7);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    drawEllipse(ctx, 22, 14, 2, 8);
    ctx.fill();
    for (const ex of [15, 29]) {
      ctx.fillStyle = '#090a0f';
      drawEllipse(ctx, ex, 20, 4.4, 4.4); ctx.fill();
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, ex - 1.2, 18.5, 1.6, 1.6); ctx.fill();
    }
    ctx.fillStyle = '#f43f5e';
    drawEllipse(ctx, 22, 24.5, 2, 1.8); ctx.fill();
  });

  // ---------- Cinder Gecko / Flame Chameleon ----------
  const drawGecko = (ctx: CanvasRenderingContext2D, crawling: boolean) => {
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    if (crawling) {
      ctx.moveTo(9, 32); ctx.quadraticCurveTo(18, 25, 26, 24);
    } else {
      ctx.arc(14, 28, 8.5, 0, Math.PI * 1.65);
    }
    ctx.stroke();

    // Dorsal golden flame spines
    ctx.fillStyle = '#fde047';
    for (const sx of [27, 34, 41]) {
      ctx.beginPath();
      ctx.moveTo(sx - 2.5, 18); ctx.lineTo(sx, 10); ctx.lineTo(sx + 2.5, 18);
      ctx.closePath();
      ctx.fill();
    }

    // Volcanic magma-scaled body
    const bGrad = ctx.createLinearGradient(22, 16, 52, 34);
    bGrad.addColorStop(0, '#c2410c');
    bGrad.addColorStop(0.6, '#7c2d12');
    bGrad.addColorStop(1, '#431407');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 37, 25, crawling ? 15 : 13, 8.8);
    ctx.fill();
    ctx.fillStyle = '#fb923c';
    drawEllipse(ctx, 39, 28, 10, 5.2);
    ctx.fill();

    // Gripping gecko limbs & glowing toe pads
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(29, 28); ctx.lineTo(crawling ? 21 : 24, 39);
    ctx.moveTo(45, 28); ctx.lineTo(crawling ? 55 : 48, 39);
    ctx.stroke();
    ctx.fillStyle = '#fb923c';
    drawEllipse(ctx, crawling ? 20 : 23, 40, 2.8, 2); ctx.fill();
    drawEllipse(ctx, crawling ? 56 : 49, 40, 2.8, 2); ctx.fill();

    // Casque helmet head & turret eye
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 52, 20, 8.5, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(45, 15); ctx.lineTo(53, 8); ctx.lineTo(56, 18); ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fde047';
    drawEllipse(ctx, 52.5, 18.5, 4.4, 4.4);
    ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 53, 18.5, 1.1, 3.2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 51.8, 17, 1.2, 1.2);
    ctx.fill();
  };

  makeCanvas(scene, 'cinder_gecko_perch', 68, 48, (ctx) => drawGecko(ctx, false));
  makeCanvas(scene, 'cinder_gecko_crawl', 74, 46, (ctx) => drawGecko(ctx, true));

  makeCanvas(scene, 'cinder_gecko_icon', 44, 44, (ctx) => {
    const grad = ctx.createRadialGradient(20, 20, 2, 22, 24, 18);
    grad.addColorStop(0, '#ea580c');
    grad.addColorStop(1, '#7c2d12');
    ctx.fillStyle = grad;
    drawEllipse(ctx, 22, 24, 16, 15);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    drawEllipse(ctx, 19, 20, 5.8, 5.8);
    ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 19.5, 20, 1.3, 4.2);
    ctx.fill();
  });

  // =========================================================================
  // UPGRADED 2.5D ILLUSTRATED PREDATORS &CLARA THE SANCTUARY WARDEN
  // =========================================================================

  // enemy_cat (Prowling Shadow Cat)
  makeCanvas(scene, 'enemy_cat', 90, 65, (ctx) => {
    // Sinuous tail
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(18, 44); ctx.bezierCurveTo(4, 38, 4, 20, 12, 16);
    ctx.stroke();

    const cGrad = ctx.createRadialGradient(46, 34, 4, 44, 42, 30);
    cGrad.addColorStop(0, '#334155');
    cGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = cGrad;
    drawEllipse(ctx, 44, 42, 27, 15);
    ctx.fill();
    drawEllipse(ctx, 68, 30, 16, 15);
    ctx.fill();

    // Pointed feline ears
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(57, 20); ctx.lineTo(63, 5); ctx.lineTo(70, 18); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(69, 18); ctx.lineTo(77, 5); ctx.lineTo(82, 21); ctx.closePath(); ctx.fill();

    // Glowing emerald slit eyes
    for (const ex of [65, 75]) {
      ctx.fillStyle = '#4ade80';
      drawEllipse(ctx, ex, 28, 3.2, 4.2); ctx.fill();
      ctx.fillStyle = '#052e16';
      drawEllipse(ctx, ex, 28, 1, 3.5); ctx.fill();
    }
  });

  // enemy_snake (Canopy Tree Viper)
  makeCanvas(scene, 'enemy_snake', 110, 45, (ctx) => {
    // Flickering forked crimson tongue
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(95, 19); ctx.lineTo(104, 19);
    ctx.lineTo(108, 16); ctx.moveTo(104, 19); ctx.lineTo(108, 22);
    ctx.stroke();

    // Smooth S-curved scaled viper body
    const sGrad = ctx.createLinearGradient(10, 10, 90, 32);
    sGrad.addColorStop(0, '#14532d');
    sGrad.addColorStop(0.5, '#16a34a');
    sGrad.addColorStop(1, '#4ade80');
    ctx.strokeStyle = sGrad;
    ctx.lineWidth = 10.5;
    ctx.beginPath();
    ctx.moveTo(10, 26);
    ctx.bezierCurveTo(28, 6, 52, 38, 78, 18);
    ctx.stroke();

    // Diamond-shaped viper head
    ctx.fillStyle = '#15803d';
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(74, 10);
    ctx.quadraticCurveTo(86, 9, 96, 19);
    ctx.quadraticCurveTo(86, 29, 74, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Slit golden reptile eye
    ctx.fillStyle = '#facc15';
    drawEllipse(ctx, 85, 16, 3.2, 3.2); ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 85.5, 16, 1, 2.8); ctx.fill();
  });

  // enemy_raccoon (Bandit Raccoon)
  makeCanvas(scene, 'enemy_raccoon', 85, 75, (ctx) => {
    // Ringed bushy tail
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1f2937' : '#9ca3af';
      drawEllipse(ctx, 14 + i * 5, 46 - i * 2, 7, 10, -0.3);
      ctx.fill();
    }
    // Loot sack on back
    const lGrad = ctx.createRadialGradient(26, 44, 2, 26, 48, 15);
    lGrad.addColorStop(0, '#d97706');
    lGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = lGrad;
    drawEllipse(ctx, 26, 48, 15, 15);
    ctx.fill();

    // Body & Head
    ctx.fillStyle = '#4b5563';
    drawEllipse(ctx, 44, 44, 24, 19);
    ctx.fill();
    ctx.fillStyle = '#6b7280';
    drawEllipse(ctx, 62, 30, 16, 15);
    ctx.fill();
    // Black bandit mask
    ctx.fillStyle = '#111827';
    drawEllipse(ctx, 63, 29, 11, 4.8);
    ctx.fill();
    for (const ex of [58, 68]) {
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, ex, 29, 3, 3); ctx.fill();
      ctx.fillStyle = '#090a0f';
      drawEllipse(ctx, ex + 0.5, 29, 1.6, 1.6); ctx.fill();
    }
  });

  // emporium_keeper (Clara the Sanctuary Warden - Warm Studio Portrait)
  makeCanvas(scene, 'emporium_keeper', 100, 115, (ctx) => {
    // Explorer jacket & crisp white collar
    const jGrad = ctx.createLinearGradient(20, 68, 80, 110);
    jGrad.addColorStop(0, '#d97706');
    jGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = jGrad;
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(20, 68, 60, 42, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.moveTo(41, 68); ctx.lineTo(50, 82); ctx.lineTo(59, 68); ctx.closePath();
    ctx.fill();

    //Emerald sanctuary badge on jacket
    ctx.fillStyle = '#10b981';
    drawEllipse(ctx, 64, 82, 4.5, 5.5);
    ctx.fill();

    // Neck & softly shaded face
    ctx.fillStyle = '#f3c69f';
    ctx.fillRect(44, 60, 12, 12);
    const fGrad = ctx.createRadialGradient(48, 38, 3, 50, 42, 24);
    fGrad.addColorStop(0, '#ffedd5');
    fGrad.addColorStop(1, '#f3c69f');
    ctx.fillStyle = fGrad;
    drawEllipse(ctx, 50, 42, 22, 22);
    ctx.fill();

    // Chestnut hair locks framing face
    ctx.fillStyle = '#5c2e0e';
    drawEllipse(ctx, 30, 42, 5, 14, 0.15);
    ctx.fill();
    drawEllipse(ctx, 70, 42, 5, 14, -0.15);
    ctx.fill();

    // Rosy cheeks, warm smile, & expressive studio eyes
    ctx.fillStyle = 'rgba(251, 113, 133, 0.55)';
    drawEllipse(ctx, 37, 46, 5, 3.2); ctx.fill();
    drawEllipse(ctx, 63, 46, 5, 3.2); ctx.fill();

    for (const ex of [42, 58]) {
      ctx.fillStyle = '#1e293b';
      drawEllipse(ctx, ex, 40, 3.2, 4.2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, ex - 1, 38.5, 1.3, 1.3); ctx.fill();
    }

    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(50, 49, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Sanctuary Ranger Hat with golden feather plume!
    const hGrad = ctx.createLinearGradient(22, 8, 78, 28);
    hGrad.addColorStop(0, '#34d399');
    hGrad.addColorStop(0.5, '#059669');
    hGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = hGrad;
    drawEllipse(ctx, 50, 24, 30, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(30, 8, 40, 17, 7);
    ctx.fill();
    ctx.fillStyle = '#78350f';
    ctx.fillRect(30, 20, 40, 4.5);

    // Golden feather tucked into hatband
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(64, 21);
    ctx.quadraticCurveTo(72, 4, 78, 3);
    ctx.quadraticCurveTo(74, 15, 68, 22);
    ctx.closePath();
    ctx.fill();
  });

  // enemy_spider (Venomous Canopy Weaver)
  makeCanvas(scene, 'enemy_spider', 96, 84, (ctx) => {
    // Gossamer silk thread
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(48, 0); ctx.lineTo(48, 30);
    ctx.stroke();

    // Articulated chitinous legs with violet joints
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3.2;
    const legs = [
      [[40, 26], [22, 10], [8, 22]],
      [[38, 30], [16, 26], [4, 46]],
      [[38, 36], [18, 50], [12, 70]],
      [[40, 42], [24, 66], [20, 80]],
      [[56, 26], [74, 10], [88, 22]],
      [[58, 30], [80, 26], [92, 46]],
      [[58, 36], [78, 50], [84, 70]],
      [[56, 42], [72, 66], [76, 80]],
    ];
    for (const [p0, p1, p2] of legs) {
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
      ctx.fillStyle = '#a855f7';
      drawEllipse(ctx, p1[0], p1[1], 2.6, 2.6);
      ctx.fill();
    }

    // Bulbous obsidian-violet abdomen with crimson hourglass
    const aGrad = ctx.createRadialGradient(44, 44, 3, 48, 50, 20);
    aGrad.addColorStop(0, '#581c87');
    aGrad.addColorStop(0.6, '#2e1065');
    aGrad.addColorStop(1, '#090514');
    ctx.fillStyle = aGrad;
    drawEllipse(ctx, 48, 50, 18, 16);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(43, 43); ctx.lineTo(53, 43); ctx.lineTo(48, 51); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(48, 49); ctx.lineTo(43, 57); ctx.lineTo(53, 57); ctx.closePath(); ctx.fill();

    // Cephalothorax, chelicerae fangs & venom drip
    const cGrad = ctx.createRadialGradient(46, 28, 2, 48, 32, 14);
    cGrad.addColorStop(0, '#3f3f46');
    cGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = cGrad;
    drawEllipse(ctx, 48, 32, 14, 13);
    ctx.fill();

    ctx.fillStyle = '#52525b';
    ctx.beginPath();
    ctx.moveTo(43, 38); ctx.lineTo(47, 48); ctx.lineTo(42, 48); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(53, 38); ctx.lineTo(49, 48); ctx.lineTo(54, 48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4ade80';
    drawEllipse(ctx, 44, 50, 2.2, 2.6); ctx.fill();

    // Cluster of glowing crimson eyes
    for (const [ex, ey, r] of [[45, 27, 2.8], [51, 27, 2.8], [41, 25, 1.8], [55, 25, 1.8], [42, 31, 1.5], [54, 31, 1.5]]) {
      ctx.fillStyle = '#ef4444';
      drawEllipse(ctx, ex, ey, r, r); ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 45.8, 26, 1, 1); ctx.fill();
    drawEllipse(ctx, 51.8, 26, 1, 1); ctx.fill();
  });

  // enemy_weasel (Slinky Pine Marten / Weasel)
  makeCanvas(scene, 'enemy_weasel', 88, 50, (ctx) => {
    const wGrad = ctx.createLinearGradient(12, 18, 76, 38);
    wGrad.addColorStop(0, '#c2410c');
    wGrad.addColorStop(0.6, '#9a3412');
    wGrad.addColorStop(1, '#431407');
    ctx.fillStyle = wGrad;
    drawEllipse(ctx, 42, 30, 30, 11);
    ctx.fill();
    ctx.fillStyle = '#ffedd5';
    drawEllipse(ctx, 48, 34, 17, 6);
    ctx.fill();
    ctx.fillStyle = '#7c2d12';
    drawEllipse(ctx, 70, 22, 13, 12);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    drawEllipse(ctx, 74, 20, 3.2, 3.2); ctx.fill();
    ctx.fillStyle = '#090a0f';
    drawEllipse(ctx, 74.6, 20, 1.6, 2.4); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(75, 26); ctx.lineTo(80, 28); ctx.lineTo(77, 32); ctx.closePath();
    ctx.fill();
  });

  // spider_web (3D silk dewdrop web)
  makeCanvas(scene, 'spider_web', 70, 70, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.78)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(35, 35);
      ctx.lineTo(35 + Math.cos(a) * 32, 35 + Math.sin(a) * 32);
      ctx.stroke();
    }
    [11, 21, 30].forEach((r) => {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a1 = (i * Math.PI) / 4;
        const a2 = ((i + 1) * Math.PI) / 4;
        const x1 = 35 + Math.cos(a1) * r;
        const y1 = 35 + Math.sin(a1) * r;
        const x2 = 35 + Math.cos(a2) * r;
        const y2 = 35 + Math.sin(a2) * r;
        const mx = 35 + Math.cos((a1 + a2) / 2) * (r * 0.88);
        const my = 35 + Math.sin((a1 + a2) / 2) * (r * 0.88);
        if (i === 0) ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(mx, my, x2, y2);
      }
      ctx.stroke();
    });
    // 3D shimmering dewdrops
    [[24, 24], [46, 28], [29, 48], [44, 44]].forEach(([dx, dy]) => {
      ctx.fillStyle = '#bae6fd';
      drawEllipse(ctx, dx, dy, 2, 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      drawEllipse(ctx, dx - 0.5, dy - 0.5, 0.8, 0.8); ctx.fill();
    });
  });

  // truffle (3D gnarled black diamond truffle)
  makeCanvas(scene, 'truffle', 22, 22, (ctx) => {
    const gT = ctx.createRadialGradient(8, 8, 1, 11, 11, 10);
    gT.addColorStop(0, '#78350f');
    gT.addColorStop(0.55, '#451a03');
    gT.addColorStop(1, '#1c0a00');
    ctx.fillStyle = gT;
    drawEllipse(ctx, 11, 11, 9, 8.5);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    drawEllipse(ctx, 14, 13, 2, 1.8); ctx.fill();
    drawEllipse(ctx, 8, 14, 1.4, 1.2); ctx.fill();
  });

  // pinecone (3D layered conifer cone)
  makeCanvas(scene, 'pinecone', 24, 30, (ctx) => {
    const pGrad = ctx.createRadialGradient(9, 12, 2, 12, 16, 13);
    pGrad.addColorStop(0, '#b45309');
    pGrad.addColorStop(0.65, '#78350f');
    pGrad.addColorStop(1, '#271408');
    ctx.fillStyle = pGrad;
    drawEllipse(ctx, 12, 16, 9, 11);
    ctx.fill();
    for (let r = 0; r < 4; r++) {
      for (let c = -1; c <= 1; c++) {
        ctx.fillStyle = r % 2 === 0 ? '#92400e' : '#b45309';
        drawEllipse(ctx, 12 + c * 3.5, 9 + r * 4.5, 3.2, 2.4);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#f59e0b';
    drawEllipse(ctx, 12, 4, 2.5, 2.5); ctx.fill();
  });

  // enemy_glutton (3D bulbous Insaniquarium-style feeder monster)
  makeCanvas(scene, 'enemy_glutton', 96, 88, (ctx) => {
    ctx.fillStyle = '#365314';
    ctx.beginPath();
    ctx.moveTo(22, 34); ctx.lineTo(4, 18); ctx.lineTo(28, 46); ctx.closePath();
    ctx.fill();
    const bGrad = ctx.createRadialGradient(38, 34, 6, 48, 48, 38);
    bGrad.addColorStop(0, '#a3e635');
    bGrad.addColorStop(0.55, '#4d7c0f');
    bGrad.addColorStop(1, '#1a2e05');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 48, 48, 34, 28);
    ctx.fill();
    const belGrad = ctx.createRadialGradient(44, 52, 4, 46, 54, 24);
    belGrad.addColorStop(0, '#ecfccb');
    belGrad.addColorStop(0.6, '#84cc16');
    belGrad.addColorStop(1, 'rgba(77,124,15,0)');
    ctx.fillStyle = belGrad;
    drawEllipse(ctx, 46, 54, 24, 19);
    ctx.fill();
    // Cavernous 3D mouth
    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 66, 44, 16, 13);
    ctx.fill();
    ctx.fillStyle = '#991b1b';
    drawEllipse(ctx, 64, 48, 10, 6);
    ctx.fill();
    // 3D ivory fangs
    ctx.fillStyle = '#fef08a';
    [[60, 34, 62, 41, 64, 34], [68, 33, 70, 40, 72, 33], [62, 54, 64, 47, 66, 54], [70, 53, 72, 46, 74, 53]].forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fill();
    });
    drawStudioEye(ctx, 58, 24, 7.5, '#d90429');
  });

  // enemy_bombardier (3D armored tactical bomber raptor)
  makeCanvas(scene, 'enemy_bombardier', 120, 70, (ctx) => {
    const wGrad = ctx.createLinearGradient(0, 12, 0, 58);
    wGrad.addColorStop(0, '#64748b');
    wGrad.addColorStop(0.6, '#334155');
    wGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = wGrad;
    ctx.beginPath(); ctx.moveTo(55, 34); ctx.lineTo(4, 14); ctx.lineTo(28, 56); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(65, 34); ctx.lineTo(116, 14); ctx.lineTo(92, 56); ctx.closePath(); ctx.fill();
    const bGrad = ctx.createRadialGradient(54, 32, 4, 60, 38, 28);
    bGrad.addColorStop(0, '#475569');
    bGrad.addColorStop(0.65, '#1e293b');
    bGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 60, 38, 26, 14);
    ctx.fill();
    // Leather bomb harness
    ctx.fillStyle = '#b45309';
    drawRoundedRect(ctx, 42, 28, 36, 18, 5);
    ctx.fill();
    // Head & aviator goggles
    ctx.fillStyle = '#0f172a';
    drawEllipse(ctx, 78, 28, 13, 13);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath(); ctx.moveTo(84, 24); ctx.lineTo(104, 30); ctx.lineTo(96, 36); ctx.lineTo(84, 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f59e0b';
    drawRoundedRect(ctx, 75, 21, 15, 7, 2.5); ctx.fill();
    ctx.fillStyle = '#38bdf8';
    drawRoundedRect(ctx, 79, 22.5, 7, 4, 1.5); ctx.fill();
    // Under-wing 3D missile pods
    [22, 74].forEach((px) => {
      ctx.fillStyle = '#0f172a';
      drawRoundedRect(ctx, px, 40, 24, 13, 4); ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(px + 6, 40, 3, 13);
      ctx.fillRect(px + 12, 40, 3, 13);
      ctx.fillStyle = '#ef4444';
      drawEllipse(ctx, px + 24, 44, 3, 3); ctx.fill();
      drawEllipse(ctx, px + 24, 50, 3, 3); ctx.fill();
    });
  });

  // enemy_vulture_active (3D Gourmet Chef Vulture)
  makeCanvas(scene, 'enemy_vulture_active', 104, 92, (ctx) => {
    ctx.fillStyle = '#1c1917';
    ctx.beginPath(); ctx.moveTo(48, 48); ctx.lineTo(6, 20); ctx.lineTo(24, 66); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(56, 48); ctx.lineTo(98, 20); ctx.lineTo(80, 66); ctx.closePath(); ctx.fill();
    const bGrad = ctx.createRadialGradient(46, 46, 4, 52, 54, 26);
    bGrad.addColorStop(0, '#57534e');
    bGrad.addColorStop(0.65, '#292524');
    bGrad.addColorStop(1, '#0c0a09');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 52, 54, 23, 21);
    ctx.fill();
    ctx.fillStyle = '#f1f5f9';
    drawEllipse(ctx, 52, 38, 15, 7.5);
    ctx.fill();
    ctx.fillStyle = '#be123c';
    drawRoundedRect(ctx, 47, 24, 10, 15, 4); ctx.fill();
    drawEllipse(ctx, 52, 22, 13, 13); ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.moveTo(58, 19); ctx.lineTo(79, 25); ctx.lineTo(75, 31); ctx.lineTo(58, 28); ctx.closePath(); ctx.fill();
    drawStudioEye(ctx, 58, 18, 4.5, '#ef4444');
    // Chef Toque Hat
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, 42, 8, 20, 6, 2); ctx.fill();
    drawEllipse(ctx, 45, 5, 7, 6); ctx.fill();
    drawEllipse(ctx, 52, 3, 8, 7); ctx.fill();
    drawEllipse(ctx, 59, 5, 7, 6); ctx.fill();
  });

  // enemy_vulture_dormant (3D Sleeping Vulture in Bubble)
  makeCanvas(scene, 'enemy_vulture_dormant', 104, 92, (ctx) => {
    const bubGrad = ctx.createRadialGradient(38, 32, 6, 52, 48, 46);
    bubGrad.addColorStop(0, 'rgba(255,255,255,0.65)');
    bubGrad.addColorStop(0.55, 'rgba(56,189,248,0.28)');
    bubGrad.addColorStop(1, 'rgba(2,132,199,0.55)');
    ctx.fillStyle = bubGrad;
    drawEllipse(ctx, 52, 48, 45, 45);
    ctx.fill();
    ctx.fillStyle = '#334155';
    drawEllipse(ctx, 52, 50, 26, 26);
    ctx.fill();
    ctx.fillStyle = '#f1f5f9';
    drawEllipse(ctx, 52, 34, 13, 6.5);
    ctx.fill();
    ctx.fillStyle = '#f472b6';
    drawEllipse(ctx, 52, 24, 12, 12);
    ctx.fill();
    ctx.strokeStyle = '#831843';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(56, 23, 4, 0, Math.PI); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    drawEllipse(ctx, 36, 26, 8, 4, -0.4);
    ctx.fill();
  });

  // homing_missile (3D sleek rocket missile)
  makeCanvas(scene, 'homing_missile', 32, 18, (ctx) => {
    const mGrad = ctx.createLinearGradient(6, 5, 6, 13);
    mGrad.addColorStop(0, '#f8fafc');
    mGrad.addColorStop(0.5, '#cbd5e1');
    mGrad.addColorStop(1, '#475569');
    ctx.fillStyle = mGrad;
    drawRoundedRect(ctx, 6, 5, 18, 8, 3);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(22, 5); ctx.lineTo(31, 9); ctx.lineTo(22, 13); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(2, 1); ctx.lineTo(11, 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, 13); ctx.lineTo(2, 17); ctx.lineTo(11, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#facc15';
    drawEllipse(ctx, 4, 9, 3.5, 2.5); ctx.fill();
  });

  // emporium_potion (3D Golden Crystal Flask)
  makeCanvas(scene, 'emporium_potion', 48, 54, (ctx) => {
    ctx.fillStyle = 'rgba(56,189,248,0.38)';
    drawRoundedRect(ctx, 10, 18, 28, 30, 9);
    ctx.fill();
    const lGrad = ctx.createRadialGradient(20, 30, 2, 24, 35, 16);
    lGrad.addColorStop(0, '#fef08a');
    lGrad.addColorStop(0.6, '#eab308');
    lGrad.addColorStop(1, '#a16207');
    ctx.fillStyle = lGrad;
    drawRoundedRect(ctx, 12, 24, 24, 22, 7);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    drawRoundedRect(ctx, 18, 8, 12, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    drawRoundedRect(ctx, 16, 15, 16, 4, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    drawRoundedRect(ctx, 14, 22, 4, 18, 2);
    ctx.fill();
  });

  // backdrop_preview (3D Framed Landscape Canvas)
  makeCanvas(scene, 'backdrop_preview', 80, 56, (ctx) => {
    ctx.fillStyle = '#78350f';
    drawRoundedRect(ctx, 2, 2, 76, 52, 5);
    ctx.fill();
    const sGrad = ctx.createLinearGradient(6, 6, 6, 50);
    sGrad.addColorStop(0, '#0284c7');
    sGrad.addColorStop(1, '#bae6fd');
    ctx.fillStyle = sGrad;
    drawRoundedRect(ctx, 6, 6, 68, 44, 3);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    drawEllipse(ctx, 40, 26, 13, 13);
    ctx.fill();
    ctx.fillStyle = '#16a34a';
    drawEllipse(ctx, 40, 45, 32, 9);
    ctx.fill();
  });

  // enemy_bat & articulated bat parts (3D Nocturnal Vampire Bat)
  makeCanvas(scene, 'enemy_bat', 96, 64, (ctx) => {
    ctx.fillStyle = '#191024';
    ctx.beginPath();
    ctx.moveTo(42, 34); ctx.lineTo(6, 10); ctx.lineTo(14, 44); ctx.lineTo(24, 38); ctx.lineTo(32, 44); ctx.lineTo(42, 38);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(54, 34); ctx.lineTo(90, 10); ctx.lineTo(82, 44); ctx.lineTo(72, 38); ctx.lineTo(64, 44); ctx.lineTo(54, 38);
    ctx.closePath(); ctx.fill();
    const bGrad = ctx.createRadialGradient(44, 24, 3, 48, 32, 22);
    bGrad.addColorStop(0, '#581c87');
    bGrad.addColorStop(0.6, '#2a1b38');
    bGrad.addColorStop(1, '#0f0718');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 48, 38, 15, 13); ctx.fill();
    drawEllipse(ctx, 48, 25, 14, 13); ctx.fill();
    drawStudioEye(ctx, 43, 24, 4, '#ef4444');
    drawStudioEye(ctx, 53, 24, 4, '#ef4444');
  });

  makeCanvas(scene, 'enemy_bat_body', 64, 60, (ctx) => {
    // 3D Pointy Bat Ears
    ctx.fillStyle = '#2a1b38';
    ctx.beginPath(); ctx.moveTo(22, 24); ctx.lineTo(17, 6); ctx.lineTo(30, 18); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(42, 24); ctx.lineTo(47, 6); ctx.lineTo(34, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f472b6';
    ctx.beginPath(); ctx.moveTo(23, 22); ctx.lineTo(19, 10); ctx.lineTo(28, 18); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(41, 22); ctx.lineTo(45, 10); ctx.lineTo(36, 18); ctx.closePath(); ctx.fill();
    const bGrad = ctx.createRadialGradient(28, 24, 3, 32, 34, 22);
    bGrad.addColorStop(0, '#6b21a8');
    bGrad.addColorStop(0.6, '#2e1065');
    bGrad.addColorStop(1, '#0f0718');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 32, 40, 14, 12); ctx.fill();
    drawEllipse(ctx, 32, 27, 15, 14); ctx.fill();
    drawStudioEye(ctx, 27, 26, 4.2, '#ef4444');
    drawStudioEye(ctx, 37, 26, 4.2, '#ef4444');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(29, 33); ctx.lineTo(30, 38); ctx.lineTo(31, 33); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(33, 33); ctx.lineTo(34, 38); ctx.lineTo(35, 33); ctx.closePath(); ctx.fill();
  });

  makeCanvas(scene, 'enemy_bat_wing_left', 48, 48, (ctx) => {
    const wGrad = ctx.createLinearGradient(6, 6, 44, 42);
    wGrad.addColorStop(0, '#4c1d95');
    wGrad.addColorStop(0.6, '#1e1b4b');
    wGrad.addColorStop(1, '#090514');
    ctx.fillStyle = wGrad;
    ctx.beginPath();
    ctx.moveTo(44, 26); ctx.lineTo(6, 6); ctx.lineTo(12, 42); ctx.lineTo(22, 35); ctx.lineTo(32, 41); ctx.lineTo(44, 30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(44, 26); ctx.lineTo(8, 8);
    ctx.moveTo(8, 8); ctx.lineTo(12, 40);
    ctx.moveTo(8, 8); ctx.lineTo(22, 34);
    ctx.moveTo(8, 8); ctx.lineTo(32, 39);
    ctx.stroke();
  });

  makeCanvas(scene, 'enemy_bat_wing_right', 48, 48, (ctx) => {
    const wGrad = ctx.createLinearGradient(42, 6, 4, 42);
    wGrad.addColorStop(0, '#4c1d95');
    wGrad.addColorStop(0.6, '#1e1b4b');
    wGrad.addColorStop(1, '#090514');
    ctx.fillStyle = wGrad;
    ctx.beginPath();
    ctx.moveTo(4, 26); ctx.lineTo(42, 6); ctx.lineTo(36, 42); ctx.lineTo(26, 35); ctx.lineTo(16, 41); ctx.lineTo(4, 30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(4, 26); ctx.lineTo(40, 8);
    ctx.moveTo(40, 8); ctx.lineTo(36, 40);
    ctx.moveTo(40, 8); ctx.lineTo(26, 34);
    ctx.moveTo(40, 8); ctx.lineTo(16, 39);
    ctx.stroke();
  });

  // =========================================================================
  // WORLD 5 FINAL BOSS: MALAKOR, THE SOVEREIGN SHADOW ROC (3D Canvas)
  // =========================================================================
  makeCanvas(scene, 'boss_roc_body', 180, 140, (ctx) => {
    const rGrad = ctx.createRadialGradient(78, 56, 10, 90, 75, 72);
    rGrad.addColorStop(0, '#581c87');
    rGrad.addColorStop(0.55, '#2e1065');
    rGrad.addColorStop(1, '#090414');
    ctx.fillStyle = rGrad;
    drawEllipse(ctx, 90, 75, 65, 45);
    ctx.fill();
    // Crowned obsidian skull
    ctx.fillStyle = '#1e1b4b';
    drawEllipse(ctx, 90, 32, 28, 22);
    ctx.fill();
    // 3D hooked basalt beak
    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.moveTo(90, 22); ctx.lineTo(128, 35); ctx.lineTo(122, 44); ctx.lineTo(90, 44); ctx.closePath(); ctx.fill();
    drawStudioEye(ctx, 82, 28, 6.5, '#ef4444');
    drawStudioEye(ctx, 98, 28, 6.5, '#ef4444');
    // Glowing Abyssal Chest Core
    const cGrad = ctx.createRadialGradient(90, 85, 2, 90, 85, 26);
    cGrad.addColorStop(0, '#fef08a');
    cGrad.addColorStop(0.35, '#f43f5e');
    cGrad.addColorStop(0.7, '#9333ea');
    cGrad.addColorStop(1, 'rgba(126,34,206,0)');
    ctx.fillStyle = cGrad;
    drawEllipse(ctx, 90, 85, 26, 26);
    ctx.fill();
  });

  makeCanvas(scene, 'boss_roc_wing_l', 160, 120, (ctx) => {
    const wGrad = ctx.createLinearGradient(150, 70, 10, 15);
    wGrad.addColorStop(0, '#3b0764');
    wGrad.addColorStop(0.6, '#1e1b4b');
    wGrad.addColorStop(1, '#c084fc');
    ctx.fillStyle = wGrad;
    ctx.beginPath(); ctx.moveTo(150, 70); ctx.lineTo(10, 15); ctx.lineTo(75, 115); ctx.closePath(); ctx.fill();
  });

  makeCanvas(scene, 'boss_roc_wing_r', 160, 120, (ctx) => {
    const wGrad = ctx.createLinearGradient(10, 70, 150, 15);
    wGrad.addColorStop(0, '#3b0764');
    wGrad.addColorStop(0.6, '#1e1b4b');
    wGrad.addColorStop(1, '#c084fc');
    ctx.fillStyle = wGrad;
    ctx.beginPath(); ctx.moveTo(10, 70); ctx.lineTo(150, 15); ctx.lineTo(85, 115); ctx.closePath(); ctx.fill();
  });

  makeCanvas(scene, 'boss_void_orb', 44, 44, (ctx) => {
    const oGrad = ctx.createRadialGradient(22, 22, 2, 22, 22, 20);
    oGrad.addColorStop(0, '#ffffff');
    oGrad.addColorStop(0.3, '#ef4444');
    oGrad.addColorStop(0.65, '#7e22ce');
    oGrad.addColorStop(1, 'rgba(126,34,206,0)');
    ctx.fillStyle = oGrad;
    drawEllipse(ctx, 22, 22, 20, 20);
    ctx.fill();
  });

  // =========================================================================
  // WORLD 5 FINAL TITAN: TITANORAPTOR (3D Canvas)
  // =========================================================================
  makeCanvas(scene, 'boss_dino_body', 200, 150, (ctx) => {
    const dGrad = ctx.createRadialGradient(88, 72, 10, 100, 85, 62);
    dGrad.addColorStop(0, '#22c55e');
    dGrad.addColorStop(0.55, '#15803d');
    dGrad.addColorStop(1, '#052e16');
    ctx.fillStyle = dGrad;
    drawEllipse(ctx, 100, 85, 55, 34);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    drawEllipse(ctx, 96, 94, 36, 17);
    ctx.fill();
    // Neck & Raptor Head
    ctx.fillStyle = '#166534';
    drawRoundedRect(ctx, 74, 28, 44, 52, 16);
    ctx.fill();
    // Cranial crest
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(92, 20); ctx.lineTo(45, 2); ctx.lineTo(74, 28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#14532d';
    drawRoundedRect(ctx, 82, 16, 72, 28, 10);
    ctx.fill();
    // Teeth
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(122 + i * 6, 32); ctx.lineTo(124 + i * 6, 38); ctx.lineTo(126 + i * 6, 32); ctx.closePath(); ctx.fill();
    }
    drawStudioEye(ctx, 108, 26, 6.5, '#f59e0b');
  });

  makeCanvas(scene, 'boss_dino_wing_l', 160, 120, (ctx) => {
    const wGrad = ctx.createLinearGradient(150, 70, 12, 15);
    wGrad.addColorStop(0, '#14532d');
    wGrad.addColorStop(0.65, '#166534');
    wGrad.addColorStop(1, '#b91c1c');
    ctx.fillStyle = wGrad;
    ctx.beginPath(); ctx.moveTo(150, 70); ctx.lineTo(12, 15); ctx.lineTo(75, 115); ctx.closePath(); ctx.fill();
  });

  makeCanvas(scene, 'boss_dino_wing_r', 160, 120, (ctx) => {
    const wGrad = ctx.createLinearGradient(10, 70, 148, 15);
    wGrad.addColorStop(0, '#14532d');
    wGrad.addColorStop(0.65, '#166534');
    wGrad.addColorStop(1, '#b91c1c');
    ctx.fillStyle = wGrad;
    ctx.beginPath(); ctx.moveTo(10, 70); ctx.lineTo(148, 15); ctx.lineTo(85, 115); ctx.closePath(); ctx.fill();
  });

  makeCanvas(scene, 'boss_dino_boulder', 44, 44, (ctx) => {
    const bGrad = ctx.createRadialGradient(18, 16, 2, 22, 22, 18);
    bGrad.addColorStop(0, '#fef08a');
    bGrad.addColorStop(0.4, '#ef4444');
    bGrad.addColorStop(0.75, '#292524');
    bGrad.addColorStop(1, '#0c0a09');
    ctx.fillStyle = bGrad;
    drawEllipse(ctx, 22, 22, 18, 18);
    ctx.fill();
  });

  // =========================================================================
  // 3D SCENERY PROPS (Stones, Boulders, Flora, & Countryside Structures)
  // =========================================================================
  // scenery_stone_moss (3D sculpted river boulder with velvet moss cushion)
  makeCanvas(scene, 'scenery_stone_moss', 80, 56, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    drawEllipse(ctx, 40, 48, 35, 7);
    ctx.fill();
    const stGrad = ctx.createRadialGradient(28, 24, 4, 40, 36, 34);
    stGrad.addColorStop(0, '#cbd5e1');
    stGrad.addColorStop(0.45, '#64748b');
    stGrad.addColorStop(0.85, '#334155');
    stGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = stGrad;
    drawEllipse(ctx, 40, 36, 32, 16);
    ctx.fill();
    // 3D pillowy moss cap
    const mGrad = ctx.createRadialGradient(32, 20, 2, 36, 24, 26);
    mGrad.addColorStop(0, '#86efac');
    mGrad.addColorStop(0.55, '#22c55e');
    mGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = mGrad;
    drawEllipse(ctx, 36, 24, 26, 7.5);
    ctx.fill();
  });

  // scenery_stone_crag (3D faceted granite mountain crag)
  makeCanvas(scene, 'scenery_stone_crag', 96, 72, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    drawEllipse(ctx, 48, 64, 41, 8);
    ctx.fill();
    // Shaded right cliff face
    const rGrad = ctx.createLinearGradient(48, 8, 88, 62);
    rGrad.addColorStop(0, '#475569');
    rGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.moveTo(52, 8); ctx.lineTo(84, 28); ctx.lineTo(88, 62); ctx.lineTo(54, 62);
    ctx.closePath(); ctx.fill();
    // Sunlit left cliff face
    const lGrad = ctx.createLinearGradient(12, 12, 56, 60);
    lGrad.addColorStop(0, '#cbd5e1');
    lGrad.addColorStop(0.55, '#64748b');
    lGrad.addColorStop(1, '#334155');
    ctx.fillStyle = lGrad;
    ctx.beginPath();
    ctx.moveTo(10, 60); ctx.lineTo(24, 20); ctx.lineTo(52, 8); ctx.lineTo(56, 62);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(248,250,252,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(24, 20); ctx.lineTo(52, 8); ctx.lineTo(56, 60);
    ctx.stroke();
  });

  // scenery_stone_volcanic (3D obsidian crag with glowing lava veins)
  makeCanvas(scene, 'scenery_stone_volcanic', 80, 64, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    drawEllipse(ctx, 40, 56, 36, 8);
    ctx.fill();
    const vGrad = ctx.createLinearGradient(12, 8, 72, 54);
    vGrad.addColorStop(0, '#3f3f46');
    vGrad.addColorStop(0.5, '#18181b');
    vGrad.addColorStop(1, '#09090b');
    ctx.fillStyle = vGrad;
    ctx.beginPath();
    ctx.moveTo(8, 52); ctx.lineTo(20, 16); ctx.lineTo(44, 6); ctx.lineTo(72, 22); ctx.lineTo(76, 54);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(44, 12); ctx.lineTo(38, 32); ctx.lineTo(52, 50); ctx.stroke();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(44, 12); ctx.lineTo(38, 32); ctx.lineTo(52, 50); ctx.stroke();
  });

  // scenery_stone_pebbles (3D smooth river pebbles)
  makeCanvas(scene, 'scenery_stone_pebbles', 48, 32, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    drawEllipse(ctx, 24, 26, 21, 5);
    ctx.fill();
    [[16, 20, 9, 7], [30, 22, 7.5, 6], [23, 24, 5.5, 4.5]].forEach(([px, py, rx, ry]) => {
      const pGrad = ctx.createRadialGradient(px - rx * 0.3, py - ry * 0.3, 1, px, py, rx);
      pGrad.addColorStop(0, '#cbd5e1');
      pGrad.addColorStop(0.55, '#64748b');
      pGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = pGrad;
      drawEllipse(ctx, px, py, rx, ry);
      ctx.fill();
    });
  });

  // scenery_mushrooms (3D glossy red Amanita toadstools)
  makeCanvas(scene, 'scenery_mushrooms', 64, 48, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    drawEllipse(ctx, 34, 42, 27, 5);
    ctx.fill();
    const drawToadstool = (cx: number, cy: number, sc: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      // 3D cylindrical stalk
      const sGrad = ctx.createLinearGradient(-7, 0, 7, 0);
      sGrad.addColorStop(0, '#f8fafc');
      sGrad.addColorStop(0.6, '#e2e8f0');
      sGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = sGrad;
      drawRoundedRect(ctx, -7, -2, 14, 22, 6);
      ctx.fill();
      // 3D dome cap
      const cGrad = ctx.createRadialGradient(-6, -10, 2, 0, -4, 22);
      cGrad.addColorStop(0, '#f87171');
      cGrad.addColorStop(0.45, '#dc2626');
      cGrad.addColorStop(1, '#7f1d1d');
      ctx.fillStyle = cGrad;
      drawEllipse(ctx, 0, -4, 22, 12);
      ctx.fill();
      // Raised 3D white warts
      ctx.fillStyle = '#ffffff';
      [[-8, -8, 3.2], [4, -10, 2.8], [11, -5, 2.5], [-13, -3, 2.2], [-1, -4, 2.8]].forEach(([wx, wy, wr]) => {
        drawEllipse(ctx, wx, wy, wr, wr * 0.85);
        ctx.fill();
      });
      ctx.restore();
    };
    drawToadstool(28, 22, 1.0);
    drawToadstool(50, 29, 0.58);
  });

  // scenery_fern (3D layered woodland fern fronds)
  makeCanvas(scene, 'scenery_fern', 56, 56, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    drawEllipse(ctx, 28, 50, 22, 4.5);
    ctx.fill();
    [[-0.48, 26], [0, 32], [0.48, 26]].forEach(([ang, len]) => {
      ctx.save();
      ctx.translate(28, 48);
      ctx.rotate(ang);
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -len); ctx.stroke();
      for (let y = -6; y >= -len; y -= 5) {
        const w = (1 - Math.abs(y) / (len + 6)) * 10 + 3;
        const lGrad = ctx.createLinearGradient(-w, y, w, y);
        lGrad.addColorStop(0, '#4ade80');
        lGrad.addColorStop(0.5, '#16a34a');
        lGrad.addColorStop(1, '#14532d');
        ctx.fillStyle = lGrad;
        drawEllipse(ctx, 0, y, w, 2.6);
        ctx.fill();
      }
      ctx.restore();
    });
  });

  // scenery_flower_bush (3D volumetric flowering shrub)
  makeCanvas(scene, 'scenery_flower_bush', 64, 48, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    drawEllipse(ctx, 32, 42, 28, 6);
    ctx.fill();
    [[18, 30, 15], [46, 30, 15], [32, 21, 17]].forEach(([bx, by, br]) => {
      const fGrad = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 2, bx, by, br);
      fGrad.addColorStop(0, '#86efac');
      fGrad.addColorStop(0.55, '#16a34a');
      fGrad.addColorStop(1, '#14532d');
      ctx.fillStyle = fGrad;
      drawEllipse(ctx, bx, by, br, br * 0.92);
      ctx.fill();
    });
    [[20, 20, '#f472b6'], [44, 22, '#f43f5e'], [32, 12, '#fbbf24'], [30, 28, '#c084fc'], [42, 34, '#38bdf8']].forEach(([fx, fy, col]) => {
      ctx.fillStyle = col as string;
      for (let a = 0; a < 5; a++) {
        const ang = (a * Math.PI * 2) / 5;
        drawEllipse(ctx, (fx as number) + Math.cos(ang) * 3, (fy as number) + Math.sin(ang) * 3, 2.4, 2.4);
        ctx.fill();
      }
      ctx.fillStyle = '#fef08a';
      drawEllipse(ctx, fx as number, fy as number, 2.2, 2.2);
      ctx.fill();
    });
  });

  // scenery_hanging_vine (3D trailing botanical ivy)
  makeCanvas(scene, 'scenery_hanging_vine', 40, 80, (ctx) => {
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.bezierCurveTo(10, 24, 30, 48, 18, 76);
    ctx.stroke();
    [[14, 12, 8], [25, 22, 8.5], [13, 34, 9], [26, 44, 8.5], [14, 56, 7.5], [23, 66, 6.5]].forEach(([vx, vy, s]) => {
      const lGrad = ctx.createRadialGradient(vx - 2, vy - 2, 1, vx, vy, s);
      lGrad.addColorStop(0, '#86efac');
      lGrad.addColorStop(0.6, '#16a34a');
      lGrad.addColorStop(1, '#14532d');
      ctx.fillStyle = lGrad;
      drawEllipse(ctx, vx, vy, s * 0.75, s * 0.52);
      ctx.fill();
    });
  });

  // scenery_crystal (3D faceted mystic amethyst cluster)
  makeCanvas(scene, 'scenery_crystal', 48, 64, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    drawEllipse(ctx, 24, 58, 21, 5);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    drawRoundedRect(ctx, 8, 48, 32, 12, 4);
    ctx.fill();
    const drawShard = (x1: number, y1: number, x2: number, x3: number) => {
      const cGrad = ctx.createLinearGradient(x2, y1, x3, 50);
      cGrad.addColorStop(0, '#f3e8ff');
      cGrad.addColorStop(0.45, '#a855f7');
      cGrad.addColorStop(1, '#581c87');
      ctx.fillStyle = cGrad;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, 50); ctx.lineTo(x3, 50); ctx.closePath(); ctx.fill();
    };
    drawShard(12, 22, 6, 20);
    drawShard(36, 26, 28, 42);
    drawShard(24, 8, 14, 34);
  });

  // scenery_lantern (3D wooden garden lantern with warm glow)
  makeCanvas(scene, 'scenery_lantern', 40, 56, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    drawEllipse(ctx, 20, 52, 14, 4);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    drawRoundedRect(ctx, 18, 10, 4, 42, 1.5); ctx.fill();
    drawRoundedRect(ctx, 12, 50, 16, 4, 2); ctx.fill();
    drawRoundedRect(ctx, 10, 10, 18, 3.5, 1.5); ctx.fill();
    const lGrad = ctx.createRadialGradient(10, 30, 1, 10, 30, 9);
    lGrad.addColorStop(0, '#ffffff');
    lGrad.addColorStop(0.5, '#fde047');
    lGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = lGrad;
    drawRoundedRect(ctx, 4, 22, 12, 15, 3);
    ctx.fill();
    ctx.fillStyle = '#271408';
    ctx.beginPath(); ctx.moveTo(10, 17); ctx.lineTo(2, 23); ctx.lineTo(18, 23); ctx.closePath(); ctx.fill();
  });

  // Keep remaining farm scenery & trophies crisp via temporary graphics helper
  g = gfx(scene);

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

  // master_trophy (Grand Finale Sovereign Chalice - 64x64)
  g.clear();
  // Pedestal & Marble Plinth
  g.fillStyle(0x1e1b4b, 1);
  g.fillRoundedRect(12, 50, 40, 12, 3);
  g.fillStyle(0x4338ca, 1);
  g.fillRect(18, 42, 28, 9);
  // Winged Golden Cup
  g.fillStyle(0xf59e0b, 1);
  g.fillRoundedRect(16, 12, 32, 32, 8);
  g.fillStyle(0xfef08a, 1);
  g.fillCircle(32, 24, 12);
  // Intricate Winged Handles
  g.lineStyle(4, 0xd97706, 1);
  g.beginPath();
  g.arc(14, 22, 9, -Math.PI / 2, Math.PI / 2);
  g.strokePath();
  g.beginPath();
  g.arc(50, 22, 9, Math.PI / 2, -Math.PI / 2);
  g.strokePath();
  // Crimson Amethyst Royal Gem in center
  g.fillStyle(0xef4444, 1);
  g.fillTriangle(32, 18, 38, 26, 26, 26);
  g.fillTriangle(32, 34, 38, 26, 26, 26);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(30, 24, 2);
  g.generateTexture('master_trophy', 64, 64);

  g.destroy();
}
