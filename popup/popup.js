// popup.js

document.addEventListener('DOMContentLoaded', () => {
    // State
    let urls = [];
    let settings = {};

    // Elements
    const urlList = document.getElementById('url-list');
    const countEl = document.getElementById('url-count');
    const toggleCollection = document.getElementById('toggle-collection');
    const toggleButton = document.getElementById('toggle-button');
    const btnCollectTabs = document.getElementById('btn-collect-tabs');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnDelete = document.getElementById('btn-delete');
    const btnCopy = document.getElementById('btn-copy');

    // Modal & Buttons
    const btnExport = document.getElementById('btn-export');
    const modalExport = document.getElementById('modal-export');

    const btnImportTrigger = document.getElementById('btn-import-trigger');
    const fileInput = document.getElementById('file-import');

    const btnOpen = document.getElementById('btn-open');
    const modalOpen = document.getElementById('modal-open');

    // Load Data
    function loadData() {
        chrome.storage.local.get(['urls', 'settings'], (result) => {
            urls = result.urls || [];
            settings = result.settings || {
                collectionEnabled: true,
                floatingButtonEnabled: true
            };

            updateUI();
        });
    }

    // Update UI
    function updateUI() {
        // Update Count
        countEl.textContent = urls.length;

        // Update Toggles
        toggleCollection.checked = settings.collectionEnabled;
        toggleButton.checked = settings.floatingButtonEnabled;

        // Render List
        urlList.innerHTML = '';
        if (urls.length === 0) {
            urlList.innerHTML = '<div class="empty-state">No URLs collected yet. Start browsing!</div>';
        } else {
            urls.forEach((item, index) => {
                const itemEl = document.createElement('div');
                itemEl.className = 'url-item';

                // Get Favicon using Google S2 service
                const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`;

                itemEl.innerHTML = `
                    <input type="checkbox" class="url-check" data-id="${item.id}" ${item.selected ? 'checked' : ''}>
                    <img src="${faviconUrl}" class="item-icon" alt="" onerror="this.src='../icons/icon.png'">
                    <div class="item-content">
                        <div class="item-title" title="${item.title}">${item.title || 'No Title'}</div>
                        <a href="${item.url}" class="item-url" target="_blank" title="${item.url}">${item.url}</a>
                        <div class="item-meta">${UTILS.formatDate(item.timestamp)}</div>
                    </div>
                `;
                urlList.appendChild(itemEl);
            });

            // Bind checkbox events
            document.querySelectorAll('.url-check').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    const id = e.target.dataset.id;
                    const index = urls.findIndex(u => u.id === id);
                    if (index !== -1) {
                        urls[index].selected = e.target.checked;
                        saveUrls();
                    }
                });
            });
        }
    }

    // Save Handlers
    function saveUrls() {
        chrome.storage.local.set({ urls }, () => {
            chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count: urls.length });
        });
    }

    function saveSettings() {
        chrome.storage.local.set({ settings });
    }

    // Toggle Modals
    function toggleModal(modal, show = true) {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            toggleModal(e.target.closest('.modal'), false);
        });
    });

    // Event Listeners
    toggleCollection.addEventListener('change', (e) => {
        settings.collectionEnabled = e.target.checked;
        saveSettings();
    });

    toggleButton.addEventListener('change', (e) => {
        settings.floatingButtonEnabled = e.target.checked;
        saveSettings();
    });

    btnCollectTabs.addEventListener('click', async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        let addedCount = 0;
        const remainingSpace = 100 - urls.length;
        if (remainingSpace <= 0) {
            alert("Storage limit reached (100 URLs).");
            return;
        }

        const tabsToProcess = tabs.slice(0, remainingSpace);

        tabsToProcess.forEach(tab => {
            // Include Favicon support in scraper? 
            // We use the Google service in UI, so no need to store base64 unless offline.
            if (!tab.url.startsWith('http')) return;

            if (!urls.some(u => u.url === tab.url)) {
                urls.push({
                    id: crypto.randomUUID(),
                    url: tab.url,
                    title: tab.title,
                    description: "",
                    thumbnail: "",
                    timestamp: new Date().toISOString(),
                    selected: false
                });
                addedCount++;
            }
        });

        saveUrls();
        updateUI();
    });

    btnSelectAll.addEventListener('click', () => {
        const allSelected = urls.every(u => u.selected);
        urls.forEach(u => u.selected = !allSelected);
        saveUrls();
        updateUI();
    });

    btnDelete.addEventListener('click', () => {
        const selected = urls.filter(u => u.selected);
        if (selected.length === 0) return;

        if (confirm(`Delete ${selected.length} URLs?`)) {
            urls = urls.filter(u => !u.selected);
            saveUrls();
            updateUI();
        }
    });

    btnCopy.addEventListener('click', async () => {
        const selected = urls.filter(u => u.selected);
        const target = selected.length > 0 ? selected : urls;

        if (target.length === 0) return;

        const text = target.map(u => u.url).join('\n');
        const success = await UTILS.copyToClipboard(text);
        if (success) {
            const originalText = btnCopy.textContent;
            btnCopy.textContent = "✅";
            setTimeout(() => btnCopy.textContent = originalText, 1000);
        }
    });

    // Export with Modal
    btnExport.addEventListener('click', () => {
        toggleModal(modalExport, true);
    });

    modalExport.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.format) {
            const format = e.target.dataset.format;
            const selected = urls.filter(u => u.selected);
            const target = selected.length > 0 ? selected : urls;

            if (target.length === 0) return;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

            if (format === 'csv') {
                UTILS.downloadFile(UTILS.toCSV(target), `urls_${timestamp}.csv`, 'text/csv');
            } else if (format === 'txt') {
                const text = target.map(u => u.url).join('\n');
                UTILS.downloadFile(text, `urls_${timestamp}.txt`, 'text/plain');
            } else {
                UTILS.downloadFile(JSON.stringify(target, null, 2), `urls_${timestamp}.json`, 'application/json');
            }
            toggleModal(modalExport, false);
        }
    });

    // Import Trigger
    btnImportTrigger.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset value so same file can be selected again
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                let newUrls = [];
                const content = event.target.result;

                if (file.name.endsWith('.json')) {
                    newUrls = JSON.parse(content);
                } else if (file.name.endsWith('.txt')) {
                    newUrls = content.split('\n').filter(l => l.trim()).map(url => ({
                        id: crypto.randomUUID(),
                        url: url.trim(),
                        title: "Imported URL",
                        timestamp: new Date().toISOString()
                    }));
                }

                if (Array.isArray(newUrls)) {
                    // Logic Change: OVERWRITE instead of Append per user request logic ("Fresh link board")
                    // We can ask simply: "Replace current list?" or just do it as requested.
                    // User said: "fresh link board should be there".

                    if (urls.length > 0) {
                        if (!confirm("Start fresh? This will overwrite your current list.")) {
                            return; // User cancelled
                        }
                    }

                    urls = newUrls.slice(0, 100);
                    saveUrls();
                    updateUI();
                }
            } catch (err) {
                alert("Error importing file");
                console.error(err);
            }
        };
        reader.readAsText(file);
    });

    // Open with Modal
    btnOpen.addEventListener('click', () => {
        const selected = urls.filter(u => u.selected);
        if (selected.length === 0) return;
        toggleModal(modalOpen, true);
    });

    modalOpen.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.mode) {
            const mode = e.target.dataset.mode;
            const selected = urls.filter(u => u.selected);
            const urlStrings = selected.map(u => u.url);

            chrome.runtime.sendMessage({
                type: 'OPEN_URLS',
                urls: urlStrings,
                windowType: mode
            });
            toggleModal(modalOpen, false);
        }
    });

    // Initial Load
    loadData();
});
