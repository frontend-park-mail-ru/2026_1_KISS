import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.resolve(ROOT, 'src/app/index.css');
const OUT = path.resolve(ROOT, 'dist/app.css');

const visited = new Set();

function resolveImports(filePath) {
    if (visited.has(filePath)) return '';
    visited.add(filePath);

    if (!fs.existsSync(filePath)) {
        console.warn(`[css-concat] WARN: not found: ${filePath}`);
        return '';
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const dir = path.dirname(filePath);

    return content.replace(/@import\s+['"]([^'"]+)['"]\s*;?/g, (_match, importPath) => {
        const resolved = path.resolve(dir, importPath);
        return resolveImports(resolved);
    });
}

const css = resolveImports(ENTRY);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, css, 'utf-8');
console.log(`[css-concat] -> dist/app.css (${(css.length / 1024).toFixed(1)} kB)`);
