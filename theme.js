/* theme.js — apply theme.json (colors + animation level + font) at runtime.
 * Dashboard writes theme.json into the repo. Site loads it on every page load.
 *
 * theme.json shape:
 * {
 *   "accent":   "#22c55e",
 *   "accent2":  "#3b82f6",
 *   "bg":       "#0a0e1a",
 *   "bg2":      "#0f172a",
 *   "text":     "#e6edf6",
 *   "muted":    "#8d96a8",
 *   "fontAr":   "Cairo",          // 'Cairo' | 'IBM Plex Sans Arabic' | 'Tajawal' | 'Almarai'
 *   "fontEn":   "Inter",          // 'Inter' | 'Manrope' | 'Plus Jakarta Sans'
 *   "animLevel": "med",           // 'off' | 'subtle' | 'med' | 'strong'
 *   "shapesBg":  true              // floating background shapes
 * }
 */
(function () {
  'use strict';

  const DEFAULT = {
    accent: '#22c55e',
    accent2: '#3b82f6',
    bg: '#0a0e1a',
    bg2: '#0f172a',
    text: '#e6edf6',
    muted: '#8d96a8',
    fontAr: 'Cairo',
    fontEn: 'Inter',
    animLevel: 'med',
    shapesBg: true,
  };

  const FONT_MAP_AR = {
    'Cairo': 'family=Cairo:wght@300;400;500;600;700;800',
    'IBM Plex Sans Arabic': 'family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700',
    'Tajawal': 'family=Tajawal:wght@300;400;500;700;800',
    'Almarai': 'family=Almarai:wght@300;400;700;800',
  };
  const FONT_MAP_EN = {
    'Inter': 'family=Inter:wght@400;500;600;700',
    'Manrope': 'family=Manrope:wght@400;500;600;700;800',
    'Plus Jakarta Sans': 'family=Plus+Jakarta+Sans:wght@400;500;600;700;800',
  };

  function applyTheme(t) {
    const merged = Object.assign({}, DEFAULT, t || {});
    const root = document.documentElement;

    // Color CSS vars (mapped to existing names in the site)
    root.style.setProperty('--neon', merged.accent);
    root.style.setProperty('--accent', merged.accent);
    root.style.setProperty('--blue', merged.accent2);
    root.style.setProperty('--accent-2', merged.accent2);
    root.style.setProperty('--bg', merged.bg);
    root.style.setProperty('--bg-2', merged.bg2);
    root.style.setProperty('--text', merged.text);
    root.style.setProperty('--muted', merged.muted);

    // Animation level
    root.classList.remove('kha-anim-off', 'kha-rich-anim');
    let mult = 1;
    if (merged.animLevel === 'off')      { root.classList.add('kha-anim-off'); mult = 0; }
    else if (merged.animLevel === 'subtle') { mult = 0.6; root.classList.add('kha-rich-anim'); }
    else if (merged.animLevel === 'strong') { mult = 1.4; root.classList.add('kha-rich-anim'); document.body && document.body.classList.add('kha-rich-anim'); }
    else                                    { mult = 1.0; root.classList.add('kha-rich-anim'); }
    root.style.setProperty('--anim-mult', String(mult));
    root.style.setProperty('--anim-extra', merged.animLevel === 'strong' ? '12' : '0');

    // Floating shapes background
    let shapes = document.querySelector('.kha-shapes');
    const wantShapes = !!merged.shapesBg && merged.animLevel !== 'off';
    if (wantShapes && !shapes) {
      shapes = document.createElement('div');
      shapes.className = 'kha-shapes';
      shapes.setAttribute('aria-hidden', 'true');
      shapes.innerHTML = '<span></span><span></span><span></span>';
      document.body.appendChild(shapes);
    } else if (!wantShapes && shapes) {
      shapes.remove();
    }

    // Inject Google Fonts dynamically if user picked something different from baseline
    const fontKey = (FONT_MAP_AR[merged.fontAr] ? merged.fontAr : 'Cairo');
    const enFontKey = (FONT_MAP_EN[merged.fontEn] ? merged.fontEn : 'Inter');
    const fontHrefAr = 'https://fonts.googleapis.com/css2?' + (FONT_MAP_AR[fontKey] || FONT_MAP_AR.Cairo);
    const fontHrefEn = 'https://fonts.googleapis.com/css2?' + (FONT_MAP_EN[enFontKey] || FONT_MAP_EN.Inter);
    ensureLink('kha-font-ar', fontHrefAr + '&display=swap');
    ensureLink('kha-font-en', fontHrefEn + '&display=swap');
    root.style.setProperty('--font-ar', `'${fontKey}', 'Cairo', system-ui, sans-serif`);
    root.style.setProperty('--font-ar-display', `'${fontKey}', 'Cairo', system-ui, sans-serif`);
    root.style.setProperty('--font-en', `'${enFontKey}', 'Inter', system-ui, sans-serif`);
  }

  function ensureLink(id, href) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('link');
      el.id = id;
      el.rel = 'stylesheet';
      document.head.appendChild(el);
    }
    if (el.href !== href) el.href = href;
  }

  // Try loading theme.json (cache-busted on demand). Failures fall back to DEFAULT.
  async function loadTheme() {
    try {
      const r = await fetch('theme.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw 0;
      const j = await r.json();
      applyTheme(j);
      window.__kha_theme = j;
    } catch {
      applyTheme(DEFAULT);
      window.__kha_theme = DEFAULT;
    }
  }

  // Apply defaults synchronously so first paint already has CSS vars set,
  // then load theme.json and apply again.
  applyTheme(DEFAULT);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTheme, { once: true });
  } else {
    loadTheme();
  }

  // Expose for live preview from admin
  window.__applyTheme = applyTheme;
  window.__reloadTheme = loadTheme;

  // Listen for theme refresh from admin
  window.addEventListener('message', (ev) => {
    if (!ev.data) return;
    if (ev.data.type === 'kha-theme') {
      applyTheme(ev.data.theme || DEFAULT);
    }
    if (ev.data.type === 'kha-refresh-theme') {
      loadTheme();
    }
  });
})();
