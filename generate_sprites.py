import math
from PIL import Image, ImageDraw

# Color Palette
C_TRANSPARENT = (0, 0, 0, 0)
C_ARMOR_BASE = (42, 58, 92, 255)       # #2a3a5c
C_ARMOR_MID = (61, 90, 138, 255)       # #3d5a8a
C_ARMOR_HIGH = (90, 122, 176, 255)     # #5a7ab0
C_VISOR_GLOW = (0, 255, 136, 255)      # #00ff88
C_VISOR_DARK = (0, 204, 102, 255)      # #00cc66
C_BELT_BASE = (138, 106, 58, 255)      # #8a6a3a
C_BELT_BUCKLE = (196, 160, 80, 255)    # #c4a050
C_BOOTS = (26, 26, 46, 255)            # #1a1a2e
C_SKIN = (212, 165, 116, 255)          # #d4a574
C_OUTLINE = (10, 10, 26, 255)          # #0a0a1a
C_BLOOD = (200, 30, 50, 255)           # Blood/Flash

# Grid settings
CELL = 32
GRID_W = 32
GRID_H = 5
IMG_W = GRID_W * CELL
IMG_H = GRID_H * CELL

def draw_rect(d, x1, y1, x2, y2, fill, outline=None):
    d.rectangle([x1, y1, x2, y2], fill=fill, outline=outline)

def draw_character(action, frame, angle, is_death=False):
    img = Image.new('RGBA', (CELL, CELL), C_TRANSPARENT)
    d = ImageDraw.Draw(img)
    
    if is_death:
        if frame == 0:
            # Hit reaction
            d.polygon([(16,2), (20,10), (28,12), (22,18), (26,26), (16,22), (6,26), (10,18), (4,12), (12,10)], fill=C_BLOOD)
            d.ellipse([11, 11, 21, 21], fill=C_ARMOR_HIGH, outline=C_OUTLINE)
        elif frame == 1:
            # Falling
            d.ellipse([10, 12, 22, 24], fill=C_BLOOD)
            d.ellipse([8, 8, 18, 18], fill=C_ARMOR_BASE, outline=C_OUTLINE)
            d.rectangle([15, 9, 17, 13], fill=C_VISOR_DARK)
            d.rectangle([18, 16, 24, 22], fill=C_ARMOR_MID, outline=C_OUTLINE)
            d.rectangle([6, 20, 12, 24], fill=C_BOOTS) # leg
        elif frame == 2:
            # On ground
            d.ellipse([6, 10, 28, 26], fill=C_BLOOD)
            d.ellipse([14, 14, 22, 22], fill=C_ARMOR_BASE, outline=C_OUTLINE) 
            d.rectangle([9, 12, 15, 18], fill=C_ARMOR_MID)
        elif frame == 3:
            # Dissolve
            d.ellipse([10, 14, 22, 22], fill=C_BLOOD)
            d.ellipse([16, 16, 20, 20], fill=C_ARMOR_BASE)
        return img

    boot_off = [0, 0]
    gun_off = 0
    head_off = 0
    flash = False
    
    if action == 'idle':
        if frame % 2 == 1: head_off = 1
    elif action == 'walk':
        # 4 frames: right-forward, neutral, left-forward, neutral
        if frame == 0: boot_off = [-2, 2]
        elif frame == 1: boot_off = [0, 0]
        elif frame == 2: boot_off = [2, -2]
        elif frame == 3: boot_off = [0, 0]
    elif action == 'sprint':
        if frame == 0: boot_off = [-4, 4]
        elif frame == 1: boot_off = [-1, 1]
        elif frame == 2: boot_off = [4, -4]
        elif frame == 3: boot_off = [1, -1]
    elif action == 'shoot':
        if frame == 0: gun_off = 0
        elif frame == 1: 
            gun_off = -2
            flash = True
        elif frame == 2: gun_off = -1

    # Drawing order: Back to Front (Bottom to Top layers)
    # 1. Boots
    draw_rect(d, 5 + boot_off[0], 10, 11 + boot_off[0], 14, C_BOOTS, C_OUTLINE)
    draw_rect(d, 5 + boot_off[1], 18, 11 + boot_off[1], 22, C_BOOTS, C_OUTLINE)
    
    # 2. Torso 
    draw_rect(d, 8, 11, 16, 21, C_ARMOR_BASE, C_OUTLINE)
    draw_rect(d, 10, 13, 15, 19, C_ARMOR_MID, None)
    
    # 3. Shoulders
    draw_rect(d, 11, 8, 16, 12, C_ARMOR_HIGH, C_OUTLINE)
    draw_rect(d, 11, 20, 16, 24, C_ARMOR_HIGH, C_OUTLINE)
    
    # 4. Arms
    d.line([(15, 10), (20 + gun_off, 14)], fill=C_ARMOR_MID, width=2)
    d.line([(15, 22), (20 + gun_off, 18)], fill=C_ARMOR_MID, width=2)
    
    # Hands (Skin visible)
    draw_rect(d, 19 + gun_off, 13, 20 + gun_off, 14, C_SKIN)
    draw_rect(d, 19 + gun_off, 18, 20 + gun_off, 19, C_SKIN)

    # 5. Belt (peeking out)
    draw_rect(d, 6, 14, 8, 18, C_BELT_BASE, C_OUTLINE)
    d.point((7, 16), fill=C_BELT_BUCKLE)

    # 6. Weapon
    draw_rect(d, 18 + gun_off, 14, 25 + gun_off, 18, C_BOOTS, C_OUTLINE)
    draw_rect(d, 25 + gun_off, 15, 29 + gun_off, 17, C_OUTLINE, None)
    d.point((29 + gun_off, 16), fill=C_ARMOR_MID)
    
    if flash:
        d.polygon([(30 + gun_off, 16), (33 + gun_off, 13), (35 + gun_off, 16), (33 + gun_off, 19)], fill=C_VISOR_GLOW)

    # 7. Head
    hx1, hy1, hx2, hy2 = 12 + head_off, 12, 20 + head_off, 20
    d.ellipse([hx1, hy1, hx2, hy2], fill=C_ARMOR_MID, outline=C_OUTLINE)
    d.ellipse([hx1+2, hy1+2, hx2-2, hy2-2], fill=C_ARMOR_HIGH)
    
    # 8. Visor
    d.polygon([(hx2-3, hy1+1), (hx2, hy1+3), (hx2, hy2-3), (hx2-3, hy2-1)], fill=C_VISOR_GLOW, outline=C_VISOR_DARK)
    
    if action == 'sprint' and (frame == 1 or frame == 3):
        d.point((4, 12), fill=C_ARMOR_HIGH)
        d.point((3, 20), fill=C_ARMOR_HIGH)

    # Rotate
    rotated = img.rotate(angle, resample=Image.NEAREST, expand=False)
    return rotated

def main():
    sheet = Image.new('RGBA', (IMG_W, IMG_H), C_TRANSPARENT)
    dir_angles = [270, 225, 180, 135, 90, 45, 0, 315]

    for d_idx, angle in enumerate(dir_angles):
        img_f = draw_character('idle', 0, angle)
        sheet.paste(img_f, (d_idx * CELL, 0 * CELL))

    for d_idx, angle in enumerate(dir_angles):
        for f in range(4):
            img_f = draw_character('walk', f, angle)
            sheet.paste(img_f, ((d_idx * 4 + f) * CELL, 1 * CELL))

    for d_idx, angle in enumerate(dir_angles):
        for f in range(4):
            img_f = draw_character('sprint', f, angle)
            sheet.paste(img_f, ((d_idx * 4 + f) * CELL, 2 * CELL))

    for d_idx, angle in enumerate(dir_angles):
        for f in range(3):
            img_f = draw_character('shoot', f, angle)
            sheet.paste(img_f, ((d_idx * 3 + f) * CELL, 3 * CELL))

    for f in range(4):
        img_f = draw_character('death', f, 0, is_death=True)
        sheet.paste(img_f, (f * CELL, 4 * CELL))

    sheet.save('commander_sprite_sheet.png')
    print("Sprite sheet generated at commander_sprite_sheet.png")

if __name__ == '__main__':
    main()
