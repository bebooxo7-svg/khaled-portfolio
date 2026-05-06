/* designs.js — render the Designs gallery from designs.json (or defaults).
 * Dashboard writes designs.json into the repo. Site loads it on every page load.
 *
 * designs.json shape:
 * {
 *   "ar": [
 *     { "src": "designs/poster1.jpg", "title": "بوستر علامة كريم", "tag": "Poster", "link": "https://instagram.com/p/..." }
 *   ],
 *   "en": [ { "src": "...", "title": "...", "tag": "...", "link": "..." } ]
 * }
 */
(function () {
  'use strict';

  const DEFAULT = { ar: [], en: [] };
  let cached = null;

  async function loadDesigns() {
    try {
      const r = await fetch('designs.json?ts=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw 0;
      const j = await r.json();
      cached = j;
      window.__kha_designs = j;
      return j;
    } catch {
      cached = DEFAULT;
      window.__kha_designs = DEFAULT;
      return DEFAULT;
    }
  }

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(lang) {
    const data = cached || DEFAULT;
    const list = (data[lang] && data[lang].length) ? data[lang]
                : (data.ar && data.ar.length) ? data.ar
                : (data.en && data.en.length) ? data.en
                : [];

    const wrap = document.querySelector('#designsGrid');
    const section = document.querySelector('#designs');
    if (!section) return;

    if (!wrap) {
      // First-time inject: place grid before the existing CTA band
      const grid = document.createElement('div');
      grid.id = 'designsGrid';
      grid.className = 'designs-grid';
      const cta = section.querySelector('.designs-cta-band');
      if (cta) cta.parentNode.insertBefore(grid, cta);
      else section.querySelector('.container').appendChild(grid);
      return render(lang); // recurse to render into the new node
    }

    if (!list.length) {
      wrap.innerHTML = '';
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = '';

    wrap.innerHTML = list.map((d, i) => {
      const src = escape(d.src || '');
      const title = escape(d.title || '');
      const tag = escape(d.tag || '');
      const link = d.link ? escape(d.link) : '';
      const inner = `
        <img src="${src}" alt="${title || tag || 'design'}" loading="lazy" decoding="async" />
        <div class="design-overlay">
          ${tag ? `<span class="design-tag">${tag}</span>` : ''}
          ${title ? `<p class="design-title">${title}</p>` : ''}
        </div>`;
      const cls = `design-card reveal${i < 4 ? ' show' : ''}`;
      return link
        ? `<a class="${cls}" href="${link}" target="_blank" rel="noopener" style="text-decoration:none">${inner}</a>`
        : `<div class="${cls}">${inner}</div>`;
    }).join('');

    // Trigger reveal-stagger
    requestAnimationFrame(() => {
      wrap.querySelectorAll('.design-card.reveal:not(.show)').forEach((el, i) => {
        setTimeout(() => el.classList.add('show'), i * 60);
      });
    });
  }

  async function init(lang) {
    if (!cached) await loadDesigns();
    render(lang || document.documentElement.lang || 'ar');
  }

  window.__renderDesigns = render;
  window.__loadDesigns = async function (lang) {
    await loadDesigns();
    render(lang || document.documentElement.lang || 'ar');
  };

  // Auto-init after DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  } else {
    init();
  }

  // Live preview hook
  window.addEventListener('message', async (ev) => {
    if (!ev.data) return;
    if (ev.data.type === 'kha-refresh-designs') {
      await loadDesigns();
      render(document.documentElement.lang || 'ar');
    }
  });
})();
