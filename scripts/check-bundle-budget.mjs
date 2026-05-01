import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = process.argv[2] ?? 'apps/web/dist';
const initialBudgetBytes = 350 * 1024;
const shikiInitialBudgetBytes = 100 * 1024;

function walk(dir) {
	const entries = readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const path = join(dir, entry.name);
		return entry.isDirectory() ? walk(path) : [path];
	});
}

function gzipBytes(path) {
	return gzipSync(readFileSync(path)).length;
}

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
	console.error(`Bundle budget failed: dist directory not found: ${distDir}`);
	process.exit(1);
}

const jsFiles = walk(distDir).filter((path) => extname(path) === '.js');
const initialFiles = jsFiles.filter((path) => /^index-[\w-]+\.js$/u.test(basename(path)));
const measuredInitialFiles = initialFiles.length > 0 ? initialFiles : jsFiles;
const initialGzipBytes = measuredInitialFiles.reduce((total, path) => total + gzipBytes(path), 0);
const mermaidInitialFiles = measuredInitialFiles.filter((path) => {
	const name = basename(path).toLowerCase();
	const content = readFileSync(path, 'utf8').toLowerCase();
	return name.includes('mermaid') || content.includes('mermaid');
});
const shikiInitialBytes = measuredInitialFiles
	.filter((path) => {
		const name = basename(path).toLowerCase();
		const content = readFileSync(path, 'utf8').toLowerCase();
		return name.includes('shiki') || content.includes('shiki');
	})
	.reduce((total, path) => total + gzipBytes(path), 0);

const failures = [];

if (initialGzipBytes > initialBudgetBytes) {
	failures.push(`initial JS gzip ${initialGzipBytes}B exceeds ${initialBudgetBytes}B`);
}

if (mermaidInitialFiles.length > 0) {
	failures.push(
		`Mermaid appears in initial JS: ${mermaidInitialFiles
			.map((path) => relative(distDir, path))
			.join(', ')}`,
	);
}

if (shikiInitialBytes > shikiInitialBudgetBytes) {
	failures.push(`Shiki initial gzip ${shikiInitialBytes}B exceeds ${shikiInitialBudgetBytes}B`);
}

console.log(
	JSON.stringify(
		{
			initial_gzip_bytes: initialGzipBytes,
			initial_files: measuredInitialFiles.map((path) => relative(distDir, path)),
			mermaid_initial_files: mermaidInitialFiles.map((path) => relative(distDir, path)),
			shiki_initial_gzip_bytes: shikiInitialBytes,
		},
		null,
		2,
	),
);

if (failures.length > 0) {
	console.error(`Bundle budget failed:\n- ${failures.join('\n- ')}`);
	process.exit(1);
}
