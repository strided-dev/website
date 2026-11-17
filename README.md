# Arkaya Labs website, take 37

Deployed on Vercel at arkaya-labs.com as a plain static site (`vercel.json`: no build step; `.vercelignore` keeps `src/`, `tools/` and this file off the site). The old strided Astro site lives on the `strided-legacy` branch.
Footer: "Copyright 2026 the Arkaya Labs authors". Contact: hello@arkaya-labs.com.

Take 37: GitHub links point to github.com/arkaya-labs. Take 36: the contact address is now hello@arkaya.si (footer
on every page, and Write to us on About).


Take 35: the home headline is now "Intelligence you own, not rent." (it echoes the creed on the About page; the tab
title matches), and the About page's seal is redrawn larger, simpler and Indian in style, with gilt lotus petals (see
The seal and mission). Take 33's changes follow.

Take 33 makes the site read as an open-source project rather than a product launch:
- Early access is gone. The Projects page ends with "Follow the project": a Star on GitHub button and a release-notes
  email signup. Every former "Get early access" button and the footer link now say "Follow the project" and point
  to `projects.html#follow`.
- Products is now Projects (`projects.html`), and Company is now About (`about.html`).
- On About, "Work with us" is now "Contribute" (issues, pull requests and reproductions welcome), and "Write to us"
  asks for questions, reproductions or contributions.
- The footer reads "Copyright 2026 the Arkaya Labs authors": Arkaya Labs is not a registered company (set in
  `imprint()` in `src/build.py`).

Take 31 and 32 fixed the closing paintings when the pages are opened straight from disk, and made the Ellora temple's
lamps breathe visibly.


Take 30 added the Products page, now Projects (painting: the Kailasa temple at Ellora): the three projects at a
glance, then a short section each. The bar reads Projects, Research, About.


Take 28 with all three paintings repainted taller (2576 × 1438, was 2576 × 1093), with open sky across the top, so each
one blends into the page over sky instead of over trees and cliffs. The footer now sits on that sky (see Page colours).
Take 28's fix stays: the fade between page and painting never goes dark, then light, then dark again.

Take 7's layout with take 9's UI and day/night machinery, across four pages:

| Page | Painting | What's on it |
|---|---|---|
| `index.html` (Home) | Taktsang, Paro | Take 7's home: hero, Iris demo carousel, the numbers |
| `projects.html` | Kailasa, Ellora | Three project cards, then vivace, Iris, and strided and gait: key facts and four points each; Follow the project (GitHub, release notes) |
| `research.html` | Delphi | What we make (vivace, Iris, strided and gait), the stack diagram, research notes, the ledger drawn as a chart |
| `about.html` (About) | Chittorgarh | Mission with the large seal, who we are (open source, contribute, write to us), six rules |

Every page keeps take 7's structure: the sticky bar with the progress line, a faint blurred copy of that page's
painting fixed behind the content under a paper wash, and the full-width painting at the very bottom. As the closing
painting rises into view, the wash thickens so the backdrop gives way to it.

## Open it

Run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`.

Opening `index.html` straight from disk also works, but browsers refuse to give `file://` images to WebGL, so the
closing paintings then fall back to a plain day/night crossfade (no breathing lamps, stars or wind). The paintings'
fade masks are inlined in `styles.css` as data: URIs for the same reason: from disk the browser refuses mask image
files, and a mask that fails to load hides the whole painting (take 30 had this bug).

## Day and night (from take 9)

- `theme.js` runs in `<head>` so the first frame is already the right palette. First visit follows the system
  setting (or the host page's theme); clicking the sun/moon remembers the choice under `ak-theme`, shared across
  pages and tabs, and it always wins over a host that sets its own theme. Where storage is blocked, the choice
  still carries from page to page in the same tab.
- Everything turns on one clock and one curve: `--dusk` (3.2 s) and `--ease` in `styles.css`.
- The brand mark and the seal swap to their dark-paper version at night.
- The closing painting on each page is a canvas (`site.js`): a WebGL pass crossfades day into night on the same
  --dusk tween. After dark the flames and lit windows breathe and a few stars twinkle. Nothing in the picture moves or
  bends; the lamp layer holds only the lamps themselves (see below), so lit walls and trees stay still. The two still images stay underneath, so with reduced motion or without WebGL the
  picture still crossfades.

## The seal and mission

The seal, "Intelligence should be owned, not rented." and the Sui juris motto live only on the About page, as the
centrepiece of its mission section. Since take 35 the seal is drawn by `tools/seal.py` (run it, then rebuild) and is Indian in its vocabulary, kept to a
few bold rings: a lobed, cusped edge like a Mughal or Rajput medallion with a gold jewel in each lobe, a dotted rangoli
ring, the inscription (ARKAYA LABS · MMXXVI over the top, SUI JURIS under the bottom) with lotus buds at three and
nine, and a two-layer gilt lotus rosette, as carved on a temple ceiling, around an enamel medallion holding the mark.
Its colours (ink, `--gold`, the enamel; the petals are gold by day and bronze by night) are set in `styles.css` under
"The seal", so it follows the theme. It shows up to 440 px wide, on a soft disc of page colour with a low shadow.

## Page colours

By day each page's background is the sky of its own painting, sampled from the band where the picture fades into
the page. By night the page keeps the deep blue (`#0e1322`) and, just above the closing painting, eases into that
painting's moonlit sky over a long fade (`.ark-lead` and `--ark-lead` near the end of `styles.css`), so there is no
edge. The header, demo frame and lines are mixed from the page colour; the ledger's dark band fades in and out.

The fade is not one flat colour any more. Up to take 27 it was (`--ark-sky`), and wherever the top of a painting is
darker than that colour (Paro's pines and cliff, Delphi's left sky and right-hand cliffs) the page went dark, then a
lit band, then dark again. Now each painting has two small strips, `assets/<name>.lead.png` (day) and
`<name>.night.lead.png` (night), made by `tools/lead_strips.py` from the painting's own top edge: column by column the
fade arrives at the colour actually at the top of the picture, never lighter than the old sky colour, and dark masses
spread softly outward as they rise instead of standing as stripes. In every column the colour moves one way only,
from the page into the picture. The night strip fades in over the day one on the --dusk clock, and both share one mask
(the old mask also ended on a sudden stop that drew a faint light line at the top of the picture; it is now flat at
both ends).

The paintings have open sky across their top fifth, and the footer sits on it: the picture is drawn up under the
footer (`.ark-reveal` in `styles.css`), a little further on short, wide windows, so that at the bottom of the page
the footer always clears the top bar (checked from 1280 × 720 to 2560 × 1440, and on phones).

## Editing

The four pages are built from `src/pages/*.html` plus shared pieces in `src/partials/` (seal, stack diagram) and the
header, footer and painting blocks in `src/build.py`. After editing, run `python3 src/build.py`. Editing the built
HTML directly also works, but the next build overwrites it.

- Demo videos: as in take 7, set `videoSrc` per demo at the top of `demos.js`. The carousel advances by itself
  after about 4 s on each demo (`AUTO_ADVANCE_MS`; a gold arc on the next arrow shows the time left), pauses 6 s after you touch it (`RESUME_MS`), and stops for
  keyboard focus, the Pause motion button and reduced motion.
- Release-notes signup: set `data-endpoint` on `<form id="signup">` in `src/pages/projects.html` (Buttondown,
  Formspree, or your own URL). It posts JSON `{email}`. Until then it says release notes are not set up yet and
  points people to GitHub.
- Backdrop strength: `WASH` in `site.js` (default .73, so ~27% of the painting shows through).
- The ledger: edit the lists at the top of `src/ledger.py`, then rebuild. Engine rows are drawn as the difference
  from the engine named on the row (right of centre = better), on one shared −60 % to +60 % axis; anything bigger is
  clipped with a break mark and labelled in words. Blue = ahead, lotus pink = behind (checked for colour-blind
  separation in both modes). The exact numbers are under "Show the numbers as a table".

## Swapping paintings

Put `<name>.webp` (day) and `<name>.night.webp` (night) in `assets/` at the same size, plus half-width
`<name>.small.webp` / `<name>.night.small.webp` for the blurred backdrop. Then make the lamp/star layer:

    python3 tools/masks.py <name> --sun <moon x>,<moon y> --sky <how far down the sky reaches>   # stars
    python3 tools/lamps.py <name>                                                               # flames

`lamps.py` keeps only small, bright, warm points that stand out from their surroundings (flames, lit windows,
lamp strings) and drops anything larger than a lamp, and (since take 29) the faint warm residue between lamps, so lit
hillsides never breathe; it writes a preview to /tmp to check by eye. Chittorgarh used
`--size 6 --min 0.12`; Paro and Delphi the defaults. The `.mask.webp` it also writes is for motion, which the site no longer uses; delete it. Add the
moon position to `PAINT` in `site.js`, and the backdrop rules (`.page-<name>`) and lead-in strip rules
(`.page-<name> .ark-lead::before/::after`) in `styles.css`, and the painting's size to `SIZES` in `src/build.py`.
Paintings should have open sky across roughly their top fifth, with every tree, cliff and cloud below it: the footer
sits on that sky and the page fades into it. If a new painting has another shape, change the backdrop's aspect-ratio
(`.ark-landscape-image`) and the footer overlap (`.ark-reveal`, which assumes a picture 55.82 % as tall as it is wide)
in `styles.css` to match.
The top-edge fade of each closing painting comes from `tools/fade_masks.py` (now a short straight fade, .14 to .20 of
the height, since the tops are open sky); add the new painting to `SHAPES` there and run it. The fade above each painting
carries the painting's canvas grain (`assets/canvas.grain.png`, from `tools/sky_grain.py`, built from the original
full-quality Chittorgarh night painting, whose open sky shows the weave most cleanly). Finally add the painting's day
page colour (its sky, sampled from the top 6 %) and its top-edge sky colours to `PAGE` and `SKY` at the top of
`tools/lead_strips.py` and run it, for the lead-in strips (`SKY` also caps how far the fade may climb toward a lighter
top edge, which keeps the footer readable). Set the same day colour as that page's `--ark-paper` in `styles.css`.
Take 29 used: Paro `--sun 0.298,0.422 --sky 0.56`, Delphi `--sun 0.314,0.388 --sky 0.5`, Chittorgarh (no moon)
`--sun 0.5,-1 --sky 0.45`; take 30's Ellora `--sun 0.612,0.326 --sky 0.45`,
and for its lamps `tools/lamps.py ellora --glow 3` (its lit windows are only a few pixels, so they get a wider halo to
breathe in).
Needs `opencv-python`, `numpy` and `Pillow`.

## Image size

The paintings are 2576 × 1438. That is sharp up to about a 1700 px wide window on a 1.5× display and is fine
everywhere else for a painterly image. For crisp results on large Retina/4K screens, supply them at **3840 × 2144**
(same 1.79 : 1 ratio) and re-run the conversion and masks. Export the night skies at high quality: compression shows
as faint blocks and banding in a smooth dark sky, right where it meets the fade.

## Checked

JavaScript syntax; all four pages in light and dark at 1440 × 900 and 390 × 844 in headless Chrome; WebGL canvases
start on every page; theme toggle lands on the right colours and is remembered across pages. Google Fonts were not
reachable in the test environment, so the screenshots used fallback fonts.

## Navigation

The bar has three links, Projects, Research and About, plus the sun/moon switch. The Arkaya Labs mark goes home. On
phones narrower than 400 px the wordmark shortens to "Arkaya", and below 340 px to the mark alone, so the bar fits.

## Performance on modest machines

- The sun/moon switch uses View Transitions where the browser has them (Chrome, Edge, Safari 18+, recent
  Firefox): the page swaps palette at once and the GPU crossfades one snapshot over 2.4 s, while the icon animates
  live. Older browsers fall back to the CSS fade on `--dusk`.
- The background paintings have their blur baked into `*.small.webp` (no live CSS blur), the backdrop sits on its
  own GPU layer, and there is no frosted-glass blur under the header or the ledger panel.
- The top bar has no band at rest: a soft veil appears behind the nav only while the page is scrolling and fades
  0.7 s after it stops (the delay is in `site.js`).

- Home hero buttons: "Follow the project" (to the end of the Projects page) and "Explore the research". The demo carousel
  has no Pause motion button; it still stops for keyboard focus and reduced motion.
