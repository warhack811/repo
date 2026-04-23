export type ToolNamespace =
	| 'desktop'
	| 'edit'
	| 'file'
	| 'git'
	| 'mcp'
	| 'plugin'
	| 'search'
	| 'shell';

export type KnownToolName =
	| 'desktop.click'
	| 'desktop.keypress'
	| 'desktop.scroll'
	| 'desktop.screenshot'
	| 'desktop.type'
	| 'edit.patch'
	| 'file.list'
	| 'file.read'
	| 'file.write'
	| 'git.diff'
	| 'git.status'
	| 'search.codebase'
	| 'search.memory'
	| 'search.grep'
	| 'web.search'
	| 'shell.exec';

export type ToolName = KnownToolName | `${ToolNamespace}.${string}`;

export type ToolArguments = Readonly<Record<string, unknown>>;

export type ToolRiskLevel = 'low' | 'medium' | 'high';

export type ToolSideEffectLevel = 'none' | 'read' | 'write' | 'execute';

export type ToolCapabilityClass = 'desktop' | 'external' | 'file_system' | 'search' | 'shell';

export type ToolCallableScalarType = 'boolean' | 'number' | 'string';

export interface ToolCallableScalarParameter {
	readonly description?: string;
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
}

export interface ToolExecutionContext {
	readonly desktop_bridge?: DesktopBridgeInvoker;
	readonly run_id: string;
	readonly signal?: ToolExecutionSignal;
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
