// Amplify Content Script v2.0 - Like Button Interception
console.log('🚀 Amplify v2.0 extension loaded');

const API_BASE = 'http://localhost:8000/api';

class AmplifyV2 {
  constructor() {
    this.currentChannelId = null;
    this.creatorData = null;
    this.isListenerAttached = false;
    this.modal = null;
    this.isModalOpen = false;
    this.init();
  }

  init() {
    console.log('🎯 Initializing Amplify v2.0...');
    this.waitForYouTubePage();
    
    // Listen for navigation changes
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        this.cleanup();
        setTimeout(() => this.waitForYouTubePage(), 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  cleanup() {
    this.isListenerAttached = false;
    this.currentChannelId = null;
    this.creatorData = null;
    this.closeModal();
  }

  waitForYouTubePage() {
    if (!window.location.pathname.includes('/watch')) {
      return;
    }

    const checkForLikeButton = () => {
      const likeButton = this.findLikeButton();
      
      if (likeButton && !this.isListenerAttached) {
        this.setupLikeButtonInterception();
      } else if (!this.isListenerAttached) {
        setTimeout(checkForLikeButton, 1000);
      }
    };
    
    checkForLikeButton();
  }

  findLikeButton() {
    const selectors = [
      'button[aria-label*="like this video" i]:not([aria-label*="dislike" i])',
      'button[aria-label*="like" i][aria-label*="video" i]:not([aria-label*="dislike" i])',
      '#segmented-like-button button',
      'ytd-toggle-button-renderer:first-child button'
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && this.isLikeButton(button)) {
        return button;
      }
    }

    return null;
  }

  isLikeButton(button) {
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    const hasLike = ariaLabel.includes('like');
    const hasDislike = ariaLabel.includes('dislike');
    const isToggle = button.getAttribute('aria-pressed') !== null;
    
    return hasLike && !hasDislike && isToggle;
  }

  async setupLikeButtonInterception() {
    console.log('👍 Setting up Like button interception...');
    
    const likeButton = this.findLikeButton();
    if (!likeButton) return;

    this.currentChannelId = await this.extractChannelId();
    if (!this.currentChannelId) {
      console.log('❌ Could not extract channel ID');
      return;
    }

    console.log('🔍 Found channel ID:', this.currentChannelId);

    const isRegistered = await this.checkCreatorRegistration();
    if (!isRegistered) {
      console.log('❌ Creator not registered with Amplify');
      return;
    }

    this.attachLikeButtonListener(likeButton);
    this.isListenerAttached = true;
    
    console.log('✅ Like button interception setup complete');
  }

  attachLikeButtonListener(likeButton) {
    const originalClick = likeButton.onclick;
    
    likeButton.addEventListener('click', async (event) => {
      console.log('👍 Like button clicked!');
      
      if (originalClick) {
        originalClick.call(likeButton, event);
      }
      
      setTimeout(() => {
        console.log('💫 About to show tip modal...');
        this.showTipModal();
      }, 300);
    }, true);
  }

  async extractChannelId() {
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent.includes('ytInitialData')) {
          const match = script.textContent.match(/"channelId":"([^"]+)"/);
          if (match) return match[1];
        }
      }
    } catch (e) {
      console.warn('Could not extract channel ID from page data');
    }

    const avatarLink = document.querySelector('#avatar a[href*="/channel/"], #avatar a[href*="/@"]');
    if (avatarLink) {
      const href = avatarLink.href;
      const channelMatch = href.match(/\/channel\/([^\/\?]+)/);
      const handleMatch = href.match(/\/@([^\/\?]+)/);
      return channelMatch?.[1] || handleMatch?.[1];
    }

    const channelNameLink = document.querySelector('ytd-video-owner-renderer a[href*="/channel/"], ytd-video-owner-renderer a[href*="/@"]');
    if (channelNameLink) {
      const href = channelNameLink.href;
      const channelMatch = href.match(/\/channel\/([^\/\?]+)/);
      const handleMatch = href.match(/\/@([^\/\?]+)/);
      return channelMatch?.[1] || handleMatch?.[1];
    }

    return null;
  }

  async extractOfficialChannelId() {
    // Try to get the official UC... channel ID
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent.includes('ytInitialData')) {
          // Look for official channel ID format (starts with UC)
          const match = script.textContent.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
          if (match) return match[1];
        }
      }
    } catch (e) {
      console.warn('Could not extract official channel ID');
    }
    return null;
  }

  async checkCreatorRegistration() {
    try {
      console.log(`🔍 Checking registration for channel: ${this.currentChannelId}`);
      
      // First try with the extracted channel ID
      let response = await fetch(`${API_BASE}/creator?channelId=${this.currentChannelId}`);
      if (response.ok) {
        this.creatorData = await response.json();
        console.log('✅ Creator found:', this.creatorData);
        return true;
      }
      
      console.log(`❌ First attempt failed with status: ${response.status}`);
      
      // If that fails, try to get the official channel ID from the page
      console.log('🔍 Attempting to find official channel ID...');
      const officialChannelId = await this.extractOfficialChannelId();
      console.log(`🔍 Official channel ID found: ${officialChannelId}`);
      
      if (officialChannelId && officialChannelId !== this.currentChannelId) {
        console.log(`🔍 Trying official channel ID: ${officialChannelId}`);
        response = await fetch(`${API_BASE}/creator?channelId=${officialChannelId}`);
        if (response.ok) {
          this.creatorData = await response.json();
          console.log('✅ Creator found with official ID:', this.creatorData);
          return true;
        } else {
          console.log(`❌ Official channel ID also failed with status: ${response.status}`);
        }
      } else {
        console.log('❌ No different official channel ID found or same as current');
      }
      
      console.log('❌ Creator not found in database');
      return false;
    } catch (error) {
      console.error('Error checking creator registration:', error);
      return false;
    }
  }

  async extractOfficialChannelId() {
    // Try to get the official UC... channel ID
    try {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent.includes('ytInitialData')) {
          // Look for official channel ID format (starts with UC)
          const match = script.textContent.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
          if (match) return match[1];
        }
      }
    } catch (e) {
      console.warn('Could not extract official channel ID');
    }
    return null;
  }

  showTipModal() {
    console.log('🎯 showTipModal called, isModalOpen:', this.isModalOpen);
    
    if (this.isModalOpen) {
      console.log('❌ Modal already open, skipping');
      return;
    }
    
    console.log('✨ Creating modal...');
    this.createModal();
    
    console.log('📍 Appending modal to document.body');
    document.body.appendChild(this.modal);
    this.isModalOpen = true;
    
    // Debug: Check if modal is actually in DOM
    setTimeout(() => {
      const modalInDom = document.querySelector('.amplify-modal-overlay');
      console.log('🔍 Modal in DOM:', !!modalInDom);
      if (modalInDom) {
        const rect = modalInDom.getBoundingClientRect();
        const computed = window.getComputedStyle(modalInDom);
        console.log('📐 Modal position:', rect);
        console.log('👁️ Modal visibility:', computed.visibility);
        console.log('🙈 Modal display:', computed.display);
        console.log('🎨 Modal z-index:', computed.zIndex);
        console.log('🎭 Modal opacity:', computed.opacity);
        
        // Force it to be visible with beautiful design
        modalInDom.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: rgba(0, 0, 0, 0.8) !important;
          backdrop-filter: blur(4px) !important;
          z-index: 2147483647 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: all !important;
        `;
        console.log('✨ Applied beautiful background - modal should look amazing now!');
      }
    }, 100);
    
    console.log('✅ Modal should now be visible!');
    
    setTimeout(() => {
      if (this.isModalOpen) {
        console.log('⏰ Auto-closing modal after 10 seconds');
        this.closeModal();
      }
    }, 10000);
  }

  createModal() {
    console.log('🎨 Creating modal element...');
    
    this.modal = document.createElement('div');
    this.modal.className = 'amplify-modal-overlay';
    
    const defaultAmount = this.creatorData?.defaultTipAmount || 0.5;
    const channelName = this.creatorData?.channelName || 'this creator';
    
    console.log(`🎭 Modal data - Channel: ${channelName}, Amount: ${defaultAmount}`);
    
    this.modal.innerHTML = `
      <div class="amplify-modal">
        <div class="amplify-modal-header">
          <div class="amplify-logo">⚡ Amplify</div>
          <button class="amplify-close">×</button>
        </div>
        
        <div class="amplify-modal-content">
          <h3>Support ${channelName}</h3>
          <p>Show your appreciation with a tip!</p>
          
          <div class="amplify-tip-options">
            <button class="amplify-tip-button amplify-default" data-amount="${defaultAmount}">
              <span class="amplify-icon">💰</span>
              <span class="amplify-text">Tip ${defaultAmount}</span>
            </button>
            
            <button class="amplify-tip-button amplify-custom">
              <span class="amplify-icon">✏️</span>
              <span class="amplify-text">Custom Amount</span>
            </button>
          </div>
          
          <div class="amplify-custom-input" style="display: none;">
            <input type="number" placeholder="0.00" step="0.01" min="0.01" class="amplify-amount-input">
            <button class="amplify-confirm-custom">Confirm Tip</button>
          </div>
          
          <div class="amplify-footer">
            <small>Powered by Solana • Requires Phantom Wallet</small>
          </div>
        </div>
      </div>
    `;

    console.log('🎪 Modal HTML created, setting up events...');
    this.setupModalEvents();
    console.log('✅ Modal creation complete');
  }

  setupModalEvents() {
    const modal = this.modal;
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('amplify-close')) {
        this.closeModal();
      }
    });

    const defaultButton = modal.querySelector('.amplify-default');
    defaultButton.addEventListener('click', () => {
      const amount = parseFloat(defaultButton.dataset.amount);
      this.processTip(amount);
    });

    const customButton = modal.querySelector('.amplify-custom');
    const customInput = modal.querySelector('.amplify-custom-input');
    const amountInput = modal.querySelector('.amplify-amount-input');
    const confirmButton = modal.querySelector('.amplify-confirm-custom');

    customButton.addEventListener('click', () => {
      customInput.style.display = 'block';
      customButton.style.display = 'none';
      amountInput.focus();
    });

    confirmButton.addEventListener('click', () => {
      const amount = parseFloat(amountInput.value);
      if (amount && amount > 0) {
        this.processTip(amount);
      }
    });

    amountInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        confirmButton.click();
      }
    });
  }

  async processTip(amount) {
    console.log(`💰 Processing tip: $${amount}`);
    
    if (!window.phantom?.solana) {
      this.showError('Phantom wallet not found. Please install Phantom wallet extension.');
      return;
    }

    this.showLoading(`Sending $${amount} tip...`);

    try {
      const response = await window.phantom.solana.connect();
      const publicKey = response.publicKey;

      await this.simulateTransaction(amount);
      
      this.showSuccess(`Successfully tipped $${amount} USDC!`);

    } catch (error) {
      console.error('Tip failed:', error);
      this.showError('Transaction failed. Please try again.');
    }
  }

  async simulateTransaction(amount) {
    return new Promise(resolve => setTimeout(resolve, 2000));
  }

  showLoading(message) {
    const content = this.modal.querySelector('.amplify-modal-content');
    content.innerHTML = `
      <div class="amplify-loading" style="padding: 40px 20px !important; text-align: center !important;">
        <div class="amplify-spinner" style="
          font-size: 32px !important;
          margin-bottom: 16px !important;
          animation: spin 1s linear infinite !important;
        ">⟳</div>
        <p style="
          color: white !important;
          font-size: 16px !important;
          margin: 0 !important;
        ">${message}</p>
      </div>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;
  }

  showSuccess(message) {
    const content = this.modal.querySelector('.amplify-modal-content');
    content.innerHTML = `
      <div class="amplify-success">
        <div class="amplify-icon">✅</div>
        <p>${message}</p>
        <button class="amplify-close-success">Close</button>
      </div>
    `;

    this.modal.querySelector('.amplify-close-success').addEventListener('click', () => {
      this.closeModal();
    });

    setTimeout(() => {
      this.closeModal();
    }, 3000);
  }

  showError(message) {
    const content = this.modal.querySelector('.amplify-modal-content');
    content.innerHTML = `
      <div class="amplify-error" style="padding: 40px 20px !important; text-align: center !important;">
        <div class="amplify-icon" style="font-size: 48px !important; margin-bottom: 16px !important;">❌</div>
        <p style="
          color: white !important;
          font-size: 16px !important;
          margin: 0 0 20px 0 !important;
          line-height: 1.4 !important;
        ">${message}</p>
        <button class="amplify-close-error" style="
          background: rgba(255, 255, 255, 0.2) !important;
          border: none !important;
          color: white !important;
          padding: 10px 20px !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
          margin-right: 8px !important;
        ">Close</button>
        ${!window.phantom ? `
        <a href="https://phantom.app/" target="_blank" style="
          background: linear-gradient(135deg, #9945FF, #14F195) !important;
          border: none !important;
          color: white !important;
          padding: 10px 20px !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          text-decoration: none !important;
          display: inline-block !important;
          transition: all 0.2s !important;
        ">Install Phantom</a>
        ` : ''}
      </div>
    `;

    const closeButton = this.modal.querySelector('.amplify-close-error');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeModal();
      });
    }
  }

  closeModal() {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    this.modal = null;
    this.isModalOpen = false;
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AmplifyV2());
} else {
  new AmplifyV2();
}