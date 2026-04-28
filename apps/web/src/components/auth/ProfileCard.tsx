import type { ReactElement } from 'react';

import type { AuthContext, AuthIdentity } from '@runa/types';
import { uiCopy } from '../../localization/copy.js';

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
			return 'Anonim kullanıcı';
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
			return 'Servis kullanıcısı';
		case 'anonymous':
			return 'Anonim tarayıcı bağlamı';
	}
}

function getProfileEmail(authContext: AuthContext): string {
	if (authContext.user?.email) {
		return authContext.user.email;
	}

	if (authContext.principal.kind === 'authenticated') {
		return authContext.principal.email ?? 'Bu oturum için e-posta açıklanmadı';
	}

	return 'Bu oturum için e-posta açıklanmadı';
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
		return 'Yerel giriş';
	}

	return provider;
}

export function ProfileCard({ authContext }: Readonly<{ authContext: AuthContext }>): ReactElement {
	const identities = authContext.user?.identities ?? [];
	const emailVerified =
		authContext.user?.email_verified ?? authContext.claims?.email_verified ?? false;

	return (
		<article className="runa-card runa-ambient-panel runa-migrated-components-auth-profilecard-1">
			<div className="runa-migrated-components-auth-profilecard-2">
				<div lang="tr" className="runa-migrated-components-auth-profilecard-3">
					profil
				</div>
				<h3 className="runa-migrated-components-auth-profilecard-4">
					{getProfileTitle(authContext)}
				</h3>
				<p className="runa-migrated-components-auth-profilecard-5">{uiCopy.account.description}</p>
			</div>

			<div className="runa-migrated-components-auth-profilecard-6">
				<div className="runa-metric runa-migrated-components-auth-profilecard-7">
					<div lang="tr" className="runa-migrated-components-auth-profilecard-8">
						hesap özeti
					</div>
					<div className="runa-migrated-components-auth-profilecard-9">
						{getProfileSubtitle(authContext)}
					</div>
					<div className="runa-migrated-components-auth-profilecard-10">
						{authContext.principal.kind === 'authenticated'
							? 'Kimliği doğrulandı'
							: authContext.principal.kind === 'service'
								? 'Servis oturumu'
								: 'Anonim bağlam'}
					</div>
				</div>
				<div className="runa-metric runa-migrated-components-auth-profilecard-11">
					<div lang="tr" className="runa-migrated-components-auth-profilecard-12">
						e-posta
					</div>
					<div className="runa-migrated-components-auth-profilecard-13">
						{getProfileEmail(authContext)}
					</div>
					<div className="runa-migrated-components-auth-profilecard-14">
						Doğrulandı: {emailVerified ? 'evet' : 'hayır'}
					</div>
				</div>
				<div className="runa-metric runa-migrated-components-auth-profilecard-15">
					<div lang="tr" className="runa-migrated-components-auth-profilecard-16">
						giriş yöntemi
					</div>
					<div className="runa-migrated-components-auth-profilecard-17">
						{getProfileMethod(authContext)}
					</div>
					<div className="runa-migrated-components-auth-profilecard-18">Durum: aktif</div>
				</div>
			</div>

			<div className="runa-migrated-components-auth-profilecard-19">
				<div lang="tr" className="runa-migrated-components-auth-profilecard-20">
					bağlı kimlikler
				</div>
				{identities.length > 0 ? (
					<div className="runa-migrated-components-auth-profilecard-21">
						{identities.map((identity) => (
							<span
								key={identity.identity_id}
								className="runa-migrated-components-auth-profilecard-22"
							>
								{getIdentityLabel(identity)}
							</span>
						))}
					</div>
				) : (
					<p className="runa-migrated-components-auth-profilecard-23">
						Mevcut auth bağlamında bağlı kimlik listesi gösterilmedi.
					</p>
				)}
			</div>
		</article>
	);
}
