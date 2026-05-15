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

	it('renders known and unknown code fences with Shiki and copy affordance', async () => {
		const multiLanguageFixture = [
			codeTypescriptFixture,
			'```javascript\nconst value = 1;\n```',
			'```python\nprint("runa")\n```',
			'```json\n{"ok": true}\n```',
			'```bash\necho "runa"\n```',
			codeUnknownLanguageFixture,
		].join('\n\n');
		const { container } = render(<StreamdownMessage>{multiLanguageFixture}</StreamdownMessage>);

		expect(screen.getByText(/const x: number = 42/)).toBeTruthy();
		expect(screen.getByText(/const x = 1/)).toBeTruthy();
		expect(container.querySelector('[data-language="typescript"]')).toBeTruthy();
		expect(container.querySelector('[data-language="javascript"]')).toBeTruthy();
		expect(container.querySelector('[data-language="python"]')).toBeTruthy();
		expect(container.querySelector('[data-language="json"]')).toBeTruthy();
		expect(container.querySelector('[data-language="bash"]')).toBeTruthy();
		expect(container.querySelector('[data-language="runa-unknown"]')).toBeTruthy();
		expect(screen.getAllByRole('button', { name: /Kopyala/i }).length).toBe(6);
		await waitFor(() => {
			expect(container.querySelectorAll('.shiki').length).toBeGreaterThanOrEqual(5);
		});
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

		expect(screen.getByText(/Diyagram yükleniyor/i)).toBeTruthy();
		expect(screen.getByText(/Bir/)).toBeTruthy();
	});

	it.skip('documents future media fixture for image generation parts', () => {
		expect(futureMediaFixture.jobs[0]?.kind).toBe('image-generation');
	});
});
