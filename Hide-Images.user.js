// ==UserScript==
// @name         xrt141 - Hide Images (LHI)
// @namespace    http://tampermonkey.net/
// @version      2.6.8
// @description  Luminance Hide Images (LHI) — persistently hide specific image URLs and optionally add them by clicking a red X overlay
// @author       xrt141
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-1.12.4.min.js
// @include      /^https://www\.empornium\.(me|sx|is)/
// @include      /^https://www\.enthralled\.me/
// @include      /^https://pornbay\.org/
// @include      /^https://www\.happyfappy\.org/
// @include      /^https://femdomcult\.org/
// @include      /^https://www\.homeporntorrents\.club/
// @include      /^https://kufirc\.com/
// @match        *://*.empornium.sx/torrents.php*
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // --- STORAGE KEYS ---
    const LHI_BLOCKED_KEY = 'lhi-blocked-images';
    const LHI_CLICKABLE_KEY = 'lhi-clickable-hide-enabled';

    // --- Defaults ---
    const DEFAULT_CLICKABLE = true;

    // --- Helpers ---
    const normUrl = (u) => {
        try { return new URL(String(u), window.location.href).href; } catch (e) { return String(u); }
    };

    const placeholderDataUri = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

    // --- Load / Save ---
    function loadBlocked() {
        try {
            const raw = GM_getValue(LHI_BLOCKED_KEY, '[]');
            const arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw || [];
            return new Set(arr.map(normUrl));
        } catch (e) { return new Set(); }
    }
    function saveBlocked(set) {
        try { GM_setValue(LHI_BLOCKED_KEY, JSON.stringify([...set])); } catch (e) {}
    }
    function loadClickableEnabled() {
        try { const v = GM_getValue(LHI_CLICKABLE_KEY); return v === undefined ? DEFAULT_CLICKABLE : !!v; } catch (e) { return DEFAULT_CLICKABLE; }
    }
    function saveClickableEnabled(v) { try { GM_setValue(LHI_CLICKABLE_KEY, !!v); } catch (e) {} }

    // --- State ---
    let blockedSet = loadBlocked();
    let clickableEnabled = loadClickableEnabled();

    // --- Styles (LHI-prefixed to ensure uniqueness) ---
    GM_addStyle(`
#lhi-conf-bg { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:10000; display:none; }
#lhi-conf-wrapper { background:#111; color:#ddd; width:80%; max-width:760px; margin:40px auto; padding:16px; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.6); font-family:Verdana, Arial, sans-serif; font-size:13px; }
#lhi-conf-wrapper h1 { margin:0 0 10px 0; color:#fff; font-size:16px; }
.lhi-section { margin:8px 0; padding:8px; border-radius:6px; background:linear-gradient(180deg,#141414,#1b1b1b); border:1px solid rgba(255,255,255,0.03); }
.lhi-row { display:flex; gap:8px; align-items:center; margin:6px 0; }
.lhi-row input[type='text'] { flex:1; padding:6px 8px; border-radius:4px; border:1px solid #333; background:#0f0f0f; color:#ddd; }
.lhi-button { background:#c33; color:#fff; border:none; border-radius:4px; padding:6px 8px; cursor:pointer; }
.lhi-button.secondary { background:#555; }
#lhi-blocked-list { max-height:260px; overflow:auto; border:1px solid #222; padding:8px; background:#0b0b0b; border-radius:4px; }
.lhi-blocked-entry { display:flex; align-items:center; gap:8px; padding:6px; border-bottom:1px solid rgba(255,255,255,0.02); }
.lhi-blocked-entry:last-child { border-bottom:none; }
.lhi-blocked-url { color:#9ec9ff; cursor:pointer; text-decoration:underline; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lhi-thumb-tooltip { position:fixed; z-index:11000; border:1px solid #333; background:#000; padding:4px; border-radius:4px; display:none; }
.lhi-remove-btn { background:transparent; color:#ff9; border:1px solid rgba(255,255,255,0.03); border-radius:4px; padding:2px 6px; cursor:pointer; }
.lhi-wrap { display:inline-block; position:relative; }
.lhi-overlay-x { position:absolute; top:3px; right:3px; background:rgba(200,0,0,0.95); color:#fff; width:18px; height:18px; line-height:18px; text-align:center; border-radius:50%; font-size:12px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.6); z-index:3; }
.lhi-blocked-hidden { opacity:0 !important; visibility:hidden !important; width:0 !important; height:0 !important; }
`);

    // --- UI Creation ---
    function addSettingsLink() {
        const candidates = [document.querySelector('#major_stats'), document.querySelector('#header'), document.querySelector('body > header'), document.querySelector('.page_nav'), document.querySelector('.nav'), document.querySelector('#navigation'), document.body].filter(Boolean);
        const container = candidates[0] || document.body;
        const profileLI = container.querySelector('a[href*="user.php"]')?.closest('li');
        const targetUL = profileLI?.parentElement?.tagName === 'UL' ? profileLI.parentElement : container.querySelector('ul');

        const li = document.createElement('li'); li.className = 'brackets lhi-config-li';
        const a = document.createElement('a'); a.href = '#'; a.className = 'lhi-config-link'; a.textContent = '⛭ LHI'; a.title = 'Luminance Hide Images - Settings';
        a.style.padding = '0 6px';
        a.addEventListener('click', (ev) => { ev.preventDefault(); openLHIConfig(); });
        li.appendChild(a);

        if (targetUL && profileLI) targetUL.insertBefore(li, profileLI);
        else if (targetUL) targetUL.insertBefore(li, targetUL.firstChild);
    }

    // Build modal DOM
    const modalBg = document.createElement('div');
    modalBg.id = 'lhi-conf-bg';
    modalBg.innerHTML = `
<div id="lhi-conf-wrapper">
  <h1>Luminance Hide Images — Settings (LHI)</h1>

  <div class="lhi-section">
    <div class="lhi-row"><label><input id="lhi-clickable-toggle" type="checkbox"> Enable clickable image hiding (shows red X)</label></div>
  </div>

  <div class="lhi-section">
    <h2 style="margin:0 0 8px 0; font-size:14px; color:#fff;">Blocked images</h2>
    <div class="lhi-row">
      <input id="lhi-add-url-input" type="text" placeholder="Paste image URL here to block">
      <button id="lhi-add-url-btn" class="lhi-button">Add</button>
    </div>
    <div id="lhi-blocked-list" aria-live="polite"></div>
  </div>

  <div style="display:flex; gap:8px; justify-content:center; margin-top:12px;">
    <button id="lhi-save-btn" class="lhi-button secondary">Close</button>
  </div>
</div>
`;
    document.body.appendChild(modalBg);

    const openLHIConfig = () => { renderBlockedList(); modalBg.style.display = 'block'; };
    const closeLHIConfig = () => { modalBg.style.display = 'none'; };
    modalBg.addEventListener('click', (e) => { if (e.target === modalBg) closeLHIConfig(); });

    // --- Tooltip for list hover ---
    const thumbTip = document.createElement('div'); thumbTip.className = 'lhi-thumb-tooltip'; document.body.appendChild(thumbTip);

    // --- Core functions ---
    function isBlockedUrl(u) { return blockedSet.has(normUrl(u)); }
    function addBlockedUrl(u) { const n = normUrl(u); blockedSet.add(n); saveBlocked(blockedSet); hideMatchingImages(n); renderBlockedList(); }
    function removeBlockedUrl(u) { const n = normUrl(u); if (blockedSet.has(n)) { blockedSet.delete(n); saveBlocked(blockedSet); unhideMatchingImages(n); renderBlockedList(); } }

    function getImgCandidateSrc(img) {
        return normUrl(img.getAttribute('src') || img.getAttribute('data-src') || img.src || '');
    }

    function hideImage(img) {
        if (!img) return;
        if (!img.dataset.lhiOrigSrc) {
            img.dataset.lhiOrigSrc = img.getAttribute('src') || '';
            img.dataset.lhiOrigDataSrc = img.getAttribute('data-src') || '';
        }
        // remove src/data-src to prevent network load and show placeholder
        img.setAttribute('src', placeholderDataUri);
        if (img.hasAttribute('data-src')) img.setAttribute('data-src', '');
        img.classList.add('lhi-blocked-hidden');
        // remove overlay if present
        const wrap = img.closest('.lhi-wrap');
        if (wrap) {
            const ov = wrap.querySelector('.lhi-overlay-x'); if (ov) ov.remove();
        }
    }

    function unhideImage(img) {
        if (!img) return;
        const orig = img.dataset.lhiOrigSrc || img.dataset.lhiOrigDataSrc || '';
        if (orig) img.setAttribute('src', orig);
        img.classList.remove('lhi-blocked-hidden');
        // leave overlays as they will be re-applied by scan
    }

    function hideMatchingImages(normalizedUrl) {
        document.querySelectorAll('img').forEach(img => {
            const src = getImgCandidateSrc(img);
            if (src === normalizedUrl) hideImage(img);
        });
    }

    function unhideMatchingImages(normalizedUrl) {
        document.querySelectorAll('img').forEach(img => {
            const src = img.dataset.lhiOrigSrc || getImgCandidateSrc(img);
            if (normUrl(src) === normalizedUrl) unhideImage(img);
        });
    }

    function applyOverlayToImage(img) {
        if (!clickableEnabled) return; // overlays disabled by setting
        if (img.closest('.lhi-wrap') && img.closest('.lhi-wrap').querySelector('.lhi-overlay-x')) return; // already has overlay

        // ensure wrapper
        if (!img.closest('.lhi-wrap')) {
            const wrapper = document.createElement('span'); wrapper.className = 'lhi-wrap';
            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
        }
        const wrap = img.closest('.lhi-wrap');

        // do not add overlay on already-blocked images
        const src = getImgCandidateSrc(img);
        if (blockedSet.has(src)) return;

        const ov = document.createElement('div'); ov.className = 'lhi-overlay-x'; ov.title = 'Block this image'; ov.textContent = '✖';
        ov.addEventListener('click', (ev) => {
            ev.stopPropagation(); ev.preventDefault();
            const url = getImgCandidateSrc(img);
            addBlockedUrl(url);
            hideImage(img);
        });
        wrap.appendChild(ov);
    }

    function scanAndApply() {
        // Process new images
        document.querySelectorAll('img:not(.lhi-processed)').forEach(img => {
            img.classList.add('lhi-processed');
            try {
                const src = getImgCandidateSrc(img);
                if (blockedSet.has(src)) {
                    hideImage(img);
                } else {
                    // attach overlay if enabled
                    applyOverlayToImage(img);
                }
            } catch (e) { /* ignore image errors */ }
        });
    }

    // MutationObserver to catch images added later
    const mo = new MutationObserver((mutations) => {
        let touched = false;
        for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length) touched = true;
            if (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'data-src')) touched = true;
        }
        if (touched) window.setTimeout(scanAndApply, 50);
    });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'data-src'] });

    // --- Blocked list UI ---
    const blockedListEl = modalBg.querySelector('#lhi-blocked-list');
    function renderBlockedList() {
        blockedListEl.innerHTML = '';
        const arr = [...blockedSet];
        if (!arr.length) { blockedListEl.innerHTML = '<div style="color:#999; padding:8px;">No blocked images.</div>'; return; }
        arr.forEach(u => {
            const entry = document.createElement('div'); entry.className = 'lhi-blocked-entry';
            const a = document.createElement('a'); a.className = 'lhi-blocked-url'; a.textContent = u; a.href = u; a.target = '_blank';
            // hover tooltip
            a.addEventListener('mouseenter', (ev) => {
                thumbTip.innerHTML = `<img src="${u}" style="max-width:180px; max-height:120px; display:block;">`;
                thumbTip.style.display = 'block';
                const r = a.getBoundingClientRect();
                thumbTip.style.left = (r.right + 8) + 'px';
                thumbTip.style.top = (r.top) + 'px';
            });
            a.addEventListener('mousemove', (ev) => {
                /* keep tooltip steady; position already set on enter */
            });
            a.addEventListener('mouseleave', () => { thumbTip.style.display = 'none'; thumbTip.innerHTML = ''; });

            const removeBtn = document.createElement('button'); removeBtn.className = 'lhi-remove-btn'; removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => { removeBlockedUrl(u); });

            entry.appendChild(a);
            entry.appendChild(removeBtn);
            blockedListEl.appendChild(entry);
        });
    }

    // --- Settings control bindings ---
    const clickableToggle = modalBg.querySelector('#lhi-clickable-toggle');
    const addUrlInput = modalBg.querySelector('#lhi-add-url-input');
    const addUrlBtn = modalBg.querySelector('#lhi-add-url-btn');
    const saveBtn = modalBg.querySelector('#lhi-save-btn');

    function refreshClickableToggle() { if (clickableToggle) clickableToggle.checked = !!clickableEnabled; }

    if (clickableToggle) clickableToggle.addEventListener('change', (ev) => {
        clickableEnabled = !!ev.target.checked;
        saveClickableEnabled(clickableEnabled);
        // remove or add overlays accordingly
        document.querySelectorAll('img.lhi-processed').forEach(img => {
            const wrap = img.closest('.lhi-wrap');
            if (!clickableEnabled) {
                if (wrap) { const ov = wrap.querySelector('.lhi-overlay-x'); if (ov) ov.remove(); }
            } else {
                applyOverlayToImage(img);
            }
        });
    });

    if (addUrlBtn) addUrlBtn.addEventListener('click', () => {
        const v = (addUrlInput.value || '').trim();
        if (!v) return;
        try { const n = normUrl(v); addBlockedUrl(n); addUrlInput.value = ''; } catch (e) { alert('Invalid URL'); }
    });
    addUrlInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') addUrlBtn.click(); });

    if (saveBtn) saveBtn.addEventListener('click', closeLHIConfig);

    // --- Public init ---
    function initLHI() {
        addSettingsLink();
        refreshClickableToggle();
        // initial scan
        scanAndApply();
        // ensure overlays applied for existing images when clickable enabled
        if (clickableEnabled) document.querySelectorAll('img.lhi-processed').forEach(applyOverlayToImage);
    }

    // Expose for debugging/automation
    window.lhiBlockedSet = blockedSet;
    window.lhiAddBlocked = addBlockedUrl;
    window.lhiRemoveBlocked = removeBlockedUrl;

    // Run
    initLHI();

})();

