import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { CurrentRunProgressSurface } from '../../lib/chat-runtime/current-run-progress.js';
import { StreamdownMessage } from '../../lib/streamdown/StreamdownMessage.js';
import { RunProgressPanel } from './RunProgressPanel.js';
import { ScreenshotCard } from './ScreenshotCard.js';
import { StreamingMessageSurface } from './StreamingMessageSurface.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolActivityIndicator } from './ToolActivityIndicator.js';

describe('UI Phase 5 surfaces', () => {
	it('renders markdown tables, code and safe links while blocking dangerous schemes', () => {
		const markup = renderToStaticMarkup(
			<StreamdownMessage>
				{[
					'## Report',
					'[safe](https://example.com) [bad](javascript:alert(1))',
					'| A | B |',
					'| --- | --- |',
					'| one | two |',
					'```ts',
					'export const value = 1;',
					'```',
				].join('\n')}
			</StreamdownMessage>,
		);

		expect(markup).toContain('safe');
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

		expect(markup).toContain('Canlı yanıt');
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

		expect(thinkingMarkup).toContain('Runa çalışıyor');
		expect(thinkingMarkup).not.toContain('chain-of-thought');
		expect(activityMarkup).toContain('completed');
	});

	it('keeps current run tool activity labels user-facing outside developer mode', () => {
		const progress: CurrentRunProgressSurface = {
			approval_block: null,
			correlation_label: null,
			detail: 'Proof saved.',
			headline: 'Calisma tamamlandi',
			hidden_step_count: 0,
			meta_items: [],
			phase_items: [],
			run_id: 'run_activity',
			status_tone: 'success',
			step_items: [
				{
					call_id: 'call_file_write',
					detail: 'file.write completed successfully.',
					kind: 'tool_completed',
					label: 'Wrote file changes',
					state: 'success',
					tool_name: 'file.write',
				},
			],
		};

		const markup = renderToStaticMarkup(<RunProgressPanel progress={progress} />);

		expect(markup).toContain('Dosya yazma');
		expect(markup).not.toContain('file.write');
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
