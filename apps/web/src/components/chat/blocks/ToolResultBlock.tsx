import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import { RunActivityFeed } from '../activity/RunActivityFeed.js';
import { adaptToolResultBlock } from '../activity/runActivityAdapter.js';

type ToolResultBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'tool_result' }>;
	isDeveloperMode?: boolean;
}>;

export function ToolResultBlock({
	block,
	isDeveloperMode = false,
}: ToolResultBlockProps): ReactElement {
	const row = adaptToolResultBlock(block, isDeveloperMode);

	return <RunActivityFeed rows={[row]} />;
}
