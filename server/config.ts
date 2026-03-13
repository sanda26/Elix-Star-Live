import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env first (always), then .env.production in production (override)
// So production works with just .env if .env.production is missing
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envProdPath = path.join(rootDir, '.env.production');
const nodeEnv = process.env.NODE_ENV || 'development';

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
  console.log(`[config] Loaded .env (NODE_ENV=${nodeEnv})`);
}
if (nodeEnv === 'production' && fs.existsSync(envProdPath)) {
  dotenv.config({ path: envProdPath, override: true });
  console.log('[config] Loaded .env.production (overrides)');
}
if (!fs.existsSync(envPath) && !fs.existsSync(envProdPath)) {
  console.log('[config] No .env or .env.production found, using system env');
}

