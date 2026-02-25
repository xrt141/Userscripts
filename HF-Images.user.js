// ==UserScript==
// @name        Temporary Hamsterimage Fix
// @description Temporary fix for Hamsterimage issues.
// @version     0.0.2
// @author      xrt141
// @include     /https?://www\.happyfappy\.net/*
// @grant       GM_cookie
// @grant       GM_notification
// @grant       GM_openInTab
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_deleteValue
// @grant       GM_addStyle
// @grant       GM_info
// @downloadURL https://github.com/xrt141/Userscripts/raw/refs/heads/main/HF-Images.user.js
// @updateURL   https://github.com/xrt141/Userscripts/raw/refs/heads/main/HF-Images.user.js
// ==/UserScript==
// Changelog:

(function(){
    'use strict';

    // only operate on torrent detail pages
    if (!/\/torrents\.php\?id=\d+/i.test(location.href)) {
        return; // exit silently on other pages
    }

    // helper that fetches a URL via GM_xmlhttpRequest and returns a blob URL
    function fetchWithoutReferer(url, cb, errCb) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            responseType: 'blob',
            timeout: 20000,
            onload(res) {
                if (res.status >= 200 && res.status < 400) {
                    try {
                        // convert blob to data URI to satisfy CSP (blob: blocked)
                        const reader = new FileReader();
                        reader.onloadend = function() {
                            cb(reader.result);
                        };
                        reader.onerror = function(e) {
                            console.error('HF-Images: FileReader error', e);
                            if (errCb) errCb(e);
                        };
                        reader.readAsDataURL(res.response);
                    } catch (e) {
                        console.error('HF-Images: failed to read blob', e);
                        if (errCb) errCb(e);
                    }
                } else {
                    console.warn('HF-Images: non‑OK response', res.status, url);
                    if (errCb) errCb(res);
                }
            },
            onerror(e) {
                console.error('HF-Images: xhr error', e, url);
                if (errCb) errCb(e);
            },
            ontimeout() {
                console.warn('HF-Images: xhr timeout', url);
                if (errCb) errCb(new Error('timeout'));
            }
        });
    }

    function replaceImg(img) {
        if (!img || !img.src) return;
        const url = img.src;
        if (url.indexOf('hamsterimg.net') === -1) return;

        // clear the src so the browser stops trying to load it normally
        img.removeAttribute('src');

        fetchWithoutReferer(url, blobUrl => {
            img.src = blobUrl;
        }, () => {
            // leave the src empty so it can be retried by other code if needed
        });
    }

    // work on existing images
    document.querySelectorAll('img[src*="hamsterimg.net"]').forEach(replaceImg);

    // watch for dynamically added images
    const mo = new MutationObserver(muts => {
        muts.forEach(m => {
            m.addedNodes.forEach(n => {
                if (n.nodeType !== 1) return;
                if (n.tagName === 'IMG') {
                    replaceImg(n);
                } else if (n.querySelectorAll) {
                    n.querySelectorAll('img[src*="hamsterimg.net"]').forEach(replaceImg);
                }
            });
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });

})();

