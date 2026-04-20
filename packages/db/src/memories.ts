import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import type { memoriesTable } from './schema.js';

export type MemoryRecord = InferSelectModel<typeof memoriesTable>;

export type NewMemoryRecord = InferInsertModel<typeof memoriesTable>;
