"""Masks for a painting pair. Given <name>.webp (day) and <name>.night.webp (night) in ../assets, writes
  <name>.mask.webp   R water (shimmer), G sway (a little wind), B sky (slow drift, stars)
  <name>.lamps.webp  R lamps and windows (what breathes at night), G the soft halo around them, B where stars may show
and records the sun in paintings.json. Water and wind come only from polygons you give, so nothing else moves.

Usage: python3 masks.py coast --sun 0.64,0.20 --sky 0.5 --water "x,y x,y ..." [--sway "x,y x,y ..."] [--drift x0,y0,x1,y1]
  --sun    x,y of the sun disc as fractions of width and height (where the moon is at night)
  --sky    the sky reaches no lower than this fraction of the height
  --water  a polygon "x,y x,y x,y ..." (fractions) that is water; repeat for more
  --sway   a polygon of foliage that may move in the wind; repeat for more
  --drift  a rectangle x0,y0,x1,y1 of mist that should drift with the sky; repeat for more
Open the written masks and adjust the numbers until they look right; they are small and quick to redo."""
import argparse, json, os
import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, "..", "assets")
MW = 1288
ap = argparse.ArgumentParser(); ap.add_argument("name"); ap.add_argument("--sun", required=True); ap.add_argument("--sky", type=float, default=.5)
ap.add_argument("--water", action="append", default=[]); ap.add_argument("--sway", action="append", default=[]); ap.add_argument("--drift", action="append", default=[])
ap.add_argument("--sun-r", type=float, default=.025)
a = ap.parse_args()

day = cv2.imread(os.path.join(ART, a.name + ".webp")); night = cv2.imread(os.path.join(ART, a.name + ".night.webp"))
h, w = day.shape[:2]
if night.shape[:2] != (h, w): night = cv2.resize(night, (w, h), interpolation=cv2.INTER_AREA)
mh = round(h * MW / w)
d = cv2.resize(day, (MW, mh), interpolation=cv2.INTER_AREA); n = cv2.resize(night, (MW, mh), interpolation=cv2.INTER_AREA)
yy, xx = np.mgrid[0:mh, 0:MW].astype(np.float32); yy /= mh; xx /= MW
gray = cv2.cvtColor(d, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255

def poly_mask(polys):
    m = np.zeros((mh, MW), np.float32)
    for poly in polys:
        pts = np.array([[float(v) * (MW if i == 0 else mh) for i, v in enumerate(pt.split(","))] for pt in poly.split()], np.int32)
        cv2.fillPoly(m, [pts], 1.0)
    return m

# sky: the night picture tells sky from snow and haze far better than the day one (its sky is the one deep blue thing):
# a pixel is sky when it is close to the top band's colours in both pictures, no lower than --sky, and joined to the top edge
def near_top(im, k):
    L = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    top = L[: int(mh * .08)].reshape(-1, 3)
    cents = top[np.random.default_rng(1).choice(len(top), 32, replace=False)]
    return np.min(np.stack([np.linalg.norm(L - c, axis=2) for c in cents]), axis=0) < k
sky = (near_top(d, 28) & near_top(n, 30) & (yy < a.sky)).astype(np.uint8)
sky = cv2.morphologyEx(sky, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
sky = cv2.morphologyEx(sky, cv2.MORPH_CLOSE, np.ones((21, 21), np.uint8))
nlab, lab_im = cv2.connectedComponents(sky)
sky = np.isin(lab_im, list(set(np.unique(lab_im[0])) - {0})).astype(np.uint8)
stars = cv2.GaussianBlur(sky.astype(np.float32), (0, 0), 2)            # where stars may twinkle: the whole sky
sky = cv2.erode(sky, np.ones((25, 25), np.uint8)).astype(np.float32)     # where clouds may drift: well inside it
sky = cv2.GaussianBlur(sky, (0, 0), 8)
for r in a.drift:
    x0, y0, x1, y1 = (float(v) for v in r.split(","))
    box = ((xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)).astype(np.float32)
    sky = np.maximum(sky, cv2.GaussianBlur(box, (0, 0), 14) * .5)
# water and wind: only inside the polygons, softened at the edge so nothing pops
water = cv2.GaussianBlur(cv2.erode(poly_mask(a.water), np.ones((5, 5), np.uint8)), (0, 0), 4)
sway = cv2.GaussianBlur(cv2.erode(poly_mask(a.sway), np.ones((9, 9), np.uint8)), (0, 0), 10)
m = np.dstack([sky, sway, water])  # OpenCV writes BGR: the file's R is water, G sway, B sky
cv2.imwrite(os.path.join(ART, a.name + ".mask.webp"), (np.clip(m, 0, 1) * 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 92])
# lamps: where the night is brighter than the day and warm, outside the sky and the water (the moon and its road live there)
ln = cv2.cvtColor(n, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
warm = (n[..., 2].astype(np.float32) - n[..., 0].astype(np.float32)) / 255
lamp = np.clip((ln - gray * .5 - .16) / .25, 0, 1) * np.clip(warm * 5, 0, 1) * (1 - stars) * (1 - np.clip(water * 2, 0, 1))
sx0, sy0 = (float(v) for v in a.sun.split(","))
lamp *= (np.hypot((xx - sx0) * MW, (yy - sy0) * mh) > MW * .08)
lamp = cv2.GaussianBlur(np.clip(lamp * 1.6, 0, 1), (0, 0), .8)
halo = np.clip(cv2.GaussianBlur(lamp, (0, 0), 9) * 2.2 + cv2.GaussianBlur(lamp, (0, 0), 28) * 2.5, 0, 1)
cv2.imwrite(os.path.join(ART, a.name + ".lamps.webp"), (np.dstack([stars, halo, lamp]) * 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 92])
mp = os.path.join(ART, "paintings.json"); meta = json.load(open(mp)) if os.path.exists(mp) else {}
meta[a.name] = dict(sun=[sx0, sy0, a.sun_r], hz=float(a.sky), name=a.name)
json.dump(meta, open(mp, "w"), indent=1)
print("masks", a.name, "sky %.0f%%" % (sky.mean() * 100), "water %.0f%%" % (water.mean() * 100), "sway %.0f%%" % (sway.mean() * 100), "lamps %.2f%%" % (lamp.mean() * 100))
