import type { MediaPack } from '../../lib/media/types';

export const futureMediaFixture: MediaPack = {
	jobs: [
		{
			created_at: '2026-05-01T00:00:00.000Z',
			error: null,
			estimated_completion_at: null,
			id: 'media_job_fixture',
			kind: 'image-generation',
			parameters: {},
			preview_url: null,
			progress: null,
			prompt: 'Runa workspace hero image',
			queue_position: null,
			result_urls: [],
			status: 'queued',
		},
	],
};
