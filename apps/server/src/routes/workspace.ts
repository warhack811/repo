import { readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import type { FastifyInstance } from 'fastify';

import { SupabaseAuthError } from '../auth/supabase-auth.js';
import { resolveWorkspaceRoot } from '../ws/workspace-attestation.js';

interface WorkspaceDirectoryEntry {
	readonly depth: number;
	readonly name: string;
	readonly relative_path: string;
}

interface WorkspaceDirectoriesResponse {
	readonly directories: readonly WorkspaceDirectoryEntry[];
	readonly workspace_root_name: string;
}

const MAX_DIRECTORY_ENTRIES = 500;
const MAX_DIRECTORY_DEPTH = 5;

const IGNORED_DIRECTORY_NAMES = new Set([
	'.codex-temp',
	'.git',
	'.next',
	'.turbo',
	'.vscode',
	'coverage',
	'dist',
	'node_modules',
	'tmp',
]);

interface DirectoryQueueItem {
	readonly absolute_path: string;
	readonly depth: number;
	readonly relative_path: string;
}

function normalizeRelativePath(pathValue: string): string {
	return pathValue.replaceAll('\\', '/');
}

async function listWorkspaceDirectories(
	workspaceRoot: string,
): Promise<readonly WorkspaceDirectoryEntry[]> {
	const queue: DirectoryQueueItem[] = [
		{
			absolute_path: workspaceRoot,
			depth: 0,
			relative_path: '',
		},
	];
	const directories: WorkspaceDirectoryEntry[] = [];

	while (queue.length > 0 && directories.length < MAX_DIRECTORY_ENTRIES) {
		const current = queue.shift();

		if (!current) {
			break;
		}

		if (current.depth >= MAX_DIRECTORY_DEPTH) {
			continue;
		}

		const entries = await readdir(current.absolute_path, { withFileTypes: true });
		const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));

		for (const entry of sortedEntries) {
			if (!entry.isDirectory() || entry.isSymbolicLink()) {
				continue;
			}

			if (entry.name.startsWith('.') || IGNORED_DIRECTORY_NAMES.has(entry.name)) {
				continue;
			}

			const nextRelativePath =
				current.relative_path.length === 0
					? normalizeRelativePath(entry.name)
					: normalizeRelativePath(`${current.relative_path}/${entry.name}`);
			const nextAbsolutePath = join(current.absolute_path, entry.name);
			const nextDepth = current.depth + 1;

			directories.push({
				depth: nextDepth,
				name: entry.name,
				relative_path: nextRelativePath,
			});

			if (directories.length >= MAX_DIRECTORY_ENTRIES) {
				break;
			}

			queue.push({
				absolute_path: nextAbsolutePath,
				depth: nextDepth,
				relative_path: nextRelativePath,
			});
		}
	}

	return directories;
}

export async function registerWorkspaceRoutes(server: FastifyInstance): Promise<void> {
	server.get<{ Reply: WorkspaceDirectoriesResponse }>('/workspace/directories', async (request) => {
		if (request.auth.principal.kind === 'anonymous') {
			throw new SupabaseAuthError(
				'SUPABASE_AUTH_REQUIRED',
				'Workspace directory listing requires an authenticated or service principal.',
			);
		}

		const workspaceRoot = resolveWorkspaceRoot();
		const directories = await listWorkspaceDirectories(resolve(workspaceRoot));

		return {
			directories,
			workspace_root_name: basename(workspaceRoot) || workspaceRoot,
		};
	});
}
