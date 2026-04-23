import type { InspectionDetailLevel, InspectionTargetKind, RenderBlock } from './blocks.js';
import type { RuntimeEvent } from './events.js';
import type { ModelAttachment, ModelRequest } from './gateway.js';
import type { ApprovalDecisionKind, UsageLimitRejection } from './policy.js';

export const gatewayProviders = ['claude', 'gemini', 'groq', 'openai'] as const;

export type GatewayProvider = (typeof gatewayProviders)[number];

export const defaultGatewayModels: Readonly<Record<GatewayProvider, string>> = {
	claude: 'claude-sonnet-4-5',
	gemini: 'gemini-3-flash-preview',
	groq: 'llama-3.3-70b-versatile',
	openai: 'gpt-4.1-mini',
};

export interface GatewayProviderConfig {
	readonly apiKey: string;
	readonly defaultMaxOutputTokens?: number;
	readonly defaultModel?: string;
}

export type RunRequestModelRequest = Omit<ModelRequest, 'run_id' | 'trace_id'> &
	Partial<Pick<ModelRequest, 'run_id' | 'trace_id'>>;

export interface RunRequestPayload {
	readonly attachments?: readonly ModelAttachment[];
	readonly conversation_id?: string;
	readonly include_presentation_blocks?: boolean;
	readonly provider: GatewayProvider;
	readonly provider_config: GatewayProviderConfig;
	readonly request: RunRequestModelRequest;
	readonly run_id: string;
	readonly trace_id: string;
}

export interface RunRequestClientMessage {
	readonly payload: RunRequestPayload;
	readonly type: 'run.request';
}

export type ApprovalResolveDecision = Extract<ApprovalDecisionKind, 'approved' | 'rejected'>;

export interface ApprovalResolvePayload {
	readonly approval_id: string;
	readonly decision: ApprovalResolveDecision;
	readonly note?: string;
}

export interface ApprovalResolveClientMessage {
	readonly payload: ApprovalResolvePayload;
	readonly type: 'approval.resolve';
}

export interface InspectionRequestPayload {
	readonly detail_level?: InspectionDetailLevel;
	readonly run_id: string;
	readonly target_id?: string;
	readonly target_kind: InspectionTargetKind;
}

export interface InspectionRequestClientMessage {
	readonly payload: InspectionRequestPayload;
	readonly type: 'inspection.request';
}

export type WebSocketClientMessage =
	| RunRequestClientMessage
	| ApprovalResolveClientMessage
	| InspectionRequestClientMessage;

export interface ConnectionReadyServerMessage {
	readonly message: 'ready';
	readonly transport: 'websocket';
	readonly type: 'connection.ready';
}

export interface RunAcceptedServerMessage {
	readonly payload: {
		readonly conversation_id?: string;
		readonly provider: RunRequestPayload['provider'];
		readonly run_id: string;
		readonly trace_id: string;
	};
	readonly type: 'run.accepted';
}

export interface RuntimeEventServerMessage {
	readonly payload: {
		readonly event: RuntimeEvent;
		readonly run_id: string;
		readonly trace_id: string;
	};
	readonly type: 'runtime.event';
}

export interface TextDeltaServerMessage {
	readonly payload: {
		readonly run_id: string;
		readonly text_delta: string;
		readonly trace_id: string;
	};
	readonly type: 'text.delta';
}

export interface RunRejectedServerMessage {
	readonly payload: {
		readonly error_message: string;
		readonly error_name: string;
		readonly reject_reason?: UsageLimitRejection;
		readonly run_id?: string;
		readonly trace_id?: string;
	};
	readonly type: 'run.rejected';
}

export interface PresentationBlocksServerMessage {
	readonly payload: {
		readonly blocks: readonly RenderBlock[];
		readonly run_id: string;
		readonly trace_id: string;
	};
	readonly type: 'presentation.blocks';
}

export interface RunFinishedServerMessage {
	readonly payload: {
		readonly error_message?: string;
		readonly final_state: 'COMPLETED' | 'FAILED';
		readonly run_id: string;
		readonly status: 'completed' | 'failed';
		readonly trace_id: string;
	};
	readonly type: 'run.finished';
}

export type WebSocketServerMessage =
	| ConnectionReadyServerMessage
	| RunAcceptedServerMessage
	| RuntimeEventServerMessage
	| TextDeltaServerMessage
	| RunRejectedServerMessage
	| RunFinishedServerMessage;

export type WebSocketServerBridgeMessage = WebSocketServerMessage | PresentationBlocksServerMessage;
