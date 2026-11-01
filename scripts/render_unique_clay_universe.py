import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCALE = 4  # 4x supersampling for retina smoothness

def create_canvas(w, h):
    return Image.new('RGBA', (w * SCALE, h * SCALE), (0, 0, 0, 0))

def finalize(img, target_w, target_h):
    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)

def draw_clay_sphere(draw_img, cx, cy, rx, ry, base_rgb, key_light=(-0.4, -0.6), gloss=0.35):
    """Volumetric 3D clay sphere with normal-map studio lighting, diffuse falloff, and bounce light"""
    x0 = int(cx - rx)
    x1 = int(cx + rx) + 1
    y0 = int(cy - ry)
    y1 = int(cy + ry) + 1
    
    if x1 <= 0 or y1 <= 0 or x0 >= draw_img.width or y0 >= draw_img.height:
        return
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(draw_img.width, x1)
    y1 = min(draw_img.height, y1)

    lx, ly = key_light
    l_mag = math.sqrt(lx*lx + ly*ly + 1.0)
    lx, ly, lz = lx / l_mag, ly / l_mag, 1.0 / l_mag

    ys, xs = np.mgrid[y0:y1, x0:x1]
    dx = (xs - cx) / rx
    dy = (ys - cy) / ry
    dist_sq = dx*dx + dy*dy
    mask = dist_sq <= 1.0

    if not np.any(mask):
        return

    nz = np.sqrt(np.maximum(0.0, 1.0 - dist_sq))
    nx = dx
    ny = dy

    dot = nx * lx + ny * ly + nz * lz
    diffuse = np.clip(dot, 0.0, 1.0)
    ao = np.power(nz, 0.45)
    bounce = np.clip(-ny * 0.5 + 0.3, 0.0, 1.0) * (1.0 - diffuse) * 0.25
    light = np.clip(0.28 + 0.65 * diffuse * ao + bounce, 0.15, 1.35)

    r0, g0, b0 = base_rgb
    r_arr = np.clip(r0 * light, 0, 255).astype(np.uint8)
    g_arr = np.clip(g0 * light, 0, 255).astype(np.uint8)
    b_arr = np.clip(b0 * light, 0, 255).astype(np.uint8)

    hx, hy, hz = lx, ly, lz + 1.0
    h_mag = math.sqrt(hx*hx + hy*hy + hz*hz)
    hx, hy, hz = hx / h_mag, hy / h_mag, hz / h_mag
    ndoth = np.maximum(0.0, nx * hx + ny * hy + nz * hz)
    spec = np.power(ndoth, 14.0) * gloss * ao

    r_arr = np.clip(r_arr + spec * 255, 0, 255).astype(np.uint8)
    g_arr = np.clip(g_arr + spec * 255, 0, 255).astype(np.uint8)
    b_arr = np.clip(b_arr + spec * 255, 0, 255).astype(np.uint8)

    alpha = np.clip((1.0 - dist_sq) * rx * 1.5, 0.0, 1.0) * 255.0
    a_arr = (alpha * mask).astype(np.uint8)

    patch = np.dstack((r_arr, g_arr, b_arr, a_arr))
    patch_img = Image.fromarray(patch, 'RGBA')
    draw_img.paste(patch_img, (x0, y0), patch_img)

def render_clay_eye(img, cx, cy, radius, iris_rgb=(22, 18, 16), eye_type='standard'):
    r = radius * SCALE
    x = cx * SCALE
    y = cy * SCALE
    
    if eye_type == 'owl':
        # Large nocturnal eye disc
        draw_clay_sphere(img, x, y, r * 1.4, r * 1.4, (245, 205, 45), gloss=0.4)
        draw_clay_sphere(img, x, y, r * 0.95, r * 0.95, (16, 16, 18), gloss=0.9)
    elif eye_type == 'angry':
        # Fierce raptor eye with brow overhang
        draw_clay_sphere(img, x, y - r*0.4, r * 1.3, r * 0.9, (45, 30, 20), gloss=0.2)
        draw_clay_sphere(img, x, y, r * 0.9, r * 0.9, iris_rgb, gloss=0.85)
        draw_clay_sphere(img, x, y, r * 0.5, r * 0.5, (15, 15, 15), gloss=0.95)
    else:
        # Cute comic bead eye
        draw_clay_sphere(img, x, y, r * 1.25, r * 1.25, (16, 26, 24), gloss=0.1)
        draw_clay_sphere(img, x, y, r, r, iris_rgb, gloss=0.85)
    
    d = ImageDraw.Draw(img)
    shr = r * 0.35
    shx = x - r * 0.28
    shy = y - r * 0.30
    d.ellipse([shx - shr, shy - shr, shx + shr, shy + shr], fill=(255, 255, 255, 255))
    shr2 = r * 0.18
    shx2 = x + r * 0.32
    shy2 = y + r * 0.32
    d.ellipse([shx2 - shr2, shy2 - shr2, shx2 + shr2, shy2 + shr2], fill=(255, 255, 255, 190))

def render_clay_beak(img, bx, by, length, thickness, base_rgb=(255, 170, 30), curve=0.0):
    steps = 16
    for i in range(steps):
        t = i / float(steps - 1)
        cur_x = (bx + length * t) * SCALE
        cur_y = (by + curve * t * t) * SCALE
        cur_r = thickness * (1.0 - t * 0.68) * SCALE
        col = (
            int(base_rgb[0] * (1.0 - t * 0.12)),
            int(base_rgb[1] * (1.0 - t * 0.10)),
            int(base_rgb[2] * (1.0 - t * 0.08)),
        )
        draw_clay_sphere(img, cur_x, cur_y, cur_r, cur_r * 0.9, col, gloss=0.45)

out_public = '/Volumes/GameDrive/insaterrarium/public/sprites'
out_src = '/Volumes/GameDrive/insaterrarium/src/assets/sprites'
os.makedirs(out_public, exist_ok=True)
os.makedirs(out_src, exist_ok=True)

def save_sprite(name, img):
    img.save(os.path.join(out_public, name))
    img.save(os.path.join(out_src, name))

# ==============================================================================
# 1. RADICALLY UNIQUE BIRD SPECIES MODELS (Each bird has custom anatomy & shape!)
# ==============================================================================

# 1.1 SPARROW / SONGBIRD (Round, aerodynamic, classic songbird)
def build_clay_sparrow():
    W, H = 118, 98
    img = create_canvas(W, H)
    # Plump body
    draw_clay_sphere(img, 24*SCALE, 50*SCALE, 16*SCALE, 8*SCALE, (242, 107, 78), gloss=0.35)
    draw_clay_sphere(img, 18*SCALE, 56*SCALE, 14*SCALE, 7*SCALE, (255, 216, 110), gloss=0.35)
    draw_clay_sphere(img, 52*SCALE, 79*SCALE, 8*SCALE, 5*SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 66*SCALE, 79*SCALE, 8*SCALE, 5*SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 60*SCALE, 52*SCALE, 32*SCALE, 29*SCALE, (38, 142, 132), gloss=0.38)
    draw_clay_sphere(img, 46*SCALE, 21*SCALE, 9*SCALE, 15*SCALE, (38, 142, 132), gloss=0.35)
    draw_clay_sphere(img, 54*SCALE, 16*SCALE, 9*SCALE, 17*SCALE, (242, 107, 78), gloss=0.38)
    draw_clay_sphere(img, 62*SCALE, 13*SCALE, 8*SCALE, 16*SCALE, (255, 216, 110), gloss=0.42)
    draw_clay_sphere(img, 68*SCALE, 58*SCALE, 21*SCALE, 20*SCALE, (255, 196, 92), gloss=0.32)
    draw_clay_sphere(img, 68*SCALE, 38*SCALE, 13*SCALE, 10*SCALE, (242, 107, 78), gloss=0.28)
    render_clay_beak(img, 78, 32, 21, 8.5, (255, 175, 35))
    render_clay_eye(img, 69, 32, 7.6)
    return finalize(img, W, H)

# 1.2 CANARY (Petite, fluffy choir bird with sharp twitter beak)
def build_clay_canary():
    W, H = 100, 88
    img = create_canvas(W, H)
    # Small round puffball body
    draw_clay_sphere(img, 22*SCALE, 48*SCALE, 12*SCALE, 7*SCALE, (240, 190, 40), gloss=0.35)
    draw_clay_sphere(img, 46*SCALE, 70*SCALE, 6*SCALE, 4*SCALE, (230, 130, 35), gloss=0.3)
    draw_clay_sphere(img, 58*SCALE, 70*SCALE, 6*SCALE, 4*SCALE, (230, 130, 35), gloss=0.3)
    draw_clay_sphere(img, 52*SCALE, 46*SCALE, 25*SCALE, 24*SCALE, (255, 228, 70), gloss=0.4)
    # Fluffy perky crest
    draw_clay_sphere(img, 44*SCALE, 18*SCALE, 6*SCALE, 11*SCALE, (255, 210, 50), gloss=0.38)
    draw_clay_sphere(img, 50*SCALE, 14*SCALE, 6*SCALE, 12*SCALE, (255, 235, 90), gloss=0.42)
    # Pale butter belly
    draw_clay_sphere(img, 58*SCALE, 52*SCALE, 17*SCALE, 17*SCALE, (255, 248, 190), gloss=0.32)
    # Tiny sharp tweeting bill
    render_clay_beak(img, 68, 30, 14, 5.8, (255, 140, 25))
    render_clay_eye(img, 60, 28, 6.4, (28, 20, 15))
    return finalize(img, W, H)

# 1.3 MAMA DOVE (Broad, gentle, maternal nesting dove)
def build_clay_mama():
    W, H = 126, 102
    img = create_canvas(W, H)
    # Wide brooding tail fan
    draw_clay_sphere(img, 20*SCALE, 52*SCALE, 18*SCALE, 11*SCALE, (215, 90, 130), gloss=0.3)
    draw_clay_sphere(img, 16*SCALE, 60*SCALE, 16*SCALE, 9*SCALE, (255, 150, 178), gloss=0.3)
    draw_clay_sphere(img, 52*SCALE, 82*SCALE, 9*SCALE, 6*SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 68*SCALE, 82*SCALE, 9*SCALE, 6*SCALE, (220, 110, 32), gloss=0.3)
    # Plump maternal belly & breast
    draw_clay_sphere(img, 62*SCALE, 54*SCALE, 36*SCALE, 32*SCALE, (255, 155, 180), gloss=0.35)
    draw_clay_sphere(img, 72*SCALE, 60*SCALE, 25*SCALE, 23*SCALE, (255, 240, 245), gloss=0.3)
    # Gentle round head with dove crest
    draw_clay_sphere(img, 72*SCALE, 34*SCALE, 18*SCALE, 17*SCALE, (255, 155, 180), gloss=0.35)
    draw_clay_sphere(img, 62*SCALE, 18*SCALE, 8*SCALE, 13*SCALE, (220, 100, 140), gloss=0.35)
    # Soft rounded dove bill
    render_clay_beak(img, 82, 34, 16, 6.8, (255, 185, 120))
    render_clay_eye(img, 74, 30, 6.8, (25, 15, 20))
    return finalize(img, W, H)

# 1.4 RAINBOW TOUCAN (Stout jet body with giant curved banana bill)
def build_clay_toucan():
    W, H = 136, 100
    img = create_canvas(W, H)
    # Square tail
    draw_clay_sphere(img, 18*SCALE, 58*SCALE, 14*SCALE, 8*SCALE, (20, 22, 28), gloss=0.3)
    draw_clay_sphere(img, 46*SCALE, 78*SCALE, 8*SCALE, 5*SCALE, (45, 95, 140), gloss=0.3)
    draw_clay_sphere(img, 60*SCALE, 78*SCALE, 8*SCALE, 5*SCALE, (45, 95, 140), gloss=0.3)
    # Upright jet-black body
    draw_clay_sphere(img, 52*SCALE, 50*SCALE, 28*SCALE, 30*SCALE, (26, 28, 36), gloss=0.45)
    # Bright golden-yellow bib & throat
    draw_clay_sphere(img, 64*SCALE, 44*SCALE, 18*SCALE, 20*SCALE, (255, 215, 60), gloss=0.35)
    draw_clay_sphere(img, 66*SCALE, 56*SCALE, 14*SCALE, 8*SCALE, (235, 55, 55), gloss=0.35)
    # GIANT CURVED BANANA RAINBOW BEAK (Starts at 68, extends to 118!)
    steps = 22
    for i in range(steps):
        t = i / float(steps - 1)
        bx = (68 + 48 * t) * SCALE
        by = (30 + 12 * t * t) * SCALE
        br = 13.5 * (1.0 - t * 0.6) * SCALE
        # Rainbow gradient: yellow -> orange -> scarlet -> cyan tip
        if t < 0.35:
            col = (255, int(210 - t*150), 30)
        elif t < 0.75:
            col = (245, 70, 20)
        else:
            col = (30, 180, 245)
        draw_clay_sphere(img, bx, by, br, br * 0.95, col, gloss=0.55)
    # Blue eye ring
    draw_clay_sphere(img, 60*SCALE, 26*SCALE, 9*SCALE, 9*SCALE, (40, 180, 255), gloss=0.4)
    render_clay_eye(img, 60, 26, 6.2, (20, 20, 25))
    return finalize(img, W, H)

# 1.5 PIRANHA-FINCH (Streamlined torpedo body with gaping teeth!)
def build_clay_piranha_finch():
    W, H = 122, 94
    img = create_canvas(W, H)
    # Fin-like tail
    draw_clay_sphere(img, 18*SCALE, 48*SCALE, 14*SCALE, 7*SCALE, (12, 65, 110), gloss=0.35)
    draw_clay_sphere(img, 14*SCALE, 56*SCALE, 12*SCALE, 7*SCALE, (200, 35, 35), gloss=0.35)
    draw_clay_sphere(img, 52*SCALE, 75*SCALE, 8*SCALE, 5*SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 66*SCALE, 75*SCALE, 8*SCALE, 5*SCALE, (220, 110, 32), gloss=0.3)
    # Torpedo body
    draw_clay_sphere(img, 58*SCALE, 48*SCALE, 33*SCALE, 26*SCALE, (18, 115, 175), gloss=0.42)
    # Deep blood-red piranha belly
    draw_clay_sphere(img, 65*SCALE, 55*SCALE, 22*SCALE, 18*SCALE, (215, 35, 35), gloss=0.35)
    # Heavy predator jaw & beak
    render_clay_beak(img, 76, 32, 20, 9.5, (245, 225, 150))
    # Gaping white clay teeth
    for tx in [78, 83, 88]:
        draw_clay_sphere(img, tx*SCALE, 32*SCALE, 1.8*SCALE, 3.2*SCALE, (255, 255, 255), gloss=0.6)
    render_clay_eye(img, 68, 28, 6.8, (240, 180, 30), 'angry')
    return finalize(img, W, H)

# 1.6 GREAT HORNED OWL (Stout barrel chest, heart face, ear horns, nocturnal disc eyes)
def build_clay_owl():
    W, H = 114, 108
    img = create_canvas(W, H)
    draw_clay_sphere(img, 46*SCALE, 88*SCALE, 9*SCALE, 6*SCALE, (210, 145, 45), gloss=0.3)
    draw_clay_sphere(img, 68*SCALE, 88*SCALE, 9*SCALE, 6*SCALE, (210, 145, 45), gloss=0.3)
    # Barrel body
    draw_clay_sphere(img, 57*SCALE, 58*SCALE, 34*SCALE, 32*SCALE, (85, 55, 35), gloss=0.35)
    # Speckled buff breast
    draw_clay_sphere(img, 57*SCALE, 62*SCALE, 23*SCALE, 24*SCALE, (215, 195, 155), gloss=0.3)
    # Two prominent pointed clay horn tufts
    draw_clay_sphere(img, 38*SCALE, 16*SCALE, 8*SCALE, 15*SCALE, (75, 45, 28), gloss=0.35)
    draw_clay_sphere(img, 76*SCALE, 16*SCALE, 8*SCALE, 15*SCALE, (75, 45, 28), gloss=0.35)
    # Flat heart-shaped facial disk
    draw_clay_sphere(img, 47*SCALE, 34*SCALE, 15*SCALE, 15*SCALE, (230, 215, 180), gloss=0.25)
    draw_clay_sphere(img, 67*SCALE, 34*SCALE, 15*SCALE, 15*SCALE, (230, 215, 180), gloss=0.25)
    # Large nocturnal golden disc eyes
    render_clay_eye(img, 47, 34, 7.8, (255, 185, 35), 'owl')
    render_clay_eye(img, 67, 34, 7.8, (255, 185, 35), 'owl')
    # Hooked downward beak centered between eyes
    render_clay_beak(img, 57, 39, 12, 6.5, (235, 160, 40), curve=4.0)
    return finalize(img, W, H)

# 1.7 INFILTRATOR / SUSPICIOUS FINCH (Tabby cat disguised with bird wings!)
def build_clay_infiltrator():
    W, H = 118, 96
    img = create_canvas(W, H)
    # Curled orange tabby cat tail
    draw_clay_sphere(img, 18*SCALE, 44*SCALE, 8*SCALE, 18*SCALE, (230, 125, 45), gloss=0.3)
    draw_clay_sphere(img, 24*SCALE, 34*SCALE, 7*SCALE, 7*SCALE, (255, 255, 255), gloss=0.3)
    # Chubby cat loaf body
    draw_clay_sphere(img, 58*SCALE, 54*SCALE, 32*SCALE, 26*SCALE, (235, 130, 50), gloss=0.35)
    draw_clay_sphere(img, 66*SCALE, 58*SCALE, 20*SCALE, 18*SCALE, (255, 240, 225), gloss=0.28)
    # Cat Head
    draw_clay_sphere(img, 68*SCALE, 38*SCALE, 20*SCALE, 18*SCALE, (235, 130, 50), gloss=0.35)
    # Pointed triangular cat ears with pink felt centers!
    draw_clay_sphere(img, 56*SCALE, 18*SCALE, 7*SCALE, 12*SCALE, (235, 130, 50), gloss=0.35)
    draw_clay_sphere(img, 57*SCALE, 20*SCALE, 4*SCALE, 8*SCALE, (255, 165, 175), gloss=0.25)
    draw_clay_sphere(img, 76*SCALE, 18*SCALE, 7*SCALE, 12*SCALE, (235, 130, 50), gloss=0.35)
    draw_clay_sphere(img, 75*SCALE, 20*SCALE, 4*SCALE, 8*SCALE, (255, 165, 175), gloss=0.25)
    # Tiny cute beak placed over a cat muzzle
    draw_clay_sphere(img, 77*SCALE, 42*SCALE, 6*SCALE, 5*SCALE, (255, 240, 225), gloss=0.3)
    render_clay_beak(img, 81, 40, 11, 5.5, (255, 210, 60))
    # Big innocent anime cat eyes
    render_clay_eye(img, 70, 34, 6.8, (65, 180, 95))
    return finalize(img, W, H)

# 1.8 GOLDEN PHOENIX (Slender celestial bird with dramatic flame plumes)
def build_clay_phoenix():
    W, H = 138, 114
    img = create_canvas(W, H)
    # Sweeping 3-strand fire ribbon tails
    draw_clay_sphere(img, 18*SCALE, 50*SCALE, 18*SCALE, 7*SCALE, (220, 45, 45), gloss=0.4)
    draw_clay_sphere(img, 12*SCALE, 62*SCALE, 20*SCALE, 8*SCALE, (255, 110, 0), gloss=0.45)
    draw_clay_sphere(img, 10*SCALE, 74*SCALE, 22*SCALE, 9*SCALE, (255, 215, 60), gloss=0.5)
    draw_clay_sphere(img, 58*SCALE, 88*SCALE, 8*SCALE, 5*SCALE, (255, 180, 40), gloss=0.3)
    draw_clay_sphere(img, 74*SCALE, 88*SCALE, 8*SCALE, 5*SCALE, (255, 180, 40), gloss=0.3)
    # Slender fire torso
    draw_clay_sphere(img, 64*SCALE, 58*SCALE, 32*SCALE, 28*SCALE, (220, 45, 45), gloss=0.42)
    draw_clay_sphere(img, 74*SCALE, 62*SCALE, 22*SCALE, 20*SCALE, (255, 215, 65), gloss=0.4)
    # Triple fire crown plumes reaching high
    draw_clay_sphere(img, 48*SCALE, 22*SCALE, 9*SCALE, 20*SCALE, (220, 45, 45), gloss=0.45)
    draw_clay_sphere(img, 58*SCALE, 15*SCALE, 10*SCALE, 24*SCALE, (255, 110, 0), gloss=0.5)
    draw_clay_sphere(img, 68*SCALE, 10*SCALE, 9*SCALE, 26*SCALE, (255, 220, 50), gloss=0.55)
    # Sculpted gold beak & solar eye
    render_clay_beak(img, 84, 36, 24, 8.5, (255, 230, 40))
    render_clay_eye(img, 74, 34, 7.5, (255, 130, 20))
    return finalize(img, W, H)

# 1.9 NIGHTINGALE (Royal purple aristocrat with fan crown)
def build_clay_nightingale():
    W, H = 114, 98
    img = create_canvas(W, H)
    draw_clay_sphere(img, 20*SCALE, 52*SCALE, 15*SCALE, 8*SCALE, (95, 65, 145), gloss=0.35)
    draw_clay_sphere(img, 52*SCALE, 78*SCALE, 8*SCALE, 5*SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 66*SCALE, 78*SCALE, 8*SCALE, 5*SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 58*SCALE, 50*SCALE, 30*SCALE, 27*SCALE, (150, 115, 200), gloss=0.38)
    draw_clay_sphere(img, 66*SCALE, 56*SCALE, 20*SCALE, 19*SCALE, (255, 225, 240), gloss=0.3)
    # Radiating fan crest
    for ci, ca in enumerate([-18, -6, 6, 18]):
        draw_clay_sphere(img, (54 + ca)*SCALE, 18*SCALE, 6*SCALE, 14*SCALE, (120, 85, 175), gloss=0.4)
    render_clay_beak(img, 76, 32, 19, 7.5, (255, 190, 80))
    render_clay_eye(img, 67, 30, 7.2, (45, 25, 55))
    return finalize(img, W, H)

# 1.10 RAPTOR HAWK (Fierce predator with hooked beak and heavy brow)
def build_clay_hawk():
    W, H = 124, 100
    img = create_canvas(W, H)
    draw_clay_sphere(img, 22*SCALE, 50*SCALE, 16*SCALE, 9*SCALE, (55, 38, 22), gloss=0.3)
    draw_clay_sphere(img, 54*SCALE, 80*SCALE, 9*SCALE, 6*SCALE, (230, 150, 40), gloss=0.35)
    draw_clay_sphere(img, 68*SCALE, 80*SCALE, 9*SCALE, 6*SCALE, (230, 150, 40), gloss=0.35)
    draw_clay_sphere(img, 60*SCALE, 52*SCALE, 34*SCALE, 28*SCALE, (95, 65, 42), gloss=0.35)
    draw_clay_sphere(img, 68*SCALE, 58*SCALE, 22*SCALE, 20*SCALE, (235, 225, 205), gloss=0.28)
    # Heavy hooked raptor beak
    render_clay_beak(img, 78, 34, 23, 10.0, (255, 200, 50), curve=6.5)
    render_clay_eye(img, 70, 30, 7.6, (240, 180, 35), 'angry')
    return finalize(img, W, H)

# 1.11 CROW / RAVEN (Dagger beak, scruffy ruff, midnight feathers)
def build_clay_crow():
    W, H = 120, 96
    img = create_canvas(W, H)
    draw_clay_sphere(img, 20*SCALE, 50*SCALE, 16*SCALE, 8*SCALE, (22, 22, 30), gloss=0.4)
    draw_clay_sphere(img, 52*SCALE, 78*SCALE, 8*SCALE, 5*SCALE, (30, 30, 38), gloss=0.3)
    draw_clay_sphere(img, 66*SCALE, 78*SCALE, 8*SCALE, 5*SCALE, (30, 30, 38), gloss=0.3)
    draw_clay_sphere(img, 58*SCALE, 50*SCALE, 30*SCALE, 27*SCALE, (38, 38, 48), gloss=0.45)
    draw_clay_sphere(img, 66*SCALE, 54*SCALE, 19*SCALE, 18*SCALE, (58, 58, 70), gloss=0.35)
    # Long chiseled wedge beak
    render_clay_beak(img, 74, 30, 26, 9.0, (155, 155, 165))
    render_clay_eye(img, 66, 28, 6.8, (235, 235, 240))
    return finalize(img, W, H)

# 1.12 WYVERN (Draconic avian with horns and reptilian snout)
def build_clay_wyvern():
    W, H = 132, 104
    img = create_canvas(W, H)
    # Spiked dragon tail
    draw_clay_sphere(img, 18*SCALE, 54*SCALE, 16*SCALE, 8*SCALE, (30, 8, 20), gloss=0.4)
    draw_clay_sphere(img, 12*SCALE, 50*SCALE, 6*SCALE, 6*SCALE, (245, 85, 30), gloss=0.5)
    draw_clay_sphere(img, 54*SCALE, 82*SCALE, 9*SCALE, 6*SCALE, (200, 60, 25), gloss=0.35)
    draw_clay_sphere(img, 70*SCALE, 82*SCALE, 9*SCALE, 6*SCALE, (200, 60, 25), gloss=0.35)
    # Obsidian plum body
    draw_clay_sphere(img, 62*SCALE, 54*SCALE, 34*SCALE, 29*SCALE, (55, 20, 36), gloss=0.45)
    draw_clay_sphere(img, 70*SCALE, 60*SCALE, 22*SCALE, 20*SCALE, (215, 65, 20), gloss=0.4)
    # Two backward curved horns
    draw_clay_sphere(img, 46*SCALE, 16*SCALE, 7*SCALE, 17*SCALE, (245, 225, 185), gloss=0.55)
    draw_clay_sphere(img, 62*SCALE, 14*SCALE, 7*SCALE, 18*SCALE, (245, 225, 185), gloss=0.55)
    # Reptilian muzzle
    render_clay_beak(img, 78, 36, 25, 11.0, (245, 75, 25))
    render_clay_eye(img, 70, 32, 7.2, (255, 220, 40), 'angry')
    return finalize(img, W, H)

# Render and save each uniquely shaped bird
unique_builders = {
    'sparrow': build_clay_sparrow,
    'canary': build_clay_canary,
    'mama': build_clay_mama,
    'toucan': build_clay_toucan,
    'piranha_finch': build_clay_piranha_finch,
    'owl': build_clay_owl,
    'infiltrator': build_clay_infiltrator,
    'phoenix': build_clay_phoenix,
    'nightingale': build_clay_nightingale,
    'hawk': build_clay_hawk,
    'crow': build_clay_crow,
    'wyvern': build_clay_wyvern,
}

for key, builder in unique_builders.items():
    b_img = builder()
    for s in [0, 1, 2]:
        save_sprite(f'bird_{key}_{s}.png', b_img)
    save_sprite(f'bird_{key}.png', b_img)

print("Rendered all 12 radically unique 3D clay bird models!")

# ==============================================================================
# 2. ALL HELPER COMPANIONS (100% 3D Clay Toy Style)
# ==============================================================================
# Snail, Frog, Hedgehog, Squirrel already rendered. Let's render the rest:
# 2.1 Mole (Rocky: mining helmet with lamp)
def render_clay_mole():
    W, H = 68, 48
    img = create_canvas(W, H)
    draw_clay_sphere(img, 32*SCALE, 28*SCALE, 20*SCALE, 15*SCALE, (65, 45, 35), gloss=0.3)
    draw_clay_sphere(img, 50*SCALE, 30*SCALE, 10*SCALE, 8*SCALE, (245, 175, 170), gloss=0.25)
    # Miner yellow safety helmet with light
    draw_clay_sphere(img, 32*SCALE, 14*SCALE, 14*SCALE, 9*SCALE, (255, 215, 40), gloss=0.6)
    draw_clay_sphere(img, 42*SCALE, 14*SCALE, 4*SCALE, 4*SCALE, (255, 255, 200), gloss=0.9)
    render_clay_eye(img, 44, 25, 3.5, (20, 20, 20))
    return finalize(img, W, H)

# 2.2 Hound (Bramble: floppy-eared loyal companion)
def render_clay_hound():
    W, H = 84, 60
    img = create_canvas(W, H)
    draw_clay_sphere(img, 38*SCALE, 36*SCALE, 26*SCALE, 17*SCALE, (185, 125, 65), gloss=0.35)
    draw_clay_sphere(img, 42*SCALE, 40*SCALE, 18*SCALE, 11*SCALE, (255, 245, 230), gloss=0.25)
    # Head & muzzle
    draw_clay_sphere(img, 62*SCALE, 26*SCALE, 14*SCALE, 13*SCALE, (185, 125, 65), gloss=0.35)
    draw_clay_sphere(img, 72*SCALE, 30*SCALE, 9*SCALE, 8*SCALE, (255, 245, 230), gloss=0.25)
    draw_clay_sphere(img, 78*SCALE, 28*SCALE, 4*SCALE, 4*SCALE, (20, 20, 20), gloss=0.8)
    # Droopy hound ear
    draw_clay_sphere(img, 56*SCALE, 28*SCALE, 6*SCALE, 14*SCALE, (135, 85, 40), gloss=0.3)
    render_clay_eye(img, 64, 22, 4.2, (30, 20, 15))
    return finalize(img, W, H)

# 2.3 Hummingbird (Zephyr: needle beak and emerald iridescent clay)
def render_clay_hummingbird():
    W, H = 64, 50
    img = create_canvas(W, H)
    draw_clay_sphere(img, 28*SCALE, 28*SCALE, 14*SCALE, 12*SCALE, (40, 175, 110), gloss=0.55)
    draw_clay_sphere(img, 34*SCALE, 32*SCALE, 9*SCALE, 8*SCALE, (245, 245, 250), gloss=0.3)
    # Magenta throat
    draw_clay_sphere(img, 38*SCALE, 26*SCALE, 7*SCALE, 7*SCALE, (235, 45, 135), gloss=0.6)
    # Needle beak
    render_clay_beak(img, 42, 24, 18, 2.5, (30, 30, 35))
    render_clay_eye(img, 36, 20, 3.8, (20, 20, 20))
    return finalize(img, W, H)

# 2.4 Firefly (Sparky: glowing yellow bulb)
def render_clay_firefly():
    W, H = 56, 44
    img = create_canvas(W, H)
    # Glowing yellow clay abdomen
    draw_clay_sphere(img, 20*SCALE, 22*SCALE, 14*SCALE, 12*SCALE, (255, 240, 80), gloss=0.85)
    # Head & thorax
    draw_clay_sphere(img, 36*SCALE, 22*SCALE, 9*SCALE, 9*SCALE, (40, 42, 48), gloss=0.45)
    draw_clay_sphere(img, 46*SCALE, 22*SCALE, 7*SCALE, 7*SCALE, (25, 26, 30), gloss=0.5)
    render_clay_eye(img, 44, 18, 3.5, (255, 180, 40))
    return finalize(img, W, H)

# 2.5 Porcupine (Bristle: ball of clay with quills)
def render_clay_porcupine():
    W, H = 78, 50
    img = create_canvas(W, H)
    draw_clay_sphere(img, 36*SCALE, 28*SCALE, 24*SCALE, 16*SCALE, (85, 60, 45), gloss=0.3)
    # Radiating quills
    for qx, qy in [(20, 16), (28, 12), (38, 10), (48, 12)]:
        draw_clay_sphere(img, qx*SCALE, qy*SCALE, 3*SCALE, 8*SCALE, (245, 235, 210), gloss=0.4)
    draw_clay_sphere(img, 58*SCALE, 32*SCALE, 12*SCALE, 9*SCALE, (215, 180, 145), gloss=0.25)
    draw_clay_sphere(img, 68*SCALE, 32*SCALE, 4*SCALE, 4*SCALE, (25, 20, 20), gloss=0.7)
    render_clay_eye(img, 60, 27, 4.0, (20, 20, 20))
    return finalize(img, W, H)

# 2.6 Quail (Flora: teardrop plume on head)
def render_clay_quail():
    W, H = 68, 58
    img = create_canvas(W, H)
    draw_clay_sphere(img, 32*SCALE, 36*SCALE, 18*SCALE, 16*SCALE, (135, 95, 65), gloss=0.35)
    draw_clay_sphere(img, 36*SCALE, 40*SCALE, 13*SCALE, 12*SCALE, (240, 220, 190), gloss=0.25)
    # Quail teardrop topknot plume!
    draw_clay_sphere(img, 40*SCALE, 14*SCALE, 4*SCALE, 8*SCALE, (30, 30, 35), gloss=0.5)
    render_clay_beak(img, 48, 28, 11, 5.0, (245, 175, 45))
    render_clay_eye(img, 42, 26, 4.5, (20, 20, 20))
    return finalize(img, W, H)

# 2.7 Magpie (Grimm: holding stolen loot bag)
def render_clay_magpie():
    W, H = 76, 64
    img = create_canvas(W, H)
    draw_clay_sphere(img, 34*SCALE, 36*SCALE, 18*SCALE, 16*SCALE, (30, 32, 40), gloss=0.4)
    draw_clay_sphere(img, 38*SCALE, 40*SCALE, 12*SCALE, 12*SCALE, (250, 250, 255), gloss=0.3)
    # Stolen loot bag in beak!
    draw_clay_sphere(img, 60*SCALE, 40*SCALE, 8*SCALE, 10*SCALE, (185, 125, 60), gloss=0.35)
    render_clay_beak(img, 48, 28, 14, 6.0, (80, 85, 95))
    render_clay_eye(img, 44, 25, 4.2, (245, 245, 250))
    return finalize(img, W, H)

# 2.8 Chameleon (Echo: coiled tail and hooded eyes)
def render_clay_chameleon():
    W, H = 68, 48
    img = create_canvas(W, H)
    # Swirled tail
    draw_clay_sphere(img, 18*SCALE, 28*SCALE, 10*SCALE, 10*SCALE, (65, 195, 85), gloss=0.4)
    draw_clay_sphere(img, 38*SCALE, 26*SCALE, 18*SCALE, 13*SCALE, (65, 195, 85), gloss=0.4)
    # Turret eye dome
    draw_clay_sphere(img, 48*SCALE, 20*SCALE, 7*SCALE, 7*SCALE, (65, 195, 85), gloss=0.4)
    render_clay_eye(img, 48, 20, 3.5, (25, 25, 25))
    return finalize(img, W, H)

save_sprite('pet_mole.png', render_clay_mole())
save_sprite('pet_hound.png', render_clay_hound())
save_sprite('pet_hummingbird.png', render_clay_hummingbird())
save_sprite('pet_firefly.png', render_clay_firefly())
save_sprite('pet_porcupine.png', render_clay_porcupine())
save_sprite('pet_quail.png', render_clay_quail())
save_sprite('pet_magpie.png', render_clay_magpie())
save_sprite('pet_chameleon.png', render_clay_chameleon())
print("Rendered all helper companions!")

# ==============================================================================
# 3. WEAPONS & EQUIPMENT (3D Toy Figurine Arsenal)
# ==============================================================================
def render_clay_slingshot():
    W, H = 32, 40
    img = create_canvas(W, H)
    # Wooden Y-fork
    draw_clay_sphere(img, 16*SCALE, 30*SCALE, 5*SCALE, 10*SCALE, (135, 85, 40), gloss=0.35)
    draw_clay_sphere(img, 8*SCALE, 14*SCALE, 4*SCALE, 10*SCALE, (135, 85, 40), gloss=0.35)
    draw_clay_sphere(img, 24*SCALE, 14*SCALE, 4*SCALE, 10*SCALE, (135, 85, 40), gloss=0.35)
    # Red rubber band & pouch
    d = ImageDraw.Draw(img)
    d.line([(8*SCALE, 10*SCALE), (16*SCALE, 18*SCALE), (24*SCALE, 10*SCALE)], fill=(235, 45, 45, 255), width=int(2.4*SCALE))
    draw_clay_sphere(img, 16*SCALE, 18*SCALE, 3.5*SCALE, 3.5*SCALE, (185, 125, 60), gloss=0.3)
    return finalize(img, W, H)

def render_clay_bow():
    W, H = 36, 36
    img = create_canvas(W, H)
    # Curved wooden bow
    for bi in range(12):
        t = bi / 11.0
        bx = (12 + 10 * math.sin(t * math.pi)) * SCALE
        by = (4 + 28 * t) * SCALE
        draw_clay_sphere(img, bx, by, 3.5*SCALE, 3.5*SCALE, (145, 90, 45), gloss=0.4)
    # String
    d = ImageDraw.Draw(img)
    d.line([(12*SCALE, 4*SCALE), (12*SCALE, 32*SCALE)], fill=(245, 245, 250, 230), width=int(1.5*SCALE))
    return finalize(img, W, H)

def render_clay_laser():
    W, H = 40, 28
    img = create_canvas(W, H)
    # Retro sci-fi raygun
    draw_clay_sphere(img, 14*SCALE, 20*SCALE, 5*SCALE, 7*SCALE, (40, 45, 55), gloss=0.4)
    draw_clay_sphere(img, 22*SCALE, 12*SCALE, 12*SCALE, 8*SCALE, (235, 240, 245), gloss=0.6)
    # Emitter rings
    draw_clay_sphere(img, 32*SCALE, 12*SCALE, 4*SCALE, 7*SCALE, (40, 195, 255), gloss=0.8)
    draw_clay_sphere(img, 37*SCALE, 12*SCALE, 3*SCALE, 5*SCALE, (40, 195, 255), gloss=0.9)
    return finalize(img, W, H)

def render_clay_potion():
    W, H = 26, 34
    img = create_canvas(W, H)
    # Glass flask
    draw_clay_sphere(img, 13*SCALE, 22*SCALE, 11*SCALE, 11*SCALE, (235, 45, 140), gloss=0.85)
    draw_clay_sphere(img, 13*SCALE, 10*SCALE, 5*SCALE, 5*SCALE, (240, 245, 255), gloss=0.8)
    # Cork
    draw_clay_sphere(img, 13*SCALE, 5*SCALE, 4*SCALE, 3*SCALE, (185, 125, 70), gloss=0.3)
    return finalize(img, W, H)

save_sprite('slingshot.png', render_clay_slingshot())
save_sprite('weapon_slingshot.png', render_clay_slingshot())
save_sprite('weapon_bow.png', render_clay_bow())
save_sprite('weapon_laser.png', render_clay_laser())
save_sprite('potion.png', render_clay_potion())
print("Rendered all clay weapons and potions!")

# ==============================================================================
# 4. Generate Comprehensive Transformation Showcase Card
# ==============================================================================
cw, ch = 1000, 680
showcase = Image.new('RGBA', (cw, ch), (22, 28, 40, 255))
sdraw = ImageDraw.Draw(showcase)
sdraw.rounded_rectangle([12, 12, cw - 12, ch - 12], radius=16, fill=(28, 36, 52, 255), outline=(58, 80, 116, 255), width=2)

sdraw.text((36, 24), "12 RADICALLY UNIQUE 3D CLAY BIRD SPECIES (CUSTOM ANATOMY & SHAPES)", fill=(255, 215, 60, 255))
sdraw.text((36, 48), "Each bird now has its own unique silhouette, posture, bill, crest, and personality in 3D clay!", fill=(175, 200, 225, 255))

row1_birds = [
    ("Songbird", "bird_sparrow.png"),
    ("Yellow Canary", "bird_canary.png"),
    ("Mama Dove", "bird_mama.png"),
    ("Rainbow Toucan", "bird_toucan.png"),
    ("Piranha-Finch", "bird_piranha_finch.png"),
    ("Horned Owl", "bird_owl.png"),
]
for i, (name, fname) in enumerate(row1_birds):
    x = 42 + i * 158
    y = 80
    im = Image.open(os.path.join(out_public, fname)).resize((72, 60), Image.Resampling.LANCZOS)
    sdraw.ellipse([x + 6, y + 48, x + 66, y + 62], fill=(12, 16, 24, 160))
    showcase.paste(im, (x, y), mask=im)
    sdraw.text((x + 36 - len(name)*3.4, y + 66), name, fill=(230, 240, 255, 255))

row2_birds = [
    ("Suspicious Finch", "bird_infiltrator.png"),
    ("Golden Phoenix", "bird_phoenix.png"),
    ("Nightingale", "bird_nightingale.png"),
    ("Raptor Hawk", "bird_hawk.png"),
    ("Raven Crow", "bird_crow.png"),
    ("Apex Wyvern", "bird_wyvern.png"),
]
for i, (name, fname) in enumerate(row2_birds):
    x = 42 + i * 158
    y = 175
    im = Image.open(os.path.join(out_public, fname)).resize((72, 60), Image.Resampling.LANCZOS)
    sdraw.ellipse([x + 6, y + 48, x + 66, y + 62], fill=(12, 16, 24, 160))
    showcase.paste(im, (x, y), mask=im)
    sdraw.text((x + 36 - len(name)*3.4, y + 66), name, fill=(230, 240, 255, 255))

sdraw.line([(36, 275), (cw - 36, 275)], fill=(50, 70, 100, 255), width=2)
sdraw.text((36, 288), "🐾 NEW 3D CLAY COMPANION PETS & PREDATORS", fill=(120, 240, 180, 255))

pets_show = [
    ("Rocky Mole", "pet_mole.png", 62, 44),
    ("Bramble Hound", "pet_hound.png", 64, 46),
    ("Zephyr Hummingbird", "pet_hummingbird.png", 58, 45),
    ("Sparky Firefly", "pet_firefly.png", 52, 40),
    ("Bristle Porcupine", "pet_porcupine.png", 62, 40),
    ("Flora Quail", "pet_quail.png", 56, 48),
]
for i, (name, fname, pw, ph) in enumerate(pets_show):
    x = 42 + i * 158
    y = 320
    im = Image.open(os.path.join(out_public, fname)).resize((pw, ph), Image.Resampling.LANCZOS)
    sdraw.ellipse([x + 6, y + 42, x + 66, y + 54], fill=(12, 16, 24, 160))
    showcase.paste(im, (x + (72 - pw)//2, y + (46 - ph)//2), mask=im)
    sdraw.text((x + 36 - len(name)*3.4, y + 56), name, fill=(230, 240, 255, 255))

sdraw.line([(36, 415), (cw - 36, 415)], fill=(50, 70, 100, 255), width=2)
sdraw.text((36, 428), "🪙 3D TOY WEAPONS, DROPS & EQUIPMENT", fill=(255, 180, 80, 255))

arsenal_show = [
    ("Toy Slingshot", "slingshot.png", 32, 40),
    ("Recurve Bow", "weapon_bow.png", 36, 36),
    ("Sci-Fi Raygun", "weapon_laser.png", 40, 28),
    ("Magic Potion", "potion.png", 28, 36),
    ("Molded Chest", "chest.png", 42, 34),
    ("Diamond Gem", "gem_diamond.png", 32, 32),
]
for i, (name, fname, aw, ah) in enumerate(arsenal_show):
    x = 42 + i * 158
    y = 465
    im = Image.open(os.path.join(out_public, fname)).resize((aw, ah), Image.Resampling.LANCZOS)
    sdraw.ellipse([x + 6, y + 36, x + 66, y + 48], fill=(12, 16, 24, 160))
    showcase.paste(im, (x + (72 - aw)//2, y + (40 - ah)//2), mask=im)
    sdraw.text((x + 36 - len(name)*3.4, y + 52), name, fill=(230, 240, 255, 255))

sdraw.line([(36, 560), (cw - 36, 560)], fill=(50, 70, 100, 255), width=2)
sdraw.text((45, 580), "✨ 100% UNIQUE SILHOUETTES & UNIFIED 3D CLAY AESTHETIC", fill=(255, 225, 95, 255))
sdraw.text((45, 605), "• Owls have barrel chests & disc eyes | Toucans have massive banana bills | Piranhas have gaping teeth", fill=(185, 210, 235, 255))
sdraw.text((45, 625), "• Cats have triangular ears & tails | Phoenixes have flowing flame ribbons | Wyverns have curved horns", fill=(185, 210, 235, 255))

card_path = '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/unique_clay_universe_showcase.png'
showcase.save(card_path)
print(f"Artifact showcase saved to {card_path}")
