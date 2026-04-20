import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { approvalsTable } from './schema.js';

export type ApprovalRecord = InferSelectModel<typeof approvalsTable>;

export type NewApprovalRecord = InferInsertModel<typeof approvalsTable>;
