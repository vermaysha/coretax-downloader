console.log('Coretax Scraper: Background service worker started');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background: Received message:', message.action);
  
  if (message.action === 'scrapingComplete') {
    console.log('Background: Saving scraped data to storage...');
    
    chrome.storage.local.set({
      scrapedData: message.data,
      lastScrapedTime: new Date().toISOString(),
      scrapingInProgress: false,
      scrapingStartTime: null
    }, () => {
      console.log('Background: Data saved to storage,', message.data.length, 'records');
      console.log('Background: Scraping state cleared');
      
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Background: Popup not open, but data saved to storage');
        } else {
          console.log('Background: Message relayed to popup');
        }
      });
    });
    
    sendResponse({ relayed: true, saved: true });
  } 
  else if (message.action === 'scrapingError') {
    chrome.storage.local.set({
      scrapingInProgress: false,
      scrapingStartTime: null
    }, () => {
      console.log('Background: Scraping state cleared (error)');
    });
    

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Background: Popup not open, error not relayed');
      } else {
        console.log('Background: Error relayed to popup');
      }
    });
    
    sendResponse({ relayed: true });
  }
  else if (message.action === 'scrapingProgress') {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
      } else {
        console.log('Background: Progress relayed to popup');
      }
    });
    
    sendResponse({ relayed: true });
  }
  
  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Coretax Scraper: Extension installed');
  } else if (details.reason === 'update') {
    console.log('Coretax Scraper: Extension updated to version', chrome.runtime.getManifest().version);
  }
});

chrome.action.onClicked.addListener((tab) => {
  console.log('Background: Extension icon clicked on tab:', tab.id);
  // Add custom logic here if needed
});
