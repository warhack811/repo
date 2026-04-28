import type { CSSProperties, ReactElement } from 'react';

import { appShellMutedTextStyle, appShellSecondaryLabelStyle } from '../app/AppShell.js';

type ProjectMemorySummaryProps = Readonly<{
	sourceCount?: number;
	status: 'available' | 'empty' | 'unavailable';
	summary?: string;
}>;

const panelStyle: CSSProperties = {
	display: 'grid',
	gap: '12px',
	padding: '14px 16px',
	borderRadius: '18px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'rgba(9, 14, 25, 0.68)',
};

function getStatusCopy(status: ProjectMemorySummaryProps['status']): {
	readonly body: string;
	readonly label: string;
} {
	switch (status) {
		case 'available':
			return {
				body: 'Bu calisma alani icin kayitli proje hafizasi hazir.',
				label: 'Hazir',
			};
		case 'empty':
			return {
				body: 'Bu calisma alanina henuz proje hafizasi eklenmedi.',
				label: 'Bos',
			};
		case 'unavailable':
			return {
				body: 'Bu alan hazir, fakat canli proje hafizasi kaynagi bu fazda henuz baglanmadi.',
				label: 'Bagli degil',
			};
	}
}

export function ProjectMemorySummary({
	sourceCount,
	status,
	summary,
}: ProjectMemorySummaryProps): ReactElement {
	const statusCopy = getStatusCopy(status);

	return (
		<section style={panelStyle} aria-labelledby="project-memory-heading">
			<div style={{ display: 'grid', gap: '8px' }}>
				<div style={appShellSecondaryLabelStyle}>Gizlilik ve hafiza</div>
				<h2 id="project-memory-heading" style={{ margin: 0, fontSize: '20px' }}>
					Proje hafizasi
				</h2>
				<p style={appShellMutedTextStyle}>{summary?.trim() || statusCopy.body}</p>
			</div>

			<div className="runa-inline-cluster">
				<span className="runa-pill">{statusCopy.label}</span>
				{typeof sourceCount === 'number' ? (
					<span className="runa-pill">{sourceCount} kaynak</span>
				) : null}
			</div>

			<div className="runa-alert runa-alert--info">
				Hafiza gorunurlugu burada yalniz bilgilendirme icin yer alir; gercek kaynak ve politika
				kontrolleri baglanana kadar veri uydurulmaz.
			</div>
		</section>
	);
}
