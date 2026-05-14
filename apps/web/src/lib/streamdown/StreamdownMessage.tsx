import { cjk } from '@streamdown/cjk';
import { createMathPlugin } from '@streamdown/math';
import { cloneElement, isValidElement } from 'react';
import type { ComponentProps, ReactElement } from 'react';
import { Streamdown } from 'streamdown';
import { CodeBlock } from './CodeBlock';
import { MermaidBlock } from './MermaidBlock';

type CodeProps = ComponentProps<'code'> & {
	'data-block'?: unknown;
	inline?: boolean;
};

type PreProps = ComponentProps<'pre'>;

const math = createMathPlugin({ singleDollarTextMath: true });
const streamdownPlugins = { cjk, math };

const components = {
	code({ children, className, inline, ...props }: CodeProps) {
		const content = String(children ?? '').replace(/\n$/, '');
		const isBlock =
			Boolean(props['data-block']) || (inline !== true && className?.includes('language-'));

		if (!isBlock) {
			return (
				<code className={className} {...props}>
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
		return <code {...props} />;
	},
	pre({ children, ...props }: PreProps) {
		if (isValidElement(children)) {
			return cloneElement(children as ReactElement<Record<string, unknown>>, {
				'data-block': 'true',
			});
		}

		return <pre {...props}>{children}</pre>;
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
			className={className}
			components={components}
			mode={mode}
			plugins={streamdownPlugins}
		>
			{children}
		</Streamdown>
	);
}
