import type { AuthContext } from './auth.js';

export type ToolNamespace =
	| 'agent'
	| 'browser'
	| 'desktop'
	| 'edit'
	| 'file'
	| 'git'
	| 'memory'
	| 'mcp'
	| 'plugin'
	| 'search'
	| 'shell';

export type KnownToolName =
	| 'agent.delegate'
	| 'browser.click'
	| 'browser.extract'
	| 'browser.fill'
	| 'browser.navigate'
	| 'desktop.click'
	| 'desktop.clipboard.read'
	| 'desktop.clipboard.write'
	| 'desktop.keypress'
	| 'desktop.launch'
	| 'desktop.scroll'
	| 'desktop.screenshot'
	| 'desktop.type'
	| 'desktop.verify_state'
	| 'desktop.vision_analyze'
	| 'edit.patch'
	| 'file.list'
	| 'file.read'
	| 'file.share'
	| 'file.watch'
	| 'file.write'
	| 'git.diff'
	| 'git.status'
	| 'memory.delete'
	| 'memory.list'
	| 'memory.save'
	| 'memory.search'
	| 'search.codebase'
	| 'search.memory'
	| 'search.grep'
	| 'web.search'
	| 'shell.exec';

export type ToolName = KnownToolName | `${ToolNamespace}.${string}`;

export type ToolArguments = Readonly<Record<string, unknown>>;

export type ToolRiskLevel = 'low' | 'medium' | 'high';

export type ToolSideEffectLevel = 'none' | 'read' | 'write' | 'execute';

export type ToolCapabilityClass =
	| 'agent'
	| 'browser'
	| 'desktop'
	| 'external'
	| 'file_system'
	| 'memory'
	| 'search'
	| 'shell';

export type ToolCallableScalarType = 'boolean' | 'number' | 'string';

export interface ToolCallableScalarParameter {
	readonly description?: string;
	readonly enum?: readonly string[];
	readonly required?: boolean;
	readonly type: ToolCallableScalarType;
}

export interface ToolCallableArrayParameter {
	readonly description?: string;
	readonly items: {
		readonly type: ToolCallableScalarType;
	};
	readonly required?: boolean;
	readonly type: 'array';
}

export type ToolCallableParameter = ToolCallableArrayParameter | ToolCallableScalarParameter;

export interface ToolCallableSchema {
	readonly parameters?: Readonly<Record<string, ToolCallableParameter>>;
}

export type ToolErrorCode =
	| 'INVALID_INPUT'
	| 'NOT_FOUND'
	| 'PERMISSION_DENIED'
	| 'EXECUTION_FAILED'
	| 'TIMEOUT'
	| 'UNKNOWN';

export interface ToolArtifactRef {
	readonly artifact_id: string;
	readonly kind: 'external';
}

export interface ToolExecutionSignal {
	readonly aborted: boolean;
	readonly reason?: unknown;
	addEventListener?(
		type: 'abort',
		listener: () => void,
		options?: Readonly<{
			readonly once?: boolean;
		}>,
	): void;
	removeEventListener?(type: 'abort', listener: () => void): void;
}

export type AgentDelegateRole = 'coder' | 'researcher' | 'reviewer';

export interface AgentDelegationRequest {
	readonly context?: string;
	readonly depth: number;
	readonly max_turns: number;
	readonly parent_run_id: string;
	readonly role: AgentDelegateRole;
	readonly task: string;
	readonly tool_allowlist: readonly ToolName[];
	readonly trace_id: string;
}

export interface AgentDelegationEvidence {
	readonly label: string;
	readonly value: string;
}

export interface AgentDelegationResult {
	readonly evidence: readonly AgentDelegationEvidence[];
	readonly role: AgentDelegateRole;
	readonly status: 'completed' | 'failed';
	readonly summary: string;
	readonly turns_used: number;
}

export interface ToolExecutionContext {
	readonly auth_context?: AuthContext;
	readonly create_storage_download_url?: (input: {
		readonly blob_id: string;
		readonly filename?: string;
	}) => {
		readonly expires_at: string;
		readonly url: string;
	};
	readonly desktop_bridge?: DesktopBridgeInvoker;
	readonly delegate_agent?: (input: AgentDelegationRequest) => Promise<AgentDelegationResult>;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly run_id: string;
	readonly signal?: ToolExecutionSignal;
	readonly storage_service?: {
		upload_blob(input: {
			readonly auth: AuthContext;
			readonly content_base64: string;
			readonly content_type: string;
			readonly filename?: string;
			readonly kind: 'tool_output';
			readonly run_id?: string;
			readonly trace_id?: string;
		}): Promise<{
			readonly blob_id: string;
			readonly size_bytes: number;
		}>;
	};
	readonly trace_id: string;
	readonly working_directory?: string;
}

export interface ToolMetadata {
	readonly capability_class: ToolCapabilityClass;
	readonly requires_approval: boolean;
	readonly risk_level: ToolRiskLevel;
	readonly side_effect_level: ToolSideEffectLevel;
	readonly tags?: readonly string[];
}

export interface ToolCallInput<
	TName extends ToolName = ToolName,
	TArguments extends ToolArguments = ToolArguments,
> {
	readonly arguments: TArguments;
	readonly call_id: string;
	readonly tool_name: TName;
}

export interface ToolResultBase<TName extends ToolName = ToolName> {
	readonly call_id: string;
	readonly tool_name: TName;
}

export interface ToolResultSuccess<TName extends ToolName = ToolName, TOutput = unknown>
	extends ToolResultBase<TName> {
	readonly artifact_ref?: ToolArtifactRef;
	readonly metadata?: Readonly<Record<string, unknown>>;
	readonly output: TOutput;
	readonly status: 'success';
}

export interface ToolResultError<TName extends ToolName = ToolName> extends ToolResultBase<TName> {
	readonly details?: Readonly<Record<string, unknown>>;
	readonly error_code: ToolErrorCode;
	readonly error_message: string;
	readonly retryable?: boolean;
	readonly status: 'error';
}

export type ToolResult<TName extends ToolName = ToolName, TOutput = unknown> =
	| ToolResultSuccess<TName, TOutput>
	| ToolResultError<TName>;

export interface DesktopBridgeInvoker {
	readonly agent_id: string;
	readonly capabilities: readonly Extract<ToolName, `desktop.${string}`>[];
	invoke<TName extends Extract<ToolName, `desktop.${string}`>>(
		input: ToolCallInput<TName>,
		context: Pick<ToolExecutionContext, 'run_id' | 'signal' | 'trace_id'>,
	): Promise<ToolResult<TName>>;
	supports(tool_name: Extract<ToolName, `desktop.${string}`>): boolean;
}

export interface ToolDefinition<
	TCall extends ToolCallInput = ToolCallInput,
	TResult extends ToolResult = ToolResult,
> {
	readonly callable_schema?: ToolCallableSchema;
	readonly description: string;
	readonly metadata: ToolMetadata;
	readonly name: TCall['tool_name'];
	execute(input: TCall, context: ToolExecutionContext): Promise<TResult>;
}

export interface ToolRegistryEntry<TTool extends ToolDefinition = ToolDefinition> {
	readonly description: TTool['description'];
	readonly metadata: TTool['metadata'];
	readonly name: TTool['name'];
	readonly tool: TTool;
}

export type RegisteredToolMap = Readonly<Record<string, ToolDefinition>>;

export interface ToolRegistryLike {
	get(name: ToolName): ToolDefinition | undefined;
	has(name: ToolName): boolean;
	list(): readonly ToolRegistryEntry[];
	register<TTool extends ToolDefinition>(tool: TTool): void;
}
