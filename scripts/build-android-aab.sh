#!/bin/bash

# Android AAB Release Build Script
echo "🚀 Building Android AAB Release for Google Play..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from the project root."
    exit 1
fi

# Check if keystore exists
if [ ! -f "elix-star-live-release.keystore" ]; then
    echo "❌ Error: Release keystore not found."
    echo "Please generate keystore first:"
    echo "keytool -genkey -v -keystore elix-star-live-release.keystore -alias elixstarlive -keyalg RSA -keysize 2048 -validity 10000"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf android/app/build/release
rm -rf android/app/build/outputs

# Build for store
echo "🔨 Building web app for store..."
npm run build:store

# Sync with Capacitor
echo "🔄 Syncing with Android..."
npx cap sync android

# Build release AAB
echo "📱 Building Android AAB..."
cd android
./gradlew assembleRelease

# Check if build was successful
if [ -f "app/build/outputs/bundle/release/app-release.aab" ]; then
    echo "✅ AAB Build successful!"
    echo "📦 AAB file created: android/app/build/outputs/bundle/release/app-release.aab"
    
    # Copy to dist folder
    mkdir -p ../dist
    cp app/build/outputs/bundle/release/app-release.aab ../dist/elix-star-live-v1.0.1.aab
    
    echo "🎉 Ready for Google Play submission!"
    echo "📦 Package: dist/elix-star-live-v1.0.1.aab"
    
    # Show file info
    ls -lh ../dist/elix-star-live-v1.0.1.aab
else
    echo "❌ AAB Build failed! Check the logs above."
    exit 1
fi

echo "🎯 Next steps:"
echo "1. Test AAB on real Android device"
echo "2. Upload to Google Play Console"
echo "3. Complete store listing"