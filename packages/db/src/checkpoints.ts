import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { checkpointsTable } from './schema.js';

export type CheckpointRecord = InferSelectModel<typeof checkpointsTable>;

export type NewCheckpointRecord = InferInsertModel<typeof checkpointsTable>;
