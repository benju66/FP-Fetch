// background.js - FP Fetch Service Worker
chrome.runtime.onInstalled.addListener(() => {
    console.log("FP Fetch Extension Installed.");
});

// Allows the side panel to open when clicking the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));