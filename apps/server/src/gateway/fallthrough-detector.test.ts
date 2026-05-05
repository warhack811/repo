import { describe, expect, it } from 'vitest';

import { detectToolCallFallthrough } from './fallthrough-detector.js';

describe('detectToolCallFallthrough', () => {
	it.each([
		{
			suspected_tool_name: 'file.read',
			text: '{"name":"file.read","arguments":{"path":"README.md"}}',
		},
		{
			suspected_tool_name: 'shell.exec',
			text: '{"function":{"name":"shell.exec","arguments":{"command":"pnpm test"}}}',
		},
		{
			suspected_tool_name: 'file_read',
			text: 'file_read({"path":"README.md"})',
		},
		{
			suspected_tool_name: undefined,
			text: '|DSML| <function_call>{"name":"file.read"}</function_call>',
		},
	])('flags high-confidence tool-call fallthrough: $text', ({ suspected_tool_name, text }) => {
		expect(detectToolCallFallthrough(text)).toMatchObject({
			confidence: 'high',
			is_fallthrough: true,
			...(suspected_tool_name ? { suspected_tool_name } : {}),
		});
	});

	it.each([
		{
			suspected_tool_name: 'file.read',
			text: 'I will call file.read tool with parameters {"path":"README.md"}',
		},
		{
			suspected_tool_name: 'search.codebase',
			text: 'calling the search.codebase tool with parameters below',
		},
		{
			suspected_tool_name: undefined,
			text: 'arguments: {"timezone":"Europe/Istanbul"}',
		},
		{
			suspected_tool_name: 'desktop.screenshot',
			text: 'I will call desktop.screenshot using arguments from the request.',
		},
	])(
		'flags medium-confidence text without requiring content drop: $text',
		({ suspected_tool_name, text }) => {
			expect(detectToolCallFallthrough(text)).toMatchObject({
				confidence: 'medium',
				is_fallthrough: true,
				...(suspected_tool_name ? { suspected_tool_name } : {}),
			});
		},
	);

	it.each([
		'I will use the tool after checking the file.',
		'This function returns a string value.',
		'Call this helper from the adapter only.',
		'The tool field is a string in this schema.',
	])('keeps keyword-only hints at low confidence: %s', (text) => {
		expect(detectToolCallFallthrough(text)).toMatchObject({
			confidence: 'low',
			is_fallthrough: true,
		});
	});

	it.each([
		'package.json dosyasini kontrol ediyorum, icinde scripts var.',
		'package.json dosyasina bakiyorum.',
		'Simdi file.read araciyla README dosyasini okuyorum.',
		'I will read package.json before editing.',
		'Use arguments carefully when documenting the API.',
		'Parameters are listed in the table below.',
	])('does not escalate ordinary narration or documentation text: %s', (text) => {
		const detection = detectToolCallFallthrough(text);

		expect(detection.confidence).toBe('low');
		expect(detection.is_fallthrough).toBe(false);
	});
});
