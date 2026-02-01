// ==UserScript==
    // @name        Luminance Direct Thumbnails+
    // @version     2.6.4
    // @include     /https?://www\.empornium\.(is|sx)/*
    // @include     /https?://www\.happyfappy\.org/*
    // @include     /https?://femdomcult\.org/*
    // @include     /https?://www\.cheggit\.me/torrents\.php.*/
    // @exclude     /https?://www\.cheggit\.me/torrents\.php\?id.*/
    // @include     /https?://www\.cheggit\.me/user\.php.*/
    // @license     MIT
    // @require     http://code.jquery.com/jquery-2.1.1.js
    // @grant       GM_addStyle
    // @grant       GM_xmlhttpRequest
    // @grant       GM_getValue
    // @grant       GM_setValue
    // @connect     hamsterimg.net
    // @connect     imgbox.com
    // @connect     empornium.is
    // @connect     *.empornium.sx
    // @connect     imagebam.com
    // @downloadURL https://github.com/xrt141/Userscripts/raw/refs/heads/main/Luminance%20Direct%20Thumbnails+.user.js
    // @updateURL   https://github.com/xrt141/Userscripts/raw/refs/heads/main/Luminance%20Direct%20Thumbnails+.user.js
    // ==/UserScript==

/* ========================================================================================
   Luminance Direct Thumbnails+ - Forked from Whatcd Gazelle Direct Thumbnails 12.x?
   ======================================================================================== */


    "use strict";

    (function () {
        var max_image_size = 250;
        var replace_categories = true;
        var remove_categories = false;
        var image_size = "Medium"; // allowed: "Thumbnail" | "Medium" | "Full
        var preserve_animated_images = true; // Will not change urls to MD or TH if they are GIF or WEBP
        var disable_site_hover_images = true; // removes the sites own images on hover. (Reduces image host calls and reduces throttling)
        var max_retry_attempts = 10; //Retry attempts for failed images
        var retry_delay_ms = 1000; // Image Retry Delay MS
        var blacklisted_domains = ['hamster.is', 'example.com']; // Do not load images from these domains
        var blocked_placeholder_scale = 0.25; // 0.5 => half size, change to 0.4, 0.75, etc.
        var sequential_load = true; // set false to revert to old lazy-in-viewport behavior
        var sequential_load_delay_ms = 300;
        // NEW: Sequential+ concurrency: number of images to actively load in parallel when sequential mode is enabled.
        // Set to 1 for classic single-worker sequential behavior, >1 enables "Sequential+".
        var concurrent_active_loads = 4;

        var auto_refresh_failed_after_ms = 2500; // auto-refresh failed/stalled thumbs ~2.5s after first pass
        var stall_timeout_ms = 4000; // mark as "stalled" if not loaded by this time (ms)
        // NEW: Blob fetch fallback
        var blob_fetch_hosts = ['hamsterimg.net']; // only these domains use Blob fallback
        var blob_fetch_on_error = true; // switch to Blob on <img> error
        var blob_fetch_on_stall = true; // switch to Blob when watchdog marks tn-stalled

        var debug_logging = true; // enable/disable console output per your request
        var debug_prefix = ''; // keep empty for clean lines, or set to '[TN] '

        // NEW: Image caching settings
        var enable_image_caching = true; // enable/disable IndexedDB image caching
        var max_cached_images = 100; // maximum number of images to cache



        var host_rewrites = [
            { from: 'domain1.is', to: 'domain2.net', subdomains: true, force_https: false },
            { from: 'hamster.is', to: 'hamsterimg.net', subdomains: true, force_https: false }
        ];

        // Load persisted settings (GM_getValue if available, else localStorage) and override defaults
        (function loadPersistedLDTSettings() {
            const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
            window.ldt_persistence_source = hasGM ? 'GM' : 'localStorage';
            if (debug_logging) console.log('LDT: persistence source = ' + window.ldt_persistence_source);

            const getRaw = (key, def) => {
                try {
                    if (hasGM) return GM_getValue(key, def);
                    const v = localStorage.getItem(key);
                    return v === null ? def : v;
                } catch (e) { return def; }
            };
            const boolVal = (key, def) => {
                const v = getRaw(key, def);
                return v === true || v === 'true' || v === 1 || v === '1';
            };
            try {
                // Numeric and string values
                const p_max_image_size = Number(getRaw('ldt_max_thumb', max_image_size)) || max_image_size;
                const p_image_size = String(getRaw('ldt_image_size', image_size)) || image_size;
                // Boolean flags
                const p_preserve_animated = boolVal('ldt_preserve_animated', preserve_animated_images);
                const p_disable_site_hover = boolVal('ldt_disable_site_hover', disable_site_hover_images);
                const p_replace_categories = boolVal('ldt_replace_categories', replace_categories);
                const p_remove_categories = boolVal('ldt_remove_categories', remove_categories);
                // Retry/timing
                const p_max_retry_attempts = Number(getRaw('ldt_max_retry_attempts', max_retry_attempts)) || max_retry_attempts;
                const p_retry_delay_ms = Number(getRaw('ldt_retry_delay_ms', retry_delay_ms)) || retry_delay_ms;
                // Sequential mode (string or legacy boolean fallback)
                let p_sequential_mode = getRaw('ldt_sequential_mode', null);
                p_sequential_mode = p_sequential_mode ? String(p_sequential_mode) : (boolVal('ldt_sequential_load', sequential_load) ? 'sequential' : 'off');
                // Concurrent setting for Sequential+
                let p_concurrent_active_loads = Number(getRaw('ldt_concurrent_active_loads', concurrent_active_loads));
                if (!Number.isFinite(p_concurrent_active_loads) || p_concurrent_active_loads < 1) p_concurrent_active_loads = concurrent_active_loads || 1;
                const p_sequential_load_delay_ms = Number(getRaw('ldt_sequential_load_delay_ms', sequential_load_delay_ms)) || sequential_load_delay_ms;
                const p_auto_refresh_failed_after_ms = Number(getRaw('ldt_auto_refresh_failed_after_ms', auto_refresh_failed_after_ms)) || auto_refresh_failed_after_ms;
                const p_stall_timeout_ms = Number(getRaw('ldt_stall_timeout_ms', stall_timeout_ms)) || stall_timeout_ms;
                const p_debug_logging = boolVal('ldt_debug_logging', debug_logging);
                const p_enable_image_caching = boolVal('ldt_enable_image_caching', enable_image_caching);
                const p_max_cached_images = Number(getRaw('ldt_max_cached_images', max_cached_images)) || max_cached_images;

                // Apply overrides to the local defaults
                max_image_size = p_max_image_size;
                image_size = p_image_size;
                preserve_animated_images = p_preserve_animated;
                disable_site_hover_images = p_disable_site_hover;
                replace_categories = p_replace_categories;
                remove_categories = p_remove_categories;
                max_retry_attempts = p_max_retry_attempts;
                retry_delay_ms = p_retry_delay_ms;
                sequential_load_delay_ms = p_sequential_load_delay_ms;
                auto_refresh_failed_after_ms = p_auto_refresh_failed_after_ms;
                stall_timeout_ms = p_stall_timeout_ms;
                debug_logging = p_debug_logging;
                window.debug_logging = debug_logging;
                enable_image_caching = p_enable_image_caching;
                max_cached_images = p_max_cached_images;

                // Map the string mode into the boolean and concurrency globals used by the rest of the script
                switch (String(p_sequential_mode).toLowerCase()) {
                    case 'off':
                    case 'lazy':
                        sequential_load = false;
                        // keep concurrent_active_loads unchanged
                        break;
                    case 'sequential':
                        sequential_load = true;
                        concurrent_active_loads = 1;
                        break;
                    case 'sequential_plus':
                    case 'sequential+':
                        sequential_load = true;
                        concurrent_active_loads = Math.max(1, Math.floor(p_concurrent_active_loads));
                        break;
                    default:
                        // Unknown value: fallback to legacy boolean key
                        sequential_load = boolVal('ldt_sequential_load', sequential_load);
                        break;
                }

                // Debug output block listing the effective settings; controlled by debug flag
                if (debug_logging) {
                    try {
                        console.groupCollapsed('LDT Effective Settings');
                        console.log('max_image_size:', max_image_size);
                        console.log('image_size:', image_size);
                        console.log('preserve_animated_images:', preserve_animated_images);
                        console.log('disable_site_hover_images:', disable_site_hover_images);
                        console.log('replace_categories:', replace_categories);
                        console.log('remove_categories:', remove_categories);
                        console.log('max_retry_attempts:', max_retry_attempts);
                        console.log('retry_delay_ms:', retry_delay_ms);
                        console.log('sequential_mode:', p_sequential_mode);
                        console.log('concurrent_active_loads:', concurrent_active_loads);
                        console.log('sequential_load_delay_ms:', sequential_load_delay_ms);
                        console.log('auto_refresh_failed_after_ms:', auto_refresh_failed_after_ms);
                        console.log('stall_timeout_ms:', stall_timeout_ms);
                        console.log('debug_logging:', debug_logging);
                        console.log('enable_image_caching:', enable_image_caching);
                        console.log('max_cached_images:', max_cached_images);
                        console.groupEnd();
                    } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore persistence read failures */ }
        })();



        // --- Hover Image Disabler---
        (function installHoverImageDisabler() {
            if (!disable_site_hover_images) return;

            const HOVER_SELECTORS = [
                '.tooltip', '.hover', '.preview', '.bubble', '.popup',
                '#tooltip', '[class*="hover"]', '[class*="tooltip"]', '[id*="tooltip"]'
            ];
            const HOVER_SELECTOR_STR = HOVER_SELECTORS.join(',');

            function isHoverContainer(node) {
                if (!node || node.nodeType !== 1) return false;
                const el = node;
                if (el.matches(HOVER_SELECTOR_STR)) return true;
                // Walk up ancestors to catch nested structures
                for (let p = el, i = 0; i < 4 && p; i++, p = p.parentElement) {
                    if (p.matches(HOVER_SELECTOR_STR)) return true;
                    const style = getComputedStyle(p);
                    if ((style.position === 'absolute' || style.position === 'fixed') && parseInt(style.zIndex || '0', 10) >= 1000) return true;
                }
                return false;
            }

            function neutralizeImages(root) {
                root.querySelectorAll('img[src]:not(.tn-controlled)').forEach(img => {
                    const url = img.getAttribute('src');
                    if (url) {
                        img.setAttribute('data-src', url);
                        img.removeAttribute('src');
                    }
                });
            }

            const mo = new MutationObserver(mutations => {
                for (const m of mutations) {
                    m.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;
                        const el = node;
                        if (isHoverContainer(el) || el.querySelector(HOVER_SELECTOR_STR)) {
                            neutralizeImages(el);
                        }
                    });
                    if (m.type === 'attributes' && m.target && isHoverContainer(m.target)) {
                        neutralizeImages(m.target);
                    }
                }
            });

            mo.observe(document.documentElement || document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'id', 'style']
            });
        })();


        // --- DEBUG LOGGER (inside the IIFE) ---
        const dbg = (line) => { if (debug_logging) console.log(line); };
        const isSingleWorkerSeq = () => {
            const inst = window.lazyThumbsInstance;
            return inst && inst.sequential_load && (typeof inst.concurrent_limit !== 'number' || inst.concurrent_limit <= 1);
        };
        function logBegin(url) {
            if (isSingleWorkerSeq()) { dbg(''); dbg('=========================================='); }
            dbg('--- Begin Loading image: ' + url);
        }
        function logFinish(url) {
            dbg('--- Finished loading image: ' + url);
            if (isSingleWorkerSeq()) { dbg('=========================================='); dbg(''); }
        }
        const logWait = (ms) => dbg('----- Waiting ' + ms + 'ms');
        const logTimeout = (url) => dbg('----- Timeout expired Image Stalled. ' + url);
        const logRetry = (n, url) => dbg('----- Retry #' + n + ' Image ' + url);
        const logSkip = (msg) => dbg('----- ' + msg);



        // Expose to the rest of the script (LazyThumbnails is declared outside the IIFE)
        window.debug_logging = debug_logging; // so global code can read the flag if needed
        window.logBegin = logBegin;
        window.logFinish = logFinish;
        window.logWait = logWait;
        window.logTimeout= logTimeout;
        window.logRetry = logRetry;
        window.logSkip = logSkip;

        var backend = create_backend(replace_categories);
        window.lazyThumbsInstance = new LazyThumbnails(
             new ProgressBar(),
             backend,
             image_size,
             preserve_animated_images,
             replace_categories,
             remove_categories,
             max_image_size,
             max_retry_attempts,
             retry_delay_ms,
             blacklisted_domains,
             blocked_placeholder_scale,
             sequential_load,
             sequential_load_delay_ms,
             concurrent_active_loads,
             host_rewrites,
             auto_refresh_failed_after_ms,
             stall_timeout_ms,
             blob_fetch_hosts,
             blob_fetch_on_error,
             blob_fetch_on_stall,
             enable_image_caching,
             max_cached_images
         );



    })();



    (function addThumbnailRefreshButton() {
        const btn = document.createElement('button');
        btn.textContent = '🔁 Refresh TN';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            zIndex: '9999',
            padding: '5px 5px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        });



        btn.addEventListener('click', () => {
            const instance = window.lazyThumbsInstance;
            if (!instance) return;

            // Debug log for manual refresh invocation
            if (window.debug_logging) {
                console.log('LDT: Manual refresh requested by user (Refresh TN button)');
            }

            instance.images.forEach($img => {
                // Cancel any pending retry timers
                const tid = $img.data('retryTimeoutId');
                if (tid) { clearTimeout(tid); $img.removeData('retryTimeoutId'); }

                const src = $img.data('src');
                const isBlocked = instance.isBlacklisted(src);

                // If an image is already loaded and displaying, don't relaunch it.
                const el = $img[0];
                const naturalOK = (el && el.complete && el.naturalWidth > 0) || $img.data('loaded');
                if (naturalOK) {
                    // Ensure no dangling handlers; keep it as-is
                    $img.off('error.lazyRetry load.lazyRetry');
                    $img.data('isLoading', false);
                    return;
                }

                // Reset flags/handlers only for images we actually plan to restart
                $img.data('retryCount', 0)
                    .removeClass('tn-failed tn-blocked')
                    .off('error.lazyRetry load.lazyRetry')
                    .data('isLoading', false)
                    .removeData('loaded');

                if (isBlocked) {
                    const ph = instance.block_placeholder_data_uri(instance.max_image_size);
                    $img.prop('src', ph).addClass('tn-blocked');
                } else if (src) {
                    // Relaunch through normal show flow (handlers + guards attach)
                    instance.show_img($img);
                }
            });



            if (!instance.sequential_load) {
                instance.attach_scroll_event();
            } else {
                instance.detach_scroll_event();
            }
            instance.load_next_image(true);

        });



        document.body.appendChild(btn);
    })();


    GM_addStyle(`
        #major_stats_left { display: inline-block; position}
        #userinfo_username li ul {right:0; left:auto;}
        .small-category { vertical-align: top !important; }
        .overlay-category td > div[title],
        .overlay-category .cats_col  > div,
        .overlay-category .cats_cols > div { position: absolute; overflow: hidden; }
        .overlay-category-small td > div[title],
        .overlay-category-small .cats_col  > div,
        .overlay-category-small .cats_cols > div { width: 11px; }
        .remove-category td > div[title],
        .remove-category .cats_col  > div,
        .remove-category .cats_cols > div { display: none; }
        /* Loading states */
        .tn-blocked { opacity: 0.5; filter: grayscale(1); }
        .tn-stalled { opacity: 0.5; }
        
        /* Image wrapper for spinner overlay */
        .tn-img-wrap {
            position: relative;
            display: inline-block;
            vertical-align: top;
            background: #1a1a1a;
        }
        .tn-img-wrap img {
            display: block;
        }
        /* Hide img element while loading (class-based, not :has()) */
        .tn-img-wrap.tn-loading img {
            visibility: hidden;
        }
        /* DEBUG: Bright red border on ALL images to help identify mystery element */
        img:not([src]), img[src=""] {
            outline: 5px solid red !important;
            background: yellow !important;
        }
        
        /* Loading spinner overlay */
        .tn-spinner {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #222 !important; /* Solid opaque background to hide anything beneath */
            z-index: 9999;
            pointer-events: none;
        }
        .tn-spinner::after {
            content: '';
            width: 28px;
            height: 28px;
            border: 3px solid rgba(255,255,255,0.35);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: tn-spin 0.7s linear infinite;
            box-shadow: 0 0 12px rgba(0,0,0,0.3);
        }
        @keyframes tn-spin {
            to { transform: rotate(360deg); }
        }

        /* Modal / Config UI styles - Aligned with LTH */
        #s-conf-background-ldt { position:fixed; top:0; bottom:0; left:0; right:0; z-index:1000; background-color:rgba(50,50,50,0.6); }
        #s-conf-wrapper-ldt { background:#eee; color:#444; position:relative; width:80%; min-width:500px; max-width:900px; min-height:200px; overflow:hidden; margin:50px auto; font-size:14px; padding:15px 20px; border-radius:12px; box-shadow:0 0 20px rgba(0,0,0,0.6); max-height:90vh; overflow-y:auto; overflow-x:hidden; z-index:9999; }
        #s-conf-wrapper-ldt h1 { margin:0 0 12px 0; color:#333; font-size:18px; }
        #s-conf-wrapper-ldt h2 { margin:10px 0 8px 0; background:none; text-align:left; color:#333; padding:0px 0px 0px 10px; font-size:14px; font-weight:bold; }
        .ldt-section { margin:5px 0; padding:5px; border-radius:6px; background:linear-gradient(180deg,#ffffff,#f2f4f6); border:1px solid rgba(0,0,0,0.06); }
        .ldt-section h2 { margin:0 0 8px 0; font-size:13px; color:#333; font-weight:bold; }
        .ldt-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 15px; align-items:start; }
        @media (max-width:780px) { .ldt-grid { grid-template-columns:1fr; } #s-conf-wrapper-ldt { min-width:320px; } }
        .ldt-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; line-height:1.4; padding: 0px 0px 0px 18px;}
        .ldt-label { display:flex; align-items:center; gap:6px; width:100%; position:relative; font-size:13px; }
        .ldt-label-text { white-space:nowrap; }
        .ldt-label input[type='checkbox'] { margin:0; transform:scale(1.1); flex-shrink:0; }
        .ldt-label .ldt-control { flex:1; display:flex; justify-content:space-between; align-items:center; position:relative; }
        label { cursor:pointer; }
        input[type='number'].ldt-number { width:90px; padding:4px 6px; border-radius:4px; border:1px solid #ccc; font-size:12px; }
        select.ldt-select { padding:4px 6px; border-radius:4px; border:1px solid #ccc; font-size:12px; background:#fff; }
        .s-conf-save-ldt, .s-conf-close-ldt {background: #cfcfcf; margin-top: 12px; height: 22px; color: #000; border: 1px solid #777; border-radius: 6px; padding: 0px 4px; font-size: 12px; cursor: pointer; text-align: center;box-sizing: border-box;}
        .s-conf-buttons-ldt { display:flex; justify-content:center; gap:12px; margin-top:12px; border-top:1px solid #999; }
        .s-conf-buttons-ldt input[type='button'] { border-radius:6px; border:1px solid #444; }
        .s-conf-buttons-ldt input[type='button']:hover { background:#f0f0f0; }
        .ldt-note { color:#666; font-size:12px; margin-top:6px; line-height:1.4; }
    `);

    this.$ = this.jQuery = jQuery.noConflict(true);

    function ProgressBar() {
        var self = this;

        this.handle = jQuery('<div>');
        this.bar = jQuery('<div>');
        this.visibility_change_duration = 1; // in seconds
        this.bar_value_change_duration = 0.15; // in seconds

        this.init = function () {
            self.handle.css({
                'background': 'none',
                'width': '100%',
                'height': '4px',
                'position': 'fixed',
                'bottom': '0', // top or bottom
                'left': '0',
                'opacity': '1.0'
            });
            self.bar.css({
                'background': '#2688FF',
                'width': '0%',
                'height': '100%'
            });
            self.bar.appendTo(self.handle);
            self.handle.appendTo('body');

            self.set_visibility_change_duration(self.visibility_change_duration);
            self.set_bar_value_change_duration(self.bar_value_change_duration);
        };

        this.set_visibility_change_duration = function (value) {
            self.visibility_change_duration = value;
            self.handle.css({
                'transition': 'visibility ' + value + 's ease-in ' + value + 's, opacity ' + value + 's ease-in',
                'transition-delay': '0s'
            });
        };

        this.set_bar_value_change_duration = function (value) {
            self.bar_value_change_duration = value;
            self.bar.css({ 'transition': 'width ' + value + 's linear' });
        };

        this.set_value = function (value) {
            self.bar.css({ 'width': value * 100 + '%' });
        };

        this.show = function () {
            self.handle.css({
                'visibility': 'visible',
                'opacity': '1.0'
            });
        };

        this.hide = function () {
            self.handle.css({
                'visibility': 'hidden',
                'opacity': '0.0'
            });
        };

        this.init();
    }

    function get_$category($row) {
        var $category;

        $category = jQuery('td.cats_col', $row);
        if ($category.length)
            return $category;

        $category = jQuery('td.cats_cols', $row);
        if ($category.length)
            return $category;

        $category = jQuery('td > div[title]', $row).parent();
        if ($category.length)
            return $category;

        return jQuery();
    }

    function get_$title($row) {
        var $title;

        $title = jQuery('td.cats_col + td', $row);
        if ($title.length)
            return $title;

        $title = jQuery('td.cats_cols + td', $row);
        if ($title.length)
            return $title;

        $title = jQuery('td > div[title]', $row).parent().next('td');
        if ($title.length)
            return $title;

        return jQuery();
    }

    function disable_images(html) {
        // replace src inside img node with data-src
        // to prevent preloading all images by browser
        return html.replace(/ src=/g, ' data-src=');
    }

    // --- Image Cache Manager for IndexedDB ---
    function ImageCacheManager(enableCaching, maxCachedImages) {
        var self = this;
        this.enabled = !!enableCaching;
        this.maxImages = Math.max(1, Math.floor(maxCachedImages || 100));
        this.dbName = 'LDT_ImageCache';
        this.storeName = 'images';
        this.db = null;
        this.initPromise = null;

        // Initialize IndexedDB
        this.init = function() {
            if (!self.enabled) return Promise.resolve();
            if (self.initPromise) return self.initPromise;

            self.initPromise = new Promise((resolve, reject) => {
                try {
                    const request = indexedDB.open(self.dbName, 1);
                    request.onerror = () => {
                        console.error('LDT: IndexedDB open failed', request.error);
                        self.enabled = false;
                        reject(request.error);
                    };
                    request.onsuccess = () => {
                        self.db = request.result;
                        if (window.debug_logging) console.log('LDT: IndexedDB initialized');
                        resolve();
                    };
                    request.onupgradeneeded = (e) => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains(self.storeName)) {
                            const store = db.createObjectStore(self.storeName, { keyPath: 'url' });
                            store.createIndex('timestamp', 'timestamp', { unique: false });
                        }
                    };
                } catch (e) {
                    console.error('LDT: IndexedDB init error', e);
                    self.enabled = false;
                    reject(e);
                }
            });
            return self.initPromise;
        };

        // Get image from cache
        this.getImage = function(url) {
            if (!self.enabled || !self.db) return Promise.resolve(null);
            return new Promise((resolve) => {
                try {
                    const tx = self.db.transaction([self.storeName], 'readonly');
                    const store = tx.objectStore(self.storeName);
                    const request = store.get(url);
                    request.onsuccess = () => {
                        if (window.debug_logging && request.result) {
                            console.log('LDT: Cache hit for ' + url);
                        }
                        resolve(request.result || null);
                    };
                    request.onerror = () => resolve(null);
                } catch (e) {
                    console.error('LDT: Cache get error', e);
                    resolve(null);
                }
            });
        };

        // Store image in cache
        this.setImage = function(url, dataUrl) {
            if (!self.enabled || !self.db) return Promise.resolve();
            return new Promise((resolve) => {
                try {
                    const tx = self.db.transaction([self.storeName], 'readwrite');
                    const store = tx.objectStore(self.storeName);
                    const data = { url: url, dataUrl: dataUrl, timestamp: Date.now() };
                    const request = store.put(data);
                    request.onsuccess = () => {
                        if (window.debug_logging) console.log('LDT: Cached image ' + url);
                        self.enforceMaxSize();
                        resolve();
                    };
                    request.onerror = () => {
                        console.error('LDT: Cache set error', request.error);
                        resolve();
                    };
                } catch (e) {
                    console.error('LDT: Cache set error', e);
                    resolve();
                }
            });
        };

        // Enforce max cache size by deleting oldest entries
        this.enforceMaxSize = function() {
            if (!self.enabled || !self.db) return;
            try {
                const tx = self.db.transaction([self.storeName], 'readwrite');
                const store = tx.objectStore(self.storeName);
                const countRequest = store.count();
                countRequest.onsuccess = () => {
                    const count = countRequest.result;
                    if (count > self.maxImages) {
                        const index = store.index('timestamp');
                        const range = IDBKeyRange.upperBound(Date.now());
                        const delRequest = index.openCursor(range);
                        let deleted = 0;
                        delRequest.onsuccess = (event) => {
                            const cursor = event.target.result;
                            if (cursor && deleted < (count - self.maxImages)) {
                                cursor.delete();
                                deleted++;
                                cursor.continue();
                            }
                        };
                    }
                };
            } catch (e) {
                console.error('LDT: Cache cleanup error', e);
            }
        };

        // Clear entire cache
        this.clear = function() {
            if (!self.db) return Promise.resolve();
            return new Promise((resolve) => {
                try {
                    const tx = self.db.transaction([self.storeName], 'readwrite');
                    const store = tx.objectStore(self.storeName);
                    store.clear().onsuccess = () => resolve();
                } catch (e) {
                    console.error('LDT: Cache clear error', e);
                    resolve();
                }
            });
        };

        // Initialize on creation
        this.init();
    }

    function ImagesFromHover(replace_categories) {
        this.get_image_src = function ($row) {
            var script = jQuery('script', $row).text().trim();
            var matches = script.match(/^var.*?= ?(.*)$/);
            if (matches && matches.length == 2) {
                var hover_html = eval(matches[1]);
                if (hover_html === undefined) {
                    return;
                }
                var safe_html = disable_images(hover_html);
                var $frag = jQuery(safe_html);
                var $img = $frag.find('img').first();
                var src = $img.data('src');
                if (!src) {
                    // Use a site-relative 'no image' placeholder. Preserve host (including www) and port.
                    var host = window.location.host;
                    return window.location.protocol + '//' + host + '/static/common/noartwork/noimage.png';
                }
                return src;
            }
        };

        this.attach_image = function ($row, $img) {
            var $wrap = $img.data('$wrap') || $img;
            if (replace_categories) {
                var $category = get_$category($row);
                $category.append($wrap);
            }
            else {
                var $title = get_$title($row);
                $wrap.css({
                    'float': 'left',
                    'margin-right': '7px'
                });
                $title.prepend($wrap);
            }
        };
    }

    function LazyThumbnails(progress, backend, image_size, preserve_animated_images, replace_categories, remove_categories,
                            max_image_size, max_retry_attempts, retry_delay_ms, blacklisted_domains, blocked_placeholder_scale,
                            sequential_load, sequential_load_delay_ms, concurrent_active_loads, host_rewrites, auto_refresh_failed_after_ms, stall_timeout_ms,
                            blob_fetch_hosts, blob_fetch_on_error, blob_fetch_on_stall, enable_image_caching, max_cached_images) {
        var self = this;
        // --- Helper: schedule a single timer for retry or stall per image ---
        const scheduleImageTimer = ($img, ms, cb) => {
            const prev = $img.data('imgTimerId');
            if (prev) { clearTimeout(prev); $img.removeData('imgTimerId'); }
            if (ms > 0 && typeof cb === 'function') {
                $img.data('imgTimerId', setTimeout(cb, ms));
            }
        };

        this.image_size = (typeof image_size === 'string') ? image_size : 'Thumbnail';
        this.preserve_animated_images = !!preserve_animated_images;

        this.$torrent_table = null;
        this.images = [];
        this._seqTimerId = null;
        this.attach_image = backend.attach_image;
        this.get_image_src = backend.get_image_src;
        this.image_index = 0;
        this.preload_ratio = 0.6;
        this.max_retry_attempts = Number.isFinite(max_retry_attempts) ? max_retry_attempts : 0;
        this.retry_delay_ms = Number.isFinite(retry_delay_ms) ? retry_delay_ms : 0;
        this.blacklisted_domains = blacklisted_domains || [];
        this.host_rewrites = host_rewrites || [];

        // Initialize image cache manager
        this.cache = new ImageCacheManager(enable_image_caching, max_cached_images);
        this.friendly_hosts = [
            {
                pattern: /https?:\/\/(jerking|fapping|cache)\.empornium\.(ph|sx).*/,
                replace_to_small: [/(?:\.(?:th|md))?\.([^.]+)$/, '.th.$1'],
                replace_to_full: [/(?:\.(?:th|md))?\.([^.]+)$/, '.$1']
            },
            {
                pattern: /https?:\/\/hamsterimg\.net.*/,
                replace_to_small: [/(?:\.(?:th|md))?\.([^.]+)$/, '.th.$1'],
                replace_to_full: [/(?:\.(?:th|md))?\.([^.]+)$/, '.$1']
            }
        ];



        this.to_original_url = function (src) {
            if (!src) return src;
            const rule = self.friendly_hosts.find(h => h.pattern.test(src));
            return rule ? String.prototype.replace.apply(src, rule.replace_to_full) : src;
        };

        this._isAnimatedExt = (url) => url && /\.(gif|webp)(?:$|[?#])/i.test(url);



        // Helper: safely apply replace pattern to URL pathname only
        const applyReplaceToPath = (urlStr, replacePattern) => {
            try {
                const u = new URL(urlStr, window.location.href);
                const origPath = u.pathname || '/';
                const newPath = String.prototype.replace.apply(origPath, replacePattern);
                if (newPath !== origPath) { u.pathname = newPath; return u.toString(); }
                return urlStr;
            } catch (e) {
                return String.prototype.replace.apply(urlStr, replacePattern);
            }
        };

        this.rewrite_by_image_size = function (src, imageSize) {
            if (!src) return src;
            if (self.preserve_animated_images && self._isAnimatedExt(src)) return src;
            const rule = self.friendly_hosts.find(h => h.pattern.test(src));
            if (!rule) return src;
            const size = String(imageSize || '').toLowerCase();
            if (size === 'thumbnail') return applyReplaceToPath(src, rule.replace_to_small);
            if (size === 'medium') {
                rule.replace_to_medium = rule.replace_to_medium || [/(?:\.(?:th|md))?\.([^.]+)$/, '.md.$1'];
                return applyReplaceToPath(src, rule.replace_to_medium);
            }
            if (size === 'full') return applyReplaceToPath(src, rule.replace_to_full);
            return src;
        };



        this.sequential_load = !!sequential_load;
        this.sequential_load_delay_ms = Number.isFinite(sequential_load_delay_ms) ? sequential_load_delay_ms : 0;
        this.concurrent_limit = Math.max(1, Math.floor(concurrent_active_loads) || 1);
        this.auto_refresh_failed_after_ms = (auto_refresh_failed_after_ms >= 0) ? auto_refresh_failed_after_ms : 0;
        this.stall_timeout_ms = (stall_timeout_ms > 0) ? stall_timeout_ms : 6000;
        this.blob_fetch_hosts = blob_fetch_hosts || [];
        this.blob_fetch_on_error = !!blob_fetch_on_error;
        this.blob_fetch_on_stall = !!blob_fetch_on_stall;


        this._parseURLHost = (url) => {
            if (!url) return null;
            try {
                const u = new URL(url, window.location.href);
                return { url: u, host: (u.hostname || '').toLowerCase() };
            } catch (e) { return null; }
        };

        this._hostMatches = (host, domainList) => {
            if (!host || !domainList) return false;
            return domainList.some(d => {
                const dom = (d || '').toLowerCase().trim();
                return dom && (host === dom || host.endsWith('.' + dom));
            });
        };

        this.rewrite_host = function (url) {
            const parsed = self._parseURLHost(url);
            if (!parsed || !self.host_rewrites.length) return url;
            const { url: u, host } = parsed;
            for (const rule of self.host_rewrites) {
                const from = (rule.from || '').toLowerCase().trim();
                const to = (rule.to || '').trim();
                if (!from || !to) continue;
                const matches = rule.subdomains ? (host === from || host.endsWith('.' + from)) : (host === from);
                if (matches) {
                    u.hostname = to;
                    if (rule.force_https) u.protocol = 'https:';
                    return u.toString();
                }
            }
            return url;
        };


        this._isBlobFetchHost = (url) => {
            const parsed = self._parseURLHost(url);
            return parsed ? self._hostMatches(parsed.host, self.blob_fetch_hosts) : false;
        };

        // Fetch the image as a Blob via Tampermonkey, set it on <img> as a blob: URL



        this._fetchImageAsBlob = function (url, $img) {
            if (!url || !$img || !$img[0] || $img.data('blobFetchInFlight')) return;
            $img.data('blobFetchInFlight', true);

            const markFailed = () => {
                $img.addClass('tn-failed').data('isLoading', false).removeData('blobFetchInFlight').trigger('tnDone');
            };

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                timeout: 15000,
                onload: function (resp) {
                    if (resp.status >= 200 && resp.status < 300 && resp.response) {
                        try {
                            const reader = new FileReader();
                            reader.onloadend = function () {
                                self.clearImageState($img);
                                $img.data('isLoading', true).prop('src', reader.result).removeData('blobFetchInFlight');
                            };
                            reader.readAsDataURL(resp.response);
                        } catch (e) { markFailed(); }
                    } else { markFailed(); }
                },
                onerror: markFailed,
                ontimeout: markFailed
            });
        };



        this.isBlacklisted = (url) => {
            const parsed = self._parseURLHost(url);
            return parsed ? self._hostMatches(parsed.host, self.blacklisted_domains) : false;
        };

        this.block_placeholder_data_uri = (size) => {
            const h = Math.max(1, Math.round((size || max_image_size) * blocked_placeholder_scale));
            return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${h}' height='${h}' viewBox='0 0 32 32'><rect fill='#eee' width='32' height='32'/><circle cx='16' cy='16' r='11' fill='#e33'/><path d='M10 10L22 22M22 10L10 22' stroke='#fff' stroke-width='4' stroke-linecap='round'/></svg>`)}`;
        };



        this.create_img = function (src, small) {
            var $wrap = jQuery('<span class="tn-img-wrap"></span>');
            var $img = jQuery('<img>');
            var min_size = small ? '50px' : max_image_size + 'px';
            $img.data('src', src);
            $img.data('retryCount', 0);
            $img.css({
                'max-width': max_image_size + 'px',
                'max-height': max_image_size + 'px',
            });
            // Set wrapper size explicitly so spinner is properly sized before image loads
            $wrap.css({
                'min-width': min_size,
                'min-height': min_size
            });
            $wrap.append($img);
            // Store reference to wrapper on the image
            $img.data('$wrap', $wrap);
            return $img;
        };


        // Centralized function to completely reset image visual state
        this.clearImageState = function($img) {
            const imgEl = $img[0];
            
            // Cancel ALL pending timers for this image
            const timers = ['imgTimerId', 'retryTimeoutId', 'attemptTimerId'];
            timers.forEach(timerKey => {
                const tid = $img.data(timerKey);
                if (tid) {
                    clearTimeout(tid);
                    $img.removeData(timerKey);
                }
            });
            
            // Remove spinner and loading class from wrapper
            const $wrap = $img.data('$wrap');
            if ($wrap) {
                $wrap.removeClass('tn-loading');
                $wrap.find('.tn-spinner').remove();
                $wrap.css({ 'min-width': '', 'min-height': '' });
            }
            
            // Force remove classes using DOM directly
            if (imgEl) {
                imgEl.classList.remove('tn-failed', 'tn-stalled', 'tn-blocked');
                imgEl.style.opacity = '';
                imgEl.style.minWidth = '';
                imgEl.style.minHeight = '';
            }
            
            // Clear loading flags
            $img.data('isLoading', false);
        };

        this.show_img = function ($img) {
            const originalSrc = $img.data('src');
            const $row = $img.data('row');
            const imgEl = $img[0];

            // Skip hidden torrent rows
            const rowEl = $row && $row[0];
            if (rowEl && (rowEl.offsetParent === null || (rowEl.offsetWidth === 0 && rowEl.offsetHeight === 0))) {
                $img.off('error.lazyRetry load.lazyRetry').data('loaded', false);
                self.clearImageState($img);
                window.logSkip('Torrent Row Hidden - Skipping Image');
                $img.trigger('tnDone');
                return;
            }

            // Short-circuit for blacklisted hosts
            if (self.isBlacklisted(originalSrc)) {
                $img.prop('src', self.block_placeholder_data_uri(max_image_size))
                    .data('blocked', true).addClass('tn-blocked')
                    .css({ 'min-width': '', 'min-height': '' })
                    .off('error.lazyRetry load.lazyRetry');
                return;
            }

            // Already good or in-flight? don't touch.
            if ($img.data('loaded') || $img.data('isLoading')) return;

            // Start clean visual surface
            if (imgEl) {
                imgEl.style.minWidth = '';
                imgEl.style.minHeight = '';
            }
            $img.off('error.lazyRetry load.lazyRetry');

            // Optional decode guard (no-op for errors; success path just marks loaded)
            if (imgEl && typeof imgEl.decode === 'function') {
                imgEl.decode().then(() => {
                    const tid = $img.data('retryTimeoutId');
                    if (tid) { clearTimeout(tid); $img.removeData('retryTimeoutId'); }
                    $img.data('loaded', true);
                    $img.off('error.lazyRetry');
                }).catch(() => { /* handled by error.retry logic */ });
            }

            // --- Helper: start/cancel a per-attempt stall timer ---
            function startStallTimer($img, onStall) {
                const defaultStallHandler = () => {
                    if ($img.data('loaded') || !$img.data('isLoading')) return;
                    const el = $img[0];
                    if (el && el.complete && el.naturalWidth > 0) return;
                    $img.addClass('tn-stalled');
                    window.logTimeout($img.data('src'));
                    if (self.blob_fetch_on_stall && self._isBlobFetchHost($img.data('src'))) {
                        self._fetchImageAsBlob($img.data('src'), $img);
                        return;
                    }
                    $img.trigger('tnDone');
                };
                scheduleImageTimer($img, self.stall_timeout_ms, onStall || defaultStallHandler);
            }

            // --- Attach handlers ---
            window.logBegin(originalSrc);
            $img.data('isLoading', true);
            // Add spinner overlay to wrapper when loading starts
            var $wrap = $img.data('$wrap');
            if ($wrap && !$wrap.find('.tn-spinner').length) {
                $wrap.addClass('tn-loading');
                $wrap.append('<div class="tn-spinner"></div>');
            }

            // Remove any old handlers to ensure clean state
            $img.off('load.lazyRetry error.lazyRetry');

            $img.one('load.lazyRetry', function () {
                self.clearImageState($img);
                $img.data('retryCount', 0).data('loaded', true);
                window.logFinish($img.data('src'));
                // Cache if enabled and not already a data URL
                if (self.cache && self.cache.enabled && imgEl.complete && imgEl.naturalWidth > 0 && imgEl.src && !imgEl.src.startsWith('data:')) {
                    try { self.cache.setImage(originalSrc, imgEl.src); } catch (e) {}
                }
                $img.trigger('tnDone');
            });



            // --- Helper: Schedule a retry with optional delay ---
            function scheduleRetry(count, delaySrc, delayMs) {
                if (count >= self.max_retry_attempts) {
                    $img.removeClass('tn-stalled').addClass('tn-failed').off('error.lazyRetry').data('isLoading', false);
                    self.clearImageState($img);
                    $img.trigger('tnDone');
                    return;
                }
                const nextCount = count + 1;
                $img.data('retryCount', nextCount);
                const doRetry = () => {
                    const el = $img[0];
                    if ((el && el.complete && el.naturalWidth > 0) || $img.data('loaded')) return;
                    window.logRetry(nextCount, delaySrc);
                    $img.data('isLoading', true).prop('src', delaySrc);
                    startStallTimer($img);
                };
                if (delayMs > 0) {
                    window.logWait(delayMs);
                    $img.data('isLoading', true).data('retryTimeoutId', setTimeout(doRetry, delayMs));
                } else {
                    doRetry();
                }
            }

            $img.one('error.lazyRetry', function () {
                if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
                    self.clearImageState($img);
                    $img.data('retryCount', 0).data('loaded', true);
                    window.logFinish($img.data('src'));
                    $img.trigger('tnDone');
                    return;
                }
                const currentCount = $img.data('retryCount') || 0;
                const retryDelay = self.retry_delay_ms > 0 ? self.retry_delay_ms : 0;

                // Probe the failing URL to detect 404 or non-image content
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: originalSrc,
                    timeout: 6000,
                    onload: function (resp) {
                        // Detect non-image responses (HTML pages) and handle them specially.
                        try {
                            const status = resp && resp.status;
                            const headers = (resp && resp.responseHeaders) ? resp.responseHeaders.toString().toLowerCase() : '';
                            let contentType = '';
                            const ctMatch = headers.match(/content-type:\s*([^\r\n;]+)/i);
                            if (ctMatch) contentType = (ctMatch[1] || '').trim();

                            const bodyText = (typeof resp.responseText === 'string') ? resp.responseText : '';
                            const looksLikeHtml = /<\s*html/i.test(bodyText);

                            // Helper to perform the normal bounded retry behavior
                            const scheduleNormalRetry = () => scheduleRetry(currentCount, originalSrc, retryDelay);

                            // If probe returns a HTTP 404, prefer the original/full URL first.
                            const is404 = (status === 404);

                            if (is404) {
                                if (!$img.data('first404Done')) {
                                    $img.data('first404Done', true);
                                    window.logRetry(currentCount + 1, originalSrc);
                                    window.logBegin(originalSrc);
                                    const originalFull = self.to_original_url(originalSrc);
                                    $img.data('isLoading', true).data('retryCount', currentCount + 1).prop('src', originalFull);
                                    startStallTimer($img);
                                    return;
                                }
                                scheduleNormalRetry();
                                return;
                            }

                            // If the probe returns a non-image content-type or HTML body, try to extract an in-page <img>
                            if ((contentType && !contentType.startsWith('image/')) || looksLikeHtml) {
                                // Derive a short token from the original URL's last path segment (strip extension)
                                let token = '';
                                try {
                                    const u = new URL(originalSrc, window.location.href);
                                    const segs = (u.pathname || '').split('/').filter(Boolean);
                                    token = segs.length ? segs[segs.length - 1] : '';
                                    token = token.replace(/\.[^/.?#]+$/, '');
                                } catch (e) {
                                    token = (originalSrc || '').split('/').pop() || '';
                                    token = token.replace(/\.[^/.?#]+$/, '');
                                }

                                // Collect <img src> candidates from the returned HTML
                                let foundImg = null;
                                if (bodyText) {
                                    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
                                    let m; const candidates = [];
                                    while ((m = imgRegex.exec(bodyText)) !== null) {
                                        let srcVal = m[1];
                                        try { srcVal = new URL(srcVal, originalSrc).toString(); } catch (e) { /* keep raw */ }
                                        candidates.push(srcVal);
                                    }

                                    // Prefer a candidate that contains the token anywhere in the URL
                                    if (token) {
                                        for (const c of candidates) {
                                            if (c.indexOf(token) !== -1) { foundImg = c; break; }
                                        }
                                    }
                                    // Fallback to first image found
                                    if (!foundImg && candidates.length) foundImg = candidates[0];
                                }

                                if (foundImg) {
                                    // Retry once with the discovered image URL
                                    window.logRetry(currentCount + 1, foundImg);
                                    window.logBegin(foundImg);
                                    console.log('----- Probe returned HTML; retrying with discovered image: ' + foundImg);

                                    $img.data('isLoading', true);
                                    $img.data('retryCount', currentCount + 1);
                                    $img.prop('src', foundImg);
                                    startStallTimer($img);
                                    return;
                                }

                                // No usable image discovered — DO NOT give up immediately.
                                // Treat this case like a non-404 transient error and schedule a normal retry so we honor max_retry_attempts.
                                console.log('----- Probe returned non-image content for URL. Scheduling retry: ' + originalSrc);
                                scheduleNormalRetry();
                                return;
                            }
                        } catch (e) {
                            // If probe processing fails, fall through to the existing logic below
                            console.error('LDT probe parse error', e);
                        }

                        // --- Not a 404 and not non-image/HTML: normal retry ---
                        scheduleRetry(currentCount, originalSrc, retryDelay);
                    },
                    onerror: () => scheduleRetry(currentCount, originalSrc, retryDelay),
                    ontimeout: () => scheduleRetry(currentCount, originalSrc, retryDelay)
                });
            });

            // --- First request after handlers are attached ---
            // Check cache first before downloading
            if (self.cache && self.cache.enabled) {
                self.cache.getImage(originalSrc).then(cachedEntry => {
                    if (cachedEntry && cachedEntry.dataUrl) {
                        if (window.debug_logging) console.log('LDT: Loading from cache - ' + originalSrc);
                        $img.prop('src', cachedEntry.dataUrl);
                    } else {
                        $img.prop('src', originalSrc);
                    }
                }).catch(() => {
                    // On cache error, just load normally
                    $img.prop('src', originalSrc);
                });
            } else {
                $img.prop('src', originalSrc);
            }

            // Arm per-attempt stall timer for the first attempt
            startStallTimer($img);
        };











        this.fix_title = function ($row) {
            var $title = get_$title($row);
            $title.css({
                'vertical-align': 'top'
            });
        };

        this.thumbnalize = function (src, to_full) {
            for (var i = 0; i < self.friendly_hosts.length; i++) {
                var item = self.friendly_hosts[i];
                if (item.pattern.test(src)) {
                    var replace_pattern = to_full ? item.replace_to_full : item.replace_to_small;
                    return String.prototype.replace.apply(src, replace_pattern);
                }
            }
        }


        this.attach_thumbnails = function () {
            self.$torrent_table.find('tr.torrent, tr.rowb, tr.rowa').each(function () {
                var $row = jQuery(this);

                var src = self.get_image_src($row);
                if (src === undefined) {
                    src = ''; // '/static/common/noartwork/noimage.png';
                }

                // Apply host rewrites first so subsequent logic uses the new host
                src = self.rewrite_host(src);

                // Use the instance's image size selector
                var new_src = self.rewrite_by_image_size(src, self.image_size);
                if (new_src) {
                    src = new_src;
                }

                // NEW: decide placeholder sizing (Thumbnail => small=true; Medium/Full => small=false)
                var small = String(self.image_size).toLowerCase() === 'thumbnail';

                var $img = self.create_img(src, small);
                $img.data('row', $row);
                self.images.push($img);
                self.attach_image($row, $img);
                self.fix_title($row);
            });
        };


        this.visible_area = function () {
            if (!self._$window) self._$window = jQuery(window);
            var $window = self._$window;
            var y = $window.scrollTop();
            var height = $window.height();
            return [y, height];
        };

        this.on_scroll_event = function () {
            self.load_next_image();
        };





    this.load_next_image = function (force_check) {
        if (self.sequential_load) {
            self._activeLoads = self._activeLoads || 0;
            const concurrent = self.concurrent_limit || 1;

            if (concurrent > 1) {
                while (self.image_index < self.images.length && self._activeLoads < concurrent) {
                    const $img = self.images[self.image_index++];
                    self._activeLoads++;
                    const onDone = function () {
                        self._activeLoads = Math.max(0, self._activeLoads - 1);
                        $img.off('tnDone', onDone);
                        self.progress_set_value(self.image_index / self.images.length);
                        self.load_next_image(true);
                    };
                    $img.one('tnDone', onDone);
                    self.show_img($img);
                }
                if (self.image_index >= self.images.length && !self._activeLoads) self.detach_scroll_event();
                return;
            }

            // Single-worker sequential
            if (self._seqTimerId !== null) return;
            if (self.image_index < self.images.length) {
                const $currentImg = self.images[self.image_index];
                let tnDoneCalled = false;
                const onDone = function () {
                    tnDoneCalled = true;
                    const gap = self.sequential_load_delay_ms || 0;
                    self._seqTimerId = setTimeout(() => {
                        self._seqTimerId = null;
                        $currentImg.off('tnDone', onDone);
                        self.load_next_image(true);
                    }, gap);
                };
                $currentImg.one('tnDone', onDone);
                self.show_img($currentImg);
                self.image_index++;
                self.progress_set_value(self.image_index / self.images.length);
                if (tnDoneCalled && self._seqTimerId !== null) {
                    clearTimeout(self._seqTimerId);
                    self._seqTimerId = null;
                    $currentImg.off('tnDone', onDone);
                    self.load_next_image(true);
                }
            } else {
                self.detach_scroll_event();
            }
            return;
        }

        // LAZY-IN-VIEWPORT MODE
        if (self.image_index < self.images.length) {
            const nextImg = self.images[self.image_index];
            const [y, height] = self.visible_area();
            const bottomLimit = y + height * (1 + self.preload_ratio);
            const imgEl = nextImg[0];
            const imgTop = imgEl ? imgEl.getBoundingClientRect().top + window.scrollY : 0;
            if (bottomLimit >= imgTop) {
                self.show_img(nextImg);
                self.image_index++;
                self.progress_set_value(self.image_index / self.images.length);
                self.load_next_image(true);
        } else if (force_check) {
            setTimeout(self.load_next_image, 0);
        }
    } else {
        self.detach_scroll_event();
    }
    };




        this.progress_set_value = function (value) {
            progress && progress.set_value(value);
        };

        this.progress_hide = function () {
            progress && progress.hide();
        };

        this.attach_scroll_event = function () {
            jQuery(document).on('scroll resize', self.on_scroll_event);
        };

        this.detach_scroll_event = function () {
            jQuery(document).off('scroll resize', self.on_scroll_event);
            self.progress_hide();
            const delay = self.auto_refresh_failed_after_ms || 0;
            if (self.image_index < self.images.length) return;
            if (window.debug_logging) {
                console.log('================================================');
                console.log('⏹️ - LDT - Finished Image Processing (Initial Pass)');
                console.log('================================================');
            }
            setTimeout(() => {
                if (window.debug_logging) console.log('LDT: Auto-refresh triggered');
                try { self.refreshFailedThumbnails(); } catch (e) {}
            }, delay);
        };


        // Refresh only failed or stalled thumbnails
        this.refreshFailedThumbnails = function () {
            const queue = [];
            self.images.forEach($img => {
                const tid = $img.data('retryTimeoutId');
                if (tid) { clearTimeout(tid); $img.removeData('retryTimeoutId'); }
                const src = $img.data('src');
                const el = $img[0];
                const isGood = (el && el.complete && el.naturalWidth > 0) || $img.data('loaded');
                if (isGood) {
                    $img.off('error.lazyRetry load.lazyRetry').data('isLoading', false);
                    return;
                }
                if (self.isBlacklisted(src)) {
                    $img.prop('src', self.block_placeholder_data_uri(max_image_size)).addClass('tn-blocked');
                    return;
                }
                if ($img.hasClass('tn-failed') || $img.hasClass('tn-stalled') || $img.data('retryCount') >= self.max_retry_attempts) {
                    $img.data('retryCount', $img.data('retryCount') || 0)
                        .removeClass('tn-failed tn-stalled tn-blocked')
                        .off('error.lazyRetry load.lazyRetry')
                        .data('isLoading', false)
                        .removeData('loaded retryTimeoutId');
                    queue.push($img);
                }
            });
            (function processNext(i) {
                if (i >= queue.length) return;
                const $img = queue[i];
                const src = $img.data('src');
                window.logBegin(src);
                self._isBlobFetchHost(src) ? self._fetchImageAsBlob(src, $img) : self.show_img($img);
                const gap = self.sequential_load_delay_ms || 0;
                setTimeout(() => processNext(i + 1), gap);
            })(0);
        };


        this.replace_categories = function () {
            if (window.location.hostname.indexOf('empornium.') !== -1 ||
                window.location.hostname.indexOf('cheggit.') !== -1)
                self.$torrent_table.addClass('overlay-category-small');
            self.$torrent_table.addClass('overlay-category');
        };

        this.remove_categories = function () {
            self.$torrent_table.addClass('remove-category');
        };


        this.init = function () {
            self.$torrent_table = jQuery('.torrent_table, #torrent_table, .request_table, #request_table');
            if (window.debug_logging) {
                const mode = self.sequential_load ? (self.concurrent_limit > 1 ? `Sequential+ (workers=${self.concurrent_limit})` : 'Sequential') : 'Lazy';
                console.log('================================================');
                console.log(`▶️ - LDT - Starting Image Processing (${mode})`);
                console.log('================================================');
            }
            if (replace_categories) self.replace_categories();
            if (remove_categories) self.remove_categories();
            self.attach_thumbnails();
            self.load_next_image();
            self.sequential_load ? self.detach_scroll_event() : self.attach_scroll_event();

            // Observe for unhide events on rows
            if (self.$torrent_table && self.$torrent_table.length) {
                new MutationObserver(mutations => {
                    for (const m of mutations) {
                        if (m.type !== 'attributes') continue;
                        const row = m.target;
                        if (!row.matches || !row.matches('tr.torrent')) continue;
                        if (row.offsetParent !== null && row.offsetWidth > 0 && row.offsetHeight > 0) {
                            const $img = self.images.find($i => $i.data('row') && $i.data('row')[0] === row);
                            if ($img && !$img.data('loaded') && !$img.data('isLoading')) self.show_img($img);
                        }
                    }
                }).observe(self.$torrent_table[0], { subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
            }
        };


        this.init();
    }

    function create_backend(replace_categories) {
        return new ImagesFromHover(replace_categories);
    }

    // Insert full-feature LDT settings UI (expanded controls + persistence)
    (function addLDTConfigUI() {
        try {
            const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';

            // Defaults mirror the script's top-level defaults
            const DEFAULTS = {
                max_thumb: 250,
                image_size: 'Medium',
                replace_categories: true,
                remove_categories: false,
                preserve_animated_images: true,
                disable_site_hover_images: true,
                max_retry_attempts: 10,
                retry_delay_ms: 1000,
                // Sequential mode can be 'off' (lazy), 'sequential' (single-worker), or 'sequential_plus' (concurrent workers)
                sequential_mode: 'sequential',
                sequential_load_delay_ms: 300,
                auto_refresh_failed_after_ms: 2500,
                stall_timeout_ms: 4000,
                debug_logging: true,
                enable_image_caching: true,
                max_cached_images: 100
            };

            // Unified persistence layer (handles both GM and localStorage)
            const persistence = {
                get: (key, def) => hasGM ? GM_getValue(key, def) : (localStorage.getItem(key) ?? def),
                set: (key, val) => { if (hasGM) GM_setValue(key, val); else localStorage.setItem(key, String(val)); },
                readBool: (key, def) => { const v = persistence.get(key, def); return v === true || v === 'true' || v === 1 || v === '1'; },
                readNum: (key, def) => { const v = persistence.get(key, def); return v === null || v === undefined ? Number(def) : Number(v); },
                readStr: (key, def) => { const v = persistence.get(key, def); return v || def; },
                // Batch save for all keys
                saveAll: (obj) => { for (const [k, v] of Object.entries(obj)) persistence.set(k, v); }
            };

            // Load persisted values
            let ldt_max_thumb = persistence.readNum('ldt_max_thumb', DEFAULTS.max_thumb);
            if (!Number.isFinite(ldt_max_thumb) || ldt_max_thumb <= 0) ldt_max_thumb = DEFAULTS.max_thumb;
            let ldt_image_size = persistence.readStr('ldt_image_size', DEFAULTS.image_size);
            let ldt_replace_categories = persistence.readBool('ldt_replace_categories', DEFAULTS.replace_categories);
            let ldt_remove_categories = persistence.readBool('ldt_remove_categories', DEFAULTS.remove_categories);
            let ldt_preserve_animated = persistence.readBool('ldt_preserve_animated', DEFAULTS.preserve_animated_images);
            let ldt_disable_site_hover = persistence.readBool('ldt_disable_site_hover', DEFAULTS.disable_site_hover_images);
            let ldt_max_retries = persistence.readNum('ldt_max_retry_attempts', DEFAULTS.max_retry_attempts);
            let ldt_retry_delay = persistence.readNum('ldt_retry_delay_ms', DEFAULTS.retry_delay_ms);
            // NEW: use a string mode for sequential behavior
            let ldt_sequential_mode = persistence.readStr('ldt_sequential_mode', DEFAULTS.sequential_mode);
            let ldt_sequential_delay = persistence.readNum('ldt_sequential_load_delay_ms', DEFAULTS.sequential_load_delay_ms);
            let ldt_auto_refresh_failed = persistence.readNum('ldt_auto_refresh_failed_after_ms', DEFAULTS.auto_refresh_failed_after_ms);
            let ldt_stall_timeout = persistence.readNum('ldt_stall_timeout_ms', DEFAULTS.stall_timeout_ms);
            let ldt_debug = persistence.readBool('ldt_debug_logging', DEFAULTS.debug_logging);
            let ldt_enable_image_caching = persistence.readBool('ldt_enable_image_caching', DEFAULTS.enable_image_caching);
            let ldt_max_cached_images = persistence.readNum('ldt_max_cached_images', DEFAULTS.max_cached_images);

            // Determine where to place the link: reuse existing menu/list so it inherits styling
            function addSettingsLink() {
                const candidates = [document.querySelector('#major_stats'), document.querySelector('#header'), document.querySelector('body > header'), document.querySelector('.page_nav'), document.querySelector('.nav'), document.querySelector('#navigation'), document.body].filter(Boolean);
                const container = candidates[0] || document.body;
                const profileLI = container.querySelector('a[href*="user.php"]')?.closest('li');
                const targetUL = profileLI?.parentElement?.tagName === 'UL' ? profileLI.parentElement : container.querySelector('ul');

                const li = document.createElement('li'); li.className = 'brackets ldt-config-li';
                const a = document.createElement('a'); a.href = '#'; a.className = 'ldt-config-link'; a.textContent = '⛭ LDT'; a.title = 'Luminance Direct Thumbnails - Settings';
                a.style.padding = '0 6px';
                a.addEventListener('click', (ev) => { ev.preventDefault(); openConfigModal(); });
                li.appendChild(a);

                if (targetUL && profileLI) targetUL.insertBefore(li, profileLI);
                else if (targetUL) targetUL.insertBefore(li, targetUL.firstChild);
            }
            addSettingsLink();

            // Build modal (hidden initially)

    const modalBg = document.createElement('div');
    modalBg.id = 's-conf-background-ldt';
    modalBg.style.display = 'none';

modalBg.innerHTML = `
<div id="s-conf-wrapper-ldt">
    <h1>Luminance Direct Thumbnails+ Settings</h1>

    <div class="ldt-section">
        <h2>Image Display Options</h2>
        <div class="ldt-grid">
            <div class="ldt-row"><label title="Maximum height and width for thumbnails (px)"><span class="ldt-label-text">Image Size (Max)</span> <input id="ldt-size-input" class="ldt-number" type="number" min="1" value="${ldt_max_thumb}"></label></div>
            <div class="ldt-row"><label title="Download smaller image sizes. Experimental - may reduce performance"><span class="ldt-label-text">Image Quality</span> <select id="ldt-image-size-select" class="ldt-select"><option value="Thumbnail">Thumbnail</option><option value="Medium">Medium</option><option value="Full">Full</option></select></label></div>
            <div class="ldt-row"><label title="Keep animated images full size to preserve animation"><input id="ldt-preserve-animated" type="checkbox"> Preserve Animated (GIF/WebP)</label></div>
            <div class="ldt-row"><label title="Disable site hover images to reduce redundancy"><input id="ldt-disable-hover" type="checkbox"> Disable Site Hover</label></div>
            <div class="ldt-row"><label title="Place thumbnails inside the category column"><input id="ldt-replace-cats" type="checkbox"> Replace Categories</label></div>
            <div class="ldt-row"><label title="Hide category names entirely"><input id="ldt-remove-cats" type="checkbox"> Remove Categories</label></div>
        </div>
    </div>

    <div class="ldt-section">
        <h2>Retry / Timeout Options</h2>
        <div class="ldt-grid">
            <div class="ldt-row"><label title="Maximum number of retries for fetching images"><span class="ldt-label-text">Max Retry Attempts</span> <input id="ldt-max-retries" class="ldt-number" type="number" min="0" value="${ldt_max_retries}"></label></div>
            <div class="ldt-row"><label title="Delay between image load retries (milliseconds)"><span class="ldt-label-text">Retry Delay (ms)</span> <input id="ldt-retry-delay" class="ldt-number" type="number" min="0" value="${ldt_retry_delay}"></label></div>
            <div class="ldt-row"><label title="Off=lazy, Sequential=1 worker, Sequential+=concurrent"><span class="ldt-label-text">Loading Mode</span> <select id="ldt-sequential-mode" class="ldt-select"><option value="off">Off (Lazy)</option><option value="sequential">Sequential (1 worker)</option><option value="sequential_plus">Sequential+ (concurrent)</option></select></label></div>
            <div class="ldt-row"><label title="Delay between sequential image loads (milliseconds)"><span class="ldt-label-text">Sequential Delay (ms)</span> <input id="ldt-seq-delay" class="ldt-number" type="number" min="0" value="${ldt_sequential_delay}"></label></div>
            <div class="ldt-row"><label title="Auto-retry failed thumbnails after this delay"><span class="ldt-label-text">Auto-Refresh Failed (ms)</span> <input id="ldt-auto-refresh-failed" class="ldt-number" type="number" min="0" value="${ldt_auto_refresh_failed}"></label></div>
            <div class="ldt-row"><label title="Mark image stalled if not loaded by this time"><span class="ldt-label-text">Image Timeout (ms)</span> <input id="ldt-stall-timeout" class="ldt-number" type="number" min="0" value="${ldt_stall_timeout}"></label></div>
        </div>
    </div>

    <div class="ldt-section">
        <h2>Image Caching Options</h2>
        <div class="ldt-grid">
            <div class="ldt-row"><label title="Cache images in IndexedDB for faster reloads"><input id="ldt-enable-image-caching" type="checkbox"> Enable Image Caching</label></div>
            <div class="ldt-row"><label title="Maximum number of images to store in cache"><span class="ldt-label-text">Max Cached Images</span> <input id="ldt-max-cached-images" class="ldt-number" type="number" min="1" value="100"></label></div>
            <div class="ldt-row"><input id="ldt-clear-image-cache" type="button" value="Clear Image Cache"></div>
        </div>
    </div>

    <div class="ldt-section">
        <h2>Misc Options</h2>
        <div class="ldt-grid">
            <div class="ldt-row"><label title="Enable verbose logging in console (Ctrl+Shift+I)"><input id="ldt-debug-logging" type="checkbox"> Console Debug</label></div>
            <div class="ldt-row"><label>Reserved for future use</label></div>
        </div>
        <div class="ldt-note">
            💡 Tip: Use the 'Refresh TN' button to manually retry all thumbnails at any time.
        </div>
    </div>

    <div class="s-conf-buttons-ldt">
        <input id="s-conf-save-general-ldt" class="s-conf-save-ldt" type="button" value="Save Settings">
        <input id="s-conf-close-ldt" class="s-conf-close-ldt" type="button" value="Close">
    </div>
</div>
`;

    document.body.appendChild(modalBg);

    const openConfigModal   = () => modalBg.style.display = 'block';
    const closeConfigModal = () => modalBg.style.display = 'none';

    // Handle info icon tooltips using native title attributes
    // (no custom tooltip needed - browser handles title attribute tooltips natively)




            // cache controls
            const closeBtn = modalBg.querySelector('#s-conf-close-ldt');
            const saveBtn = modalBg.querySelector('#s-conf-save-general-ldt');
            const sizeInput = modalBg.querySelector('#ldt-size-input');
            const sizeSelect = modalBg.querySelector('#ldt-image-size-select');
            const preserveCheckbox = modalBg.querySelector('#ldt-preserve-animated');
            const disableHoverCheckbox = modalBg.querySelector('#ldt-disable-hover');
            const replaceCatsCheckbox = modalBg.querySelector('#ldt-replace-cats');
            const removeCatsCheckbox = modalBg.querySelector('#ldt-remove-cats');
            const maxRetriesInput = modalBg.querySelector('#ldt-max-retries');
            const retryDelayInput = modalBg.querySelector('#ldt-retry-delay');
            // NEW: select for mode
            const sequentialModeSelect = modalBg.querySelector('#ldt-sequential-mode');
            const seqDelayInput = modalBg.querySelector('#ldt-seq-delay');
            const autoRefreshInput = modalBg.querySelector('#ldt-auto-refresh-failed');
            const stallTimeoutInput = modalBg.querySelector('#ldt-stall-timeout');
            const debugCheckbox = modalBg.querySelector('#ldt-debug-logging');
            const enableImageCachingCheckbox = modalBg.querySelector('#ldt-enable-image-caching');
            const maxCachedImagesInput = modalBg.querySelector('#ldt-max-cached-images');
            const clearCacheBtn = modalBg.querySelector('#ldt-clear-image-cache');

            if (closeBtn) closeBtn.addEventListener('click', closeConfigModal);

            // initialize controls from persisted values
            if (sizeInput) sizeInput.value = ldt_max_thumb;
            if (sizeSelect) sizeSelect.value = ldt_image_size || DEFAULTS.image_size;
            if (preserveCheckbox) preserveCheckbox.checked = !!ldt_preserve_animated;
            if (disableHoverCheckbox) disableHoverCheckbox.checked = !!ldt_disable_site_hover;
            if (replaceCatsCheckbox) replaceCatsCheckbox.checked = !!ldt_replace_categories;
            if (removeCatsCheckbox) removeCatsCheckbox.checked = !!ldt_remove_categories;
            if (maxRetriesInput) maxRetriesInput.value = Number.isFinite(ldt_max_retries) ? ldt_max_retries : DEFAULTS.max_retry_attempts;
            if (retryDelayInput) retryDelayInput.value = Number.isFinite(ldt_retry_delay) ? ldt_retry_delay : DEFAULTS.retry_delay_ms;
            // initialize selected mode
            if (sequentialModeSelect) sequentialModeSelect.value = ldt_sequential_mode || DEFAULTS.sequential_mode;
            if (seqDelayInput) seqDelayInput.value = Number.isFinite(ldt_sequential_delay) ? ldt_sequential_delay : DEFAULTS.sequential_load_delay_ms;
            if (autoRefreshInput) autoRefreshInput.value = Number.isFinite(ldt_auto_refresh_failed) ? ldt_auto_refresh_failed : DEFAULTS.auto_refresh_failed_after_ms;
            if (stallTimeoutInput) stallTimeoutInput.value = Number.isFinite(ldt_stall_timeout) ? ldt_stall_timeout : DEFAULTS.stall_timeout_ms;
            if (debugCheckbox) debugCheckbox.checked = !!ldt_debug;
            if (enableImageCachingCheckbox) enableImageCachingCheckbox.checked = !!ldt_enable_image_caching;
            if (maxCachedImagesInput) maxCachedImagesInput.value = Number.isFinite(ldt_max_cached_images) ? ldt_max_cached_images : DEFAULTS.max_cached_images;

            if (saveBtn) saveBtn.addEventListener('click', () => {
                try {
                    // Read values from controls
                    const v_size = Number(sizeInput?.value) || DEFAULTS.max_thumb;
                    ldt_max_thumb = v_size > 0 ? Math.floor(v_size) : DEFAULTS.max_thumb;
                    ldt_image_size = sizeSelect ? (sizeSelect.value || DEFAULTS.image_size) : DEFAULTS.image_size;
                    ldt_preserve_animated = !!preserveCheckbox?.checked;
                    ldt_disable_site_hover = !!disableHoverCheckbox?.checked;
                    ldt_replace_categories = !!replaceCatsCheckbox?.checked;
                    ldt_remove_categories = !!removeCatsCheckbox?.checked;
                    ldt_max_retries = Number(maxRetriesInput?.value) || DEFAULTS.max_retry_attempts;
                    ldt_retry_delay = Number(retryDelayInput?.value) || DEFAULTS.retry_delay_ms;
                    // Read mode from select
                    ldt_sequential_mode = sequentialModeSelect ? (sequentialModeSelect.value || DEFAULTS.sequential_mode) : DEFAULTS.sequential_mode;
                    ldt_sequential_delay = Number(seqDelayInput?.value) || DEFAULTS.sequential_load_delay_ms;
                    ldt_auto_refresh_failed = Number(autoRefreshInput?.value) || DEFAULTS.auto_refresh_failed_after_ms;
                    ldt_stall_timeout = Number(stallTimeoutInput?.value) || DEFAULTS.stall_timeout_ms;
                    ldt_debug = !!debugCheckbox?.checked;
                    ldt_enable_image_caching = !!enableImageCachingCheckbox?.checked;
                    ldt_max_cached_images = Number(maxCachedImagesInput?.value) || DEFAULTS.max_cached_images;

                    // Persist all values at once using unified persistence layer
                    persistence.saveAll({
                        'ldt_max_thumb': ldt_max_thumb,
                        'ldt_image_size': ldt_image_size,
                        'ldt_preserve_animated': ldt_preserve_animated,
                        'ldt_disable_site_hover': ldt_disable_site_hover,
                        'ldt_replace_categories': ldt_replace_categories,
                        'ldt_remove_categories': ldt_remove_categories,
                        'ldt_max_retry_attempts': ldt_max_retries,
                        'ldt_retry_delay_ms': ldt_retry_delay,
                        'ldt_sequential_mode': ldt_sequential_mode,
                        'ldt_sequential_load_delay_ms': ldt_sequential_delay,
                        'ldt_auto_refresh_failed_after_ms': ldt_auto_refresh_failed,
                        'ldt_stall_timeout_ms': ldt_stall_timeout,
                        'ldt_debug_logging': ldt_debug,
                        'ldt_enable_image_caching': ldt_enable_image_caching,
                        'ldt_max_cached_images': ldt_max_cached_images
                    });

                    // Attempt to apply to running instance if available
                    try {
                        const inst = window.lazyThumbsInstance;
                        if (inst) {
                            inst.image_size = ldt_image_size;
                            // preserve animated flag (instance uses preserve_animated_images property)
                            inst.preserve_animated_images = ldt_preserve_animated;
                            inst.max_retry_attempts = ldt_max_retries;
                            inst.retry_delay_ms = ldt_retry_delay;
                            inst.sequential_load = ldt_sequential_mode !== 'off';
                            if (ldt_sequential_mode === 'sequential') inst.concurrent_limit = 1;
                            inst.sequential_load ? inst.detach_scroll_event() : inst.attach_scroll_event();
                            inst.sequential_load_delay_ms = ldt_sequential_delay;
                            inst.auto_refresh_failed_after_ms = ldt_auto_refresh_failed;
                            inst.stall_timeout_ms = ldt_stall_timeout;
                            // Update displayed image constraints
                            inst.images.forEach($img => $img.css({'max-width': ldt_max_thumb + 'px', 'max-height': ldt_max_thumb + 'px'}));
                            // Update table classes
                            if (inst.$torrent_table && inst.$torrent_table.length) {
                                inst.$torrent_table.toggleClass('overlay-category', ldt_replace_categories)
                                    .toggleClass('remove-category', ldt_remove_categories);
                                if (/empornium\.|cheggit\./.test(window.location.hostname)) {
                                    inst.$torrent_table.toggleClass('overlay-category-small', ldt_replace_categories);
                                }
                            }
                            window.debug_logging = ldt_debug;
                            if (!inst.sequential_load) inst.load_next_image(true);
                            else if (inst._seqTimerId) { clearTimeout(inst._seqTimerId); inst._seqTimerId = null; }
                        }
                    } catch (e) { /* non-fatal */ }

                    // Note: disabling site hover images requires reload to re-run the MutationObserver; we persist the choice
                } catch (e) {
                    console.error('LDT save failed', e);
                }

                closeConfigModal();
            });

            if (clearCacheBtn) clearCacheBtn.addEventListener('click', () => {
                if (confirm('Clear all cached images? This cannot be undone.')) {
                    try {
                        const dbReq = indexedDB.deleteDatabase('LDT_ImageCache');
                        dbReq.onsuccess = () => {
                            alert('Image cache cleared successfully.');
                            console.log('LDT: Image cache cleared.');
                        };
                        dbReq.onerror = () => {
                            alert('Error clearing cache.');
                            console.error('LDT: Error clearing cache', dbReq.error);
                        };
                    } catch (e) {
                        alert('Error clearing cache: ' + e.message);
                        console.error('LDT: Cache clear error', e);
                    }
                }
            });

        } catch (e) {
            console.error('LDT config UI insertion failed:', e);
        }
    })();