export const runtimeStates = [
	'INIT',
	'MODEL_THINKING',
	'WAITING_APPROVAL',
	'TOOL_EXECUTING',
	'TOOL_RESULT_INGESTING',
	'COMPLETED',
	'FAILED',
] as const;

export type RuntimeState = (typeof runtimeStates)[number];

export type TerminalRuntimeState = Extract<RuntimeState, 'COMPLETED' | 'FAILED'>;

export type NonTerminalRuntimeState = Exclude<RuntimeState, TerminalRuntimeState>;

export type StateTransitionMap = {
	readonly [TState in RuntimeState]: readonly RuntimeState[];
};

export const runtimeStateTransitionMap = {
	INIT: ['MODEL_THINKING', 'FAILED'],
	MODEL_THINKING: ['WAITING_APPROVAL', 'TOOL_EXECUTING', 'COMPLETED', 'FAILED'],
	WAITING_APPROVAL: ['MODEL_THINKING', 'FAILED'],
	TOOL_EXECUTING: ['TOOL_RESULT_INGESTING', 'FAILED'],
	TOOL_RESULT_INGESTING: ['MODEL_THINKING', 'FAILED'],
	COMPLETED: [],
	FAILED: [],
} as const satisfies StateTransitionMap;

export type AllowedNextState<TState extends RuntimeState> =
	(typeof runtimeStateTransitionMap)[TState][number];
