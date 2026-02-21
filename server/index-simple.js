import './config';
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as fs from 'fs';
import * as path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;
// Enable CORS for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
// Serve static files from dist
const distPath = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distPath, 'index.html');
console.log('=== SERVER STARTUP DEBUG ===');
console.log(`Current directory: ${__dirname}`);
console.log(`Dist path: ${distPath}`);
console.log(`Index path: ${indexPath}`);
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
// Check if dist folder exists
if (!fs.existsSync(distPath)) {
    console.error(`❌ ERROR: dist folder not found at ${distPath}`);
    console.error('Available files:', fs.existsSync(__dirname) ? fs.readdirSync(__dirname).join(', ') : 'server folder missing');
    process.exit(1);
}
else {
    console.log('✅ dist folder found successfully');
    console.log('dist contents:', fs.readdirSync(distPath).slice(0, 10).join(', '), '...');
}
// Check if index.html exists
if (!fs.existsSync(indexPath)) {
    console.error(`❌ ERROR: index.html not found at ${indexPath}`);
    console.error('Available files in dist:', fs.existsSync(distPath) ? fs.readdirSync(distPath).join(', ') : 'dist folder missing');
    process.exit(1);
}
else {
    console.log('✅ index.html found successfully');
}
// Health check endpoint
app.get('/health', (req, res) => {
    console.log('ðŸ” Health check hit successfully');
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        port: PORT,
        uptime: process.uptime()
    });
});
app.get('/env.js', (_req, res) => {
    const env = {};
    for (const [k, v] of Object.entries(process.env)) {
        if (!k.startsWith('VITE_'))
            continue;
        if (typeof v !== 'string')
            continue;
        env[k] = v;
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send('window.__ENV = Object.assign({}, window.__ENV || {}, ' + JSON.stringify(env) + ');');
});
// Debug endpoint to check files
app.get('/debug', (req, res) => {
    const debugInfo = {
        distPath,
        indexPath,
        distExists: fs.existsSync(distPath),
        indexExists: fs.existsSync(indexPath),
        distContents: fs.existsSync(distPath) ? fs.readdirSync(distPath) : [],
        cwd: process.cwd(),
        nodeEnv: process.env.NODE_ENV
    };
    res.json(debugInfo);
});
// Serve static files with proper MIME types
app.use(express.static(distPath, {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        else if (path.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
        }
    }
}));
// Root endpoint - serve index.html
app.get('/', (req, res) => {
    console.log('🏠 Serving root index.html');
    try {
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, 'utf8');
            res.setHeader('Content-Type', 'text/html');
            res.send(content);
        }
        else {
            res.status(404).send('<h1>index.html not found</h1><p>Check build logs.</p>');
        }
    }
    catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('<h1>Error serving app</h1>');
    }
});
// Fallback for SPA - all non-API routes serve index.html
app.get(/.*/, (req, res) => {
    console.log(`🔄 Serving fallback for ${req.url}`);
    try {
        if (fs.existsSync(indexPath)) {
            const content = fs.readFileSync(indexPath, 'utf8');
            res.setHeader('Content-Type', 'text/html');
            res.send(content);
        }
        else {
            res.status(404).send('<h1>index.html not found</h1><p>Check build logs.</p>');
        }
    }
    catch (error) {
        console.error('Error serving fallback:', error);
        res.status(500).send('<h1>Error serving app</h1>');
    }
});
// Start server
console.log('🚀 Starting server...');
try {
    server.listen(PORT, '0.0.0.0', () => {
        console.log('✅ Server running successfully!');
        console.log(`📍 Port: ${PORT}`);
        console.log(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
        console.log(`🌐 App: http://0.0.0.0:${PORT}/`);
        console.log(`🐛 Debug: http://0.0.0.0:${PORT}/debug`);
        console.log('========================');
    });
}
catch (error) {
    console.error('❌ Server failed to start:', error);
    process.exit(1);
}
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
//# sourceMappingURL=index-simple.js.map