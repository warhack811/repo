import type { Redacted } from './redacted.js';
import type { ToolArguments, ToolName } from './tools.js';

export type ModelMessageRole = 'system' | 'user' | 'assistant';

export interface ModelMessage {
	readonly role: ModelMessageRole;
	readonly content: string;
	readonly internal_reasoning?: Redacted<string>;
}

export const modelAttachmentKinds = ['image', 'text', 'document'] as const;

export type ModelAttachmentKind = (typeof modelAttachmentKinds)[number];

interface BaseModelAttachment {
	readonly blob_id: string;
	readonly filename?: string;
	readonly kind: ModelAttachmentKind;
	readonly media_type: string;
	readonly size_bytes: number;
}

export interface ModelImageAttachment extends BaseModelAttachment {
	readonly data_url: string;
	readonly kind: 'image';
}

export interface ModelTextAttachment extends BaseModelAttachment {
	readonly kind: 'text';
	readonly text_content: string;
}

export interface ModelDocumentAttachment extends BaseModelAttachment {
	readonly filename: string;
	readonly kind: 'document';
	readonly storage_ref: string;
	readonly text_preview?: string;
}

export type ModelAttachment = ModelDocumentAttachment | ModelImageAttachment | ModelTextAttachment;

export interface UploadAttachmentResponse {
	readonly attachment: ModelAttachment;
}

export interface CompiledContextLayer {
	readonly name: string;
	readonly kind: string;
	readonly content: unknown;
}

export interface CompiledContextArtifact {
	readonly layers: readonly CompiledContextLayer[];
}

export type ModelCallableToolScalarType = 'boolean' | 'number' | 'string';

export interface ModelCallableToolScalarParameter {
	readonly description?: string;
	readonly enum?: readonly string[];
	readonly required?: boolean;
	readonly type: ModelCallableToolScalarType;
}

export interface ModelCallableToolArrayParameter {
	readonly description?: string;
	readonly items: {
		readonly type: ModelCallableToolScalarType;
	};
	readonly required?: boolean;
	readonly type: 'array';
}

export type ModelCallableToolParameter =
	| ModelCallableToolArrayParameter
	| ModelCallableToolScalarParameter;

export interface ModelCallableTool {
	readonly description: string;
	readonly name: ToolName;
	readonly parameters?: Readonly<Record<string, ModelCallableToolParameter>>;
}

export interface ModelRequest {
	readonly run_id: string;
	readonly trace_id: string;
	readonly messages: readonly ModelMessage[];
	readonly attachments?: readonly ModelAttachment[];
	readonly available_tools?: readonly ModelCallableTool[];
	readonly compiled_context?: CompiledContextArtifact;
	readonly model?: string;
	readonly temperature?: number;
	readonly max_output_tokens?: number;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ModelUsage {
	readonly input_tokens?: number;
	readonly output_tokens?: number;
	readonly total_tokens?: number;
}

export type ModelFinishReason = 'stop' | 'max_tokens' | 'error';

export type NarrationStrategy = 'native_blocks' | 'temporal_stream' | 'unsupported';

export interface ProviderCapabilities {
	readonly emits_reasoning_content: boolean;
	readonly narration_strategy: NarrationStrategy;
	readonly streaming_supported: boolean;
	readonly tool_call_fallthrough_risk: 'known_intermittent' | 'low' | 'none';
}

export interface ModelToolCallCandidate<
	TName extends ToolName = ToolName,
	TArguments extends ToolArguments = ToolArguments,
> {
	readonly call_id: string;
	readonly tool_input: TArguments;
	readonly tool_name: TName;
}

export type ModelContentOrderingOrigin =
	| 'native_blocks'
	| 'synthetic_non_streaming'
	| 'wire_streaming';

export type ModelContentPart =
	| {
			readonly index: number;
			readonly kind: 'text';
			readonly narration_eligible?: boolean;
			readonly ordering_origin: ModelContentOrderingOrigin;
			readonly text: string;
	  }
	| {
			readonly index: number;
			readonly input: unknown;
			readonly kind: 'tool_use';
			readonly ordering_origin: ModelContentOrderingOrigin;
			readonly tool_call_id: string;
			readonly tool_name: string;
	  };

export interface ModelToolCallFallthroughSignal {
	readonly confidence: 'high' | 'low' | 'medium';
	readonly matched_pattern?: string;
	readonly suspected_tool_name?: string;
}

export interface ModelResponse {
	readonly provider: string;
	readonly model: string;
	readonly message: ModelMessage & {
		readonly fallthrough_detected?: readonly ModelToolCallFallthroughSignal[];
		readonly ordered_content?: readonly ModelContentPart[];
		readonly role: 'assistant';
	};
	readonly finish_reason: ModelFinishReason;
	readonly tool_call_candidate?: ModelToolCallCandidate;
	readonly tool_call_candidates?: readonly ModelToolCallCandidate[];
	readonly usage?: ModelUsage;
	readonly response_id?: string;
}

export interface ModelTextDeltaChunk {
	readonly content_part_index?: number;
	readonly type: 'text.delta';
	readonly text_delta: string;
}

export interface ModelResponseCompletedChunk {
	readonly type: 'response.completed';
	readonly response: ModelResponse;
}

export type ModelStreamChunk = ModelTextDeltaChunk | ModelResponseCompletedChunk;

export interface ModelGateway {
	readonly capabilities?: ProviderCapabilities;
	generate(request: ModelRequest): Promise<ModelResponse>;
	stream(request: ModelRequest): AsyncIterable<ModelStreamChunk>;
}
