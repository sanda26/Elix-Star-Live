import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load environment variables based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
const envPath = path.join(__dirname, '..', envFile);
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
    console.log(`? Environment variables loaded from ${envFile} (NODE_ENV=${nodeEnv})`);
}
else {
    console.log(`?? No ${envFile} file found (using system env vars)`);
}
console.log('? Environment variables loaded');
//# sourceMappingURL=config.js.map