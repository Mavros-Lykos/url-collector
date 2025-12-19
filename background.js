/**
 * Background Service Worker
 */

// Initialize storage on installation
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['settings', 'urls'], (result) => {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    collectionEnabled: true,
                    floatingButtonEnabled: true,
                    floatingButtonPosition: "bottom-right"
                }
            });
        }
        if (!result.urls) {
            chrome.storage.local.set({ urls: [] });
        }
    });
});

// Clear data on Startup (Session-based requirement)
// As discussed: We cannot reliably detect "On Close", so we clean "On Startup".
chrome.runtime.onStartup.addListener(() => {
    console.log("Browser started. Clearing session data.");
    chrome.storage.local.set({ urls: [] }, () => {
        // Optionally update badge
        updateBadge(0);
    });
});

// Update Badge Helper
function updateBadge(count) {
    const text = count > 0 ? count.toString() : "";
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: "#2196F3" });
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'URL_COLLECTED') {
        // Fetch current urls, add new one, save
        chrome.storage.local.get(['urls'], (result) => {
            const urls = result.urls || [];

            // Check usage limit (FR-3.4)
            if (urls.length >= 100) {
                sendResponse({ success: false, error: "Limit reached (100 URLs)" });
                return;
            }

            // Add new URL
            urls.push(request.data);

            chrome.storage.local.set({ urls }, () => {
                updateBadge(urls.length);
                sendResponse({ success: true, count: urls.length });
            });
        });
        return true; // async response
    }

    if (request.type === 'UPDATE_BADGE') {
        updateBadge(request.count);
    }

    if (request.type === 'OPEN_URLS') {
        // request.urls is array of strings
        // request.windowType is 'current', 'new', 'incognito'
        const urls = request.urls;
        const mode = request.windowType;

        if (urls.length === 0) return;

        if (mode === 'incognito') {
            chrome.windows.create({ url: urls, incognito: true });
        } else if (mode === 'new') {
            chrome.windows.create({ url: urls });
        } else {
            // Current window
            urls.forEach(url => {
                chrome.tabs.create({ url, active: false });
            });
        }
    }
});
