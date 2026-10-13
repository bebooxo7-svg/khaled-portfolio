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

  // Swap logo image based on language (AR = Arabic mark, EN = English mark)
  const logoImg = document.getElementById('logoImg');
  if (logoImg) {
    const next = lang === 'en'
      ? (logoImg.getAttribute('data-src-en') || 'khaled-logo-en.png')
      : (logoImg.getAttribute('data-src-ar') || 'logo-256.png');
    if (logoImg.getAttribute('src') !== next) {
      logoImg.setAttribute('src', next);
      logoImg.removeAttribute('srcset');
    }
  }

  document.title = i18n[lang]['meta.title']
    || (lang === 'ar' ? 'خالد علي — مونتاج فيديو · تسويق رقمي · تصميم'
                      : 'Khaled Ali — Video Editing · Digital Marketing · Design');

  // The software cards are rendered separately from translated DOM nodes.
  // Rebuild their bilingual labels whenever the selected language changes.
  if (typeof renderSoftwareStrip === 'function') {
    try { renderSoftwareStrip(); } catch (e) { console.warn('[software]', e.message); }
  }

  renderGallery(currentFilter, currentSubFilter);

  // Re-render Designs grid when language changes (keys may differ per lang)
  if (typeof window.__renderDesigns === 'function') {
    try { window.__renderDesigns(lang); } catch {}
  }
}

// ====== Helper: normalize YouTube/Vimeo URLs for the embedded player ======
function parseMediaUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  const value = rawUrl.trim();
  try {
    const withProtocol = value.startsWith('//')
      ? `https:${value}`
      : /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed;
  } catch {
    return null;
  }
}

function getYouTubeId(parsed) {
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const isYouTube = host === 'youtube.com' || host.endsWith('.youtube.com') ||
    host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com');
  let id = '';
  if (host === 'youtu.be') {
    id = parsed.pathname.split('/').filter(Boolean)[0] || '';
  } else if (isYouTube) {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.pathname === '/watch' || parsed.pathname === '/watch/') {
      id = parsed.searchParams.get('v') || '';
    } else if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
      id = parts[1] || '';
    }
  }
  return /^[\w-]{11}$/.test(id) ? id : null;
}

function parseVideoStart(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match || !match[0]) return 0;
  return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
}

function getEmbedUrl(url) {
  const parsed = parseMediaUrl(url);
  if (!parsed) return null;

  const youtubeId = getYouTubeId(parsed);
  if (youtubeId) {
    const start = parseVideoStart(parsed.searchParams.get('start') || parsed.searchParams.get('t') || parsed.searchParams.get('time_continue'));
    const params = new URLSearchParams({ autoplay: '1', rel: '0', playsinline: '1' });
    if (start > 0) params.set('start', String(start));
    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'vimeo.com' && !host.endsWith('.vimeo.com')) return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  let idIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) { idIndex = i; break; }
  }
  if (idIndex < 0) return null;
  const id = parts[idIndex]; // Also accepts Vimeo dashboard links like /manage/videos/123456789.
  const hash = parsed.searchParams.get('h') || parts[idIndex + 1] || '';
  const params = new URLSearchParams({ autoplay: '1', dnt: '1' });
  if (/^[a-z\d]{6,}$/i.test(hash)) params.set('h', hash);
  return `https://player.vimeo.com/video/${id}?${params.toString()}`;
}
function isLocalVideo(url) {
  return !!(url && /\.(mp4|webm|mov)(\?|$)/i.test(url));
}
function isPlayable(url) {
  return !!(getEmbedUrl(url) || isLocalVideo(url));
}
function getYouTubeThumbnail(url) {
  const parsed = parseMediaUrl(url);
  const id = parsed && getYouTubeId(parsed);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function isVimeoPageUrl(url) {
  const parsed = parseMediaUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  return (host === 'vimeo.com' || host.endsWith('.vimeo.com')) && host !== 'i.vimeocdn.com';
}

// Vimeo's CDN serves the same source image at any requested dimensions, so we
// can ask for the right aspect ratio at render time. This protects against
// older entries where the dashboard fetched a horizontal thumbnail (1280×720)
// for a vertical reel before the orient auto-detect existed.
function fixVimeoPosterAspect(poster, orient) {
  if (!poster) return poster;
  const isVertical = orient === 'vertical';
  const w = isVertical ? 720 : 1280;
  const h = isVertical ? 1280 : 720;
  // i.vimeocdn.com — rewrite "d_WxH" / "d_W" / "_WxH" segments
  if (/(?:^|\.)vimeocdn\.com\//.test(poster)) {
    if (/-d_\d+x\d+/.test(poster)) {
      return poster.replace(/-d_\d+x\d+/, `-d_${w}x${h}`);
    }
    if (/-d_\d+(?=\?|$)/.test(poster)) {
      return poster.replace(/-d_\d+(?=\?|$)/, `-d_${w}x${h}`);
    }
    if (/_\d+x\d+(?=\.[a-z]+(\?|$))/i.test(poster)) {
      return poster.replace(/_\d+x\d+(?=\.[a-z]+(\?|$))/i, `_${w}x${h}`);
    }
  }
  return poster;
}

// Build the HTML for a single card from a project object
function projectCardHTML(p) {
  const ytThumb = getYouTubeThumbnail(p.url);
  let poster = p.poster || ytThumb;
  if (isVimeoPageUrl(poster)) poster = '';
  poster = fixVimeoPosterAspect(poster, p.orient);
  const safePoster = escapeHtml(poster || '');
  const thumbStyle = poster
    ? (p.orient === 'vertical'
      ? `style="background-image: url('${safePoster}'), url('${safePoster}'); background-size: contain, cover; background-position: center, center; background-repeat: no-repeat, no-repeat;"`
      : `style="background-image: url('${safePoster}'); background-size: cover; background-position: center;"`)
    : '';
  const playable = isPlayable(p.url);
  const orientCls = p.orient === 'vertical' ? ' card-vertical' : '';
  const placeholderCls = p.placeholder ? ' card-placeholder' : '';
  const catAttr = p.cat ? ` data-cat="${escapeHtml(p.cat)}"` : '';
  const subAttr = p.subCat ? ` data-sub="${escapeHtml(p.subCat)}"` : '';
  const thumbClass = p.thumb || (!poster ? 'bg-grad-3' : '');
  return `
    <article class="card reveal${orientCls}${placeholderCls} ${playable ? 'card-playable' : ''}"${catAttr}${subAttr} ${playable ? `role="button" tabindex="0" aria-label="${escapeHtml((currentLang === 'ar' ? 'تشغيل الفيديو: ' : 'Play video: ') + (p.title || ''))}" data-video-url="${escapeHtml(p.url)}" data-video-title="${escapeHtml(p.title || '')}" data-video-orient="${escapeHtml(p.orient || '')}"` : ''}>
      <div class="thumb ${escapeHtml(thumbClass)}" ${thumbStyle}>
        <span class="badge">${escapeHtml(p.tag || '')} · ${escapeHtml(p.badge || '')}</span>
        ${playable ? '<span class="play-icon" aria-hidden="true">▶</span>' : '<span class="soon-icon" aria-hidden="true">⏳</span>'}
      </div>
      <div class="card-body">
        <h3>${escapeHtml(p.title || '')}</h3>
        <p>${escapeHtml(p.desc || '')}</p>
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

// ====== Sort projects: newest first ======
// Items without addedAt fall back to their original array index, so the array
// order (oldest → newest) is preserved as a secondary key. This keeps the
// display deterministic and never random.
function sortByDateDesc(list) {
  return list.slice()
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ta = (a.p && typeof a.p.addedAt === 'number') ? a.p.addedAt : 0;
      const tb = (b.p && typeof b.p.addedAt === 'number') ? b.p.addedAt : 0;
      if (tb !== ta) return tb - ta;
      // Tie-break: later array position = newer
      return b.i - a.i;
    })
    .map(o => o.p);
}

// ====== Render a focused, paginated Works gallery ======
const GALLERY_PAGE_SIZE = 9;
let galleryLimit = GALLERY_PAGE_SIZE;

function formatCount(value) {
  return new Intl.NumberFormat(currentLang === 'ar' ? 'ar-EG' : 'en-US').format(value);
}

function updateGalleryFilterCounts() {
  const list = projects[currentLang] || [];
  document.querySelectorAll('[data-filter-count]').forEach(count => {
    const key = count.dataset.filterCount;
    const total = key === 'all' ? list.length : list.filter(project => project.cat === key).length;
    count.textContent = formatCount(total);
    const button = count.closest('[data-filter]');
    if (button) button.setAttribute('aria-label', (button.querySelector('.filter-label')?.textContent || key) + ': ' + formatCount(total));
  });
}

function renderGallery(filter = 'all', subFilter = 'all', preserveLimit = false) {
  currentFilter = filter;
  currentSubFilter = subFilter;
  if (!preserveLimit) galleryLimit = GALLERY_PAGE_SIZE;
  const gallery = document.getElementById('gallery');
  if (!gallery) return;
  const list = projects[currentLang] || [];
  let filtered = filter === 'all'
    ? list
    : filter === 'reels'
      ? list.filter(project => project.cat === 'reels' && (subFilter === 'all' || project.subCat === subFilter))
      : list.filter(project => project.cat === filter);
  filtered = sortByDateDesc(filtered);

  updateGalleryFilterCounts();
  const visible = filtered.slice(0, galleryLimit);
  gallery.innerHTML = visible.length ? visible.map(projectCardHTML).join('') : emptyStateHTML();
  const status = document.getElementById('galleryStatus');
  if (status) {
    const template = (i18n[currentLang] && i18n[currentLang]['gallery.status']) || '{shown} of {total} projects';
    status.textContent = template.replace('{shown}', formatCount(visible.length)).replace('{total}', formatCount(filtered.length));
  }
  const more = document.getElementById('galleryMore');
  if (more) {
    more.hidden = filtered.length <= visible.length;
    const moreWrap = document.getElementById('galleryMoreWrap');
    if (moreWrap) moreWrap.hidden = more.hidden;
    const label = (i18n[currentLang] && i18n[currentLang]['works.more']) || 'Show more work';
    more.textContent = label + ' (' + formatCount(filtered.length - visible.length) + ')';
  }
  staggerReveal(gallery);
  attachInteractiveCursorTargets();
}

// ====== Lightbox for video playback ======
function getExternalVideoUrl(url) {
  const parsed = parseMediaUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
    const parts = parsed.pathname.split('/').filter(Boolean);
    let idIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (/^\d+$/.test(parts[i])) { idIndex = i; break; }
    }
    if (idIndex >= 0 && parts.slice(0, idIndex).includes('manage')) {
      return `https://vimeo.com/${parts[idIndex]}`;
    }
  }
  return parsed.href;
}

function openLightbox(url, title, orientation) {
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
      <div class="lb-dialog" role="dialog" aria-modal="true" aria-labelledby="lbTitle">
        <button class="lb-close" data-lb-close aria-label="Close">×</button>
        <div class="lb-title" id="lbTitle"></div>
        <div class="lb-frame-wrap">
          <iframe class="lb-frame" title="Video player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" frameborder="0"></iframe>
          <video class="lb-video" controls playsinline preload="metadata"></video>
        </div>
        <a class="lb-external" target="_blank" rel="noopener noreferrer" hidden>فتح الفيديو على المنصة ↗</a>
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
  const external = lb.querySelector('.lb-external');
  lb.__returnFocus = document.activeElement;
  lb.__previousBodyOverflow = document.body.style.overflow;
  frame.title = title ? `${title} — Video player` : 'Video player';
  if (local) {
    frame.style.display = 'none';
    frame.src = '';
    video.style.display = 'block';
    video.src = url;
    wrap.classList.toggle('lb-vertical', orientation === 'vertical');
    external.hidden = true;
    setTimeout(() => { try { video.play(); } catch (e) {} }, 50);
  } else {
    video.style.display = 'none';
    video.removeAttribute('src');
    video.load();
    frame.style.display = 'block';
    frame.src = embedUrl;
    wrap.classList.toggle('lb-vertical', orientation === 'vertical');
    external.href = getExternalVideoUrl(url) || url;
    external.textContent = currentLang === 'ar' ? 'فتح الفيديو على المنصة ↗' : 'Open video on its platform ↗';
    external.hidden = false;
  }
  lb.querySelector('.lb-title').textContent = title || '';
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
  lb.querySelector('.lb-close').focus({ preventScroll: true });
}
function closeLightbox() {
  const lb = document.getElementById('videoLightbox');
  if (!lb) return;
  const frame = lb.querySelector('.lb-frame');
  const video = lb.querySelector('.lb-video');
  if (frame) frame.src = '';
  if (video) { try { video.pause(); } catch(e){} video.removeAttribute('src'); video.load(); }
  lb.classList.remove('open');
  document.body.style.overflow = lb.__previousBodyOverflow || '';
  if (lb.__returnFocus && typeof lb.__returnFocus.focus === 'function') {
    lb.__returnFocus.focus({ preventScroll: true });
  }
}

// Click handler for playable cards
document.addEventListener('click', (e) => {
  const card = e.target.closest('.card-playable');
  if (!card) return;
  e.preventDefault();
  openLightbox(card.dataset.videoUrl, card.dataset.videoTitle, card.dataset.videoOrient);
});
document.addEventListener('keydown', (e) => {
  const card = e.target.closest && e.target.closest('.card-playable');
  if (!card || !['Enter', ' '].includes(e.key)) return;
  e.preventDefault();
  openLightbox(card.dataset.videoUrl, card.dataset.videoTitle, card.dataset.videoOrient);
});

// ====== Works filters ======
const filtersEl = document.getElementById('filters');
const reelSubfilterWrap = document.getElementById('reelSubfilterWrap');
const reelSubfilter = document.getElementById('reelSubfilter');
const galleryMore = document.getElementById('galleryMore');
if (filtersEl) filtersEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  filtersEl.querySelectorAll('[data-filter]').forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const filter = button.dataset.filter;
  if (reelSubfilterWrap) reelSubfilterWrap.hidden = filter !== 'reels';
  if (filter !== 'reels' && reelSubfilter) reelSubfilter.value = 'all';
  renderGallery(filter, filter === 'reels' && reelSubfilter ? reelSubfilter.value : 'all');
});
if (reelSubfilter) reelSubfilter.addEventListener('change', () => {
  renderGallery('reels', reelSubfilter.value);
});
if (galleryMore) galleryMore.addEventListener('click', () => {
  galleryLimit += GALLERY_PAGE_SIZE;
  renderGallery(currentFilter, currentSubFilter, true);
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

// ====== Per-stat breathing offset so each digit pulses on its own beat ======
document.querySelectorAll('.hero-stats li').forEach((li, i) => {
  li.style.setProperty('--stat-i', String(i));
});

// ====== Footer reveal on view ======
const footerEl = document.querySelector('footer');
if (footerEl) {
  const fio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-revealed'); fio.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  fio.observe(footerEl);
}

// ====== BTS image: mouse parallax (desktop only) ======
(() => {
  const fig = document.querySelector('.bts-figure');
  if (!fig) return;
  const img = fig.querySelector('img');
  if (!img) return;
  // Only on devices with a real pointer — touch devices keep just the CSS Ken Burns.
  const hasFinePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!hasFinePointer) return;
  let raf = null, tx = 0, ty = 0;
  fig.addEventListener('mousemove', (ev) => {
    const r = fig.getBoundingClientRect();
    tx = ((ev.clientX - r.left) / r.width - 0.5) * 14;
    ty = ((ev.clientY - r.top) / r.height - 0.5) * 10;
    if (!raf) raf = requestAnimationFrame(() => {
      img.style.transform = `scale(1.08) translate3d(${tx}px, ${ty}px, 0)`;
      raf = null;
    });
  });
  fig.addEventListener('mouseleave', () => {
    img.style.transform = '';
  });
})();

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
// Tick up from (target - 10) to target so each digit is readable. For tiny
// targets (e.g. 4 years), start at 0 since 4-10 would be negative.
function animateCounter(el, delay = 0) {
  const target = parseInt(el.dataset.counter, 10);
  const suffix = el.dataset.suffix || '';
  const offset = parseInt(el.dataset.offset || (target > 10 ? '10' : String(target)), 10);
  const startVal = Math.max(0, target - offset);
  const duration = 2200;
  const startAt = performance.now() + delay;
  el.textContent = startVal + suffix;
  function tick(now) {
    if (now < startAt) { requestAnimationFrame(tick); return; }
    const t = Math.min((now - startAt) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.floor(startVal + eased * (target - startVal));
    el.textContent = value + suffix;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(tick);
}
const counterObserver = new IntersectionObserver((entries) => {
  // Stagger each visible counter so they don't all tick in lockstep.
  let idx = 0;
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter(e.target, idx * 250);
      counterObserver.unobserve(e.target);
      idx++;
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

// --- Section visibility (controlled from admin → "إظهار/إخفاء الأقسام") ---
async function applyVisibility() {
  let flags = null;
  // 1) admin draft (live preview)
  try {
    const draft = localStorage.getItem('khaled_visibility_draft');
    if (draft) flags = JSON.parse(draft);
  } catch (e) { /* ignore */ }
  // 2) committed visibility.json
  if (!flags) {
    try {
      const res = await fetch('visibility.json?v=' + Date.now(), { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        flags = data && data.sections;
      }
    } catch (e) { /* no visibility.json — show all */ }
  }
  if (!flags || typeof flags !== 'object') return;
  // Apply: any explicitly-false section is hidden; nav anchors to it are also hidden.
  Object.keys(flags).forEach(secId => {
    const sec = document.getElementById(secId);
    if (!sec) return;
    if (flags[secId] === false) {
      sec.setAttribute('data-kha-hidden', '1');
      sec.style.display = 'none';
    } else {
      sec.removeAttribute('data-kha-hidden');
      sec.style.display = '';
    }
    // Also hide / show nav links pointing to this section
    document.querySelectorAll('.nav-links a[href="#' + secId + '"], a.nav-link[href="#' + secId + '"]').forEach(a => {
      a.style.display = (flags[secId] === false) ? 'none' : '';
    });
  });
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
  await Promise.all([loadContentOverrides(), loadProjectsOverrides(), loadSoftwareOverrides(), applyVisibility()]);
  applyLanguage(currentLang);
  try { renderSoftwareStrip(); } catch {}
  // Tell parent (admin live preview iframe) we're ready.
  try { window.parent && window.parent !== window && window.parent.postMessage({ type: 'kha-preview-ready' }, '*'); } catch {}
})();
window.__applyVisibility = applyVisibility;

// Live preview hook: when admin posts 'kha-refresh', re-read drafts and re-apply.
window.addEventListener('message', async (ev) => {
  if (!ev.data || ev.data.type !== 'kha-refresh') return;
  try {
    // Reset to defaults and re-merge drafts + content.json on top.
    Object.keys(i18n).forEach(k => delete i18n[k]);
    Object.assign(i18n, JSON.parse(JSON.stringify((window && window.__i18n_defaults) || { ar: {}, en: {} })));
    Object.keys(projects).forEach(k => delete projects[k]);
    Object.assign(projects, JSON.parse(JSON.stringify((window && window.__projects_defaults) || { ar: [], en: [] })));
    SOFTWARE = (window && window.__software_defaults) ? window.__software_defaults.slice() : SOFTWARE;
    await Promise.all([loadContentOverrides(), loadProjectsOverrides(), loadSoftwareOverrides(), applyVisibility()]);
    applyLanguage(currentLang);
    try { renderSoftwareStrip(); } catch {}
    // Also refresh theme + designs from disk if their loaders are present.
    try { window.__reloadTheme && window.__reloadTheme(); } catch {}
    try { window.__loadDesigns && window.__loadDesigns(currentLang); } catch {}
    // Acknowledge so admin knows soft refresh succeeded (no need for hard reload).
    try { window.parent && window.parent !== window && window.parent.postMessage({ type: 'kha-refresh-ack' }, '*'); } catch {}
  } catch (e) { console.warn('[preview] refresh failed:', e.message); }
});

/* =====================================================================
   WhatsApp-style testimonials (chat bubbles)
   ===================================================================== */
// Lightweight bilingual helper: read the right language block from a pool entry.
function pickLang(entry) {
  const lang = (document.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ar';
  const block = (entry && entry[lang]) ? entry[lang] : (entry && entry.ar) || {};
  return {
    name: block.name || '',
    role: block.role || '',
    quote: block.quote || '',
    time: block.time || '',
    initials: (entry && entry.initials && entry.initials[lang]) || (block.name ? block.name.charAt(0) : '')
  };
}

// localStorage key tracking which testimonial IDs have been shown to this
// visitor so we never repeat the same 16 on a refresh until the pool is
// exhausted. When everything's been seen, the seen-list resets so the next
// refresh starts a fresh cycle.
const TESTIMONIALS_SEEN_KEY = 'khaled_testimonials_seen_v1';
const TESTIMONIALS_PER_RENDER = 16;
function getSeenIds() {
  try {
    const raw = localStorage.getItem(TESTIMONIALS_SEEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveSeenIds(ids) {
  try { localStorage.setItem(TESTIMONIALS_SEEN_KEY, JSON.stringify(ids)); } catch {}
}

// Pick N fresh testimonials that haven't been shown to this visitor yet.
// If fewer than N remain unseen, reset the seen list and start a new cycle so
// the user always gets a full grid.
function pickFreshTestimonials(pool, n) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  let seen = new Set(getSeenIds());
  let unseen = pool.filter(t => !seen.has(t.id));
  if (unseen.length < n) {
    // Reset cycle when the remaining unseen pool can't fill a full grid.
    seen = new Set();
    unseen = pool.slice();
  }
  // Fisher–Yates shuffle a copy of the unseen pool.
  const shuf = unseen.slice();
  for (let i = shuf.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuf[i], shuf[j]] = [shuf[j], shuf[i]];
  }
  const picked = shuf.slice(0, Math.min(n, shuf.length));
  picked.forEach(p => seen.add(p.id));
  saveSeenIds(Array.from(seen));
  return picked;
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function waChatHTML(entry) {
  const t = pickLang(entry);
  const color = entry.color || '#22c55e';
  return `<figure class="wa-chat" role="group" aria-label="${escapeHtml(t.name)}" data-tid="${escapeHtml(entry.id || '')}">`
    + `<div class="wa-chat__header">`
    +   `<div class="wa-chat__avatar" aria-hidden="true" style="background:linear-gradient(135deg, ${color}, ${color}99);">${escapeHtml(t.initials)}</div>`
    +   `<div class="wa-chat__id">`
    +     `<div class="wa-chat__name">${escapeHtml(t.name)}</div>`
    +     `<div class="wa-chat__status">${escapeHtml(t.role)}</div>`
    +   `</div>`
    + `</div>`
    + `<div class="wa-chat__body">`
    +   `<div class="wa-bubble"><span class="wa-bubble__text">${escapeHtml(t.quote)}</span>`
    +     `<span class="wa-bubble__meta">`
    +       `<span>${escapeHtml(t.time)}</span>`
    +       `<svg class="wa-bubble__check" viewBox="0 0 18 12" fill="none" aria-hidden="true">`
    +         `<polyline points="1,6 5,10 12,3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    +         `<polyline points="6,6 10,10 17,3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
    +       `</svg>`
    +     `</span>`
    +   `</div>`
    + `</div>`
    + `</figure>`;
}

function renderTestimonials() {
  const grid = document.getElementById('waChatGrid');
  if (!grid) return;
  const pool = (window && window.TESTIMONIALS_POOL) || [];
  const picks = pickFreshTestimonials(pool, TESTIMONIALS_PER_RENDER);
  if (!picks.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = picks.map(waChatHTML).join('');
  // Reveal-on-scroll for staggered bubble pop
  const cards = grid.querySelectorAll('.wa-chat');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('is-revealed'), i * 110);
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '60px', threshold: 0.15 });
    cards.forEach(c => io.observe(c));
  } else {
    cards.forEach(c => c.classList.add('is-revealed'));
  }
}

/* =====================================================================
   Software / tools logos marquee

   Each entry is bilingual:
     { img, color, hidden, ar: { name, sub }, en: { name, sub } }
   The dashboard ships overrides via software.json (and a localStorage draft
   for live preview). pickSoftwareLang() picks the right language block at
   render time. Hidden entries are skipped entirely.
   ===================================================================== */
const SOFTWARE_DEFAULTS = [
  { img: 'software-logos/premiere.png',      color: '#9999ff', ar: { name: 'Premiere Pro',    sub: 'مونتاج فيديو' },     en: { name: 'Premiere Pro',    sub: 'Video editing'   } },
  { img: 'software-logos/after-effects.png', color: '#d291ff', ar: { name: 'After Effects',   sub: 'موشن جرافيك' },      en: { name: 'After Effects',   sub: 'Motion graphics' } },
  { img: 'software-logos/davinci.png',       color: '#ff5d5d', ar: { name: 'DaVinci Resolve', sub: 'تصحيح الألوان' },    en: { name: 'DaVinci Resolve', sub: 'Color grading'   } },
  { img: 'software-logos/capcut.png',        color: '#7c5cff', ar: { name: 'CapCut Pro',      sub: 'مونتاج موبايل' },    en: { name: 'CapCut Pro',      sub: 'Mobile editing'  } },
  { img: 'software-logos/final-cut.png',     color: '#bdbdbd', ar: { name: 'Final Cut Pro',   sub: 'مونتاج Apple' },     en: { name: 'Final Cut Pro',   sub: 'Apple editor'    } },
  { img: 'software-logos/photoshop.png',     color: '#31a8ff', ar: { name: 'Photoshop',       sub: 'تصميم وصور' },       en: { name: 'Photoshop',       sub: 'Photo design'    } },
  { img: 'software-logos/illustrator.png',   color: '#ff9a00', ar: { name: 'Illustrator',     sub: 'تصميم فيكتور' },     en: { name: 'Illustrator',     sub: 'Vector design'   } }
];
let SOFTWARE = SOFTWARE_DEFAULTS.slice();
window.__software_defaults = SOFTWARE_DEFAULTS;

async function loadSoftwareOverrides() {
  // 1) localStorage draft (admin live preview — only this browser)
  try {
    const draft = localStorage.getItem('khaled_software_draft');
    if (draft) {
      const data = JSON.parse(draft);
      if (Array.isArray(data) && data.length) { SOFTWARE = data; return; }
      if (data && Array.isArray(data.items)) { SOFTWARE = data.items; return; }
    }
  } catch (e) { /* ignore */ }
  // 2) committed software.json (production override for all visitors)
  try {
    const res = await fetch('software.json?v=' + Date.now(), { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) { SOFTWARE = data; return; }
      if (data && Array.isArray(data.items) && data.items.length) { SOFTWARE = data.items; return; }
    }
  } catch (e) { /* no software.json — defaults stand */ }
}
window.__loadSoftware = loadSoftwareOverrides;

function pickSoftwareLang(s) {
  const lang = (document.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ar';
  // Old shape support: { name, sub } at the top level.
  if (typeof s.name === 'string') return { name: s.name, sub: s.sub || '' };
  const block = s && s[lang] ? s[lang] : (s && s.ar) || {};
  return { name: block.name || '', sub: block.sub || '' };
}

function softwareCardHTML(s) {
  const t = pickSoftwareLang(s);
  return `<div class="software-card" role="listitem" style="--c:${s.color || '#22c55e'};">
    <div>
      <div class="software-card__logo" aria-hidden="true">
        <img src="${escapeHtml(s.img)}" alt="" loading="lazy" decoding="async" />
      </div>
      <div class="software-card__name">${escapeHtml(t.name)}<small>${escapeHtml(t.sub)}</small></div>
    </div>
  </div>`;
}

let _softwareSetupDone = false;
function renderSoftwareStrip() {
  const track = document.getElementById('softwareTrack');
  if (!track) return;
  const visible = (SOFTWARE || []).filter(s => !s.hidden);
  const half = visible.map(softwareCardHTML).join('');
  track.innerHTML = half + half;
  if (_softwareSetupDone) return;
  _softwareSetupDone = true;
  const isRTL = () => (document.documentElement.getAttribute('dir') || 'ltr') === 'rtl';
  // Tune duration so motion speed feels consistent
  function tune() {
    const w = track.scrollWidth / 2;
    if (!w || !isFinite(w)) return;
    const speed = window.innerWidth < 720 ? 28 : 42;
    const d = Math.max(18, Math.round(w / speed));
    track.style.animationDuration = d + 's';
  }
  requestAnimationFrame(tune);
  window.addEventListener('resize', tune);

  // Manual nudge: jump animation-delay by one logo-card width so the user can
  // scrub the marquee left/right with the same small animation-delay adjustment.
  let pauseTimer = null;
  function pauseBriefly(ms) {
    track.classList.add('is-paused');
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => track.classList.remove('is-paused'), ms);
  }
  document.querySelectorAll('.software-arrow').forEach(btn => {
    btn.addEventListener('click', () => {
      const isPrev = btn.classList.contains('software-prev');
      const cardWidth = window.innerWidth < 720 ? 150 : 200; // includes gap
      const half = track.scrollWidth / 2 || 1;
      const fraction = cardWidth / half;
      const cs = getComputedStyle(track);
      const durationSec = parseFloat(cs.animationDuration) || 40;
      const delaySec = parseFloat(cs.animationDelay) || 0;
      const ltrSign = isRTL() ? -1 : 1;
      const direction = isPrev ? 1 : -1;
      const deltaSec = direction * ltrSign * fraction * durationSec;
      track.style.animationDelay = (delaySec + deltaSec) + 's';
      pauseBriefly(900);
    });
  });

  // Pause when off-screen
  if ('IntersectionObserver' in window) {
    const vp = track.closest('.software-viewport') || track;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        track.style.animationPlayState = e.isIntersecting ? '' : 'paused';
      });
    }, { rootMargin: '160px' });
    io.observe(vp);
  }
}

// Boot extras once DOM is ready (defer-loaded script, so DOM is available)
(function bootExtras() {
  function init() {
    try { renderTestimonials(); } catch (e) { console.warn('[testimonials]', e.message); }
    try { renderSoftwareStrip(); } catch (e) { console.warn('[software]', e.message); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
