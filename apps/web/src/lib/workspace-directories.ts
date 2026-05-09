export interface WorkspaceDirectoryEntry {
	readonly depth: number;
	readonly name: string;
	readonly relative_path: string;
}

export interface WorkspaceDirectoryListResponse {
	readonly directories: readonly WorkspaceDirectoryEntry[];
	readonly workspace_root_name: string;
}

interface WorkspaceDirectoryEntryCandidate extends Record<string, unknown> {
	readonly depth?: unknown;
	readonly name?: unknown;
	readonly relative_path?: unknown;
}

interface WorkspaceDirectoryListResponseCandidate extends Record<string, unknown> {
	readonly directories?: unknown;
	readonly workspace_root_name?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkspaceDirectoryEntry(value: unknown): value is WorkspaceDirectoryEntry {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as WorkspaceDirectoryEntryCandidate;

	return (
		typeof candidate.depth === 'number' &&
		Number.isInteger(candidate.depth) &&
		candidate.depth >= 0 &&
		typeof candidate.name === 'string' &&
		typeof candidate.relative_path === 'string'
	);
}

function isWorkspaceDirectoryListResponse(value: unknown): value is WorkspaceDirectoryListResponse {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as WorkspaceDirectoryListResponseCandidate;

	return (
		Array.isArray(candidate.directories) &&
		candidate.directories.every((entry) => isWorkspaceDirectoryEntry(entry)) &&
		typeof candidate.workspace_root_name === 'string'
	);
}

async function readErrorMessage(response: Response): Promise<string> {
	const text = (await response.text()).trim();

	if (text.length > 0) {
		return text;
	}

	return `Workspace directories request failed with status ${response.status}.`;
}

export async function fetchWorkspaceDirectories(input: {
	readonly bearerToken?: string | null;
	readonly signal?: AbortSignal;
}): Promise<WorkspaceDirectoryListResponse> {
	const headers = new Headers({
		accept: 'application/json',
	});

	const token = input.bearerToken?.trim();
	if (token && token.length > 0) {
		headers.set('authorization', `Bearer ${token}`);
	}

	const response = await fetch('/workspace/directories', {
		cache: 'no-store',
		credentials: 'same-origin',
		headers,
		method: 'GET',
		signal: input.signal,
	});

	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}

	const parsed = (await response.json()) as unknown;

	if (!isWorkspaceDirectoryListResponse(parsed)) {
		throw new Error('Workspace directories response did not match the expected shape.');
	}

	return parsed;
}
