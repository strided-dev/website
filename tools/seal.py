"""The About page's seal: writes src/partials/seal.svg (then rebuild with python3 src/build.py).

Indian in its vocabulary and kept to a few bold rings. From the rim in: a lobed, cusped edge like a Mughal or Rajput
medallion, a gold jewel set in each lobe; a dotted rangoli ring; the inscription (ARKAYA LABS · MMXXVI over the top,
SUI JURIS under the bottom) with a small lotus bud at three and nine; and a two-layer gilt lotus rosette, as carved on a
temple ceiling, opening around an enamel medallion that holds the lotus mark.

Colours come from the page through classes (styled in styles.css under "The seal"): ink is currentColor, gold and
lotus are the site's --gold and --lotus, and the enamel matches the mark's own halo (#FAFAF7 by day, #0B0B0C by
night), so the mark's interlaced petals sit seamlessly on it.

    python3 tools/seal.py"""
import math, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "src", "partials", "seal.svg")
C = 240                                    # centre of the 480 x 480 drawing
TOP = "ARKAYA LABS · MMXXVI"
BOTTOM = "SUI JURIS"
LOBES = 20                                 # lobes on the cusped edge
PETALS = 16                                # petals in each layer of the lotus


def pol(r, deg):
    a = math.radians(deg)
    return C + r * math.cos(a), C + r * math.sin(a)


def pt(p): return f"{p[0]:.1f},{p[1]:.1f}"


def ring(r, cls, w):
    return f'<circle cx="{C}" cy="{C}" r="{r}" class="{cls}" stroke-width="{w}" fill="none"/>'


def petal(r0, r1, w):
    """A lotus petal from r0 out to a pointed tip at r1, w wide at its widest, in local coordinates (up = out)."""
    m = r0 + (r1 - r0) * .5
    s = m + (r1 - m) * .55
    return (f"M0,{-r0} C{w * .7:.1f},{-(r0 + 6):.1f} {w:.1f},{-m:.1f} {w * .62:.1f},{-s:.1f} "
            f"Q{w * .2:.1f},{-(r1 - 5):.1f} 0,{-r1} Q{-w * .2:.1f},{-(r1 - 5):.1f} {-w * .62:.1f},{-s:.1f} "
            f"C{-w:.1f},{-m:.1f} {-w * .7:.1f},{-(r0 + 6):.1f} 0,{-r0} Z")


def bud(r, deg, s):
    """A small lotus bud (three petals), pointing away from the centre."""
    x, y = pol(r, deg)
    d = (f"M0,{s * .55} C{-s * .35},{s * .1} {-s * .2},{-s * .55} 0,{-s} C{s * .2},{-s * .55} {s * .35},{s * .1} 0,{s * .55} Z "
         f"M{-s * .12},{s * .5} C{-s * .75},{s * .35} {-s * .95},{-s * .15} {-s * .9},{-s * .45} C{-s * .55},{-s * .2} {-s * .3},{s * .15} {-s * .12},{s * .5} Z "
         f"M{s * .12},{s * .5} C{s * .75},{s * .35} {s * .95},{-s * .15} {s * .9},{-s * .45} C{s * .55},{-s * .2} {s * .3},{s * .15} {s * .12},{s * .5} Z")
    return f'<path class="gf" d="{d}" transform="translate({x:.1f} {y:.1f}) rotate({deg + 90:.1f})"/>'


parts = []
add = parts.append

# the lobed, cusped edge, filled with page colour so the seal reads as one object over the painted backdrop
step = 360 / LOBES
chord = 2 * 207 * math.sin(math.radians(step / 2))
rr = chord / 2 * 1.08                                         # a touch more than a semicircle: deep lobes, sharp cusps
d = [f"M{pt(pol(207, 0))}"]
for i in range(LOBES):
    d.append(f"A{rr:.1f},{rr:.1f} 0 0,1 {pt(pol(207, (i + 1) * step))}")
add(f'<path class="face i" stroke-width="1.8" stroke-linejoin="miter" d="{" ".join(d)} Z"/>')
for i in range(LOBES):
    x, y = pol(213, (i + .5) * step)
    add(f'<circle class="gf" r="3.2" cx="{x:.1f}" cy="{y:.1f}"/>')
add(ring(199, "g", .9))

# rangoli dots, every fifth a little larger
for i in range(60):
    x, y = pol(193, i * 6)
    add(f'<circle class="if" r="{1.6 if i % 5 == 0 else 1}" cx="{x:.1f}" cy="{y:.1f}"/>')
add(ring(187, "i", 1.2))

# inscription
add(f'<path id="sealTop" d="M{C - 160},{C} A160,160 0 0,1 {C + 160},{C}" fill="none"/>')
add(f'<path id="sealBot" d="M{C - 175},{C} A175,175 0 0,0 {C + 175},{C}" fill="none"/>')
txt = 'class="ink-text" font-family="Cormorant Garamond, Georgia, serif" font-weight="600" text-anchor="middle" font-size="22"'
add(f'<text {txt} letter-spacing="6"><textPath href="#sealTop" startOffset="50%">{TOP}</textPath></text>')
add(f'<text {txt} letter-spacing="10"><textPath href="#sealBot" startOffset="50%">{BOTTOM}</textPath></text>')
add(bud(166.5, 0, 9)); add(bud(166.5, 180, 9))
add(ring(146, "i", 1.2)); add(ring(141.5, "g", .7))

# the lotus rosette: a layer of broad petals, and a second layer between them
for r0, r1, w, cls, off in [(64, 134, 20, "lp1", 0), (64, 114, 16, "lp2", 180 / PETALS)]:
    path = petal(r0, r1, w)
    for i in range(PETALS):
        a = i * 360 / PETALS + off
        add(f'<path class="{cls}" stroke-width="1.1" d="{path}" transform="translate({C} {C}) rotate({a:.2f})"/>')

# the enamel medallion and the mark
add(f'<circle cx="{C}" cy="{C}" r="70" class="enamel i" stroke-width="1.4"/>')
add(ring(65.5, "g", .7))
add(f'<image class="mk light" href="assets/mark.svg" x="{C - 61}" y="{C - 61}" width="122" height="122"/>')
add(f'<image class="mk dark" href="assets/mark-dark.svg" x="{C - 61}" y="{C - 61}" width="122" height="122"/>')

svg = ('<svg class="seal" viewBox="0 0 480 480" role="img" aria-label="The Arkaya Labs seal: the lotus mark at the heart of '
       'a lotus rosette, inside a lobed medallion inscribed Arkaya Labs MMXXVI and Sui juris.">\n  '
       + "\n  ".join(parts) + "\n</svg>\n")
open(OUT, "w", encoding="utf-8").write(svg)
print("wrote", os.path.relpath(OUT), f"{len(svg) / 1024:.1f} KB")
