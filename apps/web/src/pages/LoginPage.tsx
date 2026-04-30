import type { FormEvent, ReactElement } from 'react';
import { useEffect, useState } from 'react';

import type { AuthContext, OAuthProvider } from '@runa/types';

import runaLogo from '../assets/runa-logo.svg';
import { OAuthButtons } from '../components/auth/OAuthButtons.js';
import { RunaSpinner } from '../components/ui/RunaSpinner.js';
import { uiCopy } from '../localization/copy.js';
import '../styles/routes/login-migration.css';

type AuthMode = 'login' | 'signup';

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

function getSubmitCopy(mode: AuthMode, isPending: boolean): string {
	if (mode === 'signup') {
		return isPending ? uiCopy.auth.signupPending : uiCopy.auth.signupAction;
	}

	return isPending ? uiCopy.auth.loginPending : uiCopy.auth.loginAction;
}

export function LoginPage({
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
	const [authMode, setAuthMode] = useState<AuthMode>('login');
	const [emailInput, setEmailInput] = useState('');
	const [passwordInput, setPasswordInput] = useState('');
	const [tokenInput, setTokenInput] = useState('');

	useEffect(() => {
		if (!hasStoredBearerToken) {
			setTokenInput('');
		}
	}, [hasStoredBearerToken]);

	function handleCredentialSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		const input = { email: emailInput, password: passwordInput };
		void (authMode === 'signup' ? onSignupWithPassword(input) : onLoginWithPassword(input));
	}

	function handleTokenSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		void onAuthenticateWithToken(tokenInput);
	}

	const isSignup = authMode === 'signup';
	const showAuthStatus = isAuthPending || authStatus === 'bootstrapping';

	return (
		<div className="runa-page runa-login-page">
			<main className="runa-login-shell" aria-busy={isAuthPending}>
				<section className="runa-login-hero" aria-labelledby="login-heading">
					<img className="runa-login-logo" src={runaLogo} alt="Runa" width="180" height="48" />
					<div className="runa-login-copy">
						<h1 id="login-heading">{uiCopy.auth.title}</h1>
						<p>{uiCopy.auth.subtitle}</p>
					</div>
					{showAuthStatus ? (
						<div className="runa-login-status" aria-live="polite">
							{isAuthPending ? <RunaSpinner label={uiCopy.auth.connecting} size="sm" /> : null}
							<span>{uiCopy.auth.connecting}</span>
						</div>
					) : null}
				</section>

				<section className="runa-login-panel" aria-labelledby="login-form-heading">
					<div className="runa-login-panel__header">
						<h2 id="login-form-heading">
							{isSignup ? uiCopy.auth.signupDescription : uiCopy.auth.loginDescription}
						</h2>
						<div className="runa-login-mode" role="tablist" aria-label={uiCopy.auth.modeLabel}>
							<button
								type="button"
								role="tab"
								aria-selected={!isSignup}
								className={!isSignup ? 'is-active' : undefined}
								onClick={() => setAuthMode('login')}
							>
								{uiCopy.auth.login}
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={isSignup}
								className={isSignup ? 'is-active' : undefined}
								onClick={() => setAuthMode('signup')}
							>
								{uiCopy.auth.signup}
							</button>
						</div>
					</div>

					{authNotice ? (
						<output aria-live="polite" className="runa-alert runa-alert--info">
							{authNotice}
						</output>
					) : null}
					{authError ? (
						<div role="alert" className="runa-alert runa-alert--danger">
							{authError}
						</div>
					) : null}

					<form className="runa-login-form" onSubmit={handleCredentialSubmit}>
						<label>
							<span>{uiCopy.auth.email}</span>
							<input
								value={emailInput}
								onChange={(event) => setEmailInput(event.target.value)}
								placeholder="name@company.com"
								type="email"
								autoComplete={isSignup ? 'username' : 'email'}
								className="runa-input"
							/>
						</label>
						<label>
							<span>{uiCopy.auth.password}</span>
							<input
								value={passwordInput}
								onChange={(event) => setPasswordInput(event.target.value)}
								placeholder={
									isSignup
										? uiCopy.auth.passwordPlaceholderSignup
										: uiCopy.auth.passwordPlaceholderLogin
								}
								type="password"
								autoComplete={isSignup ? 'new-password' : 'current-password'}
								className="runa-input"
							/>
						</label>
						<button
							type="submit"
							disabled={isAuthPending}
							className="runa-button runa-button--primary"
						>
							{getSubmitCopy(authMode, isAuthPending)}
						</button>
					</form>

					<div className="runa-login-oauth">
						<span>veya</span>
						<OAuthButtons isDisabled={isAuthPending} onStartOAuth={onStartOAuth} />
					</div>

					{import.meta.env.DEV ? (
						<details className="runa-developer-details runa-login-dev">
							<summary>Diğer giriş yöntemleri</summary>
							<div className="runa-developer-details__content">
								<div className="runa-login-dev__actions">
									<button
										type="button"
										onClick={onStartLocalDevSession}
										disabled={isAuthPending}
										className="runa-button runa-button--secondary"
									>
										{uiCopy.auth.devSession}
									</button>
									<button
										type="button"
										onClick={() => void onRefreshAuthContext()}
										disabled={isAuthPending}
										className="runa-button runa-button--secondary"
									>
										{uiCopy.auth.refreshAuthContext}
									</button>
									<button
										type="button"
										onClick={() => void onClearAuthToken()}
										disabled={isAuthPending || !hasStoredBearerToken}
										className="runa-button runa-button--secondary"
									>
										{uiCopy.auth.clearStoredToken}
									</button>
								</div>
								<form className="runa-login-token" onSubmit={handleTokenSubmit}>
									<label>
										<span>{uiCopy.auth.token}</span>
										<input
											value={tokenInput}
											onChange={(event) => setTokenInput(event.target.value)}
											placeholder={uiCopy.auth.tokenPlaceholder}
											type="password"
											className="runa-input"
										/>
									</label>
									<button
										type="submit"
										disabled={isAuthPending}
										className="runa-button runa-button--secondary"
									>
										{isAuthPending ? uiCopy.auth.tokenPending : uiCopy.auth.tokenAction}
									</button>
								</form>
							</div>
						</details>
					) : null}
				</section>
			</main>
		</div>
	);
}
