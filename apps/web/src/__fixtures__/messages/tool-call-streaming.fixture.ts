import type { RunaUiPart } from '../../lib/transport/runa-adapter';

export const toolCallStreamingFixture: RunaUiPart = {
	id: 'tool_fixture',
	input: null,
	output: null,
	state: 'input-streaming',
	toolName: 'web.search',
	type: 'tool',
};
