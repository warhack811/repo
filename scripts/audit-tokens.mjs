#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const WEB_SRC_ROOT = join('apps', 'web', 'src');
const TOKEN_FILES = [
	join(WEB_SRC_ROOT, 'styles', 'tokens.css'),
	join(WEB_SRC_ROOT, 'styles', 'fonts.css'),
];
const RUNTIME_ALLOWED = new Set(['--keyboard-offset', '--bg', '--spread']);
const SOURCE_EXTENSIONS = new Set(['.css', '.ts', '.tsx']);

function collectFiles(rootDir) {
	const files = [];
	const queue = [rootDir];

	while (queue.length > 0) {
		const dir = queue.pop();
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const absolutePath = join(dir, entry.name);
			if (entry.isDirectory()) {
				queue.push(absolutePath);
				continue;
			}
			if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
				files.push(absolutePath);
			}
		}
	}

	return files;
}

function collectVarReferences(rootDir) {
	const refs = new Map();
	for (const filePath of collectFiles(rootDir)) {
		const source = readFileSync(filePath, 'utf8');
		for (const match of source.matchAll(/var\(--([a-z][a-z0-9-]*)/g)) {
			const token = `--${match[1]}`;
			refs.set(token, (refs.get(token) ?? 0) + 1);
		}
	}
	return refs;
}

function collectTokenDefinitions(filePaths) {
	const defs = new Set();
	for (const filePath of filePaths) {
		const source = readFileSync(filePath, 'utf8');
		for (const match of source.matchAll(/^\s*(--[a-z][a-z0-9-]*)\s*:/gm)) {
			defs.add(match[1]);
		}
	}
	return defs;
}

const used = collectVarReferences(WEB_SRC_ROOT);
const defined = collectTokenDefinitions(TOKEN_FILES);
const undefinedTokens = [...used.entries()]
	.filter(([token]) => !defined.has(token) && !RUNTIME_ALLOWED.has(token))
	.sort((left, right) => left[0].localeCompare(right[0]));

if (undefinedTokens.length > 0) {
	console.error('Undefined token references detected:');
	for (const [token, count] of undefinedTokens) {
		console.error(`- ${token}: ${count}`);
	}
	process.exit(1);
}

console.log('Token audit passed: no undefined token references.');
