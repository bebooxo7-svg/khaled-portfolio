// ====== i18n translations ======
// Defaults are loaded from content-defaults.js (window.__i18n_defaults).
// Runtime overrides:
//   1) localStorage 'khaled_content_draft' — for admin.html live preview
//   2) content.json at site root — for production overrides committed to repo
let i18n = JSON.parse(JSON.stringify((window && window.__i18n_defaults) || { ar: {}, en: {} }));


// ====== Projects data ======
// NOTE:
//   Each project has:
//     - cat:    'podcast' | 'reels' | 'longyt' | 'edu' | 'wedding'
//     - subCat: reels only → 'medical' | 'educational' | 'marketing' | 'ai' | 'general'
//   To move a reel into a sub-category, change its `subCat` below.
//   Placeholder entries (no url / placeholder:true) show a "coming soon" card.
// projects: bootstrapped from window.__projects_defaults (projects-defaults.js).
// Overrides loaded later from projects.json or localStorage draft (loadProjectsOverrides).
let projects = JSON.parse(JSON.stringify((window && window.__projects_defaults) || { ar: [], en: [] }));

const WA_NUMBER = '201063783219';

// ====== State ======
let currentLang = localStorage.getItem('lang') || 'ar';
let currentFilter = 'all';     // 'all' | 'podcast' | 'reels' | 'longyt' | 'edu'
let currentSubFilter = 'all';  // reels sub: 'all' | 'medical' | 'educational' | 'marketing' | 'ai' | 'general'

// ====== Apply language ======
function applyLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  const html = document.documentElement;
  html.setAttribute('lang', lang);
  html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18n[lang][key] !== undefined) {
      if (el.tagName === 'META') el.setAttribute('content', i18n[lang][key]);
      else el.innerHTML = i18n[lang][key];
    }
  });

  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (i18n[lang][key] !== undefined) el.setAttribute('placeholder', i18n[lang][key]);
  });

  document.querySelector('.lang-current').textContent = lang === 'ar' ? 'EN' : 'AR';

  document.title = i18n[lang]['meta.title']
    || (lang === 'ar' ? 'خالد علي — مونتاج فيديو · تسويق رقمي · تصميم'
                      : 'Khaled Ali — Video Editing · Digital Marketing · Design');

  renderGallery(currentFilter, currentSubFilter);

  // Re-render Designs grid when language changes (keys may differ per lang)
  if (typeof window.__renderDesigns === 'function') {
    try { window.__renderDesigns(lang); } catch {}
  }
}

// ====== Helper: extract YouTube/Vimeo ID or detect local mp4 ======
function getEmbedUrl(url) {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
  return null;
}
function isLocalVideo(url) {
  return !!(url && /\.(mp4|webm|mov)(\?|$)/i.test(url));
}
function isPlayable(url) {
  return !!(getEmbedUrl(url) || isLocalVideo(url));
}
function getYouTubeThumbnail(url) {
  const ytMatch = url && url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return ytMatch ? `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg` : null;
}

// Build the HTML for a single card from a project object
function projectCardHTML(p) {
  const ytThumb = getYouTubeThumbnail(p.url);
  const poster = p.poster || ytThumb;
  const thumbStyle = poster ? `style="background-image: url('${poster}'); background-size: cover; background-position: center;"` : '';
  const playable = isPlayable(p.url);
  const orientCls = p.orient === 'vertical' ? ' card-vertical' : '';
  const placeholderCls = p.placeholder ? ' card-placeholder' : '';
  const catAttr = p.cat ? ` data-cat="${p.cat}"` : '';
  const subAttr = p.subCat ? ` data-sub="${p.subCat}"` : '';
  return `
    <article class="card reveal${orientCls}${placeholderCls} ${playable ? 'card-playable' : ''}"${catAttr}${subAttr} ${playable ? `data-video-url="${p.url}" data-video-title="${p.title.replace(/"/g, '&quot;')}"` : ''}>
      <div class="thumb ${p.thumb || ''}" ${thumbStyle}>
        <span class="badge">${p.tag} · ${p.badge}</span>
        ${playable ? '<span class="play-icon" aria-hidden="true">▶</span>' : '<span class="soon-icon" aria-hidden="true">⏳</span>'}
      </div>
      <div class="card-body">
        <h3>${p.title}</h3>
        <p>${p.desc}</p>
      </div>
    </article>`;
}

// Build empty state HTML
function emptyStateHTML() {
  const t = (i18n[currentLang] && i18n[currentLang]['empty.soon']) || 'Coming soon.';
  return `<div class="empty-state">${t}</div>`;
}

// Animate cards on mount
function staggerReveal(container) {
  requestAnimationFrame(() => {
    const els = container.querySelectorAll('.reveal');
    // Cap total reveal duration to ~600ms regardless of item count so nothing feels stuck
    const stride = Math.max(12, Math.min(60, Math.floor(600 / Math.max(1, els.length))));
    els.forEach((el, i) => {
      setTimeout(() => el.classList.add('show'), i * stride);
    });
    // Safety net: after 1.2s force all remaining items visible even if a timer is throttled
    setTimeout(() => {
      container.querySelectorAll('.reveal:not(.show)').forEach(el => el.classList.add('show'));
    }, 1200);
  });
}

// ====== Render Works gallery (handles all cats + reels subfilter) ======
function renderGallery(filter = 'all', subFilter = 'all') {
  currentFilter = filter;
  currentSubFilter = subFilter;
  const gallery = document.getElementById('gallery');
  if (!gallery) return;
  const list = projects[currentLang];
  let filtered;
  if (filter === 'all') {
    filtered = list;
  } else if (filter === 'reels') {
    filtered = list.filter(p => p.cat === 'reels' && (subFilter === 'all' || p.subCat === subFilter));
  } else {
    filtered = list.filter(p => p.cat === filter);
  }
  gallery.innerHTML = filtered.length ? filtered.map(projectCardHTML).join('') : emptyStateHTML();
  staggerReveal(gallery);
  attachInteractiveCursorTargets();
}

// ====== Lightbox for video playback ======
function openLightbox(url, title) {
  const embedUrl = getEmbedUrl(url);
  const local = !embedUrl && isLocalVideo(url);
  if (!embedUrl && !local) { window.open(url, '_blank'); return; }
  let lb = document.getElementById('videoLightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'videoLightbox';
    lb.className = 'video-lightbox';
    lb.innerHTML = `
      <div class="lb-backdrop" data-lb-close></div>
      <div class="lb-dialog" role="dialog" aria-modal="true">
        <button class="lb-close" data-lb-close aria-label="Close">×</button>
        <div class="lb-title"></div>
        <div class="lb-frame-wrap">
          <iframe class="lb-frame" allow="autoplay; encrypted-media; fullscreen" allowfullscreen frameborder="0"></iframe>
          <video class="lb-video" controls playsinline preload="metadata"></video>
        </div>
      </div>`;
    document.body.appendChild(lb);
    lb.addEventListener('click', (e) => {
      if (e.target.closest('[data-lb-close]')) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lb.classList.contains('open')) closeLightbox();
    });
  }
  const frame = lb.querySelector('.lb-frame');
  const video = lb.querySelector('.lb-video');
  const wrap = lb.querySelector('.lb-frame-wrap');
  if (local) {
    frame.style.display = 'none';
    frame.src = '';
    video.style.display = 'block';
    video.src = url;
    wrap.classList.add('lb-vertical');
    setTimeout(() => { try { video.play(); } catch (e) {} }, 50);
  } else {
    video.style.display = 'none';
    video.removeAttribute('src');
    video.load();
    frame.style.display = 'block';
    frame.src = embedUrl;
    wrap.classList.remove('lb-vertical');
  }
  lb.querySelector('.lb-title').textContent = title || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  const lb = document.getElementById('videoLightbox');
  if (!lb) return;
  const frame = lb.querySelector('.lb-frame');
  const video = lb.querySelector('.lb-video');
  if (frame) frame.src = '';
  if (video) { try { video.pause(); } catch(e){} video.removeAttribute('src'); video.load(); }
  lb.classList.remove('open');
  document.body.style.overflow = '';
}

// Click handler for playable cards
document.addEventListener('click', (e) => {
  const card = e.target.closest('.card-playable');
  if (!card) return;
  e.preventDefault();
  openLightbox(card.dataset.videoUrl, card.dataset.videoTitle);
});

// ====== Filters (Works: podcast / reels) ======
const filtersEl = document.getElementById('filters');
const subfiltersEl = document.getElementById('subfilters');
if (filtersEl) filtersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  filtersEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const filter = btn.dataset.filter;
  // show reels sub-filters only when reels is active
  if (subfiltersEl) {
    const showSub = filter === 'reels';
    subfiltersEl.hidden = !showSub;
    if (!showSub) {
      // reset sub state visually + data
      subfiltersEl.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.subfilter === 'all'));
      currentSubFilter = 'all';
    }
  }
  renderGallery(filter, currentSubFilter);
});

// Reels sub-filters: medical / educational / marketing / general
if (subfiltersEl) subfiltersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  subfiltersEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderGallery('reels', btn.dataset.subfilter);
});

// ====== Mobile nav toggle ======
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.setAttribute('aria-expanded', 'false');
navToggle.setAttribute('aria-controls', 'navLinks');
function setNavOpen(open) {
  navLinks.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
}
navToggle.addEventListener('click', () => setNavOpen(!navLinks.classList.contains('open')));
navLinks.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') setNavOpen(false);
});

// ====== Language toggle ======
document.getElementById('langToggle').addEventListener('click', () => {
  applyLanguage(currentLang === 'ar' ? 'en' : 'ar');
});

// ====== Contact form → Email (Formsubmit.co) ======
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const note = document.getElementById('formNote');
  const form = e.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!form.checkValidity()) {
    note.textContent = i18n[currentLang]['form.error'];
    note.className = 'form-note error';
    form.reportValidity();
    return;
  }

  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = i18n[currentLang]['form.sending'] || '...';
  note.textContent = '';
  note.className = 'form-note';

  try {
    const data = new FormData(form);
    const res = await fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('Network ' + res.status);
    note.textContent = i18n[currentLang]['form.success'];
    note.className = 'form-note success';
    form.reset();
  } catch (err) {
    note.textContent = i18n[currentLang]['form.networkError'] || i18n[currentLang]['form.error'];
    note.className = 'form-note error';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

// ====== Pricing tabs ======
(function() {
  const tabs = document.querySelectorAll('.pricing-tab');
  const panes = document.querySelectorAll('.pricing-pane');
  if (!tabs.length || !panes.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.pane;
      tabs.forEach(t => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panes.forEach(p => {
        const show = p.dataset.pane === target;
        p.hidden = !show;
        p.classList.toggle('active', show);
      });
    });
  });
})();

// ====== Discount countdown (7-day, auto-renewing via localStorage) ======
(function() {
  const elDays = document.getElementById('cdDays');
  const elHours = document.getElementById('cdHours');
  const elMinutes = document.getElementById('cdMinutes');
  const elSeconds = document.getElementById('cdSeconds');
  if (!elDays || !elHours || !elMinutes || !elSeconds) return;

  const STORAGE_KEY = 'discountStart';
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  function getOrSetStart() {
    const now = Date.now();
    let start = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    // First visit OR cycle elapsed → start a fresh 7-day window
    if (!start || (now - start) >= SEVEN_DAYS_MS) {
      start = now;
      try { localStorage.setItem(STORAGE_KEY, String(start)); } catch (e) { /* private mode */ }
    }
    return start;
  }

  const pad = (n) => n < 10 ? '0' + n : '' + n;

  function tick() {
    const start = getOrSetStart();
    const end = start + SEVEN_DAYS_MS;
    let remaining = end - Date.now();
    if (remaining < 0) remaining = 0;
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
    elDays.textContent = days;
    elHours.textContent = pad(hours);
    elMinutes.textContent = pad(minutes);
    elSeconds.textContent = pad(seconds);
  }

  tick();
  setInterval(tick, 1000);
})();

// ====== Year ======
document.getElementById('year').textContent = new Date().getFullYear();

// ====== Reveal on scroll ======
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('show');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.hero-text, .hero-visual, .mini-card, .contact-item').forEach(el => {
  el.classList.add('reveal');
  io.observe(el);
});

// Stagger groups
document.querySelectorAll('.process-grid, .pricing-grid, .services, .skills, .about-cards').forEach(el => {
  el.classList.add('reveal-stagger');
  io.observe(el);
});

// ====== Section enter animation: tag, title (split), lead, grid stagger ======
function splitTitleIntoWords(h2) {
  if (!h2 || h2.dataset.split === '1') return;
  const txt = h2.textContent;
  // Split into words but keep spaces
  const words = txt.split(/(\s+)/);
  h2.innerHTML = words.map(w => /\s+/.test(w) ? w : `<span class="word"><span class="word-inner">${w}</span></span>`).join('');
  h2.dataset.split = '1';
}
function prepareSection(sec) {
  sec.classList.add('section-enter');
  const head = sec.querySelector('.section-head');
  if (head) {
    head.querySelectorAll('.section-tag').forEach(el => el.classList.add('se-tag'));
    head.querySelectorAll('h2').forEach(h2 => { splitTitleIntoWords(h2); h2.classList.add('se-title'); });
    head.querySelectorAll('.lead').forEach(el => el.classList.add('se-lead'));
  }
  // Grids that should stagger their children.
  // Note: .gallery is intentionally excluded. The gallery uses its own
  // per-card .reveal -> .show system which caps reveal time to ~600ms
  // and has a 1.2s safety net. Applying .se-grid on top adds up to
  // 0.72s transition-delay + 0.6s duration which visibly delays the
  // last cards on slow mobile devices (they stay invisible until the
  // user taps the area to force a repaint).
  sec.querySelectorAll('.designs-grid, .filters').forEach(g => g.classList.add('se-grid'));
}
const sectionIO = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('section-in');
      sectionIO.unobserve(e.target);
    }
  });
}, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.section').forEach(sec => {
  prepareSection(sec);
  sectionIO.observe(sec);
});

// Safety net: any section that's still missing .section-in once the user
// has scrolled near it gets forced in. This handles oversized sections
// where the IntersectionObserver threshold can't be satisfied on small
// viewports and prevents the last cards from staying invisible.
function forceInVisibleSections() {
  const margin = 400;
  document.querySelectorAll('.section.section-enter:not(.section-in)').forEach(sec => {
    const r = sec.getBoundingClientRect();
    if (r.top < window.innerHeight + margin && r.bottom > -margin) {
      sec.classList.add('section-in');
      sectionIO.unobserve(sec);
    }
  });
}
setTimeout(forceInVisibleSections, 400);

// ====== Card 3D tilt on mousemove ======
function attachCardTilt(root) {
  if (prefersReducedMotion()) return;
  const cards = (root || document).querySelectorAll('.card');
  cards.forEach(card => {
    if (card.dataset.tiltBound === '1') return;
    card.dataset.tiltBound = '1';
    let raf = null;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty('--tx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--ty', (y * 100).toFixed(1) + '%');
        card.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg');
      });
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
    // Ripple on click
    card.addEventListener('click', (e) => {
      const rect = card.getBoundingClientRect();
      const r = document.createElement('span');
      r.className = 'card-ripple';
      r.style.left = (e.clientX - rect.left) + 'px';
      r.style.top = (e.clientY - rect.top) + 'px';
      card.appendChild(r);
      setTimeout(() => r.remove(), 700);
    });
  });
}
// Run after gallery render — wrap renderGallery so tilt attaches to freshly rendered cards
const _origRenderGallery = renderGallery;
renderGallery = function(filter, subFilter) {
  _origRenderGallery(filter, subFilter);
  setTimeout(() => attachCardTilt(document.getElementById('gallery')), 50);
};
attachCardTilt(document);

// ====== Pricing card flip ======
document.querySelectorAll('.plan.card-flip').forEach(card => {
  const flipBtns = card.querySelectorAll('[data-flip]');
  const innerEl = card.querySelector('.card-inner');
  const doFlip = (toBack) => {
    if (toBack === undefined) card.classList.toggle('flipped');
    else card.classList.toggle('flipped', toBack);
    if (innerEl) innerEl.style.transform = '';
  };
  flipBtns.forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      doFlip();
    });
  });
  // Click anywhere on the front (not on links/buttons) to flip
  const front = card.querySelector('.card-front');
  if (front) {
    front.addEventListener('click', (ev) => {
      if (ev.target.closest('a,button')) return;
      doFlip(true);
    });
  }
});

// (Tilt disabled — caused conflict with 3D flip)

// ====== Counter animation ======
function animateCounter(el) {
  const target = parseInt(el.dataset.counter, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.floor(eased * target);
    el.textContent = value + suffix;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(tick);
}
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter(e.target);
      counterObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));

// (Custom cursor & spotlight removed for performance + native UX)
window.attachInteractiveCursorTargets = () => {};

// ====== Magnetic buttons (lightweight, rAF-throttled) ======
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.magnetic').forEach(btn => {
    let raf = null;
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * 0.18;
      const y = (e.clientY - rect.top - rect.height / 2) * 0.22;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { btn.style.transform = `translate(${x}px, ${y}px)`; });
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
}

// ====== Back to top button ======
const backToTop = document.getElementById('backToTop');
if (backToTop) {
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ====== Hero photo — mouse parallax ======
// (skipped on touch/coarse pointer for performance and when motion-reduced)
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReducedMotion()) {
  const hero = document.querySelector('.hero');
  const photoCard = document.querySelector('.hero-visual .photo-card');
  if (hero && photoCard) {
    let raf = null;
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        photoCard.style.setProperty('--px', x.toFixed(3));
        photoCard.style.setProperty('--py', y.toFixed(3));
      });
    });
    hero.addEventListener('mouseleave', () => {
      photoCard.style.setProperty('--px', 0);
      photoCard.style.setProperty('--py', 0);
    });
  }
}

// ====== Combined scroll handler (nav state + parallax + back-to-top + section reveal) ======
const nav = document.querySelector('.nav');
const bgGrad = document.querySelector('.bg-gradient');
const heroText = document.querySelector('.hero-text');
const scrollBar = document.querySelector('.scroll-progress > span');
const reduceMotion = prefersReducedMotion();
let scrollRaf = null;
function onScroll() {
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
  scrollRaf = requestAnimationFrame(() => {
    const y = window.scrollY;
    // navbar scrolled state
    if (nav) nav.classList.toggle('scrolled', y > 30);
    // back-to-top visibility
    if (backToTop) backToTop.classList.toggle('visible', y > 600);
    // scroll progress bar
    if (scrollBar) {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? Math.min(100, Math.max(0, (y / docH) * 100)) : 0;
      scrollBar.style.width = pct + '%';
    }
    // parallax (skipped when motion-reduced)
    if (!reduceMotion) {
      if (bgGrad) bgGrad.style.transform = `translate3d(0, ${y * -0.08}px, 0)`;
      if (heroText && y < 800) heroText.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
    }
    // force-reveal sections in viewport (fallback for IO timing)
    forceInVisibleSections();
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', forceInVisibleSections, { passive: true });
onScroll();

// ====== Init: load content overrides, then apply language ======
function deepMergeOverrides(target, over) {
  if (!over || typeof over !== 'object') return;
  for (const lang of ['ar', 'en']) {
    if (over[lang] && typeof over[lang] === 'object') {
      Object.assign(target[lang] = target[lang] || {}, over[lang]);
    }
  }
}

async function loadContentOverrides() {
  // 1) localStorage draft (admin live preview — only this browser)
  try {
    const draft = localStorage.getItem('khaled_content_draft');
    if (draft) deepMergeOverrides(i18n, JSON.parse(draft));
  } catch (e) { console.warn('[i18n] draft override failed:', e.message); }

  // 2) committed content.json (production override for all visitors)
  try {
    const res = await fetch('content.json?v=' + Date.now(), { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      deepMergeOverrides(i18n, data);
    }
  } catch (e) { /* no content.json — defaults stand */ }
}

async function loadProjectsOverrides() {
  // 1) localStorage draft (admin live preview — only this browser)
  try {
    const draft = localStorage.getItem('khaled_projects_draft');
    if (draft) {
      const data = JSON.parse(draft);
      if (data && (Array.isArray(data.ar) || Array.isArray(data.en))) {
        if (Array.isArray(data.ar)) projects.ar = data.ar;
        if (Array.isArray(data.en)) projects.en = data.en;
      }
    }
  } catch (e) { console.warn('[projects] draft override failed:', e.message); }

  // 2) committed projects.json (production override for all visitors)
  try {
    const res = await fetch('projects.json?v=' + Date.now(), { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (data && (Array.isArray(data.ar) || Array.isArray(data.en))) {
        if (Array.isArray(data.ar)) projects.ar = data.ar;
        if (Array.isArray(data.en)) projects.en = data.en;
      }
    }
  } catch (e) { /* no projects.json — defaults stand */ }
}

(async () => {
  await Promise.all([loadContentOverrides(), loadProjectsOverrides()]);
  applyLanguage(currentLang);
  // Tell parent (admin live preview iframe) we're ready.
  try { window.parent && window.parent !== window && window.parent.postMessage({ type: 'kha-preview-ready' }, '*'); } catch {}
})();

// Live preview hook: when admin posts 'kha-refresh', re-read drafts and re-apply.
window.addEventListener('message', async (ev) => {
  if (!ev.data || ev.data.type !== 'kha-refresh') return;
  try {
    // Reset to defaults and re-merge drafts + content.json on top.
    Object.keys(i18n).forEach(k => delete i18n[k]);
    Object.assign(i18n, JSON.parse(JSON.stringify((window && window.__i18n_defaults) || { ar: {}, en: {} })));
    Object.keys(projects).forEach(k => delete projects[k]);
    Object.assign(projects, JSON.parse(JSON.stringify((window && window.__projects_defaults) || { ar: [], en: [] })));
    await Promise.all([loadContentOverrides(), loadProjectsOverrides()]);
    applyLanguage(currentLang);
    // Also refresh theme + designs from disk if their loaders are present.
    try { window.__reloadTheme && window.__reloadTheme(); } catch {}
    try { window.__loadDesigns && window.__loadDesigns(currentLang); } catch {}
    // Acknowledge so admin knows soft refresh succeeded (no need for hard reload).
    try { window.parent && window.parent !== window && window.parent.postMessage({ type: 'kha-refresh-ack' }, '*'); } catch {}
  } catch (e) { console.warn('[preview] refresh failed:', e.message); }
});
