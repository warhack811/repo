import { type AllowedNextState, type RuntimeState, runtimeStateTransitionMap } from '@runa/types';

export class InvalidStateTransitionError extends Error {
	readonly from: RuntimeState;
	readonly to: RuntimeState;
	readonly allowed_next_states: readonly RuntimeState[];

	constructor(from: RuntimeState, to: RuntimeState, allowedNextStates: readonly RuntimeState[]) {
		super(`Invalid runtime state transition: ${from} -> ${to}`);
		this.name = 'InvalidStateTransitionError';
		this.from = from;
		this.to = to;
		this.allowed_next_states = allowedNextStates;
	}
}

export function getAllowedNextStates<TState extends RuntimeState>(
	state: TState,
): readonly AllowedNextState<TState>[] {
	return runtimeStateTransitionMap[state];
}

export function canTransition<TFrom extends RuntimeState>(
	from: TFrom,
	to: RuntimeState,
): to is AllowedNextState<TFrom> {
	return getAllowedNextStates(from).includes(to as AllowedNextState<TFrom>);
}

export function transitionState<TFrom extends RuntimeState>(
	from: TFrom,
	to: RuntimeState,
): AllowedNextState<TFrom> {
	if (!canTransition(from, to)) {
		throw new InvalidStateTransitionError(from, to, runtimeStateTransitionMap[from]);
	}

	return to;
}
