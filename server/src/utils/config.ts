import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (two levels up from src/utils)
const envPath = path.resolve(__dirname, '../../..', '.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

export const config = {
  port: parseInt(process.env.PORT || '8080'),
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  databaseUrl: process.env.DATABASE_URL,
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || '8080'}`,
  allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'],
  
  // LiveKit
  livekitApiKey: process.env.LIVEKIT_API_KEY || '',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
  livekitUrl: process.env.LIVEKIT_URL || '',
  
  // Bunny
  bunnyStorageZone: process.env.BUNNY_STORAGE_ZONE || '',
  bunnyStorageApiKey: process.env.BUNNY_STORAGE_API_KEY || '',
  bunnyStorageRegion: process.env.BUNNY_STORAGE_REGION || 'de',
  bunnyCdnHostname: process.env.VITE_BUNNY_CDN_HOSTNAME || '',
  
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
};
