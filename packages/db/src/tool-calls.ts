import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { toolCallsTable } from './schema.js';

export type ToolCallRecord = InferSelectModel<typeof toolCallsTable>;

export type NewToolCallRecord = InferInsertModel<typeof toolCallsTable>;
