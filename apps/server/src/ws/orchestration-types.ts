import type {
	AnyRuntimeEvent,
	ApprovalRequest,
	AuthContext,
	RenderBlock,
	RuntimeEvent,
	RuntimeState,
	SubscriptionContext,
	ToolCallInput,
	ToolResult,
} from '@runa/types';

import type { WorkspaceLayer } from '../context/compose-workspace-context.js';
import type { ApprovalStore, PendingApprovalToolCall } from '../persistence/approval-store.js';
import type {
	ConversationMessage,
	ConversationRunBlocks,
	ConversationSummary,
} from '../persistence/conversation-store.js';
import type { MemoryStore } from '../persistence/memory-store.js';
import type { PersistRunStateInput } from '../persistence/run-store.js';
import type { StorageDownloadUrlSigner } from '../storage/signed-download-url.js';
import type { StorageService } from '../storage/storage-service.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { DesktopAgentBridgeRegistry } from './desktop-agent-bridge.js';
import type { WebSocketPolicyWiring } from './policy-wiring.js';
import type { PresentationCompatibleRunResult, RuntimePresentationHooks } from './presentation.js';

export type MemoryOrchestrationStore = Pick<
	MemoryStore,
	'createMemory' | 'listActiveMemories' | 'supersedeMemory'
>;

export interface ConversationOrchestrationStore {
	appendConversationMessage(input: {
		readonly content: string;
		readonly conversation_id: string;
		readonly created_at?: string;
		readonly role: 'assistant' | 'system' | 'user';
		readonly run_id?: string;
		readonly scope: {
			readonly session_id?: string;
			readonly tenant_id?: string;
			readonly user_id?: string;
			readonly workspace_id?: string;
		};
		readonly trace_id?: string;
	}): Promise<ConversationMessage>;
	appendConversationRunBlocks?(input: {
		readonly blocks: readonly RenderBlock[];
		readonly conversation_id: string;
		readonly created_at?: string;
		readonly run_id: string;
		readonly scope: {
			readonly session_id?: string;
			readonly tenant_id?: string;
			readonly user_id?: string;
			readonly workspace_id?: string;
		};
		readonly trace_id: string;
	}): Promise<ConversationRunBlocks>;
	ensureConversation(input: {
		readonly conversation_id?: string;
		readonly created_at?: string;
		readonly initial_preview?: string;
		readonly scope: {
			readonly session_id?: string;
			readonly tenant_id?: string;
			readonly user_id?: string;
			readonly workspace_id?: string;
		};
	}): Promise<ConversationSummary>;
}

export interface RuntimeWebSocketHandlerOptions extends RuntimePresentationHooks {
	readonly approvalStore?: ApprovalStore;
	readonly auth_context?: AuthContext;
	readonly conversationStore?: ConversationOrchestrationStore;
	readonly create_storage_download_url?: StorageDownloadUrlSigner['create'];
	readonly desktopAgentBridgeRegistry?: DesktopAgentBridgeRegistry;
	readonly memoryStore?: MemoryOrchestrationStore;
	readonly persistEvents?: (events: readonly RuntimeEvent[]) => Promise<void>;
	readonly persistRunState?: (input: PersistRunStateInput) => Promise<void>;
	readonly policy_wiring?: WebSocketPolicyWiring;
	readonly storage_service?: StorageService;
	readonly subscription_context?: SubscriptionContext;
	readonly toolRegistry?: ToolRegistry;
}

export interface RunToolWebSocketResult extends PresentationCompatibleRunResult {
	readonly already_persisted_approval_id?: string;
	readonly approval_request?: ApprovalRequest;
	readonly assistant_text?: string;
	readonly error_code?: string;
	readonly error_message?: string;
	readonly events: readonly AnyRuntimeEvent[];
	readonly final_state: RuntimeState;
	readonly pending_tool_call?: PendingApprovalToolCall;
	readonly runtime_events: readonly RuntimeEvent[];
	readonly status: 'approval_required' | 'completed' | 'failed';
	readonly tool_arguments?: ToolCallInput['arguments'];
	readonly tool_result?: ToolResult;
	readonly tool_result_history?: readonly ToolResult[];
	readonly turn_count: number;
	readonly workspace_layer?: WorkspaceLayer;
}
