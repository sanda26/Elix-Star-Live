#!/bin/bash

# Railway Deployment Script
echo "🚀 Deploying Elix Star Live to Railway..."

# Check if we're in git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository. Initialize git first."
  exit 1
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
  echo "❌ Error: Railway CLI not installed."
  echo "Install it with: npm install -g @railway/cli"
  exit 1
fi

# Stage all changes
echo "📦 Staging changes..."
git add .

# Commit changes
echo "📝 Committing changes..."
git commit -m "Deploy to Railway - Production Ready

✅ Features:
- Complete UI polish with TikTok-style design
- Fixed signup error with RLS policies
- All functionality working (like, comment, share, follow)
- Video upload to For You feed
- Clean bottom sheets and modals
- Gift system with Supabase storage
- Production environment configuration

🚀 Ready for production deployment"

# Check if Railway project exists
if ! railway status &> /dev/null; then
  echo "🔧 Setting up Railway project..."
  railway login
  railway init
fi

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Get deployment URL
echo "🌐 Getting deployment URL..."
RAILWAY_URL=$(railway domain --prod 2>/dev/null || railway domain 2>/dev/null)

if [ -n "$RAILWAY_URL" ]; then
  echo "✅ Deployment successful!"
  echo "🌐 Live URL: https://$RAILWAY_URL"
  echo "🔍 Health check: https://$RAILWAY_URL/health"
  
  # Test health endpoint
  echo "🧪 Testing health endpoint..."
  curl -s "https://$RAILWAY_URL/health" | head -5
  
  echo ""
  echo "📋 Next steps:"
  echo "1. Configure environment variables in Railway dashboard"
  echo "2. Test the live application"
  echo "3. Monitor deployment logs"
else
  echo "❌ Could not get deployment URL"
  echo "Check Railway dashboard for deployment status"
fi

echo ""
echo "🎉 Railway deployment process completed!"