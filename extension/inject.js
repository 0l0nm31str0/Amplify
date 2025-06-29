// Simplified inject.js that should work reliably
(function() {
  'use strict';
  
  console.log('💉 Amplify: Inject script starting...', new Date().toISOString());
  
  // Prevent duplicate injection
  if (window.__amplifyInjected) {
    console.log('💉 Amplify: Already injected, skipping');
    return;
  }
  window.__amplifyInjected = true;
  
  // Check Phantom immediately
  const phantomCheck = {
    exists: typeof window.phantom !== 'undefined',
    hasSolana: !!(window.phantom?.solana),
    isPhantom: !!(window.phantom?.solana?.isPhantom)
  };
  console.log('💉 Amplify: Initial Phantom check:', phantomCheck);

  // Message handler
  function handleMessage(event) {
    // Only process messages from same window
    if (event.source !== window) return;
    
    // Only process AMPLIFY messages
    if (!event.data || typeof event.data !== 'object' || !event.data.type) return;
    if (!event.data.type.startsWith('AMPLIFY_')) return;
    
    console.log('💉 Amplify: Processing message:', event.data.type);
    
    switch (event.data.type) {
      case 'AMPLIFY_CHECK_PHANTOM':
        handlePhantomCheck();
        break;
        
      case 'AMPLIFY_CONNECT_PHANTOM':
        handlePhantomConnect();
        break;
        
      case 'AMPLIFY_SEND_TRANSACTION':
        handleTransaction(event.data);
        break;
        
      default:
        console.log('💉 Amplify: Unknown message type:', event.data.type);
    }
  }
  
  function handlePhantomCheck() {
    const response = {
      type: 'AMPLIFY_PHANTOM_STATUS',
      available: !!(window.phantom?.solana),
      isConnected: window.phantom?.solana?.isConnected || false,
      isPhantom: window.phantom?.solana?.isPhantom || false
    };
    
    console.log('💉 Amplify: Phantom check response:', response);
    window.postMessage(response, '*');
  }
  
  async function handlePhantomConnect() {
    try {
      if (!window.phantom?.solana) {
        throw new Error('Phantom wallet not found');
      }
      
      console.log('💉 Amplify: Connecting to Phantom...');
      const resp = await window.phantom.solana.connect();
      
      const response = {
        type: 'AMPLIFY_PHANTOM_CONNECTED',
        publicKey: resp.publicKey.toString()
      };
      
      console.log('💉 Amplify: Connected successfully:', response.publicKey);
      window.postMessage(response, '*');
      
    } catch (error) {
      console.error('💉 Amplify: Connection error:', error);
      window.postMessage({
        type: 'AMPLIFY_PHANTOM_ERROR',
        error: error.message || 'Failed to connect to Phantom'
      }, '*');
    }
  }
  
  async function handleTransaction(data) {
    try {
      console.log('💉 Amplify: Transaction requested:', data);
      
      // For now, simulate the transaction
      window.postMessage({
        type: 'AMPLIFY_TRANSACTION_PENDING',
        message: 'Preparing transaction...'
      }, '*');
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      window.postMessage({
        type: 'AMPLIFY_TRANSACTION_SUCCESS',
        signature: 'simulated_' + Date.now()
      }, '*');
      
    } catch (error) {
      window.postMessage({
        type: 'AMPLIFY_TRANSACTION_ERROR',
        error: error.message || 'Transaction failed'
      }, '*');
    }
  }
  
  // Set up message listener
  window.addEventListener('message', handleMessage);
  console.log('💉 Amplify: Message listener attached');
  
  // Send ready signal after a short delay to ensure content script is ready
  setTimeout(() => {
    console.log('💉 Amplify: Sending ready signal');
    window.postMessage({ type: 'AMPLIFY_INJECT_READY' }, '*');
  }, 50);
  
  // Expose debug function
  window.amplifyDebug = {
    checkPhantom: () => {
      console.log('🧪 Debug: Phantom check');
      console.log('- phantom exists:', !!window.phantom);
      console.log('- phantom.solana:', !!window.phantom?.solana);
      console.log('- isConnected:', window.phantom?.solana?.isConnected);
      return window.phantom;
    },
    testMessage: () => {
      console.log('🧪 Debug: Testing message system');
      window.postMessage({ type: 'AMPLIFY_CHECK_PHANTOM' }, '*');
    },
    connect: async () => {
      console.log('🧪 Debug: Direct connect test');
      if (window.phantom?.solana) {
        try {
          const resp = await window.phantom.solana.connect();
          console.log('✅ Connected:', resp.publicKey.toString());
          return resp;
        } catch (err) {
          console.error('❌ Connect failed:', err);
          throw err;
        }
      } else {
        console.error('❌ Phantom not found');
      }
    }
  };
  
  console.log('💉 Amplify: Inject script ready. Debug available at window.amplifyDebug');
})();