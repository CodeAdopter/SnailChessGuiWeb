# Snail Chess GUI website

A static site, no build step. Deploy the folder to Vercel as is (framework preset: Other).

## Swapping screenshots

1. Take a 2400x1500 screenshot of the app (1600x1000 window at 150% zoom).
2. Save it as a PNG in `shots-src/`, with the same name as the one it replaces (for example `3d-library.png`).
3. Run `python tools/make-images.py` (needs Pillow). Pass names to redo only some: `python tools/make-images.py 3d-library effects`.

That writes `img/shots/<name>-800.webp`, `-1400.webp` and `-2400.webp`. The board crops for the costumes and effects
are set in `CROPS` in the script, and `3d-library` also makes `img/og.jpg`, the link preview image.

New screenshots go in the gallery through the `SHOTS` list in `js/site.js`. The hero's rooms are in `ROOMS` and the
themes band in `THEMES`, in the same file; each theme carries its background, text and accent colours from the app.

`shots-src/` and `tools/` are left out of the deploy by `.vercelignore`.

## Preview locally

The site uses root paths such as `/css/site.css`, so serve the folder rather than opening the file:

    python -m http.server 8000

then open http://localhost:8000.
