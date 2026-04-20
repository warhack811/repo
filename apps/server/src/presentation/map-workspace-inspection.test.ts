import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { composeWorkspaceContext } from '../context/compose-workspace-context.js';
import { mapWorkspaceInspectionToBlock } from './map-workspace-inspection.js';

const tempDirectories: string[] = [];
const createdAt = '2026-04-11T15:00:00.000Z';

async function createTempWorkspace(): Promise<string> {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'runa-workspace-inspection-'));
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

describe('map-workspace-inspection', () => {
	it('maps a workspace layer into a deterministic workspace_inspection_block', async () => {
		const workspaceDirectory = await createTempWorkspace();

		await writeFile(
			path.join(workspaceDirectory, 'package.json'),
			JSON.stringify(
				{
					dependencies: {
						fastify: '^5.0.0',
						react: '^19.0.0',
						vite: '^7.0.0',
					},
					devDependencies: {
						turbo: '^2.0.0',
						typescript: '^5.9.0',
						vitest: '^3.0.0',
					},
					name: 'runa-inspection',
					scripts: {
						build: 'turbo build',
						dev: 'turbo dev',
						lint: 'biome check .',
						test: 'vitest run',
						typecheck: 'tsc --noEmit',
					},
					workspaces: ['apps/*', 'packages/*'],
				},
				null,
				2,
			),
		);
		await Promise.all(
			['apps', 'docs', 'packages', 'scripts'].map(async (entry) =>
				mkdir(path.join(workspaceDirectory, entry)),
			),
		);
		await writeFile(
			path.join(workspaceDirectory, 'pnpm-workspace.yaml'),
			'packages:\n  - apps/*\n',
		);
		await writeFile(path.join(workspaceDirectory, 'turbo.json'), '{ "tasks": {} }\n');

		const workspaceContext = await composeWorkspaceContext({
			working_directory: workspaceDirectory,
		});

		expect(workspaceContext.status).toBe('workspace_layer_created');

		if (workspaceContext.status !== 'workspace_layer_created') {
			throw new Error('Expected workspace_layer_created result.');
		}

		const block = mapWorkspaceInspectionToBlock({
			created_at: createdAt,
			run_id: 'run_workspace_inspection',
			workspace_layer: workspaceContext.workspace_layer,
		});

		expect(block).toEqual({
			created_at: createdAt,
			id: 'workspace_inspection_block:run_workspace_inspection',
			payload: {
				inspection_notes: ['Key scripts: dev, build, test, lint, typecheck.'],
				last_search_summary: undefined,
				project_name: 'runa-inspection',
				project_type_hints: [
					'monorepo',
					'turborepo',
					'react',
					'vite',
					'typescript',
					'fastify-server',
				],
				summary:
					'runa-inspection is a monorepo-style TypeScript workspace with an apps/packages layout, pnpm workspace and Turborepo signals, and React, Vite, and Fastify hints.',
				title: 'runa-inspection',
				top_level_signals: ['apps', 'packages', 'pnpm-workspace.yaml', 'turbo.json', 'docs'],
			},
			schema_version: 1,
			type: 'workspace_inspection_block',
		});
	});

	it('preserves a last_search_summary and caller-supplied inspection notes', async () => {
		const workspaceDirectory = await createTempWorkspace();

		await writeFile(
			path.join(workspaceDirectory, 'package.json'),
			JSON.stringify(
				{
					name: 'runa-inspection-notes',
					scripts: {
						dev: 'vite',
					},
				},
				null,
				2,
			),
		);
		await mkdir(path.join(workspaceDirectory, 'src'));

		const workspaceContext = await composeWorkspaceContext({
			working_directory: workspaceDirectory,
		});

		if (workspaceContext.status !== 'workspace_layer_created') {
			throw new Error('Expected workspace_layer_created result.');
		}

		const block = mapWorkspaceInspectionToBlock({
			created_at: createdAt,
			inspection_notes: [
				'Latest run is ready for the next model turn.',
				'Latest run is ready for the next model turn.',
			],
			last_search_summary: ' Found 1 codebase match for "needle". ',
			workspace_layer: workspaceContext.workspace_layer,
		});

		expect(block.payload).toMatchObject({
			inspection_notes: ['Key scripts: dev.', 'Latest run is ready for the next model turn.'],
			last_search_summary: 'Found 1 codebase match for "needle".',
			project_name: 'runa-inspection-notes',
			title: 'runa-inspection-notes',
			top_level_signals: ['src'],
		});
	});

	it('does not repeat the workspace summary or latest search inside inspection notes', async () => {
		const workspaceDirectory = await createTempWorkspace();

		await writeFile(
			path.join(workspaceDirectory, 'package.json'),
			JSON.stringify(
				{
					name: 'runa-inspection-dedupe',
					scripts: {
						dev: 'vite',
					},
				},
				null,
				2,
			),
		);
		await mkdir(path.join(workspaceDirectory, 'src'));

		const workspaceContext = await composeWorkspaceContext({
			working_directory: workspaceDirectory,
		});

		if (workspaceContext.status !== 'workspace_layer_created') {
			throw new Error('Expected workspace_layer_created result.');
		}

		const block = mapWorkspaceInspectionToBlock({
			created_at: createdAt,
			inspection_notes: [
				workspaceContext.workspace_layer.content.summary,
				'Found 1 codebase match for "needle".',
				'Focused workspace context is ready.',
			],
			last_search_summary: 'Found 1 codebase match for "needle".',
			workspace_layer: workspaceContext.workspace_layer,
		});

		expect(block.payload.inspection_notes).toEqual([
			'Key scripts: dev.',
			'Focused workspace context is ready.',
		]);
	});

	it('returns the same inspection block for the same input', async () => {
		const workspaceDirectory = await createTempWorkspace();

		await writeFile(
			path.join(workspaceDirectory, 'package.json'),
			JSON.stringify(
				{
					name: 'runa-inspection-repeat',
				},
				null,
				2,
			),
		);
		await mkdir(path.join(workspaceDirectory, 'src'));

		const workspaceContext = await composeWorkspaceContext({
			working_directory: workspaceDirectory,
		});

		if (workspaceContext.status !== 'workspace_layer_created') {
			throw new Error('Expected workspace_layer_created result.');
		}

		const input = {
			created_at: createdAt,
			last_search_summary: 'Found 0 codebase matches for "needle".',
			run_id: 'run_repeat_inspection',
			workspace_layer: workspaceContext.workspace_layer,
		} as const;

		const first = mapWorkspaceInspectionToBlock(input);
		const second = mapWorkspaceInspectionToBlock(input);

		expect(first).toEqual(second);
	});
});
