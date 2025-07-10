console.log("Content script loaded!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Content script received message:", request);
    if (request.action === "getSelectedText") {
        const selectedText = window.getSelection()?.toString() || "";
        console.log("Selected text:", selectedText);
        sendResponse({ selectedText });
    }
    return true;
});