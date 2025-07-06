// Variable to track if we're currently auto-scrolling
let isScrolling = false;
// Variable to track the last scroll height to detect when no new content is loaded
let lastScrollHeight = 0;
// Counter for consecutive times no new content was loaded
let noChangeCounter = 0;
// Maximum number of consecutive checks without change before stopping
const MAX_NO_CHANGE = 5;
// Maximum scroll attempts before giving up (to prevent infinite scrolling)
const MAX_SCROLL_ATTEMPTS = 100;
// Current scroll attempt count
let scrollAttempts = 0;
// Time to wait between scrolls (ms)
const SCROLL_INTERVAL = 1000;

// Variables for Swipe UI
let allConnections = [];
let currentCardIndex = 0;
let swipeUIActive = false;
let fireButton = null;
let filterTabs = null;
let initialConnectionsLoaded = false;
let loadingMoreConnections = false;
let swipeActionInProgress = false; // Add flag to prevent multiple simultaneous actions

// Listen for messages from the popup script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startScrolling' && !isScrolling) {
    startAutoScrolling();
  } else if (message.action === 'startSwipeMode') {
    startSwipeMode();
  } else if (message.action === 'startFullProcess') {
    startFullProcessFromButton();
  }
  return true;
});

// Function to inject the fire button next to settings icon
function injectFireButton() {
  // Remove existing button if present
  const existingBtn = document.getElementById('linkedin-swipe-btn');
  if (existingBtn) {
    existingBtn.remove();
  }

  // Find the settings button using the path selector from HTML
  const settingsButton = document.querySelector('div[role="button"][tabindex="0"] svg[id="settings-medium"]');
  if (!settingsButton) {
    console.log('LinkedIn PowerToys: Settings button not found, retrying...');
    setTimeout(injectFireButton, 2000);
    return;
  }

  const settingsContainer = settingsButton.closest('div[role="button"]');
  if (!settingsContainer) {
    console.log('LinkedIn PowerToys: Settings container not found, retrying...');
    setTimeout(injectFireButton, 2000);
    return;
  }

  // Create fire button
  fireButton = document.createElement('button');
  fireButton.id = 'linkedin-swipe-btn';
  fireButton.textContent = '🔥';
  fireButton.title = 'Start LinkedIn Swipe Mode';
  
  // Style the fire button to match LinkedIn's design and position it correctly
  fireButton.style.cssText = `
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 18px;
    padding: 6px;
    margin-right: 16px;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    position: relative;
    z-index: 10;
    transform: translateY(-4px) translateX(-4px);
  `;

  // Add hover effects
  fireButton.addEventListener('mouseenter', function() {
    if (!this.disabled) {
      this.style.background = '#f3f2ef';
      this.style.transform = 'scale(1.1) translateY(-2px)';
    }
  });

  fireButton.addEventListener('mouseleave', function() {
    if (!this.disabled) {
      this.style.background = 'transparent';
      this.style.transform = 'scale(1) translateY(-2px)';
    }
  });

  // Add click handler
  fireButton.addEventListener('click', startFullProcessFromButton);

  // Insert the button before the settings button (to the left)
  settingsContainer.parentNode.insertBefore(fireButton, settingsContainer);

  console.log('LinkedIn PowerToys: Fire button injected successfully');
}

// Function to start full process from the injected button
function startFullProcessFromButton() {
  if (swipeUIActive) {
    // If Swipe UI is already active, treat this as an undo button click
    exitSwipeMode();
    return;
  }

  console.log('LinkedIn PowerToys: Starting swipe mode immediately...');
  
  // Update button to loading state
  if (fireButton) {
    fireButton.textContent = '⏳';
    fireButton.disabled = true;
    fireButton.style.cursor = 'not-allowed';
    fireButton.style.opacity = '0.6';
  }

  // Start swipe mode immediately with current connections
  startSwipeMode();
}

// Function to update fire button to undo button
function updateFireButtonToUndo() {
  if (fireButton) {
    fireButton.textContent = '↩️';
    fireButton.title = 'Exit Swipe Mode and restore LinkedIn';
    fireButton.disabled = false;
    fireButton.style.cursor = 'pointer';
    fireButton.style.opacity = '1';
    fireButton.style.background = 'transparent';
    
    console.log('LinkedIn PowerToys: Fire button updated to undo button');
  }
}

// Function to load more connections in background
function loadMoreConnectionsInBackground() {
  if (loadingMoreConnections) return;
  
  loadingMoreConnections = true;
  console.log('LinkedIn PowerToys: Loading more connections in background...');
  
  // Start auto-scrolling to load more connections
  startAutoScrolling(false, true); // Pass true for background loading
}

// Function to check if we need to load more connections
function checkAndLoadMoreConnections() {
  const remainingCards = allConnections.length - currentCardIndex;
  
  console.log(`LinkedIn PowerToys: Checking connections - Current: ${currentCardIndex}, Total: ${allConnections.length}, Remaining: ${remainingCards}`);
  
  // Load more when only 5 cards remaining and we haven't already started loading
  // Increased from 3 to 5 to provide better buffer and prevent blank screens
  if (remainingCards <= 5 && !loadingMoreConnections && initialConnectionsLoaded) {
    console.log('LinkedIn PowerToys: Triggering background loading - low on cards');
    loadMoreConnectionsInBackground();
  }
}

// Function to hide filter tabs (All, Mutual Connections, etc.)
function hideFilterTabs() {
  // Find the filter navigation using the updated selectors from HTML
  const filterSelectors = [
    'nav._1f65b339.e5cfa895._6d86695c._3521e13b._4cfc03f4',
    'nav._1f65b339',
    'ul._8cce9d30._5b608b13._44c1d05b.b1f0a03d',
    'ul._8cce9d30._5b608b13._40ea77eb._46a023aa'
  ];
  
  for (const selector of filterSelectors) {
    const filterNav = document.querySelector(selector);
    if (filterNav) {
      filterTabs = filterNav;
      filterNav.style.display = 'none';
      console.log('LinkedIn PowerToys: Filter tabs hidden using selector:', selector);
      break;
    }
  }
  
  if (!filterTabs) {
    console.log('LinkedIn PowerToys: Could not find filter tabs to hide');
  }
}

// Function to show filter tabs
function showFilterTabs() {
  if (filterTabs) {
    filterTabs.style.display = '';
    console.log('LinkedIn PowerToys: Filter tabs restored');
  }
}

// Function to automatically scroll down to load more connection requests
function startAutoScrolling(isFullProcess = false, isBackgroundLoad = false) {
  // Prevent multiple scroll processes
  if (isScrolling) return;
  
  isScrolling = true;
  lastScrollHeight = document.body.scrollHeight;
  scrollAttempts = 0;
  noChangeCounter = 0;
  
  console.log('LinkedIn Auto-Scroll: Starting to scroll to load more connection requests...');
  
  if (!isFullProcess && !isBackgroundLoad) {
    // Update status in popup
    chrome.runtime.sendMessage({ 
      status: 'Starting to load all connection requests...' 
    });
  }
  
  // Set up an interval to scroll periodically
  const scrollInterval = setInterval(() => {
    // Scroll to the bottom of the page
    window.scrollTo(0, document.body.scrollHeight);
    scrollAttempts++;
    
    console.log(`LinkedIn Auto-Scroll: Scroll attempt ${scrollAttempts}/${MAX_SCROLL_ATTEMPTS}`);
    
    // Update progress during scrolling (only if not background loading)
    if (isFullProcess && !isBackgroundLoad) {
      const scrollProgress = Math.min(10 + (scrollAttempts / MAX_SCROLL_ATTEMPTS) * 60, 70);
      chrome.runtime.sendMessage({ 
        progress: scrollProgress, 
        status: `Loading requests... (${scrollAttempts}/${MAX_SCROLL_ATTEMPTS})` 
      });
    }
    
    // Check if we've reached the end (no new content loaded after scrolling)
    setTimeout(() => {
      const currentScrollHeight = document.body.scrollHeight;
      const loadMoreButtons = findLoadMoreButtons();
      
      console.log(`Current scroll height: ${currentScrollHeight}, Last: ${lastScrollHeight}`);
      console.log(`Load more buttons found: ${loadMoreButtons.length}`);
      
      // Check if scroll height changed or if load more button exists
      if (currentScrollHeight === lastScrollHeight && loadMoreButtons.length === 0) {
        noChangeCounter++;
        console.log(`LinkedIn Auto-Scroll: No new content loaded (${noChangeCounter}/${MAX_NO_CHANGE})`);
        
        // If we've hit the maximum number of attempts with no change, we're done
        if (noChangeCounter >= MAX_NO_CHANGE || scrollAttempts >= MAX_SCROLL_ATTEMPTS) {
          clearInterval(scrollInterval);
          isScrolling = false;
          loadingMoreConnections = false;
          
          console.log('LinkedIn Auto-Scroll: Finished loading connection requests!');
          console.log(`Final page height: ${document.body.scrollHeight}`);
          
          // Count how many invitation cards we found
          const finalCards = document.querySelectorAll('div[data-view-name="pending-invitation"], div[role="listitem"][componentkey*="invitation"]');
          console.log(`Total invitation cards detected: ${finalCards.length}`);
          
          // If this is background loading for swipe mode, update the connections array
          if (isBackgroundLoad && swipeUIActive) {
            const newConnections = extractConnectionData();
            const originalCount = allConnections.length;
            
            if (newConnections.length > originalCount) {
              // Create a unique identifier for existing connections
              const existingIds = new Set();
              allConnections.forEach(conn => {
                // Use multiple identifiers to ensure uniqueness
                const id = `${conn.name}-${conn.profileUrl}-${conn.tagline}`.toLowerCase().replace(/\s+/g, '');
                existingIds.add(id);
              });
              
              // Filter out connections that already exist
              const newConnectionsFiltered = newConnections.filter(conn => {
                const id = `${conn.name}-${conn.profileUrl}-${conn.tagline}`.toLowerCase().replace(/\s+/g, '');
                return !existingIds.has(id);
              });
              
              if (newConnectionsFiltered.length > 0) {
                allConnections.push(...newConnectionsFiltered);
                console.log(`Added ${newConnectionsFiltered.length} new connections to swipe deck`);
                console.log(`Total connections now: ${allConnections.length}`);
                
                // If user is currently viewing loading state and we just loaded new cards, switch back to cards
                const cardContainer = document.getElementById('card-container');
                const loadingState = cardContainer?.querySelector('.loading-state');
                if (loadingState && currentCardIndex < allConnections.length) {
                  console.log('New connections loaded while in loading state, switching back to cards');
                  setTimeout(() => {
                    showNextCard();
                  }, 500); // Small delay to let user see the loading finished
                }
              } else {
                console.log('No new unique connections found during background loading');
              }
            } else {
              console.log('No additional connections found - likely reached the end');
            }
            
            // Always reset the loading flag when background loading completes
            loadingMoreConnections = false;
          } else if (isFullProcess) {
            // Move to Swipe mode
            chrome.runtime.sendMessage({ 
              progress: 80, 
              status: 'Preparing Swipe interface...' 
            });
            
            setTimeout(() => {
              startSwipeMode();
            }, 1000);
          } else if (!isBackgroundLoad) {
            // Send a message to the popup to update the status
            chrome.runtime.sendMessage({ 
              status: `Completed! Loaded all connection requests after ${scrollAttempts} scrolls. Found ${finalCards.length} invitations.` 
            });
          }
        }
      } else {
        // Reset counter if new content was loaded or load more button exists
        noChangeCounter = 0;
        lastScrollHeight = currentScrollHeight;
        
        if (loadMoreButtons.length > 0) {
          console.log('LinkedIn Auto-Scroll: "Load More" button detected, clicking it...');
          // Click the load more button
          loadMoreButtons[0].click();
          
          // Wait a bit after clicking before checking again
          setTimeout(() => {
            const newScrollHeight = document.body.scrollHeight;
            lastScrollHeight = newScrollHeight;
            console.log('LinkedIn Auto-Scroll: Clicked Load More button, continuing...');
          }, 1500);
        } else {
          console.log(`LinkedIn Auto-Scroll: New content loaded, continuing to scroll... (${scrollAttempts}/${MAX_SCROLL_ATTEMPTS})`);
        }
        
        if (!isFullProcess && !isBackgroundLoad) {
          // Send a progress message to the popup
          chrome.runtime.sendMessage({ 
            status: `Scrolling... (${scrollAttempts}/${MAX_SCROLL_ATTEMPTS})` 
          });
        }
      }
    }, 1200); // Increased wait time to allow content to load
    
  }, SCROLL_INTERVAL);
}

// Function to find "Load More" buttons on the page
function findLoadMoreButtons() {
  // Based on the actual HTML structure from the reference files
  const specificSelectors = [
    // Exact selector from the HTML files for "Load more" button
    'button.a679a0b8._3cde689a._557ced1d._7587260e._57b56f73.b5a7ac8c._27cfefb3.c49d26b7._5f676116.ca6f144b._6d0b6a3a._609562f9',
    'div._8cce9d30._5f22912d button',
    // More general selectors as fallbacks
    'button.a679a0b8._3cde689a._557ced1d._7587260e._57b56f73',
    '.scaffold-finite-scroll__load-button'
  ];
  
  // Try each specific selector first
  for (const selector of specificSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      const loadMoreButtons = Array.from(elements).filter(button => {
        const buttonText = button.textContent.toLowerCase().trim();
        return buttonText.includes('load more');
      });
      
      if (loadMoreButtons.length > 0) {
        console.log(`Found ${loadMoreButtons.length} load more buttons using selector: ${selector}`);
        return loadMoreButtons;
      }
    } catch (e) {
      console.log(`Error with selector ${selector}:`, e);
    }
  }
  
  // Fallback to the more general approach
  const allButtons = document.querySelectorAll('button, [role="button"]');
  const loadMoreButtons = Array.from(allButtons).filter(button => {
    const buttonText = button.textContent.toLowerCase().trim();
    return buttonText.includes('load') && buttonText.includes('more');
  });
  
  console.log(`Found ${loadMoreButtons.length} load more buttons using fallback method`);
  return loadMoreButtons;
}

// Function to start Swipe mode
function startSwipeMode() {
  console.log('LinkedIn PowerToys: Starting Swipe mode...');
  
  // Extract connection data from currently visible connections
  const connections = extractConnectionData();
  
  if (connections.length === 0) {
    // If no connections found, try loading some first
    console.log('LinkedIn PowerToys: No connections found, trying to load some...');
    if (fireButton) {
      fireButton.textContent = '🔥';
      fireButton.disabled = false;
      fireButton.style.cursor = 'pointer';
      fireButton.style.opacity = '1';
    }
    return;
  }
  
  // Use connections in the order they appear (no sorting by mutual connections)
  allConnections = connections;
  currentCardIndex = 0;
  initialConnectionsLoaded = true;
  
  // Inject CSS and create overlay UI immediately
  injectSwipeCSS();
  hideFilterTabs(); // Hide filter tabs when Swipe UI loads
  createSwipeUI();
  
  // Update fire button to undo button once Swipe UI is loaded
  updateFireButtonToUndo();
  
  chrome.runtime.sendMessage({ 
    action: 'swipeModeStarted',
    status: `Ready! ${allConnections.length} connections loaded.` 
  });
}

// Function to inject CSS for Swipe-like UI
function injectSwipeCSS() {
  const css = `
    #swipe-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(27, 31, 35, 0.95);
      backdrop-filter: blur(10px);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      box-sizing: border-box;
    }

    #card-container {
      position: relative;
      width: 380px;
      height: 600px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .swipe-card {
      width: 380px;
      height: 600px;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: absolute;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      cursor: grab;
      user-select: none;
      opacity: 1;
      transform: scale(1) translateY(0);
      z-index: 1000;
      pointer-events: auto;
    }

    .swipe-card.current-card {
      z-index: 1000;
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }

    .swipe-card.next-card {
      z-index: 999;
      transform: scale(0.95) translateY(20px);
      opacity: 0.7;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      pointer-events: none;
    }

    .swipe-card.hidden-preload {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none;
      z-index: 998;
      transform: scale(0.85) translateY(40px) !important;
    }

    .swipe-card.exiting {
      z-index: 1002 !important;
      pointer-events: none;
    }

    .swipe-card:active {
      cursor: grabbing;
    }

    .swipe-card.swipe-left {
      animation: swipeLeft 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }

    .swipe-card.swipe-right {
      animation: swipeRight 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }

    .swipe-card.swipe-up {
      animation: swipeUp 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }

    @keyframes swipeLeft {
      0% {
        transform: translateX(0) rotate(0deg);
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
      100% {
        transform: translateX(-100vw) rotate(-30deg);
        opacity: 0;
      }
    }

    @keyframes swipeRight {
      0% {
        transform: translateX(0) rotate(0deg);
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
      100% {
        transform: translateX(100vw) rotate(30deg);
        opacity: 0;
      }
    }

    @keyframes swipeUp {
      0% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
      100% {
        transform: translateY(-100vh) scale(0.8);
        opacity: 0;
      }
    }

    @keyframes nextCardPromote {
      0% {
        transform: scale(0.95) translateY(20px);
        opacity: 0.7;
        z-index: 999;
      }
      100% {
        transform: scale(1) translateY(0);
        opacity: 1;
        z-index: 1000;
      }
    }

    @keyframes cardExitLeft {
      0% {
        transform: translate(0px, 0px) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translate(-400px, 50px) rotate(-30deg);
        opacity: 0;
      }
    }

    @keyframes cardExitRight {
      0% {
        transform: translate(0px, 0px) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translate(400px, 50px) rotate(30deg);
        opacity: 0;
      }
    }

    @keyframes cardExitDown {
      0% {
        transform: translate(0px, 0px) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translate(0px, 400px) rotate(5deg);
        opacity: 0;
      }
    }

    .swipe-card.promoting {
      animation: nextCardPromote 0.3s ease-out forwards;
    }

    .swipe-card.dragging {
      transition: none !important;
      z-index: 1001;
      cursor: grabbing !important;
      transform: none !important;
      will-change: transform;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }

    .card-header {
      height: 200px;
      background: linear-gradient(45deg, #0077b5, #00a0dc);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .profile-image {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      border: 4px solid white;
      object-fit: cover;
    }

    .card-body {
      padding: 20px 20px 80px 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }

    .profile-name {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #333;
      text-align: center;
      line-height: 1.2;
    }

    .profile-name a {
      color: #0077b5;
      text-decoration: none;
      transition: color 0.3s ease;
    }

    .profile-name a:hover {
      color: #005885;
      text-decoration: underline;
    }

    .mutual-connections {
      background: linear-gradient(135deg, #f8f9fa, #e9ecef);
      padding: 10px 14px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 8px;
      font-size: 13px;
      color: #0077b5;
      font-weight: 600;
      border: 1px solid #e3e6ea;
      min-height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .profile-tagline {
      font-size: 14px;
      color: #666;
      line-height: 1.4;
      margin-bottom: 8px;
      text-align: center;
      max-height: 120px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 6;
      -webkit-box-orient: vertical;
      flex: 1;
    }

    .card-actions {
      display: flex;
      justify-content: stretch;
      gap: 0;
      padding: 0;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-radius: 0 0 20px 20px;
      overflow: hidden;
    }

    .action-btn {
      flex: 1;
      height: 60px;
      border: none;
      border-radius: 0;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      position: relative;
      overflow: hidden;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .action-btn:hover {
      transform: translateY(-2px);
      filter: brightness(1.1);
    }

    .action-btn:active {
      transform: translateY(0);
    }

    .ignore-btn {
      background: linear-gradient(135deg, #ff4757, #ff3742);
      color: white;
      border-right: 1px solid rgba(255, 255, 255, 0.2);
    }

    .ignore-btn:hover {
      background: linear-gradient(135deg, #ff3742, #ff2f3a);
    }

    .skip-btn {
      background: linear-gradient(135deg, #ffa502, #ff9500);
      color: white;
      border-right: 1px solid rgba(255, 255, 255, 0.2);
    }

    .skip-btn:hover {
      background: linear-gradient(135deg, #ff9500, #ff8c00);
    }

    .accept-btn {
      background: linear-gradient(135deg, #2ed573, #1dd1a1);
      color: white;
    }

    .accept-btn:hover {
      background: linear-gradient(135deg, #1dd1a1, #10ac84);
    }



    .no-more-cards {
      text-align: center;
      color: white;
      max-width: 400px;
    }

    .no-more-cards h2 {
      font-size: 48px;
      margin-bottom: 20px;
      font-weight: 700;
    }

    .no-more-cards p {
      font-size: 20px;
      margin-bottom: 30px;
      opacity: 0.9;
    }

    .loading-state {
      text-align: center;
      color: white;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .loading-animation {
      margin-bottom: 30px;
    }

    .loading-spinner {
      width: 60px;
      height: 60px;
      border: 4px solid rgba(255, 255, 255, 0.2);
      border-top: 4px solid #0077b5;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-state h2 {
      font-size: 28px;
      margin-bottom: 15px;
      font-weight: 600;
      color: white;
    }

    .loading-state p {
      font-size: 16px;
      opacity: 0.9;
      color: rgba(255, 255, 255, 0.8);
    }



    .action-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 60px;
      font-weight: 700;
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
      z-index: 15;
      border-radius: 20px;
      backdrop-filter: blur(8px);
    }

    .action-overlay.ignore {
      background: rgba(255, 71, 87, 0.9);
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .action-overlay.accept {
      background: rgba(46, 213, 115, 0.9);
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .action-overlay.skip {
      background: rgba(255, 165, 2, 0.9);
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .action-overlay.show {
      opacity: 1;
    }

    /* Responsive design */
    @media (max-width: 650px) {
      #swipe-container {
        padding: 15px;
      }
      
      .swipe-card {
        width: 100%;
        max-width: 350px;
      }
    }
    
    .close-button {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: white;
      font-size: 24px;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
      z-index: 10001;
    }
    
    .close-button:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
      transform: scale(1.1);
    }
  `;

  const styleElement = document.createElement('style');
  styleElement.id = 'swipe-styles';
  styleElement.textContent = css;
  document.head.appendChild(styleElement);
}

// Rest of the functions remain the same as in the original file...
// [I'll include the remaining functions that extract connection data, create UI, etc.]

// Function to extract connection data from LinkedIn HTML
function extractConnectionData() {
  const connections = [];
  
  // Find all invitation cards using the correct selectors from the HTML structure
  let invitationCards = [];
  
  // Try multiple selectors based on the actual HTML structure
  const cardSelectors = [
    // Main selector for invitation cards based on the HTML structure
    'div[data-view-name="pending-invitation"]',
    // Specific structure from the HTML files - the actual parent container
    'div.d18644b1._8cce9d30._21be59f4._32ae0e52._86c76712._40ea77eb._46a023aa',
    // More specific selector based on the structure
    'div.d18644b1.c96f8449._1dfe17d0._2269ba31.c6f2ac59._8cce9d30._21be59f4._32ae0e52._86c76712._40ea77eb.b1f0a03d[role="listitem"]',
    // Based on the actual HTML structure from the files - each invitation item
    'div._87cd2124._472fd2a9._6cb2e7c3.eb673e58',
    // Try to find containers with ignore/accept buttons
    'div:has(button[aria-label*="Ignore"]):has(button[aria-label*="Accept"])',
    // Fallback selectors
    'div[role="listitem"][componentkey*="invitation"]',
    'div[role="listitem"]',
    // General invitation container
    'div[data-view-name*="invitation"]'
  ];
  
  for (const selector of cardSelectors) {
    invitationCards = document.querySelectorAll(selector);
    if (invitationCards.length > 0) {
      console.log(`Found ${invitationCards.length} invitation cards using selector: ${selector}`);
      break;
    }
  }
  
  if (invitationCards.length === 0) {
    console.log('No invitation cards found with any selector. Checking page structure...');
    return [];
  }
  
  console.log(`Processing ${invitationCards.length} invitation cards`);
  
  invitationCards.forEach((card, index) => {
    try {
      // Extract profile image - updated selectors
      const imgElement = card.querySelector('img._2de093db._6408a578, img[alt*="profile picture"], img[src*="profile-displayphoto"], figure img');
      const profileImage = imgElement ? imgElement.src : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSIjZjNmNGY2Ii8+CjxjaXJjbGUgY3g9IjYwIiBjeT0iNDAiIHI9IjIwIiBmaWxsPSIjYzNjNGM3Ii8+CjxwYXRoIGQ9Im0yNSA5MCA2Ny41LTE1IDcsNSAtNjcuNSwxNXoiIGZpbGw9IiNjM2M0YzciLz4KPC9zdmc+';
      
      // Extract name and profile URL - updated selectors based on HTML structure
      const nameElement = card.querySelector('a._7587260e._096a665d strong, a[href*="/in/"] strong, strong');
      const name = nameElement ? nameElement.textContent.trim() : 'Unknown';
      
      // Extract LinkedIn profile URL
      const profileLinkElement = card.querySelector('a[href*="/in/"], a._7587260e._096a665d');
      let profileUrl = '';
      if (profileLinkElement && profileLinkElement.href) {
        profileUrl = profileLinkElement.href;
        // Ensure it's a full URL
        if (profileUrl.startsWith('/in/')) {
          profileUrl = 'https://www.linkedin.com' + profileUrl;
        }
      }
      
      // Extract tagline - updated selectors
      const taglineElement = card.querySelector('p._6280f893._4217524f.d839992e, p._6280f893._4217524f');
      const tagline = taglineElement ? taglineElement.textContent.trim() : 'No tagline available';
      
      // Extract mutual connections - updated selectors to match the HTML structure
      const mutualSelectors = [
        'p._6280f893._2299a73c._163b424c._1800f1ec._472fd2a9.cb744a73._78e48e06._71e41417.be1ccd22._84db77a9._57b56f73.af3a1c87._8b457770._190823b7',
        'p._6280f893._2299a73c._163b424c',
        'p._6280f893._2299a73c'
      ];
      
      let mutualElement = null;
      for (const selector of mutualSelectors) {
        mutualElement = card.querySelector(selector);
        if (mutualElement) {
          console.log(`Found mutual connections using selector: ${selector}`);
          break;
        }
      }
      
      let mutualConnections = 'No mutual connections';
      let mutualCount = 0;
      
      if (mutualElement) {
        mutualConnections = mutualElement.textContent.trim();
        console.log(`Mutual connections text: "${mutualConnections}"`);
        
        // Extract number from text like "Prakash Sikaria and 12 other mutual connections"
        const match = mutualConnections.match(/(\d+)\s+other\s+mutual/i);
        if (match) {
          mutualCount = parseInt(match[1]) + 1; // +1 for the named person
        } else if (mutualConnections.toLowerCase().includes('mutual')) {
          // Handle cases like "1 mutual connection" or "Prakash Sikaria and 1 other mutual connection"
          const singleMatch = mutualConnections.match(/(\d+)\s+mutual/i);
          if (singleMatch) {
            mutualCount = parseInt(singleMatch[1]);
          } else if (mutualConnections.includes(' and ') && mutualConnections.toLowerCase().includes('mutual')) {
            // If it mentions a name and "mutual connections" without a number, assume it's just one named person
            mutualCount = 1;
          }
        }
      } else {
        console.log('No mutual connections element found');
      }
      
      // Find accept and ignore buttons for this card - improved selectors
      let acceptButton = null;
      let ignoreButton = null;
      
      // First try to find buttons by aria-label
      const allButtons = card.querySelectorAll('button');
      
      for (const btn of allButtons) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const buttonText = btn.textContent.toLowerCase().trim();
        
        // Check for Accept button
        if ((ariaLabel.toLowerCase().includes('accept') && !ariaLabel.toLowerCase().includes('ignore')) ||
            (buttonText.includes('accept') && !buttonText.includes('ignore'))) {
          acceptButton = btn;
        }
        
        // Check for Ignore button  
        if (ariaLabel.toLowerCase().includes('ignore') || 
            buttonText.includes('ignore')) {
          ignoreButton = btn;
        }
        
        // Also check nested spans for button text
        const spans = btn.querySelectorAll('span');
        for (const span of spans) {
          const spanText = span.textContent.toLowerCase().trim();
          if (spanText === 'accept' && !acceptButton) {
            acceptButton = btn;
          }
          if (spanText === 'ignore' && !ignoreButton) {
            ignoreButton = btn;
          }
        }
      }
      
      connections.push({
        index,
        name,
        profileUrl,
        tagline,
        profileImage,
        mutualConnections,
        mutualCount,
        acceptButton,
        ignoreButton,
        card
      });
      
      console.log(`Extracted connection ${index + 1}: ${name} (${mutualCount} mutual connections)`);
      
    } catch (error) {
      console.error(`Error extracting data from card ${index}:`, error);
    }
  });
  
  console.log(`Successfully extracted ${connections.length} connections`);
  return connections;
}

// Function to create Swipe-like UI
function createSwipeUI() {
  // Remove existing Swipe container if it exists
  const existingContainer = document.getElementById('swipe-container');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // Create main container
  const container = document.createElement('div');
  container.id = 'swipe-container';
  
  // Add close button
  const closeButton = document.createElement('div');
  closeButton.className = 'close-button';
  closeButton.innerHTML = '×';
  closeButton.title = 'Close Swipe Mode (ESC)';
  closeButton.addEventListener('click', exitSwipeMode);
  container.appendChild(closeButton);
  
  // Add ESC key handler to close overlay
  const handleEscape = (e) => {
    if (e.key === 'Escape' && swipeUIActive) {
      exitSwipeMode();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
  
  // Prevent closing on clicking outside - only allow close button and ESC
  container.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Create card container
  const cardContainer = document.createElement('div');
  cardContainer.id = 'card-container';
  container.appendChild(cardContainer);
  
  // Insert the Swipe UI as overlay
  insertSwipeUIIntoLinkedIn(container);
  
  // Show first card
  showNextCard();
  
  swipeUIActive = true;
}

// Function to create individual card with animations
function createCard(connection) {
  // Create a default profile image if none exists
  const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiBmaWxsPSIjZjNmNGY2Ii8+CjxjaXJjbGUgY3g9IjYwIiBjeT0iNDAiIHI9IjIwIiBmaWxsPSIjYzNjNGM3Ii8+CjxwYXRoIGQ9Im0yNSA5MCA2Ny41LTE1IDcsNSAtNjcuNSwxNXoiIGZpbGw9IiNjM2M0YzciLz4KPC9zdmc+';
  
  // Safely get values with fallbacks
  const safeName = connection.name || 'Unknown User';
  const safeProfileUrl = connection.profileUrl || '';
  const safeTagline = connection.tagline || 'No additional information available';
  const safeMutualConnections = connection.mutualConnections || 'No mutual connections';
  const safeProfileImage = connection.profileImage || defaultAvatar;
  
  // Create profile name HTML with optional link
  const profileNameHTML = safeProfileUrl 
    ? `<a href="${safeProfileUrl}" target="_blank" rel="noopener noreferrer">${safeName}</a>`
    : safeName;
  
  // Create card element
  const cardDiv = document.createElement('div');
  cardDiv.className = 'swipe-card';
  cardDiv.innerHTML = `
    <div class="action-overlay ignore">IGNORE</div>
    <div class="action-overlay accept">ACCEPT</div>
    <div class="action-overlay skip">SKIP</div>
    <div class="card-header">
      <img src="${safeProfileImage}" 
           alt="${safeName}" 
           class="profile-image">
    </div>
    <div class="card-body">
      <h2 class="profile-name">${profileNameHTML}</h2>
      <div class="mutual-connections">
        ${safeMutualConnections}
      </div>
      <p class="profile-tagline">${safeTagline}</p>
    </div>
    <div class="card-actions">
      <button class="action-btn ignore-btn" data-action="ignore">✖️ IGNORE</button>
      <button class="action-btn skip-btn" data-action="skip">⏭️ SKIP</button>
      <button class="action-btn accept-btn" data-action="accept">✅ ACCEPT</button>
    </div>
  `;
  
  // Store the connection data reference on the card element for reliable access during actions
  cardDiv._connectionData = connection;
  
  // Add event listeners for the buttons
  const ignoreBtn = cardDiv.querySelector('.ignore-btn');
  const acceptBtn = cardDiv.querySelector('.accept-btn');
  const skipBtn = cardDiv.querySelector('.skip-btn');
  const profileImg = cardDiv.querySelector('.profile-image');
  
  // Handle image error
  profileImg.onerror = function() {
    this.src = defaultAvatar;
  };
  
  // Add click event listeners with directional fly-out animations
  ignoreBtn.addEventListener('click', () => {
    if (swipeActionInProgress) return;
    swipeActionInProgress = true;
    
    // Show overlay
    const overlay = cardDiv.querySelector('.action-overlay.ignore');
    if (overlay) {
      overlay.classList.add('show');
      overlay.style.opacity = '1';
    }
    
    // Ensure the current card is on top during animation
    cardDiv.style.zIndex = '1002';
    cardDiv.classList.add('exiting');
    
    // Apply fly-out left animation using CSS animation
    cardDiv.style.animation = 'cardExitLeft 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
    
    // Execute action and rebuild after animation
    setTimeout(() => {
      swipeIgnore(connection);
      if (cardDiv.parentNode) cardDiv.remove();
      rebuildCardStack();
      swipeActionInProgress = false;
    }, 400);
  });
  
  acceptBtn.addEventListener('click', () => {
    if (swipeActionInProgress) return;
    swipeActionInProgress = true;
    
    // Show overlay
    const overlay = cardDiv.querySelector('.action-overlay.accept');
    if (overlay) {
      overlay.classList.add('show');
      overlay.style.opacity = '1';
    }
    
    // Ensure the current card is on top during animation
    cardDiv.style.zIndex = '1002';
    cardDiv.classList.add('exiting');
    
    // Apply fly-out right animation using CSS animation
    cardDiv.style.animation = 'cardExitRight 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
    
    // Execute action and rebuild after animation
    setTimeout(() => {
      swipeAccept(connection);
      if (cardDiv.parentNode) cardDiv.remove();
      rebuildCardStack();
      swipeActionInProgress = false;
    }, 400);
  });
  
  skipBtn.addEventListener('click', () => {
    if (swipeActionInProgress) return;
    swipeActionInProgress = true;
    
    // Show overlay
    const overlay = cardDiv.querySelector('.action-overlay.skip');
    if (overlay) {
      overlay.classList.add('show');
      overlay.style.opacity = '1';
    }
    
    // Ensure the current card is on top during animation
    cardDiv.style.zIndex = '1002';
    cardDiv.classList.add('exiting');
    
    // Apply fly-out down animation using CSS animation
    cardDiv.style.animation = 'cardExitDown 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';
    
    // Execute action and rebuild after animation
    setTimeout(() => {
      swipeSkip(connection);
      if (cardDiv.parentNode) cardDiv.remove();
      rebuildCardStack();
      swipeActionInProgress = false;
    }, 400);
  });
  
  // Add swipe gesture support
  addSwipeGestures(cardDiv);
  
  return cardDiv;
}

// Function to rebuild the card stack after an action
function rebuildCardStack() {
  const cardContainer = document.getElementById('card-container');
  
  // Remove any exited/old current cards first
  const exitedCards = cardContainer.querySelectorAll('.current-card.exiting, .current-card:not(.promoting)');
  exitedCards.forEach(card => card.remove());
  
  // Check if we have more cards to show
  if (currentCardIndex >= allConnections.length) {
    showNoMoreCards();
    return;
  }
  
  // Find existing next card if available
  const existingNextCard = cardContainer.querySelector('.next-card:not(.hidden-preload)');
  
  if (existingNextCard) {
    // Promote the existing next card to current
    existingNextCard.classList.remove('next-card');
    existingNextCard.classList.add('current-card', 'promoting');
    existingNextCard.style.zIndex = '1000';
    existingNextCard.style.pointerEvents = 'auto';
    
    // Only promote the first hidden preload card to become the new next card
    const firstHiddenCard = cardContainer.querySelector('.hidden-preload');
    if (firstHiddenCard) {
      // First, prepare the card for transition by making it visible but keeping it in hidden position
      firstHiddenCard.style.visibility = 'visible';
      firstHiddenCard.style.opacity = '0';
      firstHiddenCard.style.transform = 'scale(0.85) translateY(40px)';
      
      // Use a small delay to ensure the current card promotion starts first
      setTimeout(() => {
        firstHiddenCard.classList.remove('hidden-preload');
        firstHiddenCard.style.zIndex = '999';
        // Smoothly transition to next-card position
        firstHiddenCard.style.transition = 'all 0.4s ease-out';
        firstHiddenCard.style.opacity = '0.7';
        firstHiddenCard.style.transform = 'scale(0.95) translateY(20px)';
      }, 150); // Small delay to prevent flash
      // Note: it should already have 'next-card' class
    }
  } else {
    // If no existing next card, create current card normally (fallback)
    const currentConnection = allConnections[currentCardIndex];
    const currentCard = createCard(currentConnection);
    currentCard.classList.add('current-card');
    currentCard.style.zIndex = '1000';
    cardContainer.appendChild(currentCard);
  }
  
  // Create new next card if available and we don't already have enough
  const existingNextCards = cardContainer.querySelectorAll('.next-card');
  if (currentCardIndex + 1 < allConnections.length && existingNextCards.length === 0) {
    const nextConnection = allConnections[currentCardIndex + 1];
    const nextCard = createCard(nextConnection);
    nextCard.classList.add('next-card');
    nextCard.style.zIndex = '999';
    cardContainer.appendChild(nextCard);
  }
  
  // Create and add third card if available (hidden preload) and we don't already have it
  const existingHiddenCards = cardContainer.querySelectorAll('.hidden-preload');
  if (currentCardIndex + 2 < allConnections.length && existingHiddenCards.length === 0) {
    const thirdConnection = allConnections[currentCardIndex + 2];
    const thirdCard = createCard(thirdConnection);
    thirdCard.classList.add('next-card', 'hidden-preload');
    thirdCard.style.visibility = 'hidden';
    thirdCard.style.opacity = '0';
    thirdCard.style.zIndex = '998';
    cardContainer.appendChild(thirdCard);
  }
  
  console.log(`LinkedIn PowerToys: Rebuilt card stack - showing card ${currentCardIndex + 1} of ${allConnections.length}`);
}

// Function to handle skip action  
function swipeSkip(connection) {
  // If no connection passed, use current index (fallback for compatibility)
  if (!connection) {
    connection = allConnections[currentCardIndex];
  }
  
  console.log(`Skipped: ${connection.name}`);
  
  // Just move to next card without taking any action on LinkedIn
  currentCardIndex++;
  
  // Check if we need to load more connections
  checkAndLoadMoreConnections();
}

// Function to handle ignore action
function swipeIgnore(connection) {
  // If no connection passed, use current index (fallback for compatibility)
  if (!connection) {
    connection = allConnections[currentCardIndex];
  }
  
  console.log(`Ignored: ${connection.name}`);
  
  // Click the actual LinkedIn ignore button
  if (connection.ignoreButton) {
    console.log('Clicking ignore button...');
    
    try {
      connection.ignoreButton.click();
      
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1
      });
      connection.ignoreButton.dispatchEvent(clickEvent);
      
      console.log('Ignore button clicked successfully');
    } catch (error) {
      console.error('Error clicking ignore button:', error);
    }
  }
  
  currentCardIndex++;
  
  // Check if we need to load more connections
  checkAndLoadMoreConnections();
}

// Function to handle accept action
function swipeAccept(connection) {
  // If no connection passed, use current index (fallback for compatibility)
  if (!connection) {
    connection = allConnections[currentCardIndex];
  }
  
  console.log(`Accepted: ${connection.name}`);
  
  // Click the actual LinkedIn accept button
  if (connection.acceptButton) {
    console.log('Clicking accept button...');
    
    try {
      connection.acceptButton.click();
      
      const clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1
      });
      connection.acceptButton.dispatchEvent(clickEvent);
      
      console.log('Accept button clicked successfully');
    } catch (error) {
      console.error('Error clicking accept button:', error);
    }
  }
  
  currentCardIndex++;
  
  // Check if we need to load more connections
  checkAndLoadMoreConnections();
}

// Function to show "no more cards" message
function showNoMoreCards() {
  const cardContainer = document.getElementById('card-container');
  
  // Check one more time if background loading added new connections
  if (currentCardIndex < allConnections.length) {
    // If new connections were added, show next card instead
    showNextCard();
    return;
  }
  
  // If we're currently loading more connections, show a loading state instead of blank screen
  if (loadingMoreConnections) {
    console.log('Still loading more connections, showing loading state...');
    showLoadingState();
    
    // Check again after a delay to see if more connections loaded
    setTimeout(() => {
      if (currentCardIndex < allConnections.length) {
        // New connections loaded, show next card
        showNextCard();
      } else if (!loadingMoreConnections) {
        // Loading finished but no new connections, show final message
        showFinalNoMoreCards();
      } else {
        // Still loading, check again
        showNoMoreCards();
      }
    }, 2000);
    return;
  }
  
  // If we reach here, we're truly done
  showFinalNoMoreCards();
}

// Function to show loading state while more cards are being loaded
function showLoadingState() {
  const cardContainer = document.getElementById('card-container');
  
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading-state';
  loadingDiv.innerHTML = `
    <div class="loading-animation">
      <div class="loading-spinner"></div>
    </div>
    <h2>Loading more connections...</h2>
    <p>Finding more connection requests for you to review</p>
  `;
  
  cardContainer.innerHTML = '';
  cardContainer.appendChild(loadingDiv);
}

// Function to show final "no more cards" message
function showFinalNoMoreCards() {
  const cardContainer = document.getElementById('card-container');
  
  const noMoreDiv = document.createElement('div');
  noMoreDiv.className = 'no-more-cards';
  noMoreDiv.innerHTML = `
    <h2>🎉</h2>
    <p>All done! You've reviewed all your connection requests!</p>
    <p style="font-size: 16px; margin-top: 20px; opacity: 0.8;">Refresh the page to load more if available</p>
  `;
  
  cardContainer.innerHTML = '';
  cardContainer.appendChild(noMoreDiv);
}

// Function to show next card
function showNextCard() {
  const cardContainer = document.getElementById('card-container');
  
  // Check if we need to load more connections
  checkAndLoadMoreConnections();
  
  if (currentCardIndex >= allConnections.length) {
    // No more cards available, show loading or completion message
    showNoMoreCards();
    return;
  }
  
  // Clear container first
  cardContainer.innerHTML = '';
  
  // Show current card with smooth entrance animation
  const connection = allConnections[currentCardIndex];
  const cardElement = createCard(connection);
  cardElement.classList.add('current-card');
  
  // Set initial state for entrance animation
  cardElement.style.opacity = '0';
  cardElement.style.transform = 'scale(0.8) translateY(50px)';
  cardElement.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  cardContainer.appendChild(cardElement);
  
  // Always preload next card (if exists) for smooth swiping
  if (currentCardIndex + 1 < allConnections.length) {
    const nextConnection = allConnections[currentCardIndex + 1];
    const nextCardElement = createCard(nextConnection);
    nextCardElement.classList.add('next-card');
    cardContainer.appendChild(nextCardElement);
  }
  
  // Also preload the card after next (if exists) to ensure smooth experience
  if (currentCardIndex + 2 < allConnections.length) {
    const afterNextConnection = allConnections[currentCardIndex + 2];
    const afterNextCardElement = createCard(afterNextConnection);
    afterNextCardElement.classList.add('next-card', 'hidden-preload');
    afterNextCardElement.style.visibility = 'hidden'; // Hide this extra preload card
    afterNextCardElement.style.opacity = '0';
    cardContainer.appendChild(afterNextCardElement);
  }
  
  // Trigger entrance animation after DOM is ready
  requestAnimationFrame(() => {
    cardElement.style.opacity = '1';
    cardElement.style.transform = 'scale(1) translateY(0px)';
  });
  
  console.log(`LinkedIn PowerToys: Showing card ${currentCardIndex + 1} of ${allConnections.length}`);
}

// Function to exit Swipe mode
function exitSwipeMode() {
  const container = document.getElementById('swipe-container');
  if (container) {
    container.remove();
  }
  
  const styles = document.getElementById('swipe-styles');
  if (styles) {
    styles.remove();
  }
  
  // Restore fire button to original state
  if (fireButton) {
    fireButton.textContent = '🔥';
    fireButton.title = 'Start LinkedIn Swipe Mode';
    fireButton.disabled = false;
    fireButton.style.cursor = 'pointer';
    fireButton.style.opacity = '1';
    fireButton.style.background = 'transparent';
  }
  
  // Show filter tabs
  showFilterTabs();
  
  // Reset swipe state variables
  swipeUIActive = false;
  swipeActionInProgress = false;
  
  console.log('LinkedIn PowerToys: Exited Swipe mode, UI restored');
}

// Function to hide only the invitation list section, not the entire page
function hideOriginalLinkedInUI() {
  // Target specifically the invitation list container, not the entire page
  const selectors = [
    // The main invitations list container from the HTML structure
    'div._609562f9[componentkey="InvitationManagerPage_InvitationsList"]',
    // The container that holds all individual invitation cards
    'div.d18644b1._609562f9._8cce9d30._21be59f4._00c51bf4._46a023aa._07d49d46',
    // Fallback to the role="main" section that contains the invitation list
    'div[role="main"][data-sdui-screen*="InvitationReceived"]',
    // More specific container that holds the invitation cards
    'div._87cd2124._472fd2a9._6cb2e7c3.eb673e58',
    // General invitation list container
    'div[componentkey*="InvitationsList"]'
  ];
  
  let hidden = false;
  let hiddenContainer = null;
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(`Hiding invitation section with selector: ${selector}`);
      elements.forEach(element => {
        element.style.display = 'none';
        hiddenContainer = element;
        hidden = true;
      });
      break; // Only hide the first matching section
    }
  }
  
  if (!hidden) {
    console.log('Could not find invitation section, trying to find it by content');
    
    // Look for the section containing "Manage invitations" text
    const manageInvitationsElements = document.querySelectorAll('p');
    for (const element of manageInvitationsElements) {
      if (element.textContent.includes('Manage invitations')) {
        // Find the parent container that holds the entire invitation management section
        let parent = element.parentElement;
        let attempts = 0;
        while (parent && attempts < 8) {
          // Look for a container that likely holds the invitation list
          const hasInvitations = parent.querySelectorAll('button[aria-label*="Accept"], button[aria-label*="Ignore"]').length > 0;
          if (hasInvitations && parent.classList.length > 3) {
            console.log('Found invitation section by traversing from "Manage invitations" text');
            parent.style.display = 'none';
            hiddenContainer = parent;
            hidden = true;
            break;
          }
          parent = parent.parentElement;
          attempts++;
        }
        break;
      }
    }
  }
  
  // Store reference to hidden container for restoration
  if (hiddenContainer) {
    window.swipeHiddenContainer = hiddenContainer;
  }
  
  if (!hidden) {
    console.log('Could not find specific invitation section to hide');
  }
}

// Function to insert Swipe UI as overlay
function insertSwipeUIIntoLinkedIn(container) {
  // Simply append to body as a full-screen overlay
  document.body.appendChild(container);
  console.log('LinkedIn PowerToys: Swipe UI inserted as overlay');
}

// Function to restore original LinkedIn UI when exiting Swipe mode
function showOriginalLinkedInUI() {
  const selectors = [
    'div._609562f9[componentkey="InvitationManagerPage_InvitationsList"]',
    'div.d18644b1._609562f9._8cce9d30._21be59f4._00c51bf4._46a023aa._07d49d46',
    'div[role="main"][data-sdui-screen*="InvitationReceived"]',
    'div._87cd2124._472fd2a9._6cb2e7c3.eb673e58',
    'div[componentkey*="InvitationsList"]'
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      elements.forEach(element => {
        element.style.display = '';
      });
    }
  }
  
  // Also restore the specific hidden container if we have a reference
  if (window.swipeHiddenContainer) {
    window.swipeHiddenContainer.style.display = '';
    delete window.swipeHiddenContainer;
  }
}

// Start auto-scrolling if we're on the right page
if (window.location.href.includes('linkedin.com/mynetwork/invitation-manager/received')) {
  console.log('LinkedIn PowerToys: Detected invitation manager page');
  console.log('Current URL:', window.location.href);
  
  // Wait for page to load and inject fire button
  setTimeout(() => {
    injectFireButton();
  }, 2000);
  
  // Also try again after a longer delay in case the page loads slowly
  setTimeout(() => {
    if (!document.getElementById('linkedin-swipe-btn')) {
      injectFireButton();
    }
  }, 5000);
}

// Function to add swipe gesture support
function addSwipeGestures(cardElement) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;
  let initialTransform = '';
  
  const actionThreshold = 120; // Distance required to trigger action (80% of maxDistance)
  const maxDistance = 150; // Maximum distance card can move
  const overlayThreshold = 100; // Distance required to show action overlay (80% of actionThreshold)
  const rotationFactor = 0.1; // How much the card rotates during drag
  
  console.log('LinkedIn PowerToys: Adding swipe gestures to card');
  
  // Mouse/Touch start event
  function handleStart(e) {
    // Don't interfere with links or buttons
    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    
    console.log('LinkedIn PowerToys: Swipe gesture started');
    isDragging = true;
    cardElement.classList.add('dragging');
    
    const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
    const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
    
    startX = clientX;
    startY = clientY;
    currentX = clientX;
    currentY = clientY;
    
    // Store the initial transform to reset to if needed
    initialTransform = cardElement.style.transform || '';
    
    // Remove transitions for immediate response during drag
    cardElement.style.setProperty('transition', 'none', 'important');
    cardElement.style.cursor = 'grabbing';
    
    // Ensure the card can be transformed
    cardElement.style.position = 'absolute';
    cardElement.style.zIndex = '1001';
    
    // Hide all overlays initially
    const overlays = cardElement.querySelectorAll('.action-overlay');
    overlays.forEach(overlay => {
      overlay.classList.remove('show');
      overlay.style.opacity = '0';
    });
    
    console.log('LinkedIn PowerToys: Drag setup complete, startX:', startX, 'startY:', startY);
    
    e.preventDefault();
  }
  
  // Mouse/Touch move event
  function handleMove(e) {
    if (!isDragging) return;
    
    const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
    const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
    
    currentX = clientX;
    currentY = clientY;
    
    let deltaX = currentX - startX;
    let deltaY = currentY - startY;
    
    // Restrict movement to maximum distance for smoother experience
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > maxDistance) {
      const scale = maxDistance / distance;
      deltaX *= scale;
      deltaY *= scale;
    }
    
    // Calculate rotation based on horizontal movement (restricted)
    const rotation = Math.max(-15, Math.min(15, deltaX * rotationFactor));
    
    // Apply smooth transform with immediate movement
    cardElement.style.setProperty('transition', 'none', 'important');
    const transformValue = `translate(${deltaX}px, ${deltaY}px) rotate(${rotation}deg)`;
    cardElement.style.setProperty('transform', transformValue, 'important');
    
    // Hide all overlays initially
    const overlays = cardElement.querySelectorAll('.action-overlay');
    overlays.forEach(overlay => {
      overlay.classList.remove('show');
      overlay.style.opacity = '0';
    });
    
    // Show overlay only when card is dragged 80% of the way (overlayThreshold)
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    if (absX > absY && absX > overlayThreshold) {
      // Horizontal swipe - show overlay only after 80% threshold
      if (deltaX > 0) {
        // Swipe right - Accept
        const acceptOverlay = cardElement.querySelector('.action-overlay.accept');
        if (acceptOverlay) {
          acceptOverlay.classList.add('show');
          // Full opacity once threshold is reached
          acceptOverlay.style.opacity = '0.9';
        }
      } else {
        // Swipe left - Ignore
        const ignoreOverlay = cardElement.querySelector('.action-overlay.ignore');
        if (ignoreOverlay) {
          ignoreOverlay.classList.add('show');
          // Full opacity once threshold is reached
          ignoreOverlay.style.opacity = '0.9';
        }
      }
    } else if (deltaY > overlayThreshold && absY > absX) {
      // Swipe down - Skip (only show overlay after 80% threshold)
      const skipOverlay = cardElement.querySelector('.action-overlay.skip');
      if (skipOverlay) {
        skipOverlay.classList.add('show');
        // Full opacity once threshold is reached
        skipOverlay.style.opacity = '0.9';
      }
    }
    
    e.preventDefault();
  }
  
  // Mouse/Touch end event
  function handleEnd(e) {
    if (!isDragging) return;
    
    // Prevent triggering action if one is already in progress
    if (swipeActionInProgress) {
      console.log('LinkedIn PowerToys: Swipe action already in progress, ignoring gesture');
      isDragging = false;
      cardElement.classList.remove('dragging');
      return;
    }
    
    console.log('LinkedIn PowerToys: Swipe gesture ended');
    isDragging = false;
    cardElement.classList.remove('dragging');
    cardElement.style.cursor = 'grab';
    
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    console.log(`LinkedIn PowerToys: Swipe delta - X: ${deltaX}, Y: ${deltaY}, actionThreshold: ${actionThreshold}`);
    
    // Check if action threshold was met for triggering action
    let shouldTriggerAction = false;
    let actionType = '';
    
    if (absX > absY) {
      // Horizontal movement is dominant
      if (absX > actionThreshold) {
        shouldTriggerAction = true;
        actionType = deltaX > 0 ? 'accept' : 'ignore';
      }
    } else if (deltaY > actionThreshold) {
      // Vertical movement (down only for skip)
      shouldTriggerAction = true;
      actionType = 'skip';
    }
    
    if (shouldTriggerAction) {
      // Prevent multiple simultaneous actions
      if (swipeActionInProgress) {
        console.log('LinkedIn PowerToys: Action already in progress, ignoring gesture');
        return;
      }
      
      swipeActionInProgress = true;
      
      // Get the connection data from the card element to ensure correct action target
      const connection = cardElement._connectionData;
      
      console.log(`LinkedIn PowerToys: Triggering ${actionType} action for ${connection ? connection.name : 'unknown'}`);
      
      // Show the action overlay
      const overlay = cardElement.querySelector(`.action-overlay.${actionType}`);
      if (overlay) {
        overlay.classList.add('show');
        overlay.style.opacity = '1';
      }
      
      // Ensure the current card is on top during animation
      cardElement.style.zIndex = '1002';
      
      // Determine final position for animation
      let finalX = 0, finalY = 0, finalRotation = 0;
      
      if (actionType === 'ignore') {
        finalX = -500;
        finalRotation = -20;
      } else if (actionType === 'accept') {
        finalX = 500;
        finalRotation = 20;
      } else if (actionType === 'skip') {
        finalY = 400;
        finalRotation = 5;
      }
      
      // Apply faster fade-out animation
      cardElement.style.setProperty('transition', 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)', 'important');
      cardElement.style.setProperty('transform', `translate(${finalX}px, ${finalY}px) rotate(${finalRotation}deg) scale(0.8)`, 'important');
      cardElement.style.setProperty('opacity', '0', 'important');
      cardElement.classList.add('exiting');
      
      // Execute action and rebuild after animation
      setTimeout(() => {
        // Execute the action
        if (actionType === 'accept') {
          swipeAccept(connection);
        } else if (actionType === 'ignore') {
          swipeIgnore(connection);
        } else if (actionType === 'skip') {
          swipeSkip(connection);
        }
        
        // Remove the animated card
        if (cardElement.parentNode) {
          cardElement.remove();
        }
        
        // Rebuild the card stack
        rebuildCardStack();
        
        // Reset the action flag
        swipeActionInProgress = false;
      }, 400);
      
      return;
    }
    
    // If user dragged significantly but didn't reach threshold, auto-complete the gesture
    const minimumDrag = 40; // Minimum drag distance to trigger auto-complete
    
    if (absX > minimumDrag || absY > minimumDrag) {
      // Determine which direction to auto-complete based on drag direction
      let autoActionType = '';
      
      if (absX > absY) {
        // Horizontal movement - complete swipe left or right
        autoActionType = deltaX > 0 ? 'accept' : 'ignore';
      } else if (deltaY > minimumDrag) {
        // Vertical movement down - complete skip
        autoActionType = 'skip';
      }
      
      if (autoActionType) {
        console.log(`LinkedIn PowerToys: Auto-completing ${autoActionType} gesture`);
        
        // Get the connection data from the card element to ensure correct action target
        const connection = cardElement._connectionData;
        
        // Prevent multiple simultaneous actions
        if (swipeActionInProgress) {
          console.log('LinkedIn PowerToys: Action already in progress, ignoring auto-complete');
          return;
        }
        
        swipeActionInProgress = true;
        
        // Show overlay for auto-completed action
        const overlay = cardElement.querySelector(`.action-overlay.${autoActionType}`);
        if (overlay) {
          overlay.classList.add('show');
          overlay.style.opacity = '1';
        }
        
        // Ensure the current card is on top during animation
        cardElement.style.zIndex = '1002';
        
        // Determine final position for animation
        let finalX = 0, finalY = 0, finalRotation = 0;
        
        if (autoActionType === 'ignore') {
          finalX = -500;
          finalRotation = -20;
        } else if (autoActionType === 'accept') {
          finalX = 500;
          finalRotation = 20;
        } else if (autoActionType === 'skip') {
          finalY = 400;
          finalRotation = 5;
        }
        
        // Apply faster fade-out animation
        cardElement.style.setProperty('transition', 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)', 'important');
        cardElement.style.setProperty('transform', `translate(${finalX}px, ${finalY}px) rotate(${finalRotation}deg) scale(0.8)`, 'important');
        cardElement.style.setProperty('opacity', '0', 'important');
        cardElement.classList.add('exiting');
        
        // Execute action and rebuild after animation
        setTimeout(() => {
          // Execute the action
          if (autoActionType === 'accept') {
            swipeAccept(connection);
          } else if (autoActionType === 'ignore') {
            swipeIgnore(connection);
          } else if (autoActionType === 'skip') {
            swipeSkip(connection);
          }
          
          // Remove the animated card
          if (cardElement.parentNode) {
            cardElement.remove();
          }
          
          // Rebuild the card stack
          rebuildCardStack();
          
          // Reset the action flag
          swipeActionInProgress = false;
        }, 400);
        return;
      }
    }
    
    // Reset card position smoothly if threshold not met and drag was minimal
    console.log('LinkedIn PowerToys: Resetting card position - minimal drag');
    
    // Restore smooth transition for reset
    cardElement.style.setProperty('transition', 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)', 'important');
    cardElement.style.setProperty('transform', 'translate(0px, 0px) rotate(0deg)', 'important');
    cardElement.style.position = 'absolute';
    cardElement.style.zIndex = '1000';
    
    // Hide all overlays with smooth fade out
    const overlays = cardElement.querySelectorAll('.action-overlay');
    overlays.forEach(overlay => {
      overlay.style.transition = 'opacity 0.4s ease-out';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.classList.remove('show');
      }, 400);
    });
    
    // Restore default styles after animation completes
    setTimeout(() => {
      if (cardElement && !cardElement.classList.contains('dragging')) {
        cardElement.style.setProperty('transition', 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)');
        cardElement.style.cursor = 'grab';
      }
    }, 500);
    
    e.preventDefault();
  }
  
  // Add mouse event listeners
  cardElement.addEventListener('mousedown', handleStart, { passive: false });
  document.addEventListener('mousemove', handleMove, { passive: false });
  document.addEventListener('mouseup', handleEnd, { passive: false });
  
  // Add touch event listeners with better support
  cardElement.addEventListener('touchstart', handleStart, { passive: false });
  document.addEventListener('touchmove', handleMove, { passive: false });
  document.addEventListener('touchend', handleEnd, { passive: false });
  document.addEventListener('touchcancel', handleEnd, { passive: false });
  
  // Prevent default touch behaviors on the card element
  cardElement.style.touchAction = 'none';
  cardElement.style.userSelect = 'none';
  cardElement.style.webkitUserSelect = 'none';
  
  // Clean up function (store reference for potential cleanup)
  cardElement._swipeCleanup = () => {
    document.removeEventListener('mousemove', handleMove);
    document.removeEventListener('mouseup', handleEnd);
    document.removeEventListener('touchmove', handleMove);
    document.removeEventListener('touchend', handleEnd);
    document.removeEventListener('touchcancel', handleEnd);
  };
}
