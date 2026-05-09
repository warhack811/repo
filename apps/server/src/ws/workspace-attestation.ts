import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

interface RequestLike {
	readonly raw?: {
		readonly url?: string;
	};
	readonly url?: string;
}

export interface WorkspaceAttestationValidationFailure {
	readonly code: 'WORKSPACE_ATTESTATION_MISMATCH';
	readonly message: string;
}

function hasWorkspaceRootMarker(directory: string): boolean {
	return (
		existsSync(resolve(directory, 'pnpm-workspace.yaml')) ||
		(existsSync(resolve(directory, '.git')) && existsSync(resolve(directory, 'package.json')))
	);
}

function normalizePathForWorkspaceId(pathValue: string): string {
	return resolve(pathValue).replaceAll('\\', '/').toLowerCase();
}

export function resolveWorkspaceRoot(startDirectory = process.cwd()): string {
	let currentDirectory = resolve(startDirectory);

	while (true) {
		if (hasWorkspaceRootMarker(currentDirectory)) {
			return currentDirectory;
		}

		const parentDirectory = dirname(currentDirectory);

		if (parentDirectory === currentDirectory) {
			return resolve(startDirectory);
		}

		currentDirectory = parentDirectory;
	}
}

export function computeWorkspaceAttestationId(workingDirectory: string): string {
	return createHash('sha256')
		.update(normalizePathForWorkspaceId(workingDirectory))
		.digest('hex')
		.slice(0, 16);
}

export function resolveExpectedWorkspaceAttestationId(startDirectory = process.cwd()): string {
	return computeWorkspaceAttestationId(resolveWorkspaceRoot(startDirectory));
}

function readWorkspaceAttestationIdFromRequest(request: RequestLike): string | undefined {
	const requestUrl = request.raw?.url ?? request.url;

	if (requestUrl === undefined) {
		return undefined;
	}

	const parsedUrl = new URL(requestUrl, 'http://localhost');
	const workspaceId = parsedUrl.searchParams.get('workspace_id');

	if (workspaceId === null) {
		return undefined;
	}

	const normalizedWorkspaceId = workspaceId.trim();

	return normalizedWorkspaceId.length > 0 ? normalizedWorkspaceId : undefined;
}

export function validateWorkspaceAttestation(
	request: RequestLike,
	expectedWorkspaceId: string,
): WorkspaceAttestationValidationFailure | undefined {
	const requestWorkspaceId = readWorkspaceAttestationIdFromRequest(request);

	if (requestWorkspaceId === undefined) {
		return undefined;
	}

	if (requestWorkspaceId !== expectedWorkspaceId) {
		return {
			code: 'WORKSPACE_ATTESTATION_MISMATCH',
			message:
				'WebSocket workspace attestation mismatch. Refresh the page and ensure the frontend targets the active backend workspace.',
		};
	}

	return undefined;
}
