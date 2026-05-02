import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseToolCallCandidatePartsDetailed } from './tool-call-candidate.js';

interface ToolCallPayloadFixture {
	readonly expected_rejection_reason?: 'unparseable_tool_input';
	readonly expected_repair_strategy?:
		| 'empty_default'
		| 'fence_stripped'
		| 'sanitized'
		| 'strict'
		| 'trailing_comma'
		| 'wrapped';
	readonly tool_input: unknown;
}

const fixturesDirectory = join(process.cwd(), 'test', 'fixtures', 'tool-call-payloads');

async function readFixture(filename: string): Promise<ToolCallPayloadFixture> {
	const fixtureContent = await readFile(join(fixturesDirectory, filename), 'utf8');

	return JSON.parse(fixtureContent.replace(/^\uFEFF/u, '')) as ToolCallPayloadFixture;
}

describe('tool-call-candidate fixture replay', () => {
	it('replays captured malformed provider payload shapes against the tolerant parser', async () => {
		const fixtureFilenames = await readdir(fixturesDirectory);

		expect(fixtureFilenames.sort()).toEqual([
			'code-fence-wrapped.json',
			'trailing-comma.json',
			'truncated-stream.json',
			'valid-strict.json',
		]);

		for (const filename of fixtureFilenames) {
			const fixture = await readFixture(filename);
			const parseResult = parseToolCallCandidatePartsDetailed({
				call_id: `call_fixture_${filename}`,
				tool_input: fixture.tool_input,
				tool_name: 'file.read',
			});

			if (fixture.expected_repair_strategy !== undefined) {
				expect(parseResult.repair_strategy, filename).toBe(fixture.expected_repair_strategy);
				expect(parseResult.candidate, filename).toBeDefined();
				continue;
			}

			expect(parseResult.rejection_reason, filename).toBe(fixture.expected_rejection_reason);
		}
	});
});
