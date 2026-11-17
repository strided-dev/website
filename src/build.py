"""Build the four pages from src/pages/*.html and the shared partials.
Usage (from anywhere):  python3 src/build.py
Writes index.html, projects.html, research.html and about.html next to styles.css. The built pages are plain static HTML: you can also
edit them directly, but a rebuild overwrites those edits, so prefer editing src/pages and src/partials."""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from ledger import ledger  # noqa: E402
read = lambda p: open(os.path.join(HERE, p), encoding="utf-8").read()

PAGES = {
    # file: (painting, title, description, nav key)
    "index.html": ("paro", "Arkaya Labs — Intelligence you own, not rent.",
                   "Arkaya Labs builds efficient, advanced local AI: Iris, a personal agent, and vivace, the engine that runs it on the computer you already own.", "home"),
    "projects.html": ("ellora", "Projects — Arkaya Labs",
                      "vivace, Iris, strided and gait: an engine, an agent and a tuner, built in the open to run together on the computer you already own.", "projects"),
    "research.html": ("delphi", "Research — Arkaya Labs",
                      "What Arkaya Labs measured, how it was done and what it cost: research notes and the full benchmark ledger.", "research"),
    "about.html": ("chittor", "About — Arkaya Labs",
                 "Arkaya Labs is a small research lab building efficient, advanced local AI. Our mission: intelligence that is owned, not rented.", "about"),
}

# Pixel size of each painting pair (day and night are the same size). All four are this taller shape, with open sky
# across the top, so each blends into the page over sky rather than over trees and cliffs. If one changes shape, change
# the backdrop's aspect-ratio in styles.css (.ark-landscape-image) and the footer overlap (.ark-reveal) to match.
SIZES = {"paro": (2576, 1438), "delphi": (2576, 1438), "chittor": (2576, 1438), "ellora": (2576, 1438)}

PAINTINGS = {
    "paro": ("Taktsang monastery above the Paro valley, Bhutan",
             "A painting of Taktsang monastery clinging to a cliff above the Paro valley in Bhutan, pine forest and morning mist below, in soft daylight",
             "The same valley under a full moon, the monastery's windows lit and a river shining through the mist"),
    "delphi": ("The sanctuary of Apollo at Delphi, Greece",
               "A painting of the sanctuary of Apollo at Delphi beneath the cliffs of Parnassus, olive groves running down to the Gulf of Corinth, in late daylight",
               "The same sanctuary under a full moon, lamps burning in the temple and the gulf silver in the distance"),
    "chittor": ("Chittorgarh fort, Rajasthan",
                "A painting of Chittorgarh fort along its plateau above the plains of Rajasthan, the Tower of Victory rising out of the morning haze",
                "The same fort at night beneath the stars, its walls and temples lined with lamps"),
    "ellora": ("The Kailasa temple at Ellora, Maharashtra",
               "A painting of the Kailasa temple at Ellora, carved down into the rock of the Deccan plateau, a river winding across the plain below a soft, clouded sky",
               "The same temple under a full moon behind thin cloud, lamps lit in its halls and the river pale on the plain"),
}

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Figtree:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">')

THEME_BUTTON = ('<button class="theme" id="theme" type="button" aria-pressed="false" aria-label="Switch to dark mode"><svg viewBox="0 0 24 24" aria-hidden="true"><defs><mask id="bite"><rect width="24" height="24" fill="#fff"/><circle class="bite" cx="30" cy="4" r="7" fill="#000"/></mask></defs>'
                '<g class="rays" stroke-linecap="round" fill="none"><path d="M12 1.5v2.4M12 20.1v2.4M1.5 12h2.4M20.1 12h2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M19.4 4.6l-1.7 1.7M6.3 17.7l-1.7 1.7"/></g><circle class="disc" cx="12" cy="12" r="5.6" mask="url(#bite)"/></svg></button>')


def header(key):
    links = [("projects.html", "Projects", "projects"), ("research.html", "Research", "research"), ("about.html", "About", "about")]
    nav = "".join(f'<a href="{h}"' + (' aria-current="page"' if k == key else "") + f'>{t}</a>' for h, t, k in links)
    return ('<header class="ark-header">\n'
            '  <a class="ark-brand" href="index.html" aria-label="Arkaya Labs, home"><span class="mkw"><img class="mk light" src="assets/mark.svg" alt=""><img class="mk dark" src="assets/mark-dark.svg" alt=""></span>Arkaya <span>Labs</span></a>\n'
            f'  <nav aria-label="Site">{nav}{THEME_BUTTON}</nav>\n'
            '</header>')


def seal_band(major=False):
    seal = read("partials/seal.svg").strip()
    if major:
        return seal  # the lab page places the seal itself, inside its mission section
    return ('<section class="ark-seal-band" aria-label="Our mission">\n' + seal +
            '\n<p class="creed">Intelligence should be owned, not rented.</p>\n'
            '<p class="motto">Sui juris: in one\'s own right, under no one else\'s authority.</p>\n</section>')


def imprint(name):
    place = PAINTINGS[name][0]
    return ('<footer class="ark-imprint">\n'
            '  <a href="projects.html">Projects</a><a href="research.html">Research</a><a href="about.html">About</a><a href="projects.html#follow">Follow the project</a>'
            '<a href="https://github.com/arkaya-labs">GitHub</a><a href="mailto:hello@arkaya-labs.com">hello@arkaya-labs.com</a>\n'
            f'  <p class="fine">Copyright 2026 the Arkaya Labs authors · Nothing here is a promise; a row marked not run was not run. · Painting: {place}.</p>\n'
            '</footer>')


def painting(name):
    _, day, night = PAINTINGS[name]
    w, h = SIZES[name]
    return (f'<section class="ark-reveal" aria-label="{PAINTINGS[name][0]}">\n'
            '  <div class="ark-lead" aria-hidden="true"></div>\n'
            '  <div class="ark-painting-pair">\n'
            f'    <img class="ark-final-painting ark-painting-day" src="assets/{name}.webp" width="{w}" height="{h}" alt="{day}" loading="lazy" decoding="async" data-live="{name}">\n'
            f'    <img class="ark-final-painting ark-painting-night" src="assets/{name}.night.webp" width="{w}" height="{h}" alt="{night}" loading="lazy" decoding="async" aria-hidden="true">\n'
            '  </div>\n</section>')


for out, (name, title, desc, key) in PAGES.items():
    body = read(f"pages/{out}")
    body = (body.replace("{{SEAL_BAND}}", seal_band()).replace("{{SEAL}}", seal_band(major=True))
                .replace("{{STACK}}", read("partials/stack.html").strip()).replace("{{LEDGER}}", ledger()))
    extra = '\n<script src="demos.js" defer></script>' if "ark-demos" in body else ""
    page = f'''<!doctype html>
<html lang="en" class="page-{name}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f3ebdc">
<meta name="description" content="{desc}">
<title>{title}</title>
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
{FONTS}
<script src="theme.js"></script>
<link rel="preload" as="image" href="assets/{name}.small.webp">
<link rel="preload" as="image" href="assets/{name}.night.small.webp">
<link rel="stylesheet" href="styles.css">
<script src="site.js" defer></script>{extra}
</head>
<body>
<div id="arkaya-site">
<div class="ark-page">
<div class="ark-landscape" aria-hidden="true"><div class="ark-landscape-image ark-landscape-day"></div><div class="ark-landscape-image ark-landscape-night"></div></div>
<div class="ark-wash" aria-hidden="true"></div>
<div class="ark-content">
{header(key)}
<main>
{body.strip()}
</main>
{imprint(name)}
{painting(name)}
</div>
</div>
</div>
</body>
</html>
'''
    assert "{{" not in page, out
    open(os.path.join(OUT, out), "w", encoding="utf-8").write(page)
    print("built", out, len(page) // 1024, "KB")
