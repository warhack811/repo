import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');

const coreAreas = [
	['runtime', path.resolve(repoRoot, 'apps/server/src/runtime')],
	['context', path.resolve(repoRoot, 'apps/server/src/context')],
	['tools', path.resolve(repoRoot, 'apps/server/src/tools')],
	['presentation', path.resolve(repoRoot, 'apps/server/src/presentation')],
	['ws', path.resolve(repoRoot, 'apps/server/src/ws')],
];

const excludedNonBehaviorFiles = new Set([
	path.resolve(repoRoot, 'apps/server/src/runtime/index.ts'),
	path.resolve(repoRoot, 'apps/server/src/ws/messages.ts'),
]);

function walk(directoryPath) {
	const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(directoryPath, entry.name);

		if (entry.isDirectory()) {
			files.push(...walk(fullPath));
			continue;
		}

		files.push(fullPath);
	}

	return files;
}

function countNonEmptyLines(filePath) {
	return fs
		.readFileSync(filePath, 'utf8')
		.split(/\r?\n/u)
		.filter((line) => line.trim().length > 0).length;
}

function toRepoRelative(filePath) {
	return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}

const areaBreakdown = coreAreas.map(([areaName, areaRoot]) => {
	const productionFiles = walk(areaRoot).filter(
		(filePath) => filePath.endsWith('.ts') && !filePath.endsWith('.test.ts'),
	);
	const behaviorFiles = productionFiles.filter(
		(filePath) => !excludedNonBehaviorFiles.has(filePath),
	);
	const testedFiles = behaviorFiles.filter((filePath) =>
		fs.existsSync(filePath.replace(/\.ts$/u, '.test.ts')),
	);
	const totalLines = behaviorFiles.reduce((sum, filePath) => sum + countNonEmptyLines(filePath), 0);
	const testedLines = testedFiles.reduce((sum, filePath) => sum + countNonEmptyLines(filePath), 0);

	return {
		area: areaName,
		tested_files: testedFiles.length,
		tested_lines: testedLines,
		total_files: behaviorFiles.length,
		total_lines: totalLines,
		uncovered_files: behaviorFiles
			.filter((filePath) => !testedFiles.includes(filePath))
			.map((filePath) => toRepoRelative(filePath)),
	};
});

const totalFiles = areaBreakdown.reduce((sum, area) => sum + area.total_files, 0);
const testedFiles = areaBreakdown.reduce((sum, area) => sum + area.tested_files, 0);
const totalLines = areaBreakdown.reduce((sum, area) => sum + area.total_lines, 0);
const testedLines = areaBreakdown.reduce((sum, area) => sum + area.tested_lines, 0);
const fileCoveragePercent = totalFiles === 0 ? 100 : (testedFiles / totalFiles) * 100;
const lineCoveragePercent = totalLines === 0 ? 100 : (testedLines / totalLines) * 100;
const thresholdPassed = fileCoveragePercent >= 70 && lineCoveragePercent >= 70;

const summary = {
	excluded_non_behavior_files: [...excludedNonBehaviorFiles].map((filePath) =>
		toRepoRelative(filePath),
	),
	file_coverage_percent: Number(fileCoveragePercent.toFixed(2)),
	line_coverage_percent: Number(lineCoveragePercent.toFixed(2)),
	metric_kind: 'core-module companion-test coverage',
	threshold_passed: thresholdPassed,
	total_files: totalFiles,
	total_lines: totalLines,
	areas: areaBreakdown.map((area) => ({
		area: area.area,
		file_coverage_percent: Number(
			(area.total_files === 0 ? 100 : (area.tested_files / area.total_files) * 100).toFixed(2),
		),
		tested_files: area.tested_files,
		total_files: area.total_files,
		line_coverage_percent: Number(
			(area.total_lines === 0 ? 100 : (area.tested_lines / area.total_lines) * 100).toFixed(2),
		),
		tested_lines: area.tested_lines,
		total_lines: area.total_lines,
		uncovered_files: area.uncovered_files,
	})),
	uncovered_files: areaBreakdown.flatMap((area) => area.uncovered_files),
};

process.stdout.write('Core module coverage capture\n');
process.stdout.write(
	'Metric: behavior-bearing production files under runtime/context/tools/presentation/ws with sibling *.test.ts coverage.\n',
);
process.stdout.write(
	`File coverage: ${testedFiles}/${totalFiles} (${summary.file_coverage_percent}%)\n`,
);
process.stdout.write(
	`LOC-weighted coverage: ${testedLines}/${totalLines} (${summary.line_coverage_percent}%)\n`,
);
process.stdout.write(`Threshold (>70 both): ${thresholdPassed ? 'PASS' : 'FAIL'}\n`);
process.stdout.write('Area breakdown:\n');

for (const area of summary.areas) {
	process.stdout.write(
		`- ${area.area}: ${area.tested_files}/${area.total_files} files (${area.file_coverage_percent}%), ${area.tested_lines}/${area.total_lines} lines (${area.line_coverage_percent}%)\n`,
	);
}

process.stdout.write(
	`Excluded non-behavior files: ${summary.excluded_non_behavior_files.join(', ') || 'none'}\n`,
);
process.stdout.write(`Uncovered behavior files: ${summary.uncovered_files.join(', ') || 'none'}\n`);
process.stdout.write(`CORE_COVERAGE_SUMMARY ${JSON.stringify(summary)}\n`);

if (!thresholdPassed) {
	process.exitCode = 1;
}
