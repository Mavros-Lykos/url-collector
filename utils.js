/**
 * Utility functions for URL Collector
 */

const UTILS = {
    /**
     * Get default settings
     */
    getDefaultSettings: () => ({
        collectionEnabled: true,
        floatingButtonEnabled: true,
        floatingButtonPosition: "bottom-right",
        theme: "light"
    }),

    /**
     * Format date to string
     * @param {string} isoString 
     */
    formatDate: (isoString) => {
        try {
            return new Date(isoString).toLocaleString();
        } catch (e) {
            return isoString;
        }
    },

    /**
     * Convert data to CSV format
     * @param {Array} urls 
     */
    toCSV: (urls) => {
        const headers = ["Title", "URL", "Description", "Timestamp"];
        const rows = urls.map(u => [
            `"${(u.title || "").replace(/"/g, '""')}"`,
            `"${(u.url || "").replace(/"/g, '""')}"`,
            `"${(u.description || "").replace(/"/g, '""')}"`,
            `"${u.timestamp || ""}"`
        ]);
        return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    },

    /**
     * Download content as file
     * @param {string} content 
     * @param {string} filename 
     * @param {string} type 
     */
    downloadFile: (content, filename, type = 'text/plain') => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Copy text to clipboard
     * @param {string} text 
     */
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy keys: ', err);
            return false;
        }
    }
};

// Export for ES modules if needed, or just global scope in extension
if (typeof module !== 'undefined') module.exports = UTILS;
