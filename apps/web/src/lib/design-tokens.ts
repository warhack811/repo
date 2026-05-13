export const designTokens = {
	color: {
		background: {
			page: 'var(--page-background)',
			canvas: 'var(--surface-canvas)',
			elevated: 'var(--surface-2)',
			input: 'var(--surface-2)',
			panel: 'var(--surface-2)',
			panelStrong: 'var(--surface-2)',
			subtle: 'var(--surface-3)',
		},
		border: {
			accent: 'var(--border-primary)',
			danger: 'var(--border-danger)',
			info: 'var(--border-info)',
			soft: 'var(--border-subtle)',
			strong: 'var(--border-strong)',
			subtle: 'var(--border-default)',
			success: 'var(--border-success)',
			warning: 'var(--border-warning)',
		},
		foreground: {
			accent: 'var(--text-link)',
			danger: 'var(--status-danger-text)',
			info: 'var(--status-info-text)',
			inverse: 'var(--text-on-primary)',
			muted: 'var(--ink-2)',
			soft: 'var(--ink-2)',
			strong: 'var(--text-strong)',
			success: 'var(--status-success-text)',
			text: 'var(--ink-1)',
			warning: 'var(--status-warning-text)',
		},
		interactive: {
			primary: 'var(--accent)',
			secondary: 'var(--surface-2)',
			secondaryActive: 'var(--accent-bg)',
		},
		status: {
			dangerBackground: 'var(--status-danger-bg)',
			infoBackground: 'var(--status-info-bg)',
			neutralBackground: 'var(--surface-chip)',
			successBackground: 'var(--status-success-bg)',
			warningBackground: 'var(--status-warning-bg)',
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
		glow: 'var(--shadow-glow)',
		inset: 'var(--shadow-inset)',
		panel: 'var(--shadow-panel)',
		panelSoft: 'var(--shadow-panel-soft)',
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
		panel: 'var(--space-panel)',
		pageX: 'var(--space-page-x)',
		pageY: 'var(--space-page-y)',
		shellGap: 'clamp(16px, 3vw, 20px)',
		subcard: 'var(--space-subcard)',
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
