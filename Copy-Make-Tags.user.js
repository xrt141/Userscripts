// ==UserScript==
// @name         Make Name Tags + ALT+C
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Press Alt + C to convert selected names from torrent titles into dotted tags and copy to clipboard
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function() {

    function formatNames(text) {
        return text
            .replace(/\([^)]*\)/g, "")  // Remove parentheses and their content
            .replace(/'/g, "")  // Remove single quotes
            .split(/,|\s+and\s+|\s*&\s*|\.and\./i)  // Split by delimiters (case-insensitive for "and")
            .map(n => n.trim())
            .filter(n => n.includes(" ") || n.includes("."))  // Keep if has space or dot
            .map(n => n.replace(/\s+/g, "."))  // Replace remaining spaces with dots
            .join(" ");
    }

    function showPopup(result) {
        const box = document.createElement("div");
        box.style.position = "fixed";
        box.style.top = "20px";
        box.style.left = "20px";
        box.style.padding = "12px";
        box.style.background = "#222";
        box.style.color = "#fff";
        box.style.borderRadius = "6px";
        box.style.zIndex = "999999";
        box.style.fontSize = "14px";
        box.style.boxShadow = "0 0 10px rgba(0,0,0,0.5)";
        box.innerHTML = `
            <div style="margin-bottom:8px; max-width:300px; word-wrap:break-word;">
                ${result}
            </div>
        `;

        document.body.appendChild(box);

        setTimeout(() => box.remove(), 5000);
    }

    function processSelection() {
        const selected = window.getSelection().toString().trim();
        if (!selected) {
            alert("No text selected.");
            return;
        }

        const result = formatNames(selected);
        GM_setClipboard(result);
        showPopup(result);
    }

    // Right-click menu
    GM_registerMenuCommand("Make Name Tags", processSelection);

    // ALT + C hotkey
    document.addEventListener("keydown", function(e) {
        if (e.altKey && e.key.toLowerCase() === "c") {
            processSelection();
        }
    });

})();