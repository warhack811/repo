#!/usr/bin/env node
// Runa UI Manifesto Compliance Check
//
// Manifesto: Chat surface'da operator/dev affordance veya ham auth/transport dili
// görünmez. Bu script chat-first user surface'larında yasaklı kelimeleri tarar.
//
// Allowlist: test dosyaları (*.test.tsx, *.test.ts) muaf — testler "bu metin
// görünmemeli" assertion'ı için kelime referansı taşıyabilir.

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = join(SCRIPT_PATH, '..', '..', '..');

// Patterns target user-visible strings (JSX text, quoted literals).
// Identifier accesses like `authContext.principal.kind` are NOT user-visible
// and are excluded via negative lookbehind/lookahead on `.` or word chars.
const IDENT_BOUNDARY_PREFIX = '(?<![\\w.])';
const IDENT_BOUNDARY_SUFFIX = '(?![\\w.])';

function userVisible(phrase) {
	const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`${IDENT_BOUNDARY_PREFIX}${escaped}${IDENT_BOUNDARY_SUFFIX}`, 'i');
}

const FORBIDDEN_PATTERNS = Object.freeze([
	{ name: 'Raw Transport', pattern: userVisible('Raw Transport') },
	{ name: 'Model Override', pattern: userVisible('Model Override') },
	{ name: 'principal', pattern: userVisible('principal') },
	{ name: 'stored token', pattern: userVisible('stored token') },
	{ name: 'bearer token', pattern: userVisible('bearer token') },
	{ name: 'transport messages', pattern: userVisible('transport messages') },
	{ name: 'minimum seam', pattern: userVisible('minimum seam') },
	{ name: 'ham transport', pattern: userVisible('ham transport') },
]);

const SCAN_ROOTS = Object.freeze([
	'apps/web/src/components/chat',
	'apps/web/src/components/auth',
	'apps/web/src/components/approval',
	'apps/web/src/components/desktop',
	'apps/web/src/components/settings',
	'apps/web/src/components/ui',
	'apps/web/src/pages',
]);

const PAGES_ALLOWLIST = new Set([
	'apps/web/src/pages/DeveloperPage.tsx',
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
	if (!/\.(?:tsx?|jsx?)$/.test(relPath)) {
		return false;
	}
	if (/\.(?:test|spec)\.(?:tsx?|jsx?)$/.test(relPath)) {
		return false;
	}
	const normalized = relPath.split(sep).join('/');
	if (PAGES_ALLOWLIST.has(normalized)) {
		return false;
	}
	return true;
}

async function scanFile(absPath, relPath) {
	const violations = [];
	const content = await readFile(absPath, 'utf8');
	const lines = content.split(/\r?\n/);

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];
		for (const { name, pattern } of FORBIDDEN_PATTERNS) {
			if (pattern.test(line)) {
				violations.push({
					file: relPath,
					line: lineIndex + 1,
					term: name,
					excerpt: line.trim().slice(0, 160),
				});
			}
		}
	}

	return violations;
}

async function main() {
	const allViolations = [];

	for (const scanRoot of SCAN_ROOTS) {
		const absRoot = join(REPO_ROOT, scanRoot);
		for await (const filePath of walk(absRoot)) {
			const relPath = relative(REPO_ROOT, filePath);
			if (!shouldScan(relPath)) {
				continue;
			}
			const fileViolations = await scanFile(filePath, relPath);
			allViolations.push(...fileViolations);
		}
	}

	if (allViolations.length === 0) {
		process.stdout.write('MANIFESTO_CHECK PASS\n');
		process.stdout.write(
			JSON.stringify(
				{
					result: 'PASS',
					scanned_roots: SCAN_ROOTS,
					forbidden_patterns: FORBIDDEN_PATTERNS.map((p) => p.name),
					violations: 0,
				},
				null,
				2,
			),
		);
		process.stdout.write('\n');
		process.exit(0);
	}

	process.stderr.write('MANIFESTO_CHECK FAIL\n');
	for (const violation of allViolations) {
		process.stderr.write(
			`  ${violation.file}:${violation.line} [${violation.term}] ${violation.excerpt}\n`,
		);
	}
	process.stderr.write(
		JSON.stringify(
			{
				result: 'FAIL',
				violations: allViolations.length,
				details: allViolations,
			},
			null,
			2,
		),
	);
	process.stderr.write('\n');
	process.exit(1);
}

void main();
