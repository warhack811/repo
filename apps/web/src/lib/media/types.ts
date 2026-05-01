export type MediaJobStatus =
	| 'queued'
	| 'preparing'
	| 'generating'
	| 'refining'
	| 'completed'
	| 'failed'
	| 'cancelled';

export type MediaJobKind = 'image-generation' | 'image-edit' | 'image-variation';

export type MediaJob = {
	id: string;
	kind: MediaJobKind;
	status: MediaJobStatus;
	progress: number | null;
	queue_position: number | null;
	prompt: string;
	parameters: Record<string, unknown>;
	preview_url: string | null;
	result_urls: string[];
	error: { code: string; message: string } | null;
	created_at: string;
	estimated_completion_at: string | null;
};

export type MediaPack = {
	jobs: MediaJob[];
};
