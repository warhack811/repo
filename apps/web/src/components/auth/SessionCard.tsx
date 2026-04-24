import type { CSSProperties, ReactElement } from 'react';

import type { AuthContext } from '@runa/types';

import { pillStyle } from '../../lib/chat-styles.js';
import {
	appShellMetricCardStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryLabelStyle,
} from '../app/AppShell.js';

const detailGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
	gap: '12px',
};

function formatTimestamp(value: number | string | undefined): string {
	if (typeof value === 'number') {
		return new Date(value * 1000).toISOString();
	}

	return value ?? 'mevcut değil';
}

export function SessionCard({
	authContext,
}: Readonly<{
	authContext: AuthContext;
}>): ReactElement {
	const issuedAt = formatTimestamp(authContext.session?.issued_at ?? authContext.claims?.iat);
	const expiresAt = formatTimestamp(authContext.session?.expires_at ?? authContext.claims?.exp);

	return (
		<article style={appShellPanelStyle} className="runa-card">
			<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
				<div lang="tr" style={appShellSecondaryLabelStyle}>
					oturum
				</div>
				<h3 style={{ margin: 0, fontSize: '22px' }}>Oturum durumu</h3>
				<p style={appShellMutedTextStyle}>
					Bu alan yalnız temel oturum bilgisini gösterir. Teknik metadata ve troubleshooting
					ayrıntıları Developer Mode içinde kalır.
				</p>
			</div>

			<div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
				<span style={pillStyle}>
					{authContext.principal.kind === 'authenticated' ||
					authContext.principal.kind === 'service'
						? 'active'
						: 'limited'}
				</span>
				<span style={{ ...pillStyle, borderColor: 'rgba(96, 165, 250, 0.26)', color: '#bfdbfe' }}>
					{authContext.transport}
				</span>
			</div>

			<div style={detailGridStyle}>
				<div
					style={{
						...appShellMetricCardStyle,
						borderColor: 'rgba(245, 158, 11, 0.18)',
					}}
					className="runa-metric"
				>
					<div lang="tr" style={appShellSecondaryLabelStyle}>
						durum
					</div>
					<div style={{ color: '#f8fafc', fontSize: '17px', fontWeight: 700 }}>
						{authContext.principal.kind === 'authenticated' ||
						authContext.principal.kind === 'service'
							? 'Açık'
							: 'Sınırlı'}
					</div>
					<div style={{ color: '#cbd5e1' }}>
						{authContext.principal.kind === 'authenticated'
							? 'Kimliği doğrulanmış oturum'
							: authContext.principal.kind === 'service'
								? 'Servis oturumu'
								: 'Anonim bağlam'}
					</div>
				</div>
				<div
					style={{
						...appShellMetricCardStyle,
						borderColor: 'rgba(96, 165, 250, 0.18)',
					}}
					className="runa-metric"
				>
					<div lang="tr" style={appShellSecondaryLabelStyle}>
						giriş
					</div>
					<div style={{ color: '#f8fafc', fontSize: '17px', fontWeight: 700 }}>
						{authContext.user?.email ?? authContext.principal.kind}
					</div>
					<div style={{ color: '#cbd5e1' }}>
						{(authContext.user?.email_verified ?? authContext.claims?.email_verified)
							? 'E-posta doğrulandı'
							: 'E-posta doğrulaması açıklanmadı'}
					</div>
				</div>
				<div
					style={{
						...appShellMetricCardStyle,
						borderColor: 'rgba(148, 163, 184, 0.18)',
					}}
					className="runa-metric"
				>
					<div lang="tr" style={appShellSecondaryLabelStyle}>
						başladı
					</div>
					<div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 700 }}>{issuedAt}</div>
					<div style={{ color: '#cbd5e1' }}>Oturum açılış zamanı</div>
				</div>
				<div
					style={{
						...appShellMetricCardStyle,
						borderColor: 'rgba(148, 163, 184, 0.18)',
					}}
					className="runa-metric"
				>
					<div lang="tr" style={appShellSecondaryLabelStyle}>
						sona erer
					</div>
					<div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 700 }}>{expiresAt}</div>
					<div style={{ color: '#cbd5e1' }}>Şu anki oturum süresi</div>
				</div>
			</div>
		</article>
	);
}
