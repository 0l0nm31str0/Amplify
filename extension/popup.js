// Amplify Extension Popup Script
const DASHBOARD_URL = 'https://28bc5347-71d7-42a5-9c82-4860713f9f76.preview.emergentagent.com';

document.addEventListener('DOMContentLoaded', async () => {
  const statusElement = document.getElementById('status');
  const setupBtn = document.getElementById('setup-btn');
  const pageStatus = document.getElementById('page-status');

  // Check if we're on a YouTube page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab.url && tab.url.includes('youtube.com/watch')) {
    pageStatus.textContent = 'Amplify button should appear on this YouTube video';
    statusElement.textContent = 'Active on YouTube';
    statusElement.style.color = '#22c55e';
  } else {
    pageStatus.textContent = 'Visit a YouTube video to see the Amplify button';
    statusElement.textContent = 'Standby';
    statusElement.style.color = '#fbbf24';
  }

  // Setup button click handler
  setupBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: DASHBOARD_URL });
    window.close();
  });

  // Check extension permissions
  try {
    const hasPermissions = await chrome.permissions.contains({
      origins: ['https://*.youtube.com/*']
    });
    
    if (!hasPermissions) {
      statusElement.textContent = 'Permissions needed';
      statusElement.style.color = '#ef4444';
      setupBtn.textContent = 'Grant Permissions';
      setupBtn.onclick = () => {
        chrome.permissions.request({
          origins: ['https://*.youtube.com/*']
        });
      };
    }
  } catch (error) {
    console.error('Permission check failed:', error);
  }
});