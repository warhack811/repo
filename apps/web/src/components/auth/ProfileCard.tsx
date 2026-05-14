import type { ReactElement } from 'react';

import type { AuthContext } from '@runa/types';
import { uiCopy } from '../../localization/copy.js';

function isPlaceholderEmail(email: string | null | undefined): boolean {
	return email?.trim().toLowerCase() === 'dev@runa.local';
}

function getProfileTitle(authContext: AuthContext): string {
	if (authContext.user?.display_name && !isPlaceholderEmail(authContext.user.display_name)) {
		return authContext.user.display_name;
	}

	if (authContext.user?.email && !isPlaceholderEmail(authContext.user.email)) {
		return authContext.user.email;
	}

	switch (authContext.principal.kind) {
		case 'authenticated':
			if (isPlaceholderEmail(authContext.principal.email)) {
				return 'Yerel oturum';
			}

			return authContext.principal.email ?? authContext.principal.user_id;
		case 'service':
			return authContext.principal.service_name;
		case 'anonymous':
			return 'Anonim kullanıcı';
	}
}

function getProfileEmail(authContext: AuthContext): string {
	if (authContext.user?.email && !isPlaceholderEmail(authContext.user.email)) {
		return authContext.user.email;
	}

	if (authContext.principal.kind === 'authenticated') {
		if (isPlaceholderEmail(authContext.principal.email)) {
			return 'Yerel oturum';
		}

		return authContext.principal.email ?? 'E-posta paylaşılmadı';
	}

	return 'E-posta paylaşılmadı';
}

function getProfileMethod(authContext: AuthContext): string {
	const provider = authContext.user?.primary_provider ?? authContext.principal.provider;

	if (provider === 'internal') {
		return 'Yerel giriş';
	}

	return provider;
}

function getSessionSummary(authContext: AuthContext): string {
	switch (authContext.principal.kind) {
		case 'authenticated':
			return 'Oturum açık';
		case 'service':
			return 'Servis oturumu';
		case 'anonymous':
			return 'Anonim oturum';
	}
}

export function ProfileCard({ authContext }: Readonly<{ authContext: AuthContext }>): ReactElement {
	const emailVerified =
		authContext.user?.email_verified ?? authContext.claims?.email_verified ?? false;

	return (
		<article className="runa-card runa-ambient-panel runa-auth-profilecard-1">
			<div className="runa-auth-profilecard-2">
				<div lang="tr" className="runa-auth-profilecard-3">
					profil
				</div>
				<h3 className="runa-auth-profilecard-4">{getProfileTitle(authContext)}</h3>
				<p className="runa-auth-profilecard-5">{uiCopy.account.description}</p>
			</div>

			<dl className="runa-auth-profilecard-6">
				<div className="runa-auth-profilecard-7">
					<dt lang="tr" className="runa-auth-profilecard-8">
						e-posta
					</dt>
					<dd className="runa-auth-profilecard-9">{getProfileEmail(authContext)}</dd>
					<div className="runa-auth-profilecard-10">
						{emailVerified ? 'E-posta doğrulandı' : 'E-posta henüz doğrulanmadı'}
					</div>
				</div>
				<div className="runa-auth-profilecard-11">
					<dt lang="tr" className="runa-auth-profilecard-12">
						oturum
					</dt>
					<dd className="runa-auth-profilecard-13">{getSessionSummary(authContext)}</dd>
					<div className="runa-auth-profilecard-14">{getProfileMethod(authContext)}</div>
				</div>
			</dl>
		</article>
	);
}
