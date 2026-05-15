// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StreamdownMessage } from './StreamdownMessage';

function render(children: string) {
	return renderToStaticMarkup(<StreamdownMessage>{children}</StreamdownMessage>);
}

describe('StreamdownMessage markdown semantic render', () => {
	it('renders paragraphs', () => {
		const html = render('Merhaba dünya');
		expect(html).toContain('class="runa-markdown__paragraph"');
		expect(html).toContain('Merhaba dünya');
	});

	it('renders h1 heading', () => {
		const html = render('# Başlık');
		expect(html).toContain('data-level="1"');
		expect(html).toContain('class="runa-markdown__heading"');
		expect(html).toContain('Başlık');
	});

	it('renders h2 heading', () => {
		const html = render('## Alt Başlık');
		expect(html).toContain('data-level="2"');
	});

	it('renders h3 heading', () => {
		const html = render('### Alt Alt Başlık');
		expect(html).toContain('data-level="3"');
	});

	it('renders unordered list', () => {
		const html = render('- madde 1\n- madde 2');
		expect(html).toContain('data-list-kind="unordered"');
		expect(html).toContain('class="runa-markdown__list"');
		expect(html).toContain('class="runa-markdown__list-item"');
	});

	it('renders ordered list', () => {
		const html = render('1. birinci\n2. ikinci');
		expect(html).toContain('data-list-kind="ordered"');
	});

	it('renders blockquote', () => {
		const html = render('> alıntı metni');
		expect(html).toContain('class="runa-markdown__blockquote"');
		expect(html).toContain('alıntı metni');
	});

	it('renders horizontal rule', () => {
		const html = render('---');
		expect(html).toContain('class="runa-markdown__rule"');
	});
});

describe('StreamdownMessage inline code', () => {
	it('renders inline code with class', () => {
		const html = render('`konsol.log()` çağrısı');
		expect(html).toContain('class="runa-markdown__inline-code"');
		expect(html).toContain('konsol.log()');
	});

	it('separates inline code from fenced blocks', () => {
		const html = render('Bu bir `inline` kod örneğidir');
		expect(html).toContain('class="runa-markdown__inline-code"');
		expect(html).not.toContain('runa-code-block');
	});
});

describe('StreamdownMessage fenced code block', () => {
	it('renders CodeBlock surface', () => {
		const html = render('```ts\nconst x = 1;\n```');
		expect(html).toContain('runa-code-block');
	});

	it('renders mermaid block for language-mermaid', () => {
		const html = render('```mermaid\nflowchart LR\n  A-->B\n```');
		expect(html).toContain('Diyagram yükleniyor...');
	});
});

describe('StreamdownMessage table', () => {
	it('renders table wrapper and elements', () => {
		const html = render(
			'| Başlık 1 | Başlık 2 |\n|----------|----------|\n| Hücre 1  | Hücre 2  |',
		);
		expect(html).toContain('class="runa-markdown__table-wrap"');
		expect(html).toContain('class="runa-markdown__table"');
	});

	it('renders th and td', () => {
		const html = render('| A | B |\n|---|---|\n| 1 | 2 |');
		expect(html).toContain('<th');
		expect(html).toContain('<td');
	});
});

describe('StreamdownMessage links', () => {
	it('renders https link with target and rel', () => {
		const html = render('[örnek](https://example.com)');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="');
		expect(html).toContain('noopener');
		expect(html).toContain('noreferrer');
		expect(html).toContain('örnek');
	});

	it('renders relative link without blank target', () => {
		const html = render('[göreceli](/sayfa)');
		expect(html).toContain('href="/sayfa"');
	});

	it('does not render javascript: href as clickable link', () => {
		const html = render('[bad](javascript:alert(1))');
		expect(html).not.toContain('href="javascript:');
		expect(html).not.toContain('href="javascript:alert(1)"');
		expect(html).toContain('bad');
	});

	it('does not render data: href as clickable link', () => {
		const html = render('[bad2](data:text/html,<script>alert(1)</script>)');
		expect(html).not.toContain('href="data:');
	});

	it('renders mailto link', () => {
		const html = render('[email](mailto:test@example.com)');
		expect(html).toContain('href="mailto:test@example.com"');
	});
});

describe('StreamdownMessage mojibake', () => {
	it('does not contain mojibake patterns in rendered output', () => {
		const patterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const html = render('## Diyagram Yükleniyor\n> alıntı\n`kod`');
		for (const pattern of patterns) {
			expect(html).not.toContain(pattern);
		}
	});
});

describe('StreamdownMessage root class', () => {
	it('has runa-markdown root container class', () => {
		const html = render('test');
		expect(html).toContain('class="runa-markdown');
	});

	it('merges custom className', () => {
		const html = renderToStaticMarkup(
			<StreamdownMessage className="custom-class">test</StreamdownMessage>,
		);
		expect(html).toContain('runa-markdown');
		expect(html).toContain('custom-class');
	});
});
