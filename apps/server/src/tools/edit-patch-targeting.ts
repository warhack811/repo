import { isAbsolute, posix, relative, resolve } from 'node:path';

export type EditPatchHeaderParseFailureReason =
	| 'empty_patch'
	| 'invalid_patch_format'
	| 'invalid_patch_target'
	| 'missing_patch_targets'
	| 'unsupported_patch_mode';

export type EditPatchHeaderTargetsParseResult =
	| {
			readonly reason: EditPatchHeaderParseFailureReason;
			readonly status: 'error';
	  }
	| {
			readonly header_paths: readonly string[];
			readonly status: 'ok';
	  };

export interface ResolvedWorkspacePath {
	readonly escapes_workspace: boolean;
	readonly resolved_path: string;
}

export interface EditPatchApprovalTargetHint {
	readonly kind: 'file_path' | 'tool_call';
	readonly label: string;
	readonly path?: string;
}

function stripGitPatchPrefix(path: string): string {
	if (path.startsWith('a/') || path.startsWith('b/')) {
		return path.slice(2);
	}

	return path;
}

export function normalizePatchPath(rawPath: string): string | undefined {
	const tabStrippedPath = rawPath.split('\t')[0]?.trim();

	if (!tabStrippedPath || tabStrippedPath === '/dev/null') {
		return undefined;
	}

	let normalizedPath = tabStrippedPath;

	if (normalizedPath.startsWith('"') && normalizedPath.endsWith('"')) {
		normalizedPath = normalizedPath.slice(1, -1);
	}

	normalizedPath = stripGitPatchPrefix(normalizedPath.replaceAll('\\', '/').trim());

	if (normalizedPath.startsWith('./')) {
		normalizedPath = normalizedPath.slice(2);
	}

	const posixNormalizedPath = posix.normalize(normalizedPath);

	if (posixNormalizedPath === '.' || posixNormalizedPath.trim().length === 0) {
		return undefined;
	}

	return posixNormalizedPath;
}

export function parsePatchHeaderTargets(patchText: string): EditPatchHeaderTargetsParseResult {
	if (patchText.trim().length === 0) {
		return {
			reason: 'empty_patch',
			status: 'error',
		};
	}

	const lines = patchText.split(/\r?\n/u);
	const parsedPaths: string[] = [];

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? '';

		if (!line.startsWith('--- ')) {
			continue;
		}

		const nextLine = lines[index + 1] ?? '';

		if (!nextLine.startsWith('+++ ')) {
			return {
				reason: 'invalid_patch_format',
				status: 'error',
			};
		}

		const oldPath = line.slice(4).trim();
		const newPath = nextLine.slice(4).trim();

		if (oldPath === '/dev/null' || newPath === '/dev/null') {
			return {
				reason: 'unsupported_patch_mode',
				status: 'error',
			};
		}

		const normalizedNewPath = normalizePatchPath(newPath);

		if (!normalizedNewPath) {
			return {
				reason: 'invalid_patch_target',
				status: 'error',
			};
		}

		parsedPaths.push(normalizedNewPath);
	}

	if (parsedPaths.length === 0) {
		return {
			reason: 'missing_patch_targets',
			status: 'error',
		};
	}

	return {
		header_paths: [...new Set(parsedPaths)].sort((left, right) => left.localeCompare(right)),
		status: 'ok',
	};
}

export function resolvePathWithinWorkingDirectory(
	workingDirectory: string,
	inputPath: string,
): ResolvedWorkspacePath {
	const resolvedPath = resolve(workingDirectory, inputPath);
	const relativePath = relative(workingDirectory, resolvedPath);
	const escapesWorkspace = relativePath.startsWith('..') || isAbsolute(relativePath);

	return {
		escapes_workspace: escapesWorkspace,
		resolved_path: resolvedPath,
	};
}

export function canonicalPathIdentity(inputPath: string): string {
	const normalizedPath = resolve(inputPath).replaceAll('\\', '/');

	return process.platform === 'win32' ? normalizedPath.toLocaleLowerCase() : normalizedPath;
}

export function extractEditPatchTargetPath(
	argumentsValue: Readonly<Record<string, unknown>>,
): string | undefined {
	const targetPath =
		typeof argumentsValue['target_path'] === 'string'
			? argumentsValue['target_path'].trim()
			: undefined;

	return targetPath && targetPath.length > 0 ? targetPath : undefined;
}

export function resolveEditPatchApprovalTargetHint(input: {
	readonly arguments_value: Readonly<Record<string, unknown>>;
	readonly working_directory: string;
}): EditPatchApprovalTargetHint | undefined {
	const explicitTargetPath = extractEditPatchTargetPath(input.arguments_value);

	if (explicitTargetPath) {
		const resolvedTargetPath = resolvePathWithinWorkingDirectory(
			input.working_directory,
			explicitTargetPath,
		);

		if (!resolvedTargetPath.escapes_workspace) {
			return {
				kind: 'file_path',
				label: resolvedTargetPath.resolved_path,
				path: resolvedTargetPath.resolved_path,
			};
		}

		return {
			kind: 'tool_call',
			label: 'edit.patch (target_path workspace disinda)',
		};
	}

	const patchText =
		typeof input.arguments_value['patch'] === 'string' ? input.arguments_value['patch'] : '';
	const parseResult = parsePatchHeaderTargets(patchText);

	if (parseResult.status !== 'ok') {
		return {
			kind: 'tool_call',
			label: 'edit.patch (hedef cozumlenemedi)',
		};
	}

	if (parseResult.header_paths.length !== 1) {
		return {
			kind: 'tool_call',
			label: `edit.patch (multi-file: ${parseResult.header_paths.length} dosya)`,
		};
	}

	const singleHeaderPath = parseResult.header_paths[0];

	if (!singleHeaderPath) {
		return {
			kind: 'tool_call',
			label: 'edit.patch (hedef cozumlenemedi)',
		};
	}

	const resolvedHeaderPath = resolvePathWithinWorkingDirectory(
		input.working_directory,
		singleHeaderPath,
	);

	if (resolvedHeaderPath.escapes_workspace) {
		return {
			kind: 'tool_call',
			label: 'edit.patch (header path workspace disinda)',
		};
	}

	return {
		kind: 'file_path',
		label: resolvedHeaderPath.resolved_path,
		path: resolvedHeaderPath.resolved_path,
	};
}
