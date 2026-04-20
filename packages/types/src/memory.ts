export const memoryStatuses = ['active', 'archived', 'superseded'] as const;

export type MemoryStatus = (typeof memoryStatuses)[number];

export const memorySourceKinds = [
	'conversation',
	'tool_result',
	'user_explicit',
	'user_preference',
	'system_inferred',
] as const;

export type MemorySourceKind = (typeof memorySourceKinds)[number];

export const userPreferenceCategories = [
	'response_language',
	'response_style',
	'code_example_language',
	'test_framework',
	'tool_output_style',
] as const;

export type UserPreferenceCategory = (typeof userPreferenceCategories)[number];

export const memoryScopes = ['user', 'workspace'] as const;

export type MemoryScope = (typeof memoryScopes)[number];

export interface UserPreferenceMemory {
	readonly category: UserPreferenceCategory;
	readonly instruction: string;
	readonly scope: 'user';
	readonly source_kind: 'user_preference';
	readonly summary: string;
}

export interface MemoryWriteCandidate {
	readonly content: string;
	readonly scope: MemoryScope;
	readonly scope_id: string;
	readonly source_kind: MemorySourceKind;
	readonly source_run_id?: string;
	readonly source_trace_id?: string;
	readonly summary: string;
}

export interface NewMemoryRecord extends MemoryWriteCandidate {
	readonly archived_at?: string;
	readonly created_at: string;
	readonly memory_id: string;
	readonly status: MemoryStatus;
	readonly updated_at: string;
}

export interface MemoryRecord extends NewMemoryRecord {}
