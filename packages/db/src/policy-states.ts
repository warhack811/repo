import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { policyStatesTable } from './schema.js';

export type PolicyStateRecord = InferSelectModel<typeof policyStatesTable>;

export type NewPolicyStateRecord = InferInsertModel<typeof policyStatesTable>;
