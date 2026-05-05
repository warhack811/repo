import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { agentReasoningTracesTable } from './schema.js';

export type AgentReasoningTraceRecord = InferSelectModel<typeof agentReasoningTracesTable>;

export type NewAgentReasoningTraceRecord = InferInsertModel<typeof agentReasoningTracesTable>;
