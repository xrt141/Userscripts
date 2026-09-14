// ==UserScript==
// @name         xrt141 - Image Toggle
// @namespace    http://tampermonkey.net/
// @version      2.6.7
// @description  Button to hide all images on Emp/SX torrents.php pages (and similar) to reduce clutter and improve performance.  Also adds a keyboard shortcut (Ctrl+Shift+M) to toggle images.
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

    const KEY = 'hideImages.enabled.v1';
    const STYLE_ID = 'gm-hide-images-style';
    const BUTTON_ID = 'gm-hide-images-toggle';
    const HIDE_CLASS = 'gm-images-hidden';

    // CSS that removes images from layout (they occupy no space)
    const HIDE_CSS = `
/* Hide images so they take no layout space */
body.${HIDE_CLASS} img, body.${HIDE_CLASS} picture, body.${HIDE_CLASS} picture > img, body.${HIDE_CLASS} figure img, body.${HIDE_CLASS} input[type="image"] {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
}
`;

    const BUTTON_CSS = `
#${BUTTON_ID} {
  position: fixed;
  left: 20px;
  bottom: 70px; /* placed above the Refresh TN button (bottom:20px) */
  z-index: 9999;
  background-color: #007bff;
  color: #fff;
  border: none;
  padding: 5px 8px;
  font-size: 14px;
  border-radius: 5px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: pointer;
}
#${BUTTON_ID}:hover { transform: translateY(-1px); opacity: 0.95; }
#${BUTTON_ID}.active { background-color: #e55353; }
#${BUTTON_ID}.gm-hidden-icon { padding-left: 10px; }
`;

    // Safe storage helpers (prefer GM_*, fallback to localStorage)
    function getStored(key, fallback) {
        try {
            if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
        } catch (e) {}
        try { return JSON.parse(localStorage.getItem(key)); } catch (e) {}
        return fallback;
    }
    function setStored(key, value) {
        try {
            if (typeof GM_setValue === 'function') return GM_setValue(key, value);
        } catch (e) {}
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    function ensureStyle(id, css) {
        if (typeof GM_addStyle === 'function') {
            try { GM_addStyle(css); return; } catch (e) { /* fall through */ }
        }
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('style');
            el.id = id;
            el.textContent = css;
            (document.head || document.documentElement).appendChild(el);
        } else {
            el.textContent = css;
        }
    }

    function removeStyle(id) {
        const el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function createToggle() {
        // Avoid duplicate button
        if (document.getElementById(BUTTON_ID)) return document.getElementById(BUTTON_ID);

        // Inject CSS for the button
        ensureStyle(BUTTON_ID + '-css', BUTTON_CSS);

        const btn = document.createElement('button');
        btn.id = BUTTON_ID;
        btn.type = 'button';
        btn.title = 'Toggle images (hide / show)';
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = 'Hide images';

        btn.addEventListener('click', () => {
            const enabled = !isHidden();
            applyHidden(enabled);
            setStored(KEY, enabled);
        });

        // small keyboard shortcut: Ctrl+Shift+M to toggle
        window.addEventListener('keydown', (ev) => {
            if (ev.ctrlKey && ev.shiftKey && !ev.altKey && (ev.key === 'M' || ev.key === 'm')) {
                ev.preventDefault();
                btn.click();
            }
        });

        document.body.appendChild(btn);
        return btn;
    }

    function isHidden() {
        try {
            const stored = getStored(KEY, false);
            return !!stored;
        } catch (e) { return false; }
    }

    function applyHidden(enable) {
        const btn = createToggle();
        if (enable) {
            ensureStyle(STYLE_ID, HIDE_CSS);
            document.body.classList.add(HIDE_CLASS);
            btn.classList.add('active');
            btn.textContent = 'Show images';
            btn.setAttribute('aria-pressed', 'true');
        } else {
            document.body.classList.remove(HIDE_CLASS);
            btn.classList.remove('active');
            btn.textContent = 'Hide images';
            btn.setAttribute('aria-pressed', 'false');
        }
    }

    // Initialize
    function init() {
        // Create/attach UI
        createToggle();

        // Apply stored state
        const enabled = isHidden();
        if (enabled) applyHidden(true);

        // Keep button present even if page rewrites body (observe body replacement)
        const bodyObserver = new MutationObserver(() => {
            if (!document.getElementById(BUTTON_ID)) createToggle();
        });
        bodyObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }

    // Run when DOM is ready or immediately if already loaded
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else init();

})();
