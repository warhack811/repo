import type { RenderBlock } from './blocks.js';
import type { ModelAttachment } from './gateway.js';
import type {
	ApprovalResolveClientMessage,
	ApprovalResolvePayload,
	ConnectionReadyServerMessage,
	DesktopAgentClientMessage,
	DesktopAgentConnectionReadyServerMessage,
	DesktopAgentExecuteServerMessage,
	DesktopAgentHeartbeatPingServerMessage,
	DesktopAgentHeartbeatPongClientMessage,
	DesktopAgentHelloClientMessage,
	DesktopAgentRejectedServerMessage,
	DesktopAgentResultClientMessage,
	DesktopAgentServerMessage,
	DesktopAgentSessionAcceptedServerMessage,
	InspectionRequestClientMessage,
	InspectionRequestPayload,
	PresentationBlocksServerMessage,
	RunAcceptedServerMessage,
	RunApprovalPolicy,
	RunFinishedServerMessage,
	RunRejectedServerMessage,
	RunRequestClientMessage,
	RunRequestPayload,
	RuntimeEventServerMessage,
	TextDeltaDiscardServerMessage,
	TextDeltaServerMessage,
	WebSocketClientMessage,
	WebSocketServerBridgeMessage,
} from './ws.js';
import {
	approvalModes,
	desktopAgentProtocolVersion,
	desktopAgentRejectCodes,
	desktopAgentToolNames,
	gatewayProviders,
} from './ws.js';

interface MessageCandidate {
	readonly content?: unknown;
	readonly role?: unknown;
}

interface AttachmentCandidate {
	readonly blob_id?: unknown;
	readonly data_url?: unknown;
	readonly filename?: unknown;
	readonly kind?: unknown;
	readonly media_type?: unknown;
	readonly size_bytes?: unknown;
	readonly storage_ref?: unknown;
	readonly text_content?: unknown;
	readonly text_preview?: unknown;
}

interface ProviderConfigCandidate {
	readonly apiKey?: unknown;
	readonly baseUrl?: unknown;
	readonly defaultMaxOutputTokens?: unknown;
	readonly defaultModel?: unknown;
}

interface RequestCandidate {
	readonly max_output_tokens?: unknown;
	readonly messages?: unknown;
	readonly metadata?: unknown;
	readonly model?: unknown;
	readonly temperature?: unknown;
}

interface RunApprovalPolicyCandidate {
	readonly mode?: unknown;
}

interface RunRequestPayloadCandidate {
	readonly approval_policy?: unknown;
	readonly attachments?: unknown;
	readonly conversation_id?: unknown;
	readonly desktop_target_connection_id?: unknown;
	readonly include_presentation_blocks?: unknown;
	readonly provider?: unknown;
	readonly provider_config?: unknown;
	readonly request?: unknown;
	readonly run_id?: unknown;
	readonly trace_id?: unknown;
}

interface RunRequestMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface ApprovalResolvePayloadCandidate {
	readonly approval_id?: unknown;
	readonly decision?: unknown;
	readonly note?: unknown;
}

interface ApprovalResolveMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface InspectionRequestPayloadCandidate {
	readonly detail_level?: unknown;
	readonly run_id?: unknown;
	readonly target_id?: unknown;
	readonly target_kind?: unknown;
}

interface InspectionRequestMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface DesktopAgentCapabilityCandidate {
	readonly tool_name?: unknown;
}

interface DesktopAgentHelloPayloadCandidate {
	readonly agent_id?: unknown;
	readonly capabilities?: unknown;
	readonly machine_label?: unknown;
	readonly protocol_version?: unknown;
}

interface DesktopAgentHelloMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface DesktopAgentResultPayloadCandidate {
	readonly call_id?: unknown;
	readonly details?: unknown;
	readonly error_code?: unknown;
	readonly error_message?: unknown;
	readonly metadata?: unknown;
	readonly output?: unknown;
	readonly request_id?: unknown;
	readonly retryable?: unknown;
	readonly status?: unknown;
	readonly tool_name?: unknown;
}

interface DesktopAgentResultMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface ConnectionReadyMessageCandidate {
	readonly message?: unknown;
	readonly transport?: unknown;
	readonly type?: unknown;
}

interface DesktopAgentSessionAcceptedPayloadCandidate {
	readonly agent_id?: unknown;
	readonly capabilities?: unknown;
	readonly connection_id?: unknown;
	readonly user_id?: unknown;
}

interface DesktopAgentSessionAcceptedMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface DesktopAgentExecutePayloadCandidate {
	readonly arguments?: unknown;
	readonly call_id?: unknown;
	readonly request_id?: unknown;
	readonly run_id?: unknown;
	readonly tool_name?: unknown;
	readonly trace_id?: unknown;
}

interface DesktopAgentExecuteMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface DesktopAgentHeartbeatPingPayloadCandidate {
	readonly ping_id?: unknown;
	readonly sent_at?: unknown;
}

interface DesktopAgentHeartbeatPingMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface DesktopAgentHeartbeatPongPayloadCandidate {
	readonly ping_id?: unknown;
	readonly received_at?: unknown;
}

interface DesktopAgentHeartbeatPongMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface DesktopAgentRejectedPayloadCandidate {
	readonly error_code?: unknown;
	readonly error_message?: unknown;
}

interface DesktopAgentRejectedMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface RuntimeEventMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface RuntimeEventPayloadCandidate {
	readonly event?: unknown;
}

interface TextDeltaMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface TextDeltaPayloadCandidate {
	readonly run_id?: unknown;
	readonly text_delta?: unknown;
	readonly trace_id?: unknown;
}

interface TextDeltaDiscardPayloadCandidate {
	readonly run_id?: unknown;
	readonly trace_id?: unknown;
}

interface RunAcceptedMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface RunAcceptedPayloadCandidate {
	readonly conversation_id?: unknown;
	readonly provider?: unknown;
	readonly run_id?: unknown;
	readonly trace_id?: unknown;
}

interface RunRejectedMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface RunRejectedPayloadCandidate {
	readonly error_message?: unknown;
	readonly error_name?: unknown;
	readonly reject_reason?: unknown;
}

interface UsageLimitRejectionCandidate {
	readonly kind?: unknown;
	readonly limit?: unknown;
	readonly metric?: unknown;
	readonly remaining?: unknown;
	readonly resets_at?: unknown;
	readonly retry_after_seconds?: unknown;
	readonly scope?: unknown;
	readonly tier?: unknown;
	readonly window?: unknown;
}

interface RunFinishedMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface RunFinishedPayloadCandidate {
	readonly final_state?: unknown;
	readonly run_id?: unknown;
	readonly status?: unknown;
	readonly trace_id?: unknown;
}

interface PresentationBlocksMessageCandidate {
	readonly payload?: unknown;
	readonly type?: unknown;
}

interface PresentationBlocksPayloadCandidate {
	readonly blocks?: unknown;
	readonly run_id?: unknown;
	readonly trace_id?: unknown;
}

interface TextBlockPayloadCandidate {
	readonly text?: unknown;
}

interface StatusBlockPayloadCandidate {
	readonly level?: unknown;
	readonly message?: unknown;
}

interface EventListBlockPayloadCandidate {
	readonly events?: unknown;
	readonly run_id?: unknown;
	readonly trace_id?: unknown;
}

interface CodeBlockPayloadCandidate {
	readonly content?: unknown;
	readonly diff_kind?: unknown;
	readonly language?: unknown;
	readonly path?: unknown;
	readonly summary?: unknown;
	readonly title?: unknown;
}

interface DiffBlockPayloadCandidate {
	readonly changed_paths?: unknown;
	readonly diff_text?: unknown;
	readonly is_truncated?: unknown;
	readonly path?: unknown;
	readonly summary?: unknown;
	readonly title?: unknown;
}

interface InspectionDetailBlockPayloadCandidate {
	readonly detail_items?: unknown;
	readonly summary?: unknown;
	readonly target_kind?: unknown;
	readonly title?: unknown;
}

interface InspectionDetailItemCandidate {
	readonly label?: unknown;
	readonly value?: unknown;
}

interface SearchResultBlockPayloadCandidate {
	readonly conflict_note?: unknown;
	readonly is_truncated?: unknown;
	readonly matches?: unknown;
	readonly query?: unknown;
	readonly searched_root?: unknown;
	readonly source_priority_note?: unknown;
	readonly summary?: unknown;
	readonly title?: unknown;
	readonly total_matches?: unknown;
}

interface SearchResultMatchCandidate {
	readonly line_number?: unknown;
	readonly line_text?: unknown;
	readonly path?: unknown;
}

interface WebSearchResultBlockPayloadCandidate {
	readonly authority_note?: unknown;
	readonly conflict_note?: unknown;
	readonly freshness_note?: unknown;
	readonly is_truncated?: unknown;
	readonly query?: unknown;
	readonly results?: unknown;
	readonly search_provider?: unknown;
	readonly source_priority_note?: unknown;
	readonly summary?: unknown;
	readonly title?: unknown;
}

interface WebSearchResultItemCandidate {
	readonly authority_note?: unknown;
	readonly freshness_hint?: unknown;
	readonly snippet?: unknown;
	readonly source?: unknown;
	readonly title?: unknown;
	readonly trust_tier?: unknown;
	readonly url?: unknown;
}

interface WorkspaceInspectionBlockPayloadCandidate {
	readonly inspection_notes?: unknown;
	readonly last_search_summary?: unknown;
	readonly project_name?: unknown;
	readonly project_type_hints?: unknown;
	readonly summary?: unknown;
	readonly title?: unknown;
	readonly top_level_signals?: unknown;
}

interface RunTimelineBlockPayloadCandidate {
	readonly items?: unknown;
	readonly summary?: unknown;
	readonly title?: unknown;
}

interface RunTimelineBlockItemCandidate {
	readonly call_id?: unknown;
	readonly detail?: unknown;
	readonly kind?: unknown;
	readonly label?: unknown;
	readonly state?: unknown;
	readonly tool_name?: unknown;
}

interface TraceDebugBlockPayloadCandidate {
	readonly approval_summary?: unknown;
	readonly debug_notes?: unknown;
	readonly run_state?: unknown;
	readonly summary?: unknown;
	readonly title?: unknown;
	readonly tool_chain_summary?: unknown;
	readonly trace_label?: unknown;
	readonly warning_notes?: unknown;
}

interface ToolResultBlockPayloadCandidate {
	readonly call_id?: unknown;
	readonly error_code?: unknown;
	readonly result_preview?: unknown;
	readonly status?: unknown;
	readonly summary?: unknown;
	readonly tool_name?: unknown;
}

interface ApprovalBlockPayloadCandidate {
	readonly action_kind?: unknown;
	readonly approval_id?: unknown;
	readonly call_id?: unknown;
	readonly decision?: unknown;
	readonly note?: unknown;
	readonly status?: unknown;
	readonly summary?: unknown;
	readonly title?: unknown;
	readonly tool_name?: unknown;
}

interface ToolResultPreviewCandidate {
	readonly kind?: unknown;
	readonly summary_text?: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMessageCandidate(value: unknown): value is MessageCandidate {
	return isRecord(value);
}

function isAttachmentCandidate(value: unknown): value is AttachmentCandidate {
	return isRecord(value);
}

function isProviderConfigCandidate(value: unknown): value is ProviderConfigCandidate {
	return isRecord(value);
}

function isRequestCandidate(value: unknown): value is RequestCandidate {
	return isRecord(value);
}

function isRunRequestPayloadCandidate(value: unknown): value is RunRequestPayloadCandidate {
	return isRecord(value);
}

function isRunRequestMessageCandidate(value: unknown): value is RunRequestMessageCandidate {
	return isRecord(value);
}

function isApprovalResolvePayloadCandidate(
	value: unknown,
): value is ApprovalResolvePayloadCandidate {
	return isRecord(value);
}

function isApprovalResolveMessageCandidate(
	value: unknown,
): value is ApprovalResolveMessageCandidate {
	return isRecord(value);
}

function isInspectionRequestPayloadCandidate(
	value: unknown,
): value is InspectionRequestPayloadCandidate {
	return isRecord(value);
}

function isInspectionRequestMessageCandidate(
	value: unknown,
): value is InspectionRequestMessageCandidate {
	return isRecord(value);
}

function isDesktopAgentCapabilityCandidate(
	value: unknown,
): value is DesktopAgentCapabilityCandidate {
	return isRecord(value);
}

function isDesktopAgentHelloPayloadCandidate(
	value: unknown,
): value is DesktopAgentHelloPayloadCandidate {
	return isRecord(value);
}

function isDesktopAgentHelloMessageCandidate(
	value: unknown,
): value is DesktopAgentHelloMessageCandidate {
	return isRecord(value);
}

function isDesktopAgentResultPayloadCandidate(
	value: unknown,
): value is DesktopAgentResultPayloadCandidate {
	return isRecord(value);
}

function isDesktopAgentResultMessageCandidate(
	value: unknown,
): value is DesktopAgentResultMessageCandidate {
	return isRecord(value);
}

function isConnectionReadyMessageCandidate(
	value: unknown,
): value is ConnectionReadyMessageCandidate {
	return isRecord(value);
}

function isDesktopAgentSessionAcceptedPayloadCandidate(
	value: unknown,
): value is DesktopAgentSessionAcceptedPayloadCandidate {
	return isRecord(value);
}

function isDesktopAgentSessionAcceptedMessageCandidate(
	value: unknown,
): value is DesktopAgentSessionAcceptedMessageCandidate {
	return isRecord(value);
}

function isDesktopAgentExecutePayloadCandidate(
	value: unknown,
): value is DesktopAgentExecutePayloadCandidate {
	return isRecord(value);
}

function isDesktopAgentExecuteMessageCandidate(
	value: unknown,
): value is DesktopAgentExecuteMessageCandidate {
	return isRecord(value);
}

function isDesktopAgentHeartbeatPingPayloadCandidate(
	value: unknown,
): value is DesktopAgentHeartbeatPingPayloadCandidate {
	return isRecord(value);
}

function isDesktopAgentHeartbeatPingMessageCandidate(
	value: unknown,
): value is DesktopAgentHeartbeatPingMessageCandidate {
	return isRecord(value);
}

function isDesktopAgentHeartbeatPongPayloadCandidate(
	value: unknown,
): value is DesktopAgentHeartbeatPongPayloadCandidate {
	return isRecord(value);
}

function isDesktopAgentHeartbeatPongMessageCandidate(
	value: unknown,
): value is DesktopAgentHeartbeatPongMessageCandidate {
	return isRecord(value);
}

function isDesktopAgentRejectedPayloadCandidate(
	value: unknown,
): value is DesktopAgentRejectedPayloadCandidate {
	return isRecord(value);
}

function isDesktopAgentRejectedMessageCandidate(
	value: unknown,
): value is DesktopAgentRejectedMessageCandidate {
	return isRecord(value);
}

function isRuntimeEventMessageCandidate(value: unknown): value is RuntimeEventMessageCandidate {
	return isRecord(value);
}

function isRuntimeEventPayloadCandidate(value: unknown): value is RuntimeEventPayloadCandidate {
	return isRecord(value);
}

function isTextDeltaMessageCandidate(value: unknown): value is TextDeltaMessageCandidate {
	return isRecord(value);
}

function isTextDeltaPayloadCandidate(value: unknown): value is TextDeltaPayloadCandidate {
	return isRecord(value);
}

function isTextDeltaDiscardPayloadCandidate(
	value: unknown,
): value is TextDeltaDiscardPayloadCandidate {
	return isRecord(value);
}

function isRunAcceptedMessageCandidate(value: unknown): value is RunAcceptedMessageCandidate {
	return isRecord(value);
}

function isRunAcceptedPayloadCandidate(value: unknown): value is RunAcceptedPayloadCandidate {
	return isRecord(value);
}

function isRunRejectedMessageCandidate(value: unknown): value is RunRejectedMessageCandidate {
	return isRecord(value);
}

function isRunRejectedPayloadCandidate(value: unknown): value is RunRejectedPayloadCandidate {
	return isRecord(value);
}

function isUsageLimitRejectionCandidate(value: unknown): value is UsageLimitRejectionCandidate {
	return isRecord(value);
}

function isRunFinishedMessageCandidate(value: unknown): value is RunFinishedMessageCandidate {
	return isRecord(value);
}

function isRunFinishedPayloadCandidate(value: unknown): value is RunFinishedPayloadCandidate {
	return isRecord(value);
}

function isPresentationBlocksMessageCandidate(
	value: unknown,
): value is PresentationBlocksMessageCandidate {
	return isRecord(value);
}

function isPresentationBlocksPayloadCandidate(
	value: unknown,
): value is PresentationBlocksPayloadCandidate {
	return isRecord(value);
}

function isToolResultPreviewCandidate(value: unknown): value is ToolResultPreviewCandidate {
	return isRecord(value);
}

function isInspectionDetailItemCandidate(value: unknown): value is InspectionDetailItemCandidate {
	return isRecord(value);
}

function isSearchResultMatchCandidate(value: unknown): value is SearchResultMatchCandidate {
	return isRecord(value);
}

function isWebSearchResultItemCandidate(value: unknown): value is WebSearchResultItemCandidate {
	return isRecord(value);
}

function isRunTimelineBlockItemCandidate(value: unknown): value is RunTimelineBlockItemCandidate {
	return isRecord(value);
}

function isMessageRole(value: unknown): value is 'assistant' | 'system' | 'user' {
	return value === 'assistant' || value === 'system' || value === 'user';
}

function isInspectionTargetKind(value: unknown): value is InspectionRequestPayload['target_kind'] {
	return (
		value === 'workspace' ||
		value === 'timeline' ||
		value === 'trace_debug' ||
		value === 'search_result' ||
		value === 'diff'
	);
}

function isInspectionDetailLevel(
	value: unknown,
): value is NonNullable<InspectionRequestPayload['detail_level']> {
	return value === 'standard' || value === 'expanded';
}

function isDesktopAgentToolName(
	value: unknown,
): value is DesktopAgentHelloClientMessage['payload']['capabilities'][number]['tool_name'] {
	return (
		typeof value === 'string' &&
		desktopAgentToolNames.includes(value as (typeof desktopAgentToolNames)[number])
	);
}

function isDesktopAgentCapability(
	value: unknown,
): value is DesktopAgentHelloClientMessage['payload']['capabilities'][number] {
	return isDesktopAgentCapabilityCandidate(value) && isDesktopAgentToolName(value.tool_name);
}

function isDesktopAgentCapabilities(
	value: unknown,
): value is DesktopAgentHelloClientMessage['payload']['capabilities'] {
	return Array.isArray(value) && value.every((capability) => isDesktopAgentCapability(capability));
}

function isMessageArray(value: unknown): value is RunRequestPayload['request']['messages'] {
	return (
		Array.isArray(value) &&
		value.every((message) => {
			if (!isMessageCandidate(message)) {
				return false;
			}

			const { content, role } = message;

			return typeof content === 'string' && isMessageRole(role);
		})
	);
}

function isModelAttachmentKind(value: unknown): value is ModelAttachment['kind'] {
	return value === 'image' || value === 'text' || value === 'document';
}

function isModelAttachment(value: unknown): value is ModelAttachment {
	if (!isAttachmentCandidate(value)) {
		return false;
	}

	const {
		blob_id: blobId,
		data_url: dataUrl,
		filename,
		kind,
		media_type: mediaType,
		size_bytes: sizeBytes,
		storage_ref: storageRef,
		text_content: textContent,
		text_preview: textPreview,
	} = value;

	if (
		typeof blobId !== 'string' ||
		(filename !== undefined && typeof filename !== 'string') ||
		!isModelAttachmentKind(kind) ||
		typeof mediaType !== 'string' ||
		typeof sizeBytes !== 'number'
	) {
		return false;
	}

	if (kind === 'image') {
		return (
			typeof dataUrl === 'string' &&
			storageRef === undefined &&
			textContent === undefined &&
			textPreview === undefined
		);
	}

	if (kind === 'document') {
		return (
			typeof filename === 'string' &&
			typeof storageRef === 'string' &&
			dataUrl === undefined &&
			textContent === undefined &&
			(textPreview === undefined || typeof textPreview === 'string')
		);
	}

	return (
		typeof textContent === 'string' &&
		dataUrl === undefined &&
		storageRef === undefined &&
		textPreview === undefined
	);
}

function isAttachmentArray(value: unknown): value is readonly ModelAttachment[] {
	return Array.isArray(value) && value.every((attachment) => isModelAttachment(attachment));
}

function isRequestMetadata(value: unknown): value is Readonly<Record<string, unknown>> {
	return value === undefined || isRecord(value);
}

function isGatewayProvider(value: unknown): value is RunRequestPayload['provider'] {
	return (
		typeof value === 'string' && gatewayProviders.includes(value as RunRequestPayload['provider'])
	);
}

function isApprovalMode(value: unknown): value is RunApprovalPolicy['mode'] {
	return typeof value === 'string' && approvalModes.includes(value as RunApprovalPolicy['mode']);
}

function isRunApprovalPolicy(value: unknown): value is RunApprovalPolicy {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as RunApprovalPolicyCandidate;

	return isApprovalMode(candidate.mode);
}

export function isProviderConfig(value: unknown): value is RunRequestPayload['provider_config'] {
	if (!isProviderConfigCandidate(value)) {
		return false;
	}

	const { apiKey, baseUrl, defaultMaxOutputTokens, defaultModel } = value;

	return (
		typeof apiKey === 'string' &&
		(baseUrl === undefined || typeof baseUrl === 'string') &&
		(defaultModel === undefined || typeof defaultModel === 'string') &&
		(defaultMaxOutputTokens === undefined || typeof defaultMaxOutputTokens === 'number')
	);
}

export function isRunRequestPayload(value: unknown): value is RunRequestPayload {
	if (!isRunRequestPayloadCandidate(value)) {
		return false;
	}

	const {
		approval_policy: approvalPolicy,
		attachments,
		conversation_id: conversationId,
		desktop_target_connection_id: desktopTargetConnectionId,
		include_presentation_blocks: includePresentationBlocks,
		provider,
		provider_config: providerConfig,
		request,
		run_id: runId,
		trace_id: traceId,
	} = value;

	if (!isRequestCandidate(request)) {
		return false;
	}

	const { max_output_tokens: maxOutputTokens, messages, metadata, model, temperature } = request;

	return (
		(approvalPolicy === undefined || isRunApprovalPolicy(approvalPolicy)) &&
		(attachments === undefined || isAttachmentArray(attachments)) &&
		(conversationId === undefined || typeof conversationId === 'string') &&
		(desktopTargetConnectionId === undefined || typeof desktopTargetConnectionId === 'string') &&
		(includePresentationBlocks === undefined || typeof includePresentationBlocks === 'boolean') &&
		isGatewayProvider(provider) &&
		isProviderConfig(providerConfig) &&
		typeof runId === 'string' &&
		typeof traceId === 'string' &&
		isMessageArray(messages) &&
		(model === undefined || typeof model === 'string') &&
		(temperature === undefined || typeof temperature === 'number') &&
		(maxOutputTokens === undefined || typeof maxOutputTokens === 'number') &&
		isRequestMetadata(metadata)
	);
}

export function isRunRequestClientMessage(value: unknown): value is RunRequestClientMessage {
	return (
		isRunRequestMessageCandidate(value) &&
		value.type === 'run.request' &&
		isRunRequestPayload(value.payload)
	);
}

export function isApprovalResolvePayload(value: unknown): value is ApprovalResolvePayload {
	return (
		isApprovalResolvePayloadCandidate(value) &&
		typeof value.approval_id === 'string' &&
		(value.decision === 'approved' || value.decision === 'rejected') &&
		(value.note === undefined || typeof value.note === 'string')
	);
}

export function isApprovalResolveClientMessage(
	value: unknown,
): value is ApprovalResolveClientMessage {
	return (
		isApprovalResolveMessageCandidate(value) &&
		value.type === 'approval.resolve' &&
		isApprovalResolvePayload(value.payload)
	);
}

export function isInspectionRequestPayload(value: unknown): value is InspectionRequestPayload {
	return (
		isInspectionRequestPayloadCandidate(value) &&
		typeof value.run_id === 'string' &&
		isInspectionTargetKind(value.target_kind) &&
		(value.target_id === undefined || typeof value.target_id === 'string') &&
		(value.detail_level === undefined || isInspectionDetailLevel(value.detail_level))
	);
}

export function isInspectionRequestClientMessage(
	value: unknown,
): value is InspectionRequestClientMessage {
	return (
		isInspectionRequestMessageCandidate(value) &&
		value.type === 'inspection.request' &&
		isInspectionRequestPayload(value.payload)
	);
}

export function isDesktopAgentHelloPayload(
	value: unknown,
): value is DesktopAgentHelloClientMessage['payload'] {
	return (
		isDesktopAgentHelloPayloadCandidate(value) &&
		typeof value.agent_id === 'string' &&
		isDesktopAgentCapabilities(value.capabilities) &&
		(value.machine_label === undefined || typeof value.machine_label === 'string') &&
		value.protocol_version === desktopAgentProtocolVersion
	);
}

export function isDesktopAgentHelloClientMessage(
	value: unknown,
): value is DesktopAgentHelloClientMessage {
	return (
		isDesktopAgentHelloMessageCandidate(value) &&
		value.type === 'desktop-agent.hello' &&
		isDesktopAgentHelloPayload(value.payload)
	);
}

export function isDesktopAgentResultPayload(
	value: unknown,
): value is DesktopAgentResultClientMessage['payload'] {
	if (
		!isDesktopAgentResultPayloadCandidate(value) ||
		typeof value.request_id !== 'string' ||
		typeof value.call_id !== 'string' ||
		!isDesktopAgentToolName(value.tool_name)
	) {
		return false;
	}

	if (value.status === 'success') {
		return (
			value.error_code === undefined &&
			value.error_message === undefined &&
			value.retryable === undefined &&
			(value.metadata === undefined || isRecord(value.metadata))
		);
	}

	return (
		value.status === 'error' &&
		typeof value.error_code === 'string' &&
		typeof value.error_message === 'string' &&
		(value.retryable === undefined || typeof value.retryable === 'boolean') &&
		(value.details === undefined || isRecord(value.details))
	);
}

export function isDesktopAgentResultClientMessage(
	value: unknown,
): value is DesktopAgentResultClientMessage {
	return (
		isDesktopAgentResultMessageCandidate(value) &&
		value.type === 'desktop-agent.result' &&
		isDesktopAgentResultPayload(value.payload)
	);
}

export function isDesktopAgentHeartbeatPongClientMessage(
	value: unknown,
): value is DesktopAgentHeartbeatPongClientMessage {
	return (
		isDesktopAgentHeartbeatPongMessageCandidate(value) &&
		value.type === 'desktop-agent.heartbeat.pong' &&
		isDesktopAgentHeartbeatPongPayloadCandidate(value.payload) &&
		typeof value.payload.ping_id === 'string' &&
		typeof value.payload.received_at === 'string'
	);
}

export function isDesktopAgentClientMessage(value: unknown): value is DesktopAgentClientMessage {
	return (
		isDesktopAgentHelloClientMessage(value) ||
		isDesktopAgentHeartbeatPongClientMessage(value) ||
		isDesktopAgentResultClientMessage(value)
	);
}

export function isWebSocketClientMessage(value: unknown): value is WebSocketClientMessage {
	return (
		isRunRequestClientMessage(value) ||
		isApprovalResolveClientMessage(value) ||
		isInspectionRequestClientMessage(value)
	);
}

export function isRenderBlock(value: unknown): value is RenderBlock {
	if (!isRecord(value)) {
		return false;
	}

	const blockCandidate = value as {
		readonly created_at?: unknown;
		readonly id?: unknown;
		readonly payload?: unknown;
		readonly schema_version?: unknown;
		readonly type?: unknown;
	};

	if (
		typeof blockCandidate.id !== 'string' ||
		typeof blockCandidate.created_at !== 'string' ||
		blockCandidate.schema_version !== 1 ||
		!isRecord(blockCandidate.payload)
	) {
		return false;
	}

	const payload = blockCandidate.payload;

	switch (blockCandidate.type) {
		case 'text': {
			const textPayload = payload as TextBlockPayloadCandidate;
			return typeof textPayload.text === 'string';
		}
		case 'status': {
			const statusPayload = payload as StatusBlockPayloadCandidate;
			return (
				typeof statusPayload.message === 'string' &&
				(statusPayload.level === 'error' ||
					statusPayload.level === 'info' ||
					statusPayload.level === 'success' ||
					statusPayload.level === 'warning')
			);
		}
		case 'event_list': {
			const eventListPayload = payload as EventListBlockPayloadCandidate;
			return (
				typeof eventListPayload.run_id === 'string' &&
				typeof eventListPayload.trace_id === 'string' &&
				Array.isArray(eventListPayload.events) &&
				eventListPayload.events.every((event) => isRecord(event))
			);
		}
		case 'code_block': {
			const codeBlockPayload = payload as CodeBlockPayloadCandidate;
			return (
				typeof codeBlockPayload.content === 'string' &&
				typeof codeBlockPayload.language === 'string' &&
				(codeBlockPayload.path === undefined || typeof codeBlockPayload.path === 'string') &&
				(codeBlockPayload.title === undefined || typeof codeBlockPayload.title === 'string') &&
				(codeBlockPayload.summary === undefined || typeof codeBlockPayload.summary === 'string') &&
				(codeBlockPayload.diff_kind === undefined ||
					codeBlockPayload.diff_kind === 'after' ||
					codeBlockPayload.diff_kind === 'before' ||
					codeBlockPayload.diff_kind === 'unified')
			);
		}
		case 'diff_block': {
			const diffBlockPayload = payload as DiffBlockPayloadCandidate;
			return (
				typeof diffBlockPayload.diff_text === 'string' &&
				typeof diffBlockPayload.summary === 'string' &&
				(diffBlockPayload.title === undefined || typeof diffBlockPayload.title === 'string') &&
				(diffBlockPayload.path === undefined || typeof diffBlockPayload.path === 'string') &&
				(diffBlockPayload.is_truncated === undefined ||
					typeof diffBlockPayload.is_truncated === 'boolean') &&
				(diffBlockPayload.changed_paths === undefined ||
					(Array.isArray(diffBlockPayload.changed_paths) &&
						diffBlockPayload.changed_paths.every((path) => typeof path === 'string')))
			);
		}
		case 'inspection_detail_block': {
			const inspectionDetailPayload = payload as InspectionDetailBlockPayloadCandidate;

			return (
				typeof inspectionDetailPayload.title === 'string' &&
				typeof inspectionDetailPayload.summary === 'string' &&
				(inspectionDetailPayload.target_kind === 'workspace' ||
					inspectionDetailPayload.target_kind === 'timeline' ||
					inspectionDetailPayload.target_kind === 'trace_debug' ||
					inspectionDetailPayload.target_kind === 'search_result' ||
					inspectionDetailPayload.target_kind === 'diff') &&
				Array.isArray(inspectionDetailPayload.detail_items) &&
				inspectionDetailPayload.detail_items.every(
					(item) =>
						isInspectionDetailItemCandidate(item) &&
						typeof item.label === 'string' &&
						typeof item.value === 'string',
				)
			);
		}
		case 'search_result_block': {
			const searchResultPayload = payload as SearchResultBlockPayloadCandidate;

			return (
				typeof searchResultPayload.title === 'string' &&
				typeof searchResultPayload.summary === 'string' &&
				typeof searchResultPayload.query === 'string' &&
				typeof searchResultPayload.searched_root === 'string' &&
				typeof searchResultPayload.is_truncated === 'boolean' &&
				(searchResultPayload.source_priority_note === undefined ||
					typeof searchResultPayload.source_priority_note === 'string') &&
				(searchResultPayload.conflict_note === undefined ||
					typeof searchResultPayload.conflict_note === 'string') &&
				(searchResultPayload.total_matches === undefined ||
					typeof searchResultPayload.total_matches === 'number') &&
				Array.isArray(searchResultPayload.matches) &&
				searchResultPayload.matches.every(
					(match) =>
						isSearchResultMatchCandidate(match) &&
						typeof match.path === 'string' &&
						typeof match.line_text === 'string' &&
						typeof match.line_number === 'number',
				)
			);
		}
		case 'web_search_result_block': {
			const webSearchPayload = payload as WebSearchResultBlockPayloadCandidate;

			return (
				typeof webSearchPayload.title === 'string' &&
				typeof webSearchPayload.summary === 'string' &&
				typeof webSearchPayload.query === 'string' &&
				typeof webSearchPayload.search_provider === 'string' &&
				typeof webSearchPayload.is_truncated === 'boolean' &&
				(webSearchPayload.authority_note === undefined ||
					typeof webSearchPayload.authority_note === 'string') &&
				(webSearchPayload.source_priority_note === undefined ||
					typeof webSearchPayload.source_priority_note === 'string') &&
				(webSearchPayload.conflict_note === undefined ||
					typeof webSearchPayload.conflict_note === 'string') &&
				(webSearchPayload.freshness_note === undefined ||
					typeof webSearchPayload.freshness_note === 'string') &&
				Array.isArray(webSearchPayload.results) &&
				webSearchPayload.results.every(
					(result) =>
						isWebSearchResultItemCandidate(result) &&
						typeof result.title === 'string' &&
						typeof result.url === 'string' &&
						typeof result.source === 'string' &&
						typeof result.snippet === 'string' &&
						(result.authority_note === undefined || typeof result.authority_note === 'string') &&
						(result.freshness_hint === undefined || typeof result.freshness_hint === 'string') &&
						(result.trust_tier === 'official' ||
							result.trust_tier === 'vendor' ||
							result.trust_tier === 'reputable' ||
							result.trust_tier === 'general'),
				)
			);
		}
		case 'workspace_inspection_block': {
			const workspaceInspectionPayload = payload as WorkspaceInspectionBlockPayloadCandidate;

			return (
				typeof workspaceInspectionPayload.title === 'string' &&
				typeof workspaceInspectionPayload.summary === 'string' &&
				(workspaceInspectionPayload.project_name === undefined ||
					typeof workspaceInspectionPayload.project_name === 'string') &&
				(workspaceInspectionPayload.last_search_summary === undefined ||
					typeof workspaceInspectionPayload.last_search_summary === 'string') &&
				Array.isArray(workspaceInspectionPayload.project_type_hints) &&
				workspaceInspectionPayload.project_type_hints.every((hint) => typeof hint === 'string') &&
				Array.isArray(workspaceInspectionPayload.top_level_signals) &&
				workspaceInspectionPayload.top_level_signals.every(
					(signal) => typeof signal === 'string',
				) &&
				(workspaceInspectionPayload.inspection_notes === undefined ||
					(Array.isArray(workspaceInspectionPayload.inspection_notes) &&
						workspaceInspectionPayload.inspection_notes.every((note) => typeof note === 'string')))
			);
		}
		case 'run_timeline_block': {
			const runTimelinePayload = payload as RunTimelineBlockPayloadCandidate;

			return (
				typeof runTimelinePayload.title === 'string' &&
				typeof runTimelinePayload.summary === 'string' &&
				Array.isArray(runTimelinePayload.items) &&
				runTimelinePayload.items.every(
					(item) =>
						isRunTimelineBlockItemCandidate(item) &&
						typeof item.kind === 'string' &&
						typeof item.label === 'string' &&
						(item.detail === undefined || typeof item.detail === 'string') &&
						(item.state === undefined || typeof item.state === 'string') &&
						(item.tool_name === undefined || typeof item.tool_name === 'string') &&
						(item.call_id === undefined || typeof item.call_id === 'string'),
				)
			);
		}
		case 'trace_debug_block': {
			const traceDebugPayload = payload as TraceDebugBlockPayloadCandidate;

			return (
				typeof traceDebugPayload.title === 'string' &&
				typeof traceDebugPayload.summary === 'string' &&
				typeof traceDebugPayload.run_state === 'string' &&
				(traceDebugPayload.trace_label === undefined ||
					typeof traceDebugPayload.trace_label === 'string') &&
				(traceDebugPayload.tool_chain_summary === undefined ||
					typeof traceDebugPayload.tool_chain_summary === 'string') &&
				(traceDebugPayload.approval_summary === undefined ||
					typeof traceDebugPayload.approval_summary === 'string') &&
				(traceDebugPayload.debug_notes === undefined ||
					(Array.isArray(traceDebugPayload.debug_notes) &&
						traceDebugPayload.debug_notes.every((note) => typeof note === 'string'))) &&
				(traceDebugPayload.warning_notes === undefined ||
					(Array.isArray(traceDebugPayload.warning_notes) &&
						traceDebugPayload.warning_notes.every((note) => typeof note === 'string')))
			);
		}
		case 'tool_result': {
			const toolResultPayload = payload as ToolResultBlockPayloadCandidate;
			const preview = toolResultPayload.result_preview;

			return (
				typeof toolResultPayload.call_id === 'string' &&
				typeof toolResultPayload.summary === 'string' &&
				typeof toolResultPayload.tool_name === 'string' &&
				(toolResultPayload.status === 'success' || toolResultPayload.status === 'error') &&
				(toolResultPayload.error_code === undefined ||
					typeof toolResultPayload.error_code === 'string') &&
				(preview === undefined ||
					(isToolResultPreviewCandidate(preview) &&
						(preview.kind === 'array' ||
							preview.kind === 'boolean' ||
							preview.kind === 'null' ||
							preview.kind === 'number' ||
							preview.kind === 'object' ||
							preview.kind === 'string') &&
						typeof preview.summary_text === 'string'))
			);
		}
		case 'approval_block': {
			const approvalPayload = payload as ApprovalBlockPayloadCandidate;

			return (
				typeof approvalPayload.approval_id === 'string' &&
				typeof approvalPayload.action_kind === 'string' &&
				typeof approvalPayload.summary === 'string' &&
				typeof approvalPayload.title === 'string' &&
				(approvalPayload.status === 'pending' ||
					approvalPayload.status === 'approved' ||
					approvalPayload.status === 'rejected' ||
					approvalPayload.status === 'expired' ||
					approvalPayload.status === 'cancelled') &&
				(approvalPayload.call_id === undefined || typeof approvalPayload.call_id === 'string') &&
				(approvalPayload.tool_name === undefined ||
					typeof approvalPayload.tool_name === 'string') &&
				(approvalPayload.note === undefined || typeof approvalPayload.note === 'string') &&
				(approvalPayload.decision === undefined ||
					approvalPayload.decision === 'approved' ||
					approvalPayload.decision === 'rejected' ||
					approvalPayload.decision === 'expired' ||
					approvalPayload.decision === 'cancelled')
			);
		}
		default:
			return false;
	}
}

export function isRuntimeEventServerMessage(value: unknown): value is RuntimeEventServerMessage {
	if (!isRuntimeEventMessageCandidate(value) || value.type !== 'runtime.event') {
		return false;
	}

	return isRuntimeEventPayloadCandidate(value.payload) && isRecord(value.payload.event);
}

export function isTextDeltaServerMessage(value: unknown): value is TextDeltaServerMessage {
	return (
		isTextDeltaMessageCandidate(value) &&
		value.type === 'text.delta' &&
		isTextDeltaPayloadCandidate(value.payload) &&
		typeof value.payload.run_id === 'string' &&
		typeof value.payload.trace_id === 'string' &&
		typeof value.payload.text_delta === 'string'
	);
}

export function isTextDeltaDiscardServerMessage(
	value: unknown,
): value is TextDeltaDiscardServerMessage {
	return (
		isTextDeltaMessageCandidate(value) &&
		value.type === 'text.delta.discard' &&
		isTextDeltaDiscardPayloadCandidate(value.payload) &&
		typeof value.payload.run_id === 'string' &&
		typeof value.payload.trace_id === 'string'
	);
}

export function isDesktopAgentConnectionReadyServerMessage(
	value: unknown,
): value is DesktopAgentConnectionReadyServerMessage {
	return (
		isConnectionReadyMessageCandidate(value) &&
		value.type === 'desktop-agent.connection.ready' &&
		value.message === 'ready' &&
		value.transport === 'desktop_bridge'
	);
}

export function isConnectionReadyServerMessage(
	value: unknown,
): value is ConnectionReadyServerMessage {
	return (
		isConnectionReadyMessageCandidate(value) &&
		value.type === 'connection.ready' &&
		value.message === 'ready' &&
		value.transport === 'websocket'
	);
}

export function isDesktopAgentSessionAcceptedServerMessage(
	value: unknown,
): value is DesktopAgentSessionAcceptedServerMessage {
	return (
		isDesktopAgentSessionAcceptedMessageCandidate(value) &&
		value.type === 'desktop-agent.session.accepted' &&
		isDesktopAgentSessionAcceptedPayloadCandidate(value.payload) &&
		typeof value.payload.agent_id === 'string' &&
		isDesktopAgentCapabilities(value.payload.capabilities) &&
		typeof value.payload.connection_id === 'string' &&
		typeof value.payload.user_id === 'string'
	);
}

export function isDesktopAgentHeartbeatPingServerMessage(
	value: unknown,
): value is DesktopAgentHeartbeatPingServerMessage {
	return (
		isDesktopAgentHeartbeatPingMessageCandidate(value) &&
		value.type === 'desktop-agent.heartbeat.ping' &&
		isDesktopAgentHeartbeatPingPayloadCandidate(value.payload) &&
		typeof value.payload.ping_id === 'string' &&
		typeof value.payload.sent_at === 'string'
	);
}

export function isDesktopAgentExecuteServerMessage(
	value: unknown,
): value is DesktopAgentExecuteServerMessage {
	return (
		isDesktopAgentExecuteMessageCandidate(value) &&
		value.type === 'desktop-agent.execute' &&
		isDesktopAgentExecutePayloadCandidate(value.payload) &&
		isRecord(value.payload.arguments) &&
		typeof value.payload.call_id === 'string' &&
		typeof value.payload.request_id === 'string' &&
		typeof value.payload.run_id === 'string' &&
		isDesktopAgentToolName(value.payload.tool_name) &&
		typeof value.payload.trace_id === 'string'
	);
}

export function isDesktopAgentRejectedServerMessage(
	value: unknown,
): value is DesktopAgentRejectedServerMessage {
	return (
		isDesktopAgentRejectedMessageCandidate(value) &&
		value.type === 'desktop-agent.rejected' &&
		isDesktopAgentRejectedPayloadCandidate(value.payload) &&
		typeof value.payload.error_message === 'string' &&
		typeof value.payload.error_code === 'string' &&
		desktopAgentRejectCodes.includes(
			value.payload.error_code as (typeof desktopAgentRejectCodes)[number],
		)
	);
}

export function isRunAcceptedServerMessage(value: unknown): value is RunAcceptedServerMessage {
	return (
		isRunAcceptedMessageCandidate(value) &&
		value.type === 'run.accepted' &&
		isRunAcceptedPayloadCandidate(value.payload) &&
		(value.payload.conversation_id === undefined ||
			typeof value.payload.conversation_id === 'string') &&
		typeof value.payload.provider === 'string' &&
		typeof value.payload.run_id === 'string' &&
		typeof value.payload.trace_id === 'string'
	);
}

export function isRunRejectedServerMessage(value: unknown): value is RunRejectedServerMessage {
	return (
		isRunRejectedMessageCandidate(value) &&
		value.type === 'run.rejected' &&
		isRunRejectedPayloadCandidate(value.payload) &&
		typeof value.payload.error_message === 'string' &&
		typeof value.payload.error_name === 'string' &&
		(value.payload.reject_reason === undefined ||
			(isUsageLimitRejectionCandidate(value.payload.reject_reason) &&
				(value.payload.reject_reason.kind === 'quota_exhausted' ||
					value.payload.reject_reason.kind === 'rate_limited') &&
				typeof value.payload.reject_reason.limit === 'number' &&
				typeof value.payload.reject_reason.metric === 'string' &&
				typeof value.payload.reject_reason.remaining === 'number' &&
				(value.payload.reject_reason.resets_at === undefined ||
					typeof value.payload.reject_reason.resets_at === 'string') &&
				(value.payload.reject_reason.retry_after_seconds === undefined ||
					typeof value.payload.reject_reason.retry_after_seconds === 'number') &&
				(value.payload.reject_reason.scope === 'http_request' ||
					value.payload.reject_reason.scope === 'ws_run_request') &&
				(value.payload.reject_reason.tier === undefined ||
					value.payload.reject_reason.tier === 'free' ||
					value.payload.reject_reason.tier === 'pro' ||
					value.payload.reject_reason.tier === 'business') &&
				(value.payload.reject_reason.window === 'daily' ||
					value.payload.reject_reason.window === 'monthly' ||
					value.payload.reject_reason.window === 'billing_period' ||
					value.payload.reject_reason.window === 'minute')))
	);
}

export function isRunFinishedServerMessage(value: unknown): value is RunFinishedServerMessage {
	return (
		isRunFinishedMessageCandidate(value) &&
		value.type === 'run.finished' &&
		isRunFinishedPayloadCandidate(value.payload) &&
		(value.payload.final_state === 'COMPLETED' || value.payload.final_state === 'FAILED') &&
		(value.payload.status === 'completed' || value.payload.status === 'failed') &&
		typeof value.payload.run_id === 'string' &&
		typeof value.payload.trace_id === 'string'
	);
}

export function isPresentationBlocksServerMessage(
	value: unknown,
): value is PresentationBlocksServerMessage {
	return (
		isPresentationBlocksMessageCandidate(value) &&
		value.type === 'presentation.blocks' &&
		isPresentationBlocksPayloadCandidate(value.payload) &&
		typeof value.payload.run_id === 'string' &&
		typeof value.payload.trace_id === 'string' &&
		Array.isArray(value.payload.blocks) &&
		value.payload.blocks.every((block) => isRenderBlock(block))
	);
}

export function isWebSocketServerBridgeMessage(
	value: unknown,
): value is WebSocketServerBridgeMessage {
	return (
		isConnectionReadyServerMessage(value) ||
		isRunAcceptedServerMessage(value) ||
		isRuntimeEventServerMessage(value) ||
		isTextDeltaServerMessage(value) ||
		isTextDeltaDiscardServerMessage(value) ||
		isRunRejectedServerMessage(value) ||
		isRunFinishedServerMessage(value) ||
		isPresentationBlocksServerMessage(value)
	);
}

export function isDesktopAgentServerMessage(value: unknown): value is DesktopAgentServerMessage {
	return (
		isDesktopAgentConnectionReadyServerMessage(value) ||
		isDesktopAgentSessionAcceptedServerMessage(value) ||
		isDesktopAgentHeartbeatPingServerMessage(value) ||
		isDesktopAgentExecuteServerMessage(value) ||
		isDesktopAgentRejectedServerMessage(value)
	);
}
