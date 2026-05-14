#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const WEB_SRC_ROOT = join('apps', 'web', 'src');
const TARGETS = [
	{
		filePath: join(WEB_SRC_ROOT, 'components', 'chat', 'blocks', 'BlockRenderer.module.css'),
		mode: 'module',
	},
	{
		filePath: join(WEB_SRC_ROOT, 'components', 'chat', 'PersistedTranscript.module.css'),
		mode: 'module',
	},
	{
		filePath: join(WEB_SRC_ROOT, 'styles', 'components.css'),
		mode: 'global',
	},
];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const TEST_FILE_PATTERN = /(^|[\\/])src[\\/](test|.*\.(test|spec)\.tsx?$)/i;

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectSourceFiles(rootDir) {
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

			if (!entry.isFile()) {
				continue;
			}

			if (!SOURCE_EXTENSIONS.has(extname(entry.name))) {
				continue;
			}

			if (TEST_FILE_PATTERN.test(absolutePath)) {
				continue;
			}

			files.push(absolutePath);
		}
	}

	return files;
}

function collectClassNames(cssSource) {
	const classNames = new Set();

	for (const match of cssSource.matchAll(/^\s*\.([a-zA-Z_][\w-]*)\s*(?=[,{])/gm)) {
		const className = match[1];
		if (className) {
			classNames.add(className);
		}
	}

	return [...classNames];
}

function isModuleClassUsed(sourceByPath, className) {
	const bracketPattern = new RegExp(`styles\\[['"]${escapeRegExp(className)}['"]\\]`, 'u');
	const dotPattern = /^[a-zA-Z_$][\w$]*$/.test(className)
		? new RegExp(`styles\\.${escapeRegExp(className)}\\b`, 'u')
		: null;

	for (const source of sourceByPath.values()) {
		if (bracketPattern.test(source)) {
			return true;
		}
		if (dotPattern && dotPattern.test(source)) {
			return true;
		}
	}

	return false;
}

function isGlobalClassUsed(sourceByPath, className) {
	const directPattern = new RegExp(`\\b${escapeRegExp(className)}\\b`, 'u');
	for (const source of sourceByPath.values()) {
		if (directPattern.test(source)) {
			return true;
		}
	}
	return false;
}

const sourceFiles = collectSourceFiles(WEB_SRC_ROOT);
const sourceByPath = new Map(
	sourceFiles.map((filePath) => [filePath, readFileSync(filePath, 'utf8')]),
);

const results = TARGETS.map((target) => {
	const cssSource = readFileSync(target.filePath, 'utf8');
	const classNames = collectClassNames(cssSource);
	const deadClasses = classNames.filter((className) => {
		if (target.mode === 'module') {
			return !isModuleClassUsed(sourceByPath, className);
		}

		return !isGlobalClassUsed(sourceByPath, className);
	});

	return {
		...target,
		classCount: classNames.length,
		deadClasses,
	};
});

const totalDead = results.reduce((count, item) => count + item.deadClasses.length, 0);
const today = new Date().toISOString().slice(0, 10);

console.log('# Dead CSS Audit Report');
console.log('');
console.log(`- Date: ${today}`);
console.log(`- Source root: \`${WEB_SRC_ROOT}\``);
console.log(`- Scope: ${results.length} files`);
console.log(`- Total dead class candidates: ${totalDead}`);
console.log('');

for (const result of results) {
	console.log(`## ${result.filePath}`);
	console.log(`- Mode: ${result.mode}`);
	console.log(`- Class definitions scanned: ${result.classCount}`);
	console.log(`- Dead class candidates: ${result.deadClasses.length}`);
	if (result.deadClasses.length === 0) {
		console.log('- Candidates: none');
	} else {
		console.log('- Candidates:');
		for (const className of result.deadClasses) {
			console.log(`  - \`${className}\``);
		}
	}
	console.log('');
}

console.log('> This script is report-only and does not remove CSS automatically.');
