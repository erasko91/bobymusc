from PIL import Image, ImageDraw, ImageFont
import sys, os

OUT = sys.argv[1]
ORANGE = (255, 107, 26)
BG = (14, 15, 18)
S = 1024


def draw_icon(maskable):
    img = Image.new('RGB', (S, S), BG)
    d = ImageDraw.Draw(img)
    # léger halo
    halo = Image.new('RGB', (S, S), BG)
    hd = ImageDraw.Draw(halo)
    for i in range(60, 0, -1):
        c = tuple(int(BG[k] + (40 - BG[k] * 0.3) * (1 - i / 60) * 0.5) for k in range(3))
        r = 300 + i * 6
        hd.ellipse([S / 2 - r, S / 2 - r - 40, S / 2 + r, S / 2 + r - 40], fill=c)
    img = halo
    d = ImageDraw.Draw(img)
    sc = 0.78 if maskable else 1.0
    cx, cy = S / 2, S / 2 - 70 * sc

    def R(x0, y0, x1, y1, rad, fill):
        d.rounded_rectangle([cx + x0 * sc, cy + y0 * sc, cx + x1 * sc, cy + y1 * sc], radius=rad * sc, fill=fill)

    # barre
    R(-330, -28, 330, 28, 20, (230, 232, 236))
    # disques
    for side in (-1, 1):
        R(*sorted((side * 150, side * 215)), -165, 165, 30, ORANGE) if False else None
        x_in, x_mid, x_out = 150, 225, 290
        a, b = sorted((side * x_in, side * x_mid))
        R(a, -190, b, 190, 34, ORANGE)
        a, b = sorted((side * (x_mid + 12), side * x_out))
        R(a, -130, b, 130, 28, ORANGE)
    # texte
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', int(140 * sc))
    except OSError:
        font = ImageFont.load_default()
    text = 'BobyMusc'
    w = d.textlength(text, font=font)
    y = cy + 250 * sc
    bob_w = d.textlength('Boby', font=font)
    d.text((cx - w / 2, y), 'Boby', font=font, fill=(242, 243, 245))
    d.text((cx - w / 2 + bob_w, y), 'Musc', font=font, fill=ORANGE)
    return img


std = draw_icon(False)
mask = draw_icon(True)
std.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-512.png'))
std.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'icon-192.png'))
std.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'))
mask.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'icon-maskable-512.png'))
print('ok')
