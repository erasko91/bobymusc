"""Petite icône blanche sur fond transparent pour la barre d'état Android (notifications) : icons/badge-96.png"""
import os
from PIL import Image, ImageDraw
S = 384
im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
W = (255, 255, 255, 255)
cx, cy = S / 2, S / 2
d.rounded_rectangle([cx - 150, cy - 18, cx + 150, cy + 18], 12, fill=W)        # barre
for s in (-1, 1):
    a, b = sorted((cx + s * 70, cx + s * 120)); d.rounded_rectangle([a, cy - 120, b, cy + 120], 22, fill=W)   # gros disque
    a, b = sorted((cx + s * 130, cx + s * 168)); d.rounded_rectangle([a, cy - 80, b, cy + 80], 18, fill=W)    # petit disque
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'icons', 'badge-96.png')
im.resize((96, 96), Image.LANCZOS).save(out)
print(out)
