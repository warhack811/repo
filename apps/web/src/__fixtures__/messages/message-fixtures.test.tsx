import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StreamdownMessage } from '../../lib/streamdown/StreamdownMessage';
import { codeTypescriptFixture } from './code-typescript.fixture';
import { codeUnknownLanguageFixture } from './code-unknown-language.fixture';
import { futureMediaFixture } from './future-media.fixture';
import { markdownBasicFixture } from './markdown-basic.fixture';
import { markdownTableFixture } from './markdown-table.fixture';
import { mathInlineAndDisplayFixture } from './math-inline-and-display.fixture';
import { mermaidDiagramFixture } from './mermaid-diagram.fixture';
import { streamingIncompleteMarkdownFixture } from './streaming-incomplete-markdown.fixture';

describe('message rendering fixtures', () => {
	it('renders basic markdown and GFM tables', () => {
		const { container } = render(
			<>
				<StreamdownMessage>{markdownBasicFixture}</StreamdownMessage>
				<StreamdownMessage>{markdownTableFixture}</StreamdownMessage>
			</>,
		);

		expect(screen.getByRole('heading', { name: 'Başlık' })).toBeTruthy();
		expect(container.querySelector('table')).toBeTruthy();
	});

	it('renders known and unknown code fences without crashing', async () => {
		render(
			<>
				<StreamdownMessage>{codeTypescriptFixture}</StreamdownMessage>
				<StreamdownMessage>{codeUnknownLanguageFixture}</StreamdownMessage>
			</>,
		);

		expect(screen.getByText(/const x: number = 42/)).toBeTruthy();
		expect(screen.getByText(/const x = 1/)).toBeTruthy();
	});

	it('renders KaTeX math nodes', async () => {
		const { container } = render(
			<StreamdownMessage>{mathInlineAndDisplayFixture}</StreamdownMessage>,
		);

		await waitFor(() => {
			expect(container.querySelectorAll('.katex').length).toBeGreaterThan(0);
		});
	});

	it('keeps mermaid and incomplete streaming markdown render-safe', () => {
		render(
			<>
				<StreamdownMessage>{mermaidDiagramFixture}</StreamdownMessage>
				<StreamdownMessage mode="streaming">{streamingIncompleteMarkdownFixture}</StreamdownMessage>
			</>,
		);

		expect(screen.getByText(/Loading diagram/i)).toBeTruthy();
		expect(screen.getByText(/Bir/)).toBeTruthy();
	});

	it.skip('documents future media fixture for image generation parts', () => {
		expect(futureMediaFixture.jobs[0]?.kind).toBe('image-generation');
	});
});
