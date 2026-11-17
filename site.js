/* Arkaya Labs, take 10: take 7's layout with take 9's day/night machinery. Shared by all three pages. */

(() => {
'use strict';
/* Take 7's page painting: a faint, blurred landscape stays fixed behind the page under a paper wash. As the closing
   painting rises into view the wash thickens to solid, so the backdrop gives way to the full-colour picture.
 */
const viewport = document.scrollingElement || document.documentElement;
const wash = document.querySelector('.ark-wash');
const reveal = document.querySelector('.ark-reveal');
const header = document.querySelector('.ark-header');
const WASH = .73;                                    // ~27% of the backdrop shows through at the top of the page
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = t => t * t * (3 - 2 * t);
let queued = false;
const paint = () => {
  queued = false;
  if (reveal && wash) {
    const distance = reveal.getBoundingClientRect().top;
    const t = smooth(clamp((innerHeight - distance) / Math.max(1, innerHeight * .8), 0, 1));
    wash.style.opacity = String(WASH + (1 - WASH) * t);
  }
};
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
addEventListener('scroll', queue, { passive: true });
/* The bar behind the nav shows only while the page is moving, and fades away whenever scrolling stops, anywhere on
   the page. The logo, links and switch always stay. */
let idle = null;
addEventListener('scroll', () => {
  if (!header) return;
  header.classList.add('scrolled');
  clearTimeout(idle);
  idle = setTimeout(() => header.classList.remove('scrolled'), 700);
}, { passive: true });
addEventListener('resize', queue, { passive: true });
paint();
})();

(() => {
'use strict';
/* Take 9's living paintings, applied to each page's closing picture. Each painting is two pictures of the same place,
   <name>.webp and <name>.night.webp. One tween runs from 0 (day) to 1 (night) over --dusk whenever the theme changes.
   A WebGL pass crossfades on that tween and, after dark, lets the flames breathe and a few stars twinkle.
   Nothing in the picture moves or bends.
   The two <img> elements stay underneath and crossfade in CSS on the same clock, so the picture still turns with the
   theme without WebGL, with reduced motion, or when opened straight from the disk (file://), where browsers refuse
   to hand images to WebGL. */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDark = window.akIsDark || (() => document.documentElement.dataset.theme === 'dark');
const DUSK = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dusk')) * 1000 || 2600;
let tw = { from: isDark() ? 1 : 0, to: isDark() ? 1 : 0, t0: -1e9 };
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const nightNow = (now = performance.now()) => { const u = Math.min(1, Math.max(0, (now - tw.t0) / DUSK)); return tw.from + (tw.to - tw.from) * ease(u); };
document.addEventListener('ak-theme', e => {
  const k = e.detail.dark ? 1 : 0;
  // while the browser crossfades the whole page (theme.js), the painting jumps; the crossfade already blends it
  tw = document.documentElement.classList.contains('swap') ? { from: k, to: k, t0: -1e9 } : { from: nightNow(), to: k, t0: performance.now() };
});

/* Where each painting's moon sits, for keeping stars out of its glow. Written by tools/masks.py into paintings.json. */
const PAINT = {
  paro:    { sun: [.298, .422, .025] },
  delphi:  { sun: [.314, .388, .025] },
  chittor: { sun: [.5, -1, .025] },
  ellora:  { sun: [.612, .326, .025] }
};
const VS = 'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;v.y=1.-v.y;gl_Position=vec4(a,0,1);}';
/* Nothing in the picture moves or bends. After dark the flames breathe (take 9's strength) and a few stars twinkle.
   The lamp layer (tools/lamps.py) holds only the flames and lit windows, each with a tight glow, so the light lives
   on the lamps themselves and never pulses across a lit wall or a tree. */
const FS = `precision mediump float;varying vec2 v;uniform sampler2D img,nite,lmp;uniform float t,k,asp;uniform vec3 sun;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 uv=v;vec3 L=texture2D(lmp,uv).rgb;vec2 p=uv;
vec3 c=mix(texture2D(img,p).rgb,texture2D(nite,p).rgb,k);
float lit=smoothstep(.5,1.,k);
float ph=noise(uv*vec2(asp,1.)*22.)*6.28;
float br=.07*sin(t*2.4+ph)+.04*sin(t*5.1+ph*1.7)+.03*(noise(vec2(t*7.+ph,ph))-.5);
c*=1.+L.r*lit*br*1.4;
c+=L.g*lit*(.04+.5*br)*vec3(1.,.72,.38);
vec2 su=uv*vec2(asp,1.)*180.;vec2 g=floor(su),f=fract(su);vec2 cp=vec2(.3+.4*hash(g+.1),.3+.4*hash(g+.7));
float star=step(.985,hash(g))*smoothstep(.1,0.,length(f-cp))*(.4+.6*pow(.5+.5*sin(t*(1.+3.*hash(g+2.))+hash(g+3.)*6.3),2.));
float ds=length((uv-sun.xy)*vec2(asp,1.));
c+=star*L.b*lit*(1.-exp(-ds*ds/(sun.z*sun.z*80.)))*vec3(.85,.9,1.)*.7;
gl_FragColor=vec4(c,1.);}`;
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.decoding = 'async'; i.onload = () => ok(i); i.onerror = no; i.src = src; });

async function animate(img) {
  if (reduce || location.protocol === 'file:' || !window.WebGLRenderingContext) return;
  const name = img.dataset.live, base = 'assets/' + name, meta = PAINT[name] || {};
  const sun = meta.sun || [.7, .25, .025];
  const pics = await Promise.all(['.webp', '.night.webp', '.lamps.webp'].map(s => loadImg(base + s)));
  const cv = document.createElement('canvas');
  cv.className = 'ark-live'; cv.setAttribute('aria-hidden', 'true');
  const gl = cv.getContext('webgl', { premultipliedAlpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  try {
    pics.forEach((im, i) => {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      for (const [p, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, val);
    });
  } catch { return; }                                  // tainted images: keep the CSS crossfade
  const U = n => gl.getUniformLocation(pr, n);
  ['img', 'nite', 'lmp'].forEach((n, i) => gl.uniform1i(U(n), i));
  gl.uniform3f(U('sun'), sun[0], sun[1], sun[2]);
  gl.uniform1f(U('asp'), pics[0].width / pics[0].height);
  img.parentNode.appendChild(cv);
  let on = false, shown = false;
  const t0 = performance.now();
  const size = () => {
    const W = img.offsetWidth, H = img.offsetHeight;
    const d = Math.min(1.5, devicePixelRatio || 1, pics[0].width / Math.max(1, W));   // gentle on laptop GPUs; never finer than the painting
    cv.width = Math.max(1, Math.round(W * d)); cv.height = Math.max(1, Math.round(H * d));
    gl.viewport(0, 0, cv.width, cv.height);
  };
  new ResizeObserver(size).observe(img); size();
  const frame = now => {
    if (!on) return;
    gl.uniform1f(U('t'), (now - t0) / 1000); gl.uniform1f(U('k'), nightNow(now));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!shown) { shown = true; requestAnimationFrame(() => cv.classList.add('on')); }
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => { const was = on; on = e.isIntersecting; if (on && !was) requestAnimationFrame(frame); }).observe(cv);
}
const near = new IntersectionObserver((es, o) => es.forEach(e => {
  if (e.isIntersecting) { o.unobserve(e.target); animate(e.target).catch(() => {}); }
}), { rootMargin: '600px' });
document.querySelectorAll('img[data-live]').forEach(img => near.observe(img));
})();

(() => {
'use strict';
/* Take 9's stack: opens when it comes into view, folds back when it leaves, and a button does both by hand.
   Each tab names the layers its adjustment reaches; the others step back. */
const fig = document.querySelector('.stack'); if (!fig) return;
const fold = document.getElementById('fold'), slabs = [...fig.querySelectorAll('.slab')];
let manual = false;
const setOpen = o => {
  fig.classList.toggle('open', o);
  if (fold) { fold.textContent = o ? 'Condense' : 'Expand'; fold.setAttribute('aria-pressed', o ? 'true' : 'false'); }
};
if (fold) fold.addEventListener('click', () => { manual = true; setOpen(!fig.classList.contains('open')); });
new IntersectionObserver(([e]) => { if (!manual) setOpen(e.isIntersecting); }, { threshold: .35 }).observe(fig);
const tabs = [...document.querySelectorAll('.tabs [role=tab]')], panes = [...document.querySelectorAll('.tabpane')];
const pick = b => {
  tabs.forEach(t => { t.setAttribute('aria-selected', t === b ? 'true' : 'false'); t.tabIndex = t === b ? 0 : -1; });
  panes.forEach(p => p.hidden = p.dataset.pane !== b.dataset.tab);
  const on = new Set(b.dataset.spans.split(' '));
  slabs.forEach(s => s.classList.toggle('off', !on.has(s.dataset.i)));
};
tabs.forEach((t, i) => {
  t.addEventListener('click', () => pick(t));
  t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus(); pick(next);
  });
});
})();

(() => {
'use strict';
/* The release-notes signup on the Projects page (take 9's form, cut down to an email). Order of preference: a form
   endpoint set on data-endpoint (Formspree, Buttondown, your own URL; it receives JSON {email}); else the claude.ai
   artifact store; else a plain message pointing to GitHub. */
const form = document.getElementById('signup'); if (!form) return;
const msg = document.getElementById('su-msg'), btn = document.getElementById('su-btn');
const say = (t, cls) => { msg.textContent = t; msg.className = 'su-msg ' + (cls || ''); };
form.addEventListener('submit', async e => {
  e.preventDefault();
  const email = form.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say('That address does not look right.', 'err');
  btn.disabled = true; say('Sending…');
  try {
    const endpoint = form.dataset.endpoint;
    if (endpoint) {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email }) });
      if (!r.ok) throw new Error('endpoint ' + r.status);
    } else {
      const db = window.claude?.use ? await claude.use('db') : null, user = db ? await claude.use('user') : null;
      if (!db || !user) throw new Error('no store');
      await db.collection('release_notes').doc(await user.id()).set({ email, at: new Date().toISOString() });
    }
    form.reset(); say('Done. Release notes will come to that address when something is released.', 'ok');
  } catch {
    say('Release notes are not set up yet. Star the project on GitHub to follow along for now.', 'err');
  }
  btn.disabled = false;
});
})();

(() => {
'use strict';
/* The ledger's tooltip: hover or focus a row to read its full figures. */
const tip = document.querySelector('.lg-tip'); if (!tip) return;
const show = (row, x, y) => {
  tip.textContent = row.dataset.tip; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(innerWidth - r.width - 12, Math.max(12, x + 14)) + 'px';
  tip.style.top = (y + 18 + r.height > innerHeight ? y - r.height - 12 : y + 18) + 'px';
};
const hide = () => { tip.hidden = true; };
document.querySelectorAll('.lg-row[data-tip]').forEach(row => {
  row.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') show(row, e.clientX, e.clientY); });
  row.addEventListener('pointerleave', hide);
  row.addEventListener('focus', () => { const r = row.getBoundingClientRect(); show(row, r.left + r.width * .3, r.bottom - 8); });
  row.addEventListener('blur', hide);
});
addEventListener('scroll', hide, { passive: true });
})();
