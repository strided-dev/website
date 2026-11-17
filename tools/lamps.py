"""Precise lamp layer for a painting pair: only the flames and lit windows, not the walls they light.

Writes assets/<name>.lamps.webp at full size:
  R  lamp cores: small, bright, warm points in the night picture (a white top-hat keeps anything wider than a lamp out)
  G  a tight glow around each core (a few pixels), which breathes with it
  B  where stars may show: kept from the existing lamps file (made by masks.py)

Usage: python3 tools/lamps.py chittor [--size 9] [--min 0.10] [--glow 1] [--exclude x0,y0,x1,y1 ...] [--max-area px]
  --size     the widest a lamp can be, in pixels at 1288 px width (bigger lets in larger windows)
  --min      how much brighter than its surroundings a point must be (0..1)
  --exclude  rectangles (fractions of width/height) to leave out entirely, e.g. the moon
  --glow     halo size around each lamp (1 = tight). Raise it for paintings whose lamps are only a few pixels, such as
             Ellora's temple windows, or the breathing is too small to see
Prints how many lamps it found and writes <name>.lamps-preview.jpg in /tmp to check by eye."""
import argparse, os
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, "..", "assets")
ap = argparse.ArgumentParser(); ap.add_argument("name")
ap.add_argument("--size", type=float, default=9); ap.add_argument("--min", type=float, default=.10)
ap.add_argument("--exclude", action="append", default=[]); ap.add_argument("--glow", type=float, default=1)
ap.add_argument("--max-area", type=float, default=0, help="largest lamp, in px at 1288 width (default: 1.6 x size, squared)")
a = ap.parse_args()

night = cv2.imread(os.path.join(ART, a.name + ".night.webp")); h, w = night.shape[:2]
day = cv2.resize(cv2.imread(os.path.join(ART, a.name + ".webp")), (w, h), interpolation=cv2.INTER_AREA)
old = cv2.imread(os.path.join(ART, a.name + ".lamps.webp"))
stars = cv2.resize(old[..., 0], (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255  # BGR: B = stars

scale = w / 1288
k = max(3, int(round(a.size * scale)) | 1)
L = cv2.cvtColor(night, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
Ld = cv2.cvtColor(day, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
# white top-hat: brightness that stands above its neighbourhood within a lamp-sized window
tophat = cv2.morphologyEx(L, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k * 2 + 1, k * 2 + 1)))
b, g, r = [c.astype(np.float32) / 255 for c in cv2.split(night)]
warm = np.clip((r - b) * 3, 0, 1) * np.clip((r + g) / 2 * 1.4, 0, 1)
brighter_than_day = np.clip((L - Ld * .8) * 4, 0, 1)        # lit at night, not just a pale wall by day
core = np.clip((tophat - a.min) / .18, 0, 1) * warm * brighter_than_day * (1 - np.clip(stars * 2, 0, 1))
yy, xx = np.mgrid[0:h, 0:w]
for rect in a.exclude:
    x0, y0, x1, y1 = (float(v) for v in rect.split(","))
    core[(xx >= x0 * w) & (xx <= x1 * w) & (yy >= y0 * h) & (yy <= y1 * h)] = 0
# drop anything bigger than a lamp: a lit facade or a glowing tree is a broad region, not a point
maxa = (a.max_area or (a.size * 1.6) ** 2) * scale * scale
n0, lab, st, _ = cv2.connectedComponentsWithStats((core > .12).astype(np.uint8))
big = np.zeros(n0, bool); big[1:] = st[1:, cv2.CC_STAT_AREA] > maxa
core[big[lab]] = 0
core[core <= .12] = 0                                         # the faint residue between lamps is lit wall or warm haze
core = cv2.GaussianBlur(core, (0, 0), .6 * scale)
core = np.clip(core * 1.5, 0, 1)
halo = core if a.glow <= 1 else cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2 * a.glow * scale) * 2 + 1,) * 2))
glow = np.clip(cv2.GaussianBlur(halo, (0, 0), 2.5 * scale * a.glow) * 2.2, 0, 1)
n, _ = cv2.connectedComponents((core > .35).astype(np.uint8))
out = np.dstack([stars, glow, core])                          # BGR on disk: B stars, G glow, R core
cv2.imwrite(os.path.join(ART, a.name + ".lamps.webp"), (out * 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 94])
prev = night.astype(np.float32).copy(); prev[core > .35] = (255, 255, 0); prev[(glow > .3) & (core <= .35)] *= .5
cv2.imwrite(f"/tmp/{a.name}.lamps-preview.jpg", prev.astype(np.uint8))
print(a.name, "lamps:", n - 1, "core px %.3f%%" % ((core > .35).mean() * 100), "glow px %.2f%%" % ((glow > .3).mean() * 100))
