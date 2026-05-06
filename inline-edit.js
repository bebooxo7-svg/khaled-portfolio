/* ============================================================
   Inline edit overlay — activated when index.html is loaded
   with ?edit=1. Allows hover-to-edit on any text element with
   data-i18n / data-i18n-ph, and replaces images via upload to
   the GitHub repo (same repo as the site).

   Loaded AFTER github-api.js, content-defaults.js, projects-defaults.js,
   and script.js. Uses window.GitHubAPI for commits.
   ============================================================ */
(function () {
  'use strict';

  // Only activate on ?edit=1 (or hash #edit) — public visitors never see this.
  const params = new URLSearchParams(window.location.search);
  const editMode = params.get('edit') === '1' || /(^|[#&])edit(=1)?(&|$)/.test(window.location.hash || '');
  if (!editMode) return;

  // Wait for DOM + i18n bootstrap.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // ===== State =====
  const state = {
    overrides: { ar: {}, en: {} },           // committed (loaded from content.json)
    pending:   { ar: {}, en: {} },           // unsaved local edits since last commit
    activeKey: null,
    activeLang: null,
    activeEl: null,
    panelOpen: false,
  };

  function init() {
    injectStyles();
    injectToolbar();
    loadCommittedOverrides().then(() => {
      decorateEditableElements();
      updateBadge();
    });
    document.addEventListener('keydown', onKeydown);
    // Re-decorate after gallery re-renders (script.js calls renderGallery on lang switch).
    const obs = new MutationObserver(throttle(() => decorateEditableElements(), 250));
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // ===== Styles =====
  function injectStyles() {
    const css = `
      :root.kha-edit-mode { --kha-edit-color:#22c55e; --kha-edit-color-2:#3b82f6; }
      .kha-editable {
        outline: 1.5px dashed transparent;
        outline-offset: 3px;
        border-radius: 4px;
        transition: outline-color .18s ease, background-color .18s ease;
        cursor: text;
      }
      /* Hover/pending/active visuals use only outline + box-shadow so that
         we never override .gradient-text or other background-driven effects. */
      .kha-editable.kha-hover {
        outline-color: rgba(34,197,94,.55);
        box-shadow: 0 0 0 6px rgba(34,197,94,.06);
      }
      .kha-editable[data-kha-pending="1"] {
        outline: 1.5px solid rgba(245,158,11,.7);
        box-shadow: 0 0 0 6px rgba(245,158,11,.08);
      }
      .kha-editable.kha-active {
        outline-color: var(--kha-edit-color);
        box-shadow: 0 0 0 6px rgba(34,197,94,.10);
      }
      /* Single floating pencil — positioned next to hovered element via JS.
         Kept OUTSIDE the editable element so it doesn't contaminate
         elements with background-clip:text or fancy gradient styling. */
      .kha-pencil-float {
        position: fixed;
        width: 28px; height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--kha-edit-color), var(--kha-edit-color-2));
        color: #08111c;
        display: grid; place-items: center;
        font-size: 14px; font-weight: 700;
        box-shadow: 0 4px 14px rgba(34,197,94,.45);
        opacity: 0;
        transform: scale(.6) rotate(-12deg);
        transition: opacity .18s ease, transform .25s cubic-bezier(.34,1.56,.64,1);
        pointer-events: none;
        z-index: 999998;
        cursor: pointer;
        user-select: none;
      }
      .kha-pencil-float.show {
        opacity: 1;
        transform: scale(1) rotate(0);
        pointer-events: auto;
      }

      /* ---- Image edit overlay ---- */
      img.kha-img-editable, picture.kha-img-editable {
        position: relative;
        outline: 1.5px dashed transparent;
        outline-offset: 3px;
        transition: outline-color .18s ease;
      }
      .kha-img-wrap {
        position: relative;
        display: inline-block;
      }
      .kha-img-wrap:hover .kha-img-overlay {
        opacity: 1;
      }
      .kha-img-overlay {
        position: absolute; inset: 0;
        background: linear-gradient(135deg, rgba(34,197,94,.15), rgba(59,130,246,.15));
        border: 1.5px solid rgba(34,197,94,.65);
        border-radius: 8px;
        opacity: 0;
        transition: opacity .2s ease;
        display: grid; place-items: center;
        cursor: pointer;
        z-index: 5;
      }
      .kha-img-overlay span {
        background: rgba(8,17,28,.85);
        color: #fff; padding: 8px 14px; border-radius: 999px;
        font-family: 'Cairo','Inter',system-ui,sans-serif;
        font-size: 14px; font-weight: 600;
        backdrop-filter: blur(6px);
      }

      /* ---- Floating dashboard toolbar ---- */
      .kha-toolbar {
        position: fixed; bottom: 18px; inset-inline-end: 18px;
        z-index: 999999;
        background: rgba(10,14,26,.92); backdrop-filter: blur(12px);
        color: #e6edf6;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 14px;
        padding: 10px 14px;
        display: flex; align-items: center; gap: 10px;
        font: 600 14px/1.2 'Cairo','Inter',system-ui,sans-serif;
        box-shadow: 0 12px 30px rgba(0,0,0,.45);
        animation: khaIn .35s cubic-bezier(.22,.61,.36,1) both;
        max-width: calc(100vw - 36px);
        flex-wrap: wrap;
      }
      @keyframes khaIn {
        from { opacity: 0; transform: translateY(20px) scale(.95); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
      .kha-toolbar .kha-badge {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 10px; border-radius: 999px;
        background: rgba(34,197,94,.14); color: #22c55e;
        border: 1px solid rgba(34,197,94,.35);
        font-size: 12px; font-weight: 700;
      }
      .kha-toolbar .kha-badge.dirty { background: rgba(245,158,11,.14); color: #f59e0b; border-color: rgba(245,158,11,.35); }
      .kha-toolbar .kha-badge .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: khaPulse 1.6s ease-in-out infinite; }
      @keyframes khaPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(1.3); } }
      .kha-toolbar button {
        font: inherit; cursor: pointer;
        padding: 7px 12px; border-radius: 10px;
        background: rgba(255,255,255,.08); color: inherit;
        border: 1px solid rgba(255,255,255,.18);
        transition: transform .12s ease, background .12s ease;
      }
      .kha-toolbar button:hover { background: rgba(255,255,255,.14); transform: translateY(-1px); }
      .kha-toolbar button.primary {
        background: linear-gradient(135deg, #22c55e, #3b82f6); color: #08111c;
        border-color: transparent; font-weight: 700;
      }
      .kha-toolbar button.primary:disabled { opacity:.55; cursor:not-allowed; transform:none; }

      /* ---- Settings panel ---- */
      .kha-panel {
        position: fixed; bottom: 76px; inset-inline-end: 18px;
        z-index: 999999;
        width: min(380px, calc(100vw - 36px));
        background: rgba(10,14,26,.96); backdrop-filter: blur(14px);
        color: #e6edf6;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 14px;
        padding: 16px;
        font-family: 'Cairo','Inter',system-ui,sans-serif;
        box-shadow: 0 14px 36px rgba(0,0,0,.5);
        transform: translateY(10px); opacity: 0; pointer-events: none;
        transition: transform .25s cubic-bezier(.22,.61,.36,1), opacity .2s ease;
      }
      .kha-panel.open { transform: translateY(0); opacity: 1; pointer-events: auto; }
      .kha-panel h3 { margin: 0 0 8px; font-size: 14px; }
      .kha-panel p  { margin: 0 0 10px; color:#8d96a8; font-size:12px; line-height:1.55; }
      .kha-panel label { display: block; font-size: 12px; color:#8d96a8; margin-bottom: 4px; }
      .kha-panel input {
        width: 100%; padding: 8px 11px; margin-bottom: 9px;
        border-radius: 9px; border: 1px solid rgba(255,255,255,.14);
        background: rgba(0,0,0,.30); color:#e6edf6; font: inherit;
      }
      .kha-panel input:focus { outline:none; border-color:#22c55e; }
      .kha-panel .kha-row { display: flex; gap: 8px; }

      /* ---- Inline editor ---- */
      .kha-inline-input, .kha-inline-textarea {
        font: inherit;
        color: inherit;
        background: rgba(34,197,94,.08);
        border: 1.5px solid #22c55e;
        border-radius: 6px;
        padding: 4px 8px;
        outline: none;
        width: 100%;
        box-sizing: border-box;
      }
      .kha-inline-textarea { min-height: 60px; resize: vertical; }

      /* ---- Toast ---- */
      .kha-toast {
        position: fixed; bottom: 130px; inset-inline-end: 18px;
        z-index: 999999;
        background: rgba(10,14,26,.96); color:#e6edf6;
        padding: 10px 14px; border-radius: 10px;
        border: 1px solid rgba(34,197,94,.45);
        font-family: 'Cairo','Inter',system-ui,sans-serif;
        font-size: 13px; font-weight: 600;
        box-shadow: 0 8px 22px rgba(0,0,0,.45);
        animation: khaToast .3s ease both;
        max-width: 90vw;
      }
      .kha-toast.error { border-color: rgba(239,68,68,.55); }
      @keyframes khaToast {
        from { opacity: 0; transform: translateY(15px) scale(.96); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }

      @media (prefers-reduced-motion: reduce) {
        .kha-pencil-float, .kha-img-overlay, .kha-toolbar, .kha-panel, .kha-toast {
          animation: none !important; transition: none !important;
        }
      }
    `;
    const style = document.createElement('style');
    style.id = 'kha-edit-styles';
    style.textContent = css;
    document.head.appendChild(style);
    document.documentElement.classList.add('kha-edit-mode');
  }

  // ===== Toolbar =====
  let toolbarEl, panelEl, badgeEl, saveBtn;
  function injectToolbar() {
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'kha-toolbar';
    toolbarEl.innerHTML = `
      <span class="kha-badge" id="khaBadge"><span class="dot"></span><span id="khaBadgeText">جاهز</span></span>
      <button id="khaSettings" title="إعدادات GitHub">⚙️</button>
      <button id="khaSaveAll" class="primary" disabled>💾 حفظ التعديلات</button>
      <button id="khaExit" title="خروج من وضع التعديل">×</button>
    `;
    document.body.appendChild(toolbarEl);

    badgeEl = toolbarEl.querySelector('#khaBadge');
    saveBtn = toolbarEl.querySelector('#khaSaveAll');

    toolbarEl.querySelector('#khaSettings').addEventListener('click', togglePanel);
    saveBtn.addEventListener('click', commitAll);
    toolbarEl.querySelector('#khaExit').addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.location.href = url.toString();
    });

    panelEl = document.createElement('div');
    panelEl.className = 'kha-panel';
    const cfg = (window.GitHubAPI && window.GitHubAPI.config) || {};
    panelEl.innerHTML = `
      <h3>🔐 إعدادات GitHub</h3>
      <p>هتستخدم Fine-grained PAT بصلاحية <b>Contents: Read &amp; write</b> على ريبو الموقع بس. التوكن بيتخزن في المتصفح ومش بيتبعت لأي حد غير github.com.</p>
      <label>اسم المستخدم (Owner)</label>
      <input id="khaOwner" placeholder="username" autocomplete="username" value="${esc(cfg.owner || '')}" />
      <label>اسم الريبو</label>
      <input id="khaRepo" placeholder="khaled-portfolio" value="${esc(cfg.repo || '')}" />
      <label>الفرع</label>
      <input id="khaBranch" placeholder="main" value="${esc(cfg.branch || 'main')}" />
      <label>Personal Access Token (مخفي)</label>
      <input id="khaToken" type="password" placeholder="github_pat_…" value="${esc(cfg.token || '')}" />
      <div class="kha-row">
        <button id="khaTest">اختبار</button>
        <button id="khaSaveCfg" class="primary" style="flex:1">حفظ</button>
        <button id="khaClearCfg" title="مسح">🗑️</button>
      </div>
    `;
    document.body.appendChild(panelEl);

    panelEl.querySelector('#khaSaveCfg').addEventListener('click', saveCfg);
    panelEl.querySelector('#khaClearCfg').addEventListener('click', clearCfg);
    panelEl.querySelector('#khaTest').addEventListener('click', testCfg);
  }

  function togglePanel() {
    state.panelOpen = !state.panelOpen;
    panelEl.classList.toggle('open', state.panelOpen);
  }

  function saveCfg() {
    const owner  = panelEl.querySelector('#khaOwner').value.trim();
    const repo   = panelEl.querySelector('#khaRepo').value.trim();
    const branch = panelEl.querySelector('#khaBranch').value.trim() || 'main';
    const token  = panelEl.querySelector('#khaToken').value.trim();
    if (!owner || !repo || !token) {
      toast('املي كل الحقول.', 'error'); return;
    }
    window.GitHubAPI.saveConfig({ owner, repo, branch, token });
    toast('تم الحفظ.');
    updateBadge();
  }
  function clearCfg() {
    if (!confirm('تمسح إعدادات GitHub من المتصفح؟')) return;
    window.GitHubAPI.clearConfig();
    panelEl.querySelector('#khaOwner').value = '';
    panelEl.querySelector('#khaRepo').value = '';
    panelEl.querySelector('#khaBranch').value = 'main';
    panelEl.querySelector('#khaToken').value = '';
    toast('تم مسح الإعدادات.');
    updateBadge();
  }
  async function testCfg() {
    saveCfg();
    try {
      const { repo, user } = await window.GitHubAPI.validateAuth();
      toast(`متصل: ${user ? '@' + user.login : repo.full_name}`);
    } catch (e) {
      toast('فشل الاتصال: ' + e.message, 'error');
    }
  }

  // ===== Loading committed content.json =====
  async function loadCommittedOverrides() {
    try {
      const res = await fetch('content.json?v=' + Date.now(), { cache: 'no-cache' });
      if (res.ok) {
        const j = await res.json();
        if (j && (j.ar || j.en)) state.overrides = { ar: j.ar || {}, en: j.en || {} };
      }
    } catch { /* no content.json yet, that's OK */ }
  }

  // Single global floating pencil shared across all editable elements.
  // Kept OUTSIDE the editable element so it doesn't interfere with
  // background-clip:text gradients or other tricky styling on the target.
  let floatingPencil = null;
  let pencilHideTimer = null;
  let pencilTarget = null;

  function ensureFloatingPencil() {
    if (floatingPencil) return floatingPencil;
    floatingPencil = document.createElement('div');
    floatingPencil.className = 'kha-pencil-float';
    floatingPencil.textContent = '✎';
    floatingPencil.addEventListener('mouseenter', () => { clearTimeout(pencilHideTimer); });
    floatingPencil.addEventListener('mouseleave', schedulePencilHide);
    floatingPencil.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (pencilTarget) beginEdit(pencilTarget);
    });
    document.body.appendChild(floatingPencil);
    return floatingPencil;
  }

  function showFloatingPencilFor(el) {
    if (!el || el.classList.contains('kha-active')) return;
    clearTimeout(pencilHideTimer);
    const pencil = ensureFloatingPencil();
    pencilTarget = el;
    el.classList.add('kha-hover');
    const rect = el.getBoundingClientRect();
    const isRtl = (document.documentElement.getAttribute('dir') || 'rtl') === 'rtl';
    // Place at the start of the element (top-end corner).
    const x = isRtl ? rect.left - 14 : rect.right - 14;
    const y = rect.top - 14;
    // Clamp to viewport.
    pencil.style.left = Math.max(4, Math.min(window.innerWidth - 32, x)) + 'px';
    pencil.style.top  = Math.max(4, Math.min(window.innerHeight - 32, y)) + 'px';
    pencil.classList.add('show');
  }

  function schedulePencilHide() {
    pencilHideTimer = setTimeout(() => {
      if (floatingPencil) floatingPencil.classList.remove('show');
      if (pencilTarget) pencilTarget.classList.remove('kha-hover');
      pencilTarget = null;
    }, 220);
  }

  function onElementHover(ev) {
    const el = ev.currentTarget;
    showFloatingPencilFor(el);
  }
  function onElementLeave(ev) {
    const el = ev.currentTarget;
    el.classList.remove('kha-hover');
    schedulePencilHide();
  }

  // ===== Decorating editable elements =====
  function decorateEditableElements() {
    const els = document.querySelectorAll('[data-i18n], [data-i18n-ph]');
    els.forEach(el => {
      if (el.dataset.khaDecorated === '1') return;
      // Don't decorate elements within editable inputs themselves.
      if (el.closest('.kha-inline-input, .kha-inline-textarea')) return;
      const key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-ph');
      const isPh = !el.hasAttribute('data-i18n');
      el.dataset.khaDecorated = '1';
      el.classList.add('kha-editable');
      el.setAttribute('data-kha-key', key);
      if (isPh) el.setAttribute('data-kha-ph', '1');
      el.addEventListener('mouseenter', onElementHover);
      el.addEventListener('mouseleave', onElementLeave);

      // Mark pending state if there's a pending edit for this key.
      const lang = document.documentElement.getAttribute('lang') || 'ar';
      const pending = state.pending[lang] && state.pending[lang][key];
      if (pending !== undefined) el.setAttribute('data-kha-pending', '1');
    });

    // Decorate hero / BTS images (and logo) — anything with class .photo img or .hero-art img.
    document.querySelectorAll('.hero-art img, .bts-card img, .photo img').forEach(img => {
      if (img.closest('.kha-img-wrap')) return;
      const wrap = document.createElement('span');
      wrap.className = 'kha-img-wrap';
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
      const overlay = document.createElement('div');
      overlay.className = 'kha-img-overlay';
      overlay.innerHTML = '<span>📷 رفع صورة جديدة</span>';
      overlay.addEventListener('click', () => beginImageReplace(img));
      wrap.appendChild(overlay);
    });
  }

  function beginEdit(el) {
    if (state.activeEl) finishEdit(false);
    state.activeEl = el;
    state.activeKey = el.getAttribute('data-kha-key');
    state.activeLang = document.documentElement.getAttribute('lang') || 'ar';
    el.classList.add('kha-active');

    const isPh = el.getAttribute('data-kha-ph') === '1';
    const current = readCurrent(state.activeLang, state.activeKey, el, isPh);

    // Decide between input and textarea based on current value length.
    const long = (current && current.length > 60) || /\n/.test(current || '');
    const editor = document.createElement(long ? 'textarea' : 'input');
    editor.className = long ? 'kha-inline-textarea' : 'kha-inline-input';
    editor.value = current || '';
    if (!long) editor.type = 'text';
    editor.dir = state.activeLang === 'ar' ? 'rtl' : 'ltr';

    // Hide pencil while editing.
    el.classList.add('kha-editing');
    // Stash original HTML and replace with editor (placeholder mode keeps the element visible).
    if (isPh) {
      // Keep element, append editor below.
      const wrap = document.createElement('div');
      wrap.style.marginTop = '6px';
      wrap.appendChild(editor);
      el.parentNode.insertBefore(wrap, el.nextSibling);
      el._khaWrap = wrap;
    } else {
      el._khaPrevHTML = el.innerHTML;
      el.innerHTML = '';
      el.appendChild(editor);
    }
    editor.focus();
    editor.select && editor.select();

    editor.addEventListener('blur', () => finishEdit(true));
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
      if (e.key === 'Enter' && !long) { e.preventDefault(); finishEdit(true); }
      // Ctrl/Cmd + Enter saves textarea
      if (e.key === 'Enter' && long && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finishEdit(true); }
    });
    state._editor = editor;
  }

  function finishEdit(commit) {
    if (!state.activeEl || !state._editor) return;
    const el = state.activeEl;
    const key = state.activeKey;
    const lang = state.activeLang;
    const isPh = el.getAttribute('data-kha-ph') === '1';
    const newVal = state._editor.value;
    const oldVal = readCurrent(lang, key, el, isPh);

    // Restore DOM.
    if (isPh) {
      if (el._khaWrap && el._khaWrap.parentNode) el._khaWrap.parentNode.removeChild(el._khaWrap);
      delete el._khaWrap;
    } else if (el._khaPrevHTML !== undefined) {
      el.innerHTML = el._khaPrevHTML;
      delete el._khaPrevHTML;
    }
    el.classList.remove('kha-active', 'kha-editing');
    state._editor = null;

    if (commit && newVal !== oldVal) {
      state.pending[lang] = state.pending[lang] || {};
      state.pending[lang][key] = newVal;
      // Update visible text immediately:
      if (isPh) el.setAttribute('placeholder', newVal);
      else el.innerHTML = newVal;
      el.setAttribute('data-kha-pending', '1');
      updateBadge();
      toast('تم — متنساش تدوس "حفظ التعديلات" عشان تنشر على الموقع.');
    }
    state.activeEl = null;
    state.activeKey = null;
  }

  function readCurrent(lang, key, el, isPh) {
    // Priority: pending > committed override > defaults > current DOM
    const pending = state.pending[lang] && state.pending[lang][key];
    if (pending !== undefined) return pending;
    const ovr = state.overrides[lang] && state.overrides[lang][key];
    if (ovr !== undefined) return ovr;
    const defaults = (window.__i18n_defaults && window.__i18n_defaults[lang]) || {};
    if (defaults[key] !== undefined) return defaults[key];
    if (isPh) return el.getAttribute('placeholder') || '';
    return el.innerHTML;
  }

  function updateBadge() {
    const dirty = countPending();
    const txt = badgeEl.querySelector('#khaBadgeText');
    if (!window.GitHubAPI || !window.GitHubAPI.isConfigured()) {
      badgeEl.classList.add('dirty');
      txt.textContent = dirty ? `(${dirty}) GitHub غير مهيّأ` : 'GitHub غير مهيّأ';
      saveBtn.disabled = true;
      return;
    }
    if (dirty > 0) {
      badgeEl.classList.add('dirty');
      txt.textContent = `${dirty} تعديل غير محفوظ`;
      saveBtn.disabled = false;
    } else {
      badgeEl.classList.remove('dirty');
      txt.textContent = 'كل التعديلات منشورة';
      saveBtn.disabled = true;
    }
  }
  function countPending() {
    let n = 0;
    for (const l of ['ar','en']) {
      for (const k of Object.keys(state.pending[l] || {})) {
        const cur = state.pending[l][k];
        const ovr = (state.overrides[l] || {})[k];
        if (cur !== ovr) n++;
      }
    }
    return n;
  }

  // ===== Commit pending edits to GitHub =====
  async function commitAll() {
    if (!window.GitHubAPI || !window.GitHubAPI.isConfigured()) {
      togglePanel(); return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ جاري الحفظ...';
    try {
      // Merge pending into overrides and persist as content.json.
      const merged = { ar: { ...(state.overrides.ar || {}) }, en: { ...(state.overrides.en || {}) } };
      for (const l of ['ar','en']) {
        for (const k of Object.keys(state.pending[l] || {})) {
          merged[l][k] = state.pending[l][k];
        }
      }
      // Strip keys that match defaults (keep file small).
      const defaults = window.__i18n_defaults || { ar: {}, en: {} };
      const out = { ar: {}, en: {} };
      for (const l of ['ar','en']) {
        for (const k of Object.keys(merged[l])) {
          if ((merged[l][k] ?? '') !== ((defaults[l] || {})[k] ?? '')) {
            out[l][k] = merged[l][k];
          }
        }
      }
      const json = JSON.stringify(out, null, 2);
      await window.GitHubAPI.commitText('content.json', json, `Update site copy (${countPending()} field${countPending()===1?'':'s'}) via inline edit`);
      // Success: clear pending, update overrides.
      state.overrides = out;
      state.pending = { ar: {}, en: {} };
      document.querySelectorAll('.kha-editable[data-kha-pending="1"]').forEach(el => el.removeAttribute('data-kha-pending'));
      toast('تم الحفظ على GitHub! الموقع هيتحدّث خلال دقيقة.');
    } catch (e) {
      toast('فشل الحفظ: ' + e.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 حفظ التعديلات';
      updateBadge();
    }
  }

  // ===== Image replacement =====
  function beginImageReplace(img) {
    if (!window.GitHubAPI || !window.GitHubAPI.isConfigured()) {
      toast('عدّ إعدادات GitHub الأول.', 'error');
      togglePanel(); return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const path = sanitizeImagePath(img.getAttribute('src') || '');
      if (!path) { toast('مش قادر أحدد مسار الصورة.', 'error'); return; }
      toast('بنرفع الصورة...');
      try {
        await window.GitHubAPI.commitBinary(path, file, `Update image ${path} via inline edit`);
        // Force-reload the image (cache bust).
        const bust = '?v=' + Date.now();
        const newSrc = path + bust;
        img.src = newSrc;
        // Also update <picture><source srcset> if any.
        const pic = img.closest('picture');
        if (pic) pic.querySelectorAll('source').forEach(s => {
          const set = s.getAttribute('srcset') || '';
          // Only touch the entry matching our path's basename
          const basename = path.split('/').pop().replace(/\.[^.]+$/,'');
          if (set.includes(basename)) {
            s.setAttribute('srcset', set.replace(/(\?v=\d+)?(\s|$)/g, bust + '$2'));
          }
        });
        toast('تم رفع الصورة. الموقع هيتحدث خلال دقيقة.');
      } catch (e) {
        toast('فشل الرفع: ' + e.message, 'error');
      }
    };
    input.click();
  }

  function sanitizeImagePath(src) {
    if (!src) return null;
    try {
      const u = new URL(src, window.location.href);
      // Only allow same-origin (or relative).
      if (u.origin !== window.location.origin) return null;
      let p = u.pathname.replace(/^\/+/, '');
      // Strip site base path if any (e.g. /khaled-portfolio/foo.png -> foo.png).
      const base = (window.location.pathname.replace(/[^/]*$/, '') || '').replace(/^\/+/, '');
      if (base && p.startsWith(base)) p = p.slice(base.length);
      return p;
    } catch { return null; }
  }

  // ===== Helpers =====
  function onKeydown(e) {
    if (e.key === 'Escape' && state.panelOpen) togglePanel();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function throttle(fn, ms) {
    let t = 0, last = 0;
    return function () {
      const now = Date.now();
      if (now - last > ms) { last = now; fn.apply(this, arguments); }
      else { clearTimeout(t); t = setTimeout(() => { last = Date.now(); fn.apply(this, arguments); }, ms); }
    };
  }
  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'kha-toast' + (kind === 'error' ? ' error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      setTimeout(() => t.remove(), 350);
    }, 2400);
  }
})();
