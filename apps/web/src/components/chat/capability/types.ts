export type CapabilityTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

export type CapabilityStatus = 'completed' | 'failed' | 'queued' | 'running' | 'waiting';

export type AssetPreviewKind = 'code' | 'document' | 'generic' | 'image' | 'screenshot';

export type AssetActionTone = 'danger' | 'primary' | 'secondary';

export type AssetPreviewItem = Readonly<{
	id: string;
	kind: AssetPreviewKind;
	title: string;
	subtitle?: string;
	previewUrl?: string;
	alt?: string;
	isSelected?: boolean;
}>;

export type CapabilityProgressStep = Readonly<{
	id: string;
	label: string;
	status: CapabilityStatus;
	description?: string;
}>;

export type CapabilityResultActionTone = 'danger' | 'primary' | 'secondary';

export type CapabilityResultAction = Readonly<{
	id: string;
	label: string;
	onClick: () => void;
	tone?: CapabilityResultActionTone;
	disabled?: boolean;
}>;

export type ActiveTaskQueueItem = Readonly<{
	id: string;
	title: string;
	status: CapabilityStatus;
	description?: string;
	tone?: CapabilityTone;
}>;
