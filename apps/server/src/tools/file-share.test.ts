import type { AuthContext, ToolExecutionContext } from '@runa/types';
import { describe, expect, it, vi } from 'vitest';

import { createFileShareTool } from './file-share.js';

const authContext: AuthContext = {
	principal: {
		kind: 'authenticated',
		provider: 'supabase',
		role: 'authenticated',
		scope: {
			tenant_id: 'tenant_1',
			workspace_id: 'workspace_1',
			workspace_ids: ['workspace_1'],
		},
		user_id: 'user_1',
	},
	transport: 'websocket',
};

function createInput(
	content = '# Report',
): Parameters<ReturnType<typeof createFileShareTool>['execute']>[0] {
	return {
		arguments: {
			content,
			filename: 'report.md',
			mime_type: 'text/markdown',
		},
		call_id: 'call_file_share',
		tool_name: 'file.share',
	};
}

function createContext(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
	return {
		auth_context: authContext,
		create_storage_download_url: () => ({
			expires_at: '2026-04-25T12:15:00.000Z',
			url: '/storage/download/blob_file_share?expires_at=2026-04-25T12%3A15%3A00.000Z&signature=sig',
		}),
		run_id: 'run_file_share',
		storage_service: {
			upload_blob: vi.fn().mockResolvedValue({
				blob_id: 'blob_file_share',
				size_bytes: Buffer.byteLength('# Report'),
			}),
		},
		trace_id: 'trace_file_share',
		...overrides,
	};
}

describe('file.share tool', () => {
	it('stores content as a scoped tool_output artifact and returns an expiring URL', async () => {
		const tool = createFileShareTool();
		const context = createContext();
		const result = await tool.execute(createInput(), context);

		expect(result.status).toBe('success');

		if (result.status !== 'success') {
			throw new Error('Expected file.share to succeed.');
		}

		expect(context.storage_service?.upload_blob).toHaveBeenCalledWith({
			auth: authContext,
			content_base64: Buffer.from('# Report').toString('base64'),
			content_type: 'text/markdown',
			filename: 'report.md',
			kind: 'tool_output',
			run_id: 'run_file_share',
			trace_id: 'trace_file_share',
		});
		expect(result.artifact_ref).toEqual({
			artifact_id: 'blob_file_share',
			kind: 'external',
		});
		expect(result.output).toEqual({
			blob_id: 'blob_file_share',
			expires_at: '2026-04-25T12:15:00.000Z',
			filename: 'report.md',
			mime_type: 'text/markdown',
			size_bytes: Buffer.byteLength('# Report'),
			storage_ref: 'blob_file_share',
			url: '/storage/download/blob_file_share?expires_at=2026-04-25T12%3A15%3A00.000Z&signature=sig',
		});
	});

	it('returns typed errors without storage context or content', async () => {
		const tool = createFileShareTool();
		const noStorageResult = await tool.execute(
			createInput(),
			createContext({
				storage_service: undefined,
			}),
		);
		const emptyContentResult = await tool.execute(createInput(''), createContext());

		expect(noStorageResult).toMatchObject({
			error_code: 'EXECUTION_FAILED',
			status: 'error',
		});
		expect(emptyContentResult).toMatchObject({
			error_code: 'INVALID_INPUT',
			status: 'error',
		});
	});
});
