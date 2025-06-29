// Amplify Content Script v2.0 - Like Button Interception
console.log('🚀 Amplify v2.0 extension loaded');

const API_BASE = 'https://28bc5347-71d7-42a5-9c82-4860713f9f76.preview.emergentagent.com/api';

class AmplifyV2 {
  constructor() {
    this.currentChannelId = null;
    this.creatorData = null;
    this.isListenerAttached = false;
    this.modal = null;
    this.isModalOpen = false;
    this.originalLikeHandler = null;
    this.init();
  }

  init() {
    console.log('🎯 Initializing Amplify v2.0...');
    this.waitForYouTubePage();
    
    // Listen for navigation changes (YouTube is SPA)
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
    // Only run on watch pages
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
    // Multiple selectors for like button (YouTube changes these frequently)
    const selectors = [
      'button[aria-label*="like this video" i]:not([aria-label*="dislike" i])',
      'button[aria-label*="like" i][aria-label*="video" i]:not([aria-label*="dislike" i])',
      '#segmented-like-button button',
      'ytd-toggle-button-renderer:first-child button',
      '#top-level-buttons-computed button:first-child'
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

    // Extract channel ID first
    this.currentChannelId = await this.extractChannelId();
    if (!this.currentChannelId) {
      console.log('❌ Could not extract channel ID');
      return;
    }

    // Check if creator is registered
    const isRegistered = await this.checkCreatorRegistration();
    if (!isRegistered) {
      console.log('❌ Creator not registered with Amplify');
      return;
    }

    // Attach click listener
    this.attachLikeButtonListener(likeButton);
    this.isListenerAttached = true;
    
    console.log('✅ Like button interception setup complete');
  }

  attachLikeButtonListener(likeButton) {
    // Store original click handlers
    const originalClick = likeButton.onclick;
    
    likeButton.addEventListener('click', async (event) => {
      console.log('👍 Like button clicked!');
      
      // Allow original like functionality to proceed
      if (originalClick) {
        originalClick.call(likeButton, event);
      }
      
      // Small delay to ensure like is processed
      setTimeout(() => {
        this.showTipModal();
      }, 300);
    }, true); // Use capture phase
  }

  async extractChannelId() {
    // Method 1: From page data
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

    // Method 2: From channel avatar link
    const avatarLink = document.querySelector('#avatar a[href*="/channel/"], #avatar a[href*="/@"]');
    if (avatarLink) {
      const href = avatarLink.href;
      const channelMatch = href.match(/\/channel\/([^\/\?]+)/);
      const handleMatch = href.match(/\/@([^\/\?]+)/);
      return channelMatch?.[1] || handleMatch?.[1];
    }

    // Method 3: From channel name link
    const channelNameLink = document.querySelector('ytd-video-owner-renderer a[href*="/channel/"], ytd-video-owner-renderer a[href*="/@"]');
    if (channelNameLink) {
      const href = channelNameLink.href;
      const channelMatch = href.match(/\/channel\/([^\/\?]+)/);
      const handleMatch = href.match(/\/@([^\/\?]+)/);
      return channelMatch?.[1] || handleMatch?.[1];
    }

    return null;
  }

  async checkCreatorRegistration() {
    try {
      const response = await fetch(`${API_BASE}/creator?channelId=${this.currentChannelId}`);
      if (response.ok) {
        this.creatorData = await response.json();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking creator registration:', error);
      return false;
    }
  }

  showTipModal() {
    if (this.isModalOpen) return;
    
    this.createModal();
    document.body.appendChild(this.modal);
    this.isModalOpen = true;
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      if (this.isModalOpen) {
        this.closeModal();
      }
    }, 10000);
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'amplify-modal-overlay';
    
    const defaultAmount = this.creatorData?.defaultTipAmount || 0.5;
    const channelName = this.creatorData?.channelName || 'this creator';
    
    this.modal.innerHTML = `
      <div class="amplify-modal">
        <div class="amplify-modal-header">
          <div class="amplify-logo">⚡ Amplify</div>
          <button class="amplify-close" onclick="this.closest('.amplify-modal-overlay').remove()">×</button>
        </div>
        
        <div class="amplify-modal-content">
          <h3>Support ${channelName}</h3>
          <p>Show your appreciation with a tip!</p>
          
          <div class="amplify-tip-options">
            <button class="amplify-tip-button amplify-default" data-amount="${defaultAmount}">
              <span class="amplify-icon">💰</span>
              <span class="amplify-text">Tip $${defaultAmount}</span>
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

    // Add event listeners
    this.setupModalEvents();
  }

  setupModalEvents() {
    const modal = this.modal;
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeModal();
      }
    });

    // Default tip button
    const defaultButton = modal.querySelector('.amplify-default');
    defaultButton.addEventListener('click', () => {
      const amount = parseFloat(defaultButton.dataset.amount);
      this.processTip(amount);
    });

    // Custom tip button
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

    // Enter key on custom input
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
      // Connect to Phantom wallet
      const response = await window.phantom.solana.connect();
      const publicKey = response.publicKey;

      // For now, simulate the transaction (you'll implement real transactions later)
      await this.simulateTransaction(amount);
      
      this.showSuccess(`Successfully tipped $${amount} USDC!`);
      
      // Record the tip (you'll implement this later)
      // await this.recordTip(publicKey.toString(), amount);

    } catch (error) {
      console.error('Tip failed:', error);
      this.showError('Transaction failed. Please try again.');
    }
  }

  async simulateTransaction(amount) {
    // Simulate transaction delay
    return new Promise(resolve => setTimeout(resolve, 2000));
  }

  showLoading(message) {
    const content = this.modal.querySelector('.amplify-modal-content');
    content.innerHTML = `
      <div class="amplify-loading">
        <div class="amplify-spinner">⟳</div>
        <p>${message}</p>
      </div>
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

    // Auto-close after 3 seconds
    setTimeout(() => {
      this.closeModal();
    }, 3000);
  }

  showError(message) {
    const content = this.modal.querySelector('.amplify-modal-content');
    content.innerHTML = `
      <div class="amplify-error">
        <div class="amplify-icon">❌</div>
        <p>${message}</p>
        <button class="amplify-close-error">Close</button>
      </div>
    `;

    this.modal.querySelector('.amplify-close-error').addEventListener('click', () => {
      this.closeModal();
    });
  }

  closeModal() {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    this.modal = null;
    this.isModalOpen = false;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new AmplifyV2());
} else {
  new AmplifyV2();
}