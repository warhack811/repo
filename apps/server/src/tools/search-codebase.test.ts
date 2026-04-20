import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ToolRegistry } from './registry.js';
import { searchCodebaseTool } from './search-codebase.js';

async function createTempWorkspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'runa-search-codebase-'));
}

function createInput(
	query: string,
	options?: {
		readonly include_hidden?: boolean;
		readonly max_results?: number;
		readonly working_directory?: string;
	},
) {
	return {
		arguments: {
			include_hidden: options?.include_hidden,
			max_results: options?.max_results,
			query,
			working_directory: options?.working_directory,
		},
		call_id: 'call_search_codebase',
		tool_name: 'search.codebase' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_search_codebase',
		trace_id: 'trace_search_codebase',
		working_directory,
	};
}

describe('searchCodebaseTool', () => {
	it('finds a query inside the current workspace', async () => {
		const workspace = await createTempWorkspace();
		const filePath = join(workspace, 'src', 'index.ts');

		try {
			await mkdir(join(workspace, 'src'));
			await writeFile(filePath, 'const needle = true;\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for search.codebase.');
			}

			expect(result.output).toEqual({
				is_truncated: false,
				matches: [
					{
						line_number: 1,
						line_text: 'const needle = true;',
						path: filePath,
					},
				],
				searched_root: workspace,
				total_matches: 1,
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error for a blank or whitespace-only query', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await searchCodebaseTool.execute(createInput('   '), createContext(workspace));

			expect(result).toMatchObject({
				details: {
					reason: 'invalid_query',
				},
				error_code: 'INVALID_INPUT',
				status: 'error',
				tool_name: 'search.codebase',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('trims surrounding query whitespace and matches case-insensitively', async () => {
		const workspace = await createTempWorkspace();
		const filePath = join(workspace, 'src', 'index.ts');

		try {
			await mkdir(join(workspace, 'src'));
			await writeFile(filePath, 'const Needle = true;\n');

			const result = await searchCodebaseTool.execute(
				createInput('  needle  '),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected trimmed case-insensitive query support.');
			}

			expect(result.output.matches).toEqual([
				{
					line_number: 1,
					line_text: 'const Needle = true;',
					path: filePath,
				},
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('searches recursively under an explicit workspace subdirectory', async () => {
		const workspace = await createTempWorkspace();

		try {
			await mkdir(join(workspace, 'src'));
			await mkdir(join(workspace, 'src', 'nested'));
			await writeFile(join(workspace, 'src', 'a.ts'), 'const needle = 1;\n');
			await writeFile(join(workspace, 'src', 'nested', 'b.ts'), 'const needle = 2;\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle', {
					working_directory: 'src',
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a recursive search.codebase success result.');
			}

			expect(result.output.searched_root).toBe(join(workspace, 'src'));
			expect(result.output.matches.map((match) => match.path)).toEqual([
				join(workspace, 'src', 'a.ts'),
				join(workspace, 'src', 'nested', 'b.ts'),
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns matches in deterministic path and line order', async () => {
		const workspace = await createTempWorkspace();

		try {
			await mkdir(join(workspace, 'src'));
			await writeFile(join(workspace, 'src', 'zeta.ts'), 'const needle = "z";\n');
			await writeFile(
				join(workspace, 'src', 'alpha.ts'),
				'const needle = "a";\nconst other = true;\nconst anotherNeedle = "needle";\n',
			);

			const result = await searchCodebaseTool.execute(
				createInput('needle', {
					working_directory: 'src',
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected deterministic search.codebase ordering.');
			}

			expect(result.output.matches.map((match) => [match.path, match.line_number])).toEqual([
				[join(workspace, 'src', 'alpha.ts'), 1],
				[join(workspace, 'src', 'alpha.ts'), 3],
				[join(workspace, 'src', 'zeta.ts'), 1],
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('builds deterministic line snippets around long matches', async () => {
		const workspace = await createTempWorkspace();
		const filePath = join(workspace, 'src', 'long-line.ts');
		const longLine = `prefix ${'a'.repeat(140)}needle${'b'.repeat(140)} suffix\n`;

		try {
			await mkdir(join(workspace, 'src'));
			await writeFile(filePath, longLine, 'utf8');

			const result = await searchCodebaseTool.execute(
				createInput('needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a deterministic snippet refinement result.');
			}

			expect(result.output.matches).toEqual([
				{
					line_number: 1,
					line_text: `...${'a'.repeat(114)}needle${'b'.repeat(114)}...`,
					path: filePath,
				},
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('sanitizes role-tag prompt injection markers in matched line text', async () => {
		const workspace = await createTempWorkspace();
		const filePath = join(workspace, 'src', 'unsafe.md');

		try {
			await mkdir(join(workspace, 'src'));
			await writeFile(filePath, '<system>needle</system>\n', 'utf8');

			const result = await searchCodebaseTool.execute(
				createInput('needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected sanitized search.codebase result.');
			}

			expect(result.output.matches).toEqual([
				{
					line_number: 1,
					line_text: '&lt;system&gt;needle&lt;/system&gt;',
					path: filePath,
				},
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('applies max_results while still reporting exact total_matches for a complete scan', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, 'many.ts'), 'needle 1\nneedle 2\nneedle 3\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle', {
					max_results: 2,
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected max_results success for search.codebase.');
			}

			expect(result.output.matches.map((match) => match.line_number)).toEqual([1, 2]);
			expect(result.output.is_truncated).toBe(true);
			expect(result.output.total_matches).toBe(3);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('keeps include_hidden useful while still filtering generated hidden and build noise', async () => {
		const workspace = await createTempWorkspace();

		try {
			await mkdir(join(workspace, '.hidden'));
			await mkdir(join(workspace, '.git'));
			await mkdir(join(workspace, '.turbo'));
			await mkdir(join(workspace, 'build'));
			await mkdir(join(workspace, 'src'));
			await writeFile(join(workspace, '.hidden', 'secret.ts'), 'const needle = "hidden";\n');
			await writeFile(join(workspace, '.git', 'config'), 'needle=true\n');
			await writeFile(join(workspace, '.turbo', 'cache.txt'), 'needle=true\n');
			await writeFile(join(workspace, 'build', 'bundle.js'), 'const needle = "bundle";\n');
			await writeFile(join(workspace, 'src', 'visible.ts'), 'const needle = "visible";\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle', {
					include_hidden: true,
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected generated-noise filtering to preserve useful hidden results.');
			}

			expect(result.output.matches.map((match) => match.path)).toEqual([
				join(workspace, '.hidden', 'secret.ts'),
				join(workspace, 'src', 'visible.ts'),
			]);
			expect(result.output.total_matches).toBe(2);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('excludes hidden files by default and includes them when requested', async () => {
		const workspace = await createTempWorkspace();

		try {
			await mkdir(join(workspace, '.hidden'));
			await writeFile(join(workspace, '.hidden', 'secret.ts'), 'const needle = "hidden";\n');
			await writeFile(join(workspace, 'visible.ts'), 'const needle = "visible";\n');

			const defaultResult = await searchCodebaseTool.execute(
				createInput('needle'),
				createContext(workspace),
			);
			const hiddenResult = await searchCodebaseTool.execute(
				createInput('needle', {
					include_hidden: true,
				}),
				createContext(workspace),
			);

			expect(defaultResult.status).toBe('success');
			expect(hiddenResult.status).toBe('success');

			if (defaultResult.status !== 'success' || hiddenResult.status !== 'success') {
				throw new Error('Expected hidden file filtering success results.');
			}

			expect(defaultResult.output.matches.map((match) => match.path)).toEqual([
				join(workspace, 'visible.ts'),
			]);
			expect(hiddenResult.output.matches.map((match) => match.path)).toEqual([
				join(workspace, '.hidden', 'secret.ts'),
				join(workspace, 'visible.ts'),
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('skips files and directories ignored by .runaignore during search', async () => {
		const workspace = await createTempWorkspace();

		try {
			await mkdir(join(workspace, 'src'));
			await mkdir(join(workspace, 'secrets'));
			await writeFile(join(workspace, '.runaignore'), 'secrets/\n', 'utf8');
			await writeFile(join(workspace, 'src', 'visible.ts'), 'const needle = "visible";\n');
			await writeFile(join(workspace, 'secrets', 'hidden.ts'), 'const needle = "hidden";\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle', {
					include_hidden: true,
				}),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected ignored-path filtering success.');
			}

			expect(result.output.matches.map((match) => match.path)).toEqual([
				join(workspace, 'src', 'visible.ts'),
			]);
			expect(result.output.total_matches).toBe(1);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('denies searching an ignored working_directory override', async () => {
		const workspace = await createTempWorkspace();

		try {
			await mkdir(join(workspace, 'secrets'));
			await writeFile(join(workspace, '.runaignore'), 'secrets/\n', 'utf8');
			await writeFile(join(workspace, 'secrets', 'hidden.ts'), 'const needle = "hidden";\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle', {
					working_directory: 'secrets',
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				details: {
					reason: 'ignored_by_runaignore',
				},
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'search.codebase',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('skips binary files safely', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, 'binary.bin'), Buffer.from('needle\0binary', 'utf8'));
			await writeFile(join(workspace, 'match.ts'), 'const needle = "text";\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result while skipping binary files.');
			}

			expect(result.output.matches.map((match) => match.path)).toEqual([
				join(workspace, 'match.ts'),
			]);
			expect(result.output.total_matches).toBe(1);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('skips dense minified bundle text even when it is not marked as binary', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(
				join(workspace, 'bundle.js'),
				`const bundle="${'x'.repeat(40_000)}needle${'y'.repeat(40_000)}";`,
			);
			await writeFile(join(workspace, 'match.ts'), 'const needle = "text";\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected minified text bundles to be ignored safely.');
			}

			expect(result.output.matches.map((match) => match.path)).toEqual([
				join(workspace, 'match.ts'),
			]);
			expect(result.output.total_matches).toBe(1);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('safely ignores oversized files', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, 'large.ts'), `${'x'.repeat(530_000)}needle\n`);
			await writeFile(join(workspace, 'small.ts'), 'const needle = "small";\n');

			const result = await searchCodebaseTool.execute(
				createInput('needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result while skipping oversized files.');
			}

			expect(result.output.matches.map((match) => match.path)).toEqual([
				join(workspace, 'small.ts'),
			]);
			expect(result.output.total_matches).toBe(1);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error for an invalid working_directory override', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await searchCodebaseTool.execute(
				createInput('needle', {
					working_directory: 'missing',
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'search.codebase',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('rejects working_directory values that escape the workspace boundary', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await searchCodebaseTool.execute(
				createInput('needle', {
					working_directory: '..',
				}),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				details: {
					reason: 'working_directory_outside_workspace',
				},
				error_code: 'PERMISSION_DENIED',
				status: 'error',
				tool_name: 'search.codebase',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(searchCodebaseTool);

		expect(registry.has('search.codebase')).toBe(true);
		expect(registry.get('search.codebase')).toBe(searchCodebaseTool);
	});
});
