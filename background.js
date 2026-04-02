chrome.runtime.onInstalled.addListener(() => {
    console.log("FP Fetch Extension Installed.");
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// NEW: Act as the bridge between the Sidebar and the Python Host
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "sendToPython") {
        console.log("Service Worker: Forwarding payload to Python...");

        chrome.runtime.sendNativeMessage(
            'com.fpfetch.native_host',
            request.payload,
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Native Messaging Error:", chrome.runtime.lastError);
                    sendResponse({ status: "error", message: chrome.runtime.lastError.message });
                } else {
                    sendResponse(response);
                }
            }
        );
        return true; // Crucial: Tells Chrome we will respond asynchronously
    }
});
