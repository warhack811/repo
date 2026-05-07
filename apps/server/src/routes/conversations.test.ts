import type { AuthContext, RenderBlock } from '@runa/types';
import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

import { registerConversationRoutes } from './conversations.js';

function createAuthContext(): AuthContext {
	return {
		bearer_token_present: true,
		principal: {
			kind: 'authenticated',
			provider: 'internal',
			role: 'authenticated',
			scope: {
				tenant_id: 'tenant_1',
				workspace_id: 'workspace_1',
			},
			session_id: 'session_1',
			user_id: 'user_1',
		},
		request_id: 'req_conversation_blocks_test',
		transport: 'http',
	};
}

describe('conversation routes', () => {
	it('returns persisted work narration blocks from the conversation reload endpoint', async () => {
		const workNarrationBlock: RenderBlock = {
			created_at: '2026-05-05T12:00:00.000Z',
			id: 'nar_1',
			payload: {
				linked_tool_call_id: 'call_1',
				locale: 'tr',
				run_id: 'run_1',
				sequence_no: 12,
				status: 'superseded',
				text: 'package.json kontrol ediyorum.',
				turn_index: 1,
			},
			schema_version: 1,
			type: 'work_narration',
		};
		const server = Fastify();
		server.addHook('onRequest', async (request) => {
			request.auth = createAuthContext();
		});

		await registerConversationRoutes(server, {
			list_conversation_run_blocks: vi.fn(async () => [
				{
					block_record_id: 'block_record_1',
					blocks: [workNarrationBlock],
					conversation_id: 'conversation_1',
					created_at: '2026-05-05T12:00:01.000Z',
					run_id: 'run_1',
					trace_id: 'trace_1',
				},
			]),
		});

		const response = await server.inject({
			method: 'GET',
			url: '/conversations/conversation_1/blocks',
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			conversation_id: 'conversation_1',
			run_surfaces: [
				{
					block_record_id: 'block_record_1',
					blocks: [workNarrationBlock],
					conversation_id: 'conversation_1',
					created_at: '2026-05-05T12:00:01.000Z',
					run_id: 'run_1',
					trace_id: 'trace_1',
				},
			],
		});

		await server.close();
	});
});
