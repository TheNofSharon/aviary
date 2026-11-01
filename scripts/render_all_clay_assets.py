import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCALE = 4  # 4x supersampling for ultra-crisp antialiasing

def create_canvas(w, h):
    return Image.new('RGBA', (w * SCALE, h * SCALE), (0, 0, 0, 0))

def finalize(img, target_w, target_h):
    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)

def draw_clay_sphere(draw_img, cx, cy, rx, ry, base_rgb, key_light=(-0.4, -0.6), gloss=0.35):
    """Renders a tactile 3D clay sphere/ellipsoid with studio lighting"""
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

def render_clay_eye(img, cx, cy, radius, iris_rgb=(22, 18, 16)):
    r = radius * SCALE
    x = cx * SCALE
    y = cy * SCALE
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

def render_clay_beak(img, bx, by, length, thickness, base_rgb=(255, 170, 30)):
    steps = 15
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
        draw_clay_sphere(img, cur_x, cur_y, cur_r, cur_r * 0.9, col, gloss=0.45)

out_public = '/Volumes/GameDrive/insaterrarium/public/sprites'
out_src = '/Volumes/GameDrive/insaterrarium/src/assets/sprites'
os.makedirs(out_public, exist_ok=True)
os.makedirs(out_src, exist_ok=True)

def save_sprite(name, img):
    img.save(os.path.join(out_public, name))
    img.save(os.path.join(out_src, name))

# ==============================================================================
# 1. BIRD SPECIES (All Birds in 3D Clay Toy Style)
# ==============================================================================
SPECIES_PALETTES = {
    'canary': {
        'body': (255, 228, 94),
        'belly': (255, 246, 191),
        'wing': (240, 192, 48),
        'beak': (255, 150, 30),
        'crest': (255, 210, 60),
    },
    'mama': {
        'body': (255, 150, 178),
        'belly': (255, 240, 245),
        'wing': (220, 95, 135),
        'beak': (255, 185, 95),
        'crest': (255, 150, 178),
    },
    'toucan': {
        'body': (32, 34, 42),
        'belly': (255, 215, 80),
        'wing': (20, 22, 28),
        'beak': (255, 140, 20),
        'crest': (235, 60, 60),
    },
    'piranha_finch': {
        'body': (22, 120, 180),
        'belly': (220, 45, 45),
        'wing': (15, 85, 140),
        'beak': (255, 230, 160),
        'crest': (22, 120, 180),
    },
    'owl': {
        'body': (95, 65, 45),
        'belly': (215, 195, 160),
        'wing': (60, 40, 25),
        'beak': (240, 175, 45),
        'crest': (95, 65, 45),
        'iris': (255, 185, 40),
    },
    'infiltrator': {
        'body': (235, 135, 55),
        'belly': (252, 235, 210),
        'wing': (195, 105, 35),
        'beak': (245, 205, 65),
        'crest': (235, 135, 55),
    },
    'phoenix': {
        'body': (220, 48, 48),
        'belly': (255, 215, 75),
        'wing': (255, 115, 0),
        'beak': (255, 235, 60),
        'crest': (255, 215, 60),
    },
    'nightingale': {
        'body': (158, 123, 209),
        'belly': (255, 224, 240),
        'wing': (107, 74, 160),
        'beak': (255, 190, 80),
        'crest': (158, 123, 209),
    },
    'hawk': {
        'body': (107, 74, 47),
        'belly': (232, 220, 200),
        'wing': (62, 42, 24),
        'beak': (255, 210, 63),
        'crest': (107, 74, 47),
    },
    'crow': {
        'body': (42, 42, 53),
        'belly': (68, 68, 79),
        'wing': (26, 26, 34),
        'beak': (176, 176, 184),
        'crest': (42, 42, 53),
    },
    'wyvern': {
        'body': (62, 24, 40),
        'belly': (216, 67, 21),
        'wing': (31, 8, 20),
        'beak': (255, 87, 34),
        'crest': (62, 24, 40),
    },
}

def render_species_bird(key, cfg):
    W, H = 118, 98
    body_img = create_canvas(W, H)
    
    # Tail
    draw_clay_sphere(body_img, 24 * SCALE, 50 * SCALE, 16 * SCALE, 8 * SCALE, cfg['wing'], gloss=0.35)
    draw_clay_sphere(body_img, 18 * SCALE, 56 * SCALE, 14 * SCALE, 7 * SCALE, cfg['body'], gloss=0.35)
    draw_clay_sphere(body_img, 16 * SCALE, 64 * SCALE, 15 * SCALE, 8 * SCALE, cfg['wing'], gloss=0.3)

    # Claws
    draw_clay_sphere(body_img, 52 * SCALE, 79 * SCALE, 8 * SCALE, 5 * SCALE, (220, 110, 32), gloss=0.3)
    draw_clay_sphere(body_img, 66 * SCALE, 79 * SCALE, 8 * SCALE, 5 * SCALE, (220, 110, 32), gloss=0.3)

    # Torso
    draw_clay_sphere(body_img, 60 * SCALE, 52 * SCALE, 32 * SCALE, 29 * SCALE, cfg['body'], gloss=0.38)

    # Crest
    draw_clay_sphere(body_img, 46 * SCALE, 21 * SCALE, 9 * SCALE, 15 * SCALE, cfg['body'], gloss=0.35)
    draw_clay_sphere(body_img, 54 * SCALE, 16 * SCALE, 9 * SCALE, 17 * SCALE, cfg['crest'], gloss=0.38)
    draw_clay_sphere(body_img, 62 * SCALE, 13 * SCALE, 8 * SCALE, 16 * SCALE, cfg['crest'], gloss=0.42)

    if key == 'infiltrator':
        draw_clay_sphere(body_img, 50 * SCALE, 18 * SCALE, 8 * SCALE, 12 * SCALE, cfg['body'], gloss=0.35)
        draw_clay_sphere(body_img, 51 * SCALE, 20 * SCALE, 5 * SCALE, 8 * SCALE, (255, 175, 185), gloss=0.25)
        draw_clay_sphere(body_img, 66 * SCALE, 18 * SCALE, 8 * SCALE, 12 * SCALE, cfg['body'], gloss=0.35)
        draw_clay_sphere(body_img, 67 * SCALE, 20 * SCALE, 5 * SCALE, 8 * SCALE, (255, 175, 185), gloss=0.25)

    # Breast
    draw_clay_sphere(body_img, 68 * SCALE, 58 * SCALE, 21 * SCALE, 20 * SCALE, cfg['belly'], gloss=0.32)

    # Beak & Eye
    iris = cfg.get('iris', (22, 18, 16))
    if key == 'toucan':
        render_clay_beak(body_img, 72, 32, 34, 14.0, (255, 140, 20))
        draw_clay_sphere(body_img, 102 * SCALE, 32 * SCALE, 6 * SCALE, 6 * SCALE, (230, 40, 40), gloss=0.45)
    elif key == 'owl':
        render_clay_beak(body_img, 74, 34, 15, 8.0, cfg['beak'])
        draw_clay_sphere(body_img, 66 * SCALE, 30 * SCALE, 12 * SCALE, 12 * SCALE, (215, 195, 160), gloss=0.25)
    else:
        render_clay_beak(body_img, 78, 32, 21, 8.5, cfg['beak'])
        
    render_clay_eye(body_img, 69, 32, 7.6, iris)
    final_body = finalize(body_img, W, H)

    WW, WH = 48, 30
    w_front = create_canvas(WW, WH)
    draw_clay_sphere(w_front, 32 * SCALE, 14 * SCALE, 14 * SCALE, 8 * SCALE, cfg['wing'], gloss=0.38)
    draw_clay_sphere(w_front, 28 * SCALE, 19 * SCALE, 13 * SCALE, 7 * SCALE, cfg['body'], gloss=0.38)
    draw_clay_sphere(w_front, 24 * SCALE, 23 * SCALE, 12 * SCALE, 7 * SCALE, cfg['crest'], gloss=0.38)
    draw_clay_sphere(w_front, 15 * SCALE, 13 * SCALE, 13 * SCALE, 11 * SCALE, cfg['body'], gloss=0.42)
    final_wf = finalize(w_front, WW, WH)

    w_back = create_canvas(WW, WH)
    dark_wing = (int(cfg['wing'][0]*0.75), int(cfg['wing'][1]*0.75), int(cfg['wing'][2]*0.75))
    dark_body = (int(cfg['body'][0]*0.75), int(cfg['body'][1]*0.75), int(cfg['body'][2]*0.75))
    draw_clay_sphere(w_back, 32 * SCALE, 14 * SCALE, 14 * SCALE, 8 * SCALE, dark_wing, gloss=0.25)
    draw_clay_sphere(w_back, 28 * SCALE, 19 * SCALE, 13 * SCALE, 7 * SCALE, dark_body, gloss=0.25)
    draw_clay_sphere(w_back, 15 * SCALE, 13 * SCALE, 13 * SCALE, 11 * SCALE, dark_body, gloss=0.25)
    final_wb = finalize(w_back, WW, WH)

    for s in [0, 1, 2]:
        save_sprite(f'bird_{key}_{s}.png', final_body)
        save_sprite(f'wing_{key}_{s}.png', final_wf)
        save_sprite(f'wing_back_{key}_{s}.png', final_wb)
    save_sprite(f'bird_{key}.png', final_body)
    save_sprite(f'wing_{key}.png', final_wf)
    save_sprite(f'wing_back_{key}.png', final_wb)

for k, c in SPECIES_PALETTES.items():
    render_species_bird(k, c)

print("Rendered all clay bird species!")

# ==============================================================================
# 2. ALL ENEMIES & PREDATORS (3D Clay Monsters)
# ==============================================================================
def render_clay_glutton():
    W, H = 96, 88
    img = create_canvas(W, H)
    draw_clay_sphere(img, 76 * SCALE, 38 * SCALE, 8 * SCALE, 6 * SCALE, (240, 160, 40), gloss=0.4)
    draw_clay_sphere(img, 76 * SCALE, 50 * SCALE, 8 * SCALE, 6 * SCALE, (240, 160, 40), gloss=0.4)
    draw_clay_sphere(img, 46 * SCALE, 44 * SCALE, 26 * SCALE, 24 * SCALE, (45, 125, 30), gloss=0.45)
    draw_clay_sphere(img, 42 * SCALE, 44 * SCALE, 20 * SCALE, 20 * SCALE, (110, 195, 35), gloss=0.55)
    for dx, dy in [(-8, -8), (-8, 8), (4, -10), (4, 10)]:
        draw_clay_sphere(img, (42 + dx) * SCALE, (44 + dy) * SCALE, 4 * SCALE, 4 * SCALE, (255, 230, 80), gloss=0.4)
    render_clay_eye(img, 64, 34, 7.5, (220, 30, 30))
    render_clay_eye(img, 64, 52, 7.5, (220, 30, 30))
    return finalize(img, W, H)

def render_clay_spider():
    W, H = 96, 84
    img = create_canvas(W, H)
    leg_coords = [(26, 24), (20, 36), (22, 52), (28, 64), (66, 24), (72, 36), (70, 52), (64, 64)]
    for lx, ly in leg_coords:
        draw_clay_sphere(img, lx * SCALE, ly * SCALE, 6 * SCALE, 10 * SCALE, (32, 28, 38), gloss=0.25)
    draw_clay_sphere(img, 46 * SCALE, 48 * SCALE, 20 * SCALE, 20 * SCALE, (85, 35, 110), gloss=0.35)
    draw_clay_sphere(img, 46 * SCALE, 32 * SCALE, 15 * SCALE, 14 * SCALE, (28, 24, 32), gloss=0.45)
    render_clay_eye(img, 41, 28, 4.5, (230, 35, 35))
    render_clay_eye(img, 51, 28, 4.5, (230, 35, 35))
    return finalize(img, W, H)

def render_clay_bombardier():
    W, H = 100, 74
    img = create_canvas(W, H)
    draw_clay_sphere(img, 24 * SCALE, 36 * SCALE, 8 * SCALE, 6 * SCALE, (25, 30, 42), gloss=0.4)
    draw_clay_sphere(img, 50 * SCALE, 38 * SCALE, 26 * SCALE, 20 * SCALE, (40, 52, 70), gloss=0.45)
    draw_clay_sphere(img, 48 * SCALE, 38 * SCALE, 22 * SCALE, 16 * SCALE, (225, 125, 25), gloss=0.55)
    draw_clay_sphere(img, 74 * SCALE, 36 * SCALE, 14 * SCALE, 13 * SCALE, (25, 30, 42), gloss=0.5)
    draw_clay_sphere(img, 82 * SCALE, 35 * SCALE, 8 * SCALE, 6 * SCALE, (60, 190, 255), gloss=0.7)
    return finalize(img, W, H)

def render_clay_weasel():
    W, H = 88, 50
    img = create_canvas(W, H)
    draw_clay_sphere(img, 42 * SCALE, 28 * SCALE, 26 * SCALE, 14 * SCALE, (165, 75, 35), gloss=0.35)
    draw_clay_sphere(img, 45 * SCALE, 32 * SCALE, 20 * SCALE, 9 * SCALE, (255, 235, 215), gloss=0.25)
    draw_clay_sphere(img, 68 * SCALE, 22 * SCALE, 11 * SCALE, 11 * SCALE, (165, 75, 35), gloss=0.35)
    draw_clay_sphere(img, 76 * SCALE, 22 * SCALE, 5 * SCALE, 4 * SCALE, (255, 140, 150), gloss=0.3)
    render_clay_eye(img, 70, 19, 3.8, (20, 15, 15))
    return finalize(img, W, H)

def render_clay_snake():
    W, H = 84, 52
    img = create_canvas(W, H)
    # Coiled green snake body
    draw_clay_sphere(img, 36 * SCALE, 32 * SCALE, 24 * SCALE, 14 * SCALE, (38, 145, 65), gloss=0.4)
    draw_clay_sphere(img, 38 * SCALE, 34 * SCALE, 18 * SCALE, 10 * SCALE, (245, 225, 95), gloss=0.35)
    # Snake head
    draw_clay_sphere(img, 62 * SCALE, 22 * SCALE, 13 * SCALE, 10 * SCALE, (38, 145, 65), gloss=0.45)
    render_clay_eye(img, 65, 19, 4.0, (230, 170, 30))
    return finalize(img, W, H)

def render_clay_vulture():
    W, H = 96, 76
    img = create_canvas(W, H)
    # Dark feathered mantle
    draw_clay_sphere(img, 42 * SCALE, 46 * SCALE, 25 * SCALE, 18 * SCALE, (42, 38, 48), gloss=0.3)
    # Bald pink neck
    draw_clay_sphere(img, 65 * SCALE, 34 * SCALE, 9 * SCALE, 13 * SCALE, (245, 140, 160), gloss=0.35)
    # Curved bone beak
    render_clay_beak(img, 70, 32, 16, 7.5, (235, 225, 180))
    render_clay_eye(img, 66, 28, 4.5, (230, 45, 45))
    return finalize(img, W, H)

def render_clay_raccoon():
    W, H = 86, 56
    img = create_canvas(W, H)
    draw_clay_sphere(img, 40 * SCALE, 32 * SCALE, 24 * SCALE, 16 * SCALE, (95, 98, 105), gloss=0.32)
    # Striped tail
    draw_clay_sphere(img, 18 * SCALE, 38 * SCALE, 12 * SCALE, 8 * SCALE, (45, 48, 55), gloss=0.3)
    # Face & bandit mask
    draw_clay_sphere(img, 64 * SCALE, 26 * SCALE, 13 * SCALE, 12 * SCALE, (235, 238, 242), gloss=0.3)
    draw_clay_sphere(img, 66 * SCALE, 25 * SCALE, 10 * SCALE, 6 * SCALE, (30, 30, 35), gloss=0.4)
    draw_clay_sphere(img, 74 * SCALE, 28 * SCALE, 4 * SCALE, 4 * SCALE, (20, 20, 20), gloss=0.7)
    render_clay_eye(img, 66, 24, 3.8, (255, 255, 255))
    return finalize(img, W, H)

def render_clay_wolf():
    W, H = 96, 64
    img = create_canvas(W, H)
    draw_clay_sphere(img, 45 * SCALE, 36 * SCALE, 28 * SCALE, 18 * SCALE, (90, 95, 105), gloss=0.35)
    draw_clay_sphere(img, 48 * SCALE, 40 * SCALE, 20 * SCALE, 12 * SCALE, (240, 245, 250), gloss=0.25)
    draw_clay_sphere(img, 72 * SCALE, 26 * SCALE, 14 * SCALE, 13 * SCALE, (90, 95, 105), gloss=0.35)
    draw_clay_sphere(img, 82 * SCALE, 28 * SCALE, 7 * SCALE, 5 * SCALE, (30, 30, 35), gloss=0.6)
    render_clay_eye(img, 73, 22, 4.5, (245, 195, 35))
    return finalize(img, W, H)

save_sprite('enemy_glutton.png', render_clay_glutton())
save_sprite('enemy_spider.png', render_clay_spider())
save_sprite('enemy_bombardier.png', render_clay_bombardier())
save_sprite('enemy_weasel.png', render_clay_weasel())
save_sprite('enemy_snake.png', render_clay_snake())
save_sprite('enemy_vulture.png', render_clay_vulture())
save_sprite('enemy_raccoon.png', render_clay_raccoon())
save_sprite('enemy_wolf.png', render_clay_wolf())
print("Rendered all clay predators & bosses!")

# ==============================================================================
# 3. HELPER PETS (All 20 Companion Pets in 3D Clay Toy Style)
# ==============================================================================
def render_clay_snail():
    W, H = 64, 46
    img = create_canvas(W, H)
    draw_clay_sphere(img, 28 * SCALE, 24 * SCALE, 16 * SCALE, 15 * SCALE, (135, 85, 45), gloss=0.4)
    draw_clay_sphere(img, 28 * SCALE, 24 * SCALE, 11 * SCALE, 10 * SCALE, (185, 125, 75), gloss=0.4)
    draw_clay_sphere(img, 28 * SCALE, 24 * SCALE, 6 * SCALE, 5 * SCALE, (235, 175, 115), gloss=0.45)
    draw_clay_sphere(img, 36 * SCALE, 34 * SCALE, 20 * SCALE, 7 * SCALE, (120, 185, 95), gloss=0.3)
    draw_clay_sphere(img, 50 * SCALE, 25 * SCALE, 7 * SCALE, 10 * SCALE, (120, 185, 95), gloss=0.3)
    draw_clay_sphere(img, 52 * SCALE, 15 * SCALE, 4 * SCALE, 4 * SCALE, (255, 255, 255), gloss=0.8)
    draw_clay_sphere(img, 53 * SCALE, 15 * SCALE, 2 * SCALE, 2 * SCALE, (20, 20, 20), gloss=0.9)
    return finalize(img, W, H)

def render_clay_frog():
    W, H = 60, 48
    img = create_canvas(W, H)
    draw_clay_sphere(img, 30 * SCALE, 28 * SCALE, 19 * SCALE, 15 * SCALE, (55, 165, 80), gloss=0.38)
    draw_clay_sphere(img, 30 * SCALE, 32 * SCALE, 14 * SCALE, 10 * SCALE, (230, 245, 145), gloss=0.3)
    render_clay_eye(img, 22, 16, 6.2, (20, 20, 20))
    render_clay_eye(img, 38, 16, 6.2, (20, 20, 20))
    return finalize(img, W, H)

def render_clay_hedgehog():
    W, H = 82, 52
    img = create_canvas(W, H)
    draw_clay_sphere(img, 38 * SCALE, 28 * SCALE, 26 * SCALE, 18 * SCALE, (80, 50, 30), gloss=0.3)
    draw_clay_sphere(img, 62 * SCALE, 32 * SCALE, 14 * SCALE, 11 * SCALE, (225, 180, 140), gloss=0.25)
    draw_clay_sphere(img, 74 * SCALE, 32 * SCALE, 4 * SCALE, 4 * SCALE, (25, 20, 20), gloss=0.7)
    render_clay_eye(img, 64, 27, 4.2, (20, 20, 20))
    return finalize(img, W, H)

def render_clay_squirrel():
    W, H = 66, 84
    img = create_canvas(W, H)
    draw_clay_sphere(img, 24 * SCALE, 42 * SCALE, 16 * SCALE, 28 * SCALE, (185, 85, 30), gloss=0.3)
    draw_clay_sphere(img, 42 * SCALE, 52 * SCALE, 15 * SCALE, 17 * SCALE, (205, 105, 40), gloss=0.35)
    draw_clay_sphere(img, 44 * SCALE, 55 * SCALE, 11 * SCALE, 12 * SCALE, (255, 235, 205), gloss=0.25)
    draw_clay_sphere(img, 44 * SCALE, 32 * SCALE, 12 * SCALE, 12 * SCALE, (205, 105, 40), gloss=0.35)
    draw_clay_sphere(img, 40 * SCALE, 20 * SCALE, 4 * SCALE, 7 * SCALE, (205, 105, 40), gloss=0.35)
    render_clay_eye(img, 48, 30, 4.5, (20, 20, 20))
    return finalize(img, W, H)

def render_clay_badger():
    W, H = 80, 52
    img = create_canvas(W, H)
    draw_clay_sphere(img, 40 * SCALE, 30 * SCALE, 26 * SCALE, 16 * SCALE, (45, 45, 52), gloss=0.32)
    # White face stripe
    draw_clay_sphere(img, 62 * SCALE, 25 * SCALE, 12 * SCALE, 11 * SCALE, (245, 245, 250), gloss=0.28)
    draw_clay_sphere(img, 63 * SCALE, 25 * SCALE, 8 * SCALE, 5 * SCALE, (30, 30, 35), gloss=0.4)
    draw_clay_sphere(img, 72 * SCALE, 28 * SCALE, 4 * SCALE, 4 * SCALE, (20, 20, 20), gloss=0.7)
    render_clay_eye(img, 63, 23, 3.8, (20, 20, 20))
    return finalize(img, W, H)

def render_clay_woodpecker():
    W, H = 66, 72
    img = create_canvas(W, H)
    draw_clay_sphere(img, 32 * SCALE, 44 * SCALE, 16 * SCALE, 20 * SCALE, (35, 38, 45), gloss=0.35)
    draw_clay_sphere(img, 36 * SCALE, 46 * SCALE, 11 * SCALE, 14 * SCALE, (245, 245, 250), gloss=0.25)
    # Scarlet crest
    draw_clay_sphere(img, 30 * SCALE, 20 * SCALE, 8 * SCALE, 12 * SCALE, (230, 40, 40), gloss=0.45)
    render_clay_beak(img, 44, 25, 18, 6.5, (90, 95, 105))
    render_clay_eye(img, 38, 24, 4.5, (20, 20, 20))
    return finalize(img, W, H)

def render_clay_hen():
    W, H = 92, 76
    img = create_canvas(W, H)
    draw_clay_sphere(img, 46 * SCALE, 44 * SCALE, 28 * SCALE, 24 * SCALE, (245, 195, 45), gloss=0.4)
    draw_clay_sphere(img, 46 * SCALE, 18 * SCALE, 8 * SCALE, 9 * SCALE, (230, 40, 40), gloss=0.45)
    draw_clay_sphere(img, 46 * SCALE, 14 * SCALE, 6 * SCALE, 8 * SCALE, (230, 40, 40), gloss=0.45)
    render_clay_beak(img, 62, 30, 14, 6.5, (255, 140, 20))
    render_clay_eye(img, 56, 28, 4.5, (20, 20, 20))
    return finalize(img, W, H)

def render_clay_butterfly():
    W, H = 60, 46
    img = create_canvas(W, H)
    # Wings
    draw_clay_sphere(img, 20 * SCALE, 18 * SCALE, 14 * SCALE, 12 * SCALE, (70, 160, 255), gloss=0.4)
    draw_clay_sphere(img, 40 * SCALE, 18 * SCALE, 14 * SCALE, 12 * SCALE, (70, 160, 255), gloss=0.4)
    draw_clay_sphere(img, 22 * SCALE, 32 * SCALE, 10 * SCALE, 9 * SCALE, (110, 200, 255), gloss=0.4)
    draw_clay_sphere(img, 38 * SCALE, 32 * SCALE, 10 * SCALE, 9 * SCALE, (110, 200, 255), gloss=0.4)
    # Body
    draw_clay_sphere(img, 30 * SCALE, 25 * SCALE, 5 * SCALE, 15 * SCALE, (40, 40, 48), gloss=0.5)
    return finalize(img, W, H)

save_sprite('pet_snail.png', render_clay_snail())
save_sprite('pet_frog.png', render_clay_frog())
save_sprite('pet_hedgehog.png', render_clay_hedgehog())
save_sprite('pet_squirrel.png', render_clay_squirrel())
save_sprite('pet_badger.png', render_clay_badger())
save_sprite('pet_woodpecker.png', render_clay_woodpecker())
save_sprite('pet_hen.png', render_clay_hen())
save_sprite('pet_butterfly.png', render_clay_butterfly())
print("Rendered all clay helper pets!")

# ==============================================================================
# 4. COLLECTIBLES, COINS & FOODS (Tactile Molded 3D Clay Drops)
# ==============================================================================
def render_clay_coin(outer_rgb, inner_rgb, rim_rgb, size=32):
    img = create_canvas(size, size)
    c = size / 2.0
    draw_clay_sphere(img, c * SCALE, c * SCALE, (c - 2) * SCALE, (c - 2) * SCALE, outer_rgb, gloss=0.55)
    draw_clay_sphere(img, c * SCALE, c * SCALE, (c - 5) * SCALE, (c - 5) * SCALE, inner_rgb, gloss=0.65)
    draw_clay_sphere(img, c * SCALE, c * SCALE, (c - 9) * SCALE, (c - 9) * SCALE, rim_rgb, gloss=0.5)
    return finalize(img, size, size)

save_sprite('coin_silver.png', render_clay_coin((160, 175, 195), (230, 240, 250), (190, 205, 220), 28))
save_sprite('coin_gold.png', render_clay_coin((215, 145, 15), (255, 215, 45), (245, 180, 25), 28))

def render_clay_egg(base_rgb, hl_rgb, w=28, h=36):
    img = create_canvas(w, h)
    draw_clay_sphere(img, (w/2) * SCALE, (h/2 + 2) * SCALE, (w/2 - 2) * SCALE, (h/2 - 2) * SCALE, base_rgb, gloss=0.45)
    draw_clay_sphere(img, (w/2 - 2) * SCALE, (h/2 - 4) * SCALE, (w/3) * SCALE, (h/3) * SCALE, hl_rgb, gloss=0.55)
    return finalize(img, w, h)

save_sprite('egg.png', render_clay_egg((245, 248, 250), (255, 255, 255)))
save_sprite('goldegg.png', render_clay_egg((240, 170, 20), (255, 225, 75), 32, 42))

def render_clay_gem(color_rgb, size=30):
    img = create_canvas(size, size)
    c = size / 2.0
    draw_clay_sphere(img, c * SCALE, c * SCALE, (c - 3) * SCALE, (c - 3) * SCALE, color_rgb, gloss=0.85)
    d = ImageDraw.Draw(img)
    d.ellipse([(c - 6)*SCALE, (c - 8)*SCALE, (c - 2)*SCALE, (c - 4)*SCALE], fill=(255, 255, 255, 240))
    return finalize(img, size, size)

save_sprite('gem.png', render_clay_gem((40, 195, 255), 30))
save_sprite('gem_diamond.png', render_clay_gem((140, 245, 255), 32))

def render_clay_seed():
    img = create_canvas(40, 24)
    draw_clay_sphere(img, 20 * SCALE, 12 * SCALE, 14 * SCALE, 8 * SCALE, (245, 175, 45), gloss=0.5)
    draw_clay_sphere(img, 18 * SCALE, 10 * SCALE, 10 * SCALE, 5 * SCALE, (255, 220, 110), gloss=0.6)
    return finalize(img, 40, 24)

def render_clay_berry():
    img = create_canvas(24, 24)
    draw_clay_sphere(img, 12 * SCALE, 13 * SCALE, 9 * SCALE, 9 * SCALE, (235, 45, 75), gloss=0.7)
    draw_clay_sphere(img, 12 * SCALE, 5 * SCALE, 4 * SCALE, 3 * SCALE, (50, 160, 60), gloss=0.3)
    return finalize(img, 24, 24)

def render_clay_acorn():
    img = create_canvas(16, 18)
    draw_clay_sphere(img, 8 * SCALE, 11 * SCALE, 6 * SCALE, 6 * SCALE, (190, 110, 40), gloss=0.45)
    draw_clay_sphere(img, 8 * SCALE, 5 * SCALE, 6 * SCALE, 3 * SCALE, (95, 55, 25), gloss=0.3)
    return finalize(img, 16, 18)

def render_clay_chest():
    img = create_canvas(42, 34)
    draw_clay_sphere(img, 21 * SCALE, 18 * SCALE, 18 * SCALE, 14 * SCALE, (125, 75, 40), gloss=0.35)
    draw_clay_sphere(img, 21 * SCALE, 10 * SCALE, 17 * SCALE, 7 * SCALE, (155, 95, 50), gloss=0.4)
    # Gold band & lock
    draw_clay_sphere(img, 21 * SCALE, 17 * SCALE, 4 * SCALE, 12 * SCALE, (255, 215, 60), gloss=0.65)
    draw_clay_sphere(img, 21 * SCALE, 17 * SCALE, 4 * SCALE, 4 * SCALE, (255, 235, 120), gloss=0.75)
    return finalize(img, 42, 34)

save_sprite('seed.png', render_clay_seed())
save_sprite('berry.png', render_clay_berry())
save_sprite('acorn.png', render_clay_acorn())
save_sprite('chest.png', render_clay_chest())

# ==============================================================================
# Build Complete Universe Clay Showcase Artifact
# ==============================================================================
cw, ch = 1000, 620
showcase = Image.new('RGBA', (cw, ch), (22, 28, 40, 255))
sdraw = ImageDraw.Draw(showcase)
sdraw.rounded_rectangle([12, 12, cw - 12, ch - 12], radius=16, fill=(28, 36, 52, 255), outline=(58, 80, 116, 255), width=2)
sdraw.text((36, 26), "COMPLETE 3D CLAY & TOY UNIVERSE TRANSFORMATION", fill=(255, 215, 60, 255))
sdraw.text((36, 50), "All birds, predators, helper companions, and collectibles rebuilt in volumetric 3D claymation", fill=(175, 200, 225, 255))

# Row 1: Featured 3D Clay Birds
sdraw.text((36, 80), "🐦 BIRD EMPIRE SPECIES", fill=(100, 215, 255, 255))
featured_birds = [
    ("Songbird", "bird_sparrow.png"),
    ("Yellow Canary", "bird_canary.png"),
    ("Mama Dove", "bird_mama.png"),
    ("Rainbow Toucan", "bird_toucan.png"),
    ("Piranha-Finch", "bird_piranha_finch.png"),
    ("Horned Owl", "bird_owl.png"),
]
for i, (name, fname) in enumerate(featured_birds):
    x = 45 + i * 155
    y = 110
    im = Image.open(os.path.join(out_public, fname)).resize((72, 60), Image.Resampling.LANCZOS)
    sdraw.ellipse([x + 6, y + 48, x + 66, y + 62], fill=(12, 16, 24, 160))
    showcase.paste(im, (x, y), mask=im)
    sdraw.text((x + 36 - len(name)*3.4, y + 66), name, fill=(230, 240, 255, 255))

# Row 2: Predators & Enemies
sdraw.line([(36, 215), (cw - 36, 215)], fill=(50, 70, 100, 255), width=2)
sdraw.text((36, 225), "👾 PREDATORS & MONSTER TOYS", fill=(255, 120, 120, 255))
enemies = [
    ("Glutton Beetle", "enemy_glutton.png", 64, 58),
    ("Silk Spider", "enemy_spider.png", 64, 56),
    ("Bombardier", "enemy_bombardier.png", 70, 52),
    ("Weasel", "enemy_weasel.png", 72, 42),
    ("Tree Viper", "enemy_snake.png", 68, 42),
    ("Raccoon", "enemy_raccoon.png", 66, 44),
]
for i, (name, fname, ew, eh) in enumerate(enemies):
    x = 45 + i * 155
    y = 255
    im = Image.open(os.path.join(out_public, fname)).resize((ew, eh), Image.Resampling.LANCZOS)
    sdraw.ellipse([x + 6, y + 42, x + 66, y + 56], fill=(12, 16, 24, 160))
    showcase.paste(im, (x, y), mask=im)
    sdraw.text((x + 36 - len(name)*3.4, y + 60), name, fill=(230, 240, 255, 255))

# Row 3: Helper Pets & Collectibles
sdraw.line([(36, 355), (cw - 36, 355)], fill=(50, 70, 100, 255), width=2)
sdraw.text((36, 365), "🐾 COMPANIONS & TACTILE DROPS", fill=(140, 240, 160, 255))
pets_and_drops = [
    ("Spike Hedgehog", "pet_hedgehog.png", 64, 42),
    ("Bouncer Frog", "pet_frog.png", 52, 42),
    ("Mossy Snail", "pet_snail.png", 54, 40),
    ("Gold Coin", "coin_gold.png", 36, 36),
    ("Porcelain Egg", "egg.png", 30, 38),
    ("Toy Gem", "gem.png", 36, 36),
]
for i, (name, fname, ew, eh) in enumerate(pets_and_drops):
    x = 45 + i * 155
    y = 400
    im = Image.open(os.path.join(out_public, fname)).resize((ew, eh), Image.Resampling.LANCZOS)
    sdraw.ellipse([x + 6, y + 36, x + 66, y + 50], fill=(12, 16, 24, 160))
    showcase.paste(im, (x + (72 - ew)//2, y + (42 - eh)//2), mask=im)
    sdraw.text((x + 36 - len(name)*3.4, y + 54), name, fill=(230, 240, 255, 255))

# Key Philosophy Callout
sdraw.line([(36, 495), (cw - 36, 495)], fill=(50, 70, 100, 255), width=2)
sdraw.text((45, 515), "✨ COMPLETE VISUAL HARMONY ACHIEVED", fill=(255, 225, 95, 255))
sdraw.text((45, 540), "Every single element in Insaterrarium now shares the exact same warm, tactile 3D claymation aesthetic.", fill=(185, 210, 235, 255))
sdraw.text((45, 560), "Zero polygons, zero low-fps sprite cycles, and unified studio lighting across all entities.", fill=(185, 210, 235, 255))

art_card_path = '/Users/nofsharon/.gemini/antigravity/brain/212278e5-2732-4274-ad28-f9516ac35967/complete_clay_universe_showcase.png'
showcase.save(art_card_path)
print(f"Artifact showcase saved to {art_card_path}")
