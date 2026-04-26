import type { ModelToolCallCandidate, ToolDefinition } from '@runa/types';

export type ToolEffectClass =
	| 'agent'
	| 'browser'
	| 'clipboard'
	| 'desktop'
	| 'execute'
	| 'read'
	| 'write';

export type ToolResourceKey =
	| 'agent_delegate'
	| 'workspace'
	| 'filesystem'
	| 'browser_session'
	| 'desktop_input'
	| 'clipboard'
	| 'network'
	| 'memory';

export interface ScheduledToolCandidate<
	TCandidate extends ModelToolCallCandidate = ModelToolCallCandidate,
> {
	readonly candidate: TCandidate;
	readonly effect_class: ToolEffectClass;
	readonly requires_approval: boolean;
	readonly resource_key: ToolResourceKey;
}

export interface ScheduledToolBatch<
	TCandidate extends ModelToolCallCandidate = ModelToolCallCandidate,
> {
	readonly candidates: readonly ScheduledToolCandidate<TCandidate>[];
	readonly execution_mode: 'parallel' | 'sequential';
}

export interface ToolSchedulePlan<
	TCandidate extends ModelToolCallCandidate = ModelToolCallCandidate,
> {
	readonly batches: readonly ScheduledToolBatch<TCandidate>[];
	readonly blocked_candidate?: ScheduledToolCandidate<TCandidate>;
}

function isBrowserToolName(toolName: string): boolean {
	return toolName.startsWith('browser.');
}

function isAgentToolName(toolName: string): boolean {
	return toolName.startsWith('agent.');
}

function isClipboardToolName(toolName: string): boolean {
	return toolName.startsWith('clipboard.');
}

function isDesktopToolName(toolName: string): boolean {
	return toolName.startsWith('desktop.');
}

export function classifyToolEffectClass(
	toolDefinition: Pick<ToolDefinition, 'metadata' | 'name'>,
): ToolEffectClass {
	if (
		toolDefinition.metadata.capability_class === 'agent' ||
		isAgentToolName(toolDefinition.name)
	) {
		return 'agent';
	}

	if (
		toolDefinition.metadata.capability_class === 'desktop' ||
		isDesktopToolName(toolDefinition.name)
	) {
		return 'desktop';
	}

	if (isBrowserToolName(toolDefinition.name)) {
		return 'browser';
	}

	if (isClipboardToolName(toolDefinition.name)) {
		return 'clipboard';
	}

	if (toolDefinition.metadata.side_effect_level === 'execute') {
		return 'execute';
	}

	if (toolDefinition.metadata.side_effect_level === 'write') {
		return 'write';
	}

	return 'read';
}

export function classifyToolResourceKey(
	toolDefinition: Pick<ToolDefinition, 'metadata' | 'name'>,
): ToolResourceKey {
	if (
		toolDefinition.metadata.capability_class === 'agent' ||
		isAgentToolName(toolDefinition.name)
	) {
		return 'agent_delegate';
	}

	if (
		toolDefinition.metadata.capability_class === 'desktop' ||
		isDesktopToolName(toolDefinition.name)
	) {
		return 'desktop_input';
	}

	if (isBrowserToolName(toolDefinition.name)) {
		return 'browser_session';
	}

	if (isClipboardToolName(toolDefinition.name)) {
		return 'clipboard';
	}

	if (toolDefinition.name === 'web.search') {
		return 'network';
	}

	if (toolDefinition.name === 'search.memory') {
		return 'memory';
	}

	if (
		toolDefinition.name.startsWith('file.') ||
		toolDefinition.name.startsWith('edit.') ||
		toolDefinition.name.startsWith('git.') ||
		toolDefinition.name.startsWith('search.')
	) {
		return 'filesystem';
	}

	if (toolDefinition.metadata.capability_class === 'search') {
		return 'network';
	}

	if (toolDefinition.metadata.capability_class === 'shell') {
		return 'workspace';
	}

	return 'workspace';
}

function canJoinParallelBatch<TCandidate extends ModelToolCallCandidate = ModelToolCallCandidate>(
	candidate: ScheduledToolCandidate<TCandidate>,
	currentBatch: ScheduledToolBatch<TCandidate> | undefined,
): boolean {
	if (currentBatch === undefined || currentBatch.execution_mode !== 'parallel') {
		return false;
	}

	if (candidate.effect_class !== 'read' || candidate.requires_approval) {
		return false;
	}

	return currentBatch.candidates.every(
		(entry) =>
			entry.effect_class === 'read' &&
			entry.requires_approval !== true &&
			entry.resource_key !== candidate.resource_key,
	);
}

function flushBatch<TCandidate extends ModelToolCallCandidate = ModelToolCallCandidate>(
	batches: ScheduledToolBatch<TCandidate>[],
	currentBatch: ScheduledToolBatch<TCandidate> | undefined,
): void {
	if (currentBatch !== undefined && currentBatch.candidates.length > 0) {
		batches.push(currentBatch);
	}
}

export function planToolExecutionBatches<
	TCandidate extends ModelToolCallCandidate = ModelToolCallCandidate,
>(candidates: readonly ScheduledToolCandidate<TCandidate>[]): ToolSchedulePlan<TCandidate> {
	const batches: ScheduledToolBatch<TCandidate>[] = [];
	let currentBatch: ScheduledToolBatch<TCandidate> | undefined;

	for (const candidate of candidates) {
		if (candidate.requires_approval) {
			flushBatch(batches, currentBatch);
			return {
				batches,
				blocked_candidate: candidate,
			};
		}

		if (candidate.effect_class !== 'read') {
			flushBatch(batches, currentBatch);
			currentBatch = undefined;
			batches.push({
				candidates: [candidate],
				execution_mode: 'sequential',
			});
			continue;
		}

		if (canJoinParallelBatch(candidate, currentBatch)) {
			currentBatch = {
				candidates: [...(currentBatch?.candidates ?? []), candidate],
				execution_mode: 'parallel',
			};
			continue;
		}

		flushBatch(batches, currentBatch);
		currentBatch = {
			candidates: [candidate],
			execution_mode: 'parallel',
		};
	}

	flushBatch(batches, currentBatch);

	return {
		batches,
	};
}
