"""Lead-in colour for the fade above each closing painting: assets/<name>.lead.png (day) and <name>.night.lead.png.

Why: the lead-in used to be one flat colour per page. Wherever the painting's top edge is darker than that colour
(Paro's pines and cliff, Delphi's left-hand sky and right-hand cliffs) the eye met dark page, then a lit band, then
dark picture again. These strips carry the painting's own top edge instead, so every column runs one way only, from
the page colour into the picture, with nothing lighter (or, by day, darker) in between.

The seam (bottom row, which also fills in behind the painting's faded top): per column, the picture's top-edge colour,
softened, and never further from the page colour than the old flat sky colour (SKY) went. So where the edge is darker
than SKY it takes the edge; where it is lighter (the moon, lit cloud) it stops at SKY's brightness, tinted toward the
edge, and the footer text above keeps the contrast it has now.

Going up: whatever lies nearest the page colour spreads outward, a little wider with every row (a widening minimum over
the softened seam, then a fixed soft blur), until the top row is one even colour. Dark masses such as Paro's pines therefore stay dark all the
way up and spread into soft shoulders instead of standing as stripes, open sky keeps its long fade, and in every column
the colour only ever moves away from the page colour as it comes down toward the picture.

    python3 tools/lead_strips.py"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, "..", "assets")
W, H, GRAD = 256, 48, 32  # strip size: GRAD rows of fade over the lead-in, then seam rows that fill in below it
EDGE_ROWS = .02          # how far down the painting to read its top edge (fraction of height); median, so stars drop out
SOFT = .03               # blur applied to every row (fraction of width): no stripes, no kinks
SPREAD = .45             # how far the page-nearest colour has spread sideways by the top row (fraction of width)
PAGE = {"day": {"paro": "#eae2d6", "delphi": "#f7dfc7", "chittor": "#eee2d2", "ellora": "#e1d7c8"},
        "night": {"paro": "#0e1322", "delphi": "#0e1322", "chittor": "#0e1322", "ellora": "#0e1322"}}
SKY = {"day": {"paro": "#eae2d6", "delphi": "#f7dfc7", "chittor": "#eee2d2", "ellora": "#e1d7c8"},          # each painting's top-edge sky colour
       "night": {"paro": "#112243", "delphi": "#122140", "chittor": "#101c33", "ellora": "#182d48"}}


def rgb(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
def lum(c): return c[..., 0] * .2126 + c[..., 1] * .7152 + c[..., 2] * .0722


def blur_x(a, sigma):
    r = int(3 * sigma) + 1
    k = np.exp(-.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
    p = np.pad(a, ((r, r), (0, 0)), mode="reflect")
    return np.stack([np.convolve(p[:, c], k, mode="valid") for c in range(a.shape[1])], 1)


def nearest_page(cols, dist, r):
    """For each column, the colour of the column within r that lies nearest the page colour."""
    out = np.empty_like(cols)
    for x in range(len(cols)):
        lo, hi = max(0, x - r), min(len(cols), x + r + 1)
        out[x] = cols[lo + np.argmin(dist[lo:hi])]
    return out


for name in PAGE["day"]:
    for mode, suffix in (("day", ""), ("night", ".night")):
        im = np.asarray(Image.open(os.path.join(ART, f"{name}{suffix}.webp")).convert("RGB")).astype(float)
        h, w = im.shape[:2]
        edge = np.median(im[:max(2, int(EDGE_ROWS * h))], axis=0)                 # (w, 3): the picture's top edge
        edge = edge[:w // W * W].reshape(W, -1, 3).mean(1)                          # down to the strip's width
        page, sky = rgb(PAGE[mode][name]), rgb(SKY[mode][name])
        lp, le, ls = lum(page), lum(edge), lum(sky)
        # how far from page toward the edge to go: as far as SKY went, and never past the edge itself
        d = le - lp
        safe = np.where(np.abs(d) < 1, 1, d)
        s = np.where(np.abs(d) < 1, 1.0, np.clip((ls - lp) / safe, 0, 1))
        seam = blur_x(page + s[:, None] * (edge - page), SOFT * W)                 # (W, 3); softened first, so one
        dist = np.abs(lum(seam) - lp)                                              # dark crevice can't spread on its own
        rows = []
        for j in range(H):
            up = max(0, 1 - (j + .5) / GRAD)                                       # 0 at the seam (and below), 1 at the top
            rows.append(blur_x(nearest_page(seam, dist, int(round(SPREAD * W * up))), SOFT * W))
        out = np.stack(rows)
        Image.fromarray(np.clip(out.round(), 0, 255).astype(np.uint8), "RGB").save(
            os.path.join(ART, f"{name}{suffix}.lead.png"), optimize=True)
        L = lum(out)
        print(f"{name}{suffix}.lead.png  seam {L[-1].min():.0f}-{L[-1].max():.0f}  top {L[0].min():.0f}-{L[0].max():.0f}  page {lp:.0f}")
