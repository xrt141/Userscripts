// ==UserScript==
// @name        Luminance HoverBabe+
// @namespace   empornium Scripts
// @description Hover over performer tag and get their Babepedia Bio.
// @version     1.50.3
// @author      vandenium xrt141 (forked and extended by xrt141)
// @include     /^https://www\.empornium\.(me|sx|is)\/torrents.php/
// @include     /^https://www\.empornium\.(me|sx|is)\/top10.php/
// @include     /^https://www\.empornium\.(me|sx|is)\/requests.php/
// @include     /^https://www\.happyfappy\.org\/torrents.php/
// @connect     babepedia.com
// @connect     www.babepedia.com
// @grant       GM_cookie
// @grant       GM_notification
// @grant       GM_openInTab
// @grant       GM_xmlhttpRequest
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_deleteValue
// @grant       GM_addStyle
// @grant       GM_info
// @downloadURL https://github.com/xrt141/Userscripts/raw/refs/heads/main/Luminance%20HoverBabe+.user.js
// @updateURL   https://github.com/xrt141/Userscripts/raw/refs/heads/main/Luminance%20HoverBabe+.user.js
// ==/UserScript==
// Changelog:

/* ========================================================================================
   Luminance HoverBabe+ - Forked from Hoverbabe (vandenium)
   ======================================================================================== */

let settings;
let hovered;
const oneMonth = 30 * 24 * 60 * 60 * 1000;
let iconSpinnerIntervalHandle;

const TARGET_BP_URL = "https://www.babepedia.com"; // "https://www.mysite.com"
const TARGET_BP_HOST = TARGET_BP_URL.replace(/^https?:\/\//, ""); // "www.mysite.com"
const TARGET_BP_BASE = TARGET_BP_HOST.replace(/^www\./, ""); // "mysite.com"

const TARGET_CUP_URL = "https://www.boobepedia.com"; // "https://www.mysite.com"

const TARGET_IAFD_URL = "https://www.iafd.com"; // "https://www.mysite.com"
const TARGET_IAFD_HOST = TARGET_IAFD_URL.replace(/^https?:\/\//, ""); // "www.mysite.com"


const PARTITION_KEY  = { topLevelSite: TARGET_BP_URL };
const CF_DEBUG_TAG   = "[HB-CF]";
const CF_NEXT_CHECK_KEY = "cf_next_check";
const CF_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour cooldown between checks

// --- Update Popup Constants ---
const UPDATE_POPUP_SUPPRESS_KEY = "hb_update_popup_suppress_until";
const UPDATE_LOG_TAG = "[HB-UPDATE]";

const getTagCache = (type) => {
    const key = type === "hits" ? "hb-tag-hits" : "excludedTagNames";
    const val = localStorage.getItem(key);
    if (val) {
        return new Set(JSON.parse(val));
    }
    return new Set();
};

// Tag Caches
const excludedTagNamesSet = getTagCache("misses");
const tagHits = getTagCache("hits");


// --- Cloudflare cookie bridge (partition-aware) ---


// Determine if debug logging enabled in settings (reads stored settings directly)
const HB_isDebug = () => {
    try {
        const raw = typeof GM_getValue === 'function' ? GM_getValue('hb-settings') : null;
        if (!raw) return false;
        const opts = JSON.parse(raw);
        return !!opts.optionDebug;
    } catch (e) {
        return false;
    }
};

const cfDebug = (...args) => {
    if (HB_isDebug()) console.log(CF_DEBUG_TAG, ...args);
};

// General grouped request logger (collapsed by default)
const HB_detectRequestType = (url) => {
    try {
        if (!url) return 'Request';
        const u = url.toLowerCase();
        if (u.includes(TARGET_BP_URL.replace(/^https?:\/\//, ''))) {
            if (/\/index\/[a-z]$/.test(u) || /\/index\//.test(u)) return 'Updating Database';
            if (/\/babe\//.test(u)) {
                // Extract actor name from URL for better logging
                const match = u.match(/\/babe\/([^/?#]+)/);
                if (match && match[1]) {
                    const actorName = decodeURIComponent(match[1]).replace(/_/g, ' ');
                    return `Fetching Actor Bio: ${actorName}`;
                }
                return 'Fetching Actor Bio';
            }
            if (u.endsWith('/')) return 'Verifying Babepedia Reachability';
            return 'Babepedia Request';
        }
        if (u.includes(TARGET_IAFD_HOST.replace(/^https?:\/\//, '')) || u.includes('iafd.com')) return 'IAFD lookup';
        return 'External Request';
    } catch (e) {
        return 'Request';
    }
};

const HB_logRequest = (title, urls, result) => {
    if (!HB_isDebug()) return;
    try {
        console.groupCollapsed(`[HB] - ${title}`);
        console.log('> Timestamp:', new Date().toISOString());
        if (typeof urls === 'string') console.log('> ', urls);
        else if (Array.isArray(urls)) urls.forEach((u) => console.log('> ', u));
        if (result !== undefined) console.log('> Result:', result);
        console.groupEnd();
    } catch (e) {
        // ignore logging errors
    }
};


const SUPPRESS_KEY    = "hb_popup_suppress_until";
const LOG_TAG         = "[HB-POPUP]";


// XRT141 - New - Helper - Normalize Tags to Lowercase
const getLowerTagText = (el) => {
    const raw = (el.innerText || "").trim();
    const withoutIcon = raw.replace(/^[📸📷]\s*/u, "");
    return withoutIcon.toLowerCase();
};

    function shouldSuppressPopup() {
        const until = parseInt(localStorage.getItem(SUPPRESS_KEY), 10);
        return !Number.isNaN(until) && Date.now() < until;
    }

    function setPopupSuppressionHours(hours) {
        if (!hours || Number.isNaN(+hours) || +hours <= 0) {
            localStorage.removeItem(SUPPRESS_KEY);
            return;
        }
        const until = Date.now() + (+hours) * 60 * 60 * 1000;
        localStorage.setItem(SUPPRESS_KEY, until.toString());
    }


    function testTargetSite200(onStatusUpdate) {
        const opts = {
            method: "GET",
            url: `${TARGET_BP_URL}/`,
            anonymous: false, // MUST send cookies
            headers: {
                "Accept": "text/html,application/xhtml+xml",
                "User-Agent": navigator.userAgent,
                Referer: TARGET_BP_URL,
                Host: TARGET_BP_HOST,
            },
            onload: (resp) => {
                if (resp.status === 200) {
                    onStatusUpdate("✅ Test passed: site returned 200. You can close this message.");
                } else {
                    onStatusUpdate(`❌ Test failed: status ${resp.status}. Try generating the cookie again, or suppress this message for a while.`);
                }
            },
            onerror: (err) => {
                onStatusUpdate("❌ Test failed: network error. Try again later or suppress this message.");
                console.warn(LOG_TAG, "Network error during test:", err);
            },
        };
        setCookiePartitionIfSupported(opts);
        HB_logRequest(HB_detectRequestType(opts.url), opts.url);
        GM_xmlhttpRequest(opts);
    }


    function showCaptchaPopup(initialStatusCode) {
        // Suppression check
        if (shouldSuppressPopup()) {
            console.warn(LOG_TAG, "Popup suppressed by user setting.");
            return;
        }

        // --- Styles ---
        const style = document.createElement("style");
        style.textContent = `
    #hb-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9998;
    }
    #hb-modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 540px; max-width: 92vw; background: #111; color: #ddd; border: 1px solid #444;
      border-radius: 8px; padding: 16px; z-index: 9999; font-family: Verdana, Arial, sans-serif; font-size: 13px;
    }
    #hb-modal h3 { margin: 0 0 8px 0; font-size: 16px; }
    #hb-modal p { margin: 8px 0; line-height: 1.35; }
    #hb-modal .row { margin-top: 12px; display: flex; align-items: center; gap: 8px; }
    #hb-modal .btn {
      background: #2a7; color: #fff; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer;
    }
    #hb-modal .btn.secondary { background: #555; }
    #hb-modal .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    #hb-modal .status { margin-top: 10px; min-height: 20px; color: #eee; }
    #hb-modal .suppress { margin-top: 12px; display: flex; align-items: center; gap: 6px; }
    #hb-modal input[type="number"] { width: 80px; padding: 4px; border-radius: 4px; border: 1px solid #555; background:#000; color:#ddd; }
    #hb-modal .footer { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
  `;
        document.head.appendChild(style);

        // --- DOM ---
        const overlay = document.createElement("div");
        overlay.id = "hb-modal-overlay";

        const modal = document.createElement("div");
        modal.id = "hb-modal";
        modal.innerHTML = `
    <h3>Site failed to load</h3>
    <p>
      The target site did not return 200 (status: <b>${initialStatusCode}</b>).<br/>
      You probably need to complete a CAPTCHA. Click <b>Open Site</b> to complete it, then return here and click <b>Test Site</b>.
    </p>

    <div class="row">
      <button id="hb-open" class="btn">Open Site</button>
      <button id="hb-test" class="btn secondary">Test Site</button>
    </div>

    <div id="hb-status" class="status">Waiting for action…</div>

    <label class="suppress">
      <input type="checkbox" id="hb-suppress-checkbox"/>
      <span>Don’t show again for</span>
      <input type="number" id="hb-suppress-hours" min="1" step="1" placeholder="e.g. 12"/>
      <span>hours</span>
    </label>

    <div class="footer">
      <button id="hb-close" class="btn secondary">Close</button>
    </div>
  `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // --- Elements ---
        const openBtn      = modal.querySelector("#hb-open");
        const testBtn      = modal.querySelector("#hb-test");
        const closeBtn     = modal.querySelector("#hb-close");
        const statusEl     = modal.querySelector("#hb-status");
        const suppressCbx  = modal.querySelector("#hb-suppress-checkbox");
        const suppressHrs  = modal.querySelector("#hb-suppress-hours");

        // --- Behavior ---
        openBtn.addEventListener("click", () => {
            statusEl.textContent = "Opening site in a new tab…";
            try {
                if (typeof GM_openInTab === "function") {
                    GM_openInTab(TARGET_BP_URL, { active: true });
                } else {
                    window.open(TARGET_BP_URL, "_blank");
                }
            } catch (e) {
                console.warn(LOG_TAG, "openInTab error:", e);
                window.open(TARGET_BP_URL, "_blank");
            }
        });

        testBtn.addEventListener("click", () => {
            statusEl.textContent = "Testing site…";
            testBtn.disabled = true;
            testTargetSite200((msg) => {
                statusEl.textContent = msg;
                testBtn.disabled = false;

                // When test FAILS and user checked suppression, persist hours
                const failed = msg.startsWith("❌");
                if (failed && suppressCbx.checked) {
                    const hours = parseInt(suppressHrs.value, 10);
                    setPopupSuppressionHours(hours);
                }
            });
        });

        closeBtn.addEventListener("click", () => {
            // Save suppression preference if checked before closing
            if (suppressCbx.checked) {
                const hours = parseInt(suppressHrs.value, 10);
                if (!Number.isNaN(hours) && hours > 0) {
                    setPopupSuppressionHours(hours);
                }
            }
            overlay.remove();
            style.remove();
        });
    }

    // --- Update Popup UI ---

    function showUpdatePopup(reason) {
        // Suppression check
        if (shouldSuppressUpdatePopup()) {
            console.warn(UPDATE_LOG_TAG, "Update popup suppressed by user setting.");
            return;
        }

        // Determine message based on reason
        let messageText = "";
        if (reason === "version") {
            messageText = "Version Change Detected - It is recommended to refresh your local actress database.";
        } else if (reason === "monthly" || reason === "initial") {
            messageText = "Old Data - It has been at least 1 month since you updated your local actress database.";
        } else {
            messageText = "Database Update Recommended";
        }

        // --- Styles ---
        const style = document.createElement("style");
        style.textContent = `
    #hb-update-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9998;
    }
    #hb-update-modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 560px; max-width: 92vw; background: #111; color: #ddd; border: 1px solid #444;
      border-radius: 8px; padding: 16px; z-index: 9999; font-family: Verdana, Arial, sans-serif; font-size: 13px;
    }
    #hb-update-modal h3 { margin: 0 0 12px 0; font-size: 16px; color: #f9a825; }
    #hb-update-modal p { margin: 8px 0; line-height: 1.35; }
    #hb-update-modal .message {
      background: #222; padding: 12px; border-radius: 4px; border-left: 4px solid #f9a825;
      margin-bottom: 12px; font-weight: bold;
    }
    #hb-update-modal .buttons { margin: 12px 0; display: flex; gap: 8px; }
    #hb-update-modal .btn {
      background: #2a7; color: #fff; border: none; border-radius: 4px; padding: 10px 16px;
      cursor: pointer; font-size: 13px; flex: 1;
    }
    #hb-update-modal .btn.primary { background: #2a7; }
    #hb-update-modal .btn.secondary { background: #555; }
    #hb-update-modal .btn:hover { opacity: 0.9; }
    #hb-update-modal .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    #hb-update-modal .progress-area {
      margin: 12px 0; padding: 10px; background: #1a1a1a; border-radius: 4px;
      min-height: 40px; border: 1px solid #333;
    }
    #hb-update-modal .progress-status { color: #aaa; font-size: 12px; }
    #hb-update-modal .warning {
      margin: 12px 0; padding: 8px; background: #332200; border-radius: 4px;
      color: #ffcc00; font-size: 12px; border-left: 3px solid #f9a825;
    }
    #hb-update-modal .suppress {
      margin-top: 12px; padding-top: 12px; border-top: 1px solid #333;
      display: flex; align-items: center; gap: 6px; font-size: 12px;
    }
    #hb-update-modal select {
      padding: 4px 8px; border-radius: 4px; border: 1px solid #555;
      background: #222; color: #ddd; cursor: pointer;
    }
  `;
        document.head.appendChild(style);

        // --- DOM ---
        const overlay = document.createElement("div");
        overlay.id = "hb-update-modal-overlay";

        const modal = document.createElement("div");
        modal.id = "hb-update-modal";
        modal.innerHTML = `
    <h3>🔄 Performer Database Update </h3>

    <div class="message">${messageText}</div>

    <div class="buttons">
      <button id="hb-update-now" class="btn primary">Update Now</button>
      <button id="hb-update-cancel" class="btn secondary">Cancel</button>
    </div>

    <div class="progress-area">
      <div id="hb-update-progress" class="progress-status">
        Progress will be displayed here during update...
      </div>
    </div>

    <div class="warning">
      ⚠️ Please wait for the update to finish to avoid an incomplete refresh
    </div>

    <label class="suppress">
      <input type="checkbox" id="hb-update-suppress-checkbox"/>
      <span>Do not show this again for</span>
      <select id="hb-update-suppress-days">
        <option value="1">1</option>
        <option value="7" selected>7</option>
        <option value="30">30</option>
        <option value="90">90</option>
      </select>
      <span>days</span>
    </label>
  `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // --- Elements ---
        const updateBtn = modal.querySelector("#hb-update-now");
        const cancelBtn = modal.querySelector("#hb-update-cancel");
        const progressEl = modal.querySelector("#hb-update-progress");
        const suppressCbx = modal.querySelector("#hb-update-suppress-checkbox");
        const suppressDays = modal.querySelector("#hb-update-suppress-days");

        // Store reference to modal for external status updates
        window.hbUpdateModal = { progressEl, overlay, style, modal, updateBtn, cancelBtn };

        // --- Behavior ---
        updateBtn.addEventListener("click", async () => {
            console.log(UPDATE_LOG_TAG, "Update Now clicked");
            updateBtn.disabled = true;
            cancelBtn.disabled = true;
            progressEl.textContent = "Starting database update...";

            try {
                // Clear existing data to force fresh download
                clearAllData();
                data = getData();
                currentActorTotal = 0;

                // Trigger the actual update
                const result = await getAllActors();

                // Update completed successfully
                const total = getTotalActors();
                progressEl.textContent = `✅ Update complete! Total performers: ${total}`;
                console.log(UPDATE_LOG_TAG, `Update successful. Total: ${total}`);

                // Update version to current
                setCurrentVersion();

                // Update status area if visible
                if (statusArea) {
                    statusArea.setTotalActors();
                    statusArea.updateDaysToRefreshActors();
                }

                // Enable cancel button (which now acts as "Close")
                cancelBtn.disabled = false;
                cancelBtn.textContent = "Close";

            } catch (error) {
                console.error(UPDATE_LOG_TAG, "Update failed:", error);
                progressEl.textContent = `❌ Update failed: ${error}. You can close and try again later.`;
                cancelBtn.disabled = false;
                cancelBtn.textContent = "Close";
            }
        });

        cancelBtn.addEventListener("click", () => {
            console.log(UPDATE_LOG_TAG, "Cancel/Close clicked");

            // Save suppression preference if checked
            if (suppressCbx.checked) {
                const days = parseInt(suppressDays.value, 10);
                setUpdatePopupSuppressionDays(days);
                console.log(UPDATE_LOG_TAG, `Suppressing popup for ${days} days`);
            }

            // Close modal
            overlay.remove();
            style.remove();
            delete window.hbUpdateModal;
        });
    }


    /** If GM_xmlhttpRequest supports partitioning, attach it */
    function setCookiePartitionIfSupported(opts) {
        try {
            opts.cookiePartition = PARTITION_KEY;
        } catch (e) {
            if (HB_isDebug()) console.warn("[HB] cookiePartition not supported or failed to set:", e);
        }
    }

    /** Check if captcha popup is already open */
    const isCaptchaPopupOpen = () => {
        return !!document.querySelector('#hb-modal-overlay');
    };

    /** Show captcha popup only if not already open and not suppressed */
    const showCaptchaPopupIfNeeded = (statusCode) => {
        if (!isCaptchaPopupOpen() && !shouldSuppressPopup()) {
            showCaptchaPopup(statusCode);
        }
    };

    /** Notify user to open BP and complete Cloudflare Turnstile */
    function notifyNeedsAuth() {
        const text =
              "babepedia requires human verification (Cloudflare). Click to open babepedia, complete the check, then return and refresh.";
        if (typeof GM_notification === "function") {
            GM_notification({
                text,
                title: "babepedia – human interaction required",
                timeout: 10000,
                onclick: () =>
                GM_openInTab ? GM_openInTab(TARGET_BP_URL, { active: true })
                : window.open(TARGET_BP_URL, "_blank"),
            });
        } else {
            if (confirm(text + "\n\nOpen babepedia now?")) {
                (GM_openInTab ? GM_openInTab(TARGET_BP_URL, { active: true })
                 : window.open(TARGET_BP_URL, "_blank"));
            }
        }
    }

    /** Check BP home with cookies; return true if 200 */

    function checkSiteReachable() {
        return new Promise((resolve) => {
            const xhrOptions = {
                method: "GET",
                url: `${TARGET_BP_URL}/`,
                anonymous: false, // MUST send cookies
                headers: {
                    "Accept": "text/html,application/xhtml+xml",
                    "User-Agent": navigator.userAgent,
                },
                onload: (resp) => {
                    cfDebug("Reachability", { status: resp.status, url: `${TARGET_BP_URL}/` });
                    if (resp.status === 200) {
                        cfDebug("✅ ${TARGET_BP_URL} returned 200.");
                        resolve(true);
                    } else {
                        console.warn(`[HB-CF] Non-200 from ${TARGET_BP_URL} (checkSiteReachable):`, resp.status, `${TARGET_BP_URL}/`);
                        showCaptchaPopupIfNeeded(resp.status);
                        notifyNeedsAuth();
                        try { GM_openInTab(TARGET_BP_URL, { active: true }); } catch {}
                        resolve(false);
                    }
                },
                onerror: (err) => {
                    cfDebug("Network error:", err);
                    notifyNeedsAuth();
                    try { GM_openInTab(TARGET_BP_URL, { active: true }); } catch {}
                    resolve(false);
                },
            };
            setCookiePartitionIfSupported(xhrOptions);
            HB_logRequest(HB_detectRequestType(xhrOptions.url), xhrOptions.url);
            GM_xmlhttpRequest(xhrOptions);
        });
    }


    /** Quick connectivity check with console logging */
    function logBabepediaStatus() {
        const xhrOptions = {
            method: "HEAD",
            url: `${TARGET_BP_URL}/`,
            anonymous: false,
            headers: {
                "User-Agent": navigator.userAgent,
            },
            onload: (resp) => {
                if (resp.status === 200) {
                    console.log(`[HB] - ✅${TARGET_BP_URL} is available - Status = ${resp.status} (200)`);
                } else {
                    console.warn(`[HB] - ⚠️${TARGET_BP_URL} is not available - Status = ${resp.status} (${resp.status})`);
                }
            },
            onerror: () => {
                console.warn(`[HB] - ⚠️${TARGET_BP_URL} is not available - Status = Network Error (Network)`);
            },
        };
        setCookiePartitionIfSupported(xhrOptions);
        GM_xmlhttpRequest(xhrOptions);
    }

    /** Ensure cookie is usable; opens site for verification if not */
    async function ensureBPCookie() {
        const ok = await checkSiteReachable();
        if (!ok) notifyNeedsAuth();
        return ok;
    }

    // Backoff handling for 429 responses: timestamp until which requests should wait
    let HB_backoffUntil = 0;

    const HB_getBackoffDelay = () => {
        const now = Date.now();
        return HB_backoffUntil > now ? HB_backoffUntil - now : 0;
    };

    const HB_setBackoff = (ms = 10000, url) => {
        HB_backoffUntil = Date.now() + ms;
        HB_logRequest('429 received... pausing 10 seconds', url, `paused ${ms}ms`);
    };

    // Prefetch queue system for sequential requests
    let prefetchQueue = [];
    let prefetchQueueInProgress = false;
    let prefetchSettings = {
        delayMs: 3000,
        maxRetries: 3
    };

    // Prevent multiple prefetch initializations
    let prefetchInitialized = false;

    const processPrefetchQueue = () => {
        if (prefetchQueueInProgress || prefetchQueue.length === 0) {
            return;
        }

        prefetchQueueInProgress = true;
        const item = prefetchQueue.shift();

        setStatus(`Prefetching bio for ${item.name} (${item.index + 1} of ${item.total})...`);

        prefetchSingleBio(item.name, item.index, item.total, () => {
            prefetchQueueInProgress = false;

            if (prefetchQueue.length > 0) {
                // Wait for the configured delay before processing next item
                setTimeout(() => {
                    processPrefetchQueue();
                }, prefetchSettings.delayMs);
            } else {
                // Queue is empty, show final status and log completion
                const totalProcessed = item.total;
                HB_logRequest('Prefetch Complete', null, `Processed ${totalProcessed} actors`);
                showFinalPrefetchStatus();
            }
        });
    };

    const addToPrefetchQueue = (name, index, total) => {
        prefetchQueue.push({ name, index, total });
    };

    const clearPrefetchQueue = () => {
        prefetchQueue = [];
        prefetchQueueInProgress = false;
    };

    /** Wrapper to call GM_xhr with partition + normalized site URL */
    function cfAwareRequest(opts) {
        // If we're currently in a backoff window, delay this request until it's over.
        const existingDelay = HB_getBackoffDelay();
        if (existingDelay > 0) {
            runDelayedFunc(() => cfAwareRequest(opts), existingDelay);
            return;
        }
        const isbabepedia = /babepedia\.com/i.test(opts.url);
        const merged = { ...opts };

        if (isbabepedia) {
            merged.anonymous = false; // make sure cookies are sent
            merged.headers = {
                ...(merged.headers || {}),
                Referer: TARGET_BP_URL,
                Host: TARGET_BP_HOST,
                "User-Agent": navigator.userAgent,
            };
            setCookiePartitionIfSupported(merged);

            // Add a standard status check + warn
            const userOnload = merged.onload;
            merged.onload = (resp) => {
                if (resp.status === 429) {
                    // Set a global backoff so other requests wait behind this timeout
                    HB_setBackoff(10000, merged.url);
                    // Retry this request after the backoff period - nothing should happen for 10 seconds
                    runDelayedFunc(() => cfAwareRequest(opts), 10000);
                    return;
                }

                if (resp.status !== 200 && resp.status !== 403) {
                    console.warn(`${CF_DEBUG_TAG} Non-200 from ${TARGET_BP_HOST} (cfAwareRequest):`, resp.status, merged.url);
                    showCaptchaPopup(resp.status);
                }
                userOnload && userOnload(resp);
            };
        }

        // Log this outgoing request when debug enabled
        HB_logRequest(HB_detectRequestType(merged.url), merged.url);
        GM_xmlhttpRequest(merged);
    }


    // GM data.
    let data = {};
    let statusArea;

    // Check if Babepedia is returning good response.

    async function isbabepediaOK() {
        return ensureBPCookie(); // returns true when 200, false otherwise
    }


    const sortCacheEntries = (arr) =>
    arr.sort((a, b) => {
        if (a.timeDiff > b.timeDiff) {
            return 1;
        }

        if (a.timeDiff < b.timeDiff) {
            return -1;
        }

        return 0;
    });

    const getNameFromUri = (uri) => decodeURI(uri).split("/").at(-1).split(".")[0];

    // Image caching - utilize both session and local storage.
    // Tags - always cache to localStorage
    // Images - cache in both session and localStorage with fallback strategy:
    //   1. Try sessionStorage first (faster access)
    //   2. If sessionStorage is full → fallback to localStorage
    //   3. If localStorage is also full → purge oldest images from localStorage until space available
    //   4. Purging only removes image entries (jpg/png/webp/avif/gif), preserving other data
    //   5. Images are evicted in localStorage iteration order (oldest keys first)
    //   6. Process continues until the new image can be stored or all image entries are exhausted
    const cacheEntryInBrowserStorage = (key, val) => {
        const storageType = key.includes(".jpg") ? "sessionStorage" : "localStorage";

        try {
            // cache img
            if (storageType === "sessionStorage") {
                setStatus?.(`Caching image for ${getNameFromUri(key)}`);
                sessionStorage.setItem(key, val);
                return;
            }

            // otherwise, store in localStorage
            localStorage.setItem(key, val);
            return;
        } catch (e) {
            // If sessionStorage is full → try localStorage
            if (storageType === "sessionStorage") {
                try {
                    localStorage.setItem(key, val);
                    return;
                } catch {
                    // fallthrough to purge below
                }
            }

            // LocalStorage is full → purge until it fits
            const success = removeOldestImageFromLocalStorage(key, val);
            if (!success) {
                console.warn(
                    `cacheEntryInBrowserStorage: Could not store key=${key}, storage is full.`,
                );
            }
        }
    };

    // Helper: estimate size of a key+value pair (2 bytes per char)
    const getEntrySize = (key, value) => {
        const v = value == null ? "" : value;
        return (key.length + v.length) * 2;
    };

    /**
 * Purge oldest image entries from localStorage until 'requiredKey' can be stored.
 * Returns true on success, false if unable to free enough space.
 *
 * Only considers keys that look like image cache keys (jpg/png/webp/avif/gif).
 */
    const removeOldestImageFromLocalStorage = (requiredKey, requiredVal) => {
        // Try one final attempt before doing any removals (fast path)
        try {
            localStorage.setItem(requiredKey, requiredVal);
            return true;
        } catch (e) {
            // continue to eviction
        }

        // Collect image keys (in localStorage iteration order) and their sizes
        const imageKeyRegex = /\.(jpe?g|png|gif|webp|avif)(?:[?#].*)?$/i;
        const entries = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (!imageKeyRegex.test(k)) continue; // only evict image-like keys
            const v = localStorage.getItem(k) || "";
            entries.push({ key: k, size: getEntrySize(k, v) });
        }

        if (entries.length === 0) {
            // Nothing safe to remove
            console.warn(
                "removeOldestImageFromLocalStorage: no image entries to evict",
            );
            return false;
        }

        // Evict entries one-by-one (oldest first = iteration order)
        while (entries.length > 0) {
            const oldest = entries.shift();
            try {
                localStorage.removeItem(oldest.key);
            } catch (err) {
                console.warn("Failed removing key during eviction:", oldest.key, err);
                // continue trying other keys
            }

            // After each eviction try to store the required item
            try {
                localStorage.setItem(requiredKey, requiredVal);
                console.log(`Evicted ${oldest.key} and stored ${requiredKey}`);
                return true;
            } catch (err) {
                // still full - continue loop and evict next
            }
        }

        // As a last resort, attempt once more (in case other keys freed or race)
        try {
            localStorage.setItem(requiredKey, requiredVal);
            return true;
        } catch (err) {
            console.warn(
                `removeOldestImageFromLocalStorage: could not free enough space for ${requiredKey}`,
            );
            return false;
        }
    };

    const saveTagCache = (type, set) => {
        const key = type === "hits" ? "hb-tag-hits" : "excludedTagNames";
        if (set) {
            // Tags always cache to localStorage
            cacheEntryInBrowserStorage(key, JSON.stringify([...set]));
        }
    };

    const setStatus = (msg) => {
        // Update the status area in lower-right if present
        if (statusArea) {
            statusArea.setStatus(msg);
        }

        // ALSO update the update popup if it's open
        if (window.hbUpdateModal?.progressEl) {
            window.hbUpdateModal.progressEl.textContent = msg;
        }
    };

    const getData = () => {
        const data = GM_getValue("hoverbabe-data");
        if (data) {
            // convert actorNames.names back to Set.
            const o = JSON.parse(data);
            o.actorNames.names = new Set(JSON.parse(o.actorNames.names));
            return o;
        }

        return {
            actorNames: {
                names: new Set(),
                time: undefined,
            },
            pages: {},
        };
    };
    const saveData = (dataObj) => {
        // Convert actorNames.names to array first
        dataObj.actorNames.names = JSON.stringify([...dataObj.actorNames.names]);
        GM_setValue("hoverbabe-data", JSON.stringify(dataObj));
        data = getData();
    };
    const clearAllData = () => GM_deleteValue("hoverbabe-data");

    // XRT141 - Case Normalization (Lowercase)
    const getAllAliases = (settings) => {
        const { optionAliases } = settings || {};
        if (optionAliases) {
            return Object.values(optionAliases).flat().map((v) => v.trim().toLowerCase());
        }
        return [];
    };
    // XRT141 - End

    const runDelayedFunc = (f, n) => {
        window.setTimeout(f, n);
    };

    const getStorageStats = (type) => {
        let x;
        let total = 0;

        const thisStorage = window[type];
        for (x in thisStorage) {
            if (Object.hasOwn(thisStorage, x)) {
                total += thisStorage[x].length * 2;
            }
        }
        return parseFloat((total / 1024).toFixed(2));
    };

    const stringToHTML = (str) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(str, "text/html");
        return doc.body;
    };

    /**
 * Excluded tags stored in localStorage.
 * Clean if >= 20% of localStorage. This likely wouldn't be hit before the
 * monthly actor reset. This runs when the actor reset runs.
 */
    const cleanTagCaches = (force = false) => {
        const storageSize = 10000;
        const max = 0.2 * storageSize;
        const localStorageStats = getStorageStats("localStorage");
        // console.log(
        //   `Current localStorage size: ${localStorageStats}KB, max ${max}KB`
        // );
        if (force || localStorageStats >= max) {
            setStatus("Cleaning excluded tag cache.");
            localStorage.removeItem("excludedTagNames");
            localStorage.removeItem("hb-tag-hits");
        }
    };

    let currentActorTotal = 0;


    const xmlHttpPromiseBP = (config) =>
    new Promise((resolve, reject) => {
        window.setTimeout(() => {
            cfAwareRequest({
                method: "GET",
                url: config.url,
                headers: {
                    Referer: TARGET_BP_URL,
                    Host: TARGET_BP_HOST,
                    "User-Agent": "Mozilla/5.0 ...",
                },
                onload: (responseObject) => {
                        // Temporarily force 403 for testing
                    // (status warning handled by wrapper)
                    const allActorsFromPage = getAllActorsNamesFromIndexPage(responseObject);
                    currentActorTotal += allActorsFromPage.size;

                    // Update status area if present
                    if (statusArea) {
                        statusArea.setTotalActors(currentActorTotal);
                    }

                    // ALSO update popup if open
                    if (window.hbUpdateModal?.progressEl) {
                        window.hbUpdateModal.progressEl.textContent =
                            `⏳ Downloading performers... Letter: ${config.letter.toUpperCase()} | Total so far: ${currentActorTotal}`;
                    }

                    resolve(responseObject);
                },
                onerror: () => reject("onerror"),
                onabort: () => reject("abort"),
                onprogress: () => {
                    setStatus?.(`⏳ Downloading all performers, current letter: ${config.letter}. (This only runs once a month)`);
                },
            });
        }, config.delay);
    });


    const nameToTag = (name) => name.toLowerCase().split(" ").join(".");

    const getAllActorsNamesFromIndexPage = (responseObject) => {
        const knownNonActorTags = ["royalty", "softcore", "lesbian.threesome"];
        const html = responseObject.responseText;
        const dom = stringToHTML(html);
        const names = Array.from(dom.querySelectorAll('#content a[href*="babe"]'))
        .map((anchor) => {
            const nameLower = anchor.innerText.toLowerCase();
            const nameClean = nameLower.replace(/['-]/g, "");
            return nameClean.replace(/\s+/g, ".");
        })
        .filter((name) => !knownNonActorTags.includes(nameToTag(name))); // filter out known non-actors
        return new Set(names);
    };

    const calculateRemainingDaysToRefreshActors = () => {
        const now = new Date();
        if (data.actorNames) {
            const lastDownloadedTime = data.actorNames.time;
            return (
                (lastDownloadedTime + oneMonth - now.getTime()) /
                (60 * 60 * 24 * 1000)
            ).toFixed(0);
        }
        return 0;
    };

    const getAllActors = () => {
        const now = new Date();
        const nowTime = now.getTime();

        if (data?.actorNames && data.actorNames.names.size > 0) {
            const actorsLastCacheTime = data.actorNames.time;
            if (nowTime - actorsLastCacheTime <= oneMonth) {
                return Promise.resolve("cache current");
            }
        }

        // Clean the excluded tags cache. This is so newly available actors can
        // get off of the excluded list.
        cleanTagCaches(true);

        const letters = [
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "g",
            "h",
            "i",
            "j",
            "k",
            "l",
            "m",
            "n",
            "o",
            "p",
            "q",
            "r",
            "s",
            "t",
            "u",
            "v",
            "w",
            "x",
            "y",
            "z",
        ];

        const promises = [];
        letters.forEach((letter, i) => {
            promises.push(
                xmlHttpPromiseBP({
                    url: `${TARGET_BP_URL}/index/${letter}`,
                    referer: "${TARGET_BP_URL}",
                    host: "${TARGET_BP_HOST}",
                    delay: i * 2000,
                    letter,
                }),
            );
        });

        // Cache all actors after all responses come back.
        let allActorNames = new Set();
        return Promise.all(promises).then((responseObjects) => {
            responseObjects.forEach((responseObject) => {
                const names = getAllActorsNamesFromIndexPage(responseObject);
                allActorNames = new Set([...allActorNames, ...names]);
                data.actorNames = {
                    names: allActorNames,
                    time: now.getTime(),
                };
                saveData(data);
            });
            // Set total
            if (statusArea) {
                statusArea.setTotalActors();
            }
            return responseObjects;
        });
    };

    const getAllActorNamesFromCache = () => data.actorNames.names;

    const capitalizeFirst = (string) =>
    `${string.charAt(0).toUpperCase()}${string.slice(1)}`;

    const tagToName = (tag) => {
        if (tag.includes("📸")) {
            // Remove icon if it exists
            tag = tag.substring(2);
        }
        const names = tag.split(".");
        if (names.length === 3) {
            return [
                capitalizeFirst(names[0]),
                capitalizeFirst(names[1]),
                capitalizeFirst(names[2]),
            ].join(" ");
        }
        if (names.length === 2) {
            return [capitalizeFirst(names[0]), capitalizeFirst(names[1])].join(" ");
        }
        return capitalizeFirst(names[0]);
    };

    const createBioContainer = (
        name,
        bioImage,
        bioData,
        aboutEl,
        performerLinks,
    ) => {
        // width is handled by CSS (min/max/auto) now
        let top;
        let left;

        const template = `
  <style>
    /* Layout: use a two-row grid so external-links is anchored to the bottom. */
    /* The inner grid needs to be able to scroll inside the container. We use flex layout
       on the container so the container can shrink to fit content while enforcing a
       max-height. The inner grid is a flex child that can grow/shrink and provide
       its own scrolling when content is larger than the available space. */
    div#hoverbabe-inner {
      display: grid;
      gap: 8px;
      padding: 5px;
      align-items: start;
      box-sizing: border-box;
      /* allow the inner area to flex inside the container and scroll when needed */
      flex: 1 1 auto;
      min-height: 0; /* required so the flex child can shrink and allow overflow to work */
      overflow: auto;
    }

    /* Default grid layout with all sections enabled */
    .dynamic-grid {
      grid-template-areas: "bioimage biodata biotext" "external-links external-links external-links";
      grid-template-columns: 1fr 2fr 2fr; /* Allocate proportional space to each column */
      grid-template-rows: 1fr auto;
    }

    /* Layout when biotext is disabled */
    .dynamic-grid.no-biotext {
      grid-template-areas: "bioimage biodata" "external-links external-links";
      grid-template-columns: auto 1fr;
    }

    /* Layout when biodata is disabled */
    .dynamic-grid.no-biodata {
      grid-template-areas: "bioimage biotext" "external-links external-links";
      grid-template-columns: auto 1fr;
    }

    /* Layout when bioimage is disabled */
    .dynamic-grid.no-bioimage {
      grid-template-areas: "biodata biotext" "external-links external-links";
      grid-template-columns: 1fr 1fr;
    }

    /* Layout when only one section is enabled */
    .dynamic-grid.only-bioimage {
      grid-template-areas: "bioimage" "external-links";
      grid-template-columns: 1fr;
    }
    .dynamic-grid.only-biodata {
      grid-template-areas: "biodata" "external-links";
      grid-template-columns: 1fr;
    }
    .dynamic-grid.only-biotext {
      grid-template-areas: "biotext" "external-links";
      grid-template-columns: 1fr;
    }

    div#hoverbabe-container  {
      position: fixed;
      /* positioning (left/top) is set at runtime so don't inject undefined values here */
      background-color: rgba(0, 0, 0, 0.9);
      padding: 10px;
      border: solid #333 1px;
      border-radius: 5px;
      font-size: inherit;
      color: #ccc;
      z-index: 100;
      box-sizing: border-box;
      /* Use viewport-relative sizing requested by user */
      width: 75vw;
      max-width: 1000px;
      min-width: 400px;
      /* Allow the container to size to content but cap it at 70vh */
      max-height: 70vh;
      height: auto;
      display: flex;
      flex-direction: column;
      overflow: auto; /* allow inner content to scroll within the container */
    }

    /* Make images responsive within the image column without changing visual style */
    div#hoverbabe-container img {
      width: 100%;
      max-width: 230px; /* preserve previous visual constraint */
      height: auto;
      display: block;
      border-radius: 5px;
    }

    /* External links row lives in the bottom grid row and should have a small gap above it. */
    div#external-links {
      grid-area: external-links;
      margin-top: 6px;
      align-self: end;
    }

#external-links a, #biotext a{
  color: #66b3ff;        /* light blue */
  text-decoration: none; /* optional: remove underline */
}

#external-links a:hover, #biotext a:hover {
  color: #ffffff;        /* white on hover */
}

#external-links a:visited, #biotext a:visited{
  color: #c28bff;        /* light purple */
}


    /* Make the three columns flow and scroll independently when content is large. Preserve previous paddings/backgrounds. */
    div#bioimage {
      grid-area: bioimage;
      overflow: auto; /* allow image column to scroll if needed */
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }

    div#biodata {
      grid-area: biodata;
      padding: 0 3px;
      overflow: auto; /* scroll independently */
      max-height: none; /* rely on grid row sizing */
      width: auto;
      box-sizing: border-box;
      max-height: 100%;
    }

    div#biotext {
      grid-area: biotext;
      overflow: auto; /* scroll independently */
      padding-right: 5px;
      box-sizing: border-box;
      max-height: 100%;
    }

    .hb-reset {
      margin: 0;
      padding: 0;
      border: 0;
      vertical-align: baseline;
    }

    div#hoverbabe-container .label {
      background-color: inherit;
    }

    div#hoverbabe-container h1 {
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 1.5em;
      font-weight: bold;
      vertical-align: baseline;
      display: inline-block;
    }

    div#hoverbabe-container h2 {
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 1.4em;
      vertical-align: baseline;
      text-align: left;
      color: inherit;
      background-color: inherit;
      border: none !important;
      background: none;
      box-shadow: none;
      border-radius: 0;
    }

    div#biotext h2 {
       margin: 0 0 0 3px;
    }

    div#hoverbabe-container li {
      font: inherit;
      text-align: left;
      list-style: none;
      list-style-position: inherit;
    }

    div#hoverbabe-container span {
      margin: 0;
      padding: 0;
      border: 0;
      font-size: inherit;
      vertical-align: baseline;
      line-height: 1.3em;
    }

    div#hoverbabe-container span {
      margin-left: 0
      margin-right: 0
      padding: 0
    }


    div#hoverbabe-container #bioarea {

    }

    div#hoverbabe-container #tattoo-text-span {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      width: 160px;
      margin: 0 0 2px 2px;
      vertical-align: middle;
      display: inline-block;
    }

    div#hoverbabe-container #tattoo-text-span:hover {
      cursor: help;
    }

    div#close-hb {
      float: right;
      border-radius: 5px;
      height: 20px;
      font-size: 16px;
      margin: 0;
    }

    div#close-hb:hover{
      cursor:pointer;
      border-radius: 5px;
      height: 20px;
      color: #eee;
    }

    #hb-title {
      margin-bottom: 5px;
    }

    #babename {
      background-color: #222;
      border-radius: 5px;
      text-align: center;
      width: 95%;
    }

    #iafd-link {
      display: inline-block;
    }

    .hb-more-of {
      display: inline-block;
      padding-right: 5px;
    }

    .info-title {
      border-bottom: 1px solid #ccc;
      font-weight: bold;
      margin-bottom: 3px;
    }
  #similar-performers {
    display: block;
  }

  </style>

  <div id="hb-title">
    <h1 id='bioname'></h1>
    <div id="close-hb">❌</div>
  </div>

  <div id='hoverbabe-inner' class='dynamic-grid'>
    <div id='bioimage' class='col'></div>
    <div id='biodata' class='col'></div>
    <div id='biotext' class='col'>
      <h2>About ${name}</h2>
    </div>
    <div id='external-links'>
      <span id='links-list'><b>Links</b>: </span>
      <span id='similar-performers'><b>If you like <span id='similar-performers-first-name'></span></b>: </span>
<!--       <span id='similar-performers'><b>Similar Performers</b>: </span> -->
    </div>
  </div>
  `;

        const div = document.createElement("div");
        div.id = "hoverbabe-container";
        div.innerHTML = template;

        // Apply reset class to elements that need it
        div.querySelectorAll("h1, h2, li, span").forEach(el => {
            if (el.closest("#hoverbabe-container")) el.classList.add("hb-reset");
        });

        if (bioImage) {
            bioImage.style.borderRadius = "5px";
            div.querySelector("#bioimage").append(bioImage);
        } else {
            const span = document.createElement("span");
            span.innerText = "No image available.";
            div.querySelector("#bioimage").append(span);
        }

        const bioArea = div.querySelector("#biodata");

        bioArea.append(bioData);

        // About width (depends on if About content present)
        const aboutArea = div.querySelector("#biotext");
        // width is now controlled by CSS (min-width/max-width). No JS pixel-assignment.

        if (aboutEl?.innerText) {
            aboutArea.append(aboutEl);
        } else {
            aboutArea.remove();
        }

        // Adjust grid classes: if the biotext column is missing or empty, switch to a two-column layout
        // so biodata receives the remaining space instead of sharing with a (now-empty) biotext column.
        const innerGrid = div.querySelector("#hoverbabe-inner");
        const hasBiotext = !!div.querySelector("#biotext");
        if (!hasBiotext) {
            innerGrid.classList.add("no-biotext");
            // remove any other layout classes that could conflict
            innerGrid.classList.remove("no-biodata", "no-bioimage", "only-bioimage", "only-biodata", "only-biotext");
        } else {
            // ensure base state when biotext exists
            innerGrid.classList.remove("no-biotext", "no-biodata", "no-bioimage", "only-bioimage", "only-biodata", "only-biotext");
        }

        // Links
        if (performerLinks.length) {
            const linksTitle = document.createElement("h2");
            linksTitle.innerHTML = `${name} Links`;
            aboutArea.append(linksTitle);
            const linksSearchEl = document.createElement("input");
            linksSearchEl.type = "text";
            linksSearchEl.placeholder = "Type to search links";
            linksSearchEl.addEventListener("keyup", (e) => {
                performerLinks.forEach((linkEl) => {
                    if (
                        linkEl.innerText.toLowerCase().includes(e.target.value.toLowerCase())
                    ) {
                        linkEl.hidden = false;
                        linkEl.nextSibling.hidden = false;
                    } else {
                        linkEl.hidden = true;
                        linkEl.nextSibling.hidden = true;
                    }
                });
            });
            aboutArea.append(linksSearchEl);

            const linksArea = document.createElement("p");
            linksArea.style.minHeight = "300px"; // prevent shifting

            performerLinks.forEach((linkEl) => {
                const sep = document.createElement("span");
                sep.innerText = " • ";

                // anonymize
                linkEl.href = `http://anonym.es/?${linkEl.href}`;
                linkEl.target = "_blank";
                linkEl.rel = "noreferrer";
                linksArea.append(linkEl);
                linksArea.append(sep);
            });
            aboutArea.append(linksArea);
        }

        // Move actor name to top of dialog
        const nameEl = div.querySelector("#bioname");
        nameEl.innerText = name;

        // close
        div.querySelector("#close-hb").addEventListener("click", () => {
            div.remove();
        });

        return div;
    };

    /**
 * Try to get image from session/local storage.
 * @param {String} imgSrc
 */
    const getImageFromCache = (imgSrc) => {
        const cachedImageData = sessionStorage.getItem(imgSrc);
        if (cachedImageData) {
            return cachedImageData;
        }
        return localStorage.getItem(imgSrc);
    };

    const getBioImage = (name, imgSrc, cb) => {
        const cachedImageData = getImageFromCache(imgSrc);

        if (cachedImageData) {
            const cachedImageObject = JSON.parse(cachedImageData);
            const cachedImage = cachedImageObject.image;

            // console.log(`Getting cached image for ${name}: ${imgSrc}`);
            statusArea.setStatus(`Getting cached image for ${name}`);

            const img = document.createElement("img");
            img.src = cachedImage;
            return cb(img);
        }

        // No image available
        if (imgSrc.includes("javascript")) {
            return cb(null);
        }


        cfAwareRequest({
            method: "GET",
            url: `${TARGET_BP_URL}${imgSrc}`,
            headers: {
                Referer: TARGET_BP_URL,
                Host: TARGET_BP_HOST,
                "User-Agent": "Mozilla/5.0 ...",
            },
            responseType: "blob",
            onload: (data) => {
                const img = document.createElement("img");
                data.response.text().then(() => {
                    const reader = new FileReader();
                    reader.readAsDataURL(data.response);
                    reader.onloadend = () => {
                        const base64data = reader.result;
                        img.src = base64data;
                        const now = new Date();
                        cacheEntryInBrowserStorage(
                            imgSrc,
                            JSON.stringify({ time: now.getTime(), image: base64data })
                        );
                        cb(img);
                    };
                });
            },
        });

    };

    const insertAfter = (newNode, existingNode) =>
    existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling);

    const findEl = (dom, parentSelector, text) => {
        const res = Array.from(dom.querySelector(parentSelector).children).filter(
            (node) => node.innerText.includes(text),
        );
        if (res) {
            return res[0];
        }
    };

    const createBioEntry = (name, value) => {
        const div = document.createElement("div");
        div.className = "info-item";
        const sp1 = document.createElement("span");
        sp1.className = "label";
        const sp2 = document.createElement("span");
        sp2.className = "value";

        sp1.innerText = `${name}: `;
        sp2.innerText = value;
        div.append(sp1);
        div.append(sp2);
        return div;
    };

    const addDebutInfo = (bioDom) => {
        const target = findEl(bioDom, ".info-grid", "Age:");
        if (target) {
            const birthYearEl = bioDom.querySelector("a[href*=born]");
            let birthYear;
            if (birthYearEl) {
                birthYear = birthYearEl.innerText;
            }
            const debutYearEl = Array.from(
                bioDom.querySelectorAll(".info-item"),
            ).filter((el) => el.innerText.includes("active"));
            if (debutYearEl && debutYearEl.length === 1 && birthYear) {
                const debutYear = Array.from(bioDom.querySelectorAll(".info-item"))
                .filter((el) => el.innerText.includes("active"))
                .map((el) => el.innerText.split(":")[1].split("-")[0].trim())[0];
                const debutAge = debutYear * 1 - birthYear * 1;

                // add to bioDom
                const debutAgeEl = createBioEntry("Debut Age", debutAge);
                const debutYearEl = createBioEntry("Debut Year", debutYear);

                insertAfter(debutAgeEl, target);
                insertAfter(debutYearEl, debutAgeEl);
            }
        }
    };

    const cleanUpDom = (bioDom) => {
        addDebutInfo(bioDom);

        // Remove links in bio section.
        const allBioLinks = Array.from(
            bioDom.querySelectorAll("#personal-info-block a"),
        );

        allBioLinks.forEach((link) => {
            const textNode = document.createTextNode(link.textContent);
            link.parentNode.replaceChild(textNode, link);
        });

        // Remove any inline styles from values
        const els = bioDom.querySelectorAll("div.info-item .value");

        els.forEach((el) => {
            const { children } = el;
            if (children.length > 0) {
                Array.from(children).forEach((child) => {
                    child.removeAttribute("style");
                });
            }
        });

        const labelEls = Array.from(bioDom.querySelectorAll("div.info-item .label"));

        // birthdate formatting
        const bornLabelList = labelEls.filter((el) =>
                                              el.innerText.toLowerCase().includes("born"),
                                             );
        if (bornLabelList.length > 0) {
            const birthDateEl = bornLabelList[0].parentElement.children[1];
            const birthDateList = birthDateEl.textContent.split(" ");
            const birthDateText = `${birthDateList[3]} ${birthDateList[1]}, ${birthDateList[4]}`;
            birthDateEl.textContent = birthDateText;
        }

        // Age formatting
        const ageLabelList = labelEls.filter((el) =>
                                             el.innerText.toLowerCase().includes("age"),
                                            );
        if (ageLabelList.length > 0) {
            const ageEl = ageLabelList[0].nextElementSibling;
            ageEl.textContent = ` ${ageEl.textContent.split("years")[0].trim()}`;
        }

        // Debut age, year
        const debutAgeList = labelEls.filter((el) =>
                                             el.innerText.toLowerCase().includes("debut age"),
                                            );
        const debutYearList = labelEls.filter((el) =>
                                              el.innerText.toLowerCase().includes("debut year"),
                                             );

        if (debutAgeList.length > 0) {
            const parts = debutAgeList[0].innerText.split(":");
            const label = `${parts[0]}:`;
            const age = parts[1];
            debutAgeList[0].innerText = label;
            insertAfter(document.createTextNode(age), debutAgeList[0]);
        }

        if (debutYearList.length > 0) {
            const parts = debutYearList[0].innerText.split(":");
            const label = `${parts[0]}:`;
            const age = parts[1];
            debutYearList[0].innerText = label;
            insertAfter(document.createTextNode(age), debutYearList[0]);
        }

        // Aliases
        const akaEl = bioDom.parentElement.querySelector("#aka");
        if (akaEl) {
            const text = akaEl.textContent
            .split(":")[1]
            .split(/\s+-\s+/)
            .join(", ")
            .trim();
            const aliasEl = createBioEntry("Aliases", text);
            const target = bioDom.querySelectorAll(".info-item")[0];
            target.parentNode.insertBefore(aliasEl, target);
        }

        // Profession
        const professionEl = labelEls.find((el) =>
                                           el.innerText.toLowerCase().includes("profession"),
                                          );

        if (professionEl) {
            const professionElCloned = professionEl.cloneNode(true);
            const professionParent = professionEl.parentNode;
            const professionValues = Array.from(professionParent.children).slice(1);
            const professionText = professionValues.map((v) => v.innerText).join(", ");
            professionParent.innerHTML = "";
            const professionSpan = document.createElement("span");
            professionSpan.innerText = ` ${professionText}`;
            professionParent.append(professionElCloned);
            professionParent.append(professionSpan);
        }

        return bioDom;
    };

    const cleanPagesCache = () => {
        const oneWeek = 604800000;
        const now = new Date();

        if (data.pages) {
            Object.keys(data.pages).forEach((name) => {
                if (now.getTime() - data.pages[name].time > oneWeek) {
                    setStatus(`Deleting cached page for ${name}`);
                    delete data.pages[name];
                }
            });
        }
    };

    const clearAllBioCache = () => {
        if (data.pages) {
            const cacheCount = Object.keys(data.pages).length;
            data.pages = {};
            saveData(data);
            return cacheCount;
        }
        return 0;
    };

    const createOpenNewPageLink = (url, props, text) => {
        const a = document.createElement("a");

        Object.keys(props).forEach((key) => {
            a.setAttribute(key, props[key]);
        });

        a.innerHTML = text;

        a.style.cursor = "pointer";

        a.addEventListener("click", (e) => {
            e.preventDefault();
            window.open(url, "_blank");
        });
        return a;
    };

    const createIAFDLink = (url) =>
    createOpenNewPageLink(
        url,
        {
            id: "iafd-link",
        },
        `IAFD`,
    );

    function isCCuporGreater(performerData) {
        if (!performerData) return false;
        const braSize = performerData["Bra/cup size"];
        if (!braSize) {
            return false;
        }
        for (const char of braSize) {
            if (char >= "C" && char <= "Z") {
                return true;
            }
        }
        return false;
    }

    const displayBio = (name, pageDom, precacheOnly) => {
        const settings = getSettings();
        // biodata and bioimage are always fetched and displayed; settings to disable them were removed
        const shouldShowBioData = true;
        const shouldShowAboutSection = settings.optionShowAboutSection !== false;
        const shouldShowExternalLinks = settings.optionShowExternalLinks !== false;
        const shouldShowSimilarPerformers = settings.optionShowSimilarPerformers !== false;

        let updatedBioArea;
        const bioArea = pageDom.querySelector("#personal-info-block");
        let noDataBioEl;

        // May not be a bio area
        if (bioArea) {
            // Do some cleanup of dom
            if (!precacheOnly) {
                updatedBioArea = cleanUpDom(bioArea);
            }
        } else {
            // create a 'no data' for bioArea
            noDataBioEl = document.createElement("div");
            noDataBioEl.id = "no-data";
            noDataBioEl.innerText = "No Bio Data Available.";
        }

        // Put performer bio data in object
        const performerData = Array.from(
            bioArea?.querySelectorAll(".info-item:not(.info-title)"),
        ).reduce((prev, cur) => {
            prev[cur.children[0]?.innerText?.split(":")[0]] =
                cur.children[1]?.innerText;
            return prev;
        }, {});

        // Pass in the raw bio image src, cb will receive the imgDom with image blob;
        const bioImg = pageDom.querySelector("#profimg").querySelector("a");
        let bioImgSrc = bioImg.getAttribute("href");

        // If no primary image, get first user-uploaded image.
        if (bioImg.classList.contains("noimg")) {
            const userUploadsArea = pageDom.querySelector("div.useruploads2");
            if (userUploadsArea) {
                bioImgSrc = userUploadsArea.querySelector("a").getAttribute("href");
            }
        }

        // Get About section (only if enabled)
        let aboutEl = null;
        if (shouldShowAboutSection) {
            aboutEl = pageDom.querySelector("#biotext");
            // Remove unneeded sections
            aboutEl?.querySelector(".gallerybanner")?.remove();
        }

        // Get performer links (only if enabled)
        const performerLinks = shouldShowExternalLinks
            ? Array.from(pageDom.querySelectorAll(".outlink"))
            : [];

        // Get suggested performers (only if enabled)
        const similarPerformers = shouldShowSimilarPerformers
            ? Array.from(
                pageDom.querySelectorAll("div#morelikethumbs .thumbshot"),
            ).map((v) => v.textContent.trim())
            : [];

        // Get bio image and show
        if (hovered) {
            // Performer images are always fetched and shown when available

            const displayCallback = (img) => {
                if (hovered) {
                    hovered = false;
                    if (!precacheOnly) {
                        const target = document.querySelector(
                            "#details_top, #torrent_table, #content",
                        );

                        const bioContainer = createBioContainer(
                            name,
                            img,
                            updatedBioArea || noDataBioEl,
                            aboutEl,
                            performerLinks,
                        );

                        const iafdSpinner = document.createElement("div");
                        iafdSpinner.style.display = "inline-block";
                        iafdSpinner.id = "iafd-spinner";
                        iafdSpinner.innerText = "Getting IAFD link";

                        const externalLinksContainer =
                              bioContainer.querySelector("#links-list");

                        const similarPerformersContainer = bioContainer.querySelector(
                            "#similar-performers",
                        );

                        // Only show similar performers if enabled and there are results
                        if (shouldShowSimilarPerformers && similarPerformers.length > 0) {
                            const e = bioContainer.querySelector(
                                "#similar-performers-first-name",
                            );
                            e.textContent = name.split(" ")[0];
                            similarPerformers.forEach((performer, i) => {
                                const tag = nameToTag(performer);
                                const el = document.createElement("a");
                                el.href = `/torrents.php?taglist=${tag}`;
                                el.text = performer;
                                similarPerformersContainer.append(el);
                                if (i < similarPerformers.length - 1) {
                                    el.insertAdjacentText("afterend", ", ");
                                }
                            });
                        } else {
                            similarPerformersContainer.remove();
                        }

                        const tag = nameToTag(name);

                        // Only populate external links if enabled
                        if (shouldShowExternalLinks) {
                            // Add get more of link
                            externalLinksContainer.append(
                                getMoreOfLink(
                                    `/torrents.php?taglist=${nameToTag(name)}`,
                                    "empornium",
                                ),
                            );

                            externalLinksContainer.append(
                                getMoreOfLink(
                                    `http://anonym.es/?https://${TARGET_BP_HOST}/babe/${name.replace(
                                        " ",
                                        "_",
                                    )}`,
                                    "Babepedia",
                                ),
                            );



                            const TARGET_CUP_DESC = new URL(TARGET_CUP_URL).hostname.replace(/^www\./, "");
                            const TARGET_CUP_LABEL = TARGET_CUP_DESC.replace(/\.[^.]+$/, "");


                            if (isCCuporGreater(performerData)) {
                                externalLinksContainer.append(
                                    getMoreOfLink(
                                        `http://anonym.es/?${TARGET_CUP_URL}/boobs/${name.replace(" ", "_")}`,
                                        TARGET_CUP_LABEL
                                    )
                                );
                            }



                            // Try getting link from data.iafd in case that request came back earlier, otherwise add
                            // spinner.
                            if (data.iafd?.[tag]) {
                                const iafdLink = createIAFDLink(data.iafd[tag], tag);
                                externalLinksContainer.append(iafdLink);
                            } else {
                                setInterval(() => {
                                    iafdSpinner.append(".");
                                }, 1000);

                                externalLinksContainer.append(iafdSpinner);
                            }
                        } else {
                            // Hide the external links section completely
                            externalLinksContainer.parentElement.remove();
                        }

                        target.appendChild(bioContainer);
                        bioContainer.style.left = "40%";
                        bioContainer.style.top = "40%";
                        bioContainer.style.transform = "translate(-40%, -40%)";

                        // stop icon spinner
                        window.clearInterval(iconSpinnerIntervalHandle);

                        // add drag handling
                        const container = document.getElementById("hoverbabe-container");
                        const titleBar = document.getElementById("hb-title");

                        let offsetX = 0;
                        let offsetY = 0;
                        let isDragging = false;

                        titleBar.style.cursor = "move"; // visual cue for drag handle

                        titleBar.addEventListener("mousedown", (e) => {
                            isDragging = true;

                            const rect = container.getBoundingClientRect();

                            // Set absolute pixel position based on current visual position
                            container.style.left = `${rect.left}px`;
                            container.style.top = `${rect.top}px`;

                            // Remove transform so future moves are pixel-based with no offset jump
                            container.style.transform = "none";

                            offsetX = e.clientX - rect.left;
                            offsetY = e.clientY - rect.top;

                            document.addEventListener("mousemove", onMouseMove);
                            document.addEventListener("mouseup", onMouseUp);

                            e.preventDefault(); // prevent text selection
                        });

                        function onMouseMove(e) {
                            if (!isDragging) return;

                            const left = e.clientX - offsetX;
                            const top = e.clientY - offsetY;

                            container.style.left = `${left}px`;
                            container.style.top = `${top}px`;
                            container.style.right = "inherit"; // optional: override right if used elsewhere
                        }

                        function onMouseUp() {
                            isDragging = false;
                            document.removeEventListener("mousemove", onMouseMove);
                            document.removeEventListener("mouseup", onMouseUp);
                        }
                    }

                    // show indicator when precaching
                    if (precacheOnly) {
                        highlightTorrentTag(name);
                    }
                }
            };

            // Always fetch image (will return null if not available)
            getBioImage(name, bioImgSrc, displayCallback);
        }
    };

    const getMoreOfLink = (url, siteName) =>
    createOpenNewPageLink(
        url,
        {
            class: "hb-more-of",
        },
        siteName,
    );

    const getBioContainer = () => document.querySelector("#hoverbabe-container");

    const xmlHttpPromise = (config) =>
    new Promise((resolve, reject) => {
        window.setTimeout(() => {
            // Log request when debug enabled
            HB_logRequest(HB_detectRequestType(config.url), config.url);

            GM_xmlhttpRequest({
                headers: {
                    Referer: config.referer || TARGET_BP_URL,
                    Host: config.host || TARGET_BP_HOST,
                    "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.140 Safari/537.36",
                },
                url: config.url,
                onload: (responseObject) => resolve(responseObject),
                oneerror: () => reject("onerror"),
                onabort: () => reject("abort"),
            });
        }, config.delay);
    });

    const getIAFDLink = (actorTag) => {
        const actorSearchName = actorTag.replace(".", "+");

        // check cache
        if (data.iafd?.[actorTag]) {
            return Promise.resolve(createIAFDLink(data.iafd[actorTag], actorTag));
        }

        // Actor known not to be in IAFD
        if (data.iafd && data.iafd[actorTag] === null) {
            return Promise.resolve(null);
        }

        const p = xmlHttpPromise({
            url: `${TARGET_IAFD_URL}/results.asp?searchtype=comprehensive&searchstring=${actorSearchName}`,
            referer: `${TARGET_IAFD_URL}`,
            host: `${TARGET_IAFD_HOST}`,
        });

        return p.then((responseObject) => {
            const pageDom = stringToHTML(responseObject.response);
            const iafdLink = pageDom.querySelector("table#tblFem a");

            if (iafdLink) {
                const href = iafdLink.getAttribute("href");
                const url = `http://anonym.es/?https://www.iafd.com${href}`;
                const link = createIAFDLink(url, actorTag);

                // cache iafd url
                if (data.iafd) {
                    data.iafd[actorTag] = url;
                } else {
                    data.iafd = {
                        [actorTag]: url,
                    };
                }

                saveData(data);
                return link;
            }
            if (data.iafd) {
                data.iafd[actorTag] = null;
            } else {
                data.iafd = {
                    [actorTag]: null,
                };
            }
            saveData(data);
            return null;
        });
    };

    // XRT141 - Case Normalization (Lowercase)
    const getBPNameForAlias = (aliasName, settings) => {
        const aliasLowerTag = nameToTag(aliasName).toLowerCase();
        const { optionAliases } = settings || {};
        if (!optionAliases) return;

        // Find which BP tag owns this alias
        const bpTag = Object.keys(optionAliases).find((bp) =>
                                                      optionAliases[bp].includes(aliasLowerTag)
                                                     );
        return bpTag; // already lowercase bp tag like "jane.doe"
    };
    // XRT141 - End

    const prefetchSingleBio = (name, index, total, callback) => {
        // First, check any user-defined aliases for actor and convert to that.
        const allAliases = getAllAliases(settings);
        if (allAliases.includes(nameToTag(name))) {
            const BPTagName = getBPNameForAlias(name, settings);
            name = tagToName(BPTagName);
        }

        // Check cache first.
        if (data.pages?.[name]) {
            if (data.pages[name].response) {
                // Log cache hit during prefetching
                HB_logRequest(`Prefetch Cache Hit: ${name}`, null, 'Using cached bio data');
                callback();
                return;
            }
            // Cache indicates no bio available
            HB_logRequest(`Prefetch Cache Miss: ${name}`, null, 'No bio available (cached negative result)');
            callback();
            return;
        }

        const url = `${TARGET_BP_URL}/babe/${name.trim().replace(/\s+/g, "_")}`;

        cfAwareRequest({
            method: "GET",
            url: url,
            headers: {
                Referer: TARGET_BP_URL,
                Host: TARGET_BP_HOST,
                "User-Agent": "Mozilla/5.0 ...",
            },
            onload: (responseObject) => {
                const status = responseObject.status;

                if (status === 200) {
                    const pageDom = stringToHTML(responseObject.response);
                    if (pageDom) {
                        const bioAreaEl = pageDom.querySelector("#personal-info-block");
                        if (bioAreaEl) {
                            // cache + save
                            const now = new Date();
                            data.pages ??= {};
                            data.pages[name] = { response: responseObject.response, time: now.getTime() };
                            saveData(data);
                        } else {
                            // No bio found, cache the negative result
                            const now = new Date();
                            data.pages[name] = { responseObject: null, time: now.getTime() };
                        }
                    }
                } else if (status === 403) {
                    const msg = "HoverBabe temporarily down due to Cloudflare Turnstile (CAPTCHA) being enabled on " + TARGET_BP_HOST + ".";
                    setStatus("⚠️ " + msg);
                    showCaptchaPopupIfNeeded(403);
                } else if (status === 429) {
                    // 429 is handled by cfAwareRequest, callback will be called after retry
                    return;
                }

                callback();
            },
            onerror: (error) => {
                console.error(`HoverBabe: Error prefetching ${name}:`, error);
                callback();
            }
        });
    };

    const getPageBio = (name, precacheOnly) => {
        // First, check any user-defined aliases for actor and convert to that.
        const allAliases = getAllAliases(settings);
        if (allAliases.includes(nameToTag(name))) {
            const BPTagName = getBPNameForAlias(name, settings);

            setStatus(
                `User-defined alias exists:  ${tagToName(BPTagName)} -> ${name}. `,
            );
            name = tagToName(BPTagName);
        }

        // Check cache first.
        if (data.pages?.[name]) {
            if (data.pages[name].response) {
                // Log cache hit with grouped info
                if (HB_isDebug()) {
                    HB_logRequest(`Cache hit: ${name}`, null, 'Using cached bio data');
                }
                setStatus(`Getting page bio for ${name} from cache.`);

                const pageDom = stringToHTML(data.pages[name].response);
                displayBio(name, pageDom, precacheOnly);
                return;
            }
            setStatus(`Page bio unavailable for ${name}.`);
            return;
        }

        setStatus(`Getting page bio for ${name} from server...`);

        const now = new Date();


        cfAwareRequest({
            method: "GET",
            url: `${TARGET_BP_URL}/babe/${name.trim().replace(/\s+/g, "_")}`,
            headers: {
                Referer: TARGET_BP_URL,
                Host: TARGET_BP_HOST,
                "User-Agent": "Mozilla/5.0 ...",
            },
            onload: (responseObject) => {
                if (responseObject.status === 403) {
                    const msg = "HoverBabe temporarily down due to Cloudflare Turnstile (CAPTCHA) being enabled on " + TARGET_BP_HOST + ".";
                    setStatus("⚠️ " + msg);
                    showCaptchaPopupIfNeeded(403);
                    return;
                }
                const pageDom = stringToHTML(responseObject.response);
                if (pageDom) {
                    const bioAreaEl = pageDom.querySelector("#personal-info-block");
                    if (bioAreaEl) {
                        // cache + save + display
                        const now = new Date();
                        data.pages ??= {};
                        data.pages[name] = { response: responseObject.response, time: now.getTime() };
                        saveData(data);
                        displayBio(name, pageDom, precacheOnly);
                    } else {
                        setStatus(`Unable to retrieve actor bio data for ${name}.`);
                    }
                } else {
                    setStatus(`Unable to retrieve actor page for ${name}.`);
                    const now = new Date();
                    data.pages[name] = { responseObject: null, time: now.getTime() };
                }
            },

        });
    };

    const showFinalPrefetchStatus = () => {
        // Get current tag state for final status
        const tagEls = Array.from(
            document.querySelectorAll("#torrent_tags a[href*=torrents]"),
        );
        const tagMisses = getTagCache("misses");
        const tagHits = getTagCache("hits");
        const allActors = getAllActorNamesFromCache();

        const { knownHits, newHits, newMisses, tagsToHighlight } = processTags(
            tagEls,
            tagHits,
            tagMisses,
            allActors,
        );

        const totalTagsToHighlight = tagsToHighlight.length + newMisses.length + newHits.length;
        const tagsForStatus = tagsToHighlight.concat(newMisses).concat(newHits);

        statusArea.setStatus(
            `${totalTagsToHighlight} performer tags with bios on page: ${
            tagsForStatus.length > 0
            ? tagsForStatus
            .map(
                (tag) =>
                `<a href='https://www.empornium.is/torrents.php?taglist=${nameToTag(
                    tagToName(tag.innerText),
                )}'>${tagToName(tag.innerText)}</a>`,
            )
            .sort()
            .join(", ")
            : "none"
            }`,
            false,
        );
    };

    const isBioOpen = () => !!document.querySelector("#hoverbabe-container");

    const closeBio = (handle) => {
        // cancel event
        clearTimeout(handle);

        const container = document.querySelector("#hoverbabe-container");
        if (container) {
            container.remove();
        }
    };

    const getTagNameFromTagEl = (el) => {
        if (el.href) {
            return el.innerText.split("").slice(2).join("");
        }
        return el.parentNode.href.split("=")[1];
    };

    const startIconSpinner = (icon) => {
        window.clearInterval(iconSpinnerIntervalHandle);
        return window.setInterval(() => {
            if (icon.innerText === "📷") {
                icon.innerText = "📸";
            } else {
                icon.innerText = "📷";
            }
        }, 350);
    };

    const lookup = (hoverEvent) => {
        // XRT141 - Removed - Case Normalization (Lowercase)
        // const tag = getTagNameFromTagEl(hoverEvent.target);

        // XRT141 - Case Normalization (Lowercase)
        const tagRaw = getTagNameFromTagEl(hoverEvent.target);
        const tag = tagRaw.toLowerCase();
        // XRT141 - End

        const name = tagToName(tag);

        const allActors = getAllActorNamesFromCache();

        // check allActors and user-defined aliases
        if (allActors.has(tag) || getAllAliases(settings).includes(tag)) {
            if (isBioOpen()) {
                closeBio();
            }

            const icon = hoverEvent.target.firstChild;
            iconSpinnerIntervalHandle = startIconSpinner(icon);

            hovered = true;
            setStatus(`Getting bio for ${name}...`);

            // Get IAFD link and add to the bio container or window
            getIAFDLink(tag).then((iafdLink) => {
                const bioContainer = getBioContainer();
                if (bioContainer) {
                    const iafdSpinner = bioContainer.querySelector("#iafd-spinner");
                    const externalLinksContainer =
                          // todo
                          bioContainer.querySelector("#links-list");
                    if (bioContainer && iafdLink) {
                        const existingIafdLink = bioContainer.querySelector("#iafd-link");
                        if (!existingIafdLink) {
                            externalLinksContainer.append(iafdLink);
                            iafdSpinner.remove();
                        }
                    }

                    // No actor on iafd
                    if (!iafdLink) {
                        if (iafdSpinner) {
                            iafdSpinner.remove();
                        }

                        externalLinksContainer.append("No IAFD page found.😞");
                    }
                    // could have returned earlier than bio. It's in data now so try
                    // displaying link in displayBio.
                }
            });

            return getPageBio(name);
        }
        hovered = false;
    };

    // XRT141 - Fixed to include aliases
    const highlightTorrentTag = (name) => {
        const tagsInPage = Array.from(
            document.querySelectorAll("#torrent_tags a[href*=torrents]")
        );
        const span = document.createElement("span");
        span.innerText = "📸";
        span.style.marginLeft = "2px";

        const targetLower = nameToTag(name).toLowerCase();
        const aliases = getAllAliases(settings); // already lowercase

        tagsInPage.forEach((tagEl) => {
            const tagLower = getLowerTagText(tagEl);

            // Match if this tag equals the canonical BP tag OR any alias of that BP tag
            // We need the alias list for this BP tag specifically:
            const aliasOwner = getBPNameForAlias(tagToName(tagLower), settings);
            const tagIsAliasOfTarget =
                  aliasOwner && aliasOwner.toLowerCase() === targetLower;

            if (tagLower === targetLower || tagIsAliasOfTarget) {
                tagEl.parentNode.prepend(span.cloneNode(true));
                highlightTag(tagEl.parentNode);
            }
        });
    };


    // XRT141 - Case Normalization (Lowercase)
    const highlightAliases = (tagEls, settings) => {
        const allAliases = getAllAliases(settings); // lowercase
        const aliasesToHighlight = tagEls.filter(
            (tagEl) => allAliases.includes(getLowerTagText(tagEl))
        );
        aliasesToHighlight.forEach(highlightTag);
    };
    // XRT141 - End


    // XRT141 - Case Normalization (Lowercase)
    // Filter incoming tags to prevent need to search the large list of actors. Relies on hit/miss caches.
    // All comparisons and cached keys are lowercase.
    const processTags = (tags, hits, misses, actorList) => {
        // Map tags -> {el, textLower}
        const tagObjs = tags.map((el) => ({ el, textLower: getLowerTagText(el) }));

        const newTags = tagObjs.filter(
            (t) => !hits.has(t.textLower) && !misses.has(t.textLower)
        );
        const knownHits = tagObjs.filter((t) => hits.has(t.textLower));

        // Get all aliases to check against
        const allAliases = getAllAliases(settings); // lowercase

        // "actorList" contains lowercase names already; compare lowercase.
        // Also check if the tag is a user-defined alias
        const newHits = newTags.filter((t) => actorList.has(t.textLower) || allAliases.includes(t.textLower));
        const newMisses = newTags.filter((t) => !actorList.has(t.textLower) && !allAliases.includes(t.textLower));

        const tagsToHighlight = [...knownHits, ...newHits].map((t) => t.el);

        return {
            knownHits: knownHits.map((t) => t.el),
            newHits: newHits.map((t) => t.el),
            newMisses: newMisses.map((t) => t.el),
            tagsToHighlight,
        };
    };
    // XRT141 - End


    // Prefetch bios on the title page.
    // Note, for titles with very large number of actors, this can cause browser to become so busy that it locks up.
    // If total number of hits is greater than 10, lazy load all highlighted actors.
    const prefetchBioPagesAndImages = () => {
        // Prevent multiple simultaneous prefetch operations
        if (prefetchInitialized) {
            return;
        }
        prefetchInitialized = true;
        // Respect user setting to disable prefetching on the details page
        const settings = getSettings();
        const shouldPrefetch = settings?.optionPrefetchOnDetails !== false;

        try {
            if (!shouldPrefetch) {
                if (typeof statusArea !== 'undefined' && statusArea && statusArea.setStatus) {
                    statusArea.setStatus('Prefetching disabled in HoverBabe settings.');
                }
            }
        } catch (e) {
            // If getSettings fails for any reason, fall through to original behavior
            console.warn('HoverBabe: error reading prefetch setting', e);
        }

        // Respect user-configured max prefetch limit
        const rawMax = settings?.optionPrefetchMaxActors;
        const maxNumberOfActorTagsBeforeLazyLoading = (() => {
            const v = parseInt(rawMax, 10);
            if (!Number.isNaN(v) && v > 0) return v;
            return 10;
        })();
        const allActors = getAllActorNamesFromCache();

        // Get all tags.
        const tagEls = Array.from(
            document.querySelectorAll("#torrent_tags a[href*=torrents]"),
        );
        const tagMisses = getTagCache("misses");
        const tagHits = getTagCache("hits");

        const { knownHits, newHits, newMisses, tagsToHighlight } = processTags(
            tagEls,
            tagHits,
            tagMisses,
            allActors,
        );

        // When adding indicators, mutation observer will hit this function again but these will be 0.
        // This will overwrite the status indicator with 0 hits on the torrent page. We can return here.
        if (
            knownHits.length === 0 &&
            newHits.length === 0 &&
            newMisses.length === 0 &&
            tagsToHighlight.length === 0
        )
            return;

        // Add new hits, misses to cache
        newHits.forEach((tag) => {
            tagHits.add(getLowerTagText(tag));
        });
        newMisses.forEach((tag) => {
            tagMisses.add(getLowerTagText(tag));
        });

        // Highlight tags that have already been prefetched.
        tagsToHighlight.forEach(highlightTag);

        // Highlight all aliases
        highlightAliases(tagEls, settings);

        const totalTagsToHighlight =
              tagsToHighlight.length + newMisses.length + newHits.length;
        const tagsForStatus = tagsToHighlight.concat(newMisses).concat(newHits);

        statusArea.setStatus(
            `${totalTagsToHighlight} performer tags with bios on page: ${
            tagsForStatus.length > 0
            ? tagsForStatus
            .map(
                (tag) =>
                `<a href='https://www.empornium.is/torrents.php?taglist=${nameToTag(
                    tagToName(tag.innerText),
                )}'>${tagToName(tag.innerText)}</a>`,
            )
            .sort()
            .join(", ")
            : "none"
            }`,
            false,
        );

        // All tags (names) to prefetch
        // IMPORTANT: Normalize tag to lowercase FIRST before converting to name,
        // to match how lookup() normalizes tags. This ensures cache keys are consistent.
        const newActorsAndCachedActorTagNames = knownHits
        .concat(newHits)
        .map((tag) => {
            const tagLower = getLowerTagText(tag); // normalized lowercase tag
            return tagToName(tagLower); // convert lowercase tag to name
        });

        // Prefetch only those not already in cache
        const pagesInCache = data.pages ? Object.keys(data.pages) : [];
        const filteredPagesToPrefetch = newActorsAndCachedActorTagNames.filter(
            (page) => !pagesInCache.includes(page),
        );

        HB_logRequest('Prefetch Cache Filter', null,
            `Total: ${newActorsAndCachedActorTagNames.length}, ` +
            `Cached: ${pagesInCache.length}, ` +
            `To Fetch: ${filteredPagesToPrefetch.length}`);

        // Limit to user-configured max to avoid too many requests
        const limitedPagesToPrefetch = filteredPagesToPrefetch.slice(0, maxNumberOfActorTagsBeforeLazyLoading);



        // Determine delay between successive prefetch requests from settings (ms)
        const rawDelay = settings?.optionPrefetchDelayMs;
        const timeInterval = (() => {
            const v = parseInt(rawDelay, 10);
            // enforce sensible minimum and fallback default
            if (!Number.isNaN(v) && v >= 100) return v;
            return 3000; // default
        })();

        // Update prefetch settings
        prefetchSettings.delayMs = timeInterval;

        const tagsToPrefetchLength = limitedPagesToPrefetch.length;

        // Only prefetch bios if total number of tags to prefetch is <= max AND prefetch is enabled.
        if (shouldPrefetch && tagsToPrefetchLength <= maxNumberOfActorTagsBeforeLazyLoading) {
            // Clear any existing queue and add new items
            clearPrefetchQueue();

            // Add all items to the queue
            for (let n = 0; n < tagsToPrefetchLength; n += 1) {
                const name = limitedPagesToPrefetch[n];
                addToPrefetchQueue(name, n, tagsToPrefetchLength);
            }

            // Start processing the queue
            processPrefetchQueue();
        } else if (shouldPrefetch) {
            statusArea.setStatus(
                `Large number of actor tags detected (${tagsToHighlight.length}). Lazy loading bio boxes on tag hover.`,
            );
        } else {
            HB_logRequest('Prefetching Disabled', null, 'optionPrefetchOnDetails is false');
        }

        // Update caches if needed. (do last for performance)
        if (newHits.length > 0) {
            saveTagCache("hits", tagHits);
        }

        if (newMisses.length > 0) {
            saveTagCache("misses", tagMisses);
        }
    };

    const getTotalActors = () =>
    data.actorNames?.names && data.actorNames.names.size > 0
    ? data.actorNames.names.size
    : 0;

    const getAlertsArea = () => document.querySelector("#alerts");

    const createHoverBabeStatusArea = () => {
        const alerts = getAlertsArea();
        const alertsRect = alerts?.getBoundingClientRect();

        let position = "fixed";
        const width = "300px";
        const margin = 2;
        const right = 0;
        let bottom = 0;

        if (alerts) {
            if (alertsRect.top > 500) {
                // at bottom
                position = "initial";
                bottom = "initial";
            }
        }

        const template = `
  <style>
    div#hoverbabe-status-container {
      position: ${position};
      width: ${width};
      right: ${right};
      margin: ${margin}px;
      bottom: ${bottom};
      min-height: 40px;
      background-color: rgb(0,0,0,0.8);
      border-radius: 5px;
      font-family: Verdana,Arial,Helvetica,sans-serif;
      padding: 5px;
      font-size: 10px;
      font-weight: normal;
      color: rgb(230, 230, 230, 0.8);
      text-align: none;
      box-sizing: border-box;
    }

    /* Top row layout: title on left, actors + collapse on right */
    #hb-status-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    /* Title area (left) */
    #hb-status-top #title {
      display: inline-block;
      margin-right: 6px;
    }

    /* Right group: total actors and collapse button */
    #hb-status-top #right-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    /* Ensure total actors does not float and can be sized naturally */
    div#hoverbabe-status-container #total-actors-area {
      float: none !important;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px;
      border-radius: 3px;
    }

    /* collapse button placed inline to the right of performers info */
    #hb-status-collapse-inside {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      line-height: 18px;
      text-align: center;
      border-radius: 3px;
      background: rgba(255,255,255,0.04);
      color: #ddd;
      cursor: pointer;
      font-weight: bold;
      border: 1px solid rgba(255,255,255,0.06);
    }

    /* small collapsed button (unchanged) */
    #hoverbabe-status-collapsed-button {
      position: fixed;
      right: ${margin}px;
      bottom: ${bottom === 0 ? margin + "px" : bottom};
      width: 28px;
      height: 28px;
      line-height: 26px;
      text-align: center;
      border-radius: 6px;
      background: rgba(0,0,0,0.85);
      color: #ddd;
      cursor: pointer;
      font-weight: bold;
      border: 1px solid rgba(255,255,255,0.06);
      z-index: 10000;
      display: none; /* hidden by default */
    }

    div#hoverbabe-status-inner #msg {
      margin: 5px 0 0 0;
      overflow-y: auto;
      max-height: 60px;
    }

    div#hoverbabe-status-inner a:link {color: #66b3ff;}
    div#hoverbabe-status-inner a:visited {color: #c6b5d8;}
    div#hoverbabe-status-inner #title {}

    #total-actors-area:hover, #total-actors:hover {
      background-color: #222;
      border-radius: 2px;
      cursor: default;
    }
  </style>
  <div id='hoverbabe-status-inner'>
    <div id='hb-status-top'>
      <div id='hb-status-left'>
        <span id='title'>HoverBabe Version: <span id='hb-version'></span></span>
      </div>
      <div id='right-group'>
        <span id='total-actors-area' title=''>Performers <span id='total-actors' title=''>${
        getTotalActors() || 0
        }</span></span>
        <span id='hb-status-collapse-inside' title='Collapse status area'>&gt;</span>
      </div>
    </div>
    <p id='msg'></p>
  </div>
  `;

        const api = {
            setStatus: (msg, isText = true) => {
                const container = document.querySelector(
                    "div#hoverbabe-status-container",
                );
                const statusEl = document.querySelector(
                    "div#hoverbabe-status-container #msg",
                );
                const method = isText ? "innerText" : "innerHTML";
                if (container) {
                    statusEl[method] = `💁${msg}`;
                    // console.log(msg);
                }
            },
            hide: () => {
                const container = document.querySelector(
                    "div#hoverbabe-status-container",
                );
                const collapsedBtn = document.querySelector(
                    "#hoverbabe-status-collapsed-button",
                );
                if (container) {
                    container.style.display = "none";
                }
                if (collapsedBtn) {
                    collapsedBtn.style.display = "none";
                }
            },
            show: () => {
                const div = document.createElement("div");
                div.id = "hoverbabe-status-container";
                div.style.position = position;
                div.innerHTML = template;

                // Placement
                if (alerts && alertsRect.top > 500) {
                    alerts.prepend(div);
                } else {
                    document.querySelector("body").append(div);
                }

                // Create collapsed-state button (small icon) that appears when the panel is collapsed.
                let collapsedBtn = document.querySelector(
                    "#hoverbabe-status-collapsed-button",
                );
                if (!collapsedBtn) {
                    collapsedBtn = document.createElement("div");
                    collapsedBtn.id = "hoverbabe-status-collapsed-button";
                    collapsedBtn.innerText = "<"; // shows '<' when collapsed
                    document.body.append(collapsedBtn);
                }

                // Inside-panel collapse control
                const insideCollapse = div.querySelector("#hb-status-collapse-inside");

                const setCollapsed = (collapsed) => {
                    try {
                        localStorage.setItem("hb-status-collapsed", collapsed ? "1" : "0");
                    } catch (e) {}

                    if (collapsed) {
                        div.style.display = "none";
                        collapsedBtn.style.display = "flex";
                        collapsedBtn.style.alignItems = "center";
                        collapsedBtn.style.justifyContent = "center";
                        collapsedBtn.title = "Expand status area";
                    } else {
                        div.style.display = "block";
                        collapsedBtn.style.display = "none";
                    }
                };

                // Click handlers
                insideCollapse.addEventListener("click", () => setCollapsed(true));
                collapsedBtn.addEventListener("click", () => setCollapsed(false));

                // Restore saved state
                const saved = localStorage.getItem("hb-status-collapsed");
                if (saved === "1") {
                    // start collapsed
                    setCollapsed(true);
                }

                api.setTotalActors();
                api.updateDaysToRefreshActors();
                api.setVersion();
            },
            setTotalActors: (val) => {
                const container = document.querySelector(
                    "div#hoverbabe-status-container",
                );
                const totalEl = document.querySelector(
                    "div#hoverbabe-status-container #total-actors",
                );
                if (container) {
                    if (val) {
                        totalEl.innerText = val;
                        return;
                    }
                    totalEl.innerText = getTotalActors();
                }
            },
            updateDaysToRefreshActors: () => {
                const container = document.querySelector(
                    "div#hoverbabe-status-container",
                );
                const totalElTitle = document.querySelector(
                    "div#hoverbabe-status-container #total-actors-area",
                );
                const totalEl = document.querySelector(
                    "div#hoverbabe-status-container #total-actors",
                );
                if (container) {
                    const msg = `Refreshes in ${calculateRemainingDaysToRefreshActors()} days.`;
                    totalEl.title = msg;
                    totalElTitle.title = msg;
                }
            },
            setVersion: () => {
                const container = document.querySelector(
                    "div#hoverbabe-status-container",
                );
                const version = document.querySelector(
                    "div#hoverbabe-status-container #hb-version",
                );
                if (container) {
                    version.innerText = `v${GM_getValue("hb-version")}`;
                }
            },
        };
        return api;
    };

    const highlightTag = (el) => {
        // Create indicator el and put in anchor
        const indicatorEl = document.createElement("span");
        if (!el.innerText.includes("📸")) {
            indicatorEl.className = "hoverbabe-indicator";
            indicatorEl.style.fontStyle = "normal";
            indicatorEl.style.float = "none";
            indicatorEl.style.textDecoration = "none";
            indicatorEl.innerText = "📸";
            el.style.whiteSpace = "nowrap";

            if (settings.optionEnableTagHighlighting) {
                el.style.backgroundColor = settings.optionHighlight;
                el.style.borderRadius = "2px";
            }
            el.prepend(indicatorEl);
        }
    };

    const highlightAllTagsOnPage = () => {
        const allActors = getAllActorNamesFromCache();
        const tags = Array.from(document.querySelectorAll("div.tags a"));

        let sectionActorTags = []; // for statusarea

        const { knownHits, newHits, newMisses, tagsToHighlight } = processTags(
            tags,
            tagHits,
            excludedTagNamesSet,
            allActors,
        );

        sectionActorTags = [
            ...sectionActorTags,
            ...newHits.map((hit) => hit.innerText),
            ...knownHits.map((hit) => hit.innerText),
        ];
        const sectionActorTagsSet = new Set(sectionActorTags);
        const sectionActorTagsNoDups = [...sectionActorTagsSet];

        // Add hits/misses to caches
        newMisses.forEach((tag) => {
            excludedTagNamesSet.add(getLowerTagText(tag));
        });
        newHits.forEach((tag) => {
            tagHits.add(getLowerTagText(tag));
        });

        statusArea.setStatus(
            `${sectionActorTagsNoDups.length} performers with bios on page: ${
            sectionActorTagsNoDups.length > 0
            ? sectionActorTagsNoDups
            .map((tag) => {
                return `<a href='./torrents.php?taglist=${tag}'>${tagToName(
                    tag,
                )}</a>`;
            })
            .sort()
            .join(", ")
            : "none"
            }`,
            false,
        );
        tagsToHighlight.forEach(highlightTag);

        // Highlight aliases
        highlightAliases(tags, settings);

        // write to cache if there were any new hits/misses.
        if (newHits && newHits.length > 0) {
            saveTagCache("hits", tagHits);
        }

        if (newMisses && newMisses.length > 0) {
            saveTagCache("misses", excludedTagNamesSet);
        }
    };

    const isSearchResultsPage = () =>
    (window.location.pathname.includes("torrents.php") &&
     !window.location.href.includes("?id")) ||
          window.location.pathname.includes("top10") ||
          window.location.pathname.includes("requests");

    const setCurrentVersion = () => {
        const curVersion = GM_getValue("hb-version");
        const scriptVersion = GM_info.script.version;
        if (curVersion !== scriptVersion) {
            GM_setValue("hb-version", scriptVersion);
        }
    };

    function versionCompare(v1, v2, options) {
        const lexicographical = options?.lexicographical;
        const zeroExtend = options?.zeroExtend;
        let v1parts = v1.split(".");
        let v2parts = v2.split(".");

        function isValidPart(x) {
            return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
        }

        if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
            return NaN;
        }

        if (zeroExtend) {
            while (v1parts.length < v2parts.length) v1parts.push("0");
            while (v2parts.length < v1parts.length) v2parts.push("0");
        }

        if (!lexicographical) {
            v1parts = v1parts.map(Number);
            v2parts = v2parts.map(Number);
        }

        for (let i = 0; i < v1parts.length; ++i) {
            if (v2parts.length === i) {
                return 1;
            }

            if (v1parts[i] === v2parts[i]) {
            } else if (v1parts[i] > v2parts[i]) {
                return 1;
            } else {
                return -1;
            }
        }

        if (v1parts.length !== v2parts.length) {
            return -1;
        }

        return 0;
    }

    const updateCheck = (autoUpdate) => {
        const curVersion = GM_getValue("hb-version");
        const scriptVersion = GM_info.script.version;
        if (curVersion && scriptVersion) {
            return autoUpdate && versionCompare(scriptVersion, curVersion) === 1;
        }
        return true;
    };

    // --- Update Popup Detection Functions ---

    function shouldSuppressUpdatePopup() {
        const until = parseInt(localStorage.getItem(UPDATE_POPUP_SUPPRESS_KEY), 10);
        return !Number.isNaN(until) && Date.now() < until;
    }

    function setUpdatePopupSuppressionDays(days) {
        if (!days || Number.isNaN(+days) || +days <= 0) {
            localStorage.removeItem(UPDATE_POPUP_SUPPRESS_KEY);
            return;
        }
        const until = Date.now() + (+days) * 24 * 60 * 60 * 1000;
        localStorage.setItem(UPDATE_POPUP_SUPPRESS_KEY, until.toString());
    }

    function getUpdateReason() {
        // Check for version change first
        const curVersion = GM_getValue("hb-version");
        const scriptVersion = GM_info.script.version;
        if (curVersion && scriptVersion && versionCompare(scriptVersion, curVersion) === 1) {
            return "version";
        }

        // Check for monthly timeout
        const now = new Date();
        const nowTime = now.getTime();
        if (data?.actorNames && data.actorNames.names.size > 0) {
            const actorsLastCacheTime = data.actorNames.time;
            if (nowTime - actorsLastCacheTime > oneMonth) {
                return "monthly";
            }
        } else {
            // No data at all - needs initial load
            return "initial";
        }

        return null; // No update needed
    }

    function shouldShowUpdatePopup() {
        // Check if suppressed
        if (shouldSuppressUpdatePopup()) {
            console.log(UPDATE_LOG_TAG, "Update popup suppressed by user setting.");
            return false;
        }

        // Check if update is needed
        const reason = getUpdateReason();
        return reason !== null;
    }

    const getSettings = () => {
        const key = "hb-settings";
        const rawOptions = GM_getValue(key);
        if (rawOptions) {
            return JSON.parse(GM_getValue(key));
        }
        return {
            optionClickToOpen: false,
            optionSortActors: false,
            optionHighlight: "",
            optionShowStatusArea: true,
            optionEnableTagHighlighting: false,
            // performer image and biodata are always shown; those options were removed
            optionShowAboutSection: true,
            optionShowExternalLinks: true,
            optionShowSimilarPerformers: true,
            optionAliases: {
                "chloe.couture": ["chloe.cherry"],
            },
            // New prefetch settings (defaults)
            optionPrefetchOnDetails: true,
            optionPrefetchMaxActors: 10,
            optionPrefetchDelayMs: 3000,
            // Debug logging (collapsed grouped request logs)
            optionDebug: false,
        };
    };

    const saveSettings = (settings) => {
        GM_setValue("hb-settings", JSON.stringify(settings));
    };

    const hideSettings = () =>
    document.querySelector("#threadman-options-outer-container").remove();

    // Convert aliases back to string for alias textarea in settings
    const convertObjectToString = (aliasesObject) => {
        if (aliasesObject) {
            let str = "";
            const keys = Object.keys(aliasesObject);
            keys.forEach((key) => {
                const aliasesString = aliasesObject[key].map((v) => v.trim());
                const entry = `${key}: ${aliasesString}\n`;
                str += entry;
            });
            return str;
        }
        return "";
    };

    // Settings
    const showSettings = () => {
        // Get settings
        const options = getSettings();

        const settingsTemplate = `
  <style>
  #threadman-options-outer-container {
    color: #ccc;
    position: fixed;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    top: 50%;
    width: 650px;
    height: auto;
    border: solid #333 1px;
    background-color: rgb(0,0,0,0.9);
    border-radius: 15px;
    margin: 5px;
  }

  .threadman-options-container {
    position: relative;
    margin: 15px;
  }

  .threadman-options-container p{
    margin: 0;
  }

    .options-inner {
      width: 100%;
      margin: 10px 0 0 0;
      display: inline-block;
    }

    #threadman-save-settings {
      margin-top: 10px;
    }

    #close-threadman-settings a {
      float: right;
      text-decoration:none;
      width: 20px;
      height: 20px;
      border-radius: 10px;
      font-size: 1.3em;
    }

    #close-threadman-settings a:hover {
      background-color: rgba(100,100,10,0.9);
    }

    #option-highlight {
      padding: 0;
      width: 15px;
      height: 15px;
    }

    #option-highlight-label {
      vertical-align: bottom;
    }

    #option-aliases {
      width: 100%;
    }

  </style>

  <div class="threadman-options-container" id="threadman-option-container">
    <div id='close-threadman-settings'><a href='#'>✖️</a></div>
    <h3>HoverBabe Settings</h3>

    <div>
      <div class='options-inner'>
        <input type="checkbox" id="option-click-to-open" name="option-click-to-open" ${
        options.optionClickToOpen ? "checked" : ""
        }>
        <label for="option-click-to-open"> Click to open bio box (instead of hover)</label>
        <br>
        <input type="checkbox" id="option-show-status-area" name="option-show-status-area" ${
        options.optionShowStatusArea ? "checked" : ""
        }>
        <label for="option-show-status-area"> Show status area</label>
        <br>
        <input type="checkbox" id="option-sort-actors" name="option-sort-actors" ${
        options.optionSortActors ? "checked" : ""
        }>
        <label for="option-sort-actors"> Performer tags at beginning of tag list (Search results pages, not on torrent page)</label>
        <br>
        <input type="checkbox" id="option-enable-tag-highlighting" name="option-enable-tag-highlighting" ${
        options.optionEnableTagHighlighting ? "checked" : ""
        }>
        <label for="option-enable-tag-highlighting"> Enable tag highlighting</label>
        <br>
        <input type="color" id="option-highlight" name="option-highlight" value="${
        options.optionHighlight
        }">
        <label id='option-highlight-label' for="option-highlight"> Tag highlight color</label><br><br>

        <!-- New prefetching settings -->
        <h4>Prefetching (Details Page)</h4>
        <input type="checkbox" id="option-prefetch-on-details" name="option-prefetch-on-details" ${
        options.optionPrefetchOnDetails ? "checked" : ""
        } title="If enabled, HoverBabe will attempt to prefetch performer bio pages & images on the torrent details page">
        <label for="option-prefetch-on-details"> Prefetch Actor Bios on Details Page</label>
        <br>
        <label title="Maximum number of actor bios to prefetch. If more actors are present, lazy loading will be used.">
          Max Actors to Prefetch
          <input type="number" id="option-prefetch-max-actors" min="1" value="${options.optionPrefetchMaxActors}" style="width:80px; margin-left:6px;">
        </label>
        <br>
        <label title="Delay between successive prefetch requests in milliseconds. Increase to reduce request rate to the target site.">
          Delay between prefetch requests
          <input type="number" id="option-prefetch-delay-ms" min="100" value="${options.optionPrefetchDelayMs}" style="width:100px; margin-left:6px;"> ms
        </label>
        <br><br>

        <h4>Debug</h4>
        <input type="checkbox" id="option-debug-logging" name="option-debug-logging" ${
        options.optionDebug ? "checked" : ""
        } title="When enabled, HoverBabe will log grouped external request activity to the console.">
        <label for="option-debug-logging"> Enable debug request logging</label>
        <br>

        <h4>Bio Popup Display Options</h4>
        <input type="checkbox" id="option-show-about-section" name="option-show-about-section" ${
        options.optionShowAboutSection !== false ? "checked" : ""
        }>
        <label for="option-show-about-section"> Show about section</label>
        <br>
        <input type="checkbox" id="option-show-external-links" name="option-show-external-links" ${
        options.optionShowExternalLinks !== false ? "checked" : ""
        }>
        <label for="option-show-external-links"> Show external links</label>
        <br>
        <input type="checkbox" id="option-show-similar-performers" name="option-show-similar-performers" ${
        options.optionShowSimilarPerformers !== false ? "checked" : ""
        }>
        <label for="option-show-similar-performers"> Show similar performers</label>
        <br><br>
        <h4 id='option-aliases-label' for="option-aliases">User-defined Aliases</h4>
        <p>Format: <code>[babepedia tag]:[alias tag 1],[alias tag 2], etc. (no spaces, 1 actor per line)</code></p>
        <p>Example: <code>polina.maxim:polina.max,polina.maxima,verena.maxima,venera.maxima</code></p>
        <textarea placeholder="List of aliases (see above for format)" id="option-aliases" rows=10>${convertObjectToString(
            options.optionAliases,
        )}</textarea>
      </div>
    </div>

<div>
  <button id='threadman-save-settings'>Save Settings</button>
  <p>(Chrome only: Refresh page after saving settings)</p>
  <button id='threadman-refresh-actors'>Refresh Performer Database Now</button>
  <p>This manually updates the Babepedia performer list.</p>
  <button id='threadman-clear-cache'>Clear Bio Cache</button>
  <p>This clears cached performer bio pages (keeps performer database).</p>
</div>



  </div>
  `;

        const createTemplateDOM = (str) => {
            const template = document.createElement("div");
            template.id = "threadman-options-outer-container";
            template.innerHTML = str;
            return template;
        };

        const dom = createTemplateDOM(settingsTemplate);

        // Save settings
        dom
            .querySelector("#threadman-save-settings")
            .addEventListener("click", () => {
            const optionClickToOpen = document.querySelector("#option-click-to-open");
            const optionSortActors = document.querySelector("#option-sort-actors");
            const optionHighlight = document.querySelector("#option-highlight");
            const optionShowStatusArea = document.querySelector(
                "#option-show-status-area",
            );
            const optionEnableTagHighlighting = document.querySelector(
                "#option-enable-tag-highlighting",
            );
            const optionShowAboutSection = document.querySelector(
                "#option-show-about-section",
            );
            const optionShowExternalLinks = document.querySelector(
                "#option-show-external-links",
            );
            const optionShowSimilarPerformers = document.querySelector(
                "#option-show-similar-performers",
            );
            const optionAliases = document.querySelector("#option-aliases");

            // New prefetch inputs
            const optionPrefetchOnDetails = document.querySelector("#option-prefetch-on-details");
            const optionPrefetchMaxActors = document.querySelector("#option-prefetch-max-actors");
            const optionPrefetchDelayMs = document.querySelector("#option-prefetch-delay-ms");
            const optionDebugLogging = document.querySelector("#option-debug-logging");

            const localSettings = {
                optionClickToOpen: optionClickToOpen.checked,
                optionSortActors: optionSortActors.checked,
                optionHighlight: optionHighlight.value,
                optionShowStatusArea: optionShowStatusArea.checked,
                optionEnableTagHighlighting: optionEnableTagHighlighting.checked,
                // performer image and biodata always enabled
                optionShowAboutSection: optionShowAboutSection.checked,
                optionShowExternalLinks: optionShowExternalLinks.checked,
                optionShowSimilarPerformers: optionShowSimilarPerformers.checked,
                /* optionAliases */
                // New prefetch settings saved
                optionPrefetchOnDetails: optionPrefetchOnDetails ? optionPrefetchOnDetails.checked : true,
                optionPrefetchMaxActors: optionPrefetchMaxActors ? Math.max(1, parseInt(optionPrefetchMaxActors.value, 10) || 10) : 10,
                optionPrefetchDelayMs: optionPrefetchDelayMs ? Math.max(100, parseInt(optionPrefetchDelayMs.value, 10) || 3000) : 3000,
                optionDebug: optionDebugLogging ? optionDebugLogging.checked : false,
            };

            // Alias conversion/handling:
            // actor1: alias1, alias2, alias3\n
            // actor2: alias1, alias2\n
            const rawOptionAliases = optionAliases.value.trim();
            if (rawOptionAliases && rawOptionAliases !== "") {
                try {

                    // XRT141 - Case Normalization (Lowercase)
                    const entries = rawOptionAliases.trim().split("\n");
                    const parsedAliases = entries.reduce((acc, v) => {
                        const parts = v.split(":");
                        // Normalize LHS (bp tag) and RHS aliases to lowercase, trimmed.
                        const lhs = (parts[0] || "").trim().toLowerCase();
                        const rhs = (parts[1] || "").split(",").map((val) => val.trim().toLowerCase());
                        if (lhs) acc[lhs] = rhs.filter(Boolean);
                        return acc;
                    }, {});
                    // XRT141 - END

                    saveSettings({
                        ...localSettings,
                        ...{ optionAliases: parsedAliases },
                    });
                    hideSettings();
                    window.location.reload(true);
                } catch {
                    window.alert("Error: Double-check your aliases.");
                }
            } else {
                saveSettings(localSettings);

                hideSettings();
                window.location.reload(true);
            }
        });

        // Manual refresh performer database
        // Manual trigger: force same monthly refresh
        dom.querySelector("#threadman-refresh-actors").addEventListener("click", async () => {
            if (!confirm("Force manual refresh of the performer database now? This will take several minutes.")) return;

            hideSettings();

            // ensure status area visible
            if (!statusArea) {
                statusArea = createHoverBabeStatusArea();
                statusArea.show();
            }

            statusArea.setStatus("⏳ Manually triggering full performer refresh...");
            currentActorTotal = 0;

            // 🧩 Force expiration so getAllActors() always runs
            if (data && data.actorNames) {
                data.actorNames.time = 0;
            }

            try {
                await getAllActors();
                const total = getTotalActors();
                statusArea.setStatus(`✅ Manual refresh complete. Total performers: ${total}`);
                statusArea.setTotalActors(total);
                statusArea.updateDaysToRefreshActors();
            } catch (err) {
                console.error("Manual refresh failed:", err);
                statusArea.setStatus("❌ Error during manual refresh. Check console for details.");
            }
        });

        // Clear bio cache
        dom.querySelector("#threadman-clear-cache").addEventListener("click", () => {
            if (!confirm("Clear all cached performer bio pages? This will not affect the performer database.")) return;

            const clearedCount = clearAllBioCache();

            // Show status if area is available
            if (statusArea) {
                statusArea.setStatus(`✅ Cleared ${clearedCount} cached bio pages.`);
            } else {
                alert(`✅ Cleared ${clearedCount} cached bio pages.`);
            }

            hideSettings();
        });





        // Close settings
        dom
            .querySelector("#close-threadman-settings a")
            .addEventListener("click", hideSettings);

        // Add to document.
        const body = document.querySelector("body");
        body.appendChild(dom);
    };

    function removeAllChildNodes(parent) {
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
    }

    const tagHighlighterInstalled = () =>
    !!document.querySelector("li[title*=Highlighter]");

    const sortTagsActorFirst = () => {
        const torrents = document.querySelectorAll(
            ".torrent.rowa, .torrent.rowb, .torrent.redbar, table#request_table .rowa, table#request_table .rowb",
        );
        let actorTags;
        let nonActorTags;
        torrents.forEach((torrent) => {
            const tags = Array.from(
                torrent.querySelectorAll(
                    tagHighlighterInstalled() ? ".tags span.s-tag" : ".tags a",
                ),
            );
            actorTags = tags.filter((tag) => tag.innerText.includes("📸")).sort();
            nonActorTags = tags.filter((tag) => !tag.innerText.includes("📸"));

            const newTags = [...actorTags, ...nonActorTags];
            const tagsParent = torrent.querySelector(".tags");
            removeAllChildNodes(tagsParent);
            newTags.forEach((tag) => {
                tagsParent.appendChild(tag);
                tagsParent.append(" ");
            });
        });
    };

    // Add settings link to page.
    const addSettingsLink = () => {
        const ul = document.createElement("ul");
        const li = document.createElement("li");
        ul.append(li);
        ul.style.display = "inline-block";

        const a = document.createElement("a");
        a.href = "#";
        a.textContent = "⛭ LHB";
        a.title = 'Luminance HoverBabe - Settings';
        a.addEventListener("click", () => {
            showSettings();
        });
        li.appendChild(a);
        const container = document.querySelector("#major_stats");
        container.prepend(ul);
    };

    const debounce = (callback, wait) => {
        let timeoutId = null;
        return (...args) => {
            window.clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                callback.apply(null, args);
            }, wait);
        };
    };

    const isTorrentPage = () => document.location.href.includes("torrents.php?id=");


    async function shouldSkipDueToCloudflare() {
        const now = Date.now();
        const nextCheck = parseInt(localStorage.getItem(CF_NEXT_CHECK_KEY), 10);

        // If it's not yet time to re-check, skip the check but do not disable the script.
        if (!Number.isNaN(nextCheck) && now < nextCheck) {
            cfDebug("Skipping Cloudflare check — next allowed at", new Date(nextCheck));
            return false;
        }

        // Validate cookie by hitting babepedia homepage with cookies
        const ok = await ensureBPCookie();
        if (!ok) {
            // Old behavior used to alert and set a 12 hour disable window here.
            // We remove that disabling behavior so the user can manually trigger the verification
            // flow (open site /test) via the popup UI. Log and schedule the next probe.
            cfDebug("Babepedia cookie validation failed; prompt user to verify but do not disable script.");
            // schedule next check in 1 hour to avoid repeated probes
            localStorage.setItem(CF_NEXT_CHECK_KEY, (now + CF_CHECK_INTERVAL).toString());
            return false;
        }

        // No block; schedule next check in 1 hour
        localStorage.setItem(CF_NEXT_CHECK_KEY, (now + CF_CHECK_INTERVAL).toString());
        return false;
    }


    const run = async () => {
        // Run the cookie validation / user prompt flow but do not disable the script.
        await shouldSkipDueToCloudflare();

        settings = getSettings();

        // Initialize data first
        data = getData();

        // Check if update popup should be shown
        const updateReason = getUpdateReason();
        if (updateReason && shouldShowUpdatePopup()) {
            console.log(UPDATE_LOG_TAG, `Update needed. Reason: ${updateReason}`);
            // Show popup - user decides whether to update
            showUpdatePopup(updateReason);
            // Note: The actual update is triggered by clicking "Update Now" in the popup
            // We don't block here - script continues to function normally
        } else if (updateReason) {
            console.log(UPDATE_LOG_TAG, `Update needed but popup suppressed. Reason: ${updateReason}`);
        }

        // Always set current version
        setCurrentVersion();

        const handleMouseOver = debounce((e) => {
            lookup(e);
        }, 250);

        const setUpHoverAndHighlightTags = () => {
            window.setTimeout(() => {
                const tags = document.querySelectorAll(
                    '#torrent_tags_list a[href*="torrent"], .tags a',
                );
                tags.forEach((tag) => {
                    if (!settings.optionClickToOpen) {
                        tag.addEventListener("mouseover", handleMouseOver);
                    } else {
                        const hbIndicator = tag.firstChild;
                        hbIndicator.addEventListener("click", (e) => {
                            e.preventDefault();
                            handleMouseOver(e);
                        });
                    }
                });

                if (!isSearchResultsPage()) {
                    prefetchBioPagesAndImages();
                }
            }, 1000);

            // For Search results
            if (isSearchResultsPage()) {
                highlightAllTagsOnPage();
            }

            // optionally sort all tags
            if (settings.optionSortActors) {
                sortTagsActorFirst();
            }
        };


        // Ensure we ran the cookie probe above; now always attempt to load actors and set up tags.
        getAllActors().then(setUpHoverAndHighlightTags);

        const { body } = document;
        body.addEventListener("keyup", (e) => {
            if (e.key === "Escape") {
                closeBio();
            }
        });

        body.addEventListener("click", (e) => {
            const bioContainer = getBioContainer();
            if (bioContainer) {
                const boundingRect = bioContainer.getBoundingClientRect();
                if (
                    e.clientX < boundingRect.x ||
                    e.clientX > boundingRect.right ||
                    e.clientY < boundingRect.top ||
                    e.clientY > boundingRect.bottom
                ) {
                    closeBio();
                }
            }
        });

        window.addEventListener("scroll", closeBio);

        cleanPagesCache();
        // cleanTagCaches();

        statusArea = createHoverBabeStatusArea(data);

        if (settings.optionShowStatusArea) {
            statusArea.show();
        }

        addSettingsLink();

        logBabepediaStatus();

        const debouncedMutationCb = debounce((mutation) => {
            if (mutation.type === "childList") {
                setUpHoverAndHighlightTags();
            }
        }, 250);

        if (isTorrentPage()) {
            // Re-set up tags when new tag is added/removed.
            const observer = new MutationObserver((mutationsList) => {
                mutationsList.forEach(debouncedMutationCb);
            });
            observer.observe(document.querySelector("#tag_container"), {
                childList: true,
                subtree: true,
            });
        }
    };

    // Go!
    run();

    // Global CSS for menu positioning
    GM_addStyle(`
        #userinfo_username li ul {right:0; left:auto;}
    `);
