"""Turns the app screenshots in shots-src/ into the images the site uses.

Drop a 2400x1500 PNG into shots-src/ (same name as the one it replaces, e.g. 3d-library.png)
and run:  python tools/make-images.py
Needs Pillow (pip install pillow).

For every PNG it writes img/shots/<name>-800.webp, -1400.webp and -2400.webp.
Shots listed in CROPS also get a square crop of the board in img/crops/<name>.webp.
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "shots-src")
OUT = os.path.join(ROOT, "img", "shots")
CROPS_OUT = os.path.join(ROOT, "img", "crops")
WIDTHS = [800, 1400, 2400]

# Board boxes in a 2400x1500 screenshot at 150% zoom: (left, top, right, bottom), output size.
# With the Theme background the board fills the left column; with a picture background it sits inset.
THEME_BOARD = (21, 131, 1365, 1475)
INSET_BOARD = (101, 212, 1285, 1396)
CROPS = {
    "costume-halloween": (INSET_BOARD, 720),
    "costume-christmas": (THEME_BOARD, 720),
    "costume-party": (THEME_BOARD, 720),
    "effects": (INSET_BOARD, 1100),
}


def main():
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CROPS_OUT, exist_ok=True)
    for file in sorted(os.listdir(SRC)):
        name, ext = os.path.splitext(file)
        if ext.lower() != ".png" or (only and name not in only):
            continue
        im = Image.open(os.path.join(SRC, file)).convert("RGB")
        for w in WIDTHS:
            h = round(im.height * w / im.width)
            im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f"{name}-{w}.webp"), quality=82, method=6)
        if name in CROPS:
            box, size = CROPS[name]
            im.crop(box).resize((size, size), Image.LANCZOS).save(os.path.join(CROPS_OUT, f"{name}.webp"), quality=85, method=6)
        if name == "3d-library":
            og = im.resize((1200, 750), Image.LANCZOS).crop((0, 60, 1200, 690))
            og.save(os.path.join(ROOT, "img", "og.jpg"), quality=85)
        print("made", name)


if __name__ == "__main__":
    main()
