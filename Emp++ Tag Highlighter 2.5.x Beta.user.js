// ==UserScript==
// @name         Emp++ Tag Highlighter 2.5.x Beta
// @namespace    http://tampermonkey.net/
// @version      2.5.50
// @description  Enhanced Emp++ Tag Highlighter branched from v0.7.9b
// @author       allebady, xrt141
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
// @match        *://*.empornium.sx/torrents.php*
// @updateURL    https://github.com/xrt141/Userscripts/raw/refs/heads/main/Emp++%20Tag%20Highlighter%202.5.x%20Beta.user.js
// @downloadURL  https://github.com/xrt141/Userscripts/raw/refs/heads/main/Emp++%20Tag%20Highlighter%202.5.x%20Beta.user.js
// @run-at       document-end
// ==/UserScript==

/* =========================================================
   Emp++ Tag Highlighter XRT141 v2.x - Built from 0.7.9b
   ========================================================= */

//Change Log
// 2.0 Primary focus was customization - MAJOR rewrite
// 2025-10-29 - 2.0.26 Changes (Major Changes ONLY since 0.7.9b)
/* - 0.7.9b data *should* import safely.
   # Config Changes
       - Color/Names Tab – All tag categories can be renamed to custom names (pick your own categories).
       - Color/Names Tab – All tag categories can have custom colors and fonts (choose your look).
       - Color/Names Tab – All tag categories can be set as Good, Very Good, Bad, Very Bad, or Ignore — which will influence the Percent Bar if enabled.
       - Dupe Cleanup Tab – If any tags appear in multiple categories, you can choose the correct one and remove the rest.
       - Percent Bar – Hover shows the numbers / % breakdown.
       - Percent Bar – Calculation weighs "Very Good" as twice the % value of "Good". Same for Very Bad / Bad.
       - Torrent Coloring – "Bad tags" total weighs more than "Good tags" total.
       - Added a new subcategory under the previously childless "New Performer" category so all categories now have a child subcategory.
       - Because you can rename and recolor tags, toggles were added to disable hiding if you repurpose "Useless" or "Blacklist".
       - Configuration panel is now scrollable for lower-resolution screens (more fixes coming soon).

   # Torrent Detail Page Changes
       - Changed the tag list layout on the main torrent detail page to be centered and split into 3 columns.
       - Properly configured tag names to dynamically truncate with an ellipsis if they do not fit in the row.
       - Adding tags to a category that hides them (Useless Tags) will dynamically update the list.
       - Removing tags from that category will also dynamically update the list.
       - Added a refresh button to update the list if it’s not rendered or sorted properly.
       - Added a button above the tag list to show/hide the tag buttons so long tag names can be read.
       - Disabled the default sort buttons in the tag list since they caused issues. (Will fix later.)

   # Tags Page
       - This now works on the Tags page by hitting the "Edit Tags" button.
       - Synonyms are not currently supported.

   ## Known Issues:
       - Sometimes tags are unevenly distributed in the 3-column layout on the details page. (Use the refresh button.)
       - Using the "Add Tag" feature on torrents can mess up the layout. Refresh the page after adding. (Hard to test without adding tons of tags.)

   ## Notes
       - Detail Page – Torrents are sorted alphabetically. Plugins like Hoverbabe add camera icons to actresses *after* sorting — using Refresh will sort actresses first.
       - Kept the parent-child relationship to reduce the total buttons for uncategorized tags, but they don’t need to be related. You just have to remember what parent the tag you want is under.
       - This has not been tested on any sites other than Empornium.

// 2025-11-10 - 2.0.40
       - Added a toggle on the general settings page to disable italics for tag font on the torrent list page.
       - Added a toggle on the general settings page to spead space the tags more on the torrent listing page for easier reading.
       - Tighten up the layout on the general settings page.

*/


// --- Main Execution Wrapper ---
// Initializes configuration, settings, tag logic, and all UI handlers.
function runScript() {
    var $j = $.noConflict(true);

    const debug = true;
    // ======================================
    // === Default Configuration Settings ===
    // ======================================


    // === Detect the site to hanbdle any "special" rules ===
    const currentHost = window.location.hostname.toLowerCase();
    const isEmpornium = currentHost.includes('empornium');
    const isFemdomcult = currentHost.includes('femdomcult');
    const isHomeporntorrents = currentHost.includes('homeporntorrents');
    const isEnthralled = currentHost.includes('enthralled');
    const isPornbay = currentHost.includes('pornbay');


    // Hosts that should NOT use 3-column tag splitting on detials page.
    const EXCLUDED_SPLIT_HOSTS = new Set([
        'happyfappy.org',
        'www.happyfappy.org',
    ]);


    // Define globally so all IIFEs/functions can access
    window.shouldSkipTagSplit = function () {
        const host = (window.location.hostname || '').toLowerCase();
        // Skip the 3-column split on happyfappy.org and any subdomain
        return host === 'happyfappy.org' || host.endsWith('.happyfappy.org');
    };


    // === Global list of all tag keys (used for dynamic code generation) ===
    const ALL_TAGS_KEYS = [
        "Tags1a", "Tags1b", "Tags1c", "Tags2a", "Tags2b", "Tags2c", "Tags3a", "Tags3b", "Tags3c", "Tags4a", "Tags4b", "Tags4c",
        "Tags5a", "Tags5b", "Tags5c", "Tags6a", "Tags6b", "Tags6c", "Tags7a", "Tags7b", "Tags7c", "Tags7d"
    ];
    // --- singlular "tag" version of ALL_TAGS_KEYS. ---
    const ALL_TAG_KEYS = ALL_TAGS_KEYS.map(key => key.replace(/^Tags/, "Tag"));
    // --- Tag keys that end in "a" ---
    const FILTERED_ONLY_A_TAGS_KEYS = ALL_TAGS_KEYS.filter(key => key.endsWith("a")); //Tags
    const FILTERED_ONLY_A_TAG_KEYS = ALL_TAG_KEYS.filter(key => key.endsWith("a")); //Tag
    // --- Tag keys that do NOT end in "a" ---
    const FILTERED_NON_A_TAGS_KEYS = ALL_TAGS_KEYS.filter(key => !key.endsWith("a")); //Tags
    const FILTERED_NON_A_TAG_KEYS = ALL_TAG_KEYS.filter(key => !key.endsWith("a")); //Tag
    // --- Tag keys sorted by number and reverse alpha (Tags1c, Tags1b, Tags1a, Tags2c...) ---
    const SORTED_TAGS_KEYS = [...ALL_TAGS_KEYS].sort((a, b) => {
        const [numA, letterA] = a.match(/\d+|[a-z]/gi);
        const [numB, letterB] = b.match(/\d+|[a-z]/gi);
        if (numA !== numB) return parseInt(numA) - parseInt(numB);
        return letterB.localeCompare(letterA); // reverse letter order
    });

    function runFunction(fn, identifier = '', args = []) {
        if (debug) {
            console.log(`▶️ Running Function: ${fn.name} - ${identifier}`);
        }
        if (typeof fn === 'function') {
            fn(...args);
        } else {
            console.warn(`[!] ${identifier} is NOT defined or not a function. Type is:`, typeof fn);
        }
    }
    window.runFunction = runFunction;

    // === Define default feature toggles, color mappings, and tag categories. ===

    // --- Dynamically Set the default for all tag categories to disabled. ---
    const tagEnableDefaults = ALL_TAG_KEYS.reduce((obj, key) => {
        obj[`use${key}Tags`] = false;
        return obj;
    }, {});

    // Dynamically create tag category button visibility defaults
    const tagButtonVisibilityDefaults = FILTERED_ONLY_A_TAG_KEYS.reduce((obj, key) => {
        obj[`${key}ButtonVisibility`] = false;
        return obj;
    }, {});

    // These defaults are merged with any saved user settings at runtime.
    var defaults = {
        majorVersion: 2.0,
        truncateTags: true, //button removed
        usePercentBar: false,
        usePBHtmlTooltip: false,
        useTorrentOpacity: false,
        useTorrentColoring: false,
        useTorrentBlacklistNotice: true,
        useBlacklistNoticeBookmark: false,
        useBlacklistNoticeCollages: false,
        hideTags7cTorrents: false,
        hideTags7dTags: false,
        disableItalics: false,
        roomierTags: false,
        tagLayoutStyle: "normal",
        //Site Specific
        hfBetterBubblegum: false,


        //--- Tag types to enable - Dynamically generated above - Default: false ---
        ...tagEnableDefaults,

        //Should we hide any tag buttons - Dynamically generated above - Default: false ---
        ...tagButtonVisibilityDefaults,

        // Color default settings - matches colors from 0.7.9b
        colors: {
            Tags1a: { background: "#A9DF9C", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags1b: { background: "#3D9949", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags1c: { background: "#3D9949", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags2a: { background: "#769dc9", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags2b: { background: "#3a6392", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags2c: { background: "#ffffff", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags3a: { background: "#f7d600", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags3b: { background: "#ccc870", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" }, //new
            Tags3c: { background: "#ffffff", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags4a: { background: "#cfd9e2", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags4b: { background: "#afc0cf", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags4c: { background: "#ffffff", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags5a: { background: "#f3af58", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags5b: { background: "#e58306", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags5c: { background: "#ffffff", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags6a: { background: "#e86eed", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags6b: { background: "#d01dd7", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags6c: { background: "#ffffff", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags7a: { background: "#F3AAAA", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags7b: { background: "#840000", border: "#000000", text: "#ffffff", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags7c: { background: "#222222", border: "#000000", text: "#EEEEEE", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" },
            Tags7d: { background: "#999999", border: "#000000", text: "#000000", borderColor: "#000000", borderStyle: "solid", borderWeight: "0px" }
        },

        // Category Name default settings - matches names from 0.7.9b
        names: {
            Tags1a: "Liked",
            Tags1b: "Loved",
            Tags1c: "New1c",
            Tags2a: "Performer",
            Tags2b: "Loved Performer",
            Tags2c: "New2c",
            Tags3a: "New Performer",
            Tags3b: "Loved New Performer", //new
            Tags3c: "New3c",
            Tags4a: "Amateur",
            Tags4b: "Loved Amateur",
            Tags4c: "New4c",
            Tags5a: "Male Performer",
            Tags5b: "Loved Male Performer",
            Tags5c: "New5c",
            Tags6a: "Liked Site",
            Tags6b: "Loved Site",
            Tags6c: "New6c",
            Tags7a: "Disliked",
            Tags7b: "Hated",
            Tags7c: "Blacklisted",
            Tags7d: "Useless"
        },


    };

    // Load Settings - Use defaults above for missing / empty settings.
    var settings = getSettings();
    settings = $j.extend(true, defaults, settings);

    // Initialize settings.tags
    if (!settings.tags) settings.tags = {};


    const tagHierarchy = {
        Tags1a: ["Tags1b", "Tags1c"],
        Tags2a: ["Tags2b", "Tags2c"],
        Tags3a: ["Tags3b", "Tags3c"],
        Tags4a: ["Tags4b", "Tags4c"],
        Tags5a: ["Tags5b", "Tags5c"],
        Tags6a: ["Tags6b", "Tags6c"],
        Tags7a: ["Tags7b", "Tags7c", "Tags7d"]
    };

    // === Tag Metadata for Notes and Info ===
    const TAG_META = {
        Tags1a: {
            note: "Main <b>" + settings.names.Tags1a + "</b> Tags",
            info: "Enable highlighting for <b>" + settings.names.Tags1a + "</b> tags. These will appear in torrent lists."
        },
        Tags1b: {
            note: "Requires <b>" + settings.names.Tags1a + "</b> enabled",
            info: "<b>" + settings.names.Tags1b + "</b> tags are a subset of <b>" + settings.names.Tags1a + "</b> tags."
        },
        Tags1c: {
            note: "Requires <b>" + settings.names.Tags1a + "</b> enabled",
            info: "<b>" + settings.names.Tags1c + "</b> tags are a subset of <b>" + settings.names.Tags1a + "</b> tags."
        },
        Tags2a: {
            note: "Main <b>" + settings.names.Tags2a + "</b> Tags",
            info: "Enable highlighting for <b>" + settings.names.Tags2a + "</b> tags. These will appear in torrent lists."
        },
        Tags2b: {
            note: "Requires <b>" + settings.names.Tags2a + "</b> enabled",
            info: "<b>" + settings.names.Tags2b + "</b> tags are a subset of <b>" + settings.names.Tags2a + "</b> tags."
        },
        Tags2c: {
            note: "Requires <b>" + settings.names.Tags2a + "</b> enabled",
            info: "<b>" + settings.names.Tags2c + "</b> tags are a subset of <b>" + settings.names.Tags2a + "</b> tags."
        },
        Tags3a: {
            note: "Main <b>" + settings.names.Tags3a + "</b> Tags",
            info: "Enable highlighting for <b>" + settings.names.Tags3a + "</b> tags. These will appear in torrent lists."
        },
        Tags3b: {
            note: "Requires <b>" + settings.names.Tags3a + "</b> enabled",
            info: "<b>" + settings.names.Tags3b + "</b> tags are a subset of <b>" + settings.names.Tags3a + "</b> tags."
        },
        Tags3c: {
            note: "Requires <b>" + settings.names.Tags3a + "</b> enabled",
            info: "<b>" + settings.names.Tags3c + "</b> tags are a subset of <b>" + settings.names.Tags3a + "</b> tags."
        },
        Tags4a: {
            note: "Main <b>" + settings.names.Tags4a + "</b> Tags",
            info: "Enable highlighting for <b>" + settings.names.Tags4a + "</b> tags. These will appear in torrent lists."
        },
        Tags4b: {
            note: "Requires <b>" + settings.names.Tags4a + "</b> enabled",
            info: "<b>" + settings.names.Tags4b + "</b> tags are a subset of <b>" + settings.names.Tags4a + "</b> tags."
        },
        Tags4c: {
            note: "Requires <b>" + settings.names.Tags4a + "</b> enabled",
            info: "<b>" + settings.names.Tags4c + "</b> tags are a subset of <b>" + settings.names.Tags4a + "</b> tags."
        },
        Tags5a: {
            note: "Main <b>" + settings.names.Tags5a + "</b> Tags",
            info: "Enable highlighting for <b>" + settings.names.Tags5a + "</b> tags. These will appear in torrent lists."
        },
        Tags5b: {
            note: "Requires <b>" + settings.names.Tags5a + "</b> enabled",
            info: "<b>" + settings.names.Tags5b + "</b> tags are a subset of <b>" + settings.names.Tags5a + "</b> tags."
        },
        Tags5c: {
            note: "Requires <b>" + settings.names.Tags5a + "</b> enabled",
            info: "<b>" + settings.names.Tags5c + "</b> tags are a subset of <b>" + settings.names.Tags5a + "</b> tags."
        },
        Tags6a: {
            note: "Main <b>" + settings.names.Tags6a + "</b> Tags",
            info: "Enable highlighting for <b>" + settings.names.Tags6a + "</b> tags. These will appear in torrent lists."
        },
        Tags6b: {
            note: "Requires <b>" + settings.names.Tags6a + "</b> enabled",
            info: "<b>" + settings.names.Tags6b + "</b> tags are a subset of <b>" + settings.names.Tags6a + "</b> tags."
        },
        Tags6c: {
            note: "Requires <b>" + settings.names.Tags6a + "</b> enabled",
            info: "<b>" + settings.names.Tags6c + "</b> tags are a subset of <b>" + settings.names.Tags6a + "</b> tags."
        },
        Tags7a: {
            note: "Main <b>" + settings.names.Tags7a + "</b> Tags",
            info: "Enable highlighting for <b>" + settings.names.Tags7a + "</b> tags. These will appear in torrent lists."
        },
        Tags7b: {
            note: "Requires <b>" + settings.names.Tags7a + "</b> enabled",
            info: "<b>" + settings.names.Tags7b + "</b> tags are a subset of <b>" + settings.names.Tags7a + "</b> tags."
        },
        Tags7c: {
            note: "Requires <b>" + settings.names.Tags7a + "</b> enabled",
            info: "Enable highlighting for <b>" + settings.names.Tags7c + "</b> tags. These will appear in torrent lists."
        },
        Tags7d: {
            note: "Requires <b>" + settings.names.Tags7a + "</b> enabled",
            info: "<b>" + settings.names.Tags7d + "</b> tags are a subset of <b>" + settings.names.Tags7c + "</b> tags."
        },

    };


    // --- Settings Migration ---
    // Converts v0.7 Emp++ Tag Highlighter data to the new dynamic format.
    // Renames old keys and flag structures into the modern standardized layout.
    function migrateOldSettings(imported) {
        // --- Only run if version < 2.0 or missing ---
        if (!imported.majorVersion || imported.majorVersion < 2.0) {

            // Map old tag arrays to new dynamic tag keys
            const tagKeyMap = {
                good: "Tags1a",
                loved: "Tags1b",
                new1C: "Tags1c",
                performer: "Tags2a",
                loveperf: "Tags2b",
                new2C: "Tags2c",
                newperf: "Tags3a",
                amateur: "Tags4a",
                loveamat: "Tags4b",
                maleperf: "Tags5a",
                lovemale: "Tags5b",
                likesite: "Tags6a",
                lovesite: "Tags6b",
                disliked: "Tags7a",
                hated: "Tags7b",
                terrible: "Tags7c",
                useless: "Tags7d"
            };
            if (imported.tags) {
                for (const oldKey in tagKeyMap) {
                    const newKey = tagKeyMap[oldKey];
                    if (imported.tags[oldKey]) {
                        imported.tags[newKey] = imported.tags[oldKey];
                        delete imported.tags[oldKey];
                    }
                }
            }

            // Map old flags to new ones
            const flagMap = {
                useGoodTags: "useTag1aTags",
                useLovedTags: "useTag1bTags",
                usePerformerTags: "useTag2aTags",
                useLoveperfTags: "useTag2bTags",
                useNewperfTags: "useTag3aTags",
                useAmateurTags: "useTag4aTags",
                useLoveamatTags: "useTag4bTags",
                useMaleperfTags: "useTag5aTags",
                useLovemaleTags: "useTag5bTags",
                useLikesiteTags: "useTag6aTags",
                useLovesiteTags: "useTag6bTags",
                useDislikedTags: "useTag7aTags",
                useHatedTags: "useTag7bTags",
                useTerribleTags: "useTag7cTags",
                useUselessTags: "useTag7dTags",
                buttonGoodTags: "Tag1aButtonVisibility",
                buttonPerformerTags: "Tag2aButtonVisibility",
                buttonNewperfTags: "Tag3aButtonVisibility",
                buttonAmateurTags: "Tag4aButtonVisibility",
                buttonMaleperfTags: "Tag5aButtonVisibility",
                buttonLikesiteTags: "Tag6aButtonVisibility",
                buttonDislikedTags: "Tag7aButtonVisibility",
                // Version 2.0 -> 2.1
                buttonTag1aTags: "Tag1aButtonVisibility",
                buttonTag2aTags: "Tag2aButtonVisibility",
                buttonTag3aTags: "Tag3aButtonVisibility",
                buttonTag4aTags: "Tag4aButtonVisibility",
                buttonTag5aTags: "Tag5aButtonVisibility",
                buttonTag6aTags: "Tag6aButtonVisibility",
                buttonTag7aTags: "Tag7aButtonVisibility"
            };
            for (const oldFlag in flagMap) {
                const newFlag = flagMap[oldFlag];
                if (imported[oldFlag]) {
                    imported[newFlag] = imported[oldFlag];
                    delete imported[oldFlag];
                }
            }

            // Reset all tag display names to defaults if missing
            if (!imported.names) imported.names = {};
            const defaultNames = {
                Tags1a: "Liked",
                Tags1b: "Loved",
                Tags1c: "New1c",
                Tags2a: "Performer",
                Tags2b: "Loved Performer",
                Tags2c: "New2c",
                Tags3a: "New Performer",
                Tags3b: "Loved New Performer",
                Tags3c: "New3c",
                Tags4a: "Amateur",
                Tags4b: "Loved Amateur",
                Tags4c: "New4c",
                Tags5a: "Male Performer",
                Tags5b: "Loved Male",
                Tags5c: "New5c",
                Tags6a: "Liked Site",
                Tags6b: "Loved Site",
                Tags6c: "New6c",
                Tags7a: "Disliked",
                Tags7b: "Hated",
                Tags7c: "Terrible",
                Tags7d: "Useless"
            };
            for (const k in defaultNames) {
                if (!imported.names[k] || imported.names[k].trim() === "") {
                    imported.names[k] = defaultNames[k];
                }
            }

            // Update version marker
            imported.majorVersion = 2.0;
        }

        return imported;
    }
    // === END MIGRATION ===

    // === Ensure we handle missing or older version values
    if (typeof settings.majorVersion === "undefined" || settings.majorVersion < defaults.majorVersion) {
        settings.majorVersion = defaults.majorVersion;
        runFunction(saveSettings, 'swoa5wdzz3mfsrw3', []);
    }

    // === Detect the theme for compatibility.
    function detectEmpThemeFromStylesheets() {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        const themeLinks = links
        .map(link => link.href)
        .filter(href => href && href.match(/themes?|style/i));

        console.log("🎨 Stylesheet URLs:");
        themeLinks.forEach(url => console.log(" -", url));

        return themeLinks;
    }
    const themeStyles = detectEmpThemeFromStylesheets();

    const currentTheme = themeStyles.find(url => url.includes("afterdark/style.css")) ? "Afterdark" :
    themeStyles.find(url => url.includes("/deviloid/style.css")) ? "Deviloid" :
    themeStyles.find(url => url.includes("/watch_dogs/style.css")) ? "WatchDogs" :
    themeStyles.find(url => url.includes("/hempornium/style.css")) ? "Hempornium" :
    themeStyles.find(url => url.includes("/light/style.css")) ? "Light" :
    themeStyles.find(url => url.includes("/minimal/style.css")) ? "Minimal" :
    themeStyles.find(url => url.includes("/modern/style.css")) ? "Modern" :
    themeStyles.find(url => url.includes("/modern_red/style.css")) ? "Modern Red" :
    themeStyles.find(url => url.includes("/rochelle/style.css")) ? "Rochelle" :
    themeStyles.find(url => url.includes("/sarandafl/style.css")) ? "Sarandafl" :
    themeStyles.find(url => url.includes("/empornium/style.css")) ? "Empornium" :
    // HappyFappy
    themeStyles.find(url => url.includes("/standard/style.css")) ? "Standard" :
    themeStyles.find(url => url.includes("/bubblegum/style.css")) ? "Bubblegum" :
    "unknown";
    // Debug - Output Theme to Console
    console.log("🧩 Detected theme from stylesheet:", currentTheme);


    // === Theme-based color and saturation overrides ===
    const themeVisualMap = {
        Afterdark:   { green: [100, 180, 100], red: [180, 80, 80], maxAlpha: 0.25 },
        Deviloid:    { green: [100, 190, 100], red: [190, 85, 85], maxAlpha: 0.5 },
        WatchDogs:   { green: [50, 90, 50], red: [100, 50, 50], maxAlpha: 0.5 },
        Hempornium:  { green: [130, 210, 130], red: [210, 110, 110], maxAlpha: 0.25 },
        Light:       { green: [120, 200, 120], red: [210, 100, 100], maxAlpha: 0.5 },
        Minimal:     { green: [50, 90, 50], red: [180, 80, 80], maxAlpha: 0.6 },
        Modern:      { green: [110, 160, 110], red: [220, 110, 110], maxAlpha: 0.6 },
        ModernRed:   { green: [140, 220, 140], red: [230, 120, 120], maxAlpha: 0.5 },
        Rochelle:    { green: [135, 215, 135], red: [225, 115, 115], maxAlpha: 0.5 },
        Sarandafl:   { green: [130, 210, 130], red: [220, 110, 110], maxAlpha: 0.5 },
        Empornium:   { green: [120, 200, 120], red: [210, 100, 100], maxAlpha: 0.7 },
        Standard:    { green: [50, 90, 50], red: [100, 50, 50], maxAlpha: 0.5 },
        unknown:     { green: [120, 200, 120], red: [210, 100, 100], maxAlpha: 0.5 }
    };

        // --- HappyFappy - Adjust Bublegum Theme Colors
    if (settings.hfBetterBubblegum) {
        if (currentTheme === "Bubblegum") {
            const style = document.createElement("style");
            style.id = "Bubblegum-theme-fix";
            style.textContent = `body {background-color: #FCFCFC;}
            input[type=submit], input[type=button], button {background: #eee};
            input[type=submit]:hover, input[type=button]:hover, button:hover {background: #eee !important}
            input[type=submit]:hover, input[type=button]:hover, button:hover {background-color:#dadada !important; background-image:none !important; color:#111 !important;}
            #header, #modal_content {background-color: rgba(70,120,170,1);}
            #searchbars input.searchbox::-webkit-input-placeholder { color: #fff; opacity: 1;}`;
            document.head.appendChild(style);
        }
    }

    // Default numeric values for tag effect on percent bar and torrent coloring
    // Migration: old categories → numeric values From 2.0
    // Very Good = +2, Good = +1, Ignore = 0, Bad = -1, Very Bad = -2
    if (!settings.tagValues) {
        settings.tagValues = {
            Tags1a: 1,
            Tags1b: 2,
            Tags1c: 0,
            Tags2a: 1,
            Tags2b: 2,
            Tags2c: 0,
            Tags3a: 1,
            Tags3b: 2,
            Tags3c: 0,
            Tags4a: 1,
            Tags4b: 2,
            Tags4c: 0,
            Tags5a: 1,
            Tags5b: 2,
            Tags5c: 0,
            Tags6a: 1,
            Tags6b: 2,
            Tags6c: 0,
            Tags7a: -1,
            Tags7b: -2,
            Tags7c: -2,
            Tags7d: 0
        };
    }

    // Migration for old string values (if present)
    for (const [key, val] of Object.entries(settings.tagValues)) {
        if (typeof val === "string") {
            switch (val) {
                case "verygood": settings.tagValues[key] = 2; break;
                case "good": settings.tagValues[key] = 1; break;
                case "ignore": settings.tagValues[key] = 0; break;
                case "bad": settings.tagValues[key] = -1; break;
                case "verybad": settings.tagValues[key] = -2; break;
            }
        }
    }



    // === Dynamic Tags7d (Previously "Useless" Tags) Visibility ===
    (function apply7dVisibilitySetting() {
        // Remove any previous rule to avoid duplicates
        $j("#dynamic-7d-visibility").remove();

        // Create a new style element
        const style = document.createElement("style");
        style.id = "dynamic-7d-visibility";

        if (settings.hideTags7dTags) {
            // Hide Tags7d everywhere EXCEPT on the tags listing page (body.emp-tags-page)
            style.textContent = "body:not(.emp-tags-page) span.s-tag.s-Tag7d { display:none !important; }";
        } else {
            // When the toggle is OFF, ensure they show everywhere
            style.textContent = "span.s-tag.s-Tag7d { display:inline-block !important; }";
        }

        document.head.appendChild(style);
    })();




    // === Adjust Tags for Compact, Normal, or Roomy layouts. ===
    // --- Compact is most similat to 0.7
    (function applyTagLayoutStyle() {
        const styleId = "dynamic-tag-layout-style";
        const $style = document.getElementById(styleId);
        if ($style) $style.remove();

        const style = document.createElement("style");
        style.id = styleId;

        let css = `
           .s-browse-tag-holder .s-tag,
           .s-tag a {display: inline-block; vertical-align: baseline !important; box-sizing: border-box !important; }
           #torrent_tags_list li .s-tag a {border-radius: 0px !important; }
        `;

        switch (settings.tagLayoutStyle) {
            case "compact":
                css += `
        .s-browse-tag-holder { line-height: 18px !important; }
        .s-browse-tag-holder .s-tag { padding: 0px 4px !important; margin: 1px 0px !important; font-size: 12px !important; line-height: 1.5 !important; border-bottom: 0px !important;}
        .s-tag a { padding: 0px !important; margin: 1px 0px !important; font-size: 12px !important; line-height: 1.3 !important; }
        #torrent_tags_list li { margin: 1px 10px; }
        #torrent_tags_list li .s-tag a { font-size: 11px !important; line-height: 1.2 !important; padding: 0px 1px 1px 0px !important; }
        #taglist-container .box_tags #torrent_tags li {height: 18px}
        `;
                break;

            case "roomy":
                css += `
        .s-browse-tag-holder { line-height: 24px !important; }
        .s-browse-tag-holder .s-tag { padding: 1px 2px !important; margin: 1px 2px !important; font-size: 13px !important; line-height: 2.6 !important;}
        .s-tag a { padding: 0px 2px !important; margin: 3px 0px !important; font-size: 13px !important; line-height: 1.3 !important; }
        #torrent_tags_list li { margin: 3px 10px; }
        #torrent_tags_list li .s-tag a { font-size: 13px !important; line-height: 1.2 !important; padding: 2px 3px !important; }
        #taglist-container .box_tags #torrent_tags li {height: 24px}
        `;
                break;

            default: // Normal
                css += `
        .s-browse-tag-holder { line-height: 20px !important; }
        .s-browse-tag-holder .s-tag { padding: 0px 0px !important; margin: 2px 1px !important; font-size: 12px !important; line-height: 1.9 !important;}
        .s-tag a { padding: 1px 4px !important; margin: 0px 0px !important; font-size: 13px !important; line-height: 1.3 !important; }
        #torrent_tags_list li { margin: 3px 10px; }
        #torrent_tags_list li .s-tag a { font-size: 13px !important; line-height: 1 !important; padding: 0px 1px 1px 0px !important; }
        #taglist-container .box_tags #torrent_tags li {height: 22px}
        `;
                break;
        }
        style.textContent = css;
        document.head.appendChild(style);
    })();

    // --- ADD (helpers for border weight units) ---
    function ensurePx(v) {
        // turn 0|1|2|"1"|"1px" into a string with a px unit
        if (v == null) return "";
        const s = String(v).trim();
        if (s === "") return "";
        return /^\d+(\.\d+)?px$/i.test(s) ? s : (parseFloat(s) + "px");
    }

    function stripPx(v) {
        // turn "1px" -> "1", "1.5px" -> "1.5", "2" -> "2"
        if (v == null) return "";
        const m = String(v).trim().match(/^(\d+(?:\.\d+)?)(?:px)?$/i);
        return m ? m[1] : "";
    }

    // === UI Builder: Dynamic Generators ===
    // --- Dynamically generate HTML instead of large repetetive blocks ---

    // --- Build General Tab Rows
    function buildGeneralRow(tagKey) {
        const name = settings.names[tagKey];
        const meta = TAG_META[tagKey] || { info: "" };
        const colorObj = settings.colors[tagKey];
        const hideCheckbox = (FILTERED_NON_A_TAGS_KEYS.includes(tagKey))
        ? "—"
        : "<input class='s-conf-gen-checkbox' type='checkbox' name='" + tagKey.replace("Tags", "Tag") + "ButtonVisibility'/>";

        return (
            "<tr>" +
            "<td><button class='info-btn' data-info='" + meta.info + "'>ℹ</button></td>" +
            "<td><button class='edit-label' data-name='" + tagKey + "'>✎</button></td>" +
            "<td class='label-cell' data-name='" + tagKey + "'>" + name + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='use" + tagKey.replace("Tags", "Tag") + "Tags'/></td>" +
            "<td>" + hideCheckbox + "</td>" +
            "<td>" + buildTagValueSpinner(tagKey) + "</td>" +
            "<td><input type='color' class='tag-color-picker' id='color-" + tagKey + "-bg' value='" + colorObj.background + "'/></td>" +
            "<td><input type='color' class='tag-color-picker' id='color-" + tagKey + "-text' value='" + colorObj.text + "'/></td>" +
            "<td><input type='color' class='tag-color-picker' id='border-" + tagKey + "-color' value='" + colorObj.borderColor + "'/></td>" +
            "<td><select id='border-" + tagKey + "-style'>" +
            "<option value='solid' " + (colorObj.borderStyle === "solid" ? "selected" : "") + ">Solid</option>" +
            "<option value='dashed' " + (colorObj.borderStyle === "dashed" ? "selected" : "") + ">Dashed</option>" +
            "</select></td>" +
            "<td>" + buildborderWeightSpinner(tagKey) + "</td>" +
            "<td><span id='sample-" + tagKey + "' class='sample-tag'>Sample.Tag" +
            "<div class='s-button s-remove-" + tagKey + "' title='Un-Mark tag as " + name + "'>–</div>" +
            "</span></td>" +
            "</tr>"
        );
    }

    // --- Creates Tag Value Spinners (Good / Bad Weights)
    function buildTagValueSpinner(tagKey) {
        var v = (typeof settings.tagValues[tagKey] === 'number') ? settings.tagValues[tagKey] : 0;
        var html = '<div class="spinner" data-tag="' + tagKey + '">';
        html += '<button type="button" class="decrement">◀</button>';
        html += '<input type="number" class="tag-value-spinner" min="-20" max="20" step="1" value="' + v + '" readonly />';
        html += '<button type="button" class="increment">▶</button>';
        html += '</div>';
        return html;
    }

    // --- Creates Border Weight Spinners (1px, 2px, 3px Tag Borders)
    function buildborderWeightSpinner(tagKey) {
        const raw = (settings.colors && settings.colors[tagKey] && settings.colors[tagKey].borderWeight) || 0;
        const value = stripPx(raw); // <-- ensure the input shows a bare number
        let html = '<div class="spinner" data-tag="' + tagKey + '">';
        html += '<button type="button" class="decrement">◀</button>'; // match value spinner
        html += '<input type="number" class="border-weight-spinner" id="border-' + tagKey + '-weight" ' +
            'value="' + value + '" min="0" max="4" step="1" readonly />';
        html += '<button type="button" class="increment">▶</button>'; // match value spinner
        html += '</div>';
        return html;
    }

    // -- Dynamically generates tabbed configuration sections for each tag type.
    function buildTagPanel(tagKey) {
        var name = settings.names[tagKey];
        return (
            "<div class='s-conf-page' id='s-conf-" + tagKey + "-tags'>" +
            "<label title='Space-separated. '>Add " + name + " Tags:<br/>" +
            "<input id='s-conf-add-" + tagKey + "' class='s-conf-add-tags' type='text' placeholder='Space-separated. '/>" +
            "<input class='s-conf-add-btn' data-type='" + tagKey + "' value='Add Tags' type='button'/>" +
            "</label><br/>" +
            "<label title='Space-separated. '>Remove " + name + " Tags:<br/>" +
            "<input id='s-conf-remove-" + tagKey + "' class='s-conf-remove-tags' type='text' placeholder='Space-separated. '/>" +
            "<input class='s-conf-remove-btn' data-type='" + tagKey + "' value='Remove Tags' type='button'/>" +
            "</label><br/>" +
            "<label><h2>" + name + " Tags - If enabled, these tags will be highlighted:</h2>" +
            "<textarea readonly id='s-conf-text-" + tagKey + "' class='s-conf-tag-txtarea'></textarea></label>" +
            "</div>"
        );
    }

    function openTagPopup(tagKey) {
        const panelId = "s-conf-" + tagKey + "-tags";
        const originalPanel = document.getElementById(panelId);
        if (!originalPanel) return;

        const popup = document.createElement("div");
        popup.className = "tag-popup";
        popup.innerHTML = `
        <div class="tag-popup-inner">
            <button class="tag-popup-close">×</button>
            <h3>${settings.names[tagKey]} Tag Manager</h3>
            ${originalPanel.innerHTML.replace(
            new RegExp(`s-conf-text-${tagKey}`, "g"),
            `popup-conf-text-${tagKey}`
        )}
        </div>
    `;
        document.body.appendChild(popup);

        // ✅ Populate the textarea with current tags
        runFunction(displayTags, 'hb9de35yg39tvcre', [tagKey, "#popup-conf-text-" + tagKey]);
        // Rebind Add Tags button
        const addBtn = popup.querySelector(`.s-conf-add-btn[data-type="${tagKey}"]`);
        if (addBtn) {
            addBtn.addEventListener("click", () => {
                const input = popup.querySelector(`#s-conf-add-${tagKey}`);
                const tagsToAdd = input?.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
                if (tagsToAdd.length) {
                    addTags(tagKey, tagsToAdd); // ✅ use original function
                    runFunction(displayTags, '2j0rwp3iag1nvpsf', [tagKey, `#popup-conf-text-${tagKey}`]);
                    input.value = "";
                }
            });
        }

        // Rebind Remove Tags button
        const removeBtn = popup.querySelector(`.s-conf-remove-btn[data-type="${tagKey}"]`);
        if (removeBtn) {
            removeBtn.addEventListener("click", () => {
                const input = popup.querySelector(`#s-conf-remove-${tagKey}`);
                const tagsToRemove = input?.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
                if (tagsToRemove.length) {
                    runFunction(removeTags, '8d7uyeomksdxpfu3', [tagKey, tagsToRemove]);
                    runFunction(displayTags, '57d8mc6ai07n8pft', [tagKey, `#popup-conf-text-${tagKey}`]);
                    input.value = "";
                }
            });
        }
        popup.querySelector(".tag-popup-close").addEventListener("click", () => {
            popup.remove();
        });
    }

    // --- Build the html for the settings interface ---
    function buildSettingsHTML() {
        // Debug
        //console.group("🧩 buildSettingsHTML() Debug");
        //console.log("settings.names snapshot at build start:", JSON.parse(JSON.stringify(settings.names)));

        var configHTML =
            "<div id='s-conf-background'>" +
            "<div id='s-conf-wrapper'>" +
            "<h1>Empornium++Tag Highlighter Settings</h1>" +
            "<div id='s-conf-status'></div>" +

            // All the Tabs!!
            "<div class='tab-row-container'" +
            "<ul class='tab-row'>" +
            "<li data-page='s-conf-general' class='s-selected'><a class='s-conf-tab' >General</a></li>" +
            "<li data-page='s-conf-tag-styles'><a class='s-conf-tab'>Tag Styles</a></li>" +
            "<li data-page='s-conf-tag-manager'><a class='s-conf-tab'>Tag List Manager</a></li>" +
            "<li data-page='s-conf-dupe-cleanup'><a class='s-conf-tab'>Dupe Cleanup</a></li>" +
            "<li data-page='s-conf-import-export'><a class='s-conf-tab'>Import/Export</a></li>" +
            "</ul>" +
            "</div>";

        // --- The General Settings Tab
        let styleRowsHTML = "";
        for (const key of ALL_TAGS_KEYS) {
            styleRowsHTML += buildGeneralRow(key);
        }

        configHTML +=
            "<div id='s-conf-content'>" +
            "  <form id='s-conf-form'>" +
            "    <div class='s-conf-page s-selected' id='s-conf-general'>" +


            // --- 📄General Tab - Checkboxes - Torrent Display Settings
            // --- Tag Layout Density (Compact, Normal, Roomy)
            "<h2 style='display:flex; align-items:center; justify-content:space-between; gap:8px;'>Torrent Display Options:</h2>" +
            // --- Torrent Options Checkboxes
            "  <div class='torrent-options-select'>" +
            "    <label style='font-weight:normal; font-size:13px; display:flex; align-items:center; gap:6px; margin:0;'>" +
            "      Listing Page Tag Layout:" +
            "      <select class='s-conf-select' name='tagLayoutStyle' style='font-size:13px; padding:2px 4px;'>" +
            "        <option value='compact'>Compact</option>" +
            "        <option value='normal' selected>Normal</option>" +
            "        <option value='roomy'>Roomy</option>" +
            "      </select>" +
            "    </label>" +
            "   </div>" +
            "<div class='torrent-options'>" +
            // ✅ Percent bar
            "<label title='Show a color bar representing good vs bad tags'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='usePercentBar'/> Use Percent Bar</label>" +
            // ✅ HTML table tooltip for percentbar stats
            "<label title='Use PercentBar HTML tooltip for percent bar breakdown'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='usePBHtmlTooltip'/> Percentbar HTML Tooltip</label>"+
            // ✅ Torrent opactiy (Might not even work! in 2.0)
            "<label title='Adjust torrent opacity based on performance score'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='useTorrentOpacity'/> Use Opacity on Torrents</label>" +
            // ✅ Torrent row coloring (Green = Good - Red = Bad)
            "<label title='Color torrents according to tag scores (green=good, red=bad)'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='useTorrentColoring'/> Use Color on Torrents</label>" +
            // ✅ Notice for hidden blacklist borrents (I think, Untested in 2.x)
            "<label title='Display a notice when a torrent contains blacklisted tags'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='useTorrentBlacklistNotice'/> Use Blacklist Notice</label>" +
            // ✅ Notice for hidden blacklist torrents on bookmarks page (I think, Untested in 2.x)
            "<label title='Also apply blacklist notice logic to bookmarked torrents'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='useBlacklistNoticeBookmark'/> Include Bookmarks</label>" +
            // ✅ Notice for hidden blacklist torrents on collage page (I think, Untested in 2.x)
            "<label title='Also apply blacklist notice logic to collage items'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='useBlacklistNoticeCollages'/> Include Collages</label>" +
            // ✅ Should we hide torrents with Tags7c formerly "Blacklist" - Option for anyone repurposing this.
            "<label title='Hide torrents that contain " + settings.names.Tags7c + " tags'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='hideTags7cTorrents'/> Hide torrents with " + settings.names.Tags7c + " Tags</label>" +
            // ✅ Should we hide torrents with Tags7d formerly "Useless" - Option for anyone repurposing this.
            "<label title='Hide " + settings.names.Tags7d + " tags entirely from view'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='hideTags7dTags'/> Hide " + settings.names.Tags7d + " Tags</label>" +
            // ✅ Change tags to not use the default italics font.
            "<label title='Removes italics from tags (Torrent List Page)'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='disableItalics'/> Disable Italic Tags (List Page)</label>" +
            "</div>" +
            "<h2 style='display:flex; align-items:center; justify-content:space-between; gap:8px;'>Site Specific Options:</h2>" +
            "<div class='site-options'>" +
            // ✅ Change tags to not use the default italics font.
            "<label title='Applies more neutral colors to the happyfappy light theme - Bubblegum'>" +
            "<input class='s-conf-gen-checkbox' type='checkbox' name='hfBetterBubblegum'/> HappyFappy - Neutral Bubblegum Theme</label>" +
            "</div>" +
            "</div>" +

            // --- 📄 Tag Style Page
            "<div class='s-conf-page' id='s-conf-tag-styles'>" +
            "<h2>Tag Styles</h2>" +
            "<table class='s-conf-tag-table'>" +
            "<thead>" +
            "<tr>" +
            "<th></th>" +
            "<th></th>"+
            "<th>Name</th>" +
            "<th>Enable</th>" +
            "<th>Hide</th>" +
            "<th>Value <span class='info-header-icon' data-tooltip='Affects the percent bar (if enabled)'>i</span></th>" +
            "<th>Background</th>" +
            "<th>Text</th>" +
            "<th>Border</th>" +
            "<th>Border Style</th>" +
            "<th>Border Weight</th>" +
            "<th>Sample</th>" +
            "</tr>" +
            "</thead>" +
            "<tbody>" +
            styleRowsHTML +
            "</tbody>" +
            "</table>" +
            "</div>";

        // === Dynamically append Add/Remove/Display panels for each tag type ===

        (function () {
            for (const key of ALL_TAGS_KEYS) {
                var panelHTML = buildTagPanel(key);
                // console.log("Generated HTML for " + key + ":\n", panelHTML); // 🐞Debug Output to console
                configHTML += panelHTML;
            }
        })();




        configHTML +=
            // --- 📄Tag-Manager Page ---
            "<div class='s-conf-page' id='s-conf-tag-manager'>" +
            "<h2>Tag List Manager</h2>" +
            "Category Filter:" +
            "<select id='tag-filter'>" +
            "<option value='all'>All</option>" +
            "<option value='enabled'>Enabled</option>" +
            "</select>" +
            "<br><br><p>Click a category below to manage its tags:</p>" +
            "<div id='tag-manager-buttons' class='tag-grid'></div>" +
            "</div>";

        (function () {
            // Function to build tag buttons based on filter
            function buildTagButtons(filter) {
                const buttonContainer = document.getElementById("tag-manager-buttons");
                if (!buttonContainer) return;

                // Clear existing buttons
                buttonContainer.innerHTML = "";

                for (const key of ALL_TAGS_KEYS) {
                    const name = settings.names[key];

                    // Check filter
                    if (filter === "enabled") {
                        const settingKey = `use${key.replace(/^Tags/, "Tag")}Tags`; // e.g., Tags1a → Tag1a → useTag1aTags
                        if (!settings[settingKey]) continue; // Skip if disabled

                    }

                    // Create button
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = `tag-manager-btn s-tag s-${key.replace(/^Tags/, "Tag")}`;
                    btn.textContent = name;
                    btn.dataset.tagKey = key;
                    btn.addEventListener("click", () => openTagPopup(key));
                    buttonContainer.appendChild(btn);
                }
            }

            // Wait until the tag manager container is in the DOM
            const interval = setInterval(() => {
                const buttonContainer = document.getElementById("tag-manager-buttons");
                const dropdown = document.getElementById("tag-filter");
                if (buttonContainer && dropdown) {
                    clearInterval(interval);

                    // Get last saved filter or default to 'all'
                    const savedFilter = localStorage.getItem("tagFilter") || "all";
                    dropdown.value = savedFilter;

                    // Initial build
                    runFunction(buildTagButtons, '9ez324thhnsm3pi7', [savedFilter]);

                    // Add change listener to dropdown
                    dropdown.addEventListener("change", () => {
                        const newFilter = dropdown.value;
                        localStorage.setItem("tagFilter", newFilter); // Save selection
                        runFunction(buildTagButtons, 'xwb1fl4hx1q14eao', [newFilter]);
                    });

                    // ✅ Add refresh on tab click here
                    document.addEventListener("click", function (e) {
                        const tab = e.target.closest("li[data-page='s-conf-tag-manager']");
                        if (tab) {
                            const currentFilter = dropdown ? dropdown.value : "all";
                            runFunction(buildTagButtons, 'fbmv84kn3vhyhwpt', [currentFilter]);
                        }
                    });

                }
            }, 100);
        })();



        configHTML +=
            // --- 📄 Import / Export Tab ---
            "<div class='s-conf-page' id='s-conf-import-export'>" +
            "<h3>Export Settings</h3>" +
            "<hr>" +
            "<p>To backup your settings, copy below text to a local file. You can import these settings in the Import Settings area.</p>" +
            "<textarea id='export-settings-textarea' rows='10' cols='100' readonly></textarea><br><br>" +
            "<br>" +
            "<h3>Import Settings</h3>" +
            "<hr><br>" +
            "<textarea id='import-settings-textarea' rows='10' cols='100' placeholder='Paste your exported settings here.'></textarea><br><br>" +
            "<button id='import-settings-button'>Import Settings</button>" +
            "</div>" +

            // --- 📄 Duplicate Category Cleanup Tab ---
            "<div class='s-conf-page' id='s-conf-dupe-cleanup'>" +
            "<h2>Duplicate Tag Cleanup</h2>" +
            "<p>These tags exist in more than one list. Select the proper category. The tag will be removed from all others.)</p>" +
            "<div id='dupeCleanupList' style='max-height:400px; overflow-y:auto; border:1px solid #333; padding:8px; margin-top:10px; font-family:monospace; white-space:pre;'>(Click the Dupe Cleanup tab to refresh the list)</div>" +
            "</div>" +
            "</form>" +
            "</div>" +
            "<div class='s-conf-buttons'>" +
            "<input id='s-conf-save-general' class='s-conf-save' data-page='s-conf-general' type='button' value='Save Settings'/>" +
            "<input id='s-conf-close' type='button' value='Close'/>" +
            "</div>" +
            "</div>" +
            "</div>";
        // Debug
        //console.log("settings.names snapshot at build end:", JSON.parse(JSON.stringify(settings.names)));
        //console.groupEnd();
        console.log("🟣 Built New HTML");
        return configHTML;
    }


    // --- Stylesheet Injection ---
    var stylesheet = `
      <style type="text/css">
        #torrent_tags>li{border-bottom:1px solid #999; padding-bottom:2px;}

        #s-conf-form {display:block; background:#fff; padding:15px; min-height: 350px;}
        #s-conf-form label {display:block;}
        #s-conf-form, #s-conf-form select, #s-conf-form input {background: #eee;}
        #s-conf-close, #s-conf-save-general {background: #eee;}
        #export-settings-textarea, #import-settings-textarea {background: #eee; color: black}

        .s-conf-tag-table {border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; line-height: 1.1;table-layout: auto;}
        .s-conf-tag-table th, .s-conf-tag-table td { border: 1px solid #ccc; padding: 1px 4px; text-align: Center}
        .s-conf-tag-table th, .s-conf-tag-table tr, .s-conf-tag-table tr input, .s-conf-tag-table tr select {background: #eee;}
        .s-conf-tag-table th:first-child, .s-conf-tag-table td:first-child { width: 26px; text-align: center; padding: 0; }
        .s-conf-tag-table input[type='checkbox'] { transform: scale(1.1); margin: 0; vertical-align: middle; }
        .s-conf-tag-table select.tag-value-select { font-size: 11px; padding: 1px 1px; }
        .s-conf-tag-table td:nth-child(6) { text-align: center; }
        .s-conf-tag-table td:nth-child(5) { text-align: center; }


        .torrent-options-select {display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 20px 20px 20px 20px; }
        .torrent-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 20px 20px 20px; }
        .torrent-options label { display: flex; align-items: center; white-space: nowrap; }

        .site-options-select {display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 20px 20px 20px 20px; }
        .site-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 20px 20px 20px; }
        .site-options label { display: flex; align-items: center; white-space: nowrap; }

      /* Info button */
        .info-btn { cursor: pointer; font-size: 14px; border: none; background: none; color: #444; padding: 0; line-height: 1;}
        .info-btn:hover { color: #000; }
      /* Modal overlay and content */
        .info-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; z-index: 9999; }
        .info-modal { background: #fff; border-radius: 6px; padding: 16px 20px; width: 420px; max-width: 90%; max-height: 80%; overflow-y: auto; box-shadow: 0 2px 12px rgba(0,0,0,0.4); font-size: 13px; line-height: 1.4; position: relative; }
        .info-modal h3 { margin-top: 0; }
        .info-modal-close { position: absolute; top: 6px; right: 10px; border: none; background: none; font-size: 18px; cursor: pointer; color: #666; }
        .info-modal-close:hover { color: #000; }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {-webkit-appearance: none;margin: 0;}
        input[type="number"] {-moz-appearance: textfield; /* Firefox */}
        .tag-color-picker {width: 40px; height: 23px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; padding: 0;display: inline-block;}
        .s-conf-tag-table td {text-align: center; vertical-align: middle;}
        .spinner {display: inline-flex; align-items: center; gap: 4px;}
        .spinner button {background: #ccc;border: 1px solid #888;padding: 1px 1px;cursor: pointer;font-size: 10px;}
        .spinner button:hover {background: #bbb;}
        .tag-value-spinner {width: 30px;text-align: center;font-size: 12px;border: 1px solid #888;box-sizing: border-box;padding: 0;}
        .border-weight-spinner {width: 30px;text-align: center;font-size: 12px;border: 1px solid #888;box-sizing: border-box;padding: 0;}
        #s-conf-general > table > tbody div > input {padding: 1px 1px;}
        #s-conf-background{position:fixed; top:0; bottom:0; left:0; right:0; z-index:1000; background-color:rgba(50,50,50,0.6);}
        #s-conf-wrapper{background:#eee; color:#444; position:relative; width:90%; min-width:900px; max-width:1200px; overflow:hidden; margin:50px auto; font-size:14px;padding:15px 20px; border-radius:16px; box-shadow: 0 0 20px black;max-height:90vh;overflow-y:auto;overflow-x:hidden;z-index:9999;}
        #s-conf-wrapper h2{margin: 5px; background:none; text-align:left; color:#444; padding:0; border-radius: unset;}
        #s-conf-status{padding:8px; line-height:16px; text-align:center; border:1px solid #ddd; margin-top:15px; display:none;}
        #s-conf-status.s-success{border-color:#135300; background:#A9DF9C;}
        #s-conf-status.s-error{border-color:#840000; background:#F3AAAA;}
        #s-conf-status-close{cursor:pointer;}
        #s-conf-tabs{width:100%; margin:15px 0 -1px 0; overflow:hidden; cursor:pointer;}
        #s-conf-tabs li, #s-conf-tabs h2{ border: 1px solid #444; border-bottom: 0; border-radius: 4px 4px 0 0; line-height: normal; width: 130px; margin:0; list-style:none;float:left;}
        #s-conf-content{width:100%; overflow:hidden; border:1px solid #444; border-radius:4px; border-top-left-radius: 0px; box-shadow:0 -1px 10px rgba(0,0,0,0.6);}
        .tab-row-container {height: 40px;box-sizing: border-box;  display: flex;cursor:pointer;}
        .tab-row-container li {display:inline-block;height: 30px;flex: 1; list-style: none; margin: 0; border: 1px solid #444; border-bottom: 0; border-radius: 4px 4px 0 0; line-height: normal; text-align: center;padding:5px;}
        .tab-row-container a {color:#444;display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;box-sizing:border-box;height:30px;max-height:30px;min-height:20px;padding:0 0px;line-height:1;white-space:normal;overflow:hidden;text-overflow:ellipsis;font-size:clamp(11px,0.8vw,14px);transition:font-size 0.15s ease;}
        .tab-row-container a:hover { text-decoration:none; color: black;}
        .tab-row-container li:hover {background-color: white;}
        .tab-row-container li.s-selected {background-color:#fff;text-decoration:none; color:black}

        .s-conf-buttons{display: flex; justify-content: center; margin-top:10px; width:100%; gap: 12px; text-align:center;}
        .s-conf-page{display:none;}
        .s-conf-page.s-selected{display:block;}
        .s-conf-page input{vertical-align:text-bottom;}
        #s-conf-general label{cursor:pointer;}
        #s-conf-general img{margin-bottom:10px; display:none;}
        #s-conf-general a:hover+img{display:block;}
        .s-conf-tag-txtarea{width:100%; height:300px; background:#ddd; word-spacing:10px; line-height:18px;box-sizing:border-box;}
        .s-conf-add-tags, .s-conf-remove-tags{width:100%;}
        .s-conf-add-btn, .s-conf-remove-btn{width:110px;}
        .s-conf-color-columns { display:block; width:100%; }
        .s-conf-color-table { width:100%; border-collapse:collapse; margin-top:6px; }
        .s-conf-color-table th, .s-conf-color-table td { border:1px solid #ccc; padding:2px 4px; line-height:1.2; font-size:13px; text-align:center; }
        .sample-tag { display:inline-block; padding:1px 6px; border-radius:8px; font-weight:normal; }
        .sample-tag .sample-remove { margin-left:4px; color:#000; text-decoration:none; cursor:default; }
        .sample-tag .sample-remove:hover { text-decoration:none; }
        ul.s-Tag7d-tags span.s-tag.s-Tag7d{display:inline-block !important; float:none; background:#AAA; border-bottom:1px solid #444; padding:0px 4px; border-radius:16px;font-weight:normal;}
        #s-toggle-forum{margin:0 5px; font-size:0.9em; cursor:pointer;}
        .info-header-icon{display:inline-block;width:14px;height:14px;margin-left:4px; border-radius:50%;background:#8BA9C4;color:#fff!important;font:bold 11px/14px Arial,sans-serif; text-align:center;cursor:help;}
        .info-header-icon:hover{background:#8BA9C4;}
        .info-header-icon,.info-btn{display:inline-block;width:14px;height:14px;margin-left:4px; border:none;border-radius:50%;background:#8BA9C4;color:#fff!important; font:bold 11px/14px Arial,sans-serif;text-align:center;cursor:pointer;vertical-align:middle;}
        .info-header-icon:hover,.info-btn:hover{background:#8BA9C4;}
        .s-browse-tag-holder {padding: 0; float: none; clear: both; position: relative; margin-top: 5px;}
        .s-browse-tag-holder>.s-tag{display:inline; float:none;}
        .s-Tag7c-hidden{cursor: pointer; padding:10px;}
        .s-percent-container {display: block; overflow: hidden; height: 4px; margin: 2px 0 3px 0; background: #ccc; border: 1px solid #aaa;}
        .s-percent{height:4px;}
        .s-percent-good{background:#A9DF9C; float:left;}
        .s-percent-bad{background:#9E3333; float:right}
        .s-percent-undef { background:#999; float:right; }
        .tag_inner .s-tag{background:#CCC; border-bottom:1px solid #888; border-radius:16px; padding:1px 5px;}
        .tag_inner .s-tag> a{color:#000000}
        .tag_inner span.s-tag {border-width: 2px; display:block; float:left; line-height: 18px; margin: 2px 3px; padding: 0 6px; white-space: nowrap;}
        .s-button{float:left; width:15px; height:14px; border-radius:6px; color:#fff; font:bold 16px/15px Arial, sans-serif; text-align:center; margin:1px 3px 1px 0px; cursor:pointer; opacity:0.8;}
        .s-button:hover{opacity:1;}
        .s-remove-Tags1a, .s-remove-Tags2a, .s-remove-Tags2b, .s-remove-Tags5a, .s-remove-Tags5b, .s-remove-Tags7a, .s-remove-Tags7b, .s-remove-Tags7c, .s-remove-Tags7d, .s-add-Tags7d{line-height:11px;}
        .s-tag{margin:1px 2px;}
        .s-tag .s-button{display:none;}
        .s-tag .s-add-Tags1a, .s-tag .s-add-Tags2a, .s-tag .s-add-Tags3a, .s-tag .s-add-Tags4a, .s-tag .s-add-Tags5a, .s-tag .s-add-Tags6a, .s-tag .s-add-Tags7a{display:block}
        .s-tag.s-Tag1a .s-button, .s-tag.s-Tag1b .s-button, .s-tag.s-Tag1c .s-button,
        .s-tag.s-Tag2a .s-button, .s-tag.s-Tag2b .s-button, .s-tag.s-Tag2c .s-button,
        .s-tag.s-Tag3a .s-button, .s-tag.s-Tag3b .s-button, .s-tag.s-Tag3c .s-button,
        .s-tag.s-Tag4a .s-button, .s-tag.s-Tag4b .s-button, .s-tag.s-Tag4c .s-button,
        .s-tag.s-Tag5a .s-button, .s-tag.s-Tag5b .s-button, .s-tag.s-Tag5c .s-button,
        .s-tag.s-Tag6a .s-button, .s-tag.s-Tag6b .s-button, .s-tag.s-Tag6c .s-button,
        .s-tag.s-Tag7a .s-button, .s-tag.s-Tag7b .s-button, .s-tag.s-Tag7c .s-button{display:none}
        .s-tag.s-Tag1a .s-button.s-remove-Tags1a, .s-tag.s-Tag1b .s-button.s-remove-Tags1b, .s-tag.s-Tag1c .s-button.s-remove-Tags1c,
        .s-tag.s-Tag2a .s-button.s-remove-Tags2a, .s-tag.s-Tag2b .s-button.s-remove-Tags2b, .s-tag.s-Tag2c .s-button.s-remove-Tags2c,
        .s-tag.s-Tag3a .s-button.s-remove-Tags3a, .s-tag.s-Tag3b .s-button.s-remove-Tags3b, .s-tag.s-Tag3c .s-button.s-remove-Tags3c,
        .s-tag.s-Tag4a .s-button.s-remove-Tags4a, .s-tag.s-Tag4b .s-button.s-remove-Tags4b, .s-tag.s-Tag4c .s-button.s-remove-Tags4c,
        .s-tag.s-Tag5a .s-button.s-remove-Tags5a, .s-tag.s-Tag5b .s-button.s-remove-Tags5b, .s-tag.s-Tag5c .s-button.s-remove-Tags5c,
        .s-tag.s-Tag6a .s-button.s-remove-Tags6a, .s-tag.s-Tag6b .s-button.s-remove-Tags6b, .s-tag.s-Tag6c .s-button.s-remove-Tags6c,
        .s-tag.s-Tag7a .s-button.s-remove-Tags7a, .s-tag.s-Tag7b .s-button.s-remove-Tags7b, .s-tag.s-Tag7c .s-button.s-remove-Tags7c,
        .s-tag.s-Tag1a .s-button.s-add-Tags1b, .s-tag.s-Tag1a .s-button.s-add-Tags1c,
        .s-tag.s-Tag2a .s-button.s-add-Tags2b, .s-tag.s-Tag2a .s-button.s-add-Tags2c,
        .s-tag.s-Tag3a .s-button.s-add-Tags3b, .s-tag.s-Tag3a .s-button.s-add-Tags3c,
        .s-tag.s-Tag4a .s-button.s-add-Tags4b, .s-tag.s-Tag4a .s-button.s-add-Tags4c,
        .s-tag.s-Tag5a .s-button.s-add-Tags5b, .s-tag.s-Tag5a .s-button.s-add-Tags5c,
        .s-tag.s-Tag6a .s-button.s-add-Tags6b, .s-tag.s-Tag6a .s-button.s-add-Tags6c,
        .s-tag.s-Tag7a .s-button.s-add-Tags7b{display:block}
        .s-tag.s-Tag7d .s-button{display:none}
        .s-tag.s-Tag7d .s-button.s-remove-Tags7d{display:block}
        .s-tag.s-Tag7a .s-button.s-add-Tags7c{display:block}
        .s-tag.s-Tag7a .s-button.s-add-Tags7d{display:block}
        /* Match Tags7d styling to normal tags while keeping them visible */
        .s-tag.s-Tag7d {display:inline-block !important;background:#999999;color:#000;border:inherit;border-radius:inherit;padding:inherit;vertical-align:middle;}
        body.emp-tags-page .s-tag.s-Tag7d .s-button.s-remove-Tags7d {display:inline-block;opacity:0.8;vertical-align:middle;line-height:14px !important;}
        body.emp-tags-page .s-tag.s-Tag7d .s-button.s-remove-Tags7d:hover {opacity:1;}
        body.emp-tags-page td:nth-child(2) .s-tag { display:inline-flex !important; flex-wrap:nowrap !important; align-items:center; }
        body.emp-tags-page td:nth-child(2) .s-tag a { order:2; flex:1 1 auto; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        body.emp-tags-page td:nth-child(2) .s-tag .s-button { order:1; flex:0 0 auto; margin-right:2px; }
        .s-Tag7d-tags{display:none;}
        .s-Tag7d-toggle{font-weight:bold; cursor:pointer;}
        .s-Tag7d-desc{clear:both; padding:8px 0 8px 15px;}
        .s-tag{border-radius:8px!important;padding:0px 4px!important;display:inline-block;}
        .s-tag a{border-radius:12px!important;text-decoration:none;display:inline-block;padding:2px}
        #torrent_tags_list li { display:flex !important;flex-wrap:nowrap !important;align-items:center !important;justify-content:space-between !important;}
        #torrent_tags_list li .s-tag a { float:none !important;display:block !important;white-space:nowrap !important;overflow:hidden !important;text-overflow:ellipsis !important;min-width:0 !important;}
        #torrent_tags_list li div[style*='letter-spacing'] {flex-shrink: 0 !important;white-space: nowrap !important;margin-left: auto !important;text-align: right !important;display: flex !important;justify-content: flex-end !important;align-items: center !important;}
      /* CSS for percentbar table tooltip */
        .percent-tooltip-container {position: absolute;background: rgba(0,0,0,0.85);color: #fff;padding: 1px;border-radius: 6px;font-size: 11px;z-index: 9999;box-shadow: 0 2px 6px rgba(0,0,0,0.4);}
        .percent-tooltip table {border-collapse: collapse;width: auto;}
        .percent-tooltip th, .percent-tooltip td {padding: 2px 8px;text-align: left; background-color: rgba(35, 35, 35, 0.90); color: #d3d3d3; border: 1px solid #aaa;}
        .percent-tooltip th {border-bottom: 1px solid #ccc; background-color: rgba(20, 20, 20, 0.90);}

        .tag-popup {position: fixed; border-radius: 20px; top: 10%; left: 50%; transform: translateX(-50%); background: #fff; border: 2px solid #333; padding: 20px; z-index: 9999; width: 80%; max-width: 1100px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);}
        .tag-popup-inner { position: relative;}
        .tag-popup-close { position: absolute; top: 4px; right: 8px; font-size: 18px; background: none; border: none; cursor: pointer;}
      /* CSS for tag manager */
       .tag-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 10px 0; max-width: 800px; margin: 0 auto;}
       .tag-manager-btn {font-size: 1.1em; Height: 30px; padding: 8px 12px; border-radius: 6px; cursor: pointer; text-align: center; white-space: nowrap; transition: transform 0.1s ease-in-out;}
       .tag-manager-btn:hover { transform: scale(1.05);}
      </style>
    `;

    // =========================================================
    // --- Per Theme Special Styling for Torrent Coloring ---
    // =========================================================

    // --- Remove Background for "Minimal" theme ---
    if (settings.useTorrentColoring) {
        //debug
        // console.log ("===== Minimal =====")
        if (currentTheme === "Minimal") {
            const style = document.createElement("style");
            style.id = "minimal-theme-fix";
            style.textContent = `#torrent_table tr td {background: none !important; background-color: transparent !important;}`;
            document.head.appendChild(style);
        }
    }

    // --- Watch Dogs, Standard --
    if (currentTheme === "WatchDogs" || currentTheme === "Standard") {
        console.log ("Current Theme: ", currentTheme)
        console.log (" Applying Custom Settings for Watchdogs / Standard Theme");
        const style = document.createElement("style");
        style.id = "WatchDogs-theme-fix";

        if (settings.useTorrentColoring) {
            style.textContent = `.torrent.rowb a, .torrent.rowa a {background: none !important; color: lightskyblue !important;}
            #torrent_table td {border: none !important;}
            div.tags.s-browse-tag-holder span.s-tag a {background-color: transparent !important; border:none !important}`;
        } else {
            style.textContent = `.torrent.rowb a,.torrent.rowa a {background: none !important; color: lightskyblue !important;}
            div.tags.s-browse-tag-holder span.s-tag a { background-color: transparent !important; border:none !important}`;
        }
        document.head.appendChild(style);
    }

    // =========================================================


    let userInfoID = "#nav_userinfo"; // The selector that Empornium uses
    if ($j(userInfoID).length < 1) {
        userInfoID = "#nav_useredit"; // // The selector that Pornbay uses
    }

    // --- Initialization Block ---
    // Injects stylesheet, adds the Tag-Config link, and determines which page handler to run.
    // Entry point for script logic after DOM is ready.
    (function init() {
        // add stylesheet
        $j(stylesheet).appendTo("head");
        runFunction(applyCustomColors, 'l02re82moype2hj5', []);
        var test = $j('#torrent_table tbody tr.torrent.rowb').css('background-color');
        $j('#torrent_table').css('background-color', test);

        // add config link
        $j("<li class='brackets' title=\"Change Empornium++Tag Highlighter's settings.\"><a href='#'>Tag-Config</a></li>")
            .insertAfter(userInfoID)
            .on("click", function (e) {
            e.preventDefault();
            initConfig($j(buildSettingsHTML()).prependTo("body"));
            $j("select[name='tagLayoutStyle']").val(settings.tagLayoutStyle);
        });

        if (/torrents\.php/.test(window.location.href)) {
            // torrent details
            if (/\bid\=/.test(window.location.href)) {
                runFunction(processDetailsPage, 'vw6242q9ejj2wowk', []);
            }
            // torrents overview
            else {
                runFunction(processBrowsePage, 'Init-1', [".torrent", "torrent"]);
            }
        }
        // subscribed collages with new additions
        else if (/userhistory\.php(.+)\bsubscribed_collages/.test(window.location.href)) {
            runFunction(processBrowsePage, '0biz4g8mgy4obwwn', [".torrent", "torrent"]);
        }
        // collage details/overview
        else if (/collage/.test(window.location.href)) {
            runFunction(processBrowsePage, '3udjcxlbx2bwhz8w', [".rowa, .rowb, .shaded_row", "collage"]);
        }
        // user details
        else if (/user\.php(.+)\bid\=/.test(window.location.href)) {
            runFunction(processBrowsePage, 'xb1sxgaqphburihz', [".torrent", "torrent"]);
        }
        // top 10
        else if (/top10\.php/.test(window.location.href)) {
            runFunction(processBrowsePage, 'sby53fqcavk7kqvx', [".torrent", "torrent"]);
        }
        else if (/tags\.php/.test(window.location.href)) {
            runFunction(processTagsPage, 'ysfhbc6uhv6p1ugh', [".rowa, .rowb"]);
        }

        else if (/bookmarks\.php/.test(window.location.href)) {
            runFunction(processBrowsePage, 'wqkvm49gxau3fz2r', [".rowa, .rowb", "request"]);
        }
        else if (/requests\.php/.test(window.location.href)) {
            if (/\bid\=/.test(window.location.href)) {
                runFunction(processDetailsPage, '9zy2dt1jkrhju225', []);
            }
            else {
                runFunction(processBrowsePage, '4r18ob82iukeq3f6', [".rowa, .rowb", "request"]);
            }
        }
    }());

    // === Unified UI Refresh ===
    // Rebuilds the settings UI and restores the currently active tab safely.
    let isRefreshing = false;
    function refreshUI(activeTabId) {
        if (isRefreshing) {
            console.warn("⏳ refreshUI() called while already refreshing — skipped.");
            return;
        }
        isRefreshing = true;

        try {
            // Default to currently selected tab, or fall back to General
            activeTabId =
                activeTabId ||
                $j(".tab-row-container li.s-selected").data("page") ||
                "s-conf-general";

            console.group("🔄 refreshUI()");
            console.log("Restoring active tab:", activeTabId);

            // Remove old config panel to prevent duplicates
            $j("#s-conf-background").remove();

            // Rebuild settings HTML and reinitialize
            const rebuilt = $j(buildSettingsHTML()).prependTo("body");
            initConfig(rebuilt);

            // Restore tab state
            $j(".tab-row-container li, .s-conf-page").removeClass("s-selected");
            const $tab = $j(`.tab-row-container li[data-page='${activeTabId}']`);
            const $page = $j(`#${activeTabId}`);

            if ($tab.length && $page.length) {
                $tab.addClass("s-selected");
                $page.addClass("s-selected");
            } else {
                console.warn("⚠️ Could not restore tab:", activeTabId, "— defaulting to General");
                $j(".tab-row-container li[data-page='s-conf-general']").addClass("s-selected");
                $j("#s-conf-general").addClass("s-selected");
            }

            console.log("✅ UI rebuild complete");
            console.groupEnd();
        } catch (err) {
            console.error("💥 refreshUI() failed:", err);
        } finally {
            isRefreshing = false;
        }
    }


    // --- Page Processor: Browse/Lists ---
    // Handles torrent, collage, and request listing pages.
    // Highlights tags, applies coloring, and hides blacklisted/ignored torrents.
    function processBrowsePage(rowSelector, type) {
        var rows = $j(rowSelector);

        rows.each(function (i, row) {
            row = $j(row);

            var lineHeight = settings.roomierTags ? "22px" : "18px";

            var tagContainer = row.find(".tags")
            .addClass("s-browse-tag-holder")
            .css({
                "line-height": lineHeight
            }),

                origTotalTagNum = tagContainer.find("a").length,
                totalTagNum = origTotalTagNum,
                rawGood = 0, rawVeryGood = 0, rawBad = 0, rawVeryBad = 0,
                ignoredNum = 0,
                terribleNum = 0,
                undefinedNum = 0;

            var countPositive = 0;
            var countNegative = 0;
            var countUndefined = 0;
            var countIgnored = 0;

            if (!totalTagNum) return;

            tagContainer.find("a").each(function (i, tagLink) {
                tagLink = $j(tagLink);
                var tag = tagLink.text();
                tagLink = tagLink.wrap("<span>").parent().addClass("s-tag");
                tag = tag.toLowerCase();

                // === Tag7c (Blacklisted / Hidden) ===
                if (settings.useTag7cTags && isTag(settings.tags.Tags7c, tag)) {
                    if (window.location.href.indexOf("bookmarks") != -1 && settings.useBlacklistNoticeBookmark) {
                        // skip hiding in bookmarks if disabled
                    } else if (window.location.href.indexOf("collage") != -1 && settings.useBlacklistNoticeCollages) {
                        // skip hiding in collages if disabled
                    } else if (!terribleNum) {
                        var colspan = row.children().length;
                        if (settings.hideTags7cTorrents) {
                            row.hide();
                            if (settings.useTorrentBlacklistNotice) {
                                $j("<tr class='tr11'></tr>").insertAfter(row).html(
                                    "<td colspan='" + colspan + "' class='s-Tag7c-hidden'>" +
                                    capitaliseFirstLetter(type) +
                                    " hidden because of the " + settings.names.Tags7c + " tag: <strong>" + tag +
                                    "</strong>. Click here to display the " + type + " listing.</td>"
                                ).on("click", function () {
                                    $j(this).hide();
                                    row.show();
                                });
                            }
                        }
                    }
                    terribleNum++;
                    tagLink.addClass("s-Tag7c");
                }

                // === Tag7d (Ignored / Hidden) ===
                else if (settings.useTag7dTags && isTag(settings.tags.Tags7d, tag)) {
                    // Always add the class so styling still applies
                    tagLink.addClass("s-Tag7d");

                    // Only hide if the user has enabled the toggle
                    if (settings.hideTags7dTags) {
                        tagLink.hide();
                    } else {
                        tagLink.show();
                    }
                }


                // === Normal tag-type highlighting ===
                // === Dynamic loop VS chain of "else if" ==
                for (const key of SORTED_TAGS_KEYS) {
                    if (key === "Tags7c" || key === "Tags7d") continue; // handled above

                    const settingKey = "use" + key.replace("Tags", "Tag") + "Tags"; // e.g., useTag5cTags
                    const cssClass = "s-" + key.replace("Tags", "Tag"); // e.g., s-Tag5c

                    // Actual logic
                    if (settings[settingKey] && isTag(settings.tags[key], tag)) {
                        tagLink.addClass(cssClass);
                        break;
                    }
                }

                let matched = false;

                for (const [tagType, tagList] of Object.entries(settings.tags)) {
                    if (isTag(tagList, tag)) {
                        const rating = (settings.tagValues?.[tagType] !== undefined) ? settings.tagValues[tagType] : "(none)";
                        matched = true;

                        // Count it normally

                        // Replace string-based rating logic with numeric-based calculation
                        var numericVal = parseInt(rating, 10);
                        if (!isNaN(numericVal)) {
                            if (numericVal > 0) {
                                rawGood += numericVal;
                                countPositive++;
                            } else if (numericVal < 0) {
                                rawBad += Math.abs(numericVal);
                                countNegative++;
                            } else {
                                countIgnored++; // numericVal === 0
                            }

                        }
                        // Do NOT increment undefined here — handle after loop
                        //debug
                        // console.log(`Tag: ${tag}, Value: ${numericVal}`);
                        matched = true;
                        break; // found match, stop looping through lists




                        // 💬 Console output - Wrap in an "enable debug" later.
                        //console.log(`[TagClassify] ${tag} → ${tagType} → ${rating}`);
                        break; // found match, stop looping through lists
                    }
                }


                if (!matched) {
                    undefinedNum++;
                }


                // If it didn't match any tag list => undefined classification
                // 💬 Console output - Wrap in an "enable debug" later.
                /*
                if (!matched) {
                    console.warn(`[TagClassify] ${tag} → not found in any list`);
                    undefinedNum++;
                }
               */

            });



            // === Percentages (numeric-based, include undefined) ===
            // Compute weighted values from numeric tag values
            var weightedGood = rawGood; // sum of all positive values
            var weightedBad = rawBad; // sum of absolute negative values
            var weightedTotal = weightedGood + weightedBad + undefinedNum; // exclude undefined and ignore zeros

            // Calculate percentages
            var pctGood = weightedTotal ? (weightedGood / weightedTotal) * 100 : 0;
            var pctBad = weightedTotal ? (weightedBad / weightedTotal) * 100 : 0;

            // Undefined percentage is based on total tags (weightedTotal + undefinedNum)
            var totalWithUndefined = weightedTotal + undefinedNum;
            var pctUndef = weightedTotal ? (undefinedNum / weightedTotal) * 100 : 0;

            // Round for display but keep the sum exactly 100 by correcting rounding residue
            var goodPercent = Math.round(pctGood);
            var badPercent = Math.round(pctBad);
            var undefPercent = Math.round(pctUndef);

            // correct rounding so sum == 100
            var roundingSum = goodPercent + badPercent + undefPercent;
            if (roundingSum !== 100) {
                var diff = 100 - roundingSum;
                // apply the diff to the largest segment to minimize visual artifact
                var maxVal = Math.max(goodPercent, badPercent, undefPercent);
                if (maxVal === goodPercent) goodPercent += diff;
                else if (maxVal === badPercent) badPercent += diff;
                else undefPercent += diff;
            }

            //Debug
            /*
            console.log("=== Weighted Scoring Debug ===");
            console.log("Positive (weightedGood):", weightedGood, countPositive);
            console.log("Negative (weightedBad):", weightedBad, countNegative);
            console.log("Total (weightedTotal):", weightedTotal);
            console.log("Percentages -> Good:", pctGood.toFixed(2), "% | Bad:", pctBad.toFixed(2), "%");
*/

            // Render the percent bar: Good(left, green), Bad(middle, red), Undefined(right, gray)
            // === Updated Percent Bar Tooltip Logic ===
            if (settings.usePercentBar) {
                const $wrap = $j("<div class='s-percent-wrap' style='display:block;width:100%;clear:both;'></div>");
                $wrap.insertBefore(tagContainer);

                const percentContainer = $j("<div class='s-percent-container'></div>");
                percentContainer.appendTo($wrap);

                // Build custom HTML tooltip - If enabled
                if (settings.usePBHtmlTooltip) {


                    const tooltipHTML = `
        <div class="percent-tooltip">
            <table>
                <thead>
                    <tr><th>Category</th><th>%</th><th>Count</th><th>Weight</th></tr>
                </thead>
                <tbody>
                    <tr><td>Good</td><td>${goodPercent}%</td><td>${countPositive}</td><td>${weightedGood}</td></tr>
                    <tr><td>Bad</td><td>${badPercent}%</td><td>${countNegative}</td><td>${weightedBad}</td></tr>
                    <tr><td>Undefined</td><td>${undefPercent}%</td><td>${undefinedNum}</td><td>—</td></tr>
                    <tr><td>Ignored</td><td>—</td><td>${countIgnored}</td><td>—</td></tr>
                </tbody>
            </table>
        </div>
        `;

                    // Append tooltip container
                    const tooltipContainer = $j("<div class='percent-tooltip-container'></div>").html(tooltipHTML).hide();
                    $wrap.append(tooltipContainer);

                    // Show/hide tooltip on hover
                    let tooltipTimer;

                    $wrap.on("mouseenter", function() {
                        tooltipTimer = setTimeout(() => {
                            tooltipContainer.show();
                        }, 1000); // 1000ms = 1 second delay
                    });

                    $wrap.on("mouseleave", function() {
                        clearTimeout(tooltipTimer);
                        tooltipContainer.hide();
                    });
                } else {
                    percentContainer.attr(
                        "title",
                        `Good: ${goodPercent}% Bad: ${badPercent}% Undef: ${undefPercent}%
Tags Ignored: (${countIgnored})`
                    )

                        .appendTo($wrap);
                }

                // Good segment
                if (goodPercent > 0) {
                    $j("<div></div>").appendTo(percentContainer).addClass("s-percent s-percent-good").width(goodPercent + "%");
                }

                // Bad segment
                if (badPercent > 0) {
                    $j("<div></div>").appendTo(percentContainer).addClass("s-percent s-percent-bad").width(badPercent + "%");
                }

                // Undefined segment
                if (undefPercent > 0) {
                    $j("<div></div>").appendTo(percentContainer).addClass("s-percent s-percent-undef").width(undefPercent + "%");
                }
            }

            if (settings.useTorrentOpacity && badPercent > goodPercent) {
                row.css("opacity", (100 - ((badPercent - goodPercent) / 2)) / 100);
            }

            // Dynamic Torrent Colloring Based On Current Theme
            if (settings.useTorrentColoring) {
                var netPercent = (goodPercent - badPercent) / 100;
                var absPercent = Math.abs(netPercent);

                var visual = themeVisualMap[currentTheme] || themeVisualMap["unknown"];
                var color = null;

                if (netPercent > 0) color = visual.green;
                else if (netPercent < 0) color = visual.red;

                var alpha = Math.min(absPercent, visual.maxAlpha);

                if (color && !row.hasClass("redbar") &&
                    /torrents\.php/.test(window.location.href) &&
                    !/userid\=/.test(window.location.href)) {
                    row.css({
                        "background-color": "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + alpha + ")"
                    });
                }
            }

            // --- Disable Italics Tag Font
            if (settings.disableItalics) {
                document.querySelectorAll(".tags.s-browse-tag-holder").forEach(div => {
                    div.style.fontStyle = "normal";
                });
            } else {
                document.querySelectorAll(".tags.s-browse-tag-holder").forEach(div => {
                    div.style.fontStyle = "italic";
                });
            }



        });

        // ====================================
        // === Add Button to adjust columns ===
        // ====================================

        // -- The Button ---
        function addColumnToggleButton() {
            // Find the header div with class "head" that contains the text "Torrents"
            const headerDiv = Array.from(document.querySelectorAll('div.head'))
            .find(div => div.textContent.trim() === 'Torrents');

            if (!headerDiv) {
                console.warn('Header div not found for column toggle button.');
                return;
            }
            headerDiv.style.display = 'flex';
            headerDiv.style.justifyContent = 'space-between';
            headerDiv.style.alignItems = 'center';

            // Create button
            const btn = document.createElement('button');
            btn.textContent = 'Toggle Columns';
            btn.style.cssText = `background-color:buttonface;color:#000000;border:none;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;`;
            btn.addEventListener('click', showColumnPopup);

            // Append button to header
            headerDiv.appendChild(btn);
        }

        // --- Get the Column Names ---
        function getColumnNames() {
            const headerCells = document.querySelectorAll('#torrent_table tr.colhead:first-child td');
            return Array.from(headerCells).map((cell, index) => {
                // Prefer text content
                let name = cell.textContent.trim();
                if (!name) {
                    // If empty, check for <img alt="...">
                    const img = cell.querySelector('img');
                    if (img && img.alt) name = img.alt;
                }
                return name || `Column ${index + 1}`;
            });
        }

        // --- The Settings pop-up ---
        function showColumnPopup(event) {
            // Remove any existing popup
            const existingPopup = document.querySelector('#column-toggle-popup');
            if (existingPopup) existingPopup.remove();

            // Use dynamic column name function
            const columnNames = getColumnNames(); // assumes you already defined this elsewhere
            const saved = GM_getValue('hiddenColumns', []);

            // Create popup container
            const popup = document.createElement('div');
            popup.id = 'column-toggle-popup';
            // popup.style.cssText = `position:absolute;background:#fff;border:1px solid #333;padding:10px;z-index:10000;box-shadow:0 4px 10px rgba(0,0,0,0.3);border-radius:8px;font-family:sans-serif;min-width:150px;`;

            popup.style.cssText = `position:absolute; background:#fff; color:#000; border:1px solid #333; padding:10px; z-index:10000; box-shadow:0 4px 10px rgba(0,0,0,0.3); border-radius:8px; font-family:sans-serif; font-size:13px; min-width:150px;`;


            // Position popup relative to button
            const buttonRect = event.target.getBoundingClientRect();
            popup.style.top = `${buttonRect.bottom + window.scrollY + 6}px`;
            popup.style.left = `${buttonRect.left}px`;

            // Build checkboxes for each column
            columnNames.forEach((label, index) => {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = !saved.includes(index);
                checkbox.addEventListener('change', () => toggleColumn(index, checkbox.checked));

                const wrapper = document.createElement('div');
                wrapper.style.marginBottom = '6px';
                wrapper.appendChild(checkbox);
                wrapper.appendChild(document.createTextNode(' ' + label));
                popup.appendChild(wrapper);
            });

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Close';
            closeBtn.style.cssText = `margin-top:10px;padding:4px 8px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;`;
            closeBtn.onclick = () => popup.remove();
            popup.appendChild(closeBtn);

            // Append popup to body
            document.body.appendChild(popup);
        }

        // --- Hide Column Logic ---
        function toggleColumn(index, show) {
            const saved = GM_getValue('hiddenColumns', []);
            const newSaved = show ? saved.filter(i => i !== index) : [...saved, index];
            GM_setValue('hiddenColumns', newSaved);
            runFunction(applySavedColumnSettings, 'pokjs8f0swemsof5', []);
        }

        // --- Apply And Save Column Settings
        function applySavedColumnSettings() {
            const saved = GM_getValue('hiddenColumns', []);
            document.querySelectorAll('#torrent_table tr.colhead, #torrent_table tr.torrent, #torrent_table tr.rowa, #torrent_table tr.rowb').forEach(row => {
                const cells = row.querySelectorAll(':scope > td'); // direct children only
                if (cells.length > 1) { // skip date row
                    cells.forEach((cell, idx) => {
                        cell.style.display = saved.includes(idx) ? 'none' : '';
                    });
                }
            });
        }

        runFunction(applySavedColumnSettings, 'chso3mf0shjmcs8a', []);

        // --- Add the button if the page is right ---
        if (/torrents\.php/.test(window.location.href)) {
            runFunction(addColumnToggleButton, '9djv8e4ao3ns6d0o', []);
        }

    }

    // === Dynamic Percent Bar Refresh ===
    function refreshPercentBars() {
        $j(".s-percent-wrap").remove(); // remove old bars
        runFunction(processBrowsePage, '0acqvdqhj24sca2s', [".torrent", "torrent"]);
    }

    // --- Page Processor: Details Page ---
    // Controls the main torrent detail page layout and tag interactions.
    // Adds highlight logic, tag sorting, and the hidden-tag toggle section.
    function processDetailsPage() {

        window.isTagsLoaded = false;

        var handleTagListLoad = function () {
            window.isTagsLoaded = false;
            var checkTagList = function () {
                if ($j("#torrent_tags li a").hasClass("tags-loaded")) {
                    setTimeout(checkTagList, 30);
                }
                else {
                    runFunction(highlightDetailTags, 'o12ynnxu5fxug5v4', []);
                }
            };
            checkTagList();
        };

        $j(".tag_header span a, #form_addtag input[type='button']").on("click", handleTagListLoad);
        $j("#tagname").on("keydown", function (e) {
            if (e.keyCode === 13) {
                runFunction(handleTagListLoad, 'wyq03yml4odj5627', []);
            }
        });

        var highlightDetailTags = function () {
            console.log("🟢 highlightDetailsTags Started...");
            if (window.isTagsLoaded) {
                console.log("🟢 isTagsLoaded = True");
                return;
            }
            //Timeout to ensure we run after everything else
            var tagLinks = $j("#torrent_tags").find("a[href*='\\?taglist=']");

            window.isTagsLoaded = tagLinks.length > 0;

            if (!window.isTagsLoaded) {
                setTimeout(highlightDetailTags, 200);
                return;
            }
            $j("<ul class='s-Tag7d-tags nobullet'></ul>").appendTo("#torrent_tags").on("spyder.change", function () {
                var hiddenTagHolder = $j(this),
                    hiddenTags = hiddenTagHolder.find("span.s-tag");

                if (hiddenTags.length) {
                    $j(".s-Tag7d-msg").text("There's " + hiddenTags.length + " " + settings.names.Tags7d + " tag" + (hiddenTags.length > 1 ? "s" : "") + " on this torrent ");
                    $j(".s-Tag7d-msg, .s-Tag7d-toggle").show();

                    // 🚨 Respect user toggle for hiding 7d tags
                    if (settings.hideTags7dTags) {
                        hiddenTagHolder.hide(); // user wants them hidden
                    } else {
                        hiddenTagHolder.show(); // user wants them visible
                    }
                }
                else {
                    $j(".s-Tag7d-msg, .s-Tag7d-toggle").hide();
                }
            }).before("<div class='s-Tag7d-desc'><span class='s-Tag7d-msg'></span> <a class='s-Tag7d-toggle'>SHOW</a></div>");




            $j(".s-Tag7d-toggle").on("click", function () {
                $j(".s-Tag7d-tags").slideToggle("fast", function () {
                    if ($j(this).is(":visible")) {
                        $j(".s-Tag7d-toggle").text("HIDE");
                    }
                    else {
                        $j(".s-Tag7d-toggle").text("SHOW");
                    }
                });
            });


            tagLinks.each(function (i, tagLink) {
                tagLink = $j(tagLink).addClass("tags-loaded");
                var tag = tagLink.text(),
                    tagHolder = tagLink.wrap("<span>").parent().addClass("s-tag");

                tag = tag.toLowerCase();

                // Dynamicly Add Tag Classes
                for (let tagsKey of SORTED_TAGS_KEYS) {
                    const tagKey = tagsKey.replace(/^Tags/, "Tag"); // Converts Tags1c → Tag1c

                    if (settings[`use${tagKey}Tags`] && isTag(settings.tags[tagsKey], tag)) {
                        tagHolder.addClass(`s-${tagKey}`);

                        // Special handling for Tag7d
                        if (tagKey === "Tag7d") {
                            if (settings.hideTags7dTags) {
                                tagHolder.parent().detach().appendTo(".s-Tag7d-tags").trigger("spyder.change");
                            } else {
                                tagHolder.find("a").css("display", "inline");
                                tagHolder.css("display", "inline");
                            }
                        }

                        break; // Stop after first match
                    }
                }

                var buttons = $j();

                // --- Dynamically generate buttons for parent "a" tags ---
                FILTERED_ONLY_A_TAGS_KEYS.forEach(tagsKey => {
                    const tagKey = tagsKey.replace(/^Tags/, "Tag")
                    if (settings[`use${tagKey}Tags`]) {
                        if (!settings[`${tagKey}ButtonVisibility`]) {
                            buttons = buttons.add($j(`<div class='s-button s-add-${tagsKey}' title='Mark tag as ${settings.names[tagsKey]}'>+</div>`)
                                                  .data("action", { fn: (function(h) { return function() { addTagElement(tagsKey, h, tag); }; })(tagHolder) }));
                        }
                        buttons = buttons.add($j(`<div class='s-button s-remove-${tagsKey}' title='Un-Mark tag as ${settings.names[tagsKey]}'>–</div>`)
                                              .data("action", { fn: (function(h) { return function() { removeTagElement(tagsKey, h, tag); }; })(tagHolder) }));
                    }
                });

                // --- Dynamically generate buttons for child "non a" tags ---
                FILTERED_NON_A_TAGS_KEYS.forEach(tagsKey => {
                    const tagKey = tagsKey.replace(/^Tags/, "Tag")
                    const aVersionKey = tagsKey.slice(0, -1) + "a";

                    if (settings[`use${tagKey}Tags`]) {
                        buttons = buttons.add($j(`<div class='s-button s-add-${tagsKey}' title='Upgrade tag to ${settings.names[tagsKey]}'>+</div>`)
                                              .data("action", { fn: (function(h) { return function() { switchTagCategory(h, aVersionKey, tagsKey, tag); }; })(tagHolder) }));

                        buttons = buttons.add($j(`<div class='s-button s-remove-${tagsKey}' title='Downgrade tag from ${settings.names[tagsKey]}'>–</div>`)
                                              .data("action", { fn: (function(h) { return function() { switchTagCategory(h, tagsKey, aVersionKey, tag); }; })(tagHolder) }));
                    }
                });

                $j(buttons).addClass("s-button").prependTo(tagHolder);


                // create more horizontal space by hiding "tag action" placeholder spans
                tagHolder.next().find("span:contains('\xa0\xa0\xa0')").hide();
                // staff/mods have additional "tag actions", allow for additional styling
                if (tagHolder.next().find("a").length > 2) {
                    tagHolder.addClass("s-staff");
                }
            });

            $j(".s-button").on("click", function (e) {
                var data = $j(this).data("action");
                data.fn(data.type, $j(this).parent(), data.tag);
            });
        };

        window.highlightDetailTags = highlightDetailTags;

        highlightDetailTags();

        // ensure columns get recalculated after highlighting/moving 7d tags
        setTimeout(() => {
            try {
                runFunction(splitTagsIntoColumns, '5tyomf3d6spaibl6', []);
                runFunction(enforceTagRowLayout, 'xfqeunl053g9i3jl', []);
                runFunction(resizeAllTagText, 'l5dk2pzuonmy9c09', []);
            } catch (e) {
                console.warn('post-highlight adjustments failed', e);
            }
        }, 100);

        // Disable the site's built-in resort logic
        ['sort_uses', 'sort_score', 'sort_az'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.parentElement.removeAttribute('onclick'); // remove inline handler
            el.style.cursor = 'pointer'; // keep it looking clickable
        });



        $j(".s-Tag7d-tags").trigger("spyder.change");
    }

    window.processDetailsPage = processDetailsPage;


    // --- Page Processor: Tags Page ---
    // Handles the /tags.php page, where each row represents a tag entry.
    // Highlights the tag (like detail pages) and removes trailing * from tag text.
    // Ignores the hideTags7dTags setting so all tags are always visible here.
    function processTagsPage(rowSelector) {
        // mark page so CSS can scope to tags page
        $j("body").addClass("emp-tags-page");

        var rows = $j(rowSelector);

        rows.each(function () {
            var row = $j(this);
            var tagLink = row.find("a[href*='torrents.php?taglist=']");

            if (!tagLink.length) return;

            // get trimmed text and remove trailing "*" if present
            var tagText = tagLink.text().trim();
            if (tagText.endsWith("*")) {
                tagText = tagText.slice(0, -1);
                tagLink.text(tagText);
            }

            var tag = tagText.toLowerCase();

            // If the <a> is already wrapped in an .s-tag, reuse that wrapper.
            // Otherwise, create a fresh wrapper and wrap the <a>.
            var parentSpan = tagLink.parent();
            var tagHolder;
            if (parentSpan.is("span") && parentSpan.hasClass("s-tag")) {
                tagHolder = parentSpan;
            } else {
                // create a wrapper span and replace existing one safely
                tagHolder = $j("<span class='s-tag'></span>");
                tagLink.wrap(tagHolder);
                tagHolder = tagLink.parent();
            }

            // Clean up any existing s-button children (prevents duplication on refresh)
            tagHolder.find(".s-button").remove();

            // Remove any previous tag-type classes so we can re-apply cleanly
            tagHolder.removeClass(ALL_TAGS_KEYS.map(k => "s-" + k).join(" "));

            // === Apply highlighting (Dynamic generation) ===
            const filteredKeys = SORTED_TAGS_KEYS.filter(key => key !== "Tags7d");

            let matched = false;

            for (const tagsKey of filteredKeys) {
                const tagKey = tagsKey.replace(/^Tags/, "Tag")
                if (settings[`use${tagKey}Tags`] && isTag(settings.tags[tagsKey], tag)) {
                    tagHolder.addClass(`s-${tagKey}`);
                    matched = true;
                    break; // stop after first match
                }
            }

            if (!matched && settings.useTag7dTags && isTag(settings.tags.Tags7d, tag)) {
                tagHolder.addClass("s-Tag7d");
                tagHolder.show();
            }

            // Add Tag Action Buttons
            addTagButtons(tagHolder, tag);
            runFunction(addTagButtons, 'o8fdjcdhk2d20h2o', [tagHolder, tag]);
        });

    }
    window.processTagsPage = processTagsPage;

    // === Tags.php: Edit Tags Toggle ===
    function addEditTagsToggle() {
        if (!/tags\.php/.test(window.location.href)) return; // only on tags page
        if (document.querySelector('#editTagsToggle')) return; // prevent duplicates

        // Hide all tag buttons by default on load
        document.querySelectorAll('.s-button, .s-Tag7d .s-button, .s-Tag7d div').forEach(btn => {
            btn.style.display = 'none';
        });

        // Find a place in the table to insert our toggle
        const targetCell = document.querySelector('.box tr.rowa td');
        if (!targetCell) {
            console.warn('Edit Tags toggle: target cell not found.');
            return;
        }

        // Create the button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'editTagsToggle';
        toggleBtn.textContent = 'Edit Tags';
        toggleBtn.style.cssText = ` padding: 4px 10px; border-radius: 6px; background: var(--btn-bg, #444); color: white; border: 1px solid #777; cursor: pointer; font-size: 12px;`;

        // Append button
        targetCell.appendChild(toggleBtn);

        // Restore previous state if it exists
        let editing = localStorage.getItem('empTagsEditing') === 'true';
        if (editing) enableEditingMode(true);

        // Button click handler
        toggleBtn.addEventListener('click', () => {
            editing = !editing;
            localStorage.setItem('empTagsEditing', editing ? 'true' : 'false');
            runFunction(enableEditingMode, 'afe12guylb7e44el', [editing]);
        });

        // Helper to enable/disable editing
        function enableEditingMode(enable) {
            // --- Show/hide tag buttons ---
            const buttons = document.querySelectorAll('.s-button, .s-Tag7d .s-button, .s-Tag7d div');
            buttons.forEach(btn => {
                btn.style.display = enable ? '' : 'none';
            });

            toggleBtn.textContent = enable ? 'Stop Editing' : 'Edit Tags';

            // --- Handle all table changes (both left + right tables) ---
            const tables = document.querySelectorAll('table.box.shadow');
            tables.forEach(tbl => {
                // Hide or show Votes columns + header (colspan=2)
                const voteCols = tbl.querySelectorAll('td.votes, td.center[colspan="2"], .colhead td[colspan="2"]');
                voteCols.forEach(td => {
                    td.style.display = enable ? 'none' : '';
                });

                // Hide or show first column (TagID) - * Must ignore on Femdomcult - There is no first column.
                if (isEmpornium || isHomeporntorrents) {
                    const firstCols = tbl.querySelectorAll('tr > td:first-child, tr > th:first-child');
                    firstCols.forEach(td => {
                        td.style.display = enable ? 'none' : '';
                    });
                }
                // Change "Synonyms" header to "Syn" while editing
                const synHeader = tbl.querySelector('.colhead td:last-child');
                if (synHeader) {
                    if (enable) {
                        synHeader.dataset.originalText = synHeader.textContent;
                        synHeader.textContent = 'Syn';
                    } else if (synHeader.dataset.originalText) {
                        synHeader.textContent = synHeader.dataset.originalText;
                    }
                }
            });
        }




    }
    window.addEditTagsToggle = addEditTagsToggle;

    // Call after tags page is processed
    if (/tags\.php/.test(window.location.href)) {
        window.addEventListener('load', addEditTagsToggle);
    }


    // --- Full refresh for /tags.php ---
    // Removes all .s-tag wrappers/buttons and rebuilds cleanly
    function refreshTagsPageHighlights() {
        // 1. Remove every .s-tag wrapper but keep the inner <a>
        $j(".s-tag").each(function () {
            const link = $j(this).find("a");
            $j(this).replaceWith(link);
        });

        // 2. Reprocess all tag rows using the same logic as initial page load
        runFunction(processTagsPage, 'ku9gl2eo6vw2pajd', [".rowa, .rowb"]);
    }
    window.refreshTagsPageHighlights = refreshTagsPageHighlights;

    function addTagButtons(tagHolder, tag) {
        // Defensive: ensure settings.tags exists
        if (!settings || !settings.tags) settings.tags = {};

        // Remove any existing buttons inside this holder (extra safety)
        tagHolder.find(".s-button").off().remove();

        // Normalize tag for comparisons
        const normalized = t => (typeof t === "string" ? t.toLowerCase().trim() : t);
        const tagNorm = normalized(tag);

        // First: REMOVE buttons for categories that already include the tag
        for (const tagKey of ALL_TAGS_KEYS) {
            const tagList = settings.tags[tagKey] || [];
            const isAlreadyTagged = tagList.some(t => normalized(t) === tagNorm);
            if (isAlreadyTagged) {
                const tagName = settings.names[tagKey] || tagKey;
                const removeBtn = $j("<div>")
                .addClass("s-button s-remove-" + tagKey)
                .attr("title", "Remove tag from " + tagName)
                .text("–")
                .on("click", function (e) {
                    e.stopPropagation();
                    runFunction(removeTags, 'adki6efdf2sau19z', [tagKey, [tag]]);
                    // Refresh visually on tags.php OR call highlight on details
                    if (window.location.href.indexOf("tags.php") !== -1) {
                        runFunction(refreshTagsPageHighlights, 'wd0lnc0p4mm531bs', []);
                    } else {
                        runFunction(highlightDetailTags, '0epqugp2aoujd2il', []);
                    }

                });

                tagHolder.append(removeBtn);
            }
        }

        // Second: ADD buttons for categories the tag does not already belong to
        for (const tagKey of ALL_TAGS_KEYS) {
            const tagList = settings.tags[tagKey] || [];
            const isAlreadyTagged = tagList.some(t => normalized(t) === tagNorm);
            if (isAlreadyTagged) continue;

            const tagName = settings.names[tagKey] || tagKey;
            const addBtn = $j("<div>")
            .addClass("s-button s-add-" + tagKey)
            .attr("title", "Mark tag as " + tagName)
            .text("+")
            .on("click", function (e) {
                e.stopPropagation();
                addTags(tagKey, [tag]);
                if (window.location.href.indexOf("tags.php") !== -1) {
                    runFunction(refreshTagsPageHighlights, '7nyugr2y30jyma4c', []);
                } else {
                    runFunction(highlightDetailTags, 'k4z95ngtqfbi2whi', []);
                }

            });

            tagHolder.append(addBtn);
        }
    }

    window.addTagButtons = addTagButtons;

    // --- Configuration Panel Initialization ---
    // Handles creation and population of the settings UI.
    // Loads saved settings, attaches listeners, and enables Import/Export/Save.
    function initConfig(base) {
        // Populate Export textarea immediately when the config panel opens
        try {
            const ta = document.querySelector('#export-settings-textarea');
            if (ta) ta.textContent = JSON.stringify(getSettings(), null, 2);
        } catch (err) {
            console.warn("populate export box failed:", err);
        }

        //Init Display
        for (var name in settings) {
            if (settings.hasOwnProperty(name)) {
                if (name == "tags") {
                    for (var tagType in settings[name]) {
                        if (settings[name].hasOwnProperty(tagType)) {
                            displayTags(tagType);
                        }
                    }
                }
                else {
                    $j("input[name='" + name + "']").prop("checked", settings[name]);
                }
            }
        }


        //Init Listeners
        $j(".s-conf-tab").parent().on("click", function () {
            var tab = $j(this);
            if (!tab.hasClass("s-selected")) {
                $j('.tab-row-container li').removeClass('s-selected');
                $j('.s-conf-page').removeClass("s-selected");
                tab.addClass("s-selected");
                $j(".s-conf-page#" + tab.data("page")).addClass("s-selected");
            }
        });

        // Populate Dupe Cleanup panel when its tab is selected
        $j(".tab-row-container").on("click", "li[data-page='s-conf-dupe-cleanup']", function () {
            const $list = $j("#dupeCleanupList");
            $list.html("<div>Scanning for duplicates...</div>");

            try {
                const rawConflicts = cleanChildTagsFromParent() || [];

                // Aggregate conflicts by tag -> set of list keys
                const agg = {}; // { normalizedTag: { displayTag: originalTag, lists: Set(...) } }
                rawConflicts.forEach(function (c) {
                    const tag = (c.tag || "").toString();
                    if (!tag) return;
                    const norm = tag.toLowerCase().trim();
                    if (!agg[norm]) agg[norm] = { displayTag: tag, lists: new Set() };

                    if (Array.isArray(c.lists)) {
                        c.lists.forEach(l => agg[norm].lists.add(l));
                    } else if (c.lists) {
                        if (typeof c.lists === "string" && c.lists.indexOf(" ") >= 0) {
                            c.lists.split(/\s+/).forEach(l => agg[norm].lists.add(l));
                        } else {
                            agg[norm].lists.add(c.lists);
                        }
                    }
                });

                const keys = Object.keys(agg);
                if (!keys.length) {
                    $list.html("<div>No duplicates found 🎉</div>");
                    return;
                }

                // Build header (aligned exactly with data rows)
                let out = "<div style='display:flex; align-items:center; font-weight:bold; margin-bottom:6px; line-height:1.3;'>"
                + "<div style='width:320px; font-family:monospace;'>Tag</div>"
                + "<div style='flex:1;'>Lists</div>"
                + "</div>"
                + "<div style='border-top:1px solid #666; margin-bottom:8px;'></div>";


                keys.forEach(function (normTag) {
                    const entry = agg[normTag];
                    const safeTag = entry.displayTag.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    const rowId = "dupe-row-" + encodeURIComponent(normTag);

                    const listKeys = Array.from(entry.lists);
                    const badgesHtml = listKeys.map(function (key) {
                        if (!key) return "";
                        // convert "Tags7a" -> "Tag7a" for class names used in your CSS
                        const styleKey = key.replace(/^Tags/, "Tag");
                        const displayName = (settings.names && settings.names[key]) ? settings.names[key] : key;
                        const safeName = displayName.replace(/</g, "&lt;").replace(/>/g, "&gt;");

                        return "<span class='s-tag s-" + styleKey + "' data-list-key='" + key + "' style='display:inline-block; margin-right:6px; border-radius:16px; padding:0 4px; vertical-align:middle;'>"
                            + "<a href='#' style='pointer-events:none; text-decoration:none; display:inline-block; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'>" + safeName + "</a>"
                            + "</span>";
                    }).join(" ");

                    out += "<div id='" + rowId + "' style='display:flex; align-items:center; margin:6px 0;'><div style='width:320px; font-family:monospace;'>" + safeTag + "</div><div style='flex:1;'>" + badgesHtml + "</div></div>";
                });

                $list.html(out);

                // Post-render: if any badge is invisible (rare), apply conservative fallback
                keys.forEach(function (normTag) {
                    const rowId = "dupe-row-" + encodeURIComponent(normTag);
                    const container = document.getElementById(rowId);
                    if (!container) return;
                    const spans = Array.from(container.querySelectorAll("span.s-tag"));
                    spans.forEach(function (span) {
                        const comp = window.getComputedStyle(span);
                        const bg = comp.backgroundColor || "";
                        const opacity = parseFloat(comp.opacity || "1");
                        // If background is transparent/none or opacity is zero, or computed text color equals background
                        if (opacity <= 0.01 || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
                            // Apply a gentle fallback that doesn't wipe theme out
                            span.style.backgroundColor = "#f6f6f6";
                            span.style.border = "1px solid #888";
                            const a = span.querySelector("a");
                            if (a) a.style.color = "#111";
                            console.warn("[DupeCleanup] Applied fallback for invisible badge:", span.getAttribute("data-list-key"));
                        }
                    });
                });

                console.log("[DupeCleanup] Rendered", keys.length, "unique duplicate tags.");
            } catch (err) {
                console.error("[DupeCleanup] Error:", err);
                $list.html("<div>Error scanning duplicates. See console for details.</div>");
            }

            //Dupe Cleanup - Click the right category to keep it
            $j("#dupeCleanupList").off("click", "span.s-tag").on("click", "span.s-tag", function (e) {
                e.preventDefault();
                e.stopPropagation();

                const $span = $j(this);
                const listKey = $span.attr("data-list-key");
                const displayName = settings.names?.[listKey] || listKey;

                // find which tag this badge belongs to (the tag text in the same row)
                const $row = $span.closest("div[id^='dupe-row-']");
                const tagText = $row.find("div:first").text().trim();

                if (!tagText || !listKey) return;

                if (!confirm(`Are you sure you want to keep "${tagText}" only in "${displayName}"?`)) {
                    return;
                }

                // Reload settings (safety)
                let s = getSettings();
                let changed = false;

                // Loop through all tag lists
                for (const [key, arr] of Object.entries(s.tags)) {
                    if (!Array.isArray(arr)) continue;
                    const idx = arr.indexOf(tagText);
                    if (idx !== -1) {
                        if (key === listKey) continue; // keep in chosen list
                        arr.splice(idx, 1);
                        changed = true;
                        console.log(`[DupeCleanup] Removed "${tagText}" from ${key}`);
                    }
                }

                if (changed) {
                    saveTags(listKey, s.tags[listKey]); // save chosen list
                    // save all modified lists as well
                    for (const k in s.tags) saveTags(k, s.tags[k]);
                    console.log(`[DupeCleanup] Saved updates after keeping "${tagText}" only in ${listKey}`);
                }

                // Refresh the Dupe Cleanup tab to reflect changes
                $j("li[data-page='s-conf-dupe-cleanup']").trigger("click");
            });

        });

        // Saves the compact tag layout on select.
        /*
          $j(document).on("change", ".s-conf-select[name='tagLayoutStyle']", function () {
              const selected = $j(this).val();
              settings.tagLayoutStyle = selected;
              saveSettings();
          });
       */

        let isProgrammatic = false; // Prevent infinite loops

        $j(".s-conf-gen-checkbox").on("change", function () {
            if (isProgrammatic) return; // Skip if triggered programmatically

            var checkbox = $j(this);
            var name = checkbox.attr("name");
            var isChecked = checkbox.is(":checked");

            // Update settings for the checkbox that triggered the event
            settings[name] = isChecked;

            // --- Generate useTagHierarchy dynamically
            const useTagHierarchy = Object.fromEntries(
                Object.entries(tagHierarchy).map(([parent, children]) => [
                    `use${parent.replace(/^Tags/, "Tag")}Tags`,
                    children.map(child => `use${child.replace(/^Tags/, "Tag")}Tags`)
                ])
            );

            // --- Reverse lookup for child → parent
            const childToParent = {};
            for (const parent in useTagHierarchy) {
                useTagHierarchy[parent].forEach(child => {
                    childToParent[child] = parent;
                });
            }

            // --- Main logic
            function handleCheckboxChange(name, isChecked) {
                if (childToParent[name]) {
                    const parent = childToParent[name];
                    if (isChecked) {
                        settings[parent] = true; // ✅ update settings
                        isProgrammatic = true;
                        $j(`input[name='${parent}']`).prop("checked", true).trigger("change");
                        isProgrammatic = false;
                    }
                    // ✅ Do nothing if child is unchecked (leave parent checked)
                } else if (useTagHierarchy[name]) {
                    if (!isChecked) {
                        isProgrammatic = true;
                        useTagHierarchy[name].forEach(child => {
                            settings[child] = false; // ✅ update settings
                            $j(`input[name='${child}']`).prop("checked", false).trigger("change");
                        });
                        isProgrammatic = false;
                    }
                }
            }
            window.handleCheckboxChange = handleCheckboxChange;

            runFunction(handleCheckboxChange, '581jm2p0gputps4q', [name, isChecked]);

            // === Dynamic 7d visibility update ===
            if (name === "hideTags7dTags") {
                $j("#dynamic-7d-visibility").remove();
                const style = document.createElement("style");
                style.id = "dynamic-7d-visibility";

                if (settings.hideTags7dTags) {
                    style.textContent =
                        "body:not(.emp-tags-page) span.s-tag.s-Tag7d { display:none !important; }" +
                        "body.emp-tags-page span.s-tag.s-Tag7d { display:inline !important; }";
                } else {
                    style.textContent = "span.s-tag.s-Tag7d { display:inline !important; }";
                }

                document.head.appendChild(style);
            }

            if (name === "usePercentBar") {
                runFunction(saveSettings, 'clrw74s214jn3oes', []);
                runFunction(refreshPercentBars, 'g2rk1c27nzi956jn', []);
            }
        });
        // On Click Save
        // remove any old bindings that target #s-conf-save to avoid duplicates
        $j(document).off("click", "#s-conf-save, .s-conf-save");

        // New delegated binding for any Save button using the shared class
        $j(document).on("click", ".s-conf-save", function (e) {
            // Prevent default and stop bubbling so tab logic won't mistakenly fire
            e.preventDefault();
            e.stopPropagation();

            console.log("🟢 Save button clicked");

            // Capture active tab before teardown
            const activeTabId = $j('.tab-row-container li.s-selected').data('page') || $j('.tab-row-container li.s-selected .s-conf-tab').data('page') || "s-conf-general";


            // Defensive init
            if (!window.settings) window.settings = {};
            if (!settings.colors) settings.colors = {};
            if (!settings.names) settings.names = {};

            // --- Explicit per-tag assignments ---

            // small helper to read an input value or keep the existing fallback
            function readOrKeep(selector, fallback) {
                const $el = $j(selector);
                return $el.length ? $el.val() : (fallback || "");
            }
            window.readOrKeep=readOrKeep;

            // ensure settings.colors exists
            settings.colors = settings.colors || {};

            ALL_TAGS_KEYS.forEach(key => {
                const node = settings.colors[key] = settings.colors[key] || {};
                node.background = readOrKeep(`#color-${key}-bg`, node.background);
                node.text = readOrKeep(`#color-${key}-text`, node.text);
                node.border = "#000000"; // constant as before
                node.borderColor = readOrKeep(`#border-${key}-color`, node.borderColor);
                node.borderStyle = readOrKeep(`#border-${key}-style`, node.borderStyle);
                node.borderWeight = ensurePx(readOrKeep(`#border-${key}-weight`, node.borderWeight));
            });
            // --- FIXED: Capture updated display names from color table ---
            if (!settings.names) settings.names = {};
            $j(".s-conf-color-table tr").each(function () {
                const $tr = $j(this);
                const $labelSpan = $tr.find("td:first .name-display");
                if (!$labelSpan.length) return;

                const label = $labelSpan.text().trim();
                const id = $tr.find("input[id^='color-'][id$='-bg']").attr("id") || "";
                const match = id.match(/^color-(.+?)-bg$/);
                if (!match) return;

                const type = match[1];
                if (type && label.length) {
                    settings.names[type] = label;
                }
            });


            // --- Save tag value selections for Percent Bar---
            $j(".spinner[data-tag]").each(function () {
                var tagKey = $j(this).data("tag");
                var input = $j(this).find(".tag-value-spinner");
                if (input.length) {
                    var tagVal = parseInt(input.val(), 10);
                    settings.tagValues[tagKey] = isNaN(tagVal) ? 0 : tagVal;
                }
            });

            //Tag Layout Compact, Normal, Roomy
            settings.tagLayoutStyle = $j("select[name='tagLayoutStyle']").val();

            // Save and apply
            saveSettings();
            applyCustomColors();


            $j("select[name='tagLayoutStyle']").val(settings.tagLayoutStyle);
            const ta = document.querySelector('#export-settings-textarea');
            if (ta) ta.textContent = JSON.stringify(getSettings());
            displayStatus("success", "Settings updated successfully");
        });


        // === Spinner Increment/Decrement Handlers (Global) ===

        // Remove any prior bindings to prevent duplicates
        $j(document).off("click", ".spinner .decrement");
        $j(document).off("click", ".spinner .increment");

        // Helper: apply delta to a number input respecting step/min/max
        function adjustNumeric(input, delta) {
            var step = parseFloat(input.attr("step")) || 1;
            var min = parseFloat(input.attr("min"));
            var max = parseFloat(input.attr("max"));

            var current = parseFloat(input.val());
            if (isNaN(current)) current = 0;

            var next = current + delta * step;
            if (!isNaN(min)) next = Math.max(min, next);
            if (!isNaN(max)) next = Math.min(max, next);

            var decimals = (step % 1 !== 0) ? 1 : 0;
            return next.toFixed(decimals);
        }

        // Helper: dispatch the correct value for listeners:
        // - For border weight inputs (id: border-<TagKey>-weight) => fire "Npx"
        // - For all others => fire numeric as-is
        function commitSpinnerValue(input, numericString) {
            var id = input.attr("id") || "";
            var isborderWeight = /^border-.*-weight$/.test(id);

            // Keep the visible input numeric
            input.val(numericString);

            if (isborderWeight) {
                // Temporarily provide "Npx" for listeners, then remove
                var pxVal = parseFloat(numericString) + "px";
                input.data("emittedValue", pxVal);
                input.trigger("change");
                input.removeData("emittedValue");
            } else {
                input.trigger("change");
            }
        }

        // Decrement (only)
        $j(document).on("click", ".spinner .decrement", function () {
            var $input = $j(this).siblings("input[type='number']");
            if (!$input.length) return;
            var next = adjustNumeric($input, -1);
            runFunction(commitSpinnerValue, '3mro0463tmrt5k0m', [$input, next]);
        });

        // Increment (only)
        $j(document).on("click", ".spinner .increment", function () {
            var $input = $j(this).siblings("input[type='number']");
            if (!$input.length) return;
            var next = adjustNumeric($input, +1);
            commitSpinnerValue($input, next);
        });


        // --- Import button wiring: read textarea, import, refresh UI & export box ---
        $j('#import-settings-button').on('click', function (e) {
            e.preventDefault();
            try {
                const raw = $j('#import-settings-textarea').val() || '';
                if (!raw.trim()) {
                    displayStatus && typeof displayStatus === 'function'
                        ? displayStatus("error", "Import failed: import textarea is empty.")
                    : alert("Import failed: import textarea is empty.");
                    return;
                }

                // Call existing import function (will save to storage)
                runFunction(importSettings, 'pvqjdr75r65wdioe', [raw]);

                // Refresh in-memory UI and repopulate export textarea
                try {
                    runFunction(refreshUI, 'fi8jsnprktgnrpbf', []);
                } catch (err) {
                    console.warn('refreshUI() failed after import', err);
                }

                const ta = document.querySelector('#export-settings-textarea');
                if (ta) ta.textContent = JSON.stringify(getSettings(), null, 2);

                // Inform user
                displayStatus && typeof displayStatus === 'function'
                    ? displayStatus("success", "Imported settings successfully.")
                : alert("Imported settings successfully. You may need to reload the page to apply changes.");
            } catch (ex) {
                displayStatus && typeof displayStatus === 'function'
                    ? displayStatus("error", "Unable to import settings: " + ex.message)
                : alert("Unable to import settings: " + ex.message);
            }
        });



        $j("#s-conf-close").on("click", function () {
            base.remove();
        });

        $j("#s-conf-status").on("click", "#s-conf-status-close", function () {
            $j(this).parent().fadeOut("fast");
        });

        // --- Updated handler to support both old and new tag naming ---
        $j(".s-conf-add-btn, .s-conf-remove-btn").on("click", function () {
            const button = $j(this);
            const method = button.hasClass("s-conf-remove-btn") ? removeTags : addTags;

            let type = button.data("type"); // e.g. "Tags2a" or "Tags2a"
            const input = button.prev();

            // Normalize tag type (map old names to new canonical ones)
            /* Delete
            const legacyMap = {
                "good": "Tags1a",
                "loved": "Tags1b",
                "performer": "Tags2a",
                "loveperf": "Tags2b",
                "newperf": "Tags3a",
                "amateur": "Tags4a",
                "loveamat": "Tags4b",
                "maleperf": "Tags5a",
                "lovemale": "Tags5b",
                "likesite": "Tags6a",
                "lovesite": "Tags6b",
                "disliked": "Tags7a",
                "hated": "Tags7b",
                "terrible": "Tags7c",
                "useless": "Tags7d"
            };
            if (legacyMap[type]) type = legacyMap[type];
*/
            // Get and clean up tag list from input field
            const tags = $j.grep(input.val().toLowerCase().split(/\s+/), tag => tag);

            if (tags.length) {
                try {
                    // Execute addTags() or removeTags()
                    method(type, tags);

                    // Clear input box
                    input.val("");

                    // Refresh textarea or tag display
                    runFunction(displayTags, '9c32tb70ha9nm76o', [type]);
                    // User feedback
                    displayStatus("success", settings.names[type] + " tags updated successfully.");
                } catch (err) {
                    console.error("Tag update failed for type:", type, err);
                    displayStatus("error", "An error occurred while updating tags for " + settings.names[type] + ".");
                }
            } else {
                displayStatus("error", "Tags not updated because none were provided.");
            }
        });


        function displayTags(type, selector = "#s-conf-text-" + type) {
            $j(selector).val(settings.tags[type].join(" "));
        }
        window.displayTags = displayTags;


        function displayStatus(type, msg) {
            $j("#s-conf-status").fadeOut("fast", function () {
                $j(this).removeClass().addClass("s-" + type).html(msg + " <a id='s-conf-status-close'>(×)</a>").fadeIn("fast");
            });
        }

        function refreshUI(activeTabId) {
            // fallback if caller didn't pass an id
            activeTabId = activeTabId || $j('.tab-row-container li.s-selected .s-conf-tab').data('page') || "s-conf-general";

            // remove old UI and rebuild
            $j('#s-conf-background').remove();

            const rebuilt = $j(buildSettingsHTML()).prependTo("body");
            initConfig(rebuilt);

            // explicit, deterministic restore of the active tab
            $j('.tab-row-container li').removeClass('s-selected');
            $j('.s-conf-page').removeClass('s-selected');

            const $tab = $j(`.s-conf-tab[data-page="${activeTabId}"]`);
            if ($tab.length) {
                $tab.parent().addClass('s-selected');
                $j(`#${activeTabId}`).addClass('s-selected');
            } else {
                // fallback to General if the requested tab doesn't exist
                $j(`.s-conf-tab[data-page="s-conf-general"]`).parent().addClass('s-selected');
                $j('#s-conf-general').addClass('s-selected');
            }

            console.log("🟣 Running refreshUI() - restored", activeTabId);
        }


        // === Real-time color and border preview updates (complete) ===
        $j(document).off("input change", "input[type='color'], select[id^='border-'], input[id^='border-']")
            .on("input change", "input[type='color'], select[id^='border-'], input[id^='border-']", function () {
            const inputId = $j(this).attr("id");

            // Match background/text color
            const colorMatch = inputId.match(/^color-(Tags\d+[a-d])-(bg|text)$/);
            // Match border color/style/weight
            const borderMatch = inputId.match(/^border-(Tags\d+[a-d])-(color|style|weight)$/);

            if (!colorMatch && !borderMatch) return;

            const tagType = colorMatch ? colorMatch[1] : borderMatch[1];

            // Read current values
            const bg = $j(`#color-${tagType}-bg`).val();
            const text = $j(`#color-${tagType}-text`).val();
            const borderColor = $j(`#border-${tagType}-color`).val();
            const borderStyle = $j(`#border-${tagType}-style`).val();
            const borderWeight = ensurePx($j(`#border-${tagType}-weight`).val());

            // Sync settings
            if (!settings.colors) settings.colors = {};
            if (!settings.colors[tagType]) settings.colors[tagType] = {};
            settings.colors[tagType].background = bg;
            settings.colors[tagType].text = text;
            settings.colors[tagType].border = settings.colors[tagType].border || "#000000";
            settings.colors[tagType].borderColor = borderColor;
            settings.colors[tagType].borderStyle = borderStyle;
            settings.colors[tagType].borderWeight = borderWeight;

            // Update sample tag
            const $sample = $j(`#sample-${tagType}`);
            if ($sample.length) {
                $sample.css({
                    backgroundColor: bg,
                    color: text,
                    border: `${borderWeight} ${borderStyle} ${borderColor}`,
                });
            }

            // Update buttons
            $j(".s-add-" + tagType + ", .s-remove-" + tagType).css({
                backgroundColor: bg,
                borderColor: settings.colors[tagType].border || "#000000",
                color: text
            });

            // Rebuild stylesheet
            if (typeof applyCustomColors === "function") {
                applyCustomColors();
            }
        });

        // Import/export settings related code
        function importSettings(rawSettings) {
            console.log("importSettings called; raw length =", rawSettings?.length);
            try {
                const trimmedSettings = rawSettings.trim();
                if (!trimmedSettings) {
                    console.warn("No data");
                    return;
                }
                let imported = JSON.parse(trimmedSettings);
                console.log("Parsed JSON keys:", Object.keys(imported));

                // --- mark checkpoints ---
                console.log("Checkpoint A: majorVersion =", imported.majorVersion);

                if (!imported.majorVersion || imported.majorVersion < 2.0) {
                    console.log("Checkpoint B: starting migration");

                    // tagKeyMap
                    const tagKeyMap = {
                        good: "Tags1a", loved: "Tags1b",
                        performer: "Tags2a", loveperf: "Tags2b",
                        newperf: "Tags3a", amateur: "Tags4a",
                        loveamat: "Tags4b", maleperf: "Tags5a",
                        lovemale: "Tags5b", likesite: "Tags6a",
                        lovesite: "Tags6b", disliked: "Tags7a",
                        hated: "Tags7b", terrible: "Tags7c",
                        useless: "Tags7d"
                    };

                    if (imported.tags) {
                        console.log("Checkpoint C: tags keys =", Object.keys(imported.tags));
                        for (const oldKey in tagKeyMap) {
                            const newKey = tagKeyMap[oldKey];
                            if (imported.tags[oldKey]) {
                                imported.tags[newKey] = imported.tags[oldKey];
                                delete imported.tags[oldKey];
                            }
                        }
                    }

                    console.log("Checkpoint D: after tag migration");

                    const flagMap = { useGoodTags: "useTag1aTags" }; // keep only one to simplify
                    for (const oldFlag in flagMap) {
                        const newFlag = flagMap[oldFlag];
                        if (imported[oldFlag]) {
                            imported[newFlag] = imported[oldFlag];
                            delete imported[oldFlag];
                        }
                    }

                    console.log("Checkpoint E: after flag migration");

                    if (!imported.names) imported.names = {};
                    imported.names.Tags1a = "Liked";
                    imported.majorVersion = 2.0;

                    console.log("Checkpoint F: after name fill");
                }

                settings = imported;
                console.log("Checkpoint G: settings assigned OK");

                saveSettings();

            } catch (err) {
                console.error("Import crash caught:", err);
                alert("Import crashed: " + err.message);
            }
        }


        function updateSamples() {
            if (!settings.colors) return;

            for (const [type, cfg] of Object.entries(settings.colors)) {
                const bg = $j("#color-" + type + "-bg").val();
                const text = $j("#color-" + type + "-text").val();
                const oc = $j("#border-" + type + "-color").val();
                const os = $j("#border-" + type + "-style").val();
                let ow = $j("#border-" + type + "-weight").val();

                // normalize weight to px for preview
                if (!/px$/i.test(String(ow))) {
                    const n = parseFloat(ow);
                    ow = isNaN(n) ? "" : (n + "px");
                }

                $j("#sample-" + type).css({
                    "background-color": bg,
                    "color": text,
                    "border": ow && oc && os ? (ow + " " + os + " " + oc) : ""
                });
            }
        }

        // === Enable inline editing for label names ===
        $j(document)
            .off("click", ".edit-label") // remove any old bindings
            .on("click", ".edit-label", function (e) {
            e.preventDefault();
            const $btn = $j(this);
            const key = $btn.data("name");
            const $cell = $btn.closest("tr").children(".label-cell[data-name='" + key + "']");

            console.log("🔹 Edit clicked:", key);
            console.log("🔹 Found cell:", $cell.get(0));
            console.log("🔹 Cell HTML:", $cell.html());
            console.log("🔹 Cell text:", JSON.stringify($cell.text()));
            console.log("Click event count:", e.timeStamp);

            // 🔒 Skip if already editing
            if ($cell.find("input.label-input").length) {
                console.log("🔸 Edit already active for", key);
                return;
            }

            const oldValue = $cell.text().trim();
            console.log("Editing", key, "with initial value:", oldValue);

            const $input = $j("<input type='text' class='label-input'>")
            .val(oldValue)
            .css({ width: "90%" });

            $cell.empty().append($input);
            $input.focus();

            const saveValue = () => {
                const newValue = $input.val().trim() || oldValue;
                $cell.text(newValue);
                settings.names[key] = newValue;
                runFunction(saveSettings, 'mfk7axpjoqj78z9b', []);

                displayStatus("success", key + " label updated to '" + newValue + "'");
            };

            $input.on("blur", saveValue);
            $input.on("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); saveValue(); }
                else if (ev.key === "Escape") $cell.text(oldValue);
            });
        });

        // === Info modal popups ===
        $j(document).on("click", ".info-btn", function (e) {
            e.preventDefault();
            const infoText = $j(this).data("info") || "No information available.";

            // Remove any existing modal
            $j(".info-modal-overlay").remove();

            // Create modal HTML
            const modal = `
    <div class="info-modal-overlay">
      <div class="info-modal">
        <button class="info-modal-close" title="Close">&times;</button>
        <div class="info-modal-content">${infoText}</div>
      </div>
    </div>
  `;

            // Append to body and focus
            $j("body").append(modal);

            // Close events
            $j(".info-modal-close, .info-modal-overlay").on("click", function (ev) {
                if (ev.target !== this && !$j(ev.target).hasClass("info-modal-close")) return;
                $j(".info-modal-overlay").remove();
            });
        });


        // ensures color previews load correctly
        runFunction(updateSamples, '98lit8z7k949r647', []);
    }


    // ============================================================
    // General Purpose Functions
    // ============================================================

    function switchTagCategory(holder, oldType, newType, tag) {
        // Remove old class
        holder.removeClass("s-" + oldType.replace(/^Tags/, "Tag"));
        // Remove old tag from settings
        removeTagElement(oldType, holder, tag);
        // Add new tag and class
        addTagElement(newType, holder, tag);
        holder.addClass("s-" + newType.replace(/^Tags/, "Tag"));
    }

    // Tag7d - Special Div Switching
    function addTags7dTagElement(type, holder, tag) {
        // Add the tag to settings first (keeps data consistent)
        runFunction(removeTagElement, '66osgybdimo35cpm', ["Tags7a", holder, tag]);
        runFunction(addTagElement, 'mu3lew78fzugh46o', ["Tags7d", holder, tag]);

        // Respect user toggle: only move the DOM into the hidden holder when the hide toggle is enabled
        try {
            if (settings.hideTags7dTags) {
                // If we have a .s-Tag7d-tags container, move the entire li/span wrapper there
                var $container = $j(".s-Tag7d-tags");
                if ($container.length) {
                    holder.parent().detach().appendTo($container);
                    $container.trigger("spyder.change");
                } else {
                    // Fallback: ensure the class is present so CSS-driven visibility works
                    holder.addClass("s-Tag7d");
                }
            } else {
                // Ensure the tag remains visible in-place and carries the class for styling only
                holder.addClass("s-Tag7d");
                holder.find("a").css("display", "inline");
                holder.css("display", "inline");
            }
        } catch (err) {
            console.error("addTags7dTagElement failed:", err);
        }
    }


    function removeTags7dTagElement(type, holder, tag) {
        try {
            var $parent = holder.parent();
            // If currently inside the .s-Tag7d-tags container, restore it before removing setting
            if ($parent.closest(".s-Tag7d-tags").length) {
                // Move tag back into main tag list (first column by default)
                var $tagList = $j("#torrent_tags_list .tag-column.col-1");
                if ($tagList.length === 0) $tagList = $j("#torrent_tags_list");
                $parent.detach().appendTo($tagList);

                $j(".s-Tag7d-tags").trigger("spyder.change");
            }
            // Remove from settings
            runFunction(removeTagElement, 'hg44i3lj2y2wvzx5', ["Tags7d", holder, tag]);
            // Clear any 7d classes so it returns to uncategorized behavior
            holder.removeClass("s-Tag7d s-Tag7d-hidden");
            var $container = $j("#torrent_tags.tag_inner");
            $container.trigger("spyder.change");
            // Rebuild detail buttons/state
            runFunction(highlightDetailTags, 'uvlm50acokjupufn', []);

        } catch (err) {
            console.error("removeTags7dTagElement failed:", err);
        }
    }


    function addTagElement(type, holder, tag) {
        // Normalize incoming type names so we always add classes like "s-Tag1a"
        // Accepts either "Tags1a" or "Tag1a" and normalizes to "Tag1a"
        var normalized = String(type || '').trim();

        // If it starts with "Tags", replace with "Tag"
        if (/^Tags/i.test(normalized)) {
            normalized = normalized.replace(/^Tags/, 'Tag');
        }
        // If it starts with lowercase 'tag', unify capitalization (optional)
        else if (/^tag/i.test(normalized)) {
            normalized = normalized.replace(/^tag/i, 'Tag');
        }

        /* Delete
        // As a fallback, if someone passed an old legacy name (good/loved/performer),
        // attempt to map them to TagXx to keep compatibility.
        const legacyToTagMap = {
            good: 'Tag1a',
            loved: 'Tag1b',
            performer: 'Tag2a',
            loveperf: 'Tag2b',
            newperf: 'Tag3a',
            amateur: 'Tag4a',
            loveamat: 'Tag4b',
            maleperf: 'Tag5a',
            lovemale: 'Tag5b',
            likesite: 'Tag6a',
            lovesite: 'Tag6b',
            disliked: 'Tag7a',
            hated: 'Tag7b',
            terrible: 'Tag7c',
            useless: 'Tag7d'
        };
        if (!/^Tag\d+[a-d]?$/i.test(normalized)) {
            var lower = normalized.toLowerCase();
            if (legacyToTagMap[lower]) normalized = legacyToTagMap[lower];
        }
*/
        holder.addClass("s-" + normalized);
        runFunction(addTags, 'hfvigt9ca2mptuyc', [type, tag]);

        try {
            runFunction(highlightDetailTags, 'tkdvdxy7yjobd4w6', []);
        } catch (err) {
            console.warn('highlightDetailTags() call failed after addTagElement', err);
        }
    }

    function removeTagElement(type, holder, tag) {
        // Build all classes dynamically from ALL_TAG_KEYS
        const allClasses = ALL_TAG_KEYS.map(key => `s-${key}`).join(' ');

        holder.removeClass(allClasses);
        runFunction(removeTags, 'anlfx8x79bqioqf7', [type, tag]);

        try {
            runFunction(highlightDetailTags, 's570ofb1h79n3woz', []);
        } catch (err) {
            console.warn('highlightDetailTags() call failed after removeTagElement', err);
        }
    }

    // --- Tag Management ---
    // Core add/remove operations that modify tag arrays in settings.
    // Ensures each tag only exists in one category at a time.

    function addTags(type, tags) {
        settings = getSettings();
        var tagArray = settings.tags[type];
        if (!Array.isArray(tagArray)) {
            tagArray = [];
            settings.tags[type] = tagArray;
        }

        var tmp = getEquivalentTags(tags);
        for (var i = 0; i < tmp.length; i++) {
            var tag = tmp[i];
            if (tag.length > 0 && tagArray.indexOf(tag) < 0) {

                // --- Remove the tag from any other tag-type arrays first ---
                for (const [otherType, otherList] of Object.entries(settings.tags)) {
                    if (otherType === type) continue; // skip the one we're adding to
                    const idx = otherList.indexOf(tag);
                    if (idx !== -1) {
                        otherList.splice(idx, 1);
                        console.log(`[TagMove] Removed "${tag}" from ${settings.names[otherType]} before adding to ${settings.names[type]}`);
                    }
                }

                tagArray.push(tag);
            }
        }

        // Sort the array alphabetically (numeric-aware)
        tagArray.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        // Save tags
        runFunction(saveTags, '5emid8yibmeaa7e0', [type, tagArray]);


    }


    function removeTags(type, tags) {
        settings = getSettings();
        var tagArray = settings.tags[type];
        if (!Array.isArray(tagArray)) return;
        var tmp = getEquivalentTags(tags);
        for (var i = 0; i < tmp.length; i++) {
            var tag = tmp[i];
            var idx = tagArray.indexOf(tag);
            if (idx >= 0) {
                tagArray.splice(idx, 1);
            }
        }
        runFunction(saveTags, '5wgxemkvjvwlbplk', [type, tagArray]);
    }

    // --- Tag Lookup Utility ---
    // Checks if a given tag string exists in a tag array (case-insensitive).
    function isTag(tags, tag) {
        if (!tags || !Array.isArray(tags)) return false;

        // Normalize both sides for reliable, exact comparison
        const normalizedTag = tag.toLowerCase().trim();

        for (let i = 0; i < tags.length; i++) {
            const listTag = tags[i].toLowerCase().trim();
            if (normalizedTag === listTag) {
                return true; // exact match only
            }
        }

        return false;
    }

    // --- GM Storage Helpers ---
    // Wrapper functions for Greasemonkey/Tampermonkey storage API.
    function getValue(name, def) {
        return GM_getValue(name, def);
    }

    function setValue(name, value) {
        GM_setValue(name, value);
    }

    function saveTags(name, tagArray) {
        var tmp = $j.grep(tagArray, function (tag) { return tag; });
        tmp.sort();
        settings.tags[name] = tmp;
        runFunction(saveSettings, 'gb6y6q7x2n75v41f', []);
    }

    function getSettings() {
        return JSON.parse(getValue("spyderSettings", "{}"));
    }

    function saveSettings() {
        setValue("spyderSettings", JSON.stringify(settings));
    }

    // --- Tag Normalization ---
    // Cleans up and normalizes tag names for comparison and consistency.
    function getEquivalentTags(tagArray) {
        if (typeof tagArray == "string") {
            tagArray = tagArray.split(" ");
        }
        var allTags = [];
        for (var i = 0, length = tagArray.length; i < length; i++) {
            var tag = tagArray[i];
            //if(/\./g.test(tag)){
            //	allTags.push(tag.replace(".", ""));
            //}
            allTags.push(tag);
        }
        return allTags;
    }

    function capitaliseFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // --- Parent/Child Cleanup ---
    // Removes overlapping tags from parent categories when also present in child categories.
    // Prevents duplication and keeps tag hierarchy consistent.
    function cleanChildTagsFromParent() {
        if (!settings || !settings.tags) {
            console.warn("[cleanChildTagsFromParent] Settings or tags not found");
            return [];
        }

        const tagsByType = settings.tags;
        const order = [
            "Tags1a", "Tags1b", "Tags1c",
            "Tags2a", "Tags2b", "Tags2c",
            "Tags3a", "Tags3b", "Tags3c",
            "Tags4a", "Tags4b", "Tags4c",
            "Tags5a", "Tags5b", "Tags5c",
            "Tags6a", "Tags6b", "Tags6c",
            "Tags7a", "Tags7b", "Tags7c", "Tags7d"
        ];

        const normalize = s => s.toLowerCase().trim();
        const conflicts = []; // cross-group duplicates

        // Go from deepest child upward so children override parents
        for (let i = order.length - 1; i >= 0; i--) {
            const current = order[i];
            const currentTags = (tagsByType[current] || []).map(normalize);

            // Skip if this list has no tags
            if (!currentTags.length) continue;

            for (let j = 0; j < i; j++) {
                const other = order[j];
                const otherTags = tagsByType[other] || [];

                // same family (same number prefix) → remove from parent
                if (other.slice(4, 5) === current.slice(4, 5)) {
                    const beforeCount = otherTags.length;
                    tagsByType[other] = otherTags.filter(
                        t => !currentTags.includes(normalize(t))
                    );
                    const removed = beforeCount - tagsByType[other].length;
                    if (removed > 0) {
                        console.log(`[Clean] Removed ${removed} duplicate(s) from ${other} (kept in ${current})`);
                    }
                } else {
                    // different family → record conflict for manual review
                    const overlap = otherTags.filter(t =>
                                                     currentTags.includes(normalize(t))
                                                    );
                    if (overlap.length > 0) {
                        overlap.forEach(tag =>
                                        conflicts.push({ tag, lists: [current, other] })
                                       );
                    }
                }
            }
        }

        runFunction(saveSettings, '3v7t2bc6j8ivpojg', [settings]);
        console.log(`[cleanChildTagsFromParent] Done. Cross-group conflicts found: ${conflicts.length}`);
        if (conflicts.length) console.table(conflicts);
        return conflicts;
    }

    function applyCustomColors() {
        if (!settings.colors) return;

        let css = "";
        for (const [type, c] of Object.entries(settings.colors)) {
            const styleKey = (type || "").replace(/^Tags/, "Tag");

            // Ensure border weight has px (in case anything wrote a bare number)
            const w = String((c && c.borderWeight) || "").trim();
            const weightPx = /px$/i.test(w) ? w : (isNaN(parseFloat(w)) ? "0px" : (parseFloat(w) + "px"));

            // Decide border-bottom based on border weight
            const weightNum = parseFloat(weightPx) || 0; // "2px" -> 2
            const borderBottom = (weightNum > 0)
            ? "0 !important"
            : `1px solid ${c.border}`;

            css += `
    span.s-tag.s-${styleKey},
    button.s-tag.s-${styleKey} {
        background: ${c.background} !important;

        border: ${weightPx} ${c.borderStyle} ${c.borderColor} !important;
    }
    span.s-tag.s-${styleKey} > a,
    button.s-tag.s-${styleKey} {
        color: ${c.text} !important;
    }

            .s-add-${type}, .s-remove-${type} {
                background: ${c.background} !important;
                border: 1px solid ${c.border} !important;
                color: #fff !important;
            }
        `;
        }
        $j("#customColorStyles").remove();
        $j("<style id='customColorStyles'>").text(css).appendTo("head");
    }
}

if (typeof jQuery == "undefined") {
    addJQuery(runScript);
}
else {
    runScript();
}

function addJQuery(callback) {
    var script = document.createElement("script");
    script.setAttribute("src", "https://code.jquery.com/jquery-1.12.4.min.js");
    script.addEventListener('load', function () {
        var script = document.createElement("script");
        script.textContent = "(" + callback.toString() + ")();";
        document.body.appendChild(script);
    }, false);
    document.body.appendChild(script);
}

(function () {
    'use strict';

    // Configurable selectors
    const middleColumnSelector = '#details_top > div.middle_column';
    const middleTableSelector = '#details_top > div.middle_column > table';
    const sidebarSelector = '#details_top > div.sidebar';
    const tagListSelector = '#torrent_tags_list';

    // Rearrange layout inside middle_column and normalize sidebar



function rearrangeLayout() {
    const middleColumn = document.querySelector('#details_top > div.middle_column');
    const sidebar = document.querySelector('#details_top > div.sidebar');
    const container = document.querySelector('#details_top');

    if (!middleColumn || !sidebar || !container) {
        console.warn('Rearrange script: One or more elements not found.');
        return;
    }

    container.insertBefore(middleColumn, sidebar);

    // Normalize sidebar layout
    sidebar.style.width = '100%';
    sidebar.style.boxSizing = 'border-box';
    sidebar.style.float = 'none';
    sidebar.style.display = 'block';

    // Reset margins
    middleColumn.style.marginTop = '0';
    middleColumn.style.marginBottom = '0';
    middleColumn.style.marginLeft = '0';
    middleColumn.style.marginRight = '0';

    console.log('middleColumn moved above sidebar:', middleColumn);

    // --- HappyFappy-only placement before the tag list wrapper ---
    const host = (window.location.hostname || '').toLowerCase();
    if (host.includes('happyfappy.org')) {
        // 1) Ensure sidebar is INSIDE middle_column
        if (!middleColumn.contains(sidebar)) {
            middleColumn.appendChild(sidebar);
        }

        // 2) Prefer the direct child #taglist-container as the reference
        let refNode = middleColumn.querySelector(':scope > #taglist-container');

        // 3) If that wrapper isn't found yet, fall back to walking up from #torrent_tags_list
        if (!refNode) {
            const innerTagList = middleColumn.querySelector('#torrent_tags_list');
            if (innerTagList) {
                // Walk up until the parent is the middle_column
                let n = innerTagList;
                while (n.parentElement && n.parentElement !== middleColumn) {
                    n = n.parentElement;
                }
                if (n.parentElement === middleColumn) {
                    refNode = n;
                }
            }
        }

        // 4) Insert BEFORE the found direct child, or append at end as a safe fallback
        if (refNode) {
            middleColumn.insertBefore(sidebar, refNode);
        } else {
            middleColumn.appendChild(sidebar);
            console.warn('rearrangeLayout: No direct taglist container found; appended sidebar to end.');
        }
    }
}




        // --- Layout Helper: 3-Column Tag Splitter ---
        // Reorganizes the tag list on detail pages into evenly spaced columns.
        function splitTagsIntoColumns() {

            const tagList = document.querySelector('#torrent_tags_list');
            if (!tagList) return;

            const allItems = Array.from(tagList.querySelectorAll('li')).filter(li => {
                if (li.closest('.s-Tag7d-tags')) return false;
                const s = window.getComputedStyle(li);
                return s.display !== 'none' && s.visibility !== 'hidden';
            });

            if (allItems.length === 0) return;

            // Always sort alphabetically
            allItems.sort((a, b) => {
                const textA = a.textContent.trim().toLowerCase();
                const textB = b.textContent.trim().toLowerCase();
                return textA.localeCompare(textB, undefined, { numeric: true, sensitivity: 'base' });
            });

            // Create 3 columns
            if (!window.shouldSkipTagSplit()) {
                const cols = Array.from({ length: 3 }, (_, i) => {
                    const d = document.createElement('div');
                    d.className = `tag-column col-${i + 1}`;
                    Object.assign(d.style, {
                        width: '33.33%',
                        float: 'left',
                        boxSizing: 'border-box'
                    });
                    return d;
                });

                const perCol = Math.ceil(allItems.length / 3);
                cols[0].append(...allItems.slice(0, perCol));
                cols[1].append(...allItems.slice(perCol, perCol * 2));
                cols[2].append(...allItems.slice(perCol * 2));

                const hiddenBlocks = Array.from(tagList.children)
                .filter(c => c.classList && c.classList.contains('s-Tag7d-tags'));

                tagList.textContent = '';
                cols.forEach(c => tagList.appendChild(c));
                hiddenBlocks.forEach(h => tagList.appendChild(h));
            }
            // Reapply layout helpers for correct spacing/backgrounds
            runFunction(enforceTagRowLayout, 'eimqkzlubg0yg9jl', []);
            runFunction(overrideTagLinkWidths, 'rkeym2z93t9tr9id', []);
            runFunction(resizeAllTagText, '6f4bq7xg2omsqz8w', []);

            // Ensure tag spans don’t stretch full width
            tagList.querySelectorAll('span.s-tag').forEach(span => {
                span.style.display = 'inline-flex';
                span.style.flex = '0 0 auto';
                span.style.alignItems = 'center';
            });
        }
        window.splitTagsIntoColumns = splitTagsIntoColumns;

        // --- Layout Helper: Tag Row Flex Alignment ---
        // Ensures tag list rows align cleanly with tag names and vote counts.
        function enforceTagRowLayout() {
            const tagItems = document.querySelectorAll('#torrent_tags_list li');
            if (!tagItems.length) return;

            tagItems.forEach(li => {
                // Core layout: single row, no wrap
                li.style.display = 'flex';
                li.style.flexWrap = 'nowrap';
                li.style.alignItems = 'center';
                li.style.justifyContent = 'space-between';
                li.style.overflow = 'hidden'; // prevent overflow breaking layout

                const tagSpan = li.querySelector('span.s-tag');
                const voteDiv = li.querySelector('div[style*="letter-spacing"]'); // right-side vote area
                const tagLink = tagSpan?.querySelector('a');

                // Left-side tag section (buttons + tag name)
                if (tagSpan) {
                    tagSpan.style.display = 'flex';
                    tagSpan.style.flex = '0 1 auto';
                    tagSpan.style.alignItems = 'center';
                    tagSpan.style.minWidth = '0'; // enables text truncation
                    tagSpan.style.overflow = 'hidden';
                    tagSpan.style.boxSizing = 'border-box';
                }

                // Tag link (truncate only this)
                if (tagLink) {
                    tagLink.style.flex = '1 1 auto';
                    tagLink.style.whiteSpace = 'nowrap';
                    tagLink.style.overflow = 'hidden';
                    tagLink.style.textOverflow = 'ellipsis';
                    tagLink.style.display = 'block';
                    tagLink.style.minWidth = '0';
                    tagLink.style.boxSizing = 'border-box';
                    tagLink.style.float = 'none'; // override old CSS
                }

                // Vote area (right side)
                if (voteDiv) {
                    voteDiv.style.flex = '0 0 auto';
                    voteDiv.style.whiteSpace = 'nowrap';
                    voteDiv.style.boxSizing = 'border-box';
                    voteDiv.style.textAlign = 'right';
                    voteDiv.style.marginLeft = '8px';
                }

                // Align the inner .s-button controls tightly
                li.querySelectorAll('.s-button').forEach(btn => {
                    btn.style.flex = '0 0 auto';
                    btn.style.marginRight = '2px';
                });
            });
        }
        window.enforceTagRowLayout = enforceTagRowLayout;

        // Limit width of staff/Tags7a tag links
        function overrideTagLinkWidths() {
            const selectors = [
                '.s-tag.s-staff a',
                '.s-tag.s-staff.s-Tag7a a'
            ];

            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(link => {
                    link.style.maxWidth = '110px';
                    link.style.display = 'inline-block';
                    link.style.boxSizing = 'border-box';
                });
            });
        }
        window.overrideTagLinkWidths = overrideTagLinkWidths;


        // Add toggle button to show/hide tag buttons + refresh layout button
        function addButtonToggle() {
            // Prevent duplicate toggle buttons
            if (document.querySelector('#hideTagButtonsToggle')) return;

            const tagList = document.querySelector(tagListSelector);
            const tagHeader = document.querySelector('#tag_container > .tag_header');

            // === Create Refresh Button ===
            const refreshBtn = document.createElement('button');
            refreshBtn.id = 'refreshTagLayout';
            refreshBtn.textContent = '⟳';
            Object.assign(refreshBtn.style, {
                backgroundColor: '#4C9A4C',
                color: '#fff',
                height: '22px',
                border: '1px solid #2f5a2f',
                borderRadius: '4px',
                padding: '2px 4px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginRight: '4px',
                marginTop: '2px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            });
            refreshBtn.addEventListener('mouseenter', () => {
                refreshBtn.style.backgroundColor = '#3F7E3F';
                refreshBtn.style.transform = 'translateY(-1px)';
                refreshBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
            });
            refreshBtn.addEventListener('mouseleave', () => {
                refreshBtn.style.backgroundColor = '#4C9A4C';
                refreshBtn.style.transform = 'translateY(0)';
                refreshBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
            });
            refreshBtn.addEventListener('click', () => {
                console.log ("Pressed Refresh.....")
                runFunction(rebuildTagLayout, '9nedi4ndiyg0rjyv', []);
            });

            // === Create Hide Button Toggle ===
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'hideTagButtonsToggle';
            toggleBtn.textContent = 'Hide Tag Buttons';
            Object.assign(toggleBtn.style, {
                backgroundColor: '#5A8BB8',
                color: '#fff',
                height: '22px',
                border: '1px solid #3d5e80',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginLeft: '2px',
                marginTop: '2px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            });
            toggleBtn.addEventListener('mouseenter', () => {
                toggleBtn.style.backgroundColor = '#4b7aa3';
                toggleBtn.style.transform = 'translateY(-1px)';
                toggleBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
            });
            toggleBtn.addEventListener('mouseleave', () => {
                toggleBtn.style.backgroundColor = '#5A8BB8';
                toggleBtn.style.transform = 'translateY(0)';
                toggleBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
            });

            let buttonsVisible = true;
            toggleBtn.addEventListener('click', () => {
                buttonsVisible = !buttonsVisible;
                document.querySelectorAll('.s-button, .s-Tag7d div, .s-Tag7d .s-button').forEach(btn => {
                    btn.style.display = buttonsVisible ? '' : 'none';
                });

                toggleBtn.textContent = buttonsVisible ? 'Hide Tag Buttons' : 'Show Tag Buttons';
            });

            // === Normal placement: details page ===
            if (tagHeader) {
                tagHeader.prepend(toggleBtn);
                tagHeader.prepend(refreshBtn);
                tagHeader.style.display = 'flex';
                tagHeader.style.alignItems = 'center';
                tagHeader.style.gap = '8px';
                tagHeader.style.padding = '6px 10px';
                return;
            }

            // === fallback: floating in upper left ===
            refreshBtn.style.position = 'fixed';
            refreshBtn.style.top = '10px';
            refreshBtn.style.left = '10px';
            refreshBtn.style.zIndex = '10000';
            toggleBtn.style.position = 'fixed';
            toggleBtn.style.top = '10px';
            toggleBtn.style.left = '50px';
            toggleBtn.style.zIndex = '10000';
            document.body.appendChild(refreshBtn);
            document.body.appendChild(toggleBtn);
            console.log('addButtonToggle() attached floating (fallback).');
        }
        window.addButtonToggle = addButtonToggle;



        // Shrink font size of tag links until they fit
        function resizeAllTagText() {
            const tagLinks = document.querySelectorAll('.s-tag > a');

            tagLinks.forEach(link => {
                const parent = link.parentElement;
                if (!parent) return;

                link.style.fontSize = '';
                link.style.whiteSpace = 'nowrap';
                link.style.overflow = 'hidden';
                link.style.textOverflow = 'ellipsis';
                link.style.display = 'inline-block';
                link.style.maxWidth = '100%';
                link.style.boxSizing = 'border-box';

                let fontSize = 16;
                while (link.scrollWidth > parent.clientWidth && fontSize > 10) {
                    fontSize -= 1;
                    link.style.fontSize = fontSize + 'px';
                }
            });
        }
        window.resizeAllTagText=resizeAllTagText;

        function isEmporiumTorrentPage() {
            return /^https:\/\/www\.empornium\.sx\/torrents\.php\?id=\d+/.test(window.location.href);
        }

        function initializeEnhancements() {
            // if (!isEmporiumTorrentPage()) return;

            runFunction(rearrangeLayout, 'rqpc3ze9eoklvvac', []);

            // Step 1: split after the DOM settles
            setTimeout(() => {
                runFunction(splitTagsIntoColumns, '2hswltyy1emh3z85', []);

                // Step 2: after the split finishes building the columns,
                // give the browser one tick to render, then enforce layout
                setTimeout(() => {
                    runFunction(enforceTagRowLayout, '16hga5lqg0ayi0l6', []);
                    runFunction(overrideTagLinkWidths, '4i7tghbbugbjia4c', []);
                    runFunction(addButtonToggle, 'z0kakhkuk3sdydm9', []);
                    runFunction(resizeAllTagText, 'g9t3x7fyz0naioxg', []);
                }, 50);

            }, 250);

            // --- New safety net ---
            setTimeout(() => {
                const cols = document.querySelectorAll('#torrent_tags_list .tag-column');
                if (cols.length < 2) {
                    // Retry once if it didn’t split properly
                    runFunction(splitTagsIntoColumns, '1yucitl7x1pryu1x', []);
                }
            }, 600);
        }


        function waitForLayoutReady(callback) {
            const container = document.querySelector('#details_top');
            if (!container) {
                console.warn('LayoutWatcher: #details_top not found.');
                return;
            }

            const observer = new MutationObserver(() => {
                const middleColumn = container.querySelector('div.middle_column');
                const tagList = container.querySelector('#torrent_tags_list');
                const sidebar = container.querySelector('div.sidebar');

                if (middleColumn && tagList && sidebar) {
                    observer.disconnect();
                    console.log('Layout ready: triggering enhancements');
                    callback();
                }
            });

            observer.observe(container, { childList: true, subtree: true });
        }

        // Run enhancements once #torrent_tags_list is ready
        if (/torrents\.php/.test(window.location.href) && /id=\d+/.test(window.location.href)) {
            waitForLayoutReady(() => {
                runFunction(initializeEnhancements, 'nl5np2s75wewk9f9', []);
            });
        }

        function rebuildTagLayout() {
            setTimeout(() => {
                try {
                    console.log("🔁 Rebuilding tag layout...");
                    runFunction(highlightDetailTags, '2c5anxv59ystmji1', []);
                    runFunction(rearrangeLayout, 'uxjouy2sjvedwly0', []);
                    runFunction(splitTagsIntoColumns, '4jiq2v8m4svjq0hk', []);
                    runFunction(enforceTagRowLayout, 'y0o8ew4hhbqe7jis', []);
                    runFunction(overrideTagLinkWidths, 'taec30gdt19szwdc', []);
                    runFunction(resizeAllTagText, '168o5p8wofx26w1h', []);
                    runFunction(addButtonToggle, 'vcjy4ldrxj8ycx6r', []);

                } catch (err) {
                    console.warn("🔴 Tag layout rebuild failed:", err);
                }
            }, 300);
        }

        window.rebuildTagLayout = rebuildTagLayout;
        // --- Mutation Observer: Tags7d (Hidden Tags) ---
        // Monitors changes in the hidden tags container to trigger layout rebuilds.
        (function observeTags7d() {
            const hidden7d = document.querySelector('.s-Tag7d-tags');
            if (!hidden7d) {
                setTimeout(observeTags7d, 500);
                return;
            }

            let isRebuilding = false;

            const observer = new MutationObserver(() => {
                if (isRebuilding) return;
                isRebuilding = true;

                // wait a bit so the add/remove operation finishes
                setTimeout(() => {
                    try {
                        runFunction(rearrangeLayout, 'fqvqjad6ovpf30pc', []);
                        runFunction(splitTagsIntoColumns, 'fmpknv0vlkg063g0', []);
                        runFunction(enforceTagRowLayout, 'gk6r3uw6oevo37zt', []);
                        runFunction(overrideTagLinkWidths, 'op5tce1p2artfoaw', []);
                        runFunction(addButtonToggle, 'jn34hbjb18o5u2zl', []);
                        runFunction(resizeAllTagText, 'x7ewpozd8a63bcp4', []);
                    } catch (err) {
                        console.warn('Tags7d observer rebuild failed:', err);
                    } finally {
                        isRebuilding = false;
                    }
                }, 300);
            });

            observer.observe(hidden7d, { childList: true, subtree: false });

            console.log('Observer active: re-reading tags on Tags7d changes');
        })();

        // Observe for added tags and reapply the tag layout.
        const tagAddContainer = document.querySelector(".tag_add");

        if (tagAddContainer) {
            const observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    for (const node of mutation.addedNodes) {
                        if (
                            node.nodeType === 1 &&
                            node.id === "messagebar0" &&
                            node.textContent.includes("Added")
                        ) {
                            runFunction(processDetailsPage, 'fsjggygvnq7r875i', []);
                            setTimeout(() => {
                                runFunction(rebuildTagLayout, 'dadb29zs43ogorz9', []);

                            }, 100);
                        }
                    }
                }
            });

            observer.observe(tagAddContainer, {
                childList: true,
                subtree: false, // only direct children of .tag_add
            });
        }

        // --- Focus Observer ---
        // When the tab regains focus, rechecks and rebuilds tag layout if needed.
        // Minor hack to fix the layout being "Off" when opening detials in new tab.
        (function observeFocusForRebuild() {
            // ✅ Only run on torrent details pages
            if (!/torrents\.php\?id=/.test(window.location.href)) return;
            let isRebuilding = false;

            window.addEventListener('focus', () => {
                if (isRebuilding) return;
                isRebuilding = true;

                console.log('Window focused — triggering layout recheck');

                setTimeout(() => {
                    try {
                        runFunction(rebuildTagLayout, 'llou6iuynqvw379q', []);
                    } catch (err) {
                        console.warn('Focus rebuild failed:', err);
                    } finally {
                        isRebuilding = false;
                    }
                }, 300);
            });
        })();


    })();
    // This is the very end of this file.
