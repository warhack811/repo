import type { ToolArguments, ToolName } from './tools.js';

export type ModelMessageRole = 'system' | 'user' | 'assistant';

export interface ModelMessage {
	readonly role: ModelMessageRole;
	readonly content: string;
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

export interface ModelToolCallCandidate<
	TName extends ToolName = ToolName,
	TArguments extends ToolArguments = ToolArguments,
> {
	readonly call_id: string;
	readonly tool_input: TArguments;
	readonly tool_name: TName;
}

export interface ModelResponse {
	readonly provider: string;
	readonly model: string;
	readonly message: ModelMessage & {
		readonly role: 'assistant';
	};
	readonly finish_reason: ModelFinishReason;
	readonly tool_call_candidate?: ModelToolCallCandidate;
	readonly tool_call_candidates?: readonly ModelToolCallCandidate[];
	readonly usage?: ModelUsage;
	readonly response_id?: string;
}

export interface ModelTextDeltaChunk {
	readonly type: 'text.delta';
	readonly text_delta: string;
}

export interface ModelResponseCompletedChunk {
	readonly type: 'response.completed';
	readonly response: ModelResponse;
}

export type ModelStreamChunk = ModelTextDeltaChunk | ModelResponseCompletedChunk;

export interface ModelGateway {
	generate(request: ModelRequest): Promise<ModelResponse>;
	stream(request: ModelRequest): AsyncIterable<ModelStreamChunk>;
}
