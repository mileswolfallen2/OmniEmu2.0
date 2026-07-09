#!/usr/bin/env python3
"""Generate app icon for all platforms using Pillow."""
import os
from PIL import Image, ImageDraw

SIZE = 1024
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

cx = cy = SIZE // 2
r = int(SIZE * 0.42)

# Outer circle (purple)
draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(108, 99, 255, 255))

# Inner circle (slightly darker)
ir = int(r * 0.7)
draw.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(90, 80, 220, 255))

# Ring hole
hr = int(r * 0.28)
draw.ellipse([cx - hr, cy - hr, cx + hr, cy + hr], fill=(108, 99, 255, 255))

# Center hole (transparent center of 'O')
cr = int(r * 0.17)
draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(90, 80, 220, 255))

os.makedirs('assets', exist_ok=True)
img.save('assets/icon.png')
print(f'Generated assets/icon.png ({os.path.getsize("assets/icon.png")} bytes)')
