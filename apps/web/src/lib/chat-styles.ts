import type { CSSProperties } from 'react';

import { designTokens } from './design-tokens.js';

export const panelStyle: CSSProperties = {
	background: designTokens.color.background.panel,
	border: `1px solid ${designTokens.color.border.subtle}`,
	borderRadius: designTokens.radius.card,
	boxShadow: designTokens.shadow.panel,
	padding: designTokens.spacing.panel,
	backdropFilter: 'blur(12px)',
	transition: designTokens.motion.transition.surface,
};

export const pageStyle: CSSProperties = {
	minHeight: '100vh',
	background: designTokens.color.background.page,
	color: designTokens.color.foreground.text,
	fontFamily: designTokens.typography.bodyFamily,
	padding: `${designTokens.spacing.pageY} ${designTokens.spacing.pageX}`,
};

export const heroPanelStyle: CSSProperties = {
	...panelStyle,
	border: '1px solid rgba(245, 158, 11, 0.24)',
	background:
		'radial-gradient(circle at top right, rgba(245, 158, 11, 0.16), transparent 28%), linear-gradient(180deg, rgba(20, 26, 40, 0.92) 0%, rgba(15, 23, 42, 0.82) 100%)',
};

export const formGridStyle: CSSProperties = {
	display: 'grid',
	gap: '12px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
};

export const inputStyle: CSSProperties = {
	width: '100%',
	padding: '10px 12px',
	borderRadius: designTokens.radius.control,
	border: `1px solid ${designTokens.color.border.strong}`,
	background: designTokens.color.background.input,
	color: designTokens.color.foreground.text,
	fontSize: '14px',
	boxSizing: 'border-box',
	minWidth: 0,
	boxShadow: designTokens.shadow.inset,
	transition: designTokens.motion.transition.focus,
};

export const buttonStyle: CSSProperties = {
	padding: '12px 16px',
	borderRadius: designTokens.radius.button,
	border: 'none',
	background: designTokens.color.interactive.primary,
	color: designTokens.color.foreground.inverse,
	fontWeight: 700,
	cursor: 'pointer',
	transition: 'transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease',
};

export const secondaryButtonStyle: CSSProperties = {
	padding: '10px 14px',
	borderRadius: designTokens.radius.button,
	border: `1px solid ${designTokens.color.border.strong}`,
	background: designTokens.color.interactive.secondary,
	color: designTokens.color.foreground.text,
	fontWeight: 600,
	cursor: 'pointer',
	boxShadow: designTokens.shadow.inset,
	transition:
		'transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
};

export const tertiaryButtonStyle: CSSProperties = {
	...secondaryButtonStyle,
	background: 'rgba(6, 11, 21, 0.72)',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	color: 'hsl(var(--color-text-muted))',
};

export const inspectionActionButtonStyle: CSSProperties = {
	...secondaryButtonStyle,
	padding: '6px 10px',
	fontSize: '12px',
};

export const eventListStyle: CSSProperties = {
	display: 'grid',
	gap: '12px',
	maxHeight: 'min(60vh, 480px)',
	minWidth: 0,
	overflow: 'auto',
};

export const eventCardStyle: CSSProperties = {
	borderRadius: 'var(--radius-soft)',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'linear-gradient(180deg, rgba(8, 13, 24, 0.88) 0%, rgba(4, 9, 19, 0.8) 100%)',
	padding: '16px',
	minWidth: 0,
	boxShadow: '0 18px 42px rgba(2, 6, 23, 0.26)',
	transition:
		'opacity 220ms ease, transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
};

export const secondaryLabelStyle: CSSProperties = {
	fontSize: '11px',
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	color: 'hsl(var(--color-text-soft))',
};

export const presentationSubtleTextStyle: CSSProperties = {
	color: 'hsl(var(--color-text-muted))',
	lineHeight: 1.6,
};

export const presentationBlockCardStyle: CSSProperties = {
	...eventCardStyle,
	background: 'linear-gradient(180deg, rgba(10, 16, 28, 0.94) 0%, rgba(4, 9, 19, 0.88) 100%)',
	border: '1px solid rgba(148, 163, 184, 0.16)',
};

export const toolResultPreviewStyle: CSSProperties = {
	marginTop: '10px',
	padding: '12px 14px',
	borderRadius: '14px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'rgba(11, 18, 32, 0.78)',
	color: 'hsl(var(--color-text-muted))',
	fontSize: '12px',
	lineHeight: 1.5,
	wordBreak: 'break-word',
	overflowWrap: 'anywhere',
	transition: 'opacity 220ms ease, transform 220ms ease',
};

export const codeBlockContainerStyle: CSSProperties = {
	marginTop: '10px',
	padding: '14px',
	borderRadius: '16px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'linear-gradient(180deg, rgba(3, 7, 18, 0.96) 0%, rgba(6, 11, 24, 0.88) 100%)',
	maxWidth: '100%',
	overflowX: 'auto',
	boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
};

export const searchMetaGridStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
	marginTop: '12px',
};

export const searchMatchListStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	marginTop: '14px',
};

export const searchMatchCardStyle: CSSProperties = {
	padding: '14px',
	borderRadius: '16px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'rgba(8, 13, 24, 0.82)',
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
};

export const webSearchResultListStyle: CSSProperties = {
	display: 'grid',
	gap: '12px',
	marginTop: '14px',
};

export const webSearchCardStyle: CSSProperties = {
	padding: '16px',
	borderRadius: '18px',
	border: '1px solid rgba(45, 212, 191, 0.22)',
	background: 'linear-gradient(180deg, rgba(7, 24, 31, 0.92) 0%, rgba(3, 10, 19, 0.88) 100%)',
	boxShadow: '0 18px 42px rgba(2, 6, 23, 0.26)',
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
};

export const inspectionChipListStyle: CSSProperties = {
	display: 'flex',
	gap: '8px',
	flexWrap: 'wrap',
	marginTop: '8px',
};

export const inspectionChipStyle: CSSProperties = {
	fontSize: '12px',
	color: 'hsl(var(--color-text-muted))',
	background: 'rgba(10, 16, 28, 0.76)',
	padding: '5px 10px',
	borderRadius: '999px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	maxWidth: '100%',
	overflowWrap: 'anywhere',
	wordBreak: 'break-word',
	transition: 'border-color 180ms ease, background 180ms ease, color 180ms ease',
};

export const inspectionDetailListStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	marginTop: '14px',
};

export const inspectionDetailItemStyle: CSSProperties = {
	padding: '14px',
	borderRadius: '16px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'rgba(8, 13, 24, 0.82)',
	overflowWrap: 'anywhere',
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
};

export const preStyle: CSSProperties = {
	margin: 0,
	whiteSpace: 'pre-wrap',
	wordBreak: 'break-word',
	overflowWrap: 'anywhere',
	overflowX: 'auto',
	maxWidth: '100%',
	fontFamily: '"Consolas", "SFMono-Regular", monospace',
	fontSize: '12px',
	color: 'hsl(var(--color-text-muted))',
	lineHeight: 1.7,
};

export const visuallyHiddenStyle: CSSProperties = {
	border: 0,
	clip: 'rect(0 0 0 0)',
	height: '1px',
	margin: '-1px',
	overflow: 'hidden',
	padding: 0,
	position: 'absolute',
	whiteSpace: 'nowrap',
	width: '1px',
};

export const inspectionSurfaceBannerStyle: CSSProperties = {
	marginBottom: '14px',
	padding: '16px 18px',
	borderRadius: '18px',
	border: '1px solid rgba(96, 165, 250, 0.24)',
	background: 'linear-gradient(180deg, rgba(10, 20, 38, 0.92) 0%, rgba(2, 6, 23, 0.82) 100%)',
	transition: 'opacity 220ms ease, transform 220ms ease',
};

export const inspectionRelationBannerStyle: CSSProperties = {
	marginTop: '14px',
	padding: '14px 16px',
	borderRadius: '16px',
	border: '1px solid rgba(96, 165, 250, 0.24)',
	background: 'rgba(11, 18, 32, 0.72)',
	display: 'grid',
	gap: '8px',
};

export const inspectionRelationMetaStyle: CSSProperties = {
	fontSize: '12px',
	color: 'hsl(var(--color-text-muted))',
	lineHeight: 1.5,
};

export const presentationRunGroupStyle: CSSProperties = {
	borderRadius: '20px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'linear-gradient(180deg, rgba(8, 13, 24, 0.76) 0%, rgba(4, 9, 19, 0.62) 100%)',
	padding: 'clamp(16px, 3vw, 20px)',
	boxShadow: '0 20px 50px rgba(2, 6, 23, 0.24)',
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
};

export const presentationRunHeaderStyle: CSSProperties = {
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'flex-start',
	gap: '12px',
	rowGap: '8px',
	flexWrap: 'wrap',
};

export const presentationRunSummaryStyle: CSSProperties = {
	cursor: 'pointer',
	listStyle: 'none',
	padding: 0,
	transition: 'opacity 180ms ease, transform 180ms ease',
};

export const presentationRunBodyStyle: CSSProperties = {
	display: 'grid',
	gap: '12px',
	marginTop: '12px',
};

export const runFeedbackBannerStyle: CSSProperties = {
	marginBottom: '14px',
	padding: '16px 18px',
	borderRadius: '18px',
	display: 'grid',
	gap: '10px',
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
};

export const demoStanceBannerStyle: CSSProperties = {
	padding: '14px 16px',
	borderRadius: '14px',
	display: 'grid',
	gap: '10px',
};

export const runFeedbackHeaderStyle: CSSProperties = {
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'flex-start',
	gap: '10px',
	flexWrap: 'wrap',
};

export const runFeedbackCopyStyle: CSSProperties = {
	color: 'hsl(var(--color-text))',
	lineHeight: 1.5,
	maxWidth: 'min(720px, 100%)',
};

export const runFeedbackMetaStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
	flexWrap: 'wrap',
};

export const inspectionCorrelationMetaStyle: CSSProperties = {
	display: 'grid',
	gap: '4px',
	marginTop: '12px',
};

export const inspectionCorrelationChipStyle: CSSProperties = {
	...inspectionChipStyle,
	color: '#bfdbfe',
	border: '1px solid rgba(96, 165, 250, 0.26)',
	background: 'rgba(10, 16, 28, 0.84)',
};

export const secondarySurfaceStyle: CSSProperties = {
	borderRadius: 'var(--radius-soft)',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'rgba(6, 11, 21, 0.72)',
	padding: '16px 18px',
	display: 'grid',
	gap: '12px',
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
};

export const pillStyle: CSSProperties = {
	display: 'inline-flex',
	alignItems: 'center',
	gap: '8px',
	padding: '8px 12px',
	borderRadius: 'var(--radius-pill)',
	border: '1px solid rgba(245, 158, 11, 0.28)',
	background: 'rgba(36, 24, 8, 0.7)',
	color: '#fde68a',
	fontSize: '12px',
	fontWeight: 700,
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	maxWidth: '100%',
	overflowWrap: 'anywhere',
};

export const subcardStyle: CSSProperties = {
	borderRadius: '18px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'linear-gradient(180deg, rgba(8, 13, 24, 0.78) 0%, rgba(4, 9, 19, 0.72) 100%)',
	padding: '14px 16px',
	minWidth: 0,
	transition:
		'opacity 220ms ease, transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
};

export const emptyStateCardStyle: CSSProperties = {
	...subcardStyle,
	border: '1px dashed rgba(148, 163, 184, 0.26)',
	color: 'hsl(var(--color-text-soft))',
};
