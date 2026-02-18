#!/bin/bash

# Android Release Build Script for Elix Star Live
echo "🚀 Building Android Release AAB for Google Play..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from the project root."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf android/app/build/release
rm -rf android/app/build/outputs

# Install dependencies
echo "📦 Installing dependencies..."
npm install

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
    echo "✅ Build successful! AAB file created:"
    echo "   android/app/build/outputs/bundle/release/app-release.aab"
    
    # Copy to dist folder
    mkdir -p ../dist
    cp app/build/outputs/bundle/release/app-release.aab ../dist/elix-star-live-v1.0.1.aab
    
    echo "📦 Package ready for Google Play submission:"
    echo "   dist/elix-star-live-v1.0.1.aab"
else
    echo "❌ Build failed! Check the logs above."
    exit 1
fi

echo "🎉 Android build complete!"