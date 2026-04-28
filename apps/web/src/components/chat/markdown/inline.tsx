import type { ReactNode } from 'react';

import { parseInlineMarkdown } from './parser.js';

export function renderInlineMarkdown(content: string): ReactNode {
	return parseInlineMarkdown(content).map((token, index) => {
		const key = `inline:${index}:${token.type}`;

		if (token.type === 'code') {
			return (
				<code className="runa-markdown__inline-code" key={key}>
					{token.text}
				</code>
			);
		}

		if (token.type === 'link') {
			const href = token.href.trim();
			const isSafeHref = /^https?:\/\//iu.test(href) || href.startsWith('mailto:');

			if (!isSafeHref) {
				return token.label.length > 0 ? token.label : href;
			}

			return (
				<a className="runa-markdown__link" href={href} key={key} rel="noreferrer" target="_blank">
					{token.label.length > 0 ? token.label : href}
				</a>
			);
		}

		return token.text;
	});
}
