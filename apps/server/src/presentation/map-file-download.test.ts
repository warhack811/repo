import { describe, expect, it } from 'vitest';

import { mapToolResultToFileDownloadBlock } from './map-file-download.js';

describe('mapToolResultToFileDownloadBlock', () => {
	it('maps successful file.share results to file_download blocks', () => {
		const block = mapToolResultToFileDownloadBlock({
			call_id: 'call_file_share',
			created_at: '2026-04-25T12:00:00.000Z',
			result: {
				call_id: 'call_file_share',
				output: {
					expires_at: '2026-04-25T12:15:00.000Z',
					filename: 'report.md',
					size_bytes: 42,
					url: '/storage/download/blob_report?expires_at=2026&signature=sig',
				},
				status: 'success',
				tool_name: 'file.share',
			},
			tool_name: 'file.share',
		});

		expect(block).toEqual({
			created_at: '2026-04-25T12:00:00.000Z',
			id: 'file_download:file.share:call_file_share',
			payload: {
				expires_at: '2026-04-25T12:15:00.000Z',
				filename: 'report.md',
				size_bytes: 42,
				url: '/storage/download/blob_report?expires_at=2026&signature=sig',
			},
			schema_version: 1,
			type: 'file_download',
		});
	});

	it('ignores non-file.share or malformed results', () => {
		expect(
			mapToolResultToFileDownloadBlock({
				call_id: 'call_file_read',
				created_at: '2026-04-25T12:00:00.000Z',
				result: {
					call_id: 'call_file_read',
					output: { content: 'hello' },
					status: 'success',
					tool_name: 'file.read',
				},
				tool_name: 'file.read',
			}),
		).toBeUndefined();
	});
});
