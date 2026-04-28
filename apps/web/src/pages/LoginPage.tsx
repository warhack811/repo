import type { CSSProperties, FormEvent, ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { AuthContext, OAuthProvider } from '@runa/types';

import { AuthModeTabs, type LoginPageMode } from '../components/auth/AuthModeTabs.js';
import { OAuthButtons } from '../components/auth/OAuthButtons.js';
import {
	buttonStyle,
	heroPanelStyle,
	pageStyle,
	panelStyle,
	pillStyle,
	secondaryLabelStyle,
	inputStyle as sharedInputStyle,
	secondaryButtonStyle as sharedSecondaryButtonStyle,
	subcardStyle,
} from '../lib/chat-styles.js';
import { uiCopy } from '../localization/copy.js';

type LoginPageProps = Readonly<{
	authContext: AuthContext | null;
	authError: string | null;
	authNotice: string | null;
	authStatus: 'anonymous' | 'bootstrapping';
	hasStoredBearerToken: boolean;
	isAuthPending: boolean;
	onAuthenticateWithToken: (token: string) => Promise<void>;
	onClearAuthToken: () => Promise<void>;
	onLoginWithPassword: (input: { email: string; password: string }) => Promise<void>;
	onStartLocalDevSession: () => void;
	onRefreshAuthContext: () => Promise<void>;
	onSignupWithPassword: (input: { email: string; password: string }) => Promise<void>;
	onStartOAuth: (provider: Extract<OAuthProvider, 'github' | 'google'>) => void;
}>;

const shellStyle: CSSProperties = {
	display: 'grid',
	gap: '20px',
	minWidth: 0,
};

const sectionGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
	gap: '20px',
	alignItems: 'start',
};

const actionGridStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))',
};

const developerDetailsStyle: CSSProperties = {
	...subcardStyle,
	marginTop: '16px',
};

const statusMessageStyle: CSSProperties = {
	marginTop: '16px',
	padding: '12px 14px',
	borderRadius: '14px',
	lineHeight: 1.5,
};

function getStatusLabel(status: LoginPageProps['authStatus']): string {
	return status === 'bootstrapping' ? uiCopy.auth.statusBootstrapping : uiCopy.auth.statusAnonymous;
}

function getStatusAccent(status: LoginPageProps['authStatus']): string {
	return status === 'bootstrapping' ? '#38bdf8' : '#f59e0b';
}

export function LoginPage({
	authContext,
	authError,
	authNotice,
	authStatus,
	hasStoredBearerToken,
	isAuthPending,
	onAuthenticateWithToken,
	onClearAuthToken,
	onLoginWithPassword,
	onStartLocalDevSession,
	onRefreshAuthContext,
	onSignupWithPassword,
	onStartOAuth,
}: LoginPageProps): ReactElement {
	const [authMode, setAuthMode] = useState<LoginPageMode>('login');
	const [emailInput, setEmailInput] = useState('');
	const [passwordInput, setPasswordInput] = useState('');
	const [tokenInput, setTokenInput] = useState('');

	useEffect(() => {
		if (!hasStoredBearerToken) {
			setTokenInput('');
		}
	}, [hasStoredBearerToken]);

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();

		switch (authMode) {
			case 'login':
				void onLoginWithPassword({
					email: emailInput,
					password: passwordInput,
				});
				return;
			case 'signup':
				void onSignupWithPassword({
					email: emailInput,
					password: passwordInput,
				});
				return;
			case 'token':
				void onAuthenticateWithToken(tokenInput);
				return;
		}
	}

	const authCardTitle =
		authMode === 'login'
			? uiCopy.auth.loginDescription
			: authMode === 'signup'
				? uiCopy.auth.signupDescription
				: uiCopy.auth.tokenDescription;
	const authCardLabel =
		authMode === 'login'
			? uiCopy.auth.login
			: authMode === 'signup'
				? uiCopy.auth.signup
				: uiCopy.auth.token;
	const authCardDescription =
		authMode === 'login'
			? uiCopy.auth.loginDescription
			: authMode === 'signup'
				? uiCopy.auth.signupVerificationNote
				: uiCopy.auth.tokenFallbackNote;
	const submitLabel =
		authMode === 'login'
			? uiCopy.auth.loginAction
			: authMode === 'signup'
				? uiCopy.auth.signupAction
				: uiCopy.auth.tokenAction;
	const pendingLabel =
		authMode === 'login'
			? uiCopy.auth.loginPending
			: authMode === 'signup'
				? uiCopy.auth.signupPending
				: uiCopy.auth.tokenPending;
	const shouldRenderCredentialFields = authMode === 'login' || authMode === 'signup';

	function handleTokenSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		void onAuthenticateWithToken(tokenInput);
	}

	useEffect(() => {
		if (!shouldRenderCredentialFields) {
			setEmailInput('');
			setPasswordInput('');
		}
	}, [shouldRenderCredentialFields]);

	return (
		<div className="runa-page" style={pageStyle}>
			<main
				className="runa-shell-frame runa-shell-frame--chat"
				style={shellStyle}
				aria-busy={isAuthPending}
			>
				<header
					style={{
						...heroPanelStyle,
						background:
							'radial-gradient(circle at top right, rgba(245, 158, 11, 0.18), transparent 32%), linear-gradient(180deg, rgba(20, 26, 40, 0.94) 0%, rgba(15, 23, 42, 0.84) 100%)',
					}}
					className="runa-card runa-card--hero runa-ambient-panel"
				>
					<div
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'flex-start',
							gap: '16px',
							flexWrap: 'wrap',
						}}
					>
						<div style={{ display: 'grid', gap: '10px', maxWidth: 'min(720px, 100%)' }}>
							<div className="runa-eyebrow">RUNA</div>
							<h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 38px)' }}>{uiCopy.auth.title}</h1>
							<p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.6 }}>{uiCopy.auth.subtitle}</p>
						</div>
						<div
							aria-live="polite"
							style={{
								...pillStyle,
								borderColor: getStatusAccent(authStatus),
								color: getStatusAccent(authStatus),
							}}
						>
							{getStatusLabel(authStatus)}
						</div>
					</div>
				</header>

				<section style={sectionGridStyle}>
					<article
						style={{
							...panelStyle,
							background:
								'radial-gradient(circle at top left, rgba(96, 165, 250, 0.08), transparent 28%), linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(10, 16, 28, 0.76) 100%)',
						}}
						aria-labelledby="login-bootstrap-heading"
						className="runa-card runa-ambient-panel"
					>
						<div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
							<div style={secondaryLabelStyle}>{uiCopy.auth.statusBootstrapping}</div>
							<h2 id="login-bootstrap-heading" style={{ margin: 0, fontSize: '22px' }}>
								Calisma alanin hazirlaniyor
							</h2>
							<div style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
								Runa tarayicidaki oturumunu kontrol eder ve hazir oldugunda seni dogrudan sohbet
								alanina alir. Teknik giris yollari burada kalabalik yaratmadan ikinci katmanda
								durur.
							</div>
						</div>

						<div className="runa-card runa-card--subtle runa-card--soft-grid" style={subcardStyle}>
							<div>
								<div style={secondaryLabelStyle}>giris durumu</div>
								<div style={{ marginTop: '6px', fontSize: '16px', color: '#f8fafc' }}>
									{authContext ? 'Oturum bulundu' : 'Giris bekleniyor'}
								</div>
							</div>
							<div>
								<div style={secondaryLabelStyle}>calisma alani</div>
								<div style={{ marginTop: '6px', color: '#cbd5e1' }}>
									{authContext ? 'Acilmaya hazir' : 'Oturum dogrulaninca acilir'}
								</div>
							</div>
							<div>
								<div style={secondaryLabelStyle}>bu tarayici</div>
								<div style={{ marginTop: '6px', color: '#cbd5e1' }}>
									{hasStoredBearerToken ? 'Kayitli oturum var' : 'Kayitli oturum yok'}
								</div>
							</div>
						</div>

						{authNotice ? (
							<output
								aria-live="polite"
								style={{
									...statusMessageStyle,
									...subcardStyle,
									marginTop: '16px',
								}}
								className="runa-alert runa-alert--info"
							>
								{authNotice}
							</output>
						) : null}

						{authError ? (
							<div
								role="alert"
								style={{
									...statusMessageStyle,
									...subcardStyle,
									marginTop: '16px',
								}}
								className="runa-alert runa-alert--danger"
							>
								{authError}
							</div>
						) : null}

						{import.meta.env.DEV ? (
							<details className="runa-developer-details" style={developerDetailsStyle}>
								<summary>Gelistirici girisi</summary>
								<div className="runa-developer-details__content">
									<p className="runa-subtle-copy">
										Yerel gelistirme ve mevcut oturum dogrulama yollari burada durur; normal
										kullanici girisi yukaridaki e-posta ve OAuth akisiyle devam eder.
									</p>
									<div style={actionGridStyle}>
										<button
											type="button"
											onClick={onStartLocalDevSession}
											disabled={isAuthPending}
											style={{
												...sharedSecondaryButtonStyle,
												opacity: isAuthPending ? 0.6 : 1,
											}}
											className="runa-button runa-button--secondary"
										>
											{uiCopy.auth.devSession}
										</button>
										<button
											type="button"
											onClick={() => void onRefreshAuthContext()}
											disabled={isAuthPending}
											style={{
												...sharedSecondaryButtonStyle,
												opacity: isAuthPending ? 0.6 : 1,
											}}
											className="runa-button runa-button--secondary"
										>
											{uiCopy.auth.refreshAuthContext}
										</button>
										<button
											type="button"
											onClick={() => void onClearAuthToken()}
											disabled={isAuthPending || !hasStoredBearerToken}
											style={{
												...sharedSecondaryButtonStyle,
												opacity: isAuthPending || !hasStoredBearerToken ? 0.6 : 1,
											}}
											className="runa-button runa-button--secondary"
										>
											{uiCopy.auth.clearStoredToken}
										</button>
									</div>
									<form
										onSubmit={handleTokenSubmit}
										style={{ display: 'grid', gap: '10px', marginTop: '14px' }}
									>
										<label style={{ display: 'grid', gap: '8px' }}>
											<span>{uiCopy.auth.token}</span>
											<input
												value={tokenInput}
												onChange={(event) => setTokenInput(event.target.value)}
												placeholder={uiCopy.auth.tokenPlaceholder}
												type="password"
												style={sharedInputStyle}
												className="runa-input"
											/>
										</label>
										<button
											type="submit"
											disabled={isAuthPending}
											style={{
												...sharedSecondaryButtonStyle,
												opacity: isAuthPending ? 0.6 : 1,
											}}
											className="runa-button runa-button--secondary"
										>
											{isAuthPending ? uiCopy.auth.tokenPending : uiCopy.auth.tokenAction}
										</button>
									</form>
								</div>
							</details>
						) : null}
					</article>

					<article
						style={{
							...panelStyle,
							background:
								'radial-gradient(circle at bottom right, rgba(245, 158, 11, 0.1), transparent 28%), linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(10, 16, 28, 0.76) 100%)',
						}}
						aria-labelledby="login-auth-form-heading"
						aria-describedby="login-auth-form-description"
						className="runa-card runa-ambient-panel"
					>
						<div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
							<div style={secondaryLabelStyle}>{authCardLabel}</div>
							<h2 id="login-auth-form-heading" style={{ margin: 0, fontSize: '22px' }}>
								{authCardTitle}
							</h2>
							<div id="login-auth-form-description" style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
								{authCardDescription}
							</div>
						</div>

						<div style={{ marginBottom: '16px' }}>
							<AuthModeTabs
								activeMode={authMode}
								onSelectMode={setAuthMode}
								panelIdBase="login-auth-mode"
								showTokenMode={false}
							/>
						</div>

						<form
							onSubmit={handleSubmit}
							style={{ display: 'grid', gap: '14px' }}
							aria-busy={isAuthPending}
						>
							<div
								id={`login-auth-mode-panel-${authMode}`}
								role="tabpanel"
								aria-labelledby={`login-auth-mode-tab-${authMode}`}
								style={{ display: 'grid', gap: '14px' }}
							>
								{shouldRenderCredentialFields ? (
									<>
										<label style={{ display: 'grid', gap: '8px' }}>
											<span>{uiCopy.auth.email}</span>
											<input
												value={emailInput}
												onChange={(event) => setEmailInput(event.target.value)}
												placeholder="name@company.com"
												type="email"
												autoComplete={authMode === 'login' ? 'email' : 'username'}
												style={sharedInputStyle}
												className="runa-input"
											/>
										</label>

										<label style={{ display: 'grid', gap: '8px' }}>
											<span>{uiCopy.auth.password}</span>
											<input
												value={passwordInput}
												onChange={(event) => setPasswordInput(event.target.value)}
												placeholder={
													authMode === 'signup'
														? uiCopy.auth.passwordPlaceholderSignup
														: uiCopy.auth.passwordPlaceholderLogin
												}
												type="password"
												autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
												style={sharedInputStyle}
												className="runa-input"
											/>
										</label>
									</>
								) : (
									<label style={{ display: 'grid', gap: '8px' }}>
										<span>{uiCopy.auth.token}</span>
										<input
											value={tokenInput}
											onChange={(event) => setTokenInput(event.target.value)}
											placeholder={uiCopy.auth.tokenPlaceholder}
											type="password"
											style={sharedInputStyle}
											className="runa-input"
										/>
									</label>
								)}
							</div>

							<div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6 }}>
								{authMode === 'signup'
									? uiCopy.auth.signupVerificationNote
									: authMode === 'login'
										? uiCopy.auth.authenticatedShellNotice
										: uiCopy.auth.tokenFallbackNote}
							</div>

							<div style={actionGridStyle}>
								<button
									type="submit"
									disabled={isAuthPending}
									style={{
										...buttonStyle,
										opacity: isAuthPending ? 0.6 : 1,
										width: '100%',
									}}
									className="runa-button runa-button--primary"
								>
									{isAuthPending ? pendingLabel : submitLabel}
								</button>
							</div>
						</form>

						<div
							style={{
								marginTop: '20px',
								paddingTop: '18px',
								borderTop: '1px solid rgba(148, 163, 184, 0.12)',
								display: 'grid',
								gap: '12px',
							}}
						>
							<div style={secondaryLabelStyle}>oauth</div>
							<OAuthButtons isDisabled={isAuthPending} onStartOAuth={onStartOAuth} />
						</div>
					</article>
				</section>
			</main>
		</div>
	);
}
