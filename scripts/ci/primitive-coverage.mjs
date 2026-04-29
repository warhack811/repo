#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = join(SCRIPT_PATH, '..', '..', '..');
const SCAN_ROOT = 'apps/web/src/components';
const NATIVE_INTERACTIVE_PATTERN = /<(?:button|input|textarea|select)\b/gu;
const PRIMITIVE_PATTERN = /<Runa[A-Z][A-Za-z0-9]*\b/gu;

async function* walk(dir) {
	for (const entry of await readdir(dir)) {
		const full = join(dir, entry);
		const info = await stat(full);
		if (info.isDirectory()) {
			yield* walk(full);
		} else if (
			info.isFile() &&
			/\.(?:tsx|jsx)$/u.test(entry) &&
			!/\.(?:test|spec)\./u.test(entry)
		) {
			yield full;
		}
	}
}

function countMatches(content, pattern) {
	return [...content.matchAll(pattern)].length;
}

async function main() {
	const files = [];
	let primitiveTotal = 0;
	let nativeInteractiveTotal = 0;

	for await (const filePath of walk(join(REPO_ROOT, SCAN_ROOT))) {
		const relPath = relative(REPO_ROOT, filePath).split(sep).join('/');
		const content = await readFile(filePath, 'utf8');
		const primitiveCount = countMatches(content, PRIMITIVE_PATTERN);
		const nativeInteractiveCount = countMatches(content, NATIVE_INTERACTIVE_PATTERN);

		if (primitiveCount > 0 || nativeInteractiveCount > 0) {
			files.push({ file: relPath, primitiveCount, nativeInteractiveCount });
		}

		primitiveTotal += primitiveCount;
		nativeInteractiveTotal += nativeInteractiveCount;
	}

	process.stdout.write('PRIMITIVE_COVERAGE REPORT\n');
	process.stdout.write(
		JSON.stringify(
			{
				result: 'REPORT',
				primitive_total: primitiveTotal,
				native_interactive_total: nativeInteractiveTotal,
				note:
					nativeInteractiveTotal > primitiveTotal
						? 'Native interactive usage is still higher than Runa primitive usage; keep migrating opportunistically.'
						: 'Runa primitive usage is at or above native interactive usage.',
				files,
			},
			null,
			2,
		),
	);
	process.stdout.write('\n');
}

void main();
