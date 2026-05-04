import { desktopAgentToolNames } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { desktopAgentImplementedCapabilities } from './ws-bridge.js';

describe('desktop agent bridge capabilities', () => {
	it('advertises every shared desktop-agent bridge capability implemented by the agent', () => {
		expect(
			desktopAgentImplementedCapabilities.map((capability) => capability.tool_name).sort(),
		).toEqual([...desktopAgentToolNames].sort());
	});
});
