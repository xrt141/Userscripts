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



        var host_rewrites = [
            { from: 'domain1.is', to: 'domain2.net', subdomains: true, force_https: false },
            { from: 'hamster.is', to: 'hamsterimg.net', subdomains: true, force_https: false }
        ];

        // Load persisted settings (GM_getValue if available, else localStorage) and override defaults
        (function loadPersistedLDTSettings() {
            const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';

            // NEW: expose which persistence backend is active so we can tell if values are loaded from localStorage
            try {
                window.ldt_persistence_source = hasGM ? 'GM' : 'localStorage';
                // Always emit a console message for the persistence source here so it's visible
                // even if the debug flag hasn't been loaded/applied yet.
                try {
                    console.log('LDT: persistence source = ' + window.ldt_persistence_source);
                } catch (e) { /* ignore console failures in restricted envs */ }
            } catch (e) { /* non-fatal */ }

            function getRaw(key, def) {
                try {
                    if (hasGM) return GM_getValue(key, def);
                    const v = localStorage.getItem(key);
                    return v === null ? def : v;
                } catch (e) { return def; }
            }
            function boolVal(key, def) {
                const v = getRaw(key, def);
                return v === true || v === 'true' || v === 1 || v === '1';
            }
            try {
                // Numeric and string values (use existing defaults if parsing fails)
                var p_max_image_size = Number(getRaw('ldt_max_thumb', max_image_size)) || max_image_size;
                var p_image_size = String(getRaw('ldt_image_size', image_size)) || image_size;

                // Boolean flags
                var p_preserve_animated = boolVal('ldt_preserve_animated', preserve_animated_images);
                var p_disable_site_hover = boolVal('ldt_disable_site_hover', disable_site_hover_images);
                var p_replace_categories = boolVal('ldt_replace_categories', replace_categories);
                var p_remove_categories = boolVal('ldt_remove_categories', remove_categories);

                // Retry/timing
                var p_max_retry_attempts = Number(getRaw('ldt_max_retry_attempts', max_retry_attempts)) || max_retry_attempts;
                var p_retry_delay_ms = Number(getRaw('ldt_retry_delay_ms', retry_delay_ms)) || retry_delay_ms;

                // NEW: read sequential mode as a string if present, else fall back to legacy boolean
                var raw_seq_mode = getRaw('ldt_sequential_mode', null);
                var p_sequential_mode = null;
                if (raw_seq_mode !== null && raw_seq_mode !== undefined) {
                    try { p_sequential_mode = String(raw_seq_mode); } catch (e) { p_sequential_mode = null; }
                }
                if (!p_sequential_mode) {
                    // Legacy fallback: boolean key
                    p_sequential_mode = boolVal('ldt_sequential_load', sequential_load) ? 'sequential' : 'off';
                }

                // Optional concurrent setting for Sequential+ (fallback to existing global)
                var p_concurrent_active_loads = Number(getRaw('ldt_concurrent_active_loads', concurrent_active_loads));
                if (!Number.isFinite(p_concurrent_active_loads) || p_concurrent_active_loads < 1) p_concurrent_active_loads = concurrent_active_loads || 1;

                var p_sequential_load_delay_ms = Number(getRaw('ldt_sequential_load_delay_ms', sequential_load_delay_ms)) || sequential_load_delay_ms;
                var p_auto_refresh_failed_after_ms = Number(getRaw('ldt_auto_refresh_failed_after_ms', auto_refresh_failed_after_ms)) || auto_refresh_failed_after_ms;
                var p_stall_timeout_ms = Number(getRaw('ldt_stall_timeout_ms', stall_timeout_ms)) || stall_timeout_ms;
                var p_debug_logging = boolVal('ldt_debug_logging', debug_logging);

                // Apply overrides to the local defaults
                max_image_size = p_max_image_size;
                image_size = p_image_size;
                preserve_animated_images = !!p_preserve_animated;
                disable_site_hover_images = !!p_disable_site_hover;
                replace_categories = !!p_replace_categories;
                remove_categories = !!p_remove_categories;
                max_retry_attempts = p_max_retry_attempts;
                retry_delay_ms = p_retry_delay_ms;
                sequential_load_delay_ms = p_sequential_load_delay_ms;
                auto_refresh_failed_after_ms = p_auto_refresh_failed_after_ms;
                stall_timeout_ms = p_stall_timeout_ms;
                debug_logging = !!p_debug_logging;
                window.debug_logging = debug_logging;

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
                        console.groupEnd();
                    } catch (e) { /* ignore */ }
                }
            } catch (e) { /* ignore persistence read failures */ }
        })();



        // --- Hover Image Disabler---
        (function installHoverImageDisabler() {
            if (!disable_site_hover_images) return;

            // Heuristics: common containers sites use for hover tooltips/previews
            // Add or adjust selectors if needed for your site(s).
            const HOVER_SELECTORS = [
                '.tooltip', '.hover', '.preview', '.bubble', '.popup',
                '#tooltip', '[class*="hover"]', '[class*="tooltip"]', '[id*="tooltip"]'
            ];

            // Utility: does the node or its ancestors look like a hover container?
            function isHoverContainer(node) {
                if (!node || node.nodeType !== 1) return false;
                const el = /** @type {HTMLElement} */(node);
                // Quick checks: class/id matches or high z-index floating containers
                const selMatch = HOVER_SELECTORS.some(sel => el.matches(sel));
                if (selMatch) return true;

                // Walk up a few ancestors to catch nested structures
                let p = el;
                for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
                    if (!p) break;
                    if (HOVER_SELECTORS.some(sel => p.matches(sel))) return true;
                    const style = getComputedStyle(p);
                    // Typical hover box properties: absolute/fixed + high z-index
                    const posIsFloaty = style.position === 'absolute' || style.position === 'fixed';
                    const zHigh = parseInt(style.zIndex || '0', 10) >= 1000;
                    if (posIsFloaty && zHigh) return true;
                }
                return false;
            }

            // Strip <img src> → <img data-src> (prevents network load)
            function neutralizeImages(root) {
                const imgs = root.querySelectorAll('img[src]');
                imgs.forEach(img => {
                    // Skip images created/managed by your script (optional tag you can add)
                    if (img.classList.contains('tn-controlled')) return;

                    // Move src → data-src, then remove src
                    const url = img.getAttribute('src');
                    if (url) {
                        img.setAttribute('data-src', url);
                        img.removeAttribute('src');
                    }
                });
            }

            // Observe DOM for inserted hover containers and strip their <img src>
            const mo = new MutationObserver(mutations => {
                for (const m of mutations) {
                    // Handle directly added nodes
                    m.addedNodes.forEach(node => {
                        if (node.nodeType !== 1) return;
                        const el = /** @type {HTMLElement} */(node);

                        // Case 1: Node itself looks like hover container
                        if (isHoverContainer(el)) {
                            neutralizeImages(el);
                        }

                        // Case 2: Any descendants contain hover containers or images in them
                        // (Fast path: if subtree has images, check the closest hover parent)
                        const imgs = el.querySelectorAll('img[src]');
                        if (imgs.length) {
                            // If the subtree includes a hover box, neutralize all images inside it
                            let hasHover = false;
                            HOVER_SELECTORS.forEach(sel => {
                                if (!hasHover && el.querySelector(sel)) hasHover = true;
                            });
                            if (hasHover || isHoverContainer(el)) {
                                neutralizeImages(el);
                            }
                        }
                    });

                    // Also neutralize if class/id changes turn an existing node into hover
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
        function dbg(line) {
            if (!debug_logging) return;
            //console.log((line.startsWith('-') ? '' : '-----') + line);
            console.log(line);
        }
        function logBegin(url) {

            if (window.lazyThumbsInstance &&
                window.lazyThumbsInstance.sequential_load &&
                (typeof window.lazyThumbsInstance.concurrent_limit !== 'number' || window.lazyThumbsInstance.concurrent_limit <= 1)) {
                dbg('');
                dbg('==========================================');
            }
            dbg('--- Begin Loading image: ' + url);
        }
        function logFinish(url) {
            dbg('--- Finished loading image: ' + url);
            if (window.lazyThumbsInstance &&
                window.lazyThumbsInstance.sequential_load &&
                (typeof window.lazyThumbsInstance.concurrent_limit !== 'number' || window.lazyThumbsInstance.concurrent_limit <= 1)) {
                dbg('==========================================');
                dbg('');
            }
        }
        function logWait(ms) { dbg('----- Waiting ' + ms + 'ms'); }
        function logTimeout(url) { dbg('----- Timeout expired Image Stalled. ' + url); }
        function logRetry(n, url){ dbg('----- Retry #' + n + ' Image ' + url); }
        function logSkip(msg) { dbg('----- ' + msg); }



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
             false,
             replace_categories,
             remove_categories,
             max_image_size,
             max_retry_attempts,
             retry_delay_ms,
             blacklisted_domains,
             blocked_placeholder_scale,
             sequential_load,
             sequential_load_delay_ms,
+            concurrent_active_loads,
             host_rewrites,
             auto_refresh_failed_after_ms,
             stall_timeout_ms,
             blob_fetch_hosts,
             blob_fetch_on_error,
             blob_fetch_on_stall

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
        .tn-blocked { outline: 2px dashed #999; opacity: 0.9; }
        .tn-failed  { outline: 2px dashed #A33B39; opacity: 0.5; }
        .tn-stalled  { outline: 2px dashed #3954A3; opacity: 0.7; }

        /* Modal / Config UI styles */
        #s-conf-background-ldt { position:fixed; top:0; bottom:0; left:0; right:0; z-index:1000; background-color:rgba(50,50,50,0.6); }
        #s-conf-wrapper-ldt { background:#eee; color:#444; position:relative; width:80%; min-width:500px; max-width:900px; min-height:200px; overflow:hidden; margin:50px auto; font-size:14px; padding:10px 10px; border-radius:12px; box-shadow:0 0 20px rgba(0,0,0,0.6); max-height:90vh; overflow-y:auto; overflow-x:hidden; z-index:9999; }
        #s-conf-wrapper-ldt h2 { margin:8px 0 12px 0; background:none; text-align:left; color:#444; padding: 1px 1px 1px 10px; }
        .ldt-section { margin:5px 0 5px 0; padding:4px 6px; border-radius:6px; background:linear-gradient(180deg,#ffffff,#f2f4f6); border:1px solid rgba(0,0,0,0.04); }
        .ldt-section h2 { margin:6px 0 10px 0; font-size:14px; color:#333; }
        .ldt-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px 18px; align-items:start; }
        @media (max-width:780px) { .ldt-grid { grid-template-columns:1fr; } #s-conf-wrapper-ldt { min-width:320px; } }
        .ldt-row { display:flex; align-items:center; gap:8px;}
        .ldt-label { display:flex; align-items:center; gap:8px; width:100%; position:relative; }
        .ldt-label input[type='checkbox'] { margin:0 6px 0 0; transform:scale(1.05); }
        .ldt-label .ldt-control { flex:1; display:flex; justify-content:space-between; align-items:center; position:relative; }
        .ldt-tooltip { display:none; position:absolute; left:calc(100% + 8px); top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.85); color:#fff; padding:6px 8px; border-radius:4px; font-size:12px; white-space:nowrap; z-index:10001; }
        .ldt-label:hover .ldt-tooltip, .ldt-label:focus-within .ldt-tooltip, .ldt-control:hover .ldt-tooltip, .ldt-control:focus-within .ldt-tooltip { display:block; }
        input[type='number'].ldt-number { width:100px; padding:4px; border-radius:4px; border:1px solid #cfcfcf; }
        select.ldt-select { padding:5px 6px; border-radius:4px; border:1px solid #cfcfcf; }
        .s-conf-buttons-ldt { display:flex; justify-content:center; gap:12px; margin-top:12px; padding-top:8px; border-top:1px dashed rgba(0,0,0,0.06); }
        .s-conf-buttons-ldt input[type='button'] { padding:8px 12px; border-radius:6px; border:1px solid rgba(0,0,0,0.08); background:#fff; cursor:pointer; }
        .s-conf-buttons-ldt input[type='button']:hover { box-shadow:0 2px 6px rgba(0,0,0,0.08); }
        .ldt-note { color:#666; font-size:12px; margin-top:6px; }
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
            if (replace_categories) {
                var $category = get_$category($row);
                $category.append($img);
            }
            else {
                var $title = get_$title($row);
                $img.css({
                    'float': 'left',
                    'margin-right': '7px'
                });
                $title.prepend($img);
            }
        };
    }

    function LazyThumbnails(progress, backend, image_size, preserve_animated_images, full_thumbnails, replace_categories, remove_categories,
                            max_image_size, max_retry_attempts, retry_delay_ms, blacklisted_domains, blocked_placeholder_scale,
                            sequential_load, sequential_load_delay_ms, concurrent_active_loads, host_rewrites, auto_refresh_failed_after_ms, stall_timeout_ms,
                            blob_fetch_hosts, blob_fetch_on_error, blob_fetch_on_stall) {
        var self = this;
        // --- Helper: schedule a single timer for retry or stall per image ---
        function scheduleImageTimer($img, ms, cb) {
            const prev = $img.data('imgTimerId');
            if (prev) { clearTimeout(prev); $img.removeData('imgTimerId'); }
            if (typeof ms === 'number' && ms > 0 && typeof cb === 'function') {
                const tid = setTimeout(cb, ms);
                $img.data('imgTimerId', tid);
            }
        }

        this.image_size = (typeof image_size === 'string') ? image_size : "Thumbnail"
        // keep backwards-compatible behaviour: preserve_animated_images === true prevents rewrites for GIF/WebP
        this.preserve_animated_images = !!preserve_animated_images;

        this.$torrent_table = null;
        this.images = []
        this._seqTimerId = null; // guard for sequential mode
        this.attach_image = backend.attach_image;
        this.get_image_src = backend.get_image_src;
        this.image_index = 0;
        this.preload_ratio = 0.6;
        this.max_retry_attempts = Number.isFinite(max_retry_attempts) ? max_retry_attempts : 0;
        this.retry_delay_ms = Number.isFinite(retry_delay_ms) ? retry_delay_ms : 0;
        this.blacklisted_domains = Array.isArray(blacklisted_domains) ? blacklisted_domains : [];
        this.host_rewrites = Array.isArray(host_rewrites) ? host_rewrites : [];
        this.friendly_hosts = [
            {
                pattern: /https?:\/\/(jerking|fapping|cache)\.empornium\.(ph|sx).*/,
                replace_to_small: [/(?:\.(?:th|md))?\.([^.]+)$/, '.th.$1'],
                replace_to_full: [/(?:\.(?:th|md))?\.([^.]+)$/, '.$1']
            },
        ];


        this.friendly_hosts.push({
            pattern: /https?:\/\/hamsterimg\.net.*/,
            // small/thumbnail: ensure `.th.` right before the extension
            replace_to_small: [/(?:\.(?:th|md))?\.([^.]+)$/, '.th.$1'],
            // full: strip `.th`/`.md`
            replace_to_full:  [/(?:\.(?:th|md))?\.([^.]+)$/, '.$1']
        });



        // --- Helper: convert a rewritten (thumbnail/medium) URL back to "original/full" ---
        this.to_original_url = function (src) {
            if (!src || typeof src !== 'string') return src;
            var rule = null;
            for (var i = 0; i < self.friendly_hosts.length; i++) {
                if (self.friendly_hosts[i].pattern.test(src)) { rule = self.friendly_hosts[i]; break; }
            }
            if (!rule) return src;
            // Use the host's "full" replacement to strip ".th." / ".md."
            return String.prototype.replace.apply(src, rule.replace_to_full);
        };


        this._isAnimatedExt = function (url) {
            if (!url || typeof url !== 'string') return false;
            // Covers endings like .gif, .gif?x=y, .webp, .webp#...
            return /\.(gif|webp)(?:$|[?#])/i.test(url);
        };



        this.rewrite_by_image_size = function (src, imageSize) {
            if (!src || typeof src !== 'string') return src;

            // NEW: if user requested preserving animated formats (GIF/WebP), keep original URL
            if (self.preserve_animated_images && self._isAnimatedExt(src)) {
                return src; // do not rewrite animated formats
            }

            // Pick the friendly host rule
            var rule = null;
            for (var i = 0; i < self.friendly_hosts.length; i++) {
                if (self.friendly_hosts[i].pattern.test(src)) { rule = self.friendly_hosts[i]; break; }
            }
            if (!rule) return src; // not a known host

            // Helper: safely apply the replace pattern to the URL's pathname only
            function applyReplaceToPath(urlStr, replacePattern) {
                try {
                    var u = new URL(urlStr, window.location.href);
                    var origPath = u.pathname || '/';
                    var newPath = String.prototype.replace.apply(origPath, replacePattern);
                    if (newPath !== origPath) {
                        u.pathname = newPath;
                        return u.toString();
                    }
                    // If nothing changed in the pathname, do not alter the host or other parts of the URL.
                    return urlStr;
                } catch (e) {
                    // If URL parsing fails, fall back to legacy behavior of applying replacement on the whole string
                    return String.prototype.replace.apply(urlStr, replacePattern);
                }
            }

            switch (String(imageSize || '').toLowerCase()) {
                case 'thumbnail': // remove .md, add .th
                    return applyReplaceToPath(src, rule.replace_to_small);

                case 'medium': // remove .th, add .md
                    if (!rule.replace_to_medium) {
                        rule.replace_to_medium = [/(?:\.(?:th|md))?\.([^.]+)$/, '.md.$1'];
                    }
                    return applyReplaceToPath(src, rule.replace_to_medium);

                case 'full': // remove .th/.md
                    return applyReplaceToPath(src, rule.replace_to_full);

                default:
                    return src;
            }
        };



        this.sequential_load = typeof sequential_load === 'boolean' ? sequential_load : false;
        this.sequential_load_delay_ms = Number.isFinite(sequential_load_delay_ms) ? sequential_load_delay_ms : 0;
        // concurrent_limit controls Parallelism in Sequential+ mode
        this.concurrent_limit = (typeof concurrent_active_loads === 'number' && concurrent_active_loads > 0) ? Math.max(1, Math.floor(concurrent_active_loads)) : 1;


        // Bring IIFE configs into instance state
        this.auto_refresh_failed_after_ms =
            (typeof auto_refresh_failed_after_ms === 'number' && auto_refresh_failed_after_ms >= 0)
            ? auto_refresh_failed_after_ms
        : 0;

        this.stall_timeout_ms =
            (typeof stall_timeout_ms === 'number' && stall_timeout_ms > 0)
            ? stall_timeout_ms
        : 6000; // default 6s

        // Blob fetch fallback configuration
        this.blob_fetch_hosts = Array.isArray(blob_fetch_hosts) ? blob_fetch_hosts : [];
        this.blob_fetch_on_error = !!blob_fetch_on_error;
        this.blob_fetch_on_stall = !!blob_fetch_on_stall;


        // --- Unified URL parser for all host/domain matching operations ---
        this._parseURLHost = function (url) {
            if (!url || typeof url !== 'string') return null;
            try {
                const u = new URL(url, window.location.href);
                return { url: u, host: (u.hostname || '').toLowerCase() };
            } catch (e) {
                return null;
            }
        };

        // --- Helper: Check if host matches domain list (exact or subdomain) ---
        this._hostMatches = function (host, domainList) {
            if (!host || !Array.isArray(domainList)) return false;
            return domainList.some(d => {
                const dom = (d || '').toLowerCase().trim();
                return dom && (host === dom || host.endsWith('.' + dom));
            });
        };

        // --- NEW: Host rewrite helper ---

        this.rewrite_host = function (url) {
            const parsed = self._parseURLHost(url);
            if (!parsed) return url;

            const rules = Array.isArray(self.host_rewrites) ? self.host_rewrites : [];
            if (rules.length === 0) return url;

            const { url: u, host } = parsed;

            for (const rule of rules) {
                const from = (rule.from || '').toLowerCase().trim();
                const to = (rule.to || '').trim();
                const sub = !!rule.subdomains;
                const forceHttps = !!rule.force_https;
                if (!from || !to) continue;

                const matches = sub ? (host === from || host.endsWith('.' + from)) : (host === from);
                if (matches) {
                    u.hostname = to;
                    if (forceHttps) u.protocol = 'https:';
                    return u.toString();
                }
            }
            return url;
        };


        // Host match helper (exact or subdomain)
        this._isBlobFetchHost = function (url) {
            const parsed = self._parseURLHost(url);
            if (!parsed) return false;
            return self._hostMatches(parsed.host, self.blob_fetch_hosts);
        };

        // Fetch the image as a Blob via Tampermonkey, set it on <img> as a blob: URL



        this._fetchImageAsBlob = function (url, $img) {
            if (!url || !$img || !$img[0]) return;
            if ($img.data('blobFetchInFlight')) return; // avoid duplicate launches
            $img.data('blobFetchInFlight', true);

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                responseType: 'blob',
                timeout: 15000,
                onload: function (resp) {
                    if (resp.status >= 200 && resp.status < 300 && resp.response) {
                        try {
                            const blob = resp.response;
                            const reader = new FileReader();
                            reader.onloadend = function () {
                                const dataUrl = reader.result; // data:image/...;base64,....

                                // Cancel pending timers for this attempt
                                const rt = $img.data('retryTimeoutId');
                                if (rt) { clearTimeout(rt); $img.removeData('retryTimeoutId'); }
                                const at = $img.data('attemptTimerId');
                                if (at) { clearTimeout(at); $img.removeData('attemptTimerId'); }

                                // Mark in-flight only for the src assignment;
                                // the <img> load handler will finalize and fire tnDone.
                                $img.data('isLoading', true);
                                $img.prop('src', dataUrl);

                                $img.removeData('blobFetchInFlight');
                            };
                            reader.readAsDataURL(blob);
                        } catch (e) {
                            $img.addClass('tn-failed');
                            $img.data('isLoading', false);
                            $img.removeData('blobFetchInFlight');
                            $img.trigger('tnDone'); // ensure sequential chain advances
                        }
                    } else {
                        $img.addClass('tn-failed');
                        $img.data('isLoading', false);
                        $img.removeData('blobFetchInFlight');
                        $img.trigger('tnDone'); // advance on non-2xx
                    }
                },
                onerror: function () {
                    $img.addClass('tn-failed');
                    $img.data('isLoading', false);
                    $img.removeData('blobFetchInFlight');
                    $img.trigger('tnDone'); // advance on blob failure
                },
                ontimeout: function () {
                    $img.addClass('tn-failed');
                    $img.data('isLoading', false);
                    $img.removeData('blobFetchInFlight');
                    $img.trigger('tnDone'); // advance on blob timeout
                }
            });
        };



        // Checks if a URL's hostname matches a blacklisted domain (exact or subdomain)
        this.isBlacklisted = function (url) {
            const parsed = self._parseURLHost(url);
            if (!parsed) return false;
            return self._hostMatches(parsed.host, self.blacklisted_domains);
        };

        // Creates a simple "blocked" SVG data URI as a placeholder

        this.block_placeholder_data_uri = function (size) {
            const h = Math.max(1, Math.round((size || max_image_size) * blocked_placeholder_scale));
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${h}' height='${h}' viewBox='0 0 32 32'><rect fill='#eee' width='32' height='32'/><circle cx='16' cy='16' r='11' fill='#e33'/><path d='M10 10L22 22M22 10L10 22' stroke='#fff' stroke-width='4' stroke-linecap='round'/></svg>`;
            return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
        };



        this.create_img = function (src, small) {
            var $img = jQuery('<img>');
            var min_size = small ? '50px' : max_image_size + 'px';
            $img.data('src', src);
            $img.data('retryCount', 0);
            $img.css({
                'min-width': min_size,
                'min-height': min_size,
                'max-width': max_image_size + 'px',
                'max-height': max_image_size + 'px',
            });
            return $img;
        };


        this.show_img = function ($img) {
            const originalSrc = $img.data('src');
            const $row = $img.data('row');
            const imgEl = $img[0];

            // --- Skip hidden torrent rows (display:none or zero size) ---
            if ($row && (
                $row.is(':hidden') ||
                $row.css('display') === 'none' ||
                $row[0].offsetParent === null ||
                ($row[0].offsetWidth === 0 && $row[0].offsetHeight === 0)
            )) {
                $img.off('error.lazyRetry load.lazyRetry');
                $img.data('isLoading', false);
                $img.data('loaded', false);
                $img.removeClass('tn-failed tn-stalled tn-blocked');
                if (typeof window.logSkip === 'function') {
                    window.logSkip('Torrent Row Hidden - Skipping Image');
                } else {
                    console.log('----- Torrent Row Hidden - Skipping Image');
                }
                $img.trigger('tnDone');
                return;
            }

            // --- Short-circuit for blacklisted hosts ---
            if (self.isBlacklisted(originalSrc)) {
                const ph = self.block_placeholder_data_uri(max_image_size);
                $img.prop('src', ph)
                    .data('blocked', true)
                    .addClass('tn-blocked')
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
                scheduleImageTimer($img, self.stall_timeout_ms, onStall);
            }

            // --- Helper: start a retry timer ---
            function startRetryTimer($img, delayMs, onRetry) {
                scheduleImageTimer($img, delayMs, onRetry);
            }

            // --- Attach handlers ---
            window.logBegin(originalSrc);
            $img.data('isLoading', true);


            $img.on('load.lazyRetry', function () {
                scheduleImageTimer($img);
                const el = imgEl;
                const renderOK = (el && el.complete && el.naturalWidth > 0);
                $img.removeClass('tn-failed tn-stalled tn-blocked');
                $img.data('retryCount', 0);
                $img.off('error.lazyRetry');
                $img.data('loaded', true);
                $img.data('isLoading', false);
                if (imgEl) {
                    imgEl.style.minWidth = '';
                    imgEl.style.minHeight = '';
                }
                window.logFinish($img.data('src'));
                $img.trigger('tnDone');
            });



            // --- Helper: Schedule a retry with optional delay ---
            function scheduleRetry(count, delaySrc, delayMs) {
                if (count < self.max_retry_attempts) {
                    const nextCount = count + 1;
                    $img.data('retryCount', nextCount);
                    if (delayMs > 0) {
                        window.logWait(delayMs);
                        $img.data('isLoading', true);
                        const tid = setTimeout(function () {
                            const el2 = $img[0];
                            const isRenderable2 = (el2 && el2.complete && el2.naturalWidth > 0) || $img.data('loaded');
                            if (isRenderable2) return;
                            window.logRetry(nextCount, delaySrc);
                            $img.prop('src', delaySrc);
                            startStallTimer($img);
                        }, delayMs);
                        $img.data('retryTimeoutId', tid);
                    } else {
                        const el2 = $img[0];
                        const isRenderable2 = (el2 && el2.complete && el2.naturalWidth > 0) || $img.data('loaded');
                        if (!isRenderable2) {
                            $img.data('isLoading', true);
                            window.logRetry(nextCount, delaySrc);
                            $img.prop('src', delaySrc);
                            startStallTimer($img);
                        }
                    }
                } else {
                    $img.addClass('tn-failed');
                    $img.off('error.lazyRetry');
                    $img.data('isLoading', false);
                    $img.trigger('tnDone');
                }
            }

            $img.on('error.lazyRetry', function () {
                const el = imgEl;
                const renderOK = (el && el.complete && el.naturalWidth > 0);
                if (renderOK) {
                    scheduleImageTimer($img);
                    $img.removeClass('tn-failed tn-stalled tn-blocked');
                    $img.data('retryCount', 0);
                    $img.off('error.lazyRetry');
                    $img.data('loaded', true);
                    $img.data('isLoading', false);
                    window.logFinish($img.data('src'));
                    $img.trigger('tnDone');
                    return;
                }

                // IMPORTANT: keep ownership; do not set isLoading=false here
                scheduleImageTimer($img);

                const currentCount = $img.data('retryCount') || 0;

                // --- Step 1: Probe the failing URL to detect a true 404 ---
                // We only special-case 404; other errors keep normal retry behavior.
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

                            // Helper to perform the normal bounded retry behavior (used by multiple branches)
                            function scheduleNormalRetry() {
                                scheduleRetry(currentCount, originalSrc, self.retry_delay_ms > 0 ? self.retry_delay_ms : 0);
                            }

                            // If probe returns a HTTP 404, prefer the original/full URL first.
                            const is404 = (status === 404);

                            if (is404) {
                                // First time we see a 404 on the rewritten URL?
                                const first404Done = !!$img.data('first404Done');

                                if (!first404Done) {
                                    // Mark that we've seen 404 on the rewritten URL
                                    $img.data('first404Done', true);

                                    // Log and retry ONCE with the "original" (strip .th/.md)
                                    window.logRetry(currentCount + 1, originalSrc);
                                    window.logBegin(originalSrc);
                                    console.log('----- 404 on URL: ' + originalSrc);

                                    const originalFull = self.to_original_url(originalSrc);
                                    console.log('----- Retrying with original URL: ' + originalFull);

                                    // Keep ownership while we switch URLs
                                    $img.data('isLoading', true);
                                    $img.data('retryCount', currentCount + 1);
                                    $img.prop('src', originalFull);

                                    // Arm stall timer for this new attempt
                                    startStallTimer($img);
                                    return;
                                }

                                // If we've already tried the original, fall back to the normal retry loop
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

                        // --- Not a 404 and not non-image/HTML that we handled above: use normal bounded retry behavior ---
                        scheduleRetry(currentCount, originalSrc, self.retry_delay_ms > 0 ? self.retry_delay_ms : 0);
                    },
                    onerror: function () {
                        // Could not probe (network error); treat like non-404 and do normal retry
                        scheduleRetry(currentCount, originalSrc, self.retry_delay_ms > 0 ? self.retry_delay_ms : 0);
                    },
                    ontimeout: function () {
                        // Probe timed out; treat as non-404 error → normal retry
                        scheduleRetry(currentCount, originalSrc, self.retry_delay_ms > 0 ? self.retry_delay_ms : 0);
                    }
                });
            });

            // --- First request after handlers are attached ---
            $img.prop('src', originalSrc);

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
    // SEQUENTIAL MODE: load one image immediately, then schedule the next with a small delay.
    if (self.sequential_load) {
        // Support Sequential+ (concurrent workers) when concurrent_limit > 1
        self._activeLoads = (typeof self._activeLoads === 'number') ? self._activeLoads : 0;
        const concurrent = (typeof self.concurrent_limit === 'number' && self.concurrent_limit > 0) ? self.concurrent_limit : 1;

        if (concurrent > 1) {
            // Start up to `concurrent` image loads in parallel from the current image_index
            while (self.image_index < self.images.length && self._activeLoads < concurrent) {
                const $img = self.images[self.image_index];
                // Advance index immediately to claim the work item
                self.image_index += 1;
                self._activeLoads += 1;

                // Attach one-shot completion handler BEFORE starting the load
                const onDone = function () {
                    // Decrement active count and try to start more work
                    try { self._activeLoads = Math.max(0, (self._activeLoads || 1) - 1); } catch (e) { self._activeLoads = 0; }
                    $img.off('tnDone', onDone);
                    // Update progress (based on claimed items)
                    try { self.progress_set_value(Math.min(1, (self.image_index) / Math.max(1, self.images.length))); } catch (e) {}
                    // Kick the loader again to fill vacancies
                    self.load_next_image(true);
                };
                $img.one('tnDone', onDone);

                // Start loading the image
                self.show_img($img);
            }

            // If we've consumed the list and no active loads remain, we're done
            if (self.image_index >= self.images.length && self._activeLoads === 0) {
                self.detach_scroll_event();
            }
            return;
        }

        // FALLBACK: original single-worker sequential behavior
        // If a pause timer is already scheduled, do nothing
        if (self._seqTimerId !== null) return;

        if (self.image_index < self.images.length) {
            // IMPORTANT: self.images holds jQuery <img> objects
            const $currentImg = self.images[self.image_index];
            let tnDoneCalled = false;
            // Attach the completion handler BEFORE show_img, in case show_img completes synchronously
            const onDone = function () {
                tnDoneCalled = true;
                const gap = (self.sequential_load_delay_ms > 0 ? self.sequential_load_delay_ms : 0);
                if (gap > 0 && !tnDoneCalled) window.logWait(gap); // Only log if not skipped
                self._seqTimerId = setTimeout(function () {
                    self._seqTimerId = null;
                    $currentImg.off('tnDone', onDone);
                    self.load_next_image(true);
                }, gap);
            };
            $currentImg.one('tnDone', onDone);

            // Start loading AFTER the handler is attached
            self.show_img($currentImg);

            // Advance index and update progress immediately
            self.image_index += 1;
            self.progress_set_value(self.image_index / self.images.length);

            // If tnDone was called synchronously (e.g., row hidden), skip delay and immediately advance
            if (tnDoneCalled && self._seqTimerId !== null) {
                clearTimeout(self._seqTimerId);
                self._seqTimerId = null;
                $currentImg.off('tnDone', onDone);
                self.load_next_image(true);
            }
        } else {
            // Done with the list
            self.detach_scroll_event();
        }
        return;
    }

    // ORIGINAL LAZY-IN-VIEWPORT MODE (fallback when sequential_load=false)
    if (self.image_index < self.images.length) {
        var nextImg = self.images[self.image_index];
        var _ = self.visible_area(),
            y = _[0],
            height = _[1];
        var bottom_limit = y + height * (1 + self.preload_ratio);
        // Use native DOM for position
        var imgEl = nextImg[0];
        var imgTop = imgEl ? imgEl.getBoundingClientRect().top + window.scrollY : 0;
        if (bottom_limit >= imgTop) {
            self.show_img(nextImg);
            self.image_index += 1;
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

            // Auto-refresh failed/stalled thumbnails after a short grace period
            const delay = (typeof self.auto_refresh_failed_after_ms === 'number' && self.auto_refresh_failed_after_ms >= 0)
            ? self.auto_refresh_failed_after_ms
            : 0;

            // Consider the initial pass finished when we've advanced past the image list
            const finishedInitialPass = (typeof self.image_index === 'number' && Array.isArray(self.images) && self.image_index >= self.images.length);

            if (typeof self.refreshFailedThumbnails === 'function') {
                // Only schedule the auto-refresh when we've actually completed the initial pass.
                // detach_scroll_event may be called in other contexts (e.g. switching to sequential mode),
                // so avoid scheduling retries prematurely.
                if (!finishedInitialPass) {
                    if (window.debug_logging) {
                        // console.log('LDT: detach_scroll_event called before finishing initial pass; skipping auto-refresh scheduling');
                    }
                    return;
                }

                // If the initial pass just completed, announce completion (honor debug flag)
                if (window.debug_logging) {
                    console.log('================================================');
                    console.log('⏹️ - LDT - Finished Image Processing (Initial Pass)');
                    console.log('================================================');
                    console.log('LDT: Scheduling auto-refresh of failed thumbnails in ' + delay + 'ms');
                }

                setTimeout(function () {
                    if (window.debug_logging) {
                        console.log('LDT: Auto-refresh triggered after ' + delay + 'ms');
                    }
                    try {
                        self.refreshFailedThumbnails();
                    } catch (e) {
                        if (window.debug_logging) console.error('LDT: auto-refresh error', e);
                    }
                }, delay);
            }
        };



        // Refresh only failed or stalled thumbnails

        this.refreshFailedThumbnails = function () {
            // Build a queue of images that truly need a restart (failed or stalled)
            const queue = [];

            self.images.forEach(function ($img) {
                // Cancel any pending retry timers
                const tid = $img.data('retryTimeoutId');
                if (tid) { clearTimeout(tid); $img.removeData('retryTimeoutId'); }

                const src = $img.data('src');
                const isBlocked = self.isBlacklisted(src);

                // Skip already-good images
                const el = $img[0];
                const naturalOK = (el && el.complete && el.naturalWidth > 0) || $img.data('loaded');
                if (naturalOK) {
                    $img.off('error.lazyRetry load.lazyRetry');
                    $img.data('isLoading', false);
                    return;
                }

                const exceededRetries = ($img.data('retryCount') >= self.max_retry_attempts);
                const isFailed = $img.hasClass('tn-failed') || exceededRetries;
                const isStalled = $img.hasClass('tn-stalled');

                // Handle blocked immediately with a placeholder and skip
                if (isBlocked) {
                    const ph = self.block_placeholder_data_uri(self.max_image_size);
                    $img.prop('src', ph).addClass('tn-blocked');
                    return;
                }

                // Queue only items that need a restart
                if (isFailed || isStalled) {
                    // Reset flags/handlers so we can safely restart this image
                    $img
                        .data('retryCount', $img.data('retryCount') || 0)
                        .removeClass('tn-failed tn-stalled tn-blocked')
                        .off('error.lazyRetry load.lazyRetry')
                        .data('isLoading', false)
                        .removeData('loaded')
                        .removeData('retryTimeoutId');

                    queue.push($img);
                }
            });

            // Process the queue one-by-one with the same sequential pause
            (function processNext(i) {
                if (i >= queue.length) return;

                const $img = queue[i];
                const src = $img.data('src');

                // Announce begin before each restart
                window.logBegin(src);

                // Prefer Blob fallback for designated hosts; otherwise use normal show path
                if (self._isBlobFetchHost(src)) {
                    self._fetchImageAsBlob(src, $img);
                } else {
                    self.show_img($img);
                }

                // Pause before the next restart to avoid host throttling
                const gap = (self.sequential_load_delay_ms > 0 ? self.sequential_load_delay_ms : 0);
                if (gap > 0) window.logWait(gap);
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

            // Announce start of page processing including active loading mode
            try {
                var _mode = 'Lazy';
                if (self.sequential_load) {
                    _mode = (typeof self.concurrent_limit === 'number' && self.concurrent_limit > 1) ? 'Sequential+' : 'Sequential';
                }
                if (window.debug_logging) {
                    console.log('================================================');
                    if (_mode === 'Sequential+' && typeof self.concurrent_limit === 'number') {
                        console.log('▶️ - LDT - Starting Image Processing (' + _mode + ' - workers=' + self.concurrent_limit + ')');
                    } else {
                        console.log('▶️ - LDT - Starting Image Processing (' + _mode + ')');
                    }
                    console.log('================================================');
                }
            } catch (e) { /* non-fatal */ }

            if (replace_categories) self.replace_categories();
            if (remove_categories) self.remove_categories();

            self.attach_thumbnails(); // build the list of images
            self.load_next_image(); // start loading
            // ✅ Attach scroll/resize only in lazy-in-viewport mode
            if (!self.sequential_load) {
                self.attach_scroll_event();
            } else {
                // Ensure no scroll/resize events can trigger extra loads in sequential mode
                self.detach_scroll_event();
            }

            // --- NEW: Observe for unhide events on rows and trigger image load ---
    if (self.$torrent_table && self.$torrent_table.length) {
        const table = self.$torrent_table[0];
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
                    const row = m.target;
                    if (row && row.matches && row.matches('tr.torrent')) {
                        // Check if now visible
                        if (row.offsetParent !== null && row.offsetWidth > 0 && row.offsetHeight > 0) {
                            // Find the image for this row
                            const $row = jQuery(row);
                            const $img = self.images.find($img => $img.data('row') && $img.data('row')[0] === row);
                            if ($img && !$img.data('loaded') && !$img.data('isLoading')) {
                                self.show_img($img);
                            }
                        }
                    }
                }
            }
        });
        observer.observe(table, {
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
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
                debug_logging: true
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
            <div class="ldt-row" data-tip="Maximum height and width for thumbnails (px)"><label class="ldt-label">Image Size (Max) <input id="ldt-size-input" class="ldt-number" type="number" min="1" value="${ldt_max_thumb}"></label></div>
            <div class="ldt-row" data-tip="Download smaller image sizes. (Experimental - May actually reduce performance"><label class="ldt-label">Image Quality<select id="ldt-image-size-select" class="ldt-select"><option value="Thumbnail">Thumbnail</option><option value="Medium">Medium</option><option value="Full">Full</option></select></label></div>
            <div class="ldt-row" data-tip="Keep animated images \"Full Size\" to preserve animation"><label><input id="ldt-preserve-animated" type="checkbox"> Preserve Animated (GIF/WebP)</label></div>
            <div class="ldt-row" data-tip="Disable site hover images (reduce redundancy)"><label><input id="ldt-disable-hover" type="checkbox"> Disable Site Hover Images</label></div>
            <div class="ldt-row" data-tip="Place thumbnails inside the category column"><label><input id="ldt-replace-cats" type="checkbox"> Replace Categories</label></div>
            <div class="ldt-row" data-tip="Hide category names entirely"><label><input id="ldt-remove-cats" type="checkbox"> Remove Categories</label></div>
        </div>
    </div>

    <div class="ldt-section">
        <h2>Retry / Timeout Options</h2>
        <div class="ldt-grid">
            <div class="ldt-row" data-tip="Maximum number of retries for fetching images before giving up"><label>Max Retry Attempts <input id="ldt-max-retries" class="ldt-number" type="number" min="0" value="${ldt_max_retries}"></label></div>
            <div class="ldt-row" data-tip="Delay between image load retries (ms)"><label>Retry Delay (ms) <input id="ldt-retry-delay" class="ldt-number" type="number" min="0" value="${ldt_retry_delay}"></label></div>
            <div class="ldt-row" data-tip="Choose loading strategy: Off (lazy-in-viewport), Sequential (one at a time), Sequential+ (concurrent workers)"><label>Loading Mode <select id="ldt-sequential-mode" class="ldt-select"><option value="off">Off (Lazy)</option><option value="sequential">Sequential (1 worker)</option><option value="sequential_plus">Sequential+ (concurrent)</option></select></label></div>
            <div class="ldt-row" data-tip="Delay between sequential image loads (ms)"><label>Sequential Delay (ms) <input id="ldt-seq-delay" class="ldt-number" type="number" min="0" value="${ldt_sequential_delay}"></label></div>
            <div class="ldt-row" data-tip="Auto-retry failed thumbnails after this many ms"><label>Auto-refresh Failed (ms) <input id="ldt-auto-refresh-failed" class="ldt-number" type="number" min="0" value="${ldt_auto_refresh_failed}"></label></div>
            <div class="ldt-row" data-tip="Consider an image failed or stalled after this many ms"><label>Image Timeout (ms) <input id="ldt-stall-timeout" class="ldt-number" type="number" min="0" value="${ldt_stall_timeout}"></label></div>
        </div>
    </div>

    <div class="ldt-section">
        <h2>Misc Options</h2>
        <div class="ldt-grid">
            <div class="ldt-row" data-tip="Enable verbose debug logging in the console (ctrl+shift+i)"><label><input id="ldt-debug-logging" type="checkbox"> Console Debug</label></div>
            <div class="ldt-row"><label>Reserved Option</label></div>
        </div>
        <div class="ldt-note">
            Tip: Use the 'Refresh TN' button to manually retry thumbnails at any time.
        </div>
    </div>

    <div class="s-conf-buttons-ldt">
        <input id="s-conf-save-general-ldt" class="s-conf-save-ldt" type="button" value="Save Settings">
        <input id="s-conf-close-ldt" type="button" value="Close">
    </div>
</div>
`;

    document.body.appendChild(modalBg);

    const openConfigModal   = () => modalBg.style.display = 'block';
    const closeConfigModal = () => modalBg.style.display = 'none';

    // Reusable tooltip element
    const tooltip = document.createElement('div');
    tooltip.style = `
    position:fixed;padding:4px 6px;background:#000;color:#fff;
    font-size:12px;z-index:999999;display:none;
    `;
    document.body.appendChild(tooltip);

    // Tooltip logic via event delegation (single listener pair on modal)
    let tooltipTimer = null;
    modalBg.addEventListener('mouseenter', (e) => {
        const row = e.target.closest('.ldt-row[data-tip]');
        if (!row) return;
        tooltipTimer = setTimeout(() => {
            const r = row.getBoundingClientRect();
            tooltip.textContent = row.dataset.tip;

            tooltip.style.top  = (r.top - 25) + 'px';
            tooltip.style.left = (r.left + 10) + 'px';
            tooltip.style.display = 'block';
        }, 1000);
    }, true);
    modalBg.addEventListener('mouseleave', (e) => {
        const row = e.target.closest('.ldt-row[data-tip]');
        if (!row) return;
        clearTimeout(tooltipTimer);
        tooltip.style.display = 'none';
    }, true);




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
                        'ldt_debug_logging': ldt_debug
                    });

                    // Attempt to apply to running instance if available
                    try {
                        const inst = window.lazyThumbsInstance;
                        if (inst) {
                            inst.image_size = ldt_image_size;
                            // preserve animated flag (instance uses preserve_animated_images property)
                            inst.preserve_animated_images = ldt_preserve_animated;
                            inst.max_retry_attempts = Number.isFinite(ldt_max_retries) ? ldt_max_retries : inst.max_retry_attempts;
                            inst.retry_delay_ms = Number.isFinite(ldt_retry_delay) ? ldt_retry_delay : inst.retry_delay_ms;
                            // Map mode to instance flags
                            if (ldt_sequential_mode === 'off') {
                                inst.sequential_load = false;
                                // keep concurrent_limit as-is; ensure scroll events attached for lazy mode
                                try { inst.attach_scroll_event(); } catch(e){}
                            } else if (ldt_sequential_mode === 'sequential') {
                                inst.sequential_load = true;
                                // single-worker behavior
                                try { inst.concurrent_limit = 1; } catch(e){}
                                try { inst.detach_scroll_event(); } catch(e){}
                            } else if (ldt_sequential_mode === 'sequential_plus') {
                                inst.sequential_load = true;
                                // keep inst.concurrent_limit as configured elsewhere (allow >1)
                                try { inst.detach_scroll_event(); } catch(e){}
                            }
                            inst.sequential_load_delay_ms = Number.isFinite(ldt_sequential_delay) ? ldt_sequential_delay : inst.sequential_load_delay_ms;
                            inst.auto_refresh_failed_after_ms = Number.isFinite(ldt_auto_refresh_failed) ? ldt_auto_refresh_failed : inst.auto_refresh_failed_after_ms;
                            inst.stall_timeout_ms = Number.isFinite(ldt_stall_timeout) ? ldt_stall_timeout : inst.stall_timeout_ms;

                            // Update displayed image constraints
                            if (Array.isArray(inst.images)) {
                                inst.images.forEach(function($img) {
                                    try { $img.css({'max-width': ldt_max_thumb + 'px', 'max-height': ldt_max_thumb + 'px'}); } catch(e){}
                                });
                            }

                            // Update table classes for replace/remove categories immediately if table exists
                            try {
                                if (inst.$torrent_table && inst.$torrent_table.length) {
                                    if (ldt_replace_categories) inst.$torrent_table.addClass('overlay-category'); else inst.$torrent_table.removeClass('overlay-category');
                                    if (ldt_remove_categories) inst.$torrent_table.addClass('remove-category'); else inst.$torrent_table.removeClass('remove-category');
                                    if (window.location.hostname.indexOf('empornium.') !== -1 || window.location.hostname.indexOf('cheggit.') !== -1) {
                                        if (ldt_replace_categories) inst.$torrent_table.addClass('overlay-category-small'); else inst.$torrent_table.removeClass('overlay-category-small');
                                    }
                                }
                            } catch (e) {}

                            // Update debug flag for global logging
                            window.debug_logging = !!ldt_debug;

                            // If switching between sequential/non-sequential, re-attach/detach scroll events handled above
                            if (!inst.sequential_load) {
                                try { inst.attach_scroll_event(); } catch(e){}
                                try { inst.load_next_image(true); } catch(e){}
                            } else {
                                try {
                                    if (inst._seqTimerId) { clearTimeout(inst._seqTimerId); inst._seqTimerId = null; }
                                } catch(e){}
                            }
                        }
                    } catch (e) { /* non-fatal */ }

                    // Note: disabling site hover images requires reload to re-run the MutationObserver; we persist the choice
                } catch (e) {
                    console.error('LDT save failed', e);
                }

                closeConfigModal();
            });

        } catch (e) {
            console.error('LDT config UI insertion failed:', e);
        }
    })();