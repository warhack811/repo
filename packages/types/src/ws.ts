import type { InspectionDetailLevel, InspectionTargetKind, RenderBlock } from './blocks.js';
import type { RuntimeEvent } from './events.js';
import type { ModelAttachment, ModelMessage, ModelRequest } from './gateway.js';
import type { SupportedLocale } from './locale.js';
import type { ApprovalDecisionKind, UsageLimitRejection } from './policy.js';
import type { ToolArguments, ToolErrorCode } from './tools.js';

export type TransportErrorCode =
	| 'network-cut'
	| 'rate-limit'
	| 'server-error'
	| 'timeout'
	| 'unknown'
	| 'ws-disconnect';

export const gatewayProviders = [
	'claude',
	'deepseek',
	'gemini',
	'groq',
	'openai',
	'sambanova',
] as const;

export type GatewayProvider = (typeof gatewayProviders)[number];

export const defaultGatewayModels: Readonly<Record<GatewayProvider, string>> = {
	claude: 'claude-sonnet-4-5',
	deepseek: 'deepseek-v4-flash',
	gemini: 'gemini-3-flash-preview',
	groq: 'qwen/qwen3-32b',
	openai: 'gpt-4.1-mini',
	sambanova: 'DeepSeek-V3.1-cb',
};

export const approvalModes = ['ask-every-time', 'standard', 'trusted-session'] as const;

export type ApprovalMode = (typeof approvalModes)[number];

export const defaultApprovalMode: ApprovalMode = 'standard';

export interface RunApprovalPolicy {
	readonly mode: ApprovalMode;
}

export interface GatewayProviderConfig {
	readonly apiKey: string;
	readonly baseUrl?: string;
	readonly defaultMaxOutputTokens?: number;
	readonly defaultModel?: string;
}

export type PublicModelMessage = Omit<ModelMessage, 'internal_reasoning'>;

export type PublicModelRequest = Omit<ModelRequest, 'messages'> & {
	readonly messages: readonly PublicModelMessage[];
};

export type RunRequestModelRequest = Omit<PublicModelRequest, 'run_id' | 'trace_id'> &
	Partial<Pick<PublicModelRequest, 'run_id' | 'trace_id'>>;

export interface RunRequestPayload {
	readonly approval_policy?: RunApprovalPolicy;
	readonly attachments?: readonly ModelAttachment[];
	readonly conversation_id?: string;
	readonly desktop_target_connection_id?: string;
	readonly include_presentation_blocks?: boolean;
	readonly locale?: SupportedLocale;
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

export const desktopAgentProtocolVersion = 1 as const;

export type DesktopAgentProtocolVersion = typeof desktopAgentProtocolVersion;

export const desktopAgentToolNames = [
	'desktop.click',
	'desktop.clipboard.read',
	'desktop.clipboard.write',
	'desktop.keypress',
	'desktop.launch',
	'desktop.scroll',
	'desktop.screenshot',
	'desktop.type',
] as const;

export type DesktopAgentToolName = (typeof desktopAgentToolNames)[number];

export interface DesktopAgentCapability {
	readonly tool_name: DesktopAgentToolName;
}

export interface DesktopAgentHelloPayload {
	readonly agent_id: string;
	readonly capabilities: readonly DesktopAgentCapability[];
	readonly machine_label?: string;
	readonly protocol_version: DesktopAgentProtocolVersion;
}

export interface DesktopAgentHelloClientMessage {
	readonly payload: DesktopAgentHelloPayload;
	readonly type: 'desktop-agent.hello';
}

export interface DesktopAgentResultSuccessPayload {
	readonly call_id: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly output: unknown;
	readonly request_id: string;
	readonly status: 'success';
	readonly tool_name: DesktopAgentToolName;
}

export interface DesktopAgentResultErrorPayload {
	readonly call_id: string;
	readonly details?: Readonly<Record<string, unknown>>;
	readonly error_code: ToolErrorCode;
	readonly error_message: string;
	readonly request_id: string;
	readonly retryable?: boolean;
	readonly status: 'error';
	readonly tool_name: DesktopAgentToolName;
}

export type DesktopAgentResultPayload =
	| DesktopAgentResultSuccessPayload
	| DesktopAgentResultErrorPayload;

export interface DesktopAgentResultClientMessage {
	readonly payload: DesktopAgentResultPayload;
	readonly type: 'desktop-agent.result';
}

export interface DesktopAgentHeartbeatPongPayload {
	readonly ping_id: string;
	readonly received_at: string;
}

export interface DesktopAgentHeartbeatPongClientMessage {
	readonly payload: DesktopAgentHeartbeatPongPayload;
	readonly type: 'desktop-agent.heartbeat.pong';
}

export type DesktopAgentClientMessage =
	| DesktopAgentHelloClientMessage
	| DesktopAgentHeartbeatPongClientMessage
	| DesktopAgentResultClientMessage;

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
		readonly content_part_index?: number;
		readonly run_id: string;
		readonly text_delta: string;
		readonly trace_id: string;
	};
	readonly type: 'text.delta';
}

export interface TextDeltaDiscardServerMessage {
	readonly payload: {
		readonly run_id: string;
		readonly trace_id: string;
	};
	readonly type: 'text.delta.discard';
}

export interface NarrationDeltaServerMessage {
	readonly payload: {
		readonly locale: SupportedLocale;
		readonly narration_id: string;
		readonly run_id: string;
		readonly sequence_no: number;
		readonly text_delta: string;
		readonly trace_id: string;
		readonly turn_index: number;
	};
	readonly type: 'narration.delta';
}

export interface NarrationCompletedServerMessage {
	readonly payload: {
		readonly full_text: string;
		readonly narration_id: string;
		readonly run_id: string;
		readonly trace_id: string;
		readonly linked_tool_call_id?: string;
	};
	readonly type: 'narration.completed';
}

export interface NarrationSupersededServerMessage {
	readonly payload: {
		readonly narration_id: string;
		readonly run_id: string;
		readonly trace_id: string;
	};
	readonly type: 'narration.superseded';
}

export interface RunRejectedServerMessage {
	readonly payload: {
		readonly error_code?: TransportErrorCode;
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

export interface DesktopAgentConnectionReadyServerMessage {
	readonly message: 'ready';
	readonly transport: 'desktop_bridge';
	readonly type: 'desktop-agent.connection.ready';
}

export interface DesktopAgentSessionAcceptedServerMessage {
	readonly payload: {
		readonly agent_id: string;
		readonly capabilities: readonly DesktopAgentCapability[];
		readonly connection_id: string;
		readonly user_id: string;
	};
	readonly type: 'desktop-agent.session.accepted';
}

export interface DesktopAgentHeartbeatPingPayload {
	readonly ping_id: string;
	readonly sent_at: string;
}

export interface DesktopAgentHeartbeatPingServerMessage {
	readonly payload: DesktopAgentHeartbeatPingPayload;
	readonly type: 'desktop-agent.heartbeat.ping';
}

export interface DesktopAgentExecuteServerMessage {
	readonly payload: {
		readonly arguments: ToolArguments;
		readonly call_id: string;
		readonly request_id: string;
		readonly run_id: string;
		readonly tool_name: DesktopAgentToolName;
		readonly trace_id: string;
	};
	readonly type: 'desktop-agent.execute';
}

export const desktopAgentRejectCodes = [
	'INVALID_MESSAGE',
	'STALE_REQUEST',
	'UNAUTHORIZED',
	'UNSUPPORTED_PROTOCOL',
] as const;

export type DesktopAgentRejectCode = (typeof desktopAgentRejectCodes)[number];

export interface DesktopAgentRejectedServerMessage {
	readonly payload: {
		readonly error_code: DesktopAgentRejectCode;
		readonly error_message: string;
	};
	readonly type: 'desktop-agent.rejected';
}

export type WebSocketServerMessage =
	| ConnectionReadyServerMessage
	| RunAcceptedServerMessage
	| RuntimeEventServerMessage
	| TextDeltaServerMessage
	| TextDeltaDiscardServerMessage
	| NarrationDeltaServerMessage
	| NarrationCompletedServerMessage
	| NarrationSupersededServerMessage
	| RunRejectedServerMessage
	| RunFinishedServerMessage;

export type WebSocketServerBridgeMessage = WebSocketServerMessage | PresentationBlocksServerMessage;

export type DesktopAgentServerMessage =
	| DesktopAgentConnectionReadyServerMessage
	| DesktopAgentSessionAcceptedServerMessage
	| DesktopAgentHeartbeatPingServerMessage
	| DesktopAgentExecuteServerMessage
	| DesktopAgentRejectedServerMessage;
