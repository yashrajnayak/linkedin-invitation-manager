// background.js - Handles background processes for the extension

// When the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn PowerToys extension installed');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // We can add more functionality here if needed
  return true;
});
