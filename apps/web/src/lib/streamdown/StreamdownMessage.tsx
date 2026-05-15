'use client';

import { cjk } from '@streamdown/cjk';
import { createMathPlugin } from '@streamdown/math';
import { cloneElement, isValidElement } from 'react';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { Streamdown } from 'streamdown';
import { CodeBlock } from './CodeBlock';
import { MermaidBlock } from './MermaidBlock';
import { getSafeHref, isExternalHref } from './markdownLinks';

type CodeProps = ComponentProps<'code'> & {
	'data-block'?: unknown;
	inline?: boolean;
};

type PreProps = ComponentProps<'pre'>;

function cx(...classes: Array<string | undefined | null | false>): string {
	return classes.filter(Boolean).join(' ');
}

const math = createMathPlugin({ singleDollarTextMath: true });
const streamdownPlugins = { cjk, math };

function LinkComponent({ children, href: rawHref, ...props }: ComponentProps<'a'>) {
	const href = getSafeHref(rawHref);

	if (!href) {
		return (
			<span className="runa-markdown__link" {...props}>
				{children}
			</span>
		);
	}

	if (isExternalHref(href)) {
		return (
			<a
				className="runa-markdown__link"
				href={href}
				rel="noreferrer noopener"
				target="_blank"
				{...props}
			>
				{children}
			</a>
		);
	}

	return (
		<a className="runa-markdown__link" href={href} {...props}>
			{children}
		</a>
	);
}

const components = {
	code({ children, className, inline, ...props }: CodeProps) {
		const content = String(children ?? '').replace(/\n$/, '');
		const isBlock =
			Boolean(props['data-block']) || (inline !== true && className?.includes('language-'));

		if (!isBlock) {
			return (
				<code className={cx(className, 'runa-markdown__inline-code')} {...props}>
					{children}
				</code>
			);
		}

		if (/language-mermaid(?:\s|$)/.test(className ?? '')) {
			return <MermaidBlock code={content} />;
		}

		return <CodeBlock className={className} code={content} />;
	},
	inlineCode(props: ComponentProps<'code'>) {
		return <code className="runa-markdown__inline-code" {...props} />;
	},
	pre({ children, ...props }: PreProps) {
		if (isValidElement(children)) {
			return cloneElement(children as ReactElement<Record<string, unknown>>, {
				'data-block': 'true',
			});
		}

		return <pre {...props}>{children}</pre>;
	},
	p({ children, ...props }: ComponentProps<'p'>) {
		return (
			<p className="runa-markdown__paragraph" {...props}>
				{children}
			</p>
		);
	},
	h1({ children, ...props }: ComponentProps<'h1'>) {
		return (
			<h1 className="runa-markdown__heading" data-level="1" {...props}>
				{children}
			</h1>
		);
	},
	h2({ children, ...props }: ComponentProps<'h2'>) {
		return (
			<h2 className="runa-markdown__heading" data-level="2" {...props}>
				{children}
			</h2>
		);
	},
	h3({ children, ...props }: ComponentProps<'h3'>) {
		return (
			<h3 className="runa-markdown__heading" data-level="3" {...props}>
				{children}
			</h3>
		);
	},
	ul({ children, ...props }: ComponentProps<'ul'>) {
		return (
			<ul className="runa-markdown__list" data-list-kind="unordered" {...props}>
				{children}
			</ul>
		);
	},
	ol({ children, ...props }: ComponentProps<'ol'>) {
		return (
			<ol className="runa-markdown__list" data-list-kind="ordered" {...props}>
				{children}
			</ol>
		);
	},
	li({ children, ...props }: ComponentProps<'li'>) {
		return (
			<li className="runa-markdown__list-item" {...props}>
				{children}
			</li>
		);
	},
	blockquote({ children, ...props }: ComponentProps<'blockquote'>) {
		return (
			<blockquote className="runa-markdown__blockquote" {...props}>
				{children}
			</blockquote>
		);
	},
	a: LinkComponent,
	table({ children, ...props }: ComponentProps<'table'>) {
		return (
			<div className="runa-markdown__table-wrap">
				<table className="runa-markdown__table" {...props}>
					{children}
				</table>
			</div>
		);
	},
	thead(props: ComponentProps<'thead'>) {
		return <thead {...props} />;
	},
	tbody(props: ComponentProps<'tbody'>) {
		return <tbody {...props} />;
	},
	tr(props: ComponentProps<'tr'>) {
		return <tr {...props} />;
	},
	th({ children, ...props }: ComponentProps<'th'>) {
		return <th {...props}>{children}</th>;
	},
	td({ children, ...props }: ComponentProps<'td'>) {
		return <td {...props}>{children}</td>;
	},
	hr(props: ComponentProps<'hr'>) {
		return <hr className="runa-markdown__rule" {...props} />;
	},
};

type StreamdownMessageProps = {
	children: string;
	className?: string;
	mode?: 'static' | 'streaming';
};

export function StreamdownMessage({
	children,
	className,
	mode = 'static',
}: StreamdownMessageProps) {
	return (
		<Streamdown
			className={cx('runa-markdown', mode === 'streaming' && 'runa-markdown--streaming', className)}
			components={components}
			mode={mode}
			plugins={streamdownPlugins}
		>
			{children}
		</Streamdown>
	);
}
