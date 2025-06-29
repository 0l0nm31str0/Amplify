import React, { useEffect, useState, useMemo } from 'react';
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton, WalletDisconnectButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, transfer, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import './App.css';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://28bc5347-71d7-42a5-9c82-4860713f9f76.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

// USDC Mint address on Devnet
const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const CreatorDashboard = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [creatorData, setCreatorData] = useState(null);
  const [earnings, setEarnings] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [defaultTipAmount, setDefaultTipAmount] = useState(0.5);
  const [showTipSetup, setShowTipSetup] = useState(false);

  // Check for OAuth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth');
    const channelName = urlParams.get('channel');
    const errorMessage = urlParams.get('message');

    if (oauthStatus === 'success' && channelName) {
      setSuccessMessage(`Successfully connected YouTube channel: ${channelName}!`);
      setShowTipSetup(true);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthStatus === 'error') {
      setError(`OAuth failed: ${errorMessage || 'Unknown error'}`);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (publicKey) {
      checkCreatorData();
    }
  }, [publicKey]);

  const checkCreatorData = async () => {
    try {
      const response = await axios.get(`${API}/creator`, {
        params: { walletAddress: publicKey.toString() }
      });
      
      setCreatorData(response.data);
      setDefaultTipAmount(response.data.defaultTipAmount || 0.5);
      
      if (response.data.youtubeConnected && response.data.defaultTipAmount) {
        await checkEarnings();
      } else if (response.data.youtubeConnected && !response.data.defaultTipAmount) {
        setShowTipSetup(true);
      }
    } catch (err) {
      console.log('Creator not registered yet');
    }
  };

  const checkEarnings = async () => {
    try {
      // Get USDC token account balance
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: USDC_MINT
      });
      
      if (tokenAccounts.value.length > 0) {
        const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        setEarnings(balance || 0);
      }
    } catch (err) {
      console.error('Error checking earnings:', err);
    }
  };

  const initiateYouTubeOAuth = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Redirect to backend OAuth initiation
      const oauthUrl = `${API}/oauth/youtube/initiate?wallet_address=${publicKey.toString()}`;
      window.location.href = oauthUrl;
    } catch (err) {
      setError('Failed to initiate YouTube connection');
      setLoading(false);
    }
  };

  const saveDefaultTipAmount = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setError('');
    
    try {
      await axios.put(`${API}/creator/settings?wallet_address=${publicKey.toString()}`, {
        defaultTipAmount: defaultTipAmount
      });
      
      setSuccessMessage(`Default tip amount set to $${defaultTipAmount} USDC!`);
      setShowTipSetup(false);
      await checkCreatorData();
    } catch (err) {
      setError('Failed to save tip amount');
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="mb-8">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Amplify v2.0
            </h1>
            <p className="text-xl text-gray-300">YouTube Creator Micro-Tipping Platform</p>
            <p className="text-sm text-gray-400 mt-2">Integrated with YouTube Like Button</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Creator Registration</h2>
            <p className="text-gray-300 mb-6">Connect your Phantom wallet to get started</p>
            <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-pink-500 !rounded-xl !font-semibold" />
          </div>
        </div>
      </div>
    );
  }

  // Show tip amount setup if needed
  if (showTipSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-8">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md mx-auto text-center">
          <h2 className="text-3xl font-semibold text-white mb-6">Set Your Default Tip Amount</h2>
          <p className="text-gray-300 mb-6">
            This is the amount that will be suggested to viewers when they like your videos.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="text-white text-sm block mb-2">Default Tip Amount (USDC)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={defaultTipAmount}
                onChange={(e) => setDefaultTipAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white text-center text-2xl font-bold focus:outline-none focus:border-purple-400"
              />
            </div>
            
            <div className="text-gray-400 text-sm">
              <p>Popular amounts: $0.10, $0.25, $0.50, $1.00</p>
            </div>
            
            <button
              onClick={saveDefaultTipAmount}
              disabled={loading || defaultTipAmount <= 0}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
            >
              {loading ? 'Saving...' : `Set Default Tip: $${defaultTipAmount}`}
            </button>
          </div>
          
          {error && <p className="text-red-400 text-center mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Creator Dashboard v2.0
          </h1>
          <div className="flex items-center justify-center gap-4">
            <p className="text-gray-300">Connected: {publicKey.toString().slice(0, 8)}...</p>
            <WalletDisconnectButton className="!bg-red-500/20 !border-red-500 !text-red-400 !rounded-lg" />
          </div>
        </div>

        {!creatorData?.youtubeConnected ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8 text-center">
            <h2 className="text-2xl font-semibold text-white mb-6">Connect Your YouTube Channel</h2>
            <p className="text-gray-300 mb-6">
              Connect your YouTube channel via official Google OAuth to start receiving tips when viewers like your videos.
            </p>
            <button
              onClick={initiateYouTubeOAuth}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? 'Connecting...' : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Connect YouTube Channel
                </>
              )}
            </button>
            {error && <p className="text-red-400 text-center mt-4">{error}</p>}
            {successMessage && <p className="text-green-400 text-center mt-4">{successMessage}</p>}
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-4">Total Earnings</h3>
                <div className="text-4xl font-bold text-green-400 mb-2">${earnings.toFixed(2)}</div>
                <p className="text-gray-300">USDC received via Amplify</p>
                <button
                  onClick={checkEarnings}
                  className="mt-4 bg-purple-500/20 border border-purple-400 text-purple-300 px-4 py-2 rounded-lg hover:bg-purple-500/30 transition-all"
                >
                  Refresh Balance
                </button>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
                <h3 className="text-2xl font-semibold text-white mb-4">Channel Settings</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-300 text-sm">YouTube Channel:</p>
                    <p className="text-white font-semibold">{creatorData?.channelName || 'Connected'}</p>
                  </div>
                  <div>
                    <p className="text-gray-300 text-sm">Default Tip Amount:</p>
                    <p className="text-green-400 font-bold text-xl">${creatorData?.defaultTipAmount || 0} USDC</p>
                  </div>
                  <button
                    onClick={() => setShowTipSetup(true)}
                    className="bg-blue-500/20 border border-blue-400 text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-all"
                  >
                    Change Default Amount
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8">
              <h3 className="text-2xl font-semibold text-white mb-4">How It Works</h3>
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-4xl mb-2">👍</div>
                  <h4 className="text-white font-semibold mb-2">Viewer Likes Video</h4>
                  <p className="text-gray-300 text-sm">When someone likes your video, Amplify shows a tip option</p>
                </div>
                <div>
                  <div className="text-4xl mb-2">💰</div>
                  <h4 className="text-white font-semibold mb-2">Optional Tip</h4>
                  <p className="text-gray-300 text-sm">They can tip your default amount or choose a custom amount</p>
                </div>
                <div>
                  <div className="text-4xl mb-2">⚡</div>
                  <h4 className="text-white font-semibold mb-2">Instant Payment</h4>
                  <p className="text-gray-300 text-sm">USDC sent directly to your wallet via Solana</p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg">
                <p className="text-blue-300 text-sm">
                  <strong>Next:</strong> Install the Amplify browser extension and test it on your YouTube videos!
                </p>
              </div>
            </div>
          </>
        )}

        {successMessage && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-400/30 rounded-lg">
            <p className="text-green-400 text-center">{successMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const TestTipButton = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const sendTestTip = async () => {
    if (!publicKey) return;

    setLoading(true);
    setMessage('');

    try {
      // First check if user has a USDC token account
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: USDC_MINT
      });

      if (tokenAccounts.value.length === 0) {
        setMessage('No USDC token account found. Please get some devnet USDC first.');
        setLoading(false);
        return;
      }

      const userTokenAccount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount;
      const balance = parseFloat(userTokenAccount.uiAmount);

      if (balance < 0.1) {
        setMessage(`Insufficient USDC balance. You have ${balance} USDC, need at least 0.1 USDC.`);
        setLoading(false);
        return;
      }

      setMessage(`✅ Test successful! You have ${balance} USDC. Ready for tipping!`);
      
    } catch (error) {
      console.error('Test failed:', error);
      if (error.message.includes('could not find account')) {
        setMessage('❌ No USDC token account found. Get devnet USDC from: https://everlastingsong.github.io/nebula/');
      } else {
        setMessage(`❌ Test failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={sendTestTip}
        disabled={loading || !publicKey}
        className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-blue-600 disabled:opacity-50 transition-all"
      >
        {loading ? 'Checking USDC Balance...' : 'Test USDC Balance'}
      </button>
      {message && (
        <p className={`text-center ${message.includes('failed') || message.includes('❌') ? 'text-red-400' : 'text-green-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
};

function App() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="App">
            <CreatorDashboard />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;