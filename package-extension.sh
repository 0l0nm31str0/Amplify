#!/bin/bash

# Amplify Extension Packaging Script
echo "🚀 Packaging Amplify Extension for Distribution..."

# Create package directory
mkdir -p /app/amplify-extension-package

# Copy extension files
cp -r /app/extension/* /app/amplify-extension-package/

# Copy sharing instructions
cp /app/SHARE_WITH_FRIENDS.md /app/amplify-extension-package/

# Create a simple README for the package
cat > /app/amplify-extension-package/INSTALL.md << 'EOF'
# 🚀 Amplify Extension - Quick Install

## Installation Steps:
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked"
4. Select this folder
5. Visit a YouTube video to see the Amplify button!

## Requirements:
- Phantom wallet extension
- Solana Devnet setup
- Test USDC tokens (see SHARE_WITH_FRIENDS.md)

## Support:
See SHARE_WITH_FRIENDS.md for complete setup instructions.
EOF

# Create ZIP file for easy sharing
cd /app
zip -r amplify-extension.zip amplify-extension-package/

echo "✅ Extension packaged successfully!"
echo "📦 Package location: /app/amplify-extension-package/"
echo "📁 ZIP file: /app/amplify-extension.zip"
echo ""
echo "🎯 To share with friends:"
echo "1. Send them the ZIP file"
echo "2. Include the SHARE_WITH_FRIENDS.md instructions"
echo "3. Make sure they read the installation steps"