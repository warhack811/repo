import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MarkdownRenderer } from './MarkdownRenderer.js';
import { ScreenshotCard } from './ScreenshotCard.js';
import { StreamingMessageSurface } from './StreamingMessageSurface.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolActivityIndicator } from './ToolActivityIndicator.js';

describe('UI Phase 5 surfaces', () => {
	it('renders markdown tables, code and safe links while blocking dangerous schemes', () => {
		const markup = renderToStaticMarkup(
			<MarkdownRenderer
				content={[
					'## Report',
					'[safe](https://example.com) [bad](javascript:alert(1))',
					'| A | B |',
					'| --- | --- |',
					'| one | two |',
					'```ts',
					'export const value = 1;',
					'```',
				].join('\n')}
			/>,
		);

		expect(markup).toContain('href="https://example.com"');
		expect(markup).not.toContain('javascript:alert');
		expect(markup).toContain('<table');
		expect(markup).toContain('export const value = 1;');
	});

	it('renders streaming partial markdown without dropping the live response', () => {
		const markup = renderToStaticMarkup(
			<StreamingMessageSurface
				currentRunId="run_stream"
				currentStreamingRunId="run_stream"
				currentStreamingText={'Streaming\n```ts\nconst value = 1;'}
			/>,
		);

		expect(markup).toContain('Canli yanit');
		expect(markup).toContain('const value = 1;');
		expect(markup).toContain('aria-live="polite"');
	});

	it('renders thinking and tool activity without raw reasoning text', () => {
		const thinkingMarkup = renderToStaticMarkup(
			<ThinkingBlock
				isActive
				steps={[
					{
						id: 'step-1',
						label: 'Dosyalar inceleniyor',
						status: 'active',
						tool_name: 'search.codebase',
					},
				]}
			/>,
		);
		const activityMarkup = renderToStaticMarkup(
			<ToolActivityIndicator
				items={[
					{
						id: 'tool-1',
						label: 'search.codebase',
						status: 'completed',
					},
				]}
			/>,
		);

		expect(thinkingMarkup).toContain('Runa calisiyor');
		expect(thinkingMarkup).not.toContain('chain-of-thought');
		expect(activityMarkup).toContain('completed');
	});

	it('renders screenshot preview with lazy image metadata', () => {
		const markup = renderToStaticMarkup(
			<ScreenshotCard
				caption="Desktop screenshot"
				imageUrl="https://example.com/screenshot.png"
				timestamp="2026-04-25T12:00:00.000Z"
			/>,
		);

		expect(markup).toContain('loading="lazy"');
		expect(markup).toContain('Desktop screenshot');
		expect(markup).toContain('2026-04-25T12:00:00.000Z');
	});
});
