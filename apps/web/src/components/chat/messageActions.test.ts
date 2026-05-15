import { describe, expect, it } from 'vitest';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import {
	deriveMessageActionModel,
	getLatestAssistantMessageId,
	getLatestUserMessageId,
	getPreviousUserPrompt,
} from './messageActions.js';

function makeMessage(
	overrides: Partial<ConversationMessage> & { role: ConversationMessage['role'] },
): ConversationMessage {
	return {
		content: 'test content',
		conversation_id: 'conv-1',
		created_at: '2026-05-15T10:00:00Z',
		message_id: `msg-${Math.random().toString(36).slice(2, 8)}`,
		sequence_no: 0,
		...overrides,
	};
}

describe('getPreviousUserPrompt', () => {
	it('returns null when message not found', () => {
		const messages: readonly ConversationMessage[] = [];
		expect(getPreviousUserPrompt(messages, 'nonexistent')).toBeNull();
	});

	it('returns previous user content', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: 'first prompt', message_id: 'u1', sequence_no: 1 }),
			makeMessage({ role: 'assistant', content: 'reply', message_id: 'a1', sequence_no: 2 }),
		];
		expect(getPreviousUserPrompt(messages, 'a1')).toBe('first prompt');
	});

	it('skips messages with empty content', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', content: '', message_id: 'u1', sequence_no: 1 }),
			makeMessage({ role: 'user', content: 'second prompt', message_id: 'u2', sequence_no: 2 }),
			makeMessage({ role: 'assistant', content: 'reply', message_id: 'a1', sequence_no: 3 }),
		];
		expect(getPreviousUserPrompt(messages, 'a1')).toBe('second prompt');
	});

	it('returns null when no previous user message', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'assistant', content: 'reply', message_id: 'a1', sequence_no: 1 }),
		];
		expect(getPreviousUserPrompt(messages, 'a1')).toBeNull();
	});
});

describe('getLatestAssistantMessageId', () => {
	it('returns latest assistant message id', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', message_id: 'u1', sequence_no: 1 }),
			makeMessage({ role: 'assistant', content: 'old reply', message_id: 'a1', sequence_no: 2 }),
			makeMessage({ role: 'user', message_id: 'u2', sequence_no: 3 }),
			makeMessage({ role: 'assistant', content: 'latest reply', message_id: 'a2', sequence_no: 4 }),
		];
		expect(getLatestAssistantMessageId(messages)).toBe('a2');
	});

	it('returns null when no assistant messages', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', message_id: 'u1', sequence_no: 1 }),
		];
		expect(getLatestAssistantMessageId(messages)).toBeNull();
	});

	it('skips assistant messages with empty content', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', message_id: 'u1', sequence_no: 1 }),
			makeMessage({ role: 'assistant', content: '', message_id: 'a1', sequence_no: 2 }),
		];
		expect(getLatestAssistantMessageId(messages)).toBeNull();
	});
});

describe('getLatestUserMessageId', () => {
	it('returns latest user message id', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'user', message_id: 'u1', sequence_no: 1 }),
			makeMessage({ role: 'assistant', message_id: 'a1', sequence_no: 2 }),
			makeMessage({ role: 'user', message_id: 'u2', sequence_no: 3 }),
		];
		expect(getLatestUserMessageId(messages)).toBe('u2');
	});

	it('returns null when no user messages', () => {
		const messages: readonly ConversationMessage[] = [
			makeMessage({ role: 'assistant', message_id: 'a1', sequence_no: 1 }),
		];
		expect(getLatestUserMessageId(messages)).toBeNull();
	});
});

describe('deriveMessageActionModel', () => {
	it('system message has no actions', () => {
		const message = makeMessage({ role: 'system', content: 'system prompt' });
		const model = deriveMessageActionModel({ message, messages: [message] });
		expect(model.canCopy).toBe(false);
		expect(model.canEdit).toBe(false);
		expect(model.canRetry).toBe(false);
	});

	it('empty content has no actions', () => {
		const message = makeMessage({ role: 'user', content: '' });
		const model = deriveMessageActionModel({ message, messages: [message] });
		expect(model.canCopy).toBe(false);
		expect(model.canEdit).toBe(false);
		expect(model.canRetry).toBe(false);
	});

	it('whitespace-only content has no actions', () => {
		const message = makeMessage({ role: 'user', content: '   ' });
		const model = deriveMessageActionModel({ message, messages: [message] });
		expect(model.canCopy).toBe(false);
		expect(model.canEdit).toBe(false);
		expect(model.canRetry).toBe(false);
	});

	it('user message has copy + edit', () => {
		const message = makeMessage({ role: 'user', content: 'hello', message_id: 'u1' });
		const model = deriveMessageActionModel({ message, messages: [message] });
		expect(model.canCopy).toBe(true);
		expect(model.canEdit).toBe(true);
		expect(model.copyText).toBe('hello');
		expect(model.editPrompt).toBe('hello');
	});

	it('latest user message has retry', () => {
		const message = makeMessage({
			role: 'user',
			content: 'retry me',
			message_id: 'u1',
			sequence_no: 2,
		});
		const assistant = makeMessage({
			role: 'assistant',
			content: 'ok',
			message_id: 'a1',
			sequence_no: 1,
		});
		const model = deriveMessageActionModel({ message, messages: [assistant, message] });
		expect(model.canRetry).toBe(true);
		expect(model.retryPrompt).toBe('retry me');
	});

	it('non-latest user message has no retry', () => {
		const older = makeMessage({ role: 'user', content: 'old', message_id: 'u1', sequence_no: 1 });
		const assistant = makeMessage({
			role: 'assistant',
			content: 'ok',
			message_id: 'a1',
			sequence_no: 2,
		});
		const newer = makeMessage({ role: 'user', content: 'new', message_id: 'u2', sequence_no: 3 });
		const model = deriveMessageActionModel({ message: older, messages: [older, assistant, newer] });
		expect(model.canRetry).toBe(false);
		expect(model.retryPrompt).toBeNull();
	});

	it('assistant message has copy', () => {
		const message = makeMessage({
			role: 'assistant',
			content: 'assistant reply',
			message_id: 'a1',
		});
		const model = deriveMessageActionModel({ message, messages: [message] });
		expect(model.canCopy).toBe(true);
		expect(model.copyText).toBe('assistant reply');
		expect(model.canEdit).toBe(false);
	});

	it('latest assistant with previous user has retry', () => {
		const user = makeMessage({
			role: 'user',
			content: 'user prompt',
			message_id: 'u1',
			sequence_no: 1,
		});
		const assistant = makeMessage({
			role: 'assistant',
			content: 'assistant reply',
			message_id: 'a1',
			sequence_no: 2,
		});
		const model = deriveMessageActionModel({ message: assistant, messages: [user, assistant] });
		expect(model.canRetry).toBe(true);
		expect(model.retryPrompt).toBe('user prompt');
	});

	it('assistant without previous user has no retry', () => {
		const assistant = makeMessage({
			role: 'assistant',
			content: 'first message',
			message_id: 'a1',
		});
		const model = deriveMessageActionModel({ message: assistant, messages: [assistant] });
		expect(model.canRetry).toBe(false);
		expect(model.retryPrompt).toBeNull();
	});

	it('non-latest assistant has no retry', () => {
		const u1 = makeMessage({ role: 'user', content: 'first', message_id: 'u1', sequence_no: 1 });
		const a1 = makeMessage({
			role: 'assistant',
			content: 'reply1',
			message_id: 'a1',
			sequence_no: 2,
		});
		const u2 = makeMessage({ role: 'user', content: 'second', message_id: 'u2', sequence_no: 3 });
		const a2 = makeMessage({
			role: 'assistant',
			content: 'reply2',
			message_id: 'a2',
			sequence_no: 4,
		});
		const model = deriveMessageActionModel({ message: a1, messages: [u1, a1, u2, a2] });
		expect(model.canRetry).toBe(false);
		expect(model.retryPrompt).toBeNull();
	});

	it('isRunning=true hides retry', () => {
		const user = makeMessage({ role: 'user', content: 'prompt', message_id: 'u1', sequence_no: 1 });
		const assistant = makeMessage({
			role: 'assistant',
			content: 'reply',
			message_id: 'a1',
			sequence_no: 2,
		});
		const model = deriveMessageActionModel({
			message: assistant,
			messages: [user, assistant],
			isRunning: true,
		});
		expect(model.canRetry).toBe(false);
		expect(model.retryPrompt).toBeNull();
	});

	it('retry prompt returns correct user content', () => {
		const u1 = makeMessage({
			role: 'user',
			content: 'first prompt',
			message_id: 'u1',
			sequence_no: 1,
		});
		const a1 = makeMessage({
			role: 'assistant',
			content: 'first reply',
			message_id: 'a1',
			sequence_no: 2,
		});
		const u2 = makeMessage({
			role: 'user',
			content: 'second prompt',
			message_id: 'u2',
			sequence_no: 3,
		});
		const a2 = makeMessage({
			role: 'assistant',
			content: 'second reply',
			message_id: 'a2',
			sequence_no: 4,
		});
		const model = deriveMessageActionModel({ message: a2, messages: [u1, a1, u2, a2] });
		expect(model.retryPrompt).toBe('second prompt');
	});

	it('raw IDs are not included in action model output', () => {
		const message = makeMessage({
			role: 'user',
			content: 'hello',
			message_id: 'msg-123',
			run_id: 'run-456',
			trace_id: 'trace-789',
		});
		const model = deriveMessageActionModel({ message, messages: [message] });
		expect(model.copyText).toBe('hello');
		expect(model.copyText).not.toContain('msg-123');
		expect(model.copyText).not.toContain('run-456');
		expect(model.copyText).not.toContain('trace-789');
	});
});
