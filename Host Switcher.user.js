// ==UserScript==
// @name         Host Switcher
// @namespace    https://www.example.com/
// @description  Repeat Searches on different hosts (empornium.sx, happyfappy.net, kufirc.com) and remove filter_cat parameter from URL
// @author
// @match        https://www.empornium.me/torrents.php*
// @match        https://www.empornium.sx/torrents.php*
// @match        https://www.empornium.is/torrents.php*
// @match        https://www.happyfappy.net/torrents.php*
// @match        https://kufirc.com/torrents.php*
// @version      1.0
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Only run on search form page, not results page
    const searchBox = document.getElementById('search_box');
    if (!searchBox) return;

    // Configuration: List of available hosts
    const HOSTS = [
        'www.empornium.sx',
        'www.happyfappy.net',
        'kufirc.com'
    ];

    // Create dropdown and button
    const hostSwitcherContainer = document.createElement('div');
    hostSwitcherContainer.id = 'hostSwitcherContainer';
    hostSwitcherContainer.style.cssText = 'display:block;margin-top:10px;max-width:100px;';

    const label = document.createElement('label');
    label.textContent = 'Switch Host';
    label.style.cssText = 'display:block;margin-bottom:3px;font-size:0.9em;word-wrap:break-word;';

    const dropdown = document.createElement('select');
    dropdown.id = 'hostSwitcherDropdown';
    dropdown.style.cssText = 'margin-bottom:5px;width:100%;';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select host...';
    dropdown.appendChild(defaultOption);

    HOSTS.forEach(host => {
        const option = document.createElement('option');
        option.value = host;
        option.textContent = host;
        dropdown.appendChild(option);
    });

    const switchButton = document.createElement('button');
    switchButton.textContent = 'Go';
    switchButton.style.cssText = 'padding:4px 10px;cursor:pointer;width:100%;';
    switchButton.addEventListener('click', handleHostSwitch);

    hostSwitcherContainer.appendChild(label);
    hostSwitcherContainer.appendChild(dropdown);
    hostSwitcherContainer.appendChild(switchButton);

    // Find the search buttons container and append to it
    const searchButtons = document.querySelector('.search_buttons > span');
    if (searchButtons) {
        searchButtons.appendChild(hostSwitcherContainer);
    } else {
        // Fallback: insert at the top of body if search buttons not found
        document.body.insertBefore(hostSwitcherContainer, document.body.firstChild);
    }

    function handleHostSwitch() {
        const selectedHost = dropdown.value;
        if (!selectedHost) {
            alert('Please select a host');
            return;
        }

        const newUrl = buildNewUrl(selectedHost);
        window.open(newUrl, '_blank');
    }

    function buildNewUrl(newHost) {
        const currentUrl = new URL(window.location.href);
        
        // Get current host
        const currentHost = currentUrl.hostname;
        
        // Build new URL with new host
        const newUrlObj = new URL(currentUrl.href);
        newUrlObj.hostname = newHost;

        // Remove filter_cat parameter
        const params = new URLSearchParams(newUrlObj.search);
        
        // Remove all filter_cat parameters (they might be in array format like filter_cat[6])
        const keysToRemove = [];
        for (let key of params.keys()) {
            if (key.startsWith('filter_cat')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => params.delete(key));

        newUrlObj.search = params.toString();
        
        return newUrlObj.href;
    }
})();
