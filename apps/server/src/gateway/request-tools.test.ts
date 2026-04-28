import type { ModelCallableTool } from '@runa/types';
import { describe, expect, it } from 'vitest';

import { serializeCallableTool } from './request-tools.js';

describe('request tool serialization', () => {
	it('serializes string enum constraints for provider tool schemas', () => {
		const roleParameterName = 'sub_agent_role';
		const tool: ModelCallableTool = {
			description: 'Delegate bounded work to another agent.',
			name: 'agent.delegate',
			parameters: {
				sub_agent_role: {
					description: 'Choose exactly one role.',
					enum: ['researcher', 'reviewer', 'coder'],
					required: true,
					type: 'string',
				},
			},
		};

		expect(serializeCallableTool(tool).parameters.properties[roleParameterName]).toEqual({
			description: 'Choose exactly one role.',
			enum: ['researcher', 'reviewer', 'coder'],
			type: 'string',
		});
	});
});
