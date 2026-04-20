import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadRunaIgnoreMatcher } from './runa-ignore.js';

const tempDirectories: string[] = [];

async function createTempWorkspace(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), 'runa-ignore-'));
	tempDirectories.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		tempDirectories
			.splice(0)
			.map(async (directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe('loadRunaIgnoreMatcher', () => {
	it('always keeps default ignored paths even without .runaignore', async () => {
		const workspace = await createTempWorkspace();
		const matcher = await loadRunaIgnoreMatcher(workspace);

		expect(
			matcher.isIgnoredAbsolutePath(join(workspace, '.git', 'config'), {
				is_directory: false,
			}),
		).toBe(true);
		expect(
			matcher.isIgnoredAbsolutePath(join(workspace, 'node_modules'), {
				is_directory: true,
			}),
		).toBe(true);
	});

	it('applies custom patterns from .runaignore to files and directories', async () => {
		const workspace = await createTempWorkspace();

		await mkdir(join(workspace, 'secrets'));
		await mkdir(join(workspace, 'reports'));
		await writeFile(
			join(workspace, '.runaignore'),
			['secrets/', '*.local', '/reports/private/**'].join('\n'),
		);

		const matcher = await loadRunaIgnoreMatcher(workspace);

		expect(
			matcher.isIgnoredAbsolutePath(join(workspace, 'secrets'), {
				is_directory: true,
			}),
		).toBe(true);
		expect(
			matcher.isIgnoredAbsolutePath(join(workspace, 'secrets', 'token.txt'), {
				is_directory: false,
			}),
		).toBe(true);
		expect(
			matcher.isIgnoredAbsolutePath(join(workspace, 'env.local'), {
				is_directory: false,
			}),
		).toBe(true);
		expect(
			matcher.isIgnoredAbsolutePath(join(workspace, 'reports', 'private', 'run.md'), {
				is_directory: false,
			}),
		).toBe(true);
		expect(
			matcher.isIgnoredAbsolutePath(join(workspace, 'reports', 'public', 'run.md'), {
				is_directory: false,
			}),
		).toBe(false);
	});
});
