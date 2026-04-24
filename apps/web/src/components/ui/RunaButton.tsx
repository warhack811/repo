import type { ButtonHTMLAttributes, CSSProperties, ReactElement, ReactNode } from 'react';

import { designTokens } from '../../lib/design-tokens.js';

export type RunaButtonVariant = 'danger' | 'ghost' | 'primary' | 'secondary';

export type RunaButtonProps = Readonly<
	ButtonHTMLAttributes<HTMLButtonElement> & {
		children: ReactNode;
		variant?: RunaButtonVariant;
	}
>;

const baseButtonStyle: CSSProperties = {
	alignItems: 'center',
	borderRadius: designTokens.radius.button,
	cursor: 'pointer',
	display: 'inline-flex',
	fontWeight: 700,
	gap: designTokens.spacing.sm,
	justifyContent: 'center',
	padding: '12px 16px',
	textDecoration: 'none',
	transition:
		'transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease',
};

const buttonVariantStyles: Record<RunaButtonVariant, CSSProperties> = {
	danger: {
		background: designTokens.color.status.dangerBackground,
		border: `1px solid ${designTokens.color.border.danger}`,
		color: designTokens.color.foreground.danger,
	},
	ghost: {
		background: 'transparent',
		border: `1px solid ${designTokens.color.border.soft}`,
		color: designTokens.color.foreground.muted,
	},
	primary: {
		background: designTokens.color.interactive.primary,
		border: 'none',
		boxShadow: designTokens.shadow.primaryButton,
		color: designTokens.color.foreground.inverse,
	},
	secondary: {
		background: designTokens.color.interactive.secondary,
		border: `1px solid ${designTokens.color.border.strong}`,
		boxShadow: designTokens.shadow.inset,
		color: designTokens.color.foreground.text,
	},
};

export function RunaButton({
	children,
	className,
	disabled,
	style,
	type = 'button',
	variant = 'secondary',
	...buttonProps
}: RunaButtonProps): ReactElement {
	const mergedStyle: CSSProperties = {
		...baseButtonStyle,
		...buttonVariantStyles[variant],
		opacity: disabled ? 0.6 : undefined,
		...style,
	};
	const mergedClassName = ['runa-ui-button', `runa-ui-button--${variant}`, className]
		.filter(Boolean)
		.join(' ');

	return (
		<button
			{...buttonProps}
			className={mergedClassName}
			disabled={disabled}
			style={mergedStyle}
			type={type}
		>
			{children}
		</button>
	);
}
