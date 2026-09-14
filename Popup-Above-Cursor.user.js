// ==UserScript==
// @name        Popup Above Cursor
// @version     1.3
// @description Position overlib popups above cursor instead of below
// @include     /https?://www\.empornium\.(is|sx)/*
// @include     /https?://www\.happyfappy\.net/*
// @include     /https?://femdomcult\.org/*
// @include     /https?://www\.cheggit\.me/*
// @include     /https?://kufirc.com/*
// @grant       none
// ==/UserScript==

(function() {
    'use strict';

    let lastMouseX = 0;
    let lastMouseY = 0;

    // Track mouse position
    document.addEventListener('mousemove', (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }, true);

    // Wait for overDiv to exist and watch it
    function setupOverDivWatcher() {
        const overDiv = document.getElementById('overDiv');
        if (!overDiv) {
            // Try again in a moment
            setTimeout(setupOverDivWatcher, 500);
            return;
        }

        // Watch for attribute changes on overDiv
        const attrObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style') {
                    const visibility = overDiv.style.visibility;
                    const left = overDiv.style.left;
                    const top = overDiv.style.top;

                    // Check if it's now visible (not hidden, not at -10000px)
                    if (visibility === 'visible' || (left !== '-10000px' && top !== '-10000px')) {
                        const height = overDiv.offsetHeight;
                        const width = overDiv.offsetWidth;
                        const padding = 15;
                        
                        // Calculate position above cursor
                        let newY = lastMouseY - height - padding;
                        let newX = lastMouseX;
                        
                        // Check boundaries and adjust if needed
                        const screenHeight = window.innerHeight;
                        const screenWidth = window.innerWidth;
                        
                        // If popup would go off top of screen, position it below instead
                        if (newY < 10) {
                            newY = lastMouseY + padding;
                        }
                        
                        // If popup would go off right edge, shift left
                        if (newX + width > screenWidth - 10) {
                            newX = screenWidth - width - 10;
                        }
                        
                        // If popup would go off left edge, shift right
                        if (newX < 10) {
                            newX = 10;
                        }

                        // Apply new positioning only if actually needed
                        overDiv.style.position = 'fixed';
                        overDiv.style.top = newY + 'px';
                        overDiv.style.left = newX + 'px';
                        overDiv.style.visibility = 'visible';
                    }
                }
            });
        });

        attrObserver.observe(overDiv, {
            attributes: true,
            attributeFilter: ['style']
        });

        console.log('[PopupAbove] Started watching overDiv element');
    }

    // Initialize watcher when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupOverDivWatcher);
    } else {
        setupOverDivWatcher();
    }
})();
