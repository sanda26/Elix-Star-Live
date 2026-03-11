#!/usr/bin/env node
/**
 * Run on the SERVER in project root: node scripts/check-live-env.js
 * Shows why LiveKit might not work.
 */
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

console.log('=== LiveKit check (run from project root on server) ===\n');
console.log('Project root:', root);
console.log('.env exists:', fs.existsSync(envPath));

if (!fs.existsSync(envPath)) {
  console.log('\n>>> FIX: Create .env in project root. Add:');
  console.log('   LIVEKIT_URL=wss://your-project.livekit.cloud');
  console.log('   LIVEKIT_API_KEY=...');
  console.log('   LIVEKIT_API_SECRET=...');
  process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const hasUrl = /LIVEKIT_URL=\s*\S+/.test(content) && !/LIVEKIT_URL=\s*$/.test(content);
const hasKey = /LIVEKIT_API_KEY=\s*\S+/.test(content);
const hasSecret = /LIVEKIT_API_SECRET=\s*\S+/.test(content);

console.log('LIVEKIT_URL set:', hasUrl);
console.log('LIVEKIT_API_KEY set:', hasKey);
console.log('LIVEKIT_API_SECRET set:', hasSecret);

if (!hasUrl || !hasKey || !hasSecret) {
  console.log('\n>>> FIX: Add missing lines to .env in project root, then: pm2 restart elix');
  process.exit(1);
}

console.log('\n>>> .env is OK. If video still fails:');
console.log('   1. Restart app: pm2 restart elix');
console.log('   2. In browser when you go live, open DevTools > Network, find POST api/live/start, check Response has "url" and "token"');
console.log('   3. If response has no "url", the server is not reading .env (wrong working directory or old code)');
process.exit(0);
