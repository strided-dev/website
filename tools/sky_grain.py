"""Canvas grain for the fade above each closing painting: assets/canvas.grain.png, shared by all three pages.

Takes a patch of open sky from the painting, keeps only its fine texture (the canvas weave and the smallest brush
marks, with the colour and the broad strokes removed), and mirrors it into a seamless grey tile. The page lays it over
the fade's colour in overlay mode, at the painting's own scale, so the fade carries the same grain as the painted sky.

python3 tools/sky_grain.py [folder with the original night paintings as <name>.night.jpg/png]
Use the originals if you have them: the site's .webp copies are compressed, and in a smooth sky compression blocks
look like texture."""
import sys
import os
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, "..", "assets")
PATCH = 256          # source pixels (at the painting's 2576 px width); the tile is twice this, mirrored
SKY = {              # where to look for open sky (x0, x1, y0, y1 as fractions); the calmest patch wins.
    # All three paintings share one canvas; Chittorgarh's wide, cloudless night sky shows the weave most cleanly
    # (Paro's smooth sky carries JPEG blocks rather than weave, and Delphi's is full of cloud).
    "chittor": (.05, .95, .0, .2),
}
STRENGTH = 9.0       # grey levels of grain either side of mid-grey (overlay: about +-3 levels on a dark sky)

for name, (ax0, ax1, ay0, ay1) in SKY.items():
    src = None
    if len(sys.argv) > 1:
        for ext in (".png", ".jpg", ".jpeg", ".webp"):
            if os.path.exists(os.path.join(sys.argv[1], name + ".night" + ext)): src = os.path.join(sys.argv[1], name + ".night" + ext); break
    im = cv2.imread(src or os.path.join(ART, name + ".night.webp"))
    h, w = im.shape[:2]
    G = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    HP = G - cv2.GaussianBlur(G, (0, 0), 3.0)                 # fine detail only
    best = None
    for y0 in range(int(ay0 * h), max(int(ay0 * h) + 1, int(ay1 * h) - PATCH), 16):
        for x0 in range(int(ax0 * w), max(int(ax0 * w) + 1, int(ax1 * w) - PATCH), 16):
            p = HP[y0:y0 + PATCH, x0:x0 + PATCH]
            if p.shape != (PATCH, PATCH): continue
            sd = p.std() + 1e-6
            broad = cv2.GaussianBlur(G[y0:y0 + PATCH, x0:x0 + PATCH], (0, 0), 6).std()   # cloud edges, horizon, moon glow
            score = broad
            if best is None or score < best[0]: best = (score, x0, y0)
    _, x0, y0 = best
    hp = HP[y0:y0 + PATCH, x0:x0 + PATCH]
    print(name, "patch at", round(x0 / w, 3), round(y0 / h, 3), "score", round(best[0], 1))
    # erase stars and specks (and their halos) so they do not repeat across the tile: they become flat grain-free
    # spots, which then take the weave from a neighbouring patch of the same tile
    sd = np.median(np.abs(hp)) * 1.4826 + 1e-6
    spots = cv2.dilate((np.abs(hp) > 3.2 * sd).astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
    shifted = np.roll(np.roll(hp, 37, 0), 53, 1)
    hp = np.where(spots, shifted, hp)
    hp = np.clip(hp, -2.5 * sd, 2.5 * sd)
    hp = hp / (hp.std() + 1e-6) * STRENGTH
    tile = np.block([[hp, hp[:, ::-1]], [hp[::-1, :], hp[::-1, ::-1]]])   # mirrored: seamless at every edge
    out = np.clip(128 + tile, 0, 255).astype(np.uint8)
    cv2.imwrite(os.path.join(ART, "canvas.grain.png"), cv2.merge([out, out, out]), [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print(name, "grain tile", out.shape, "std %.1f" % out.std())
