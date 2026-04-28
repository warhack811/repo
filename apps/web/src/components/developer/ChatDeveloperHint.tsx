import type { CSSProperties, ReactElement } from 'react';

const developerHintStyle: CSSProperties = {
	borderRadius: '18px',
	border: '1px solid rgba(245, 158, 11, 0.24)',
	background: 'rgba(38, 26, 8, 0.44)',
	padding: '14px 16px',
	display: 'grid',
	gap: '12px',
	transition: 'opacity 220ms ease, transform 220ms ease',
};

export function ChatDeveloperHint(): ReactElement {
	return (
		<section
			style={developerHintStyle}
			className="runa-card runa-card--subtle"
			aria-label="Developer Mode notice"
		>
			<div style={{ color: '#fde68a', fontWeight: 700 }}>Developer Mode kapalı</div>
			<div className="runa-subtle-copy">
				Ham timeline, geçmiş çalışmalar ve teknik izler ikinci katmanda tutulur. İhtiyaç olduğunda
				navigation içinden Developer Mode'u açabilirsin.
			</div>
		</section>
	);
}
