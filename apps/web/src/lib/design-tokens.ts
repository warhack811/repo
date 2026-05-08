export const designTokens = {
	color: {
		background: {
			page: 'var(--page-background)',
			canvas: '#090d16',
			elevated: 'hsl(var(--color-bg-elevated))',
			input: 'var(--gradient-input)',
			panel: 'var(--gradient-panel)',
			panelStrong: 'var(--gradient-panel-strong)',
			subtle: 'var(--gradient-subcard)',
		},
		border: {
			accent: 'rgba(245, 158, 11, 0.28)',
			danger: 'rgba(248, 113, 113, 0.36)',
			info: 'rgba(56, 189, 248, 0.36)',
			soft: 'rgba(148, 163, 184, 0.16)',
			strong: 'rgba(148, 163, 184, 0.28)',
			subtle: 'rgba(148, 163, 184, 0.2)',
			success: 'rgba(74, 222, 128, 0.28)',
			warning: 'rgba(250, 204, 21, 0.32)',
		},
		foreground: {
			accent: '#fde68a',
			danger: '#fecaca',
			info: '#bae6fd',
			inverse: '#1f1303',
			muted: 'hsl(var(--color-text-muted))',
			soft: 'hsl(var(--color-text-soft))',
			strong: '#f8fafc',
			success: '#bbf7d0',
			text: 'hsl(var(--color-text))',
			warning: '#fde68a',
		},
		interactive: {
			primary: 'var(--gradient-primary-button)',
			secondary: 'var(--gradient-secondary-button)',
			secondaryActive: 'var(--gradient-secondary-button-active)',
		},
		status: {
			dangerBackground: 'rgba(127, 29, 29, 0.28)',
			infoBackground: 'rgba(8, 47, 73, 0.28)',
			neutralBackground: 'rgba(9, 14, 25, 0.82)',
			successBackground: 'rgba(20, 83, 45, 0.24)',
			warningBackground: 'rgba(120, 53, 15, 0.16)',
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
		primaryButton: '0 18px 32px rgba(234, 88, 12, 0.22)',
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
