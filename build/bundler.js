import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(ROOT, 'dist');

const IMPORT_RE = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;

function resolvePath(importPath, fromFile) {
    const dir = path.dirname(fromFile);
    let resolved = path.resolve(dir, importPath);
    if (!path.extname(resolved)) resolved += '.js';
    if (!fs.existsSync(resolved) && resolved.endsWith('.js')) {
        const tsVariant = resolved.replace(/\.js$/, '.ts');
        if (fs.existsSync(tsVariant)) resolved = tsVariant;
    }
    return resolved;
}

function moduleId(filePath) {
    return path
        .relative(ROOT, filePath)
        .replace(/[/\\.]/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
}

function wrapModule(filePath, code) {
    const id = moduleId(filePath);
    let transformed = code;

    transformed = transformed.replace(
        /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;?/g,
        (_, names, importPath) => {
            if (!importPath.startsWith('.')) return '';
            const resolved = resolvePath(importPath, filePath);
            const depId = moduleId(resolved);
            const bindings = names
                .split(',')
                .map((n) => n.trim())
                .filter(Boolean);
            return bindings
                .map((b) => {
                    const [orig, alias] = b.split(/\s+as\s+/);
                    return `const ${(alias || orig).trim()} = __modules.${depId}.${orig.trim()};`;
                })
                .join('\n');
        }
    );

    transformed = transformed.replace(
        /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?/g,
        (_, name, importPath) => {
            if (!importPath.startsWith('.')) return '';
            const resolved = resolvePath(importPath, filePath);
            const depId = moduleId(resolved);
            return `const ${name} = __modules.${depId}.default;`;
        }
    );

    transformed = transformed.replace(
        /export\s+(?:default\s+)?(?:class|function)\s+(\w+)/g,
        (m, _name) => m.replace(/^export\s+(default\s+)?/, '')
    );
    transformed = transformed.replace(/export\s+\{[^}]*\}\s*;?/g, '');
    transformed = transformed.replace(/export\s+(const|let|var)\s+/g, '$1 ');

    const exportNames = [];
    const exportRe =
        /export\s+(?:default\s+)?(?:class|function)\s+(\w+)|export\s+(?:const|let|var)\s+(\w+)/g;
    let em;
    while ((em = exportRe.exec(code)) !== null) {
        exportNames.push(em[1] || em[2]);
    }

    const namedExportsRe = /export\s+\{([^}]+)\}/g;
    while ((em = namedExportsRe.exec(code)) !== null) {
        em[1].split(',').forEach((n) => {
            const trimmed = n
                .trim()
                .split(/\s+as\s+/)[0]
                .trim();
            if (trimmed) exportNames.push(trimmed);
        });
    }

    const hasDefault = /export\s+default\s/.test(code);
    let exportsObj = exportNames.map((n) => `${n}`).join(', ');
    if (hasDefault) {
        const defaultMatch = code.match(/export\s+default\s+(?:class|function)\s+(\w+)/);
        if (defaultMatch) {
            exportsObj += (exportsObj ? ', ' : '') + `default: ${defaultMatch[1]}`;
        }
    }

    return `// Module: ${path.relative(ROOT, filePath)}\n__modules.${id} = (function() {\n${transformed}\nreturn { ${exportsObj} };\n})();\n`;
}

function buildBundle(entry, outJs, htmlSrc, outHtml) {
    const modules = new Map();

    function collectDeps(filePath) {
        if (modules.has(filePath)) return;
        if (!fs.existsSync(filePath)) {
            console.warn(`[bundler] WARN: file not found: ${filePath}`);
            return;
        }
        const code = fs.readFileSync(filePath, 'utf-8');
        modules.set(filePath, code);

        const re = new RegExp(IMPORT_RE.source, IMPORT_RE.flags);
        let match;
        while ((match = re.exec(code)) !== null) {
            if (match[1].startsWith('.')) {
                collectDeps(resolvePath(match[1], filePath));
            }
        }
    }

    function toposort() {
        const visited = new Set();
        const sorted = [];

        function visit(filePath) {
            if (visited.has(filePath)) return;
            visited.add(filePath);
            const code = modules.get(filePath) || '';
            const re = new RegExp(IMPORT_RE.source, IMPORT_RE.flags);
            let match;
            while ((match = re.exec(code)) !== null) {
                if (match[1].startsWith('.')) {
                    const resolved = resolvePath(match[1], filePath);
                    if (modules.has(resolved)) visit(resolved);
                }
            }
            sorted.push(filePath);
        }

        for (const fp of modules.keys()) visit(fp);
        return sorted;
    }

    console.log(`[bundler] Building ${path.relative(ROOT, entry)}...`);
    collectDeps(entry);

    const sorted = toposort();
    console.log(`[bundler] ${sorted.length} modules`);

    let bundle = '"use strict";\nconst __modules = {};\n\n';
    for (const fp of sorted) {
        bundle += wrapModule(fp, modules.get(fp)) + '\n';
    }

    const outJsName = path.basename(outJs);
    fs.writeFileSync(outJs, bundle, 'utf-8');
    console.log(
        `[bundler] -> ${path.relative(ROOT, outJs)} (${(bundle.length / 1024).toFixed(1)} kB)`
    );

    if (htmlSrc && outHtml && fs.existsSync(htmlSrc)) {
        let html = fs.readFileSync(htmlSrc, 'utf-8');
        html = html.replace(
            /<script type="module" src="[^"]*"><\/script>/,
            `<script src="/${outJsName}"></script>`
        );
        html = html.replace(/href="\/app\/index\.css[^"]*"/, 'href="/app.css"');
        fs.writeFileSync(outHtml, html, 'utf-8');
        console.log(`[bundler] -> ${path.relative(ROOT, outHtml)}`);
    }
}

function build() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    buildBundle(
        path.resolve(ROOT, 'src/app/index.js'),
        path.join(OUT_DIR, 'app.js'),
        path.resolve(ROOT, 'src/app/index.html'),
        path.join(OUT_DIR, 'index.html')
    );

    buildBundle(
        path.resolve(ROOT, 'src/feedback/index.js'),
        path.join(OUT_DIR, 'feedback.js'),
        path.resolve(ROOT, 'src/feedback/feedback.html'),
        path.join(OUT_DIR, 'feedback.html')
    );

    const swSrc = path.resolve(ROOT, 'src/sw.js');
    if (fs.existsSync(swSrc)) {
        fs.copyFileSync(swSrc, path.join(OUT_DIR, 'sw.js'));
        console.log(`[bundler] -> dist/sw.js (copied)`);
    }

    const publicDir = path.resolve(ROOT, 'public');
    if (fs.existsSync(publicDir)) {
        copyDirSync(publicDir, OUT_DIR);
        console.log(`[bundler] -> public/ assets copied`);
    }
}

function copyDirSync(src, dest) {
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

build();
