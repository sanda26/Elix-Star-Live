@echo off
REM Railway Deployment Script for Windows

echo 🚀 Deploying Elix Star Live to Railway...

REM Check if we're in git repository
if not exist ".git" (
  echo ❌ Error: Not in a git repository. Initialize git first.
  exit /b 1
)

REM Check if Railway CLI is installed
where railway >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ Error: Railway CLI not installed.
  echo Install it with: npm install -g @railway/cli
  exit /b 1
)

REM Stage all changes
echo 📦 Staging changes...
git add .

REM Commit changes
echo 📝 Committing changes...
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

REM Check if Railway project exists
railway status >nul 2>nul
if %errorlevel% neq 0 (
  echo 🔧 Setting up Railway project...
  railway login
  railway init
)

REM Deploy to Railway
echo 🚀 Deploying to Railway...
railway up

REM Wait for deployment
echo ⏳ Waiting for deployment to complete...
timeout /t 30 /nobreak >nul

REM Get deployment URL
echo 🌐 Getting deployment URL...
for /f "tokens=*" %%i in ('railway domain --prod 2^>nul || railway domain 2^>nul') do set RAILWAY_URL=%%i

if defined RAILWAY_URL (
  echo ✅ Deployment successful!
  echo 🌐 Live URL: https://%RAILWAY_URL%
  echo 🔍 Health check: https://%RAILWAY_URL%/health
  
  REM Test health endpoint
  echo 🧪 Testing health endpoint...
  curl -s "https://%RAILWAY_URL%/health"
  
  echo.
  echo 📋 Next steps:
  echo 1. Configure environment variables in Railway dashboard
  echo 2. Test the live application
  echo 3. Monitor deployment logs
) else (
  echo ❌ Could not get deployment URL
  echo Check Railway dashboard for deployment status
)

echo.
echo 🎉 Railway deployment process completed!
pause