import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCALE = 4  # 4x supersampling for ultra-crisp antialiasing

def create_canvas(w, h):
    return Image.new('RGBA', (w * SCALE, h * SCALE), (0, 0, 0, 0))

def finalize(img, target_w, target_h):
    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)

def draw_clay_sphere(draw, cx, cy, rx, ry, base_rgb, key_light=(-0.4, -0.6), gloss=0.35):
    """
    Renders a soft, tactile 3D clay sphere/ellipsoid with studio lighting:
    - Base diffuse color
    - Diffuse key light
    - Soft ambient occlusion / shadow rim
    - Ambient bounce fill on underside
    - Soft clay specular sheen
    """
    x0 = int(cx - rx)
    x1 = int(cx + rx) + 1
    y0 = int(cy - ry)
    y1 = int(cy + ry) + 1
    
    lx, ly = key_light
    l_mag = math.sqrt(lx*lx + ly*ly + 1.0)
    lx, ly, lz = lx / l_mag, ly / l_mag, 1.0 / l_mag

    # Create bounding box grid
    ys, xs = np.mgrid[y0:y1, x0:x1]
    dx = (xs - cx) / rx
    dy = (ys - cy) / ry
    dist_sq = dx*dx + dy*dy
    mask = dist_sq <= 1.0

    if not np.any(mask):
        return

    # Surface normal: nz = sqrt(1 - dx^2 - dy^2)
    nz = np.sqrt(np.maximum(0.0, 1.0 - dist_sq))
    nx = dx
    ny = dy

    # Diffuse lighting (N dot L)
    dot = nx * lx + ny * ly + nz * lz
    diffuse = np.clip(dot, 0.0, 1.0)

    # Ambient occlusion towards edges
    ao = np.power(nz, 0.45)

    # Bounce light from bottom (soft sky/floor reflection)
    bounce = np.clip(-ny * 0.5 + 0.3, 0.0, 1.0) * (1.0 - diffuse) * 0.25

    # Total illumination
    light = 0.28 + 0.65 * diffuse * ao + bounce
    light = np.clip(light, 0.15, 1.35)

    # Base colors
    r0, g0, b0 = base_rgb
    r_arr = np.clip(r0 * light, 0, 255).astype(np.uint8)
    g_arr = np.clip(g0 * light, 0, 255).astype(np.uint8)
    b_arr = np.clip(b0 * light, 0, 255).astype(np.uint8)

    # Specular clay sheen (Blinn-Phong)
    # Halfway vector H between L and View (0, 0, 1)
    hx = lx
    hy = ly
    hz = lz + 1.0
    h_mag = math.sqrt(hx*hx + hy*hy + hz*hz)
    hx, hy, hz = hx / h_mag, hy / h_mag, hz / h_mag
    ndoth = np.maximum(0.0, nx * hx + ny * hy + nz * hz)
    spec = np.power(ndoth, 14.0) * gloss * ao

    r_arr = np.clip(r_arr + spec * 255, 0, 255).astype(np.uint8)
    g_arr = np.clip(g_arr + spec * 255, 0, 255).astype(np.uint8)
    b_arr = np.clip(b_arr + spec * 255, 0, 255).astype(np.uint8)

    # Alpha mask with slight edge feathering for smooth clay boundary
    alpha = np.clip((1.0 - dist_sq) * rx * 1.5, 0.0, 1.0) * 255.0
    a_arr = (alpha * mask).astype(np.uint8)

    # Composite into PIL Image
    patch = np.dstack((r_arr, g_arr, b_arr, a_arr))
    patch_img = Image.fromarray(patch, 'RGBA')
    draw.paste(patch_img, (x0, y0), patch_img)

def render_clay_eye(img, cx, cy, radius):
    """Glossy molded toy bead eye"""
    r = radius * SCALE
    x = cx * SCALE
    y = cy * SCALE
    
    # Soft clay eye socket indentation
    draw_clay_sphere(img, x, y, r * 1.25, r * 1.25, (16, 26, 24), gloss=0.1)
    
    # Main dark glossy bead
    draw_clay_sphere(img, x, y, r, r, (22, 18, 16), gloss=0.8)
    
    d = ImageDraw.Draw(img)
    # Primary crisp white specular catchlight
    shr = r * 0.35
    shx = x - r * 0.28
    shy = y - r * 0.30
    d.ellipse([shx - shr, shy - shr, shx + shr, shy + shr], fill=(255, 255, 255, 255))
    
    # Secondary ambient glint
    shr2 = r * 0.18
    shx2 = x + r * 0.32
    shy2 = y + r * 0.32
    d.ellipse([shx2 - shr2, shy2 - shr2, shx2 + shr2, shy2 + shr2], fill=(255, 255, 255, 190))

def render_clay_beak(draw, bx, by, length, thickness, base_rgb=(255, 170, 30)):
    """Smooth molded clay beak with soft rounded tip and 3D volume"""
    steps = 14
    for i in range(steps):
        t = i / float(steps - 1)
        cur_x = (bx + length * t) * SCALE
        cur_y = by * SCALE
        cur_r = thickness * (1.0 - t * 0.65) * SCALE
        col = (
            int(base_rgb[0] * (1.0 - t * 0.15)),
            int(base_rgb[1] * (1.0 - t * 0.12)),
            int(base_rgb[2] * (1.0 - t * 0.10)),
        )
        draw_clay_sphere(draw, cur_x, cur_y, cur_r, cur_r * 0.9, col, gloss=0.45)

# Palette: Tactile Clay / Stylized Toy (Teal Plumage, Warm Apricot/Custard Belly, Coral Plumage)
CLAY_TEAL = (38, 142, 132)
CLAY_TEAL_DARK = (24, 96, 90)
CLAY_BELLY = (255, 196, 92)
CLAY_BELLY_WARM = (245, 150, 48)
CLAY_CORAL = (245, 102, 78)
CLAY_CORAL_DARK = (185, 70, 52)
CLAY_GOLD = (255, 215, 60)

# ==============================================================================
# STAGE 0: CHICK (CLAY BABY PUFFBALL)
# ==============================================================================
def render_clay_chick_body():
    W, H = 84, 76
    img = create_canvas(W, H)
    
    # 1. Sculpted clay tail nub
    draw_clay_sphere(img, 24 * SCALE, 47 * SCALE, 10 * SCALE, 8 * SCALE, CLAY_CORAL, gloss=0.25)
    draw_clay_sphere(img, 22 * SCALE, 52 * SCALE, 9 * SCALE, 7 * SCALE, CLAY_TEAL_DARK, gloss=0.25)

    # 2. Plump chubby clay feet nubs
    draw_clay_sphere(img, 38 * SCALE, 62 * SCALE, 6 * SCALE, 4 * SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 48 * SCALE, 62 * SCALE, 6 * SCALE, 4 * SCALE, (220, 110, 32), gloss=0.3)

    # 3. Main Volumetric Clay Body (plump round egg)
    draw_clay_sphere(img, 44 * SCALE, 40 * SCALE, 22 * SCALE, 21 * SCALE, CLAY_TEAL, gloss=0.35)

    # 4. Cute molded crest knob
    draw_clay_sphere(img, 36 * SCALE, 18 * SCALE, 6 * SCALE, 8 * SCALE, CLAY_TEAL, gloss=0.35)
    draw_clay_sphere(img, 40 * SCALE, 16 * SCALE, 5 * SCALE, 7 * SCALE, CLAY_GOLD, gloss=0.4)

    # 5. Soft molded custard clay belly
    draw_clay_sphere(img, 48 * SCALE, 45 * SCALE, 14 * SCALE, 13 * SCALE, CLAY_BELLY, gloss=0.3)

    # 6. Soft rosy cheek blush patch
    draw_clay_sphere(img, 52 * SCALE, 37 * SCALE, 7 * SCALE, 6 * SCALE, (245, 120, 95), gloss=0.15)

    # 7. Molded Beak & Glossy Bead Eye
    render_clay_beak(img, 58, 32, 14, 6.5, (255, 175, 35))
    render_clay_eye(img, 52, 31, 6.2)

    return finalize(img, W, H)

def render_clay_chick_wing_front():
    W, H = 32, 24
    img = create_canvas(W, H)
    # Layered clay wing feathers
    draw_clay_sphere(img, 20 * SCALE, 14 * SCALE, 9 * SCALE, 7 * SCALE, CLAY_CORAL, gloss=0.35)
    draw_clay_sphere(img, 17 * SCALE, 17 * SCALE, 8 * SCALE, 6 * SCALE, CLAY_GOLD, gloss=0.35)
    draw_clay_sphere(img, 10 * SCALE, 10 * SCALE, 9 * SCALE, 8 * SCALE, CLAY_TEAL, gloss=0.4)
    return finalize(img, W, H)

def render_clay_chick_wing_back():
    W, H = 32, 24
    img = create_canvas(W, H)
    # Slightly darker tone for depth perspective
    draw_clay_sphere(img, 20 * SCALE, 14 * SCALE, 9 * SCALE, 7 * SCALE, CLAY_CORAL_DARK, gloss=0.25)
    draw_clay_sphere(img, 17 * SCALE, 17 * SCALE, 8 * SCALE, 6 * SCALE, (200, 160, 45), gloss=0.25)
    draw_clay_sphere(img, 10 * SCALE, 10 * SCALE, 9 * SCALE, 8 * SCALE, CLAY_TEAL_DARK, gloss=0.25)
    return finalize(img, W, H)

# ==============================================================================
# STAGE 1: FLEDGLING (CLAY JUVENILE BIRD)
# ==============================================================================
def render_clay_fledgling_body():
    W, H = 96, 84
    img = create_canvas(W, H)

    # Sculpted tail feathers
    draw_clay_sphere(img, 24 * SCALE, 52 * SCALE, 13 * SCALE, 7 * SCALE, CLAY_CORAL, gloss=0.3)
    draw_clay_sphere(img, 20 * SCALE, 58 * SCALE, 12 * SCALE, 7 * SCALE, CLAY_TEAL_DARK, gloss=0.3)

    # Claws
    draw_clay_sphere(img, 42 * SCALE, 68 * SCALE, 7 * SCALE, 5 * SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 54 * SCALE, 68 * SCALE, 7 * SCALE, 5 * SCALE, (220, 110, 32), gloss=0.3)

    # Torso
    draw_clay_sphere(img, 50 * SCALE, 44 * SCALE, 26 * SCALE, 24 * SCALE, CLAY_TEAL, gloss=0.35)

    # Double crest
    draw_clay_sphere(img, 40 * SCALE, 18 * SCALE, 7 * SCALE, 11 * SCALE, CLAY_TEAL, gloss=0.35)
    draw_clay_sphere(img, 46 * SCALE, 15 * SCALE, 7 * SCALE, 12 * SCALE, CLAY_GOLD, gloss=0.4)

    # Layered clay breast
    draw_clay_sphere(img, 56 * SCALE, 49 * SCALE, 17 * SCALE, 16 * SCALE, CLAY_BELLY, gloss=0.3)

    # Coral eye mask patch
    draw_clay_sphere(img, 57 * SCALE, 33 * SCALE, 11 * SCALE, 9 * SCALE, CLAY_CORAL, gloss=0.25)

    # Beak & Eye
    render_clay_beak(img, 66, 28, 17, 7.2, (255, 175, 35))
    render_clay_eye(img, 58, 28, 6.8)

    return finalize(img, W, H)

def render_clay_fledgling_wing_front():
    W, H = 38, 26
    img = create_canvas(W, H)
    draw_clay_sphere(img, 25 * SCALE, 13 * SCALE, 11 * SCALE, 7 * SCALE, CLAY_CORAL, gloss=0.35)
    draw_clay_sphere(img, 22 * SCALE, 17 * SCALE, 10 * SCALE, 6 * SCALE, (250, 135, 75), gloss=0.35)
    draw_clay_sphere(img, 18 * SCALE, 20 * SCALE, 9 * SCALE, 6 * SCALE, CLAY_GOLD, gloss=0.35)
    draw_clay_sphere(img, 12 * SCALE, 11 * SCALE, 11 * SCALE, 9 * SCALE, CLAY_TEAL, gloss=0.4)
    return finalize(img, W, H)

def render_clay_fledgling_wing_back():
    W, H = 38, 26
    img = create_canvas(W, H)
    draw_clay_sphere(img, 25 * SCALE, 13 * SCALE, 11 * SCALE, 7 * SCALE, CLAY_CORAL_DARK, gloss=0.25)
    draw_clay_sphere(img, 22 * SCALE, 17 * SCALE, 10 * SCALE, 6 * SCALE, (190, 95, 55), gloss=0.25)
    draw_clay_sphere(img, 18 * SCALE, 20 * SCALE, 9 * SCALE, 6 * SCALE, (200, 160, 45), gloss=0.25)
    draw_clay_sphere(img, 12 * SCALE, 11 * SCALE, 11 * SCALE, 9 * SCALE, CLAY_TEAL_DARK, gloss=0.25)
    return finalize(img, W, H)

# ==============================================================================
# STAGE 2 / 3: ADULT & KING (CLAY MASTER SONGBIRD)
# ==============================================================================
def render_clay_adult_body():
    W, H = 118, 98
    img = create_canvas(W, H)

    # Curved clay tail plumes
    draw_clay_sphere(img, 24 * SCALE, 50 * SCALE, 16 * SCALE, 8 * SCALE, CLAY_CORAL, gloss=0.35)
    draw_clay_sphere(img, 18 * SCALE, 56 * SCALE, 14 * SCALE, 7 * SCALE, CLAY_GOLD, gloss=0.35)
    draw_clay_sphere(img, 16 * SCALE, 64 * SCALE, 15 * SCALE, 8 * SCALE, CLAY_TEAL_DARK, gloss=0.3)

    # Claws
    draw_clay_sphere(img, 52 * SCALE, 79 * SCALE, 8 * SCALE, 5 * SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(img, 66 * SCALE, 79 * SCALE, 8 * SCALE, 5 * SCALE, (220, 110, 32), gloss=0.3)

    # Main Torso
    draw_clay_sphere(img, 60 * SCALE, 52 * SCALE, 32 * SCALE, 29 * SCALE, CLAY_TEAL, gloss=0.38)

    # Sweeping clay crown plumes
    draw_clay_sphere(img, 46 * SCALE, 21 * SCALE, 9 * SCALE, 15 * SCALE, CLAY_TEAL, gloss=0.35)
    draw_clay_sphere(img, 54 * SCALE, 16 * SCALE, 9 * SCALE, 17 * SCALE, CLAY_CORAL, gloss=0.38)
    draw_clay_sphere(img, 62 * SCALE, 13 * SCALE, 8 * SCALE, 16 * SCALE, CLAY_GOLD, gloss=0.42)

    # Sculpted Golden Breast
    draw_clay_sphere(img, 68 * SCALE, 58 * SCALE, 21 * SCALE, 20 * SCALE, CLAY_BELLY, gloss=0.32)

    # Coral Eye Mask
    draw_clay_sphere(img, 68 * SCALE, 38 * SCALE, 13 * SCALE, 10 * SCALE, CLAY_CORAL, gloss=0.28)

    # Beak & Eye
    render_clay_beak(img, 78, 32, 21, 8.5, (255, 175, 35))
    render_clay_eye(img, 69, 32, 7.6)

    return finalize(img, W, H)

def render_clay_adult_wing_front():
    W, H = 48, 30
    img = create_canvas(W, H)
    # Sculpted clay feathers
    draw_clay_sphere(img, 32 * SCALE, 14 * SCALE, 14 * SCALE, 8 * SCALE, CLAY_CORAL, gloss=0.38)
    draw_clay_sphere(img, 28 * SCALE, 19 * SCALE, 13 * SCALE, 7 * SCALE, (252, 138, 88), gloss=0.38)
    draw_clay_sphere(img, 24 * SCALE, 23 * SCALE, 12 * SCALE, 7 * SCALE, (255, 185, 95), gloss=0.38)
    draw_clay_sphere(img, 19 * SCALE, 26 * SCALE, 10 * SCALE, 6 * SCALE, CLAY_GOLD, gloss=0.40)
    # Clay covert cap
    draw_clay_sphere(img, 15 * SCALE, 13 * SCALE, 13 * SCALE, 11 * SCALE, CLAY_TEAL, gloss=0.42)
    return finalize(img, W, H)

def render_clay_adult_wing_back():
    W, H = 48, 30
    img = create_canvas(W, H)
    draw_clay_sphere(img, 32 * SCALE, 14 * SCALE, 14 * SCALE, 8 * SCALE, CLAY_CORAL_DARK, gloss=0.25)
    draw_clay_sphere(img, 28 * SCALE, 19 * SCALE, 13 * SCALE, 7 * SCALE, (190, 95, 55), gloss=0.25)
    draw_clay_sphere(img, 24 * SCALE, 23 * SCALE, 12 * SCALE, 7 * SCALE, (195, 135, 65), gloss=0.25)
    draw_clay_sphere(img, 19 * SCALE, 26 * SCALE, 10 * SCALE, 6 * SCALE, (200, 160, 45), gloss=0.25)
    draw_clay_sphere(img, 15 * SCALE, 13 * SCALE, 13 * SCALE, 11 * SCALE, CLAY_TEAL_DARK, gloss=0.25)
    return finalize(img, W, H)

# ==============================================================================
# Generate assets and write preview showcase
# ==============================================================================
out_public = '/Volumes/GameDrive/insaterrarium/public/sprites'
out_src = '/Volumes/GameDrive/insaterrarium/src/assets/sprites'
os.makedirs(out_public, exist_ok=True)
os.makedirs(out_src, exist_ok=True)

b0 = render_clay_chick_body()
w0_f = render_clay_chick_wing_front()
w0_b = render_clay_chick_wing_back()

b1 = render_clay_fledgling_body()
w1_f = render_clay_fledgling_wing_front()
w1_b = render_clay_fledgling_wing_back()

b2 = render_clay_adult_body()
w2_f = render_clay_adult_wing_front()
w2_b = render_clay_adult_wing_back()

sprites = {
    'bird_sparrow_0.png': b0,
    'wing_sparrow_0.png': w0_f,
    'wing_back_sparrow_0.png': w0_b,
    'bird_sparrow_1.png': b1,
    'wing_sparrow_1.png': w1_f,
    'wing_back_sparrow_1.png': w1_b,
    'bird_sparrow_2.png': b2,
    'wing_sparrow_2.png': w2_f,
    'wing_back_sparrow_2.png': w2_b,
    'bird_sparrow.png': b2,
    'wing_sparrow.png': w2_f,
    'wing_back_sparrow.png': w2_b,
}

for name, im in sprites.items():
    im.save(os.path.join(out_public, name))
    im.save(os.path.join(out_src, name))

print("Rendered and saved all Volumetric 3D Clay Bird assets!")

# Generate high quality preview card
cw, ch = 960, 520
showcase = Image.new('RGBA', (cw, ch), (22, 28, 40, 255))
sdraw = ImageDraw.Draw(showcase)

sdraw.rounded_rectangle([12, 12, cw - 12, ch - 12], radius=16, fill=(28, 36, 52, 255), outline=(58, 80, 116, 255), width=2)
sdraw.text((36, 30), "VOLUMETRIC 3D CLAYMATION & STYLIZED TOY BIRD DESIGN", fill=(255, 215, 60, 255))
sdraw.text((36, 54), "Soft clay curvature • Studio lighting & bounce fill • Tactile gloss bead eyes • 60 FPS fluid physics", fill=(175, 200, 225, 255))

stages = [
    ("Stage 0: Chick (Pip)", b0, w0_f, 0.95),
    ("Stage 1: Fledgling", b1, w1_f, 0.92),
    ("Stage 2: Adult Songbird", b2, w2_f, 0.88),
    ("Stage 3: Royal King", b2, w2_f, 0.92),
]

col_w = (cw - 60) // 4
for i, (label, body, wing, scale) in enumerate(stages):
    cx = 40 + i * col_w + col_w // 2
    cy = 180

    # Soft ambient clay drop shadow on surface
    sdraw.ellipse([cx - 42, cy + 48, cx + 42, cy + 64], fill=(12, 16, 24, 180))

    bw = int(body.width * scale)
    bh = int(body.height * scale)
    b_scaled = body.resize((bw, bh), Image.Resampling.LANCZOS)

    ww = int(wing.width * scale)
    wh = int(wing.height * scale)
    w_scaled = wing.resize((ww, wh), Image.Resampling.LANCZOS)

    # Body drop shadow
    shadow_b = Image.new('RGBA', b_scaled.size, (12, 16, 24, 120))
    showcase.paste(shadow_b, (cx - bw//2 + 5, cy - bh//2 + 7), mask=b_scaled.split()[3])
    # Body
    showcase.paste(b_scaled, (cx - bw//2, cy - bh//2), mask=b_scaled)
    # Wing
    wx = cx - bw//2 + int(bw * 0.18)
    wy = cy - bh//2 + int(bh * 0.35)
    showcase.paste(w_scaled, (wx, wy), mask=w_scaled)

    if i == 3:
        # Molded clay golden crown
        draw_clay_sphere(showcase, cx, cy - bh//2 - 6, 14, 8, CLAY_GOLD, gloss=0.6)
        draw_clay_sphere(showcase, cx - 8, cy - bh//2 - 14, 4, 7, CLAY_GOLD, gloss=0.6)
        draw_clay_sphere(showcase, cx, cy - bh//2 - 17, 4, 8, CLAY_GOLD, gloss=0.6)
        draw_clay_sphere(showcase, cx + 8, cy - bh//2 - 14, 4, 7, CLAY_GOLD, gloss=0.6)

    sdraw.text((cx - len(label)*3.7, cy + 74), label, fill=(230, 240, 255, 255))

sdraw.line([(36, 290), (cw - 36, 290)], fill=(50, 70, 100, 255), width=2)
sdraw.text((36, 305), "WHY 3D CLAY & TOY ART WORKS PERFECTLY HERE", fill=(100, 215, 255, 255))

bullets = [
    ("Tactile Clay Curvature", "Zero triangles or jagged lines. Soft mathematical curvature with ambient occlusion and bounce fill."),
    ("Studio Key & Rim Lighting", "Studio lighting highlights smooth vinyl/clay surfaces for genuine 3D depth without feeling low-poly."),
    ("Glossy Toy Bead Eyes", "Soulful shiny eyes with dual catchlights that look lovable and expressive from every angle."),
    ("Smooth 60 FPS Puppet Rig", "Every flap, lift bob, and dive pitch is driven by continuous floating-point physics at full 60Hz/120Hz."),
]

for idx, (title, desc) in enumerate(bullets):
    fx = 40 + (idx % 2) * 440
    fy = 345 + (idx // 2) * 75
    sdraw.rounded_rectangle([fx, fy, fx + 420, fy + 65], radius=8, fill=(20, 28, 42, 255), outline=(42, 60, 90, 255), width=1)
    sdraw.text((fx + 14, fy + 10), f"✨ {title}", fill=(255, 225, 95, 255))
    sdraw.text((fx + 14, fy + 34), desc[:58], fill=(175, 195, 220, 255))
    sdraw.text((fx + 14, fy + 48), desc[58:], fill=(175, 195, 220, 255))

art_card_path = '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/volumetric_clay_bird_showcase.png'
showcase.save(art_card_path)
print(f"Artifact showcase saved to {art_card_path}")
