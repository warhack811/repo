export const designTokens = {
	color: {
		background: {
			page: 'var(--surface-1)',
			canvas: 'var(--surface-2)',
			elevated: 'var(--surface-2)',
			input: 'var(--surface-2)',
			panel: 'var(--surface-2)',
			panelStrong: 'var(--surface-4)',
			subtle: 'var(--surface-3)',
		},
		border: {
			accent: 'color-mix(in srgb, var(--accent) 45%, transparent)',
			danger: 'color-mix(in srgb, var(--error) 46%, transparent)',
			info: 'color-mix(in srgb, var(--accent-2) 40%, transparent)',
			soft: 'color-mix(in srgb, var(--ink-1) 8%, transparent)',
			strong: 'color-mix(in srgb, var(--ink-1) 22%, transparent)',
			subtle: 'color-mix(in srgb, var(--ink-1) 14%, transparent)',
			success: 'color-mix(in srgb, var(--status) 40%, transparent)',
			warning: 'color-mix(in srgb, var(--warn) 46%, transparent)',
		},
		foreground: {
			accent: 'var(--accent-2)',
			danger: 'color-mix(in srgb, var(--error) 84%, white)',
			info: 'var(--accent-2)',
			inverse: 'var(--accent-fg)',
			muted: 'var(--ink-2)',
			soft: 'var(--ink-2)',
			strong: 'var(--ink-1)',
			success: 'color-mix(in srgb, var(--status) 85%, white)',
			text: 'var(--ink-1)',
			warning: 'color-mix(in srgb, var(--warn) 84%, white)',
		},
		interactive: {
			primary: 'var(--accent)',
			secondary: 'var(--surface-2)',
			secondaryActive: 'var(--accent-bg)',
		},
		status: {
			dangerBackground: 'var(--error-bg)',
			infoBackground: 'var(--status-bg)',
			neutralBackground: 'var(--surface-3)',
			successBackground: 'var(--status-bg)',
			warningBackground: 'var(--warn-bg)',
		},
	},
	motion: {
		duration: {
			fast: 'var(--duration-fast)',
			normal: 'var(--duration-normal)',
		},
		easing: {
			standard: 'var(--ease-standard)',
		},
		transition: {
			focus:
				'border-color var(--duration-normal) var(--ease-standard), box-shadow var(--duration-normal) var(--ease-standard), background var(--duration-normal) var(--ease-standard)',
			surface:
				'opacity var(--duration-slow) var(--ease-standard), transform var(--duration-slow) var(--ease-standard), border-color var(--duration-slow) var(--ease-standard), box-shadow var(--duration-slow) var(--ease-standard)',
		},
	},
	radius: {
		button: 'var(--radius-panel)',
		card: 'var(--radius-panel)',
		control: 'var(--radius-panel)',
		image: 'var(--radius-panel)',
		pill: 'var(--radius-pill)',
		soft: 'var(--radius-input)',
	},
	shadow: {
		glow: '0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent)',
		inset: 'inset 0 1px 0 color-mix(in srgb, var(--ink-1) 8%, transparent)',
		panel: 'var(--shadow)',
		panelSoft: '0 14px 32px rgba(0, 0, 0, 0.22)',
		primaryButton: 'none',
	},
	spacing: {
		xxs: '4px',
		xs: '8px',
		sm: '10px',
		md: '12px',
		lg: '16px',
		xl: '20px',
		xxl: '24px',
		panel: 'clamp(18px, 3vw, 24px)',
		pageX: 'clamp(12px, 3vw, 16px)',
		pageY: 'clamp(18px, 4vw, 32px)',
		shellGap: 'clamp(16px, 3vw, 20px)',
		subcard: '16px',
	},
	typography: {
		bodyFamily: 'var(--font-body)',
		headingFamily: 'var(--font-heading)',
		label: {
			fontSize: '11px',
			fontWeight: 700,
			letterSpacing: 0,
			textTransform: 'uppercase',
		},
		small: {
			fontSize: '12px',
			lineHeight: 1.5,
		},
		text: {
			fontSize: 'var(--text-md)',
			lineHeight: 1.6,
		},
	},
	zIndex: {
		base: 0,
		header: 20,
		overlay: 40,
		modal: 60,
		toast: 80,
	},
} as const;

export type DesignTokens = typeof designTokens;
