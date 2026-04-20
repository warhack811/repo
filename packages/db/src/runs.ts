import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { runsTable } from './schema.js';

export type RunRecord = InferSelectModel<typeof runsTable>;

export type NewRunRecord = InferInsertModel<typeof runsTable>;
