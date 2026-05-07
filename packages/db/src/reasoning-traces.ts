import { type InferInsertModel, type InferSelectModel, lt } from 'drizzle-orm';

import type { RunaDatabase } from './client.js';
import { agentReasoningTracesTable } from './schema.js';

export type AgentReasoningTraceRecord = InferSelectModel<typeof agentReasoningTracesTable>;

export type NewAgentReasoningTraceRecord = InferInsertModel<typeof agentReasoningTracesTable>;

export async function cleanupExpiredAgentReasoningTraces(
	db: RunaDatabase,
	now: Date = new Date(),
): Promise<{ readonly deleted_count: number }> {
	const rows = await db
		.delete(agentReasoningTracesTable)
		.where(lt(agentReasoningTracesTable.expires_at, now.toISOString()))
		.returning({ trace_record_id: agentReasoningTracesTable.trace_record_id });

	return { deleted_count: rows.length };
}
