#!/bin/bash

# iOS Release Build Script for Elix Star Live
echo "🚀 Building iOS Release IPA for App Store..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from the project root."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf ios/App/build

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build for store
echo "🔨 Building web app for store..."
npm run build:store

# Sync with Capacitor
echo "🔄 Syncing with iOS..."
npx cap sync ios

# Build iOS archive
echo "📱 Building iOS Archive..."
cd ios

# Check if Xcode project exists
if [ ! -f "App/App.xcodeproj/project.pbxproj" ]; then
    echo "❌ Error: Xcode project not found. Make sure Capacitor is properly set up."
    exit 1
fi

# Build archive (requires Xcode and proper certificates)
echo "⚠️  Note: This requires Xcode with proper provisioning profiles and certificates."
echo "📋 Manual steps required:"
echo "   1. Open ios/App/App.xcodeproj in Xcode"
echo "   2. Select 'Any iOS Device' as target"
echo "   3. Product → Archive"
echo "   4. In Organizer, click 'Distribute App'"
echo "   5. Choose 'App Store Connect'"
echo "   6. Follow the prompts to upload"

echo "🔧 Alternatively, use command line (requires setup):"
echo "   xcodebuild -workspace App/App.xcworkspace \\"
echo "     -scheme App \\"
echo "     -configuration Release \\"
echo "     -destination generic/platform=iOS \\"
echo "     -archivePath build/App.xcarchive archive"

echo "📦 After archive creation:"
echo "   xcodebuild -exportArchive \\"
echo "     -archivePath build/App.xcarchive \\"
echo "     -exportPath build/ \\"
echo "     -exportOptionsPlist ExportOptions.plist"

echo "🎉 iOS build instructions complete!"
echo "📱 IPA will be created in build/ directory after manual Xcode build."