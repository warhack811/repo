import type { ReactElement } from 'react';

import type { AuthContext } from '@runa/types';

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
		<article className="runa-card runa-auth-sessioncard-1">
			<div className="runa-auth-sessioncard-2">
				<div lang="tr" className="runa-auth-sessioncard-3">
					oturum
				</div>
				<h3 className="runa-auth-sessioncard-4">Oturum durumu</h3>
				<p className="runa-auth-sessioncard-5">
					Temel oturum bilgilerini sade bir özetle görebilirsin.
				</p>
			</div>

			<div className="runa-auth-sessioncard-6">
				<span className="runa-auth-sessioncard-7">
					{authContext.principal.kind === 'authenticated' ||
					authContext.principal.kind === 'service'
						? 'açık'
						: 'sınırlı'}
				</span>
			</div>

			<div className="runa-auth-sessioncard-9">
				<div className="runa-metric runa-auth-sessioncard-10">
					<div lang="tr" className="runa-auth-sessioncard-11">
						durum
					</div>
					<div className="runa-auth-sessioncard-12">
						{authContext.principal.kind === 'authenticated' ||
						authContext.principal.kind === 'service'
							? 'Açık'
							: 'Sınırlı'}
					</div>
					<div className="runa-auth-sessioncard-13">
						{authContext.principal.kind === 'authenticated'
							? 'Kimliği doğrulanmış oturum'
							: authContext.principal.kind === 'service'
								? 'Servis oturumu'
								: 'Anonim bağlam'}
					</div>
				</div>
				<div className="runa-metric runa-auth-sessioncard-14">
					<div lang="tr" className="runa-auth-sessioncard-15">
						giriş
					</div>
					<div className="runa-auth-sessioncard-16">
						{authContext.user?.email ?? authContext.principal.kind}
					</div>
					<div className="runa-auth-sessioncard-17">
						{(authContext.user?.email_verified ?? authContext.claims?.email_verified)
							? 'E-posta doğrulandı'
							: 'E-posta doğrulaması açıklanmadı'}
					</div>
				</div>
				<div className="runa-metric runa-auth-sessioncard-18">
					<div lang="tr" className="runa-auth-sessioncard-19">
						başladı
					</div>
					<div className="runa-auth-sessioncard-20">{issuedAt}</div>
					<div className="runa-auth-sessioncard-21">Oturum açılış zamanı</div>
				</div>
				<div className="runa-metric runa-auth-sessioncard-22">
					<div lang="tr" className="runa-auth-sessioncard-23">
						sona erer
					</div>
					<div className="runa-auth-sessioncard-24">{expiresAt}</div>
					<div className="runa-auth-sessioncard-25">Şu anki oturum süresi</div>
				</div>
			</div>
		</article>
	);
}
