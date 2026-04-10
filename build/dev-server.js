import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..', 'src');
const PUBLIC_ROOT = path.resolve(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const API_TARGET = process.env.API_TARGET || 'http://localhost:8080';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff'
};

function serveFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch {
        return false;
    }
    return true;
}

function proxy(clientReq, clientRes) {
    const target = new URL(API_TARGET);
    const options = {
        hostname: target.hostname,
        port: target.port || 80,
        path: clientReq.url,
        method: clientReq.method,
        headers: { ...clientReq.headers, host: target.host }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(clientRes, { end: true });
    });

    proxyReq.on('error', (err) => {
        clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
        clientRes.end(`Proxy error: ${err.message}`);
    });

    clientReq.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api') || pathname.startsWith('/uploads')) {
        return proxy(req, res);
    }

    const publicPath = path.join(PUBLIC_ROOT, pathname);
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
        return serveFile(res, publicPath);
    }

    const srcPath = path.join(SRC_ROOT, pathname);
    if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
        return serveFile(res, srcPath);
    }

    const fallback = path.join(SRC_ROOT, 'app', 'index.html');
    serveFile(res, fallback);
});

server.listen(PORT, () => {
    console.log(`Dev server: http://localhost:${PORT}`);
    console.log(`API proxy -> ${API_TARGET}`);
});
