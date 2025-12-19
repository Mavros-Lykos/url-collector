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

    // Fix Issue 5: Inject content script into existing tabs
    chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (queryTabs) => {
        for (const tab of queryTabs) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content/content.js']
            }).catch(() => { }); // Ignore errors on restricted pages

            chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['content/content.css']
            }).catch(() => { });
        }
    });
});

// Clear data on Startup (Session-based requirement)
chrome.runtime.onStartup.addListener(() => {
    console.log("Browser started. Clearing session data.");
    chrome.storage.local.set({ urls: [] }, () => {
        updateBadge(0);
    });
});

// Auto-Collection Listener (Issue 4 - Improved for Shorts/SPAs)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if URL changed (SPA navigation) OR page finished loading
    if ((changeInfo.status === 'complete' && tab.url) || (changeInfo.url)) {

        const currentUrl = tab.url;
        if (!currentUrl || !currentUrl.startsWith('http')) return;

        chrome.storage.local.get(['settings', 'urls'], (result) => {
            if (result.settings && result.settings.collectionEnabled) {
                const urls = result.urls || [];

                // Avoid duplicates in auto-mode
                if (!urls.some(u => u.url === currentUrl)) {
                    if (urls.length >= 100) return; // Limit

                    const newUrl = {
                        id: crypto.randomUUID(),
                        url: currentUrl,
                        title: tab.title || "New Page",
                        description: "",
                        thumbnail: "",
                        timestamp: new Date().toISOString(),
                        selected: false
                    };

                    urls.push(newUrl);
                    chrome.storage.local.set({ urls }, () => {
                        updateBadge(urls.length);
                    });
                }
            }
        });
    }
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
