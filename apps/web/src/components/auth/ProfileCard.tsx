import type { CSSProperties, ReactElement } from 'react';

import type { AuthContext, AuthIdentity } from '@runa/types';
import { uiCopy } from '../../localization/copy.js';

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

const chipListStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: '8px',
};

const chipStyle: CSSProperties = {
	...pillStyle,
	padding: '6px 10px',
	borderColor: 'rgba(148, 163, 184, 0.24)',
	background: 'rgba(6, 11, 21, 0.78)',
	color: '#e2e8f0',
	fontSize: '11px',
	overflowWrap: 'anywhere',
	textTransform: 'none',
	letterSpacing: '0.03em',
};

function getProfileTitle(authContext: AuthContext): string {
	if (authContext.user?.display_name) {
		return authContext.user.display_name;
	}

	if (authContext.user?.email) {
		return authContext.user.email;
	}

	switch (authContext.principal.kind) {
		case 'authenticated':
			return authContext.principal.email ?? authContext.principal.user_id;
		case 'service':
			return authContext.principal.service_name;
		case 'anonymous':
			return 'Anonim kullanici';
	}
}

function getProfileSubtitle(authContext: AuthContext): string {
	if (authContext.user) {
		return authContext.user.user_id;
	}

	switch (authContext.principal.kind) {
		case 'authenticated':
			return authContext.principal.user_id;
		case 'service':
			return 'Servis kullanicisi';
		case 'anonymous':
			return 'Anonim tarayici baglami';
	}
}

function getProfileEmail(authContext: AuthContext): string {
	if (authContext.user?.email) {
		return authContext.user.email;
	}

	if (authContext.principal.kind === 'authenticated') {
		return authContext.principal.email ?? 'Bu oturum icin e-posta aciklanmadi';
	}

	return 'Bu oturum icin e-posta aciklanmadi';
}

function getIdentityLabel(identity: AuthIdentity): string {
	if (identity.identity_provider === 'oauth' && identity.oauth_provider) {
		return `${identity.identity_provider}:${identity.oauth_provider}`;
	}

	return identity.identity_provider;
}

function getProfileMethod(authContext: AuthContext): string {
	const provider = authContext.user?.primary_provider ?? authContext.principal.provider;

	if (provider === 'internal') {
		return 'Yerel giris';
	}

	return provider;
}

export function ProfileCard({ authContext }: Readonly<{ authContext: AuthContext }>): ReactElement {
	const identities = authContext.user?.identities ?? [];
	const emailVerified =
		authContext.user?.email_verified ?? authContext.claims?.email_verified ?? false;

	return (
		<article style={appShellPanelStyle} className="runa-card runa-ambient-panel">
			<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
				<div style={appShellSecondaryLabelStyle}>profil</div>
				<h3 style={{ margin: 0, fontSize: '22px' }}>{getProfileTitle(authContext)}</h3>
				<p style={appShellMutedTextStyle}>{uiCopy.account.description}</p>
			</div>

			<div style={detailGridStyle}>
				<div
					style={{
						...appShellMetricCardStyle,
						borderColor: 'rgba(245, 158, 11, 0.18)',
					}}
					className="runa-metric"
				>
					<div style={appShellSecondaryLabelStyle}>hesap ozeti</div>
					<div style={{ color: '#f8fafc', fontSize: '17px', fontWeight: 700 }}>
						{getProfileSubtitle(authContext)}
					</div>
					<div style={{ color: '#cbd5e1' }}>
						{authContext.principal.kind === 'authenticated'
							? 'Kimligi dogrulandi'
							: authContext.principal.kind === 'service'
								? 'Servis oturumu'
								: 'Anonim baglam'}
					</div>
				</div>
				<div
					style={{
						...appShellMetricCardStyle,
						borderColor: 'rgba(96, 165, 250, 0.18)',
					}}
					className="runa-metric"
				>
					<div style={appShellSecondaryLabelStyle}>e-posta</div>
					<div style={{ color: '#f8fafc', fontSize: '17px', fontWeight: 700 }}>
						{getProfileEmail(authContext)}
					</div>
					<div style={{ color: '#cbd5e1' }}>Dogrulandi: {emailVerified ? 'evet' : 'hayir'}</div>
				</div>
				<div
					style={{
						...appShellMetricCardStyle,
						borderColor: 'rgba(148, 163, 184, 0.18)',
					}}
					className="runa-metric"
				>
					<div style={appShellSecondaryLabelStyle}>giris yontemi</div>
					<div style={{ color: '#f8fafc', fontSize: '17px', fontWeight: 700 }}>
						{getProfileMethod(authContext)}
					</div>
					<div style={{ color: '#cbd5e1' }}>Durum: aktif</div>
				</div>
			</div>

			<div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
				<div style={appShellSecondaryLabelStyle}>bagli kimlikler</div>
				{identities.length > 0 ? (
					<div style={chipListStyle}>
						{identities.map((identity) => (
							<span key={identity.identity_id} style={chipStyle}>
								{getIdentityLabel(identity)}
							</span>
						))}
					</div>
				) : (
					<p style={appShellMutedTextStyle}>
						Mevcut auth baglaminda bagli kimlik listesi gosterilmedi.
					</p>
				)}
			</div>
		</article>
	);
}
