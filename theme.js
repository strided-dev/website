/* Day and night, from take 9. Runs in <head> before any CSS paints, so the first frame is already the right one.
   The button sets an explicit choice on <html data-theme>; with none, the system setting decides. A choice is
   remembered under 'ak-theme' and shared across tabs and across all three pages. Every change fires 'ak-theme' on
   the document, and the paintings, the page colours and the sun/moon button all turn together on one clock
   (--dusk, 3.2 s; a 2.4 s snapshot crossfade where supported) and one curve (--ease). */
(() => {
  'use strict';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = v => v === 'light' || v === 'dark';
  let choice = null;
  /* The choice is kept in localStorage; where a sandboxed frame blocks storage, window.name carries it from page to
     page instead (it survives navigation within the same tab). */
  const NAME = /(?:^|;)ak-theme=(light|dark)(?:;|$)/;
  const load = () => {
    try { const saved = localStorage.getItem('ak-theme'); if (valid(saved)) return saved; } catch {}
    const m = (window.name || '').match(NAME); return m ? m[1] : null;
  };
  const save = v => {
    try { localStorage.setItem('ak-theme', v); } catch {}
    try { window.name = (window.name || '').replace(NAME, ';').replace(/^;+|;+$/g, '') + ';ak-theme=' + v; } catch {}
  };
  choice = load();
  let hostTheme = null;
  const isDark = () => choice ? choice === 'dark' : hostTheme ? hostTheme === 'dark' : system.matches;
  window.akIsDark = isDark;
  root.classList.add('still');               // no transitions while the page first paints
  let previous = null;
  const paint = () => {
    const dark = isDark();
    if (root.dataset.theme !== (dark ? 'dark' : 'light')) root.dataset.theme = dark ? 'dark' : 'light';
    root.classList.toggle('night', dark);
    const button = document.getElementById('theme');
    if (button) {
      const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', label);
      button.title = label;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const paper = getComputedStyle(root).getPropertyValue('--ark-paper').trim();   // empty until the stylesheet loads
      meta.content = paper || (dark ? '#0e1322' : '#f3ebdc');
    }
    document.querySelectorAll('.ark-painting-day').forEach(i => i.setAttribute('aria-hidden', String(dark)));
    document.querySelectorAll('.ark-painting-night').forEach(i => i.setAttribute('aria-hidden', String(!dark)));
    if (previous !== null && previous !== dark) document.dispatchEvent(new CustomEvent('ak-theme', { detail: { dark } }));
    previous = dark;
  };
  paint();

  document.addEventListener('DOMContentLoaded', () => {
    paint();
    const button = document.getElementById('theme');
    if (button) button.addEventListener('click', () => {
      const flip = () => { choice = isDark() ? 'light' : 'dark'; save(choice); paint(); };
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      /* Cheap path: one GPU crossfade of a snapshot (View Transitions), with every CSS colour transition switched off
         for its duration. Browsers without it fall back to the CSS fade on --dusk. */
      if (!document.startViewTransition || reduce || root.classList.contains('swap')) return flip();
      root.classList.add('swap');
      let vt;
      try { vt = document.startViewTransition(flip); } catch { root.classList.remove('swap'); return flip(); }
      const done = () => root.classList.remove('swap');
      vt.finished.then(done, done);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('still')));
  }, { once: true });

  system.addEventListener('change', () => { if (!choice && !hostTheme) paint(); });
  window.addEventListener('storage', e => {
    if (e.key === 'ak-theme' || e.key === null) { choice = valid(e.newValue) ? e.newValue : null; paint(); }
  });
  /* A host page (claude.ai's artifact viewer, for one) may set data-theme on every page load to match its own theme.
     A choice made with the button always wins over that; with no choice yet, the host's theme is followed. */
  new MutationObserver(() => {
    const now = root.dataset.theme;
    const want = isDark() ? 'dark' : 'light';
    if (now === want) return;
    if (choice) { root.dataset.theme = want; return; }        // put the visitor's choice back
    if (valid(now)) { hostTheme = now; paint(); }
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
