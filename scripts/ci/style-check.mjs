#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = join(SCRIPT_PATH, '..', '..', '..');

const SCAN_ROOTS = Object.freeze(['apps/web/src/components', 'apps/web/src/pages']);
const FORBIDDEN_PATTERNS = Object.freeze([
	{ name: 'inline style prop', pattern: /\bstyle\s*=/u },
	{ name: 'React CSSProperties', pattern: /\bCSSProperties\b/u },
	{ name: 'legacy chat-styles module', pattern: /chat-styles/u },
	{ name: 'legacy TS style object variable', pattern: /\bconst\s+[A-Za-z0-9_]*Style\s*=/u },
	{
		name: 'legacy TS style helper',
		pattern: /\b(?:export\s+)?function\s+[A-Za-z0-9_]*Styles?\s*\(/u,
	},
]);

async function* walk(dir) {
	let entries;
	try {
		entries = await readdir(dir);
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return;
		}
		throw error;
	}

	for (const entry of entries) {
		const full = join(dir, entry);
		const info = await stat(full);
		if (info.isDirectory()) {
			yield* walk(full);
		} else if (info.isFile()) {
			yield full;
		}
	}
}

function shouldScan(relPath) {
	if (!/\.(?:tsx?|jsx?)$/u.test(relPath)) {
		return false;
	}
	return !/\.(?:test|spec)\.(?:tsx?|jsx?)$/u.test(relPath);
}

async function scanFile(absPath, relPath) {
	const content = await readFile(absPath, 'utf8');
	const lines = content.split(/\r?\n/u);
	const violations = [];

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];
		for (const { name, pattern } of FORBIDDEN_PATTERNS) {
			if (pattern.test(line)) {
				violations.push({
					file: relPath,
					line: lineIndex + 1,
					rule: name,
					excerpt: line.trim().slice(0, 160),
				});
			}
		}
	}

	return violations;
}

async function main() {
	const violations = [];

	for (const scanRoot of SCAN_ROOTS) {
		const absRoot = join(REPO_ROOT, scanRoot);
		for await (const filePath of walk(absRoot)) {
			const relPath = relative(REPO_ROOT, filePath).split(sep).join('/');
			if (!shouldScan(relPath)) {
				continue;
			}

			violations.push(...(await scanFile(filePath, relPath)));
		}
	}

	if (violations.length === 0) {
		process.stdout.write('STYLE_CHECK PASS\n');
		process.stdout.write(
			JSON.stringify({ result: 'PASS', scanned_roots: SCAN_ROOTS, violations: 0 }, null, 2),
		);
		process.stdout.write('\n');
		return;
	}

	process.stderr.write('STYLE_CHECK FAIL\n');
	for (const violation of violations) {
		process.stderr.write(
			`  ${violation.file}:${violation.line} [${violation.rule}] ${violation.excerpt}\n`,
		);
	}
	process.stderr.write(JSON.stringify({ result: 'FAIL', violations }, null, 2));
	process.stderr.write('\n');
	process.exit(1);
}

void main();
