export const designTokens = {
	color: {
		background: {
			page: 'var(--page-background)',
			canvas: 'var(--surface-canvas)',
			elevated: 'hsl(var(--color-bg-elevated))',
			input: 'var(--gradient-input)',
			panel: 'var(--gradient-panel)',
			panelStrong: 'var(--gradient-panel-strong)',
			subtle: 'var(--gradient-subcard)',
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
			muted: 'hsl(var(--color-text-muted))',
			soft: 'hsl(var(--color-text-soft))',
			strong: 'var(--text-strong)',
			success: 'var(--status-success-text)',
			text: 'hsl(var(--color-text))',
			warning: 'var(--status-warning-text)',
		},
		interactive: {
			primary: 'var(--gradient-primary-button)',
			secondary: 'var(--gradient-secondary-button)',
			secondaryActive: 'var(--gradient-secondary-button-active)',
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
			fast: '180ms',
			normal: '220ms',
		},
		easing: {
			standard: 'ease',
		},
		transition: {
			focus: 'border-color 180ms ease, box-shadow 180ms ease, background 180ms ease',
			surface:
				'opacity 220ms ease, transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
		},
	},
	radius: {
		button: '14px',
		card: 'var(--radius-panel)',
		control: '14px',
		image: '14px',
		pill: 'var(--radius-pill)',
		soft: 'var(--radius-soft)',
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
			fontSize: '14px',
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
