import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.resolve(ROOT, 'src/app/index.scss');
const OUT = path.resolve(ROOT, 'dist/app.css');

const variables = new Map();
const resolved = new Set();

function resolveFile(importPath, fromDir) {
    let candidate = path.resolve(fromDir, importPath);
    if (!path.extname(candidate)) candidate += '.scss';
    if (fs.existsSync(candidate)) return candidate;
    const dir = path.dirname(candidate);
    const base = path.basename(candidate);
    const partial = path.join(dir, `_${base}`);
    if (fs.existsSync(partial)) return partial;
    return null;
}

function processFile(filePath, alias = null) {
    if (!filePath || resolved.has(filePath)) return '';
    resolved.add(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const dir = path.dirname(filePath);
    let result = '';

    for (const line of content.split('\n')) {
        const useMatch = line.match(/^@use\s+['"]([^'"]+)['"]\s*(?:as\s+(\w+))?\s*;?\s*$/);
        if (useMatch) {
            const resolvedPath = resolveFile(useMatch[1], dir);
            const localAlias = useMatch[2] || null;
            result += processFile(resolvedPath, localAlias);
            continue;
        }

        const importMatch = line.match(/^@import\s+['"]([^'"]+)['"]\s*;?\s*$/);
        if (importMatch) {
            const resolvedPath = resolveFile(importMatch[1], dir);
            result += processFile(resolvedPath);
            continue;
        }

        const varDecl = line.match(/^\s*\$(\w[\w-]*)\s*:\s*(.+?)\s*;?\s*$/);
        if (varDecl) {
            const key = alias ? `${alias}.$${varDecl[1]}` : `$${varDecl[1]}`;
            variables.set(key, varDecl[2].trim());
            if (!alias) variables.set(`$${varDecl[1]}`, varDecl[2].trim());
            continue;
        }

        result += `${line}\n`;
    }

    return result;
}

function substituteVariables(css) {
    return css.replace(/(\w+\.\$[\w-]+|\$[\w-]+)/g, (match) => variables.get(match) || match);
}

function expandNesting(css) {
    const output = [];
    const chars = [...css];
    let i = 0;

    function skipWhitespace() {
        while (i < chars.length && /\s/.test(chars[i])) i++;
    }

    function parseBlock(parentSelector) {
        while (i < chars.length) {
            skipWhitespace();
            if (i >= chars.length || chars[i] === '}') {
                i++;
                return;
            }

            let selectorOrProp = '';
            let braceDepth = 0;

            while (i < chars.length) {
                if (chars[i] === '{') {
                    braceDepth++;
                    if (braceDepth === 1) break;
                }
                if (chars[i] === '}') {
                    if (braceDepth === 0) {
                        i++;
                        return;
                    }
                    braceDepth--;
                }
                if (chars[i] === ';' && braceDepth === 0) {
                    selectorOrProp += chars[i++];
                    if (parentSelector) {
                        output.push(`  ${selectorOrProp.trim()}`);
                    } else {
                        output.push(selectorOrProp.trim());
                    }
                    selectorOrProp = '';
                    continue;
                }
                selectorOrProp += chars[i++];
            }

            if (i < chars.length && chars[i] === '{') {
                i++;
                const rawSelector = selectorOrProp.trim();

                if (
                    rawSelector.startsWith('@media') ||
                    rawSelector.startsWith('@keyframes') ||
                    rawSelector.startsWith('@supports')
                ) {
                    const resolvedMedia = rawSelector;
                    if (parentSelector) {
                        output.push(`}\n${resolvedMedia} {`);
                        output.push(`${parentSelector} {`);
                        parseBlock(parentSelector);
                        output.push('}');
                        output.push('}');
                        output.push(`${parentSelector} {`);
                    } else {
                        output.push(`${resolvedMedia} {`);
                        parseBlock('');
                        output.push('}');
                    }
                    continue;
                }

                const selectors = rawSelector.split(',').map((s) => s.trim());
                const expanded = selectors.map((sel) => {
                    if (!parentSelector) return sel;
                    if (sel.includes('&')) return sel.replace(/&/g, parentSelector);
                    return `${parentSelector} ${sel}`;
                });

                const fullSelector = expanded.join(', ');
                output.push(`\n${fullSelector} {`);
                parseBlock(fullSelector.split(',')[0].trim());
                output.push('}');
            }
        }
    }

    parseBlock('');
    return output.join('\n');
}

function transpile() {
    console.log('[scss] Processing...');
    let css = processFile(ENTRY);
    css = substituteVariables(css);
    css = expandNesting(css);
    css = `${css.replace(/\n{3,}/g, '\n\n').trim()}\n`;
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, css, 'utf-8');
    console.log(`[scss] -> dist/app.css (${(css.length / 1024).toFixed(1)} kB)`);
}

transpile();
