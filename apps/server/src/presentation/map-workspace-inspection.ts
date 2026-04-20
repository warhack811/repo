import type { WorkspaceInspectionBlock } from '@runa/types';

import type { WorkspaceLayer } from '../context/compose-workspace-context.js';

const MAX_INSPECTION_NOTES = 3;
const MAX_PROJECT_TYPE_HINTS = 6;
const MAX_SCRIPT_NAMES = 5;
const MAX_TOP_LEVEL_SIGNALS = 6;

interface MapWorkspaceInspectionInput {
	readonly created_at: string;
	readonly inspection_notes?: readonly string[];
	readonly last_search_summary?: string;
	readonly run_id?: string;
	readonly workspace_layer: WorkspaceLayer;
}

function normalizeText(value: string): string {
	return value.replace(/\s+/gu, ' ').trim();
}

function normalizeOptionalText(value: string | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const normalizedValue = normalizeText(value);

	return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function buildScriptInspectionNote(workspaceLayer: WorkspaceLayer): string | undefined {
	const visibleScripts = workspaceLayer.content.scripts.slice(0, MAX_SCRIPT_NAMES);

	if (visibleScripts.length === 0) {
		return undefined;
	}

	return `Key scripts: ${visibleScripts.join(', ')}.`;
}

function buildInspectionNotes(input: {
	readonly inspection_notes?: readonly string[];
	readonly last_search_summary?: string;
	readonly workspace_layer: WorkspaceLayer;
}): readonly string[] | undefined {
	const collectedNotes: string[] = [];
	const excludedNotes = new Set<string>();
	const seenNotes = new Set<string>();
	const normalizedSummary = normalizeOptionalText(input.workspace_layer.content.summary);
	const normalizedLastSearchSummary = normalizeOptionalText(input.last_search_summary);

	if (normalizedSummary) {
		excludedNotes.add(normalizedSummary);
	}

	if (normalizedLastSearchSummary) {
		excludedNotes.add(normalizedLastSearchSummary);
	}

	const scriptNote = buildScriptInspectionNote(input.workspace_layer);

	if (scriptNote) {
		const normalizedScriptNote = normalizeText(scriptNote);

		if (!excludedNotes.has(normalizedScriptNote)) {
			collectedNotes.push(normalizedScriptNote);
			seenNotes.add(normalizedScriptNote);
		}
	}

	for (const note of input.inspection_notes ?? []) {
		const normalizedNote = normalizeOptionalText(note);

		if (!normalizedNote || seenNotes.has(normalizedNote) || excludedNotes.has(normalizedNote)) {
			continue;
		}

		collectedNotes.push(normalizedNote);
		seenNotes.add(normalizedNote);

		if (collectedNotes.length >= MAX_INSPECTION_NOTES) {
			break;
		}
	}

	return collectedNotes.length > 0 ? collectedNotes : undefined;
}

export function mapWorkspaceInspectionToBlock(
	input: MapWorkspaceInspectionInput,
): WorkspaceInspectionBlock {
	const idSuffix = input.run_id ?? input.created_at;
	const lastSearchSummary = normalizeOptionalText(input.last_search_summary);
	const summary = normalizeText(input.workspace_layer.content.summary);
	const inspectionNotes = buildInspectionNotes({
		inspection_notes: input.inspection_notes,
		last_search_summary: lastSearchSummary,
		workspace_layer: input.workspace_layer,
	});

	return {
		created_at: input.created_at,
		id: `workspace_inspection_block:${idSuffix}`,
		payload: {
			inspection_notes: inspectionNotes,
			last_search_summary: lastSearchSummary,
			project_name: input.workspace_layer.content.project_name,
			project_type_hints: input.workspace_layer.content.project_type_hints.slice(
				0,
				MAX_PROJECT_TYPE_HINTS,
			),
			summary,
			title: normalizeText(input.workspace_layer.content.title),
			top_level_signals: input.workspace_layer.content.top_level_signals.slice(
				0,
				MAX_TOP_LEVEL_SIGNALS,
			),
		},
		schema_version: 1,
		type: 'workspace_inspection_block',
	};
}
