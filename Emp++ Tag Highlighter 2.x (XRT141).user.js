// ==UserScript==
// @name         Emp++ Tag Highlighter 2.x (XRT141)
// @namespace    http://tampermonkey.net/
// @version      2.0.40
// @description  Enhanced Emp++ Tag Highlighter branched from v0.7.9b
// @author       allebady, xrt141
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-1.12.4.min.js
// @include      /^https://www\.empornium\.(me|sx|is)/
// @include      /^https://www\.enthralled\.me/
// @include      /^https://pornbay\.org/
// @include      /^https://femdomcult\.org/
// @include      /^https://www\.homeporntorrents\.club/
// @match        *://*.empornium.sx/torrents.php*
// @updateURL    https://github.com/xrt141/Userscripts/raw/refs/heads/main/Emp++%20Tag%20Highlighter%202.x%20(XRT141).user.js
// @downloadURL  https://github.com/xrt141/Userscripts/raw/refs/heads/main/Emp++%20Tag%20Highlighter%202.x%20(XRT141).user.js
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

*/


// --- Main Execution Wrapper ---
// Initializes configuration, settings, tag logic, and all UI handlers.
function runScript(){
    var $j = $.noConflict(true);

    // --- Default Configuration Settings ---
    // Defines all default feature toggles, color mappings, and tag categories.
    // These defaults are merged with any saved user settings at runtime.
    var defaults = {
        majorVersion : 2.0,
        //Options
        truncateTags : true, //button removed
        usePercentBar : false,
        useTorrentOpacity : false,
        useTorrentColoring : false,
        useTorrentBlacklistNotice : true,
        useBlacklistNoticeBookmark : false,
        useBlacklistNoticeCollages : false,
        hideTags7cTorrents: false,
        hideTags7dTags: false,
        disableItalics: false,
        roomierTags: false,

        //Tag types to enable
        useTag1aTags : false,
        useTag1bTags : false,
        useTag2aTags : false,
        useTag2bTags : false,
        useTag3aTags : false,
        useTag3bTags : false,
        useTag4aTags : false,
        useTag4bTags : false,
        useTag5aTags : false,
        useTag5bTags : false,
        useTag6aTags : false,
        useTag6bTags : false,
        useTag7aTags : false,
        useTag7bTags : false,
        useTag7cTags : false,
        useTag7dTags : false,

        //Should we hide any tag buttons?
        buttonTag1aTags : false,
        buttonTag2aTags : false,
        buttonTag3aTags : false,
        buttonTag4aTags : false,
        buttonTag5aTags : false,
        buttonTag6aTags : false,
        buttonTag7aTags : false,

        // Color default settings - matches colors from 0.7.9b
        colors: {
            Tags1a: { background: "#A9DF9C", border: "#000000", text: "#000000" },
            Tags1b: { background: "#3D9949", border: "#000000", text: "#000000" },
            Tags2a: { background: "#769dc9", border: "#000000", text: "#000000" },
            Tags2b: { background: "#3a6392", border: "#000000", text: "#ffffff" },
            Tags3a: { background: "#f7d600", border: "#000000", text: "#000000" },
            Tags3b: { background: "#ccc870", border: "#000000", text: "#000000" }, //new
            Tags4a: { background: "#cfd9e2", border: "#000000", text: "#000000" },
            Tags4b: { background: "#afc0cf", border: "#000000", text: "#ffffff" },
            Tags5a: { background: "#f3af58", border: "#000000", text: "#000000" },
            Tags5b: { background: "#e58306", border: "#000000", text: "#ffffff" },
            Tags6a: { background: "#e86eed", border: "#000000", text: "#000000" },
            Tags6b: { background: "#d01dd7", border: "#000000", text: "#ffffff" },
            Tags7a: { background: "#F3AAAA", border: "#000000", text: "#000000" },
            Tags7b: { background: "#840000", border: "#000000", text: "#ffffff" },
            Tags7c: { background: "#222222", border: "#000000", text: "#EEEEEE" },
            Tags7d: { background: "#999999", border: "#000000", text: "#000000" }
        },

        // Category Name default settings - matches names from 0.7.9b
        names: {
            Tags1a: "Liked",
            Tags1b: "Loved",
            Tags2a: "Performer",
            Tags2b: "Loved Performer",
            Tags3a: "New Performer",
            Tags3b: "Loved New Performer", //new
            Tags4a: "Amateur",
            Tags4b: "Loved Amateur",
            Tags5a: "Male Performer",
            Tags5b: "Loved Male Performer",
            Tags6a: "Liked Site",
            Tags6b: "Loved Site",
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

    // === Global list of all tag keys (used everywhere) ===
    const ALL_TAG_KEYS = [
        "Tags1a","Tags1b","Tags2a","Tags2b","Tags3a","Tags3b","Tags4a","Tags4b",
        "Tags5a","Tags5b","Tags6a","Tags6b","Tags7a","Tags7b","Tags7c","Tags7d"
    ];

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
                performer: "Tags2a",
                loveperf: "Tags2b",
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
                buttonGoodTags: "buttonTag1aTags",
                buttonPerformerTags: "buttonTag2aTags",
                buttonNewperfTags: "buttonTag3aTags",
                buttonAmateurTags: "buttonTag4aTags",
                buttonMaleperfTags: "buttonTag5aTags",
                buttonLikesiteTags: "buttonTag6aTags",
                buttonDislikedTags: "buttonTag7aTags"
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
                Tags2a: "Performer",
                Tags2b: "Loved Performer",
                Tags3a: "New Performer",
                Tags3b: "Loved New Performer",
                Tags4a: "Amateur",
                Tags4b: "Loved Amateur",
                Tags5a: "Male Performer",
                Tags5b: "Loved Male",
                Tags6a: "Liked Site",
                Tags6b: "Loved Site",
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

    // Ensure we handle missing or older version values
    if (typeof settings.majorVersion === "undefined" || settings.majorVersion < defaults.majorVersion) {
        settings.majorVersion = defaults.majorVersion;
        saveSettings();
        // handle upgrade actions here if needed
    }

    // Default values for the tag effect on the percent bar and torrent good / bad color
    if (!settings.tagValues) {
        settings.tagValues = {
            Tags1a: "good",
            Tags1b: "verygood",
            Tags2a: "good",
            Tags2b: "verygood",
            Tags3a: "good",
            Tags3b: "verygood",
            Tags4a: "good",
            Tags4b: "verygood",
            Tags5a: "good",
            Tags5b: "verygood",
            Tags6a: "good",
            Tags6b: "verygood",
            Tags7a: "bad",
            Tags7b: "verybad",
            Tags7c: "verybad",
            Tags7d: "ignore"
        };
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


    // --- UI Builder: Dynamic Generators ---
    // Dynamically generate HTML instead of large repetetive blocks

    // --- UI Builder: Tag Value Dropdown ---
    // Creates HTML <select> menus for setting tag sentiment weights (Good/Bad/Ignore).
    function buildTagValueSelect(tagKey){
        // tagKey example: "Tags1a"
        var v = settings.tagValues && settings.tagValues[tagKey] ? settings.tagValues[tagKey] : "";
        var opts = [
            ["ignore","Ignore"],
            ["good","Good"],
            ["verygood","Very Good"],
            ["bad","Bad"],
            ["verybad","Very Bad"]
        ];
        var out = "<select class='tag-value-select' data-tag='" + tagKey + "'>";
        for(var i=0;i<opts.length;i++){
            var val = opts[i][0], label = opts[i][1];
            out += "<option value='" + val + "'" + (v===val ? " selected" : "") + ">" + label + "</option>";
        }
        out += "</select>";
        return out;
    }

    // --- UI Builder: Tag Configuration Panels ---
    // Dynamically generates tabbed configuration sections for each tag type.
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

    // --- UI Builder: Color Settings Table Row ---
    // Generates a table row with color pickers for each tag type.
    function buildColorRow(tagKey) {
        var name = settings.names[tagKey];
        var colorObj = settings.colors[tagKey];
        var bg = colorObj.background;
        var txt = colorObj.text;

        return (
            "<tr>" +
            "<td><button class='edit-label' data-name='" + tagKey + "'>✎</button></td>" +
            "<td class='label-cell' data-name='" + tagKey + "'>" + name + "</td>" +
            "<td><input type='color' id='color-" + tagKey + "-bg' value='" + bg + "'></td>" +
            "<td><input type='color' id='color-" + tagKey + "-text' value='" + txt + "'></td>" +
            "<td><span id='sample-" + tagKey + "' class='sample-tag'>Sample.Tag" +
            "<div class='s-button s-remove-" + tagKey + "' title='Un-Mark tag as " + name + "'>–</div>" +
            "</span></td>" +
            "</tr>"
        );
    }

    // --- Build the html for the settings interface ---
    function buildSettingsHTML() {
        console.group("🧩 buildSettingsHTML() Debug");
        console.log("settings.names snapshot at build start:", JSON.parse(JSON.stringify(settings.names)));

        var configHTML =
            "<div id='s-conf-background'>" +
            "<div id='s-conf-wrapper'>" +
            "<h1>Empornium++Tag Highlighter Settings</h1>" +
            "<div id='s-conf-status'></div>" +

            // Tabs
            "<div class='tab-row-container'" +
            "<ul class='tab-row'>" +
            "<li data-page='s-conf-general' class='s-selected'><a class='s-conf-tab' >General</a></li>" +
            "<li data-page='s-conf-Tags1a-tags'><a class='s-conf-tab'>" + settings.names.Tags1a + " Tags</a></li>" +
            "<li data-page='s-conf-Tags1b-tags'><a class='s-conf-tab'>" + settings.names.Tags1b + " Tags</a></li>" +
            "<li data-page='s-conf-Tags2a-tags'><a class='s-conf-tab'>" + settings.names.Tags2a + " Tags</a></li>" +
            "<li data-page='s-conf-Tags2b-tags'><a class='s-conf-tab'>" + settings.names.Tags2b + " Tags</a></li>" +
            "<li data-page='s-conf-Tags3a-tags'><a class='s-conf-tab'>" + settings.names.Tags3a + " Tags</a></li>" +
            "<li data-page='s-conf-Tags3b-tags'><a class='s-conf-tab'>" + settings.names.Tags3b + " Tags</a></li>" +
            "<li data-page='s-conf-Tags4a-tags'><a class='s-conf-tab'>" + settings.names.Tags4a + " Tags</a></li>" +
            "<li data-page='s-conf-Tags4b-tags'><a class='s-conf-tab'>" + settings.names.Tags4b + " Tags</a></li>" +
            "<li data-page='s-conf-Tags5a-tags'><a class='s-conf-tab'>" + settings.names.Tags5a + " Tags</a></li>" +
            "<li data-page='s-conf-Tags5b-tags'><a class='s-conf-tab'>" + settings.names.Tags5b + " Tags</a></li>" +
            "</ul>" +
            "</div>"+
            "<div class='tab-row-container'" +
            "<ul class='tab-row'>" +
            "<li data-page='s-conf-Tags6a-tags'><a class='s-conf-tab'>" + settings.names.Tags6a + " Tags</a></li>" +
            "<li data-page='s-conf-Tags6b-tags'><a class='s-conf-tab'>" + settings.names.Tags6b + " Tags</a></li>" +
            "<li data-page='s-conf-Tags7a-tags'><a class='s-conf-tab'>" + settings.names.Tags7a + " Tags</a></li>" +
            "<li data-page='s-conf-Tags7b-tags'><a class='s-conf-tab'>" + settings.names.Tags7b + " Tags</a></li>" +
            "<li data-page='s-conf-Tags7c-tags'><a class='s-conf-tab'>" + settings.names.Tags7c + " Tags</a></li>" +
            "<li data-page='s-conf-Tags7d-tags'><a class='s-conf-tab'>" + settings.names.Tags7d + " Tags</a></li>" +
            "<li data-page='s-conf-colors'><a class='s-conf-tab'>Color/Names</a></li>" +
            "<li data-page='s-conf-dupe-cleanup'><a class='s-conf-tab'>Dupe Cleanup</a></li>" +
            "<li data-page='s-conf-import-export'><a class='s-conf-tab'>Import/Export</a></li>" +
            "</ul>" +
            "</div>"+

            // General
            "<div id='s-conf-content'>" +
            "<form id='s-conf-form'>" +
            "<div class='s-conf-page s-selected' id='s-conf-general'>" +
            "<br/><h2>Enable/Disable Tag Types:</h2>" +
            "<table class='s-conf-tag-table'>" +
            "<thead><tr>" +
            "<thead><tr><th></th><th>Name</th><th>Enable</th><th>Hide</th><th>Value <span class='info-header-icon' data-tooltip='Affects the percent bar (if enabled)'>i</span></th><th>Note</th></tr></thead><tbody>" +
            "</tr></thead><tbody>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags1a + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags1a + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags1a + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag1aTags'/></td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='buttonTag1aTags'/></td>" +
            "<td>" + buildTagValueSelect('Tags1a') + "</td>" +
            "<td>Main " + settings.names.Tags1a + " Tags</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags1b + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags1b + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags1b + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag1bTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags1b') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags1a + " enabled</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags2a + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags2a + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags2a + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag2aTags'/></td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='buttonTag2aTags'/></td>" +
            "<td>" + buildTagValueSelect('Tags2a') + "</td>" +
            "<td>Main " + settings.names.Tags2a + " Tags</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags2b + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags2b + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags2b + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag2bTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags2b') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags2a + " enabled</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags3a + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags3a + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags3a + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag3aTags'/></td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='buttonTag3aTags'/></td>" +
            "<td>" + buildTagValueSelect('Tags3a') + "</td>" +
            "<td>Main " + settings.names.Tags3a + " Tags</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags3b + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags3b + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags3b + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag3bTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags3b') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags3a + " enabled</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags4a + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags4a + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags4a + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag4aTags'/></td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='buttonTag4aTags'/></td>" +
            "<td>" + buildTagValueSelect('Tags4a') + "</td>" +
            "<td>Main " + settings.names.Tags4a + " Tags</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags4b + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags4b + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags4b + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag4bTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags4b') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags4a + " enabled</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags5a + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags5a + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags5a + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag5aTags'/></td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='buttonTag5aTags'/></td>" +
            "<td>" + buildTagValueSelect('Tags5a') + "</td>" +
            "<td>Main " + settings.names.Tags5a + " Tags</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags5b + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags5b + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags5b + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag5bTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags5b') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags5a + " enabled</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags6a + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags6a + "</b> and display them in the torrent list.'>i</button></td>" +
            "<td>" + settings.names.Tags6a + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag6aTags'/></td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='buttonTag6aTags'/></td>" +
            "<td>" + buildTagValueSelect('Tags6a') + "</td>" +
            "<td>Main " + settings.names.Tags6a + " Tags</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags6b + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags6b + "</b> and display them in the torrent list.'>i</button></td>" +
            "<td>" + settings.names.Tags6b + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag6bTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags6b') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags6a + " enabled</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags7a + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags7a + "</b> and display them in the torrent list.'>ℹ</button></td>" +
            "<td>" + settings.names.Tags7a + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag7aTags'/></td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='buttonTag7aTags'/></td>" +
            "<td>" + buildTagValueSelect('Tags7a') + "</td>" +
            "<td>Main " + settings.names.Tags7a + " Tags</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags7b + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags7b + "</b> and display them in the torrent list.'>i</button></td>" +
            "<td>" + settings.names.Tags7b + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag7bTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags7b') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags7a + " enabled</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags7c + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags7c + "</b> and display them in the torrent list. <br> <br> <b> Note:</b> Torrents with these tags will be hidden from view'>ℹ</button></td>" +
            "<td>" + settings.names.Tags7c + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag7cTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags7c') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags7a + " enabled</td></tr>" +

            "<tr><td><button class='info-btn' data-info='Enable basic <b>" + settings.names.Tags7d + "</b> tag highlighting. This will highlight all tags you have marked as <b>" + settings.names.Tags7d + "</b> and display them in the torrent list. <br> <br> <b> Note:</b> These tags will be hidden from view. They can be viewed by choosing \"Show hidden tags\"'>ℹ</button></td>" +
            "<td>" + settings.names.Tags7d + "</td>" +
            "<td><input class='s-conf-gen-checkbox' type='checkbox' name='useTag7dTags'/></td>" +
            "<td>—</td>" +
            "<td>" + buildTagValueSelect('Tags7d') + "</td>" +
            "<td><b><b>Requires:</b></b> " + settings.names.Tags7a + " enabled</td></tr>" +

            "</tbody></table>" +

            "<br/><h2>Torrent Display Options:</h2>" +
            //Torrent Options Checkboxes
"<div class='torrent-options'>" +
"<label title='Show a color bar representing good vs bad tags'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='usePercentBar'/> Use Percent Bar</label>" +

"<label title='Adjust torrent opacity based on performance score'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='useTorrentOpacity'/> Use Opacity on Torrents</label>" +

"<label title='Color torrents according to tag scores (green=good, red=bad)'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='useTorrentColoring'/> Use Color on Torrents</label>" +

"<label title='Display a notice when a torrent contains blacklisted tags'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='useTorrentBlacklistNotice'/> Use Blacklist Notice</label>" +

"<label title='Also apply blacklist notice logic to bookmarked torrents'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='useBlacklistNoticeBookmark'/> Include Bookmarks</label>" +

"<label title='Also apply blacklist notice logic to collage items'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='useBlacklistNoticeCollages'/> Include Collages</label>" +

"<label title='Hide torrents that contain " + settings.names.Tags7c + " tags'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='hideTags7cTorrents'/> Hide torrents with " + settings.names.Tags7c + " Tags</label>" +

"<label title='Hide " + settings.names.Tags7d + " tags entirely from view'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='hideTags7dTags'/> Hide " + settings.names.Tags7d + " Tags</label>" +

"<label title='Removes italics from tags (Torrent List Page)'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='disableItalics'/> Disable Italic Tags (List Page)</label>" +

"<label title='Adds extra vertical spacing between tags for easier reading (Torrent List Page)'>" +
  "<input class='s-conf-gen-checkbox' type='checkbox' name='roomierTags'/> More Space Between Tags (List Page)</label>" +
"</div>"

            "<div class='s-conf-buttons'>" +
            "<input id='s-conf-save' type='button' value='Save Settings'/>" +
            "</div>" +
            "</div>";

        // === Dynamically append Add/Remove/Display panels ===

        (function() {
            for (const key of ALL_TAG_KEYS) {
                var panelHTML = buildTagPanel(key);
                // console.log("Generated HTML for " + key + ":\n", panelHTML); // 🐞Debug Output to console
                configHTML += panelHTML;
            }
        })();


        // resume normal concatenation
        configHTML +=
            "<div class='s-conf-page' id='s-conf-colors'>" +
            "<h2>Customize Tag Colors</h2>" +
            "<div class='s-conf-color-columns'>";

        (function() {
            // Split the master tag list roughly in half for two color tables
            const midIndex = Math.ceil(ALL_TAG_KEYS.length / 2);
            const halves = [ALL_TAG_KEYS.slice(0, midIndex), ALL_TAG_KEYS.slice(midIndex)];

            for (const tagSet of halves) {
                // Start new table
                configHTML += "<table class='s-conf-color-table'>" +
                    "<tr><th></th><th>Name</th><th>Background</th><th>Text</th><th>Sample</th></tr>";

                for (const key of tagSet) {
                    var colorHTML = buildColorRow(key);
                    // console.log('Generated HTML for ' + key + ':\n', colorHTML); // 🐞 Debug Output
                    configHTML += colorHTML;
                }

                // Close current table
                configHTML += "</table>";
            }
        })();


        configHTML +=
            "</div>" +


            "<div class='s-conf-buttons'>" +
            "<input id='s-conf-save' type='button' value='Save Settings'/>" +
            "</div>" +
            "</div>" +
            // Import/Export panel
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
            // Duplicate Category Cleanup Tab
            "<div class='s-conf-page' id='s-conf-dupe-cleanup'>" +
            "<h2>Duplicate Tag Cleanup</h2>" +
            "<p>These tags exist in more than one list. Select the proper category. The tag will be removed from all others.)</p>" +
            "<div id='dupeCleanupList' style='max-height:400px; overflow-y:auto; border:1px solid #333; padding:8px; margin-top:10px; font-family:monospace; white-space:pre;'>(Click the Dupe Cleanup tab to refresh the list)</div>" +
            "</div>" +
            "</form>" +
            "</div>" +
            "<div class='s-conf-buttons'>" +
            "<input id='s-conf-close' type='button' value='Close'/>" +
            "</div>" +
            "</div>" +
            "</div>";

        console.log("settings.names snapshot at build end:", JSON.parse(JSON.stringify(settings.names)));
        console.groupEnd();
        console.log("🟣 Built New HTML");
        return configHTML;
    }


    // --- Stylesheet Injection ---
    var stylesheet = `
<style type="text/css">
#torrent_tags>li{border-bottom:1px solid #999; padding-bottom:2px;}
.s-conf-tag-table {border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 12px; line-height: 1.1;}
.s-conf-tag-table th, .s-conf-tag-table td { border: 1px solid #ccc; padding: 2px 6px; text-align: left;}
.s-conf-tag-table th {background: #eee;}
.s-conf-tag-table th:first-child, .s-conf-tag-table td:first-child { width: 26px; text-align: center; padding: 0; }
.s-conf-tag-table input[type='checkbox'] { transform: scale(1.1); margin: 0; vertical-align: middle; }
.s-conf-tag-table select.tag-value-select { font-size: 12px; padding: 2px 3px; }
.s-conf-tag-table td:nth-child(6) { text-align: left; }
.s-conf-tag-table td:nth-child(5) { text-align: center; }
.torrent-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.torrent-options label { display: flex; align-items: center; white-space: nowrap; }
/* Header info icon */
.s-conf-tag-table .info-header-icon { position: relative; display: inline-block; cursor: help; font-size: 12px; color: #666; margin-left: 4px; }
.s-conf-tag-table .info-header-icon:hover { color: #000; }
/* Fancy tooltip for header info icon */
.s-conf-tag-table .info-header-icon::after { content: attr(data-tooltip); position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 4px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 10000; }
.s-conf-tag-table .info-header-icon:hover::after { opacity: 1; }
/* Info button */
.info-btn { cursor: pointer; font-size: 14px; border: none; background: none; color: #444; padding: 0; line-height: 1; }
.info-btn:hover { color: #000; }
/* Modal overlay and content */
.info-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.info-modal { background: #fff; border-radius: 6px; padding: 16px 20px; width: 420px; max-width: 90%; max-height: 80%; overflow-y: auto; box-shadow: 0 2px 12px rgba(0,0,0,0.4); font-size: 13px; line-height: 1.4; position: relative; }
.info-modal h3 { margin-top: 0; }
.info-modal-close { position: absolute; top: 6px; right: 10px; border: none; background: none; font-size: 18px; cursor: pointer; color: #666; }
.info-modal-close:hover { color: #000; }
#s-conf-background{position:fixed; top:0; bottom:0; left:0; right:0; z-index:1000; background-color:rgba(50,50,50,0.6);}
#s-conf-wrapper{background:#eee; color:#444; position:relative; width:1200px; overflow:hidden; margin:50px auto; font-size:14px;padding:15px 20px; border-radius:16px; box-shadow: 0 0 20px black;max-height:90vh;overflow-y:auto;overflow-x:hidden;z-index:9999;}
#s-conf-wrapper h2{background:none; text-align:left; color:#444; padding:0; border-radius: unset;}
#s-conf-status{padding:8px; line-height:16px; text-align:center; border:1px solid #ddd; margin-top:15px; display:none;}
#s-conf-status.s-success{border-color:#135300; background:#A9DF9C;}
#s-conf-status.s-error{border-color:#840000; background:#F3AAAA;}
#s-conf-status-close{cursor:pointer;}
#s-conf-tabs{width:100%; margin:15px 0 -1px 0; overflow:hidden; cursor:pointer;}
#s-conf-tabs li, #s-conf-tabs h2{ border: 1px solid #444; border-bottom: 0; border-radius: 4px 4px 0 0; line-height: normal; width: 130px; margin:0; list-style:none;float:left;}
#s-conf-content{width:100%; overflow:hidden; border:1px solid #444; border-radius:4px; border-top-left-radius: 0px; box-shadow:0 -1px 10px rgba(0,0,0,0.6);}
.tab-row-container {height: 50px;box-sizing: border-box;  display: flex;cursor:pointer;}
.tab-row-container li {display:inline-block;height: 40px;flex: 1; list-style: none; margin: 0; border: 1px solid #444; border-bottom: 0; border-radius: 4px 4px 0 0; line-height: normal; text-align: center;padding:5px;}
.tab-row-container a {color: #444; font-size:14px;text-align: center; text-decoration:none;}
.tab-row-container a:hover { text-decoration:none; color: black;}
.tab-row-container li:hover {background-color: white;}
.tab-row-container li.s-selected {background-color:#fff;text-decoration:none; color:black}
#s-conf-form{display:block; background:#fff; padding:15px;}
#s-conf-form label{display:block;}
.s-conf-buttons{margin-top:8px; width:100%; text-align:center;}
.s-conf-page{display:none;}
.s-conf-page.s-selected{display:block;}
.s-conf-page input{vertical-align:text-bottom;}
#s-conf-general label{cursor:pointer;}
#s-conf-general img{margin-bottom:10px; display:none;}
#s-conf-general a:hover+img{display:block;}
.s-conf-tag-txtarea{width:95%; height:300px; background:#ddd; word-spacing:10px; line-height:18px;box-sizing:border-box;}
.s-conf-add-tags, .s-conf-remove-tags{width:950px;}
.s-conf-add-btn, .s-conf-remove-btn{width:110px;}
.s-conf-color-columns { display:flex; gap:20px; }
.s-conf-color-table { width:50%; border-collapse:collapse; margin-top:10px; }
.s-conf-color-table th, .s-conf-color-table td { border:1px solid #ccc; padding:4px; text-align:center; }
.sample-tag { display:inline-block; padding:2px 6px; border:1px solid #000; border-radius:12px; font-weight:normal; }
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
.tag_inner .s-tag{background:#CCC; border-bottom:1px solid #888; border-radius:16px; padding:1px 5px;}
.tag_inner .s-tag> a{color:#000000}
.tag_inner span.s-tag {border-width: 2px; display:block; float:left; line-height: 18px; margin: 2px 3px; padding: 0 6px; white-space: nowrap;}
.s-button{float:left; width:15px; height:14px; border-radius:6px; color:#fff; font:bold 16px/15px Arial, sans-serif; text-align:center; margin:1px 3px 1px 0px; cursor:pointer; opacity:0.8;}
.s-button:hover{opacity:1;}
.s-remove-Tags1a, .s-remove-Tags2a, .s-remove-Tags2b, .s-remove-Tags5a, .s-remove-Tags5b, .s-remove-Tags7a, .s-remove-Tags7b, .s-remove-Tags7c, .s-remove-Tags7d, .s-add-Tags7d{line-height:11px;}
.s-tag{margin:1px 2px;}
.s-tag .s-button{display:none;}
.s-tag .s-add-Tags1a, .s-tag .s-add-Tags2a, .s-tag .s-add-Tags3a, .s-tag .s-add-Tags4a, .s-tag .s-add-Tags5a, .s-tag .s-add-Tags6a, .s-tag .s-add-Tags7a{display:block}
.s-tag.s-Tag1a .s-button, .s-tag.s-Tag1b .s-button, .s-tag.s-Tag2a .s-button, .s-tag.s-Tag2b .s-button, .s-tag.s-Tag3a .s-button, .s-tag.s-Tag3b .s-button, .s-tag.s-Tag4a .s-button, .s-tag.s-Tag4b .s-button, .s-tag.s-Tag5a .s-button, .s-tag.s-Tag5b .s-button, .s-tag.s-Tag6a .s-button, .s-tag.s-Tag6b .s-button, .s-tag.s-Tag7a .s-button, .s-tag.s-Tag7b .s-button, .s-tag.s-Tag7c .s-button{display:none}
.s-tag.s-Tag1a .s-button.s-remove-Tags1a, .s-tag.s-Tag1b .s-button.s-remove-Tags1b, .s-tag.s-Tag2a .s-button.s-remove-Tags2a, .s-tag.s-Tag2b .s-button.s-remove-Tags2b, .s-tag.s-Tag3a .s-button.s-remove-Tags3a, .s-tag.s-Tag3b .s-button.s-remove-Tags3b, .s-tag.s-Tag4a .s-button.s-remove-Tags4a, .s-tag.s-Tag4b .s-button.s-remove-Tags4b, .s-tag.s-Tag5a .s-button.s-remove-Tags5a, .s-tag.s-Tag5b .s-button.s-remove-Tags5b, .s-tag.s-Tag6a .s-button.s-remove-Tags6a, .s-tag.s-Tag6b .s-button.s-remove-Tags6b, .s-tag.s-Tag7a .s-button.s-remove-Tags7a, .s-tag.s-Tag7b .s-button.s-remove-Tags7b, .s-tag.s-Tag7c .s-button.s-remove-Tags7c,
.s-tag.s-Tag1a .s-button.s-add-Tags1b, .s-tag.s-Tag2a .s-button.s-add-Tags2b,.s-tag.s-Tag3a .s-button.s-add-Tags3b, .s-tag.s-Tag4a .s-button.s-add-Tags4b, .s-tag.s-Tag5a .s-button.s-add-Tags5b, .s-tag.s-Tag6a .s-button.s-add-Tags6b, .s-tag.s-Tag7a .s-button.s-add-Tags7b{display:block}
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
.tab-row-container a { display: flex; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; height: 40px; max-height: 40px; min-height: 24px; padding: 0 0px; line-height: 1; white-space: normal; overflow: hidden; text-overflow: ellipsis; font-size: clamp(11px, 0.8vw, 14px); transition: font-size 0.15s ease; }
</style>
`;

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
        applyCustomColors();
        var test = $j('#torrent_table tbody tr.torrent.rowb').css('background-color');
        $j('#torrent_table').css('background-color',test);

        // add config link
        $j("<li class='brackets' title=\"Change Empornium++Tag Highlighter's settings.\"><a href='#'>Tag-Config</a></li>")
            .insertAfter(userInfoID)
            .on("click", function(e) {
            e.preventDefault();
            initConfig($j(buildSettingsHTML()).prependTo("body"));
        });


        if(/torrents\.php/.test(window.location.href)){
            // torrent details
            if(/\bid\=/.test(window.location.href)){
                processDetailsPage();
            }
            // torrents overview
            else{
                processBrowsePage(".torrent", "torrent");
            }
        }
        // subscribed collages with new additions
        else if(/userhistory\.php(.+)\bsubscribed_collages/.test(window.location.href)){
            processBrowsePage(".torrent", "torrent");
        }
        // collage details/overview
        else if(/collage/.test(window.location.href)){
            processBrowsePage(".rowa, .rowb", "collage");
        }
        // user details
        else if(/user\.php(.+)\bid\=/.test(window.location.href)){
            processBrowsePage(".torrent", "torrent");
        }
        // top 10
        else if(/top10\.php/.test(window.location.href)){
            processBrowsePage(".torrent", "torrent");
        }
        else if (/tags\.php/.test(window.location.href)) {
            processTagsPage(".rowa, .rowb");
        }

        else if(/bookmarks\.php/.test(window.location.href)){
            processBrowsePage(".rowa, .rowb", "request");
        }
        else if(/requests\.php/.test(window.location.href)){
            if(/\bid\=/.test(window.location.href)){
                processDetailsPage();
            }
            else{
                processBrowsePage(".rowa, .rowb", "request");
            }
        }
    }());

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
                else if (settings.useTag1bTags && isTag(settings.tags.Tags1b, tag)) tagLink.addClass("s-Tag1b");
                else if (settings.useTag1aTags && isTag(settings.tags.Tags1a, tag)) tagLink.addClass("s-Tag1a");
                else if (settings.useTag2bTags && isTag(settings.tags.Tags2b, tag)) tagLink.addClass("s-Tag2b");
                else if (settings.useTag2aTags && isTag(settings.tags.Tags2a, tag)) tagLink.addClass("s-Tag2a");
                else if (settings.useTag3bTags && isTag(settings.tags.Tags3b, tag)) tagLink.addClass("s-Tag3b");
                else if (settings.useTag3aTags && isTag(settings.tags.Tags3a, tag)) tagLink.addClass("s-Tag3a");
                else if (settings.useTag4bTags && isTag(settings.tags.Tags4b, tag)) tagLink.addClass("s-Tag4b");
                else if (settings.useTag4aTags && isTag(settings.tags.Tags4a, tag)) tagLink.addClass("s-Tag4a");
                else if (settings.useTag5bTags && isTag(settings.tags.Tags5b, tag)) tagLink.addClass("s-Tag5b");
                else if (settings.useTag5aTags && isTag(settings.tags.Tags5a, tag)) tagLink.addClass("s-Tag5a");
                else if (settings.useTag6bTags && isTag(settings.tags.Tags6b, tag)) tagLink.addClass("s-Tag6b");
                else if (settings.useTag6aTags && isTag(settings.tags.Tags6a, tag)) tagLink.addClass("s-Tag6a");
                else if (settings.useTag7bTags && isTag(settings.tags.Tags7b, tag)) tagLink.addClass("s-Tag7b");
                else if (settings.useTag7aTags && isTag(settings.tags.Tags7a, tag)) tagLink.addClass("s-Tag7a");

                let matched = false;

                for (const [tagType, tagList] of Object.entries(settings.tags)) {
                    if (isTag(tagList, tag)) {
                        const rating = settings.tagValues?.[tagType] || "(none)";
                        matched = true;

                        // Count it normally

                        switch (rating) {
                            case "good":
                                rawGood += 1;
                                break;
                            case "verygood":
                                rawVeryGood += 1;
                                break;
                            case "bad":
                                rawBad += 1;
                                break;
                            case "verybad":
                                rawVeryBad += 1;
                                break;
                            case "ignore":
                                totalTagNum--; // unchanged: ignore removed from denominator
                                ignoredNum++;
                                break;
                        }




                        // 💬 Console output - Wrap in an "enable debug" laterf.
                        //console.log(`[TagClassify] ${tag} → ${tagType} → ${rating}`);
                        break; // found match, stop looping through lists
                    }
                }

                // If it didn't match any tag list => undefined classification
                if (!matched) {
                    console.warn(`[TagClassify] ${tag} → not found in any list`);
                    undefinedNum++;
                }


            });



            // === Percentages (weighted, include undefined) ===
            // Compute weighted values from raw counters
            var weightedGood = (rawGood || 0) + 2 * (rawVeryGood || 0);
            var weightedBad = (rawBad || 0) + 2 * (rawVeryBad || 0);
            var weightedUndef = undefinedNum || 0; // each undefined counts as 1 unit

            // The denominator is weightedGood + weightedBad + weightedUndef
            var weightedTotal = weightedGood + weightedBad + weightedUndef;

            // percentages (as floats)
            var pctGood = weightedTotal ? (weightedGood / weightedTotal) * 100 : 0;
            var pctBad = weightedTotal ? (weightedBad / weightedTotal) * 100 : 0;
            var pctUndef = weightedTotal ? (weightedUndef / weightedTotal) * 100 : 0;

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

            // Render the percent bar: Good(left, green) and Bad(right, red)
            if (settings.usePercentBar) {
                // --- create a wrapper so the bar always sits on its own line in a table cell ---
                const $wrap = $j("<div class='s-percent-wrap' style='display:block;width:100%;clear:both;'></div>");
                $wrap.insertBefore(tagContainer);

                const percentContainer = $j("<div class='s-percent-container'></div>")
                .attr(
                    "title",
                    `Good: ${goodPercent}%  |  Bad: ${badPercent}%  |  Undefined: ${100 - (goodPercent + badPercent)}%`
                )
                .appendTo($wrap);

                // Good (left)
                if (goodPercent > 0) {
                    $j("<div></div>")
                        .appendTo(percentContainer)
                        .addClass("s-percent s-percent-good")
                        .width(goodPercent + "%");
                }

                // Bad (right)
                if (badPercent > 0) {
                    $j("<div></div>")
                        .appendTo(percentContainer)
                        .addClass("s-percent s-percent-bad")
                        .width(badPercent + "%");
                }
            }

            if (settings.useTorrentOpacity && badPercent > goodPercent) {
                row.css("opacity", (100 - ((badPercent - goodPercent) / 2)) / 100);
            }

            if (settings.useTorrentColoring) {
                var netPercent = (goodPercent - badPercent * 1.5) / 100;
                var absPercent = Math.abs(netPercent);
                var green = [120, 200, 120];
                var red = [210, 100, 100];
                var color;
                if (netPercent > 0) color = green;
                else if (netPercent < 0) color = red;

                if (color && !row.hasClass("redbar") &&
                    /torrents\.php/.test(window.location.href) &&
                    !/userid\=/.test(window.location.href)) {
                    row.css({
                        "background-color": "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + absPercent + ")"
                    });
                }
            }

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
    }

    // --- Page Processor: Details Page ---
    // Controls the main torrent detail page layout and tag interactions.
    // Adds highlight logic, tag sorting, and the hidden-tag toggle section.
    function processDetailsPage(){

        window.isTagsLoaded = false;

        var handleTagListLoad = function(){
            window.isTagsLoaded = false;
            var checkTagList = function(){
                if($j("#torrent_tags li a").hasClass("tags-loaded")){
                    setTimeout(checkTagList, 30);
                }
                else{
                    highlightDetailTags();
                }
            };
            checkTagList();
        };

        $j(".tag_header span a, #form_addtag input[type='button']").on("click", handleTagListLoad);
        $j("#tagname").on("keydown", function(e){
            if(e.keyCode === 13){
                handleTagListLoad();
            }
        });

        var highlightDetailTags = function(){
            console.log("🟢 highlightDetailsTags Started...");
            if(window.isTagsLoaded) {
                console.log("🟢 isTagsLoaded = True");
                return;
            }
            //Timeout to ensure we run after everything else
            var tagLinks = $j("#torrent_tags").find("a[href*='\\?taglist=']");

            window.isTagsLoaded = tagLinks.length > 0;

            if(!window.isTagsLoaded){
                setTimeout(highlightDetailTags, 200);
                return;
            }

            $j("<ul class='s-Tag7d-tags nobullet'></ul>").appendTo("#torrent_tags").on("spyder.change", function(){
                var hiddenTagHolder = $j(this),
                    hiddenTags = hiddenTagHolder.find("span.s-tag");

                if(hiddenTags.length){
                    $j(".s-Tag7d-msg").text("There's " + hiddenTags.length + " " + settings.names.Tags7d + " tag" + (hiddenTags.length > 1 ? "s" : "") + " on this torrent ");
                    $j(".s-Tag7d-msg, .s-Tag7d-toggle").show();

                    // 🚨 Respect user toggle for hiding 7d tags
                    if (settings.hideTags7dTags) {
                        hiddenTagHolder.hide(); // user wants them hidden
                    } else {
                        hiddenTagHolder.show(); // user wants them visible
                    }
                }
                else{
                    $j(".s-Tag7d-msg, .s-Tag7d-toggle").hide();
                }
            }).before("<div class='s-Tag7d-desc'><span class='s-Tag7d-msg'></span> <a class='s-Tag7d-toggle'>SHOW</a></div>");




            $j(".s-Tag7d-toggle").on("click", function(){
                $j(".s-Tag7d-tags").slideToggle("fast", function(){
                    if($j(this).is(":visible")){
                        $j(".s-Tag7d-toggle").text("HIDE");
                    }
                    else{
                        $j(".s-Tag7d-toggle").text("SHOW");
                    }
                });
            });

            tagLinks.each(function(i, tagLink){
                tagLink = $j(tagLink).addClass("tags-loaded");
                var tag = tagLink.text(),
                    tagHolder = tagLink.wrap("<span>").parent().addClass("s-tag");

                tag = tag.toLowerCase();

                if(settings.useTag1bTags && isTag(settings.tags.Tags1b, tag)){
                    tagHolder.addClass("s-Tag1b");
                }
                else if(settings.useTag1aTags && isTag(settings.tags.Tags1a, tag)){
                    tagHolder.addClass("s-Tag1a");
                }
                else if(settings.useTag2bTags && isTag(settings.tags.Tags2b, tag)){
                    tagHolder.addClass("s-Tag2b");
                }
                else if(settings.useTag2aTags && isTag(settings.tags.Tags2a, tag)){
                    tagHolder.addClass("s-Tag2a");
                }
                else if(settings.useTag3bTags && isTag(settings.tags.Tags3b, tag)){
                    tagHolder.addClass("s-Tag3b");
                }
                else if(settings.useTag3aTags && isTag(settings.tags.Tags3a, tag)){
                    tagHolder.addClass("s-Tag3a");
                }
                else if(settings.useTag4bTags && isTag(settings.tags.Tags4b, tag)){
                    tagHolder.addClass("s-Tag4b");
                }
                else if(settings.useTag4aTags && isTag(settings.tags.Tags4a, tag)){
                    tagHolder.addClass("s-Tag4a");
                }
                else if(settings.useTag5bTags && isTag(settings.tags.Tags5b, tag)){
                    tagHolder.addClass("s-Tag5b");
                }
                else if(settings.useTag5aTags && isTag(settings.tags.Tags5a, tag)){
                    tagHolder.addClass("s-Tag5a");
                }
                else if(settings.useTag6bTags && isTag(settings.tags.Tags6b, tag)){
                    tagHolder.addClass("s-Tag6b");
                }
                else if(settings.useTag6aTags && isTag(settings.tags.Tags6a, tag)){
                    tagHolder.addClass("s-Tag6a");
                }
                else if(settings.useTag7bTags && isTag(settings.tags.Tags7b, tag)){
                    tagHolder.addClass("s-Tag7b");
                }


                else if(settings.useTag7dTags && isTag(settings.tags.Tags7d, tag)){
                    var Tags7dTag = tagHolder.addClass("s-Tag7d");

                    if (settings.hideTags7dTags) {
                        // Move Tags7d into their own section when hiding is enabled
                        Tags7dTag.parent().detach().appendTo(".s-Tag7d-tags").trigger("spyder.change");
                    } else {
                        // Ensure 7d tags stay visible in the normal list
                        Tags7dTag.find("a").css("display", "inline");
                        Tags7dTag.css("display", "inline");
                    }
                }

                else if(settings.useTag7cTags && isTag(settings.tags.Tags7c, tag)){
                    tagHolder.addClass("s-Tag7c");
                }
                else if(settings.useTag7aTags && isTag(settings.tags.Tags7a, tag)){
                    tagHolder.addClass("s-Tag7a");
                }

                var buttons = $j();

                if(settings.useTag1aTags){
                    if(!settings.buttonTag1aTags){
                        buttons = buttons.add($j("<div class='s-button s-add-Tags1a' title='Mark tag as " + settings.names.Tags1a + "'>+</div>").
                                              data("action", {fn : addTagElement, type : "Tags1a", tag : tag}));
                    }
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags1a' title='Un-Mark tag as " + settings.names.Tags1a + "'>–</div>").
                                          data("action", {fn : removeTagElement, type : "Tags1a", tag : tag}));
                }
                if(settings.useTag1bTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags1b' title='Upgrade tag to " + settings.names.Tags1b + "'>+</div>").
                                          data("action", {fn : addTags1bTagElement, type : "Tags1b", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags1b' title='Downgrade tag from " + settings.names.Tags1b + "'>–</div>").
                                          data("action", {fn : removeTags1bTagElement, type : "Tags1b", tag : tag}));
                }
                if(settings.useTag2aTags){
                    if(!settings.buttonTag2aTags){
                        buttons = buttons.add($j("<div class='s-button s-add-Tags2a' title='Mark tag as " + settings.names.Tags2a + "'>+</div>").
                                              data("action", {fn : addTagElement, type : "Tags2a", tag : tag}));
                    }
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags2a' title='Un-Mark tag as " + settings.names.Tags2a + "'>–</div>").
                                          data("action", {fn : removeTagElement, type : "Tags2a", tag : tag}));
                }
                if(settings.useTag2bTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags2b' title='Upgrade tag to " + settings.names.Tags2b + "'>+</div>").
                                          data("action", {fn : addTags2bTagElement, type : "Tags2b", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags2b' title='Downgrade tag from " + settings.names.Tags2b + "'>–</div>").
                                          data("action", {fn : removeTags2bTagElement, type : "Tags2b", tag : tag}));
                }
                if(settings.useTag3aTags){
                    if(!settings.buttonTag3aTags){
                        buttons = buttons.add($j("<div class='s-button s-add-Tags3a' title='Mark tag as " + settings.names.Tags3a + "'>+</div>").
                                              data("action", {fn : addTagElement, type : "Tags3a", tag : tag}));
                    }
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags3a' title='Un-Mark tag as " + settings.names.Tags3a + "'>–</div>").
                                          data("action", {fn : removeTagElement, type : "Tags3a", tag : tag}));
                }
                if(settings.useTag3bTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags3b' title='Upgrade tag to " + settings.names.Tags3b + "'>+</div>").
                                          data("action", {fn : addTags3bTagElement, type : "Tags3b", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags3b' title='Downgrade tag from " + settings.names.Tags3b + "'>–</div>").
                                          data("action", {fn : removeTags3bTagElement, type : "Tags3b", tag : tag}));
                }
                if(settings.useTag4aTags){
                    if(!settings.buttonTag4aTags){
                        buttons = buttons.add($j("<div class='s-button s-add-Tags4a' title='Mark tag as " + settings.names.Tags4a + "'>+</div>").
                                              data("action", {fn : addTagElement, type : "Tags4a", tag : tag}));
                    }
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags4a' title='Un-Mark tag as " + settings.names.Tags4a + "'>–</div>").
                                          data("action", {fn : removeTagElement, type : "Tags4a", tag : tag}));
                }
                if(settings.useTag4bTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags4b' title='Upgrade tag to " + settings.names.Tags4b + "'>+</div>").
                                          data("action", {fn : addTags4bTagElement, type : "Tags4b", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags4b' title='Downgrade tag from " + settings.names.Tags4b + "'>–</div>").
                                          data("action", {fn : removeTags4bTagElement, type : "Tags4b", tag : tag}));
                }
                if(settings.useTag5aTags){
                    if(!settings.buttonTag5aTags){
                        buttons = buttons.add($j("<div class='s-button s-add-Tags5a' title='Mark tag as " + settings.names.Tags5a + "'>+</div>").
                                              data("action", {fn : addTagElement, type : "Tags5a", tag : tag}));
                    }
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags5a' title='Un-Mark tag as " + settings.names.Tags5a + "'>–</div>").
                                          data("action", {fn : removeTagElement, type : "Tags5a", tag : tag}));
                }
                if(settings.useTag5bTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags5b' title='Upgrade tag to " + settings.names.Tags5b + "'>+</div>").
                                          data("action", {fn : addTags5bTagElement, type : "Tags5b", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags5b' title='Downgrade tag from " + settings.names.Tags5b + "'>–</div>").
                                          data("action", {fn : removeTags5bTagElement, type : "Tags5b", tag : tag}));
                }
                if(settings.useTag6aTags){
                    if(!settings.buttonTag6aTags){
                        buttons = buttons.add($j("<div class='s-button s-add-Tags6a' title='Mark tag as " + settings.names.Tags6a + "'>+</div>").
                                              data("action", {fn : addTagElement, type : "Tags6a", tag : tag}));
                    }
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags6a' title='Un-Mark tag as " + settings.names.Tags6a + "'>–</div>").
                                          data("action", {fn : removeTagElement, type : "Tags6a", tag : tag}));
                }
                if(settings.useTag6bTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags6b' title='Upgrade tag to " + settings.names.Tags6b + "'>+</div>").
                                          data("action", {fn : addTags6bTagElement, type : "Tags6b", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags6b' title='Downgrade tag from " + settings.names.Tags6b + "'>–</div>").
                                          data("action", {fn : removeTags6bTagElement, type : "Tags6b", tag : tag}));
                }
                if(settings.useTag7aTags){
                    if(!settings.buttonTag7aTags){
                        buttons = buttons.add($j("<div class='s-button s-add-Tags7a' title='Mark tag as " + settings.names.Tags7a + "'>×</div>").
                                              data("action", {fn : addTagElement, type : "Tags7a", tag : tag}));
                    }
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags7a' title='Un-Mark tag as " + settings.names.Tags7a + "'>–</div>").
                                          data("action", {fn : removeTagElement, type : "Tags7a", tag : tag}));
                }
                if(settings.useTag7bTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags7b' title='Mark tag as " + settings.names.Tags7b + "'>×</div>").
                                          data("action", {fn : addTags7bTagElement, type : "Tags7b", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags7b' title='Un-Mark tag as " + settings.names.Tags7b + "'>–</div>").
                                          data("action", {fn : removeTags7bTagElement, type : "Tags7b", tag : tag}));
                }
                if(settings.useTag7cTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags7c' title='Mark tag as " + settings.names.Tags7c + ". \nTorrents with this tag will be hidden!'>!</div>").
                                          data("action", {fn : addTags7cTagElement, type : "Tags7c", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags7c' title='Un-Mark tag as " + settings.names.Tags7c + "'>–</div>").
                                          data("action", {fn : removeTags7cTagElement, type : "Tags7c", tag : tag}));
                }
                if(settings.useTag7dTags){
                    buttons = buttons.add($j("<div class='s-button s-add-Tags7d' title='Mark tag as " + settings.names.Tags7d + ". \nThis tag will be hidden from all torrents!'>-</div>").
                                          data("action", {fn : addTags7dTagElement, type : "Tags7d", tag : tag}));
                    buttons = buttons.add($j("<div class='s-button s-remove-Tags7d' title='Un-Mark tag as " + settings.names.Tags7d + "'>–</div>").
                                          data("action", {fn : removeTags7dTagElement, type : "Tags7d", tag : tag}));
                }
                $j(buttons).addClass("s-button").prependTo(tagHolder);


                // create more horizontal space by hiding "tag action" placeholder spans
                tagHolder.next().find("span:contains('\xa0\xa0\xa0')").hide();
                // staff/mods have additional "tag actions", allow for additional styling
                if (tagHolder.next().find("a").length > 2){
                    tagHolder.addClass("s-staff");
                }
            });

            $j(".s-button").on("click", function(e){
                var data = $j(this).data("action");
                data.fn(data.type, $j(this).parent(), data.tag);
            });
        };

        window.highlightDetailTags = highlightDetailTags;

        highlightDetailTags();

        // ensure columns get recalculated after highlighting/moving 7d tags
        setTimeout(() => {
            try {
                if (typeof splitTagsIntoColumns === 'function') splitTagsIntoColumns();
                if (typeof enforceTagRowLayout === 'function') enforceTagRowLayout();
                if (typeof resizeAllTagText === 'function') resizeAllTagText();
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
            tagHolder.removeClass(ALL_TAG_KEYS.map(k => "s-" + k).join(" "));

            // === Apply highlighting (reusing detail page logic) ===
            if (settings.useTag1bTags && isTag(settings.tags.Tags1b, tag)) tagHolder.addClass("s-Tag1b");
            else if (settings.useTag1aTags && isTag(settings.tags.Tags1a, tag)) tagHolder.addClass("s-Tag1a");
            else if (settings.useTag2bTags && isTag(settings.tags.Tags2b, tag)) tagHolder.addClass("s-Tag2b");
            else if (settings.useTag2aTags && isTag(settings.tags.Tags2a, tag)) tagHolder.addClass("s-Tag2a");
            else if (settings.useTag3bTags && isTag(settings.tags.Tags3b, tag)) tagHolder.addClass("s-Tag3b");
            else if (settings.useTag3aTags && isTag(settings.tags.Tags3a, tag)) tagHolder.addClass("s-Tag3a");
            else if (settings.useTag4bTags && isTag(settings.tags.Tags4b, tag)) tagHolder.addClass("s-Tag4b");
            else if (settings.useTag4aTags && isTag(settings.tags.Tags4a, tag)) tagHolder.addClass("s-Tag4a");
            else if (settings.useTag5bTags && isTag(settings.tags.Tags5b, tag)) tagHolder.addClass("s-Tag5b");
            else if (settings.useTag5aTags && isTag(settings.tags.Tags5a, tag)) tagHolder.addClass("s-Tag5a");
            else if (settings.useTag6bTags && isTag(settings.tags.Tags6b, tag)) tagHolder.addClass("s-Tag6b");
            else if (settings.useTag6aTags && isTag(settings.tags.Tags6a, tag)) tagHolder.addClass("s-Tag6a");
            else if (settings.useTag7bTags && isTag(settings.tags.Tags7b, tag)) tagHolder.addClass("s-Tag7b");
            else if (settings.useTag7aTags && isTag(settings.tags.Tags7a, tag)) tagHolder.addClass("s-Tag7a");
            else if (settings.useTag7cTags && isTag(settings.tags.Tags7c, tag)) tagHolder.addClass("s-Tag7c");
            else if (settings.useTag7dTags && isTag(settings.tags.Tags7d, tag)) {
                tagHolder.addClass("s-Tag7d");
                // Always show 7d tags on this page
                tagHolder.show();
            }

            // Add Tag Action Buttons (uses improved addTagButtons which should not duplicate)
            addTagButtons(tagHolder, tag);
        });



        /*
        // Add toggle button to show/hide tag action buttons (if desired)
        // Defer toggle insertion so addButtonToggle() and its dependencies are defined
        // Wait for addButtonToggle() to be defined, then call it.
        // Retries for up to ~3 seconds (60 * 50ms).
        (function waitForAddButtonToggle(attemptsLeft = 60, interval = 50) {
            if (typeof addButtonToggle === "function") {
                try {
                    addButtonToggle();
                    console.log("addButtonToggle() attached.");
                } catch (err) {
                    console.warn("addButtonToggle() call failed:", err);
                }
                return;
            }
            if (attemptsLeft <= 0) {
                console.warn("addButtonToggle() not found after waiting; toggle not added.");
                return;
            }
            setTimeout(function () {
                waitForAddButtonToggle(attemptsLeft - 1, interval);
            }, interval);
        })();
*/

    }

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
        toggleBtn.style.cssText = `
        padding: 4px 10px;
        border-radius: 6px;
        background: var(--btn-bg, #444);
        color: white;
        border: 1px solid #777;
        cursor: pointer;
        font-size: 12px;
    `;
        // Append button
        targetCell.appendChild(toggleBtn);

        // Restore previous state if it exists
        let editing = localStorage.getItem('empTagsEditing') === 'true';
        if (editing) enableEditingMode(true);

        // Button click handler
        toggleBtn.addEventListener('click', () => {
            editing = !editing;
            localStorage.setItem('empTagsEditing', editing ? 'true' : 'false');
            enableEditingMode(editing);
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

                // Hide or show first column (TagID)
                const firstCols = tbl.querySelectorAll('tr > td:first-child, tr > th:first-child');
                firstCols.forEach(td => {
                    td.style.display = enable ? 'none' : '';
                });

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
        processTagsPage(".rowa, .rowb");
    }

    function addTagButtons(tagHolder, tag) {
        // Defensive: ensure settings.tags exists
        if (!settings || !settings.tags) settings.tags = {};

        // Remove any existing buttons inside this holder (extra safety)
        tagHolder.find(".s-button").off().remove();

        // Normalize tag for comparisons
        const normalized = t => (typeof t === "string" ? t.toLowerCase().trim() : t);
        const tagNorm = normalized(tag);

        // First: REMOVE buttons for categories that already include the tag
        for (const tagKey of ALL_TAG_KEYS) {
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
                    removeTags(tagKey, [tag]);
                    // Refresh visually on tags.php OR call highlight on details
                    if (window.location.href.indexOf("tags.php") !== -1) {
                        refreshTagsPageHighlights();
                    } else if (typeof highlightDetailTags === "function") {
                        highlightDetailTags();
                    }

                });

                tagHolder.append(removeBtn);
            }
        }

        // Second: ADD buttons for categories the tag does not already belong to
        for (const tagKey of ALL_TAG_KEYS) {
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
                    refreshTagsPageHighlights();
                } else if (typeof highlightDetailTags === "function") {
                    highlightDetailTags();
                }

            });

            tagHolder.append(addBtn);
        }
    }



    // --- Configuration Panel Initialization ---
    // Handles creation and population of the settings UI.
    // Loads saved settings, attaches listeners, and enables Import/Export/Save.
    function initConfig(base){
        // Populate Export textarea immediately when the config panel opens
        try {
            const ta = document.querySelector('#export-settings-textarea');
            if (ta) ta.textContent = JSON.stringify(getSettings(), null, 2);
        } catch (err) {
            console.warn("populate export box failed:", err);
        }

        //Init Display
        for(var name in settings){
            if(settings.hasOwnProperty(name)){
                if(name == "tags"){
                    for(var tagType in settings[name]){
                        if(settings[name].hasOwnProperty(tagType)){
                            displayTags(tagType);
                        }
                    }
                }
                else{
                    $j("input[name='"+name+"']").prop("checked", settings[name]);
                }
            }
        }

        //Init Listeners
        $j(".s-conf-tab").parent().on("click", function(){
            var tab = $j(this);
            if(!tab.hasClass("s-selected")){
                $j('.tab-row-container li').removeClass('s-selected');
                $j('.s-conf-page').removeClass("s-selected");
                tab.addClass("s-selected");
                $j(".s-conf-page#" + tab.data("page")).addClass("s-selected");
            }
        });

        // Populate Dupe Cleanup panel when its tab is selected
        $j(".tab-row-container").on("click", "li[data-page='s-conf-dupe-cleanup']", function() {
            const $list = $j("#dupeCleanupList");
            $list.html("<div>Scanning for duplicates...</div>");

            try {
                const rawConflicts = cleanChildTagsFromParent() || [];

                // Aggregate conflicts by tag -> set of list keys
                const agg = {}; // { normalizedTag: { displayTag: originalTag, lists: Set(...) } }
                rawConflicts.forEach(function(c) {
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


                keys.forEach(function(normTag) {
                    const entry = agg[normTag];
                    const safeTag = entry.displayTag.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    const rowId = "dupe-row-" + encodeURIComponent(normTag);

                    const listKeys = Array.from(entry.lists);
                    const badgesHtml = listKeys.map(function(key) {
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
                keys.forEach(function(normTag) {
                    const rowId = "dupe-row-" + encodeURIComponent(normTag);
                    const container = document.getElementById(rowId);
                    if (!container) return;
                    const spans = Array.from(container.querySelectorAll("span.s-tag"));
                    spans.forEach(function(span) {
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






        $j(".s-conf-gen-checkbox").on("change", function(){
            var checkbox = $j(this);
            var name = checkbox.attr("name");
            var isChecked = checkbox.is(":checked");

            settings[name] = isChecked;

            if((name == "useTag7cTags" && isChecked) || (name == "useTag7bTags" && isChecked) || (name == "useTag7dTags" && isChecked)){
                $j("input[name='useTag7aTags']").prop("checked", true).trigger("change");
            }
            else if(name == "useTag7aTags" && !isChecked){
                $j("input[name='useTag7cTags']").prop("checked", false).trigger("change");
                $j("input[name='useTag7bTags']").prop("checked", false).trigger("change");
                $j("input[name='useTag7dTags']").prop("checked", false).trigger("change");
            }
            else if((name == "useTag6bTags" && isChecked) ){
                $j("input[name='useTag6aTags']").prop("checked", true).trigger("change");
            }
            else if(name == "useTag6aTags" && !isChecked){
                $j("input[name='useTag6bTags']").prop("checked", false).trigger("change");
            }
            else if((name == "useTag5bTags" && isChecked) ){
                $j("input[name='useTag5aTags']").prop("checked", true).trigger("change");
            }
            else if(name == "useTag5aTags" && !isChecked){
                $j("input[name='useTag5bTags']").prop("checked", false).trigger("change");
            }
            else if((name == "useTag4bTags" && isChecked) ){
                $j("input[name='useTag4aTags']").prop("checked", true).trigger("change");
            }
            else if(name == "useTag4aTags" && !isChecked){
                $j("input[name='useTag4bTags']").prop("checked", false).trigger("change");
            }
            else if((name == "useTag2bTags" && isChecked) ){
                $j("input[name='useTag2aTags']").prop("checked", true).trigger("change");
            }
            else if(name == "useTag2aTags" && !isChecked){
                $j("input[name='useTag2bTags']").prop("checked", false).trigger("change");
            }
            else if((name == "useTag1bTags" && isChecked) ){
                $j("input[name='useTag1aTags']").prop("checked", true).trigger("change");
            }
            else if(name == "useTag1aTags" && !isChecked){
                $j("input[name='useTag1bTags']").prop("checked", false).trigger("change");
            }

            // === NEW: Dynamic 7d visibility update ===
            if (name === "hideTags7dTags") {
                // Remove the old dynamic rule if it exists
                $j("#dynamic-7d-visibility").remove();

                // Create a new <style> element for conditional visibility
                const style = document.createElement("style");
                style.id = "dynamic-7d-visibility";

                // Only hide Tags7d tags on pages that are NOT tags.php (body.emp-tags-page)
                if (settings.hideTags7dTags) {
                    style.textContent =
                        "body:not(.emp-tags-page) span.s-tag.s-Tag7d { display:none !important; }" +
                        "body.emp-tags-page span.s-tag.s-Tag7d { display:inline !important; }";
                } else {
                    // Ensure visibility everywhere if hiding is turned off
                    style.textContent =
                        "span.s-tag.s-Tag7d { display:inline !important; }";
                }

                document.head.appendChild(style);
            }


        });


        $j(document).on("click", "#s-conf-save", function(e){
            e.preventDefault();
            console.log("🟢 Save button clicked");
            // Ensure colors object exists
            if (!settings.colors) settings.colors = {};

            // Tags1a
            settings.colors.Tags1a.background = $j("#color-Tags1a-bg").val();
            settings.colors.Tags1a.text = $j("#color-Tags1a-text").val();
            settings.colors.Tags1a.border = "#000000";

            // Tags1b
            settings.colors.Tags1b.background = $j("#color-Tags1b-bg").val();
            settings.colors.Tags1b.text = $j("#color-Tags1b-text").val();
            settings.colors.Tags1b.border = "#000000";

            // Tags2a
            settings.colors.Tags2a.background = $j("#color-Tags2a-bg").val();
            settings.colors.Tags2a.text = $j("#color-Tags2a-text").val();
            settings.colors.Tags2a.border = "#000000";

            // Tags2b
            settings.colors.Tags2b.background = $j("#color-Tags2b-bg").val();
            settings.colors.Tags2b.text = $j("#color-Tags2b-text").val();
            settings.colors.Tags2b.border = "#000000";

            // Tags3a
            settings.colors.Tags3a.background = $j("#color-Tags3a-bg").val();
            settings.colors.Tags3a.text = $j("#color-Tags3a-text").val();
            settings.colors.Tags3a.border = "#000000";

            // Tags3b
            settings.colors.Tags3b.background = $j("#color-Tags3b-bg").val();
            settings.colors.Tags3b.text = $j("#color-Tags3b-text").val();
            settings.colors.Tags3b.border = "#000000"

            // Tags4a
            settings.colors.Tags4a.background = $j("#color-Tags4a-bg").val();
            settings.colors.Tags4a.text = $j("#color-Tags4a-text").val();
            settings.colors.Tags4a.border = "#000000";

            // Tags4b
            settings.colors.Tags4b.background = $j("#color-Tags4b-bg").val();
            settings.colors.Tags4b.text = $j("#color-Tags4b-text").val();
            settings.colors.Tags4b.border = "#000000";

            // Tags5a
            settings.colors.Tags5a.background = $j("#color-Tags5a-bg").val();
            settings.colors.Tags5a.text = $j("#color-Tags5a-text").val();
            settings.colors.Tags5a.border = "#000000";

            // Tags5b
            settings.colors.Tags5b.background = $j("#color-Tags5b-bg").val();
            settings.colors.Tags5b.text = $j("#color-Tags5b-text").val();
            settings.colors.Tags5b.border = "#000000";

            // Tags6a
            settings.colors.Tags6a.background = $j("#color-Tags6a-bg").val();
            settings.colors.Tags6a.text = $j("#color-Tags6a-text").val();
            settings.colors.Tags6a.border = "#000000";

            // Tags6b
            settings.colors.Tags6b.background = $j("#color-Tags6b-bg").val();
            settings.colors.Tags6b.text = $j("#color-Tags6b-text").val();
            settings.colors.Tags6b.border = "#000000";

            // Tags7a
            settings.colors.Tags7a.background = $j("#color-Tags7a-bg").val();
            settings.colors.Tags7a.text = $j("#color-Tags7a-text").val();
            settings.colors.Tags7a.border = "#000000";

            // Tags7b
            settings.colors.Tags7b.background = $j("#color-Tags7b-bg").val();
            settings.colors.Tags7b.text = $j("#color-Tags7b-text").val();
            settings.colors.Tags7b.border = "#000000";

            // Tags7c
            settings.colors.Tags7c.background = $j("#color-Tags7c-bg").val();
            settings.colors.Tags7c.text = $j("#color-Tags7c-text").val();
            settings.colors.Tags7c.border = "#000000";

            // Tags7d
            settings.colors.Tags7d.background = $j("#color-Tags7d-bg").val();
            settings.colors.Tags7d.text = $j("#color-Tags7d-text").val();
            settings.colors.Tags7d.border = "#000000";

            // --- FIXED: Capture updated display names from color table ---
            if (!settings.names) settings.names = {};

            $j(".s-conf-color-table tr").each(function () {
                const $tr = $j(this);
                const $labelSpan = $tr.find("td:first .name-display");
                if (!$labelSpan.length) return;

                const label = $labelSpan.text().trim();
                // Identify the color row type via the color input ID pattern
                const id = $tr.find("input[id^='color-'][id$='-bg']").attr("id") || "";
                const match = id.match(/^color-(.+?)-bg$/);
                if (!match) return;

                const type = match[1];
                // Map UI types to settings.names keys
                const nameMap = {
                    Tags1a: "Tags1a", Tags1b: "Tags1b",
                    Tags2a: "Tags2a", Tags2b: "Tags2b",
                    Tags3a: "Tags3a", Tags3b: "Tags3b",
                    Tags4a: "Tags4a", Tags4b: "Tags4b",
                    Tags5a: "Tags5a", Tags5b: "Tags5b",
                    Tags6a: "Tags6a", Tags6b: "Tags6b",
                    Tags7a: "Tags7a", Tags7b: "Tags7b",
                    Tags7c: "Tags7c", Tags7d: "Tags7d"
                };

                const mappedKey = nameMap[type];
                if (mappedKey && label.length) {
                    settings.names[mappedKey] = label;
                }
            });

            // --- Save tag value selections for Percent Bar---
            settings.tagValues = {};
            $j(".tag-value-select").each(function () {
                const tagKey = $j(this).data("tag");
                const tagVal = $j(this).val();
                settings.tagValues[tagKey] = tagVal;
            });



            // Save and apply
            saveSettings();
            applyCustomColors();
            refreshUI();

            // Update Export textarea immediately so it reflects the new settings
            const ta = document.querySelector('#export-settings-textarea');
            if (ta) ta.textContent = JSON.stringify(getSettings());

            displayStatus("success", "Settings updated successfully");
        });
        // --- Import button wiring: read textarea, import, refresh UI & export box ---
        $j('#import-settings-button').on('click', function(e) {
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
                importSettings(raw);

                // Refresh in-memory UI and repopulate export textarea
                try {
                    if (typeof refreshUI === 'function') refreshUI();
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



        $j("#s-conf-close").on("click", function(){
            base.remove();
        });

        $j("#s-conf-status").on("click", "#s-conf-status-close", function(){
            $j(this).parent().fadeOut("fast");
        });

        // --- Updated handler to support both old and new tag naming ---
        $j(".s-conf-add-btn, .s-conf-remove-btn").on("click", function () {
            const button = $j(this);
            const method = button.hasClass("s-conf-remove-btn") ? removeTags : addTags;

            let type = button.data("type"); // e.g. "Tags2a" or "Tags2a"
            const input = button.prev();

            // Normalize tag type (map old names to new canonical ones)
            const legacyMap = {
                "good":    "Tags1a",
                "loved":   "Tags1b",
                "performer":"Tags2a",
                "loveperf":"Tags2b",
                "newperf": "Tags3a",
                "amateur": "Tags4a",
                "loveamat":"Tags4b",
                "maleperf":"Tags5a",
                "lovemale":"Tags5b",
                "likesite":"Tags6a",
                "lovesite":"Tags6b",
                "disliked":"Tags7a",
                "hated":   "Tags7b",
                "terrible":"Tags7c",
                "useless": "Tags7d"
            };
            if (legacyMap[type]) type = legacyMap[type];

            // Get and clean up tag list from input field
            const tags = $j.grep(input.val().toLowerCase().split(/\s+/), tag => tag);

            if (tags.length) {
                try {
                    // Execute addTags() or removeTags()
                    method(type, tags);

                    // Clear input box
                    input.val("");

                    // Refresh textarea or tag display
                    displayTags(type);

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


        function displayTags(type){
            $j("#s-conf-text-" + type).val(settings.tags[type].join(" "));
        }

        function displayStatus(type, msg){
            $j("#s-conf-status").fadeOut("fast", function(){
                $j(this).removeClass().addClass("s-" + type).html(msg + " <a id='s-conf-status-close'>(×)</a>").fadeIn("fast");
            });
        }

        function refreshUI() {
            $j('#s-conf-background').remove();
            initConfig($j(buildSettingsHTML()).prependTo("body"));
            console.log("🟣 Running refreshUI()"); //debug - Should wrap in toggle
        }



        // === Real-time color preview updates (fixed) ===
        $j(document).off("input", "input[type='color']").on("input", "input[type='color']", function () {
            const inputId = $j(this).attr("id");
            const match = inputId.match(/^color-(Tags\d+[a-d])-(bg|text)$/);
            if (!match) return;

            const [_, tagType, colorType] = match;

            // Read current picker values
            const bg = $j(`#color-${tagType}-bg`).val();
            const text = $j(`#color-${tagType}-text`).val();

            // Keep settings in sync immediately
            if (!settings.colors) settings.colors = {};
            if (!settings.colors[tagType]) settings.colors[tagType] = { background: bg, text: text, border: "#000000" };
            settings.colors[tagType].background = bg;
            settings.colors[tagType].text = text;
            // border remains whatever is set (save handler sets border to #000)

            // Update the visual sample span (instant)
            const $sample = $j(`#sample-${tagType}`);
            if ($sample.length) {
                $sample.css({
                    backgroundColor: bg,
                    color: text,
                    borderColor: settings.colors[tagType].border || "#000000"
                });
            }

            // Update any buttons that use these classes across the whole page
            $j(".s-add-" + tagType + ", .s-remove-" + tagType).css({
                backgroundColor: bg,
                borderColor: settings.colors[tagType].border || "#000000",
                color: text
            });

            // Rebuild the stylesheet so rules with !important reflect the new colors everywhere
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
            for (const [type, c] of Object.entries(settings.colors)) {
                $j("#sample-" + type)
                    .css({
                    "background-color": $j("#color-" + type + "-bg").val(),
                    "color": $j("#color-" + type + "-text").val(),
                    "border-color": "#000000"
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
                saveSettings();
                displayStatus("success", key + " label updated to '" + newValue + "'");
            };

            $input.on("blur", saveValue);
            $input.on("keydown", ev => {
                if (ev.key === "Enter") { ev.preventDefault(); saveValue(); }
                else if (ev.key === "Escape") $cell.text(oldValue);
            });
        });

        // === Info modal popups ===
        $j(document).on("click", ".info-btn", function(e) {
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
            $j(".info-modal-close, .info-modal-overlay").on("click", function(ev) {
                if (ev.target !== this && !$j(ev.target).hasClass("info-modal-close")) return;
                $j(".info-modal-overlay").remove();
            });
        });


        // ensures color previews load correctly
        updateSamples();
    }




    // ============================================================
    // General Purpose Functions
    // ============================================================

    // Tag1b
    function addTags1bTagElement(type, holder, tag) {
        holder.removeClass("s-Tag1a");
        addTagElement("Tags1b", holder, tag);
    }
    function removeTags1bTagElement(type, holder, tag) {
        removeTagElement("Tags1b", holder, tag);
        addTagElement("Tags1a", holder, tag); // move back to parent
        holder.addClass("s-Tag1a");
    }

    // Tag2b
    function addTags2bTagElement(type, holder, tag) {
        holder.removeClass("s-Tag2a");
        addTagElement("Tags2b", holder, tag);
    }
    function removeTags2bTagElement(type, holder, tag) {
        removeTagElement("Tags2b", holder, tag);
        addTagElement("Tags2a", holder, tag); // move back to parent
        holder.addClass("s-Tag2a");
    }

    // Tag3b
    function addTags3bTagElement(type, holder, tag) {
        holder.removeClass("s-Tag3a");
        addTagElement("Tags3b", holder, tag);
    }
    function removeTags3bTagElement(type, holder, tag) {
        removeTagElement("Tags3b", holder, tag);
        addTagElement("Tags3a", holder, tag); // move back to parent
        holder.addClass("s-Tag3a");
    }

    // Tag4b
    function addTags4bTagElement(type, holder, tag) {
        holder.removeClass("s-Tag4a");
        addTagElement("Tags4b", holder, tag);
    }
    function removeTags4bTagElement(type, holder, tag) {
        removeTagElement("Tags4b", holder, tag);
        addTagElement("Tags4a", holder, tag); // move back to parent
        holder.addClass("s-Tag4a");
    }

    // Tag5b
    function addTags5bTagElement(type, holder, tag) {
        holder.removeClass("s-Tag5a");
        addTagElement("Tags5b", holder, tag);
    }
    function removeTags5bTagElement(type, holder, tag) {
        removeTagElement("Tags5b", holder, tag);
        addTagElement("Tags5a", holder, tag); // move back to parent
        holder.addClass("s-Tag5a");
    }

    // Tag6b
    function addTags6bTagElement(type, holder, tag) {
        holder.removeClass("s-Tag6a");
        addTagElement("Tags6b", holder, tag);
    }
    function removeTags6bTagElement(type, holder, tag) {
        removeTagElement("Tags6b", holder, tag);
        addTagElement("Tags6a", holder, tag); // move back to parent
        holder.addClass("s-Tag6a");
    }

    // Tag7c
    function addTags7cTagElement(type, holder, tag) {
        holder.removeClass("s-Tag7a");
        addTagElement("Tags7c", holder, tag);
    }
    function removeTags7cTagElement(type, holder, tag) {
        removeTagElement("Tags7c", holder, tag);
        addTagElement("Tags7a", holder, tag); // move back to parent
        holder.addClass("s-Tag7a");
    }

    // Tag7b
    function addTags7bTagElement(type, holder, tag) {
        holder.removeClass("s-Tag7a");
        addTagElement("Tags7b", holder, tag);
    }
    function removeTags7bTagElement(type, holder, tag) {
        removeTagElement("Tags7b", holder, tag);
        addTagElement("Tags7a", holder, tag); // move back to parent
        holder.addClass("s-Tag7a");
    }

    // Tag7d
    // Replace existing addTags7dTagElement with this version
    function addTags7dTagElement(type, holder, tag) {
        // Add the tag to settings first (keeps data consistent)
        removeTagElement("Tags7a", holder, tag);
        addTagElement("Tags7d", holder, tag);

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
            removeTagElement("Tags7d", holder, tag);
            // Clear any 7d classes so it returns to uncategorized behavior
            holder.removeClass("s-Tag7d s-Tag7d-hidden");
            var $container = $j("#torrent_tags.tag_inner");
            $container.trigger("spyder.change");
            // Rebuild detail buttons/state
            if (typeof highlightDetailTags === "function") {
                console.log("[✓] highlightDetailTags is defined and is a function.");
                highlightDetailTags();
            } else {
                console.warn("[!] highlightDetailTags is NOT defined or not a function. Type is:", typeof highlightDetailTags);
            }

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

        // As a fallback, if someone passed an old legacy name (good/loved/performer),
        // attempt to map them to TagXx to keep compatibility.
        const legacyToTagMap = {
            good:  'Tag1a',
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

        holder.addClass("s-" + normalized);
        addTags(type, tag);

        try {
            if (typeof highlightDetailTags === 'function') {
                highlightDetailTags();
            }
        } catch (err) {
            console.warn('highlightDetailTags() call failed after addTagElement', err);
        }
    }

    function removeTagElement(type, holder, tag) {
        holder.removeClass("s-Tag1a s-Tag1b s-Tag2a s-Tag2b s-Tag3a s-Tag3b s-Tag4a s-Tag4b s-Tag5a s-Tag5b s-Tag6a s-Tag6b s-Tag7a s-Tag7b s-Tag7c s-Tag7d");
        removeTags(type, tag);
        try {
            if (typeof highlightDetailTags === 'function') highlightDetailTags();
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
                        console.log(`[TagMove] Removed "${tag}" from ${otherType} before adding to ${type}`);
                    }
                }


                tagArray.push(tag);
            }
        }
        saveTags(type, tagArray);
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
        saveTags(type, tagArray);
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
    function getValue(name, def){
        return GM_getValue(name, def);
    }

    function setValue(name, value){
        GM_setValue(name, value);
    }

    function saveTags(name, tagArray){
        var tmp = $j.grep(tagArray, function(tag){return tag;});
        tmp.sort();
        settings.tags[name] = tmp;
        saveSettings();
    }

    function getSettings(){
        return JSON.parse(getValue("spyderSettings", "{}"));
    }

    function saveSettings(){
        setValue("spyderSettings", JSON.stringify(settings));
    }

    // --- Tag Normalization ---
    // Cleans up and normalizes tag names for comparison and consistency.
    function getEquivalentTags(tagArray){
        if(typeof tagArray == "string"){
            tagArray = tagArray.split(" ");
        }
        var allTags = [];
        for(var i = 0, length = tagArray.length; i < length; i++){
            var tag = tagArray[i];
            //if(/\./g.test(tag)){
            //	allTags.push(tag.replace(".", ""));
            //}
            allTags.push(tag);
        }
        return allTags;
    }

    function capitaliseFirstLetter(string){
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
            "Tags1a", "Tags1b",
            "Tags2a", "Tags2b",
            "Tags3a", "Tags3b",
            "Tags4a", "Tags4b",
            "Tags5a", "Tags5b",
            "Tags6a", "Tags6b",
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

        saveSettings(settings);
        console.log(`[cleanChildTagsFromParent] Done. Cross-group conflicts found: ${conflicts.length}`);
        if (conflicts.length) console.table(conflicts);
        return conflicts;
    }

    function applyCustomColors() {
        if (!settings.colors) return;

        let css = "";
        for (const [type, c] of Object.entries(settings.colors)) {
            // convert settings key "Tags1a" -> DOM/CSS key "Tag1a"
            const styleKey = (type || "").replace(/^Tags/, "Tag");

            // Tag styling (use styleKey so DOM classes .s-Tag1a are targeted)
            css += `
    span.s-tag.s-${styleKey} {
        background: ${c.background} !important;
        border-bottom: 1px solid ${c.border} !important;
    }
    span.s-tag.s-${styleKey} > a {
        color: ${c.text} !important;
    }
    `;

            // Button styling should continue to target the .s-add-<TagsX> / .s-remove-<TagsX> classes
            css += `
    .s-add-${type}, .s-remove-${type} {
        background: ${c.background} !important;
        border: 1px solid ${c.border} !important;
        color: #fff !important;
    }
    `;
        }


        $j("#customColorStyles").remove();
        $j("<style id='customColorStyles'>"+css+"</style>").appendTo("head");
    }
}

if(typeof jQuery == "undefined"){
    addJQuery(runScript);
}
else{
    runScript();
}

function addJQuery(callback) {
    var script = document.createElement("script");
    script.setAttribute("src", "https://code.jquery.com/jquery-1.12.4.min.js");
    script.addEventListener('load', function() {
        var script = document.createElement("script");
        script.textContent = "(" + callback.toString() + ")();";
        document.body.appendChild(script);
    }, false);
    document.body.appendChild(script);
}

(function() {
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

        // Move middle_column above sidebar
        container.insertBefore(middleColumn, sidebar);

        // Normalize sidebar layout
        sidebar.style.width = '100%';
        sidebar.style.boxSizing = 'border-box';
        sidebar.style.float = 'none';
        sidebar.style.display = 'block';

        // Debug output
        console.log('middleColumn moved above sidebar:', middleColumn);

        middleColumn.style.marginTop = '0';
        middleColumn.style.marginBottom = '0';
        middleColumn.style.marginLeft = '0';
        middleColumn.style.marginRight = '0';

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

        // Reapply layout helpers for correct spacing/backgrounds
        if (typeof enforceTagRowLayout === 'function') enforceTagRowLayout();
        if (typeof overrideTagLinkWidths === 'function') overrideTagLinkWidths();
        if (typeof resizeAllTagText === 'function') resizeAllTagText();

        // Ensure tag spans don’t stretch full width
        tagList.querySelectorAll('span.s-tag').forEach(span => {
            span.style.display = 'inline-flex';
            span.style.flex = '0 0 auto';
            span.style.alignItems = 'center';
        });
    }


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
            if (typeof rebuildTagLayout === 'function') rebuildTagLayout();
            else console.warn('rebuildTagLayout() not found');
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

        /*
        // === tags.php explicit detection ===
        if (window.location.pathname.includes('tags.php')) {
            const targetCell = document.querySelector('table.box.pad tr.rowa td.label') ||
                  document.querySelector('table.box.pad tr.rowa td');

            if (targetCell) {
                // Clear placeholder text if needed
                if (targetCell.textContent.includes('Place Here')) targetCell.textContent = '';

                // 🔹 Increase the width of this cell
                targetCell.style.width = '200px';  // adjust value as desired (e.g. 200–250px)
                targetCell.style.whiteSpace = 'nowrap'; // keep buttons inline

                // Style container and insert buttons
                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.gap = '6px';
                container.style.padding = '2px 0';
                // container.appendChild(refreshBtn);
                container.appendChild(toggleBtn);

                targetCell.appendChild(container);
                console.log('addButtonToggle() attached inside "Place Here" cell.');
                return;
            }

            // Fallback if no "Place Here" cell
            const table = document.querySelector('table.box.pad') || document.querySelector('table');
            if (table && table.parentElement) {
                const wrapper = document.createElement('div');
                wrapper.style.textAlign = 'left';
                wrapper.style.padding = '6px 10px';
                wrapper.appendChild(refreshBtn);
                wrapper.appendChild(toggleBtn);
                table.parentElement.insertBefore(wrapper, table);
                console.log('addButtonToggle() fallback above tags table.');
                return;
            }
        }

*/
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

    function isEmporiumTorrentPage() {
        return /^https:\/\/www\.empornium\.sx\/torrents\.php\?id=\d+/.test(window.location.href);
    }

    function initializeEnhancements() {
        if (!isEmporiumTorrentPage()) return;

        rearrangeLayout();


        // Step 1: split after the DOM settles
        setTimeout(() => {
            splitTagsIntoColumns();

            // Step 2: after the split finishes building the columns,
            // give the browser one tick to render, then enforce layout
            setTimeout(() => {
                enforceTagRowLayout();
                overrideTagLinkWidths();
                addButtonToggle();
                resizeAllTagText();
            }, 50);

        }, 250);

        // --- New safety net ---
        setTimeout(() => {
            const cols = document.querySelectorAll('#torrent_tags_list .tag-column');
            if (cols.length < 2) {
                // Retry once if it didn’t split properly
                splitTagsIntoColumns();
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
            initializeEnhancements();
        });
    }

    function rebuildTagLayout() {
        try {
            console.log("🔁 Rebuilding tag layout...");
            if (typeof highlightDetailTags === 'function') highlightDetailTags();
            if (typeof rearrangeLayout === 'function') rearrangeLayout();
            if (typeof splitTagsIntoColumns === 'function') splitTagsIntoColumns();
            if (typeof enforceTagRowLayout === 'function') enforceTagRowLayout();
            if (typeof overrideTagLinkWidths === 'function') overrideTagLinkWidths();
            if (typeof addButtonToggle === 'function') addButtonToggle();
            if (typeof resizeAllTagText === 'function') resizeAllTagText();
        } catch (err) {
            console.warn("🔴 Tag layout rebuild failed:", err);
        }
    }

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
                    // Re-read and rebuild tags fresh
                    if (typeof rearrangeLayout === 'function') rearrangeLayout();
                    if (typeof splitTagsIntoColumns === 'function') splitTagsIntoColumns();
                    if (typeof enforceTagRowLayout === 'function') enforceTagRowLayout();
                    if (typeof overrideTagLinkWidths === 'function') overrideTagLinkWidths();
                    if (typeof addButtonToggle === 'function') addButtonToggle();
                    if (typeof resizeAllTagText === 'function') resizeAllTagText();
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
                    rebuildTagLayout();

                } catch (err) {
                    console.warn('Focus rebuild failed:', err);
                } finally {
                    isRebuilding = false;
                }
            }, 300);
        });
    })();


})();
