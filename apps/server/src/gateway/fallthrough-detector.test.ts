import { describe, expect, it } from 'vitest';

import { detectToolCallFallthrough } from './fallthrough-detector.js';

describe('detectToolCallFallthrough', () => {
	it.each([
		{
			confidence: 'high',
			suspected_tool_name: 'file.read',
			text: '{"name":"file.read","arguments":{"path":"README.md"}}',
		},
		{
			confidence: 'high',
			suspected_tool_name: 'shell.exec',
			text: '{"function":{"name":"shell.exec","arguments":{"command":"pnpm test"}}}',
		},
		{
			confidence: 'high',
			suspected_tool_name: 'file_read',
			text: 'file_read({"path":"README.md"})',
		},
		{
			confidence: 'high',
			suspected_tool_name: undefined,
			text: '|DSML| <function_call>{"name":"file.read"}</function_call>',
		},
		{
			confidence: 'high',
			suspected_tool_name: 'file.read',
			text: 'I\'ll call file.read tool with parameters {"path":"README.md"}',
		},
		{
			confidence: 'medium',
			suspected_tool_name: undefined,
			text: 'parameters: {"timezone":"Europe/Istanbul"}',
		},
	])('flags function-call-looking text: $text', ({ confidence, suspected_tool_name, text }) => {
		expect(detectToolCallFallthrough(text)).toMatchObject({
			confidence,
			is_fallthrough: true,
			...(suspected_tool_name ? { suspected_tool_name } : {}),
		});
	});

	it.each([
		'package.json dosyasina bakiyorum.',
		'Simdi file.read araciyla README dosyasini okuyorum.',
		'I will read package.json before editing.',
		'Use arguments carefully when documenting the API.',
		'Parameters are listed in the table below.',
		'tool_name is a string in this schema, not a call.',
	])('does not flag ordinary narration or documentation text: %s', (text) => {
		expect(detectToolCallFallthrough(text)).toEqual({
			confidence: 'low',
			is_fallthrough: false,
		});
	});
});
