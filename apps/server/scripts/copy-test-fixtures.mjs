import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const SOURCE_ROOT = resolve('src');
const DIST_ROOT = resolve('dist');
const FIXTURE_DIRECTORY_NAME = '__fixtures__';

async function collectFixtureDirectories(rootPath) {
	const entries = await readdir(rootPath, { withFileTypes: true });
	const fixtureDirectories = [];

	for (const entry of entries) {
		const entryPath = join(rootPath, entry.name);

		if (!entry.isDirectory()) {
			continue;
		}

		if (entry.name === FIXTURE_DIRECTORY_NAME) {
			fixtureDirectories.push(entryPath);
			continue;
		}

		fixtureDirectories.push(...(await collectFixtureDirectories(entryPath)));
	}

	return fixtureDirectories;
}

async function main() {
	const fixtureDirectories = await collectFixtureDirectories(SOURCE_ROOT);

	for (const sourceDirectory of fixtureDirectories) {
		const relativeDirectory = relative(SOURCE_ROOT, sourceDirectory);
		const targetDirectory = join(DIST_ROOT, relativeDirectory);

		await mkdir(dirname(targetDirectory), { recursive: true });
		await cp(sourceDirectory, targetDirectory, { recursive: true });
	}
}

await main();
