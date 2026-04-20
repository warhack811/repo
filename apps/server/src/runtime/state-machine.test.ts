import { describe, expect, it } from 'vitest';

import {
	InvalidStateTransitionError,
	canTransition,
	getAllowedNextStates,
	transitionState,
} from './state-machine.js';

describe('state-machine', () => {
	it('allows INIT to MODEL_THINKING', () => {
		expect(canTransition('INIT', 'MODEL_THINKING')).toBe(true);
		expect(transitionState('INIT', 'MODEL_THINKING')).toBe('MODEL_THINKING');
	});

	it('allows MODEL_THINKING to TOOL_EXECUTING', () => {
		expect(canTransition('MODEL_THINKING', 'TOOL_EXECUTING')).toBe(true);
		expect(transitionState('MODEL_THINKING', 'TOOL_EXECUTING')).toBe('TOOL_EXECUTING');
	});

	it('allows MODEL_THINKING to WAITING_APPROVAL', () => {
		expect(canTransition('MODEL_THINKING', 'WAITING_APPROVAL')).toBe(true);
		expect(transitionState('MODEL_THINKING', 'WAITING_APPROVAL')).toBe('WAITING_APPROVAL');
	});

	it('allows WAITING_APPROVAL to MODEL_THINKING', () => {
		expect(canTransition('WAITING_APPROVAL', 'MODEL_THINKING')).toBe(true);
		expect(transitionState('WAITING_APPROVAL', 'MODEL_THINKING')).toBe('MODEL_THINKING');
	});

	it('allows WAITING_APPROVAL to FAILED', () => {
		expect(canTransition('WAITING_APPROVAL', 'FAILED')).toBe(true);
		expect(transitionState('WAITING_APPROVAL', 'FAILED')).toBe('FAILED');
	});

	it('allows TOOL_EXECUTING to TOOL_RESULT_INGESTING', () => {
		expect(canTransition('TOOL_EXECUTING', 'TOOL_RESULT_INGESTING')).toBe(true);
		expect(transitionState('TOOL_EXECUTING', 'TOOL_RESULT_INGESTING')).toBe(
			'TOOL_RESULT_INGESTING',
		);
	});

	it('allows TOOL_RESULT_INGESTING to MODEL_THINKING', () => {
		expect(canTransition('TOOL_RESULT_INGESTING', 'MODEL_THINKING')).toBe(true);
		expect(transitionState('TOOL_RESULT_INGESTING', 'MODEL_THINKING')).toBe('MODEL_THINKING');
	});

	it('allows MODEL_THINKING to COMPLETED', () => {
		expect(canTransition('MODEL_THINKING', 'COMPLETED')).toBe(true);
		expect(transitionState('MODEL_THINKING', 'COMPLETED')).toBe('COMPLETED');
	});

	it('allows MODEL_THINKING to FAILED', () => {
		expect(canTransition('MODEL_THINKING', 'FAILED')).toBe(true);
		expect(transitionState('MODEL_THINKING', 'FAILED')).toBe('FAILED');
	});

	it('rejects COMPLETED to MODEL_THINKING', () => {
		expect(canTransition('COMPLETED', 'MODEL_THINKING')).toBe(false);
		expect(getAllowedNextStates('COMPLETED')).toEqual([]);
		expect(() => transitionState('COMPLETED', 'MODEL_THINKING')).toThrowError(
			InvalidStateTransitionError,
		);
	});

	it('rejects COMPLETED to TOOL_EXECUTING', () => {
		expect(canTransition('COMPLETED', 'TOOL_EXECUTING')).toBe(false);
		expect(() => transitionState('COMPLETED', 'TOOL_EXECUTING')).toThrowError(
			InvalidStateTransitionError,
		);
	});

	it('rejects COMPLETED to WAITING_APPROVAL', () => {
		expect(canTransition('COMPLETED', 'WAITING_APPROVAL')).toBe(false);
		expect(() => transitionState('COMPLETED', 'WAITING_APPROVAL')).toThrowError(
			InvalidStateTransitionError,
		);
	});

	it('rejects FAILED to MODEL_THINKING', () => {
		expect(canTransition('FAILED', 'MODEL_THINKING')).toBe(false);
		expect(getAllowedNextStates('FAILED')).toEqual([]);
		expect(() => transitionState('FAILED', 'MODEL_THINKING')).toThrowError(
			InvalidStateTransitionError,
		);
	});

	it('rejects TOOL_RESULT_INGESTING to COMPLETED', () => {
		expect(canTransition('TOOL_RESULT_INGESTING', 'COMPLETED')).toBe(false);
		expect(() => transitionState('TOOL_RESULT_INGESTING', 'COMPLETED')).toThrowError(
			InvalidStateTransitionError,
		);
	});

	it('rejects WAITING_APPROVAL to TOOL_EXECUTING', () => {
		expect(canTransition('WAITING_APPROVAL', 'TOOL_EXECUTING')).toBe(false);
		expect(() => transitionState('WAITING_APPROVAL', 'TOOL_EXECUTING')).toThrowError(
			InvalidStateTransitionError,
		);
	});
});
