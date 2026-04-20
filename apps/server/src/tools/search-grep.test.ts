import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ToolRegistry } from './registry.js';
import { createSearchGrepTool, searchGrepTool } from './search-grep.js';

async function createTempWorkspace(): Promise<string> {
	return mkdtemp(join(tmpdir(), 'runa-search-grep-'));
}

function createInput(
	path: string,
	query: string,
	options?: {
		readonly case_sensitive?: boolean;
		readonly include_hidden?: boolean;
		readonly max_results?: number;
	},
) {
	return {
		arguments: {
			case_sensitive: options?.case_sensitive,
			include_hidden: options?.include_hidden,
			max_results: options?.max_results,
			path,
			query,
		},
		call_id: 'call_search_grep',
		tool_name: 'search.grep' as const,
	};
}

function createContext(working_directory: string) {
	return {
		run_id: 'run_search_grep',
		trace_id: 'trace_search_grep',
		working_directory,
	};
}

describe('searchGrepTool', () => {
	it('finds a query inside a text file', async () => {
		const workspace = await createTempWorkspace();
		const filePath = join(workspace, 'notes.txt');

		try {
			await writeFile(filePath, 'alpha\nneedle here\nomega\n');

			const result = await searchGrepTool.execute(
				createInput('notes.txt', 'needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for search.grep file search.');
			}

			expect(result.output).toEqual({
				matches: [
					{
						column_end: 6,
						column_start: 0,
						line_number: 2,
						line_text: 'needle here',
						path: filePath,
					},
				],
				path: filePath,
				query: 'needle',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('searches recursively under a directory', async () => {
		const workspace = await createTempWorkspace();

		try {
			await mkdir(join(workspace, 'src'));
			await mkdir(join(workspace, 'src', 'nested'));
			await writeFile(join(workspace, 'src', 'a.txt'), 'first needle\n');
			await writeFile(join(workspace, 'src', 'nested', 'b.txt'), 'second needle\n');

			const result = await searchGrepTool.execute(
				createInput('src', 'needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for recursive directory search.');
			}

			expect(result.output.matches.map((match) => match.path)).toEqual([
				join(workspace, 'src', 'a.txt'),
				join(workspace, 'src', 'nested', 'b.txt'),
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns results in deterministic path and line order', async () => {
		const workspace = await createTempWorkspace();

		try {
			await mkdir(join(workspace, 'src'));
			await writeFile(join(workspace, 'src', 'zeta.txt'), 'needle z\n');
			await writeFile(join(workspace, 'src', 'alpha.txt'), 'needle a\nline\nneedle again\n');

			const result = await searchGrepTool.execute(
				createInput('src', 'needle'),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for deterministic ordering.');
			}

			expect(result.output.matches.map((match) => [match.path, match.line_number])).toEqual([
				[join(workspace, 'src', 'alpha.txt'), 1],
				[join(workspace, 'src', 'alpha.txt'), 3],
				[join(workspace, 'src', 'zeta.txt'), 1],
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('returns a typed error result for a missing path', async () => {
		const workspace = await createTempWorkspace();

		try {
			const result = await searchGrepTool.execute(
				createInput('missing', 'needle'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'NOT_FOUND',
				status: 'error',
				tool_name: 'search.grep',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('excludes hidden files by default and includes them when requested', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, '.secret.txt'), 'needle hidden\n');
			await writeFile(join(workspace, 'visible.txt'), 'needle visible\n');

			const defaultResult = await searchGrepTool.execute(
				createInput('.', 'needle'),
				createContext(workspace),
			);
			const hiddenResult = await searchGrepTool.execute(
				createInput('.', 'needle', { include_hidden: true }),
				createContext(workspace),
			);

			expect(defaultResult.status).toBe('success');
			expect(hiddenResult.status).toBe('success');

			if (defaultResult.status !== 'success' || hiddenResult.status !== 'success') {
				throw new Error('Expected successful hidden file filtering results.');
			}

			expect(defaultResult.output.matches.map((match) => match.path)).toEqual([
				join(workspace, 'visible.txt'),
			]);
			expect(hiddenResult.output.matches.map((match) => match.path)).toEqual([
				join(workspace, '.secret.txt'),
				join(workspace, 'visible.txt'),
			]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('supports case_sensitive matching', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, 'case.txt'), 'Needle\nneedle\n');

			const insensitiveResult = await searchGrepTool.execute(
				createInput('case.txt', 'needle'),
				createContext(workspace),
			);
			const sensitiveResult = await searchGrepTool.execute(
				createInput('case.txt', 'needle', { case_sensitive: true }),
				createContext(workspace),
			);

			expect(insensitiveResult.status).toBe('success');
			expect(sensitiveResult.status).toBe('success');

			if (insensitiveResult.status !== 'success' || sensitiveResult.status !== 'success') {
				throw new Error('Expected successful case sensitivity results.');
			}

			expect(insensitiveResult.output.matches).toHaveLength(2);
			expect(sensitiveResult.output.matches).toHaveLength(1);
			expect(sensitiveResult.output.matches[0]?.line_number).toBe(2);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('applies the max_results limit', async () => {
		const workspace = await createTempWorkspace();

		try {
			await writeFile(join(workspace, 'many.txt'), 'needle 1\nneedle 2\nneedle 3\n');

			const result = await searchGrepTool.execute(
				createInput('many.txt', 'needle', { max_results: 2 }),
				createContext(workspace),
			);

			expect(result.status).toBe('success');

			if (result.status !== 'success') {
				throw new Error('Expected a success result for max_results.');
			}

			expect(result.output.matches).toHaveLength(2);
			expect(result.output.matches.map((match) => match.line_number)).toEqual([1, 2]);
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('converts injected read failures into an error result surface', async () => {
		const workspace = await createTempWorkspace();
		const tool = createSearchGrepTool({
			readdir,
			readFile: async () => {
				throw Object.assign(new Error('simulated grep read failure'), { code: 'EIO' });
			},
			stat,
		});

		try {
			await writeFile(join(workspace, 'fail.txt'), 'needle\n');

			const result = await tool.execute(
				createInput('fail.txt', 'needle'),
				createContext(workspace),
			);

			expect(result).toMatchObject({
				error_code: 'EXECUTION_FAILED',
				status: 'error',
				tool_name: 'search.grep',
			});
		} finally {
			await rm(workspace, { force: true, recursive: true });
		}
	});

	it('is compatible with the central ToolRegistry', () => {
		const registry = new ToolRegistry();

		registry.register(searchGrepTool);

		expect(registry.has('search.grep')).toBe(true);
		expect(registry.get('search.grep')).toBe(searchGrepTool);
	});
});
