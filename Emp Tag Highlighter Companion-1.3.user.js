// ==UserScript==
// @name         Emp Tag Highlighter Companion
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Rearranges layout and enhances tag display on Empornium
// @author       xrt141
// @match        *://*.empornium.sx/torrents.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configurable selectors
    const middleTableSelector = '#details_top > div.middle_column > table';
    const sidebarSelector = '#details_top > div.sidebar';
    const containerSelector = '#details_top';
    const tagListSelector = '#torrent_tags_list';

    // Move middle_column above sidebar and stretch sidebar full width
    function rearrangeLayout() {
        const middleTable = document.querySelector(middleTableSelector);
        const sidebar = document.querySelector(sidebarSelector);
        const container = document.querySelector(containerSelector);

        if (!middleTable || !sidebar || !container) {
            console.warn('Rearrange script: One or more elements not found.');
            return;
        }

        container.insertBefore(middleTable, container.firstChild);
        sidebar.style.width = '100%';
        sidebar.style.boxSizing = 'border-box';
        sidebar.style.float = 'none';
        sidebar.style.display = 'block';
    }

    // Split tag list into 3 columns
    function splitTagsIntoColumns() {
        const tagList = document.querySelector(tagListSelector);
        if (!tagList) {
            console.warn('Tag splitter: #torrent_tags_list not found.');
            return;
        }

        const items = Array.from(tagList.querySelectorAll('li'));
        if (items.length < 3) return;

        const col1 = document.createElement('div');
        const col2 = document.createElement('div');
        const col3 = document.createElement('div');

        [col1, col2, col3].forEach(col => {
            col.style.width = '33.33%';
            col.style.float = 'left';
            col.style.boxSizing = 'border-box';
        });

        const third = Math.ceil(items.length / 3);
        items.slice(0, third).forEach(item => col1.appendChild(item));
        items.slice(third, third * 2).forEach(item => col2.appendChild(item));
        items.slice(third * 2).forEach(item => col3.appendChild(item));

        tagList.innerHTML = '';
        tagList.appendChild(col1);
        tagList.appendChild(col2);
        tagList.appendChild(col3);
    }

    // Apply flex layout to tag rows
    function enforceTagRowLayout() {
        const tagItems = document.querySelectorAll('#torrent_tags_list > li');

        tagItems.forEach(li => {
            li.style.display = 'flex';
            li.style.flexWrap = 'nowrap';
            li.style.alignItems = 'center';

            const tagSpan = li.querySelector('span.s-tag');
            const voteDiv = li.querySelector('div');
            const tagLink = tagSpan?.querySelector('a');

            if (tagSpan) {
                tagSpan.style.flex = '1 1 auto';
                tagSpan.style.minWidth = '0';
                tagSpan.style.boxSizing = 'border-box';
                tagSpan.style.display = 'flex';
                tagSpan.style.alignItems = 'center';
            }

            if (tagLink) {
                tagLink.style.flex = '1 1 auto';
                tagLink.style.whiteSpace = 'nowrap';
                tagLink.style.overflow = 'hidden';
                tagLink.style.textOverflow = 'ellipsis';
                tagLink.style.display = 'block';
                tagLink.style.boxSizing = 'border-box';
                tagLink.style.float = 'none';
                tagLink.style.minWidth = '0';
                tagLink.style.width = '100%';
            }

            if (voteDiv) {
                voteDiv.style.flex = '0 0 auto';
                voteDiv.style.whiteSpace = 'nowrap';
                voteDiv.style.boxSizing = 'border-box';
                voteDiv.style.marginLeft = '8px';
            }
        });
    }

    // Limit width of staff/disliked tag links
    function overrideTagLinkWidths() {
        const selectors = [
            '.s-tag.s-staff a',
            '.s-tag.s-staff.s-disliked a'
        ];

        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(link => {
                link.style.maxWidth = '110px';
                link.style.display = 'inline-block';
                link.style.boxSizing = 'border-box';
            });
        });
    }

    // Add toggle button to show/hide tag buttons
    function addButtonToggle() {
        const tagList = document.querySelector(tagListSelector);
        if (!tagList) {
            console.warn('Toggle script: #torrent_tags_list not found.');
            return;
        }

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Hide Tag Buttons';
        toggleBtn.style.margin = '10px 0';
        toggleBtn.style.padding = '4px 8px';
        toggleBtn.style.fontSize = '12px';
        toggleBtn.style.cursor = 'pointer';

        let buttonsVisible = true;

        toggleBtn.addEventListener('click', () => {
            buttonsVisible = !buttonsVisible;
            tagList.querySelectorAll('.s-button').forEach(btn => {
                btn.style.display = buttonsVisible ? '' : 'none';
            });
            toggleBtn.textContent = buttonsVisible ? 'Hide Tag Buttons' : 'Show Tag Buttons';
        });

        tagList.parentElement.insertBefore(toggleBtn, tagList);
    }

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

    // Initialize layout and enhancements
    window.addEventListener('load', () => {
        rearrangeLayout();
        splitTagsIntoColumns();
        enforceTagRowLayout();
        overrideTagLinkWidths();
        addButtonToggle();
        resizeAllTagText();
    });
})();
