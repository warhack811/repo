import { type CSSProperties, type ReactElement, useEffect, useEffectEvent, useState } from 'react';

import type { AuthContext, DesktopDevicePresenceSnapshot } from '@runa/types';

import {
	appShellButtonRowStyle,
	appShellMutedTextStyle,
	appShellPanelStyle,
	appShellSecondaryButtonStyle,
	appShellSecondaryLabelStyle,
} from '../components/app/AppShell.js';
import { ProfileCard } from '../components/auth/ProfileCard.js';
import { SessionCard } from '../components/auth/SessionCard.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useVoiceInput } from '../hooks/useVoiceInput.js';
import { readStoredBearerToken } from '../lib/auth-client.js';
import { pillStyle } from '../lib/chat-styles.js';
import {
	DesktopDevicesResponseValidationError,
	fetchDesktopDevices,
} from '../lib/desktop-devices.js';
import { uiCopy } from '../localization/copy.js';

const sectionGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
	gap: '20px',
};

const heroMetricRowStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: '10px',
	marginTop: '16px',
};

const destructiveButtonStyle: CSSProperties = {
	...appShellSecondaryButtonStyle,
	border: '1px solid rgba(248, 113, 113, 0.36)',
	color: '#fecaca',
};

const deviceCardStyle: CSSProperties = {
	display: 'grid',
	gap: '10px',
	padding: '14px 16px',
	borderRadius: '18px',
	border: '1px solid rgba(148, 163, 184, 0.16)',
	background: 'rgba(9, 14, 25, 0.68)',
};

type DesktopDevicesState =
	| {
			readonly status: 'idle' | 'loading';
	  }
	| {
			readonly devices: readonly DesktopDevicePresenceSnapshot[];
			readonly status: 'success';
	  }
	| {
			readonly message: string;
			readonly status: 'error';
	  };

type SettingsPageProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	isAuthPending: boolean;
	onLogout: () => Promise<void>;
}>;

export function SettingsPage({
	authContext,
	authError,
	isAuthPending,
	onLogout,
}: SettingsPageProps): ReactElement {
	const [desktopDevicesState, setDesktopDevicesState] = useState<DesktopDevicesState>({
		status: 'idle',
	});
	const {
		autoReadEnabled,
		cancel: cancelTextToSpeech,
		errorMessage: textToSpeechErrorMessage,
		isSpeaking,
		isSupported: isTextToSpeechSupported,
		setAutoReadEnabled,
	} = useTextToSpeech();
	const voiceInput = useVoiceInput();
	const loadDesktopDevices = useEffectEvent(async (signal: AbortSignal) => {
		if (authContext.principal.kind !== 'authenticated') {
			setDesktopDevicesState({
				status: 'success',
				devices: [],
			});
			return;
		}

		setDesktopDevicesState({
			status: 'loading',
		});

		try {
			const response = await fetchDesktopDevices({
				bearerToken: readStoredBearerToken() ?? undefined,
				signal,
			});

			if (signal.aborted) {
				return;
			}

			setDesktopDevicesState({
				devices: response.devices,
				status: 'success',
			});
		} catch (error) {
			if (signal.aborted) {
				return;
			}

			if (error instanceof DesktopDevicesResponseValidationError) {
				setDesktopDevicesState({
					message:
						'Online cihaz listesi beklendigi sekilde donmedi. Lutfen daha sonra yeniden dene.',
					status: 'error',
				});
				return;
			}

			setDesktopDevicesState({
				message:
					error instanceof Error
						? error.message
						: 'Online cihazlar su anda yuklenemedi. Lutfen daha sonra yeniden dene.',
				status: 'error',
			});
		}
	});

	useEffect(() => {
		const abortController = new AbortController();
		void loadDesktopDevices(abortController.signal);

		return () => {
			abortController.abort();
		};
	}, [loadDesktopDevices]);

	function formatConnectedAt(connectedAt: string): string {
		const parsed = new Date(connectedAt);

		if (Number.isNaN(parsed.getTime())) {
			return connectedAt;
		}

		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(parsed);
	}

	return (
		<>
			<section
				style={{
					...appShellPanelStyle,
					background:
						'radial-gradient(circle at top right, rgba(245, 158, 11, 0.14), transparent 30%), linear-gradient(180deg, rgba(20, 26, 40, 0.92) 0%, rgba(15, 23, 42, 0.8) 100%)',
				}}
				aria-labelledby="account-heading"
				className="runa-card runa-card--hero runa-ambient-panel"
			>
				<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
					<div style={appShellSecondaryLabelStyle}>{uiCopy.account.heading}</div>
					<h2 id="account-heading" style={{ margin: 0, fontSize: '24px' }}>
						{uiCopy.account.heading}
					</h2>
					<p style={appShellMutedTextStyle}>{uiCopy.account.description}</p>
				</div>

				<div style={heroMetricRowStyle}>
					<span style={pillStyle}>{authContext.principal.kind}</span>
					<span style={{ ...pillStyle, borderColor: 'rgba(96, 165, 250, 0.26)', color: '#bfdbfe' }}>
						{authContext.transport}
					</span>
				</div>

				<div style={appShellButtonRowStyle}>
					<button
						type="button"
						onClick={() => void onLogout()}
						disabled={isAuthPending}
						style={{
							...destructiveButtonStyle,
							opacity: isAuthPending ? 0.6 : 1,
							width: '100%',
						}}
						className="runa-button runa-button--secondary runa-button--danger"
					>
						{uiCopy.account.logout}
					</button>
				</div>

				{authError ? (
					<div
						role="alert"
						style={{
							marginTop: '16px',
							lineHeight: 1.5,
						}}
						className="runa-alert runa-alert--danger"
					>
						<strong>{uiCopy.account.authErrorTitle}: </strong>
						{authError}
					</div>
				) : null}
			</section>

			<section style={sectionGridStyle}>
				<ProfileCard authContext={authContext} />
				<SessionCard authContext={authContext} />
				<section
					style={appShellPanelStyle}
					className="runa-card runa-card--subtle"
					aria-labelledby="online-devices-heading"
				>
					<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
						<div style={appShellSecondaryLabelStyle}>Devices</div>
						<h2 id="online-devices-heading" style={{ margin: 0, fontSize: '20px' }}>
							Online devices
						</h2>
						<p style={appShellMutedTextStyle}>
							Giriş yaptığın açık bir desktop companion varsa burada görünür. Bu yüzey şimdilik
							yalnız görünürlük sağlar; cihaz seçimi veya uzaktan aksiyon başlatma bu turda açılmaz.
						</p>
					</div>

					<div style={{ display: 'grid', gap: '14px' }}>
						{desktopDevicesState.status === 'idle' || desktopDevicesState.status === 'loading' ? (
							<div style={deviceCardStyle}>
								<div style={{ color: '#f8fafc', fontWeight: 700 }}>Cihazlar kontrol ediliyor</div>
								<div style={appShellMutedTextStyle}>
									Hesabina bagli acik desktop companion oturumlari taraniyor.
								</div>
							</div>
						) : null}

						{desktopDevicesState.status === 'error' ? (
							<div role="alert" className="runa-alert runa-alert--warning">
								<strong>Online cihazlar su anda gosterilemiyor. </strong>
								{desktopDevicesState.message}
							</div>
						) : null}

						{desktopDevicesState.status === 'success' &&
						desktopDevicesState.devices.length === 0 ? (
							<div style={deviceCardStyle}>
								<div style={{ color: '#f8fafc', fontWeight: 700 }}>Henüz görünen cihaz yok</div>
								<div style={appShellMutedTextStyle}>
									Bu hesapla giris yapmis acik bir desktop companion bulunmadiginda burada cihaz
									listelenmez.
								</div>
							</div>
						) : null}

						{desktopDevicesState.status === 'success'
							? desktopDevicesState.devices.map((device) => (
									<article key={device.connection_id} style={deviceCardStyle}>
										<div
											style={{
												display: 'flex',
												flexWrap: 'wrap',
												alignItems: 'center',
												justifyContent: 'space-between',
												gap: '12px',
											}}
										>
											<div style={{ display: 'grid', gap: '6px' }}>
												<div style={{ color: '#f8fafc', fontWeight: 700 }}>
													{device.machine_label?.trim().length
														? device.machine_label
														: `Desktop ${device.agent_id.slice(0, 8)}`}
												</div>
												<div style={appShellMutedTextStyle}>
													Baglanti: {formatConnectedAt(device.connected_at)}
												</div>
											</div>
											<span
												style={{
													...pillStyle,
													borderColor: 'rgba(74, 222, 128, 0.24)',
													color: '#bbf7d0',
												}}
											>
												{device.status}
											</span>
										</div>

										<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
											{device.capabilities.map((capability) => (
												<span
													key={`${device.connection_id}-${capability.tool_name}`}
													style={pillStyle}
												>
													{capability.tool_name}
												</span>
											))}
										</div>
									</article>
								))
							: null}
					</div>
				</section>
				<section
					style={appShellPanelStyle}
					className="runa-card runa-card--subtle"
					aria-labelledby="voice-preferences-heading"
				>
					<div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
						<div style={appShellSecondaryLabelStyle}>Voice</div>
						<h2 id="voice-preferences-heading" style={{ margin: 0, fontSize: '20px' }}>
							Voice preferences
						</h2>
						<p style={appShellMutedTextStyle}>
							Minimum voice seam burada kalir: sohbet varsayilan olarak yazili devam eder,
							destekliyse sesli okuma ve mikrofon tetigi ikinci katmanda acilir.
						</p>
					</div>

					<div style={{ display: 'grid', gap: '14px' }}>
						<label
							style={{
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: '16px',
								padding: '14px 16px',
								borderRadius: '18px',
								border: '1px solid rgba(148, 163, 184, 0.16)',
								background: 'rgba(9, 14, 25, 0.68)',
							}}
						>
							<div style={{ display: 'grid', gap: '6px' }}>
								<span style={{ color: '#f8fafc', fontWeight: 700 }}>
									Yeni asistan yanitlarini otomatik oku
								</span>
								<span style={appShellMutedTextStyle}>
									Yalniz tarayici speech synthesis destekliyorsa calisir.
								</span>
							</div>
							<input
								type="checkbox"
								checked={autoReadEnabled}
								onChange={(event) => setAutoReadEnabled(event.target.checked)}
								disabled={!isTextToSpeechSupported}
							/>
						</label>

						<div
							style={{
								display: 'grid',
								gap: '8px',
								padding: '14px 16px',
								borderRadius: '18px',
								border: '1px solid rgba(148, 163, 184, 0.16)',
								background: 'rgba(9, 14, 25, 0.68)',
							}}
						>
							<div style={{ color: '#f8fafc', fontWeight: 700 }}>Tarayici yetenekleri</div>
							<div style={appShellMutedTextStyle}>
								Mikrofon: {voiceInput.isSupported ? 'hazir' : 'desteklenmiyor'}
							</div>
							<div style={appShellMutedTextStyle}>
								Sesli okuma: {isTextToSpeechSupported ? 'hazir' : 'desteklenmiyor'}
							</div>
							{voiceInput.permissionDenied ? (
								<div className="runa-alert runa-alert--warning">
									Mikrofon izni reddedilmiş. Chat ekranındaki voice trigger yazılı akışı bozmadan
									pasif kalir; tekrar kullanmak istersen tarayici iznini acman yeterli.
								</div>
							) : null}
							{isSpeaking ? (
								<button
									type="button"
									onClick={cancelTextToSpeech}
									style={appShellSecondaryButtonStyle}
									className="runa-button runa-button--secondary"
								>
									Okumayi durdur
								</button>
							) : null}
							{(voiceInput.errorMessage ?? textToSpeechErrorMessage) ? (
								<div className="runa-subtle-copy">
									{voiceInput.errorMessage ?? textToSpeechErrorMessage}
								</div>
							) : null}
						</div>
					</div>
				</section>
			</section>
		</>
	);
}
