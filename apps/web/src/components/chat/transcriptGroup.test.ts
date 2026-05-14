import { describe, expect, it } from 'vitest';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import { groupMessagesByDay } from './transcriptGroup.js';

function createMessage(input: {
	id: string;
	createdAt: string;
	role?: ConversationMessage['role'];
}): ConversationMessage {
	return {
		content: `message-${input.id}`,
		conversation_id: 'conv_1',
		created_at: input.createdAt,
		message_id: input.id,
		role: input.role ?? 'assistant',
		sequence_no: 1,
	};
}

describe('groupMessagesByDay', () => {
	it('returns an empty array when there are no messages', () => {
		expect(groupMessagesByDay([], new Date('2026-05-13T12:00:00+03:00'))).toEqual([]);
	});

	it('groups messages by day and hides the first divider', () => {
		const now = new Date('2026-05-13T12:00:00+03:00');
		const messages: ConversationMessage[] = [
			createMessage({ id: 'm1', createdAt: '2026-05-13T11:00:00+03:00' }),
			createMessage({ id: 'm2', createdAt: '2026-05-13T11:30:00+03:00', role: 'user' }),
			createMessage({ id: 'm3', createdAt: '2026-05-12T10:00:00+03:00' }),
			createMessage({ id: 'm4', createdAt: '2026-05-10T10:00:00+03:00' }),
		];

		const grouped = groupMessagesByDay(messages, now);

		expect(grouped).toHaveLength(3);
		expect(grouped[0]?.dayDivider).toBe(null);
		expect(grouped[0]?.messages).toHaveLength(2);
		expect(grouped[1]?.dayDivider).toBe('Dün');
		expect(grouped[2]?.dayDivider).toBe('10 Mayıs');
	});
});
