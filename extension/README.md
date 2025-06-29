# 🚀 Amplify Chrome Extension

## Installation Instructions

### For Testing/Development:
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `/app/extension` folder
5. The Amplify extension should now appear in your extensions list

### Usage:
1. Visit any YouTube video
2. Look for the purple "Amplify ⚡ $0.1" button next to Like/Share
3. Click to tip the creator (requires Phantom wallet)

### Features:
- ✅ Automatic button injection on YouTube
- ✅ Creator registration checking
- ✅ Phantom wallet integration
- ✅ Beautiful UI with animations
- ✅ Success/error notifications
- ✅ Mobile responsive design

### Notes:
- Extension icons need to be created (see ICONS_README.txt)
- Currently uses Solana Devnet for testing
- Requires creators to be registered on Amplify platform first

## Files:
- `manifest.json` - Extension configuration
- `content.js` - Main script that injects button
- `styles.css` - Button styling
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality