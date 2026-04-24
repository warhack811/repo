import type { CSSProperties, ReactElement, TextareaHTMLAttributes } from 'react';

import { designTokens } from '../../lib/design-tokens.js';

export type RunaTextareaProps = Readonly<TextareaHTMLAttributes<HTMLTextAreaElement>>;

const textareaStyle: CSSProperties = {
	background: designTokens.color.background.input,
	border: `1px solid ${designTokens.color.border.subtle}`,
	borderRadius: designTokens.radius.soft,
	boxShadow: designTokens.shadow.inset,
	boxSizing: 'border-box',
	color: designTokens.color.foreground.text,
	fontSize: '15px',
	lineHeight: 1.6,
	minHeight: '140px',
	minWidth: 0,
	padding: '14px 16px',
	resize: 'vertical',
	transition: designTokens.motion.transition.focus,
	width: '100%',
};

export function RunaTextarea({
	className,
	style,
	...textareaProps
}: RunaTextareaProps): ReactElement {
	const mergedClassName = ['runa-ui-textarea', className].filter(Boolean).join(' ');

	return (
		<textarea
			{...textareaProps}
			className={mergedClassName}
			style={{ ...textareaStyle, ...style }}
		/>
	);
}
