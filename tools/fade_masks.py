"""Per-painting fade maps for the closing painting's top edge: assets/<name>.fade.png (alpha only, stretched over the
picture), also written into styles.css as data: URIs between the "fade masks" markers. Inlined because browsers fetch
CSS mask images under cross-origin rules: opened straight from disk (file://) a mask file is refused, and a mask that
fails to load hides the whole painting. Each column of the picture fades in over its own distance: short over open sky and the moon, so the moon is
never veiled, and long where cliffs or trees reach the top edge, so they dissolve gradually instead of looking cut.

Edit SHAPES (x position across the picture -> how far down the fade runs, as a fraction of its height) and run
    python3 tools/fade_masks.py"""
import base64, io, os, re
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(HERE, "..", "assets")
W, H = 512, 256
SHAPES = {
    # x: fade length. Moon: Delphi at .31,.39, Paro at .30,.42: both well below the fade.
    "delphi":  [(0, .14), (1, .14)],                                                    # open sky across the top (2576 x 1438)
    "paro":    [(0, .14), (1, .14)],                                                    # open sky across the top (2576 x 1438)
    "chittor": [(0, .20), (1, .20)],                                                    # open starry sky all the way across
    "ellora":  [(0, .14), (1, .14)],                                                    # open sky above the clouds (2576 x 1438)
}


def ease(t):  # smootherstep: no visible start or end to the ramp
    t = np.clip(t, 0, 1)
    return t * t * t * (t * (t * 6 - 15) + 10)


rules = []
for name, pts in SHAPES.items():
    xs, es = zip(*pts)
    x = (np.arange(W) + .5) / W
    end = np.interp(x, xs, es)                                  # fade length per column
    # soften the transitions between columns so the fade line itself never shows a kink
    k = np.exp(-np.linspace(-2.5, 2.5, 41) ** 2); k /= k.sum()
    end = np.convolve(np.pad(end, 20, mode="edge"), k, mode="valid")
    y = (np.arange(H) + .5) / H
    alpha = ease(y[:, None] / end[None, :])
    img = np.zeros((H, W, 4), np.uint8); img[..., 3] = (alpha * 255).round().astype(np.uint8)
    buf = io.BytesIO(); Image.fromarray(img, "RGBA").save(buf, "PNG", optimize=True)
    open(os.path.join(ART, f"{name}.fade.png"), "wb").write(buf.getvalue())
    uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    rules.append(f".page-{name} .ark-painting-pair {{ -webkit-mask-image: url('{uri}'); mask-image: url('{uri}'); }}")
    print(name, "fade.png written")

css = os.path.join(HERE, "..", "styles.css"); s = open(css, encoding="utf-8").read()
s, n = re.subn(r"(/\* fade masks: written by tools/fade_masks\.py[^\n]*\*/\n).*?(/\* end fade masks \*/)",
               lambda m: m.group(1) + "\n".join(rules) + "\n" + m.group(2), s, flags=re.S)
assert n == 1, "fade masks markers not found in styles.css"
open(css, "w", encoding="utf-8").write(s)
print("styles.css fade masks updated")
