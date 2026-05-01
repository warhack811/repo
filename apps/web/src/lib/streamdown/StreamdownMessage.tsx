import { cjk } from '@streamdown/cjk';
import { createMathPlugin } from '@streamdown/math';
import type { ComponentProps } from 'react';
import { Streamdown } from 'streamdown';
import { CodeBlock } from './CodeBlock';
import { MermaidBlock } from './MermaidBlock';

type CodeProps = ComponentProps<'code'> & {
	inline?: boolean;
};

const math = createMathPlugin({ singleDollarTextMath: true });
const streamdownPlugins = { cjk, math };

const components = {
	code({ children, className, inline, ...props }: CodeProps) {
		const content = String(children ?? '').replace(/\n$/, '');

		if (inline || !className?.includes('language-')) {
			return (
				<code className={className} {...props}>
					{children}
				</code>
			);
		}

		if (/language-mermaid(?:\s|$)/.test(className)) {
			return <MermaidBlock code={content} />;
		}

		return <CodeBlock className={className} code={content} />;
	},
	inlineCode(props: ComponentProps<'code'>) {
		return <code {...props} />;
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
