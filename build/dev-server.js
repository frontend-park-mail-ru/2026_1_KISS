import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transpileToString } from './scss-transpiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..', 'src');
const TS_OUT_ROOT = path.resolve(__dirname, '..', '.ts-out');
const PUBLIC_ROOT = path.resolve(__dirname, '..', 'public');
const SCSS_ENTRY = path.resolve(SRC_ROOT, 'app', 'index.scss');
const PORT = Number(process.env.PORT) || 3000;
const API_TARGET = process.env.API_TARGET || 'http://localhost:8080';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.ts': 'text/javascript; charset=utf-8',
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

/**
 * Проксировать WebSocket-апгрейд /api/* на API_TARGET.
 * После HTTP/1.1 101 Switching Protocols превращаем оба соединения
 * в простые TCP-сокеты и pipe'аем их в обе стороны.
 */
function proxyUpgrade(clientReq, clientSocket, head) {
    const target = new URL(API_TARGET);
    const upstreamReq = http.request({
        hostname: target.hostname,
        port: target.port || 80,
        path: clientReq.url,
        method: clientReq.method,
        headers: { ...clientReq.headers, host: target.host }
    });

    upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
        const lines = [`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}`];
        for (const [k, v] of Object.entries(upstreamRes.headers)) {
            if (Array.isArray(v)) {
                for (const item of v) lines.push(`${k}: ${item}`);
            } else {
                lines.push(`${k}: ${v}`);
            }
        }
        clientSocket.write(`${lines.join('\r\n')}\r\n\r\n`);
        if (upstreamHead && upstreamHead.length) clientSocket.write(upstreamHead);
        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);
        upstreamSocket.on('error', () => clientSocket.destroy());
        clientSocket.on('error', () => upstreamSocket.destroy());
    });

    upstreamReq.on('error', () => clientSocket.destroy());
    if (head && head.length) upstreamReq.write(head);
    upstreamReq.end();
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/api') || pathname.startsWith('/uploads')) {
        proxy(req, res);
        return;
    }

    if (pathname === '/feedback') {
        serveFile(res, path.join(SRC_ROOT, 'feedback', 'feedback.html'));
        return;
    }

    if (pathname === '/app/index.css') {
        try {
            const css = transpileToString(SCSS_ENTRY);
            res.writeHead(200, { 'Content-Type': MIME['.css'], 'Cache-Control': 'no-store' });
            res.end(css);
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`SCSS transpile error: ${err.message}`);
        }
        return;
    }

    const publicPath = path.join(PUBLIC_ROOT, pathname);
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
        serveFile(res, publicPath);
        return;
    }

    const tsOutPath = path.join(TS_OUT_ROOT, pathname);
    if (fs.existsSync(tsOutPath) && fs.statSync(tsOutPath).isFile()) {
        serveFile(res, tsOutPath);
        return;
    }

    const srcPath = path.join(SRC_ROOT, pathname);
    if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
        serveFile(res, srcPath);
        return;
    }

    const fallback = path.join(SRC_ROOT, 'app', 'index.html');
    serveFile(res, fallback);
});

server.on('upgrade', (req, clientSocket, head) => {
    if (req.url.startsWith('/api')) {
        proxyUpgrade(req, clientSocket, head);
        return;
    }
    clientSocket.destroy();
});

server.listen(PORT, () => {
    console.log(`Dev server: http://localhost:${PORT}`);
    console.log(`API proxy -> ${API_TARGET}`);
});
