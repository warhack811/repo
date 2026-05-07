import type { AuthContext } from '@runa/types';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppNav } from '../components/app/AppNav.js';
import { ChatComposerSurface } from '../components/chat/ChatComposerSurface.js';
import { CapabilityPreviewPage } from './CapabilityPreviewPage.js';
import { SettingsPage } from './SettingsPage.js';

const authContext: AuthContext = {
	claims: {
		email: 'person@example.com',
		email_verified: true,
		role: 'authenticated',
		scope: {},
		sub: 'user_normal',
	},
	principal: {
		email: 'person@example.com',
		kind: 'authenticated',
		provider: 'internal',
		role: 'authenticated',
		scope: {},
		user_id: 'user_normal',
	},
	transport: 'http',
	user: {
		email: 'person@example.com',
		email_verified: true,
		identities: [],
		primary_provider: 'internal',
		scope: {},
		status: 'active',
		user_id: 'user_normal',
	},
};

function renderNormalComposer(): string {
	return renderToStaticMarkup(
		<MemoryRouter>
			<ChatComposerSurface
				accessToken="token"
				apiKey=""
				attachmentUploadError={null}
				attachments={[]}
				canReadLatestResponse={false}
				connectionStatus="open"
				desktopDeviceError={null}
				desktopDevices={[]}
				isDesktopDevicesLoading={false}
				isListening={false}
				isRuntimeConfigReady={false}
				isSpeaking={false}
				isSpeechPlaybackSupported={false}
				isSubmitting={false}
				isUploadingAttachment={false}
				isVoiceSupported={false}
				lastError={null}
				onAttachmentUploadStateChange={() => undefined}
				onAttachmentsChange={() => undefined}
				onClearDesktopTarget={() => undefined}
				onPromptChange={() => undefined}
				onReadLatestResponse={() => undefined}
				onRetryDesktopDevices={() => undefined}
				onSelectDesktopTarget={() => undefined}
				onStopSpeaking={() => undefined}
				onSubmit={(event) => event.preventDefault()}
				onToggleListening={() => undefined}
				prompt=""
				selectedDesktopTargetConnectionId={null}
				showDeveloperControls={false}
				statusLabel="Canlı"
				submitButtonLabel="Gönder"
				voiceStatusMessage={null}
			/>
		</MemoryRouter>,
	);
}

describe('operator/developer hard isolation', () => {
	it('keeps normal app navigation free of developer entry points', () => {
		const markup = renderToStaticMarkup(
			<MemoryRouter>
				<AppNav activePage="chat" />
			</MemoryRouter>,
		);

		expect(markup).toContain('Sohbet');
		expect(markup).toContain('Geçmiş');
		expect(markup).toContain('Cihazlar');
		expect(markup).toContain('Hesap');
		expect(markup).not.toContain('Developer');
		expect(markup).not.toContain('/developer');
	});

	it('keeps account settings free of developer toggles and internal routes', () => {
		const markup = renderToStaticMarkup(
			<MemoryRouter>
				<SettingsPage
					authContext={authContext}
					authError={null}
					brandTheme="teal"
					isAuthPending={false}
					onBrandThemeChange={() => undefined}
					onLogout={async () => undefined}
					onThemeChange={() => undefined}
					theme="system"
				/>
			</MemoryRouter>,
		);

		expect(markup).toContain('Hesap');
		expect(markup).toContain('Tercihler');
		expect(markup).not.toContain('Developer Mode');
		expect(markup).not.toContain('/developer');
		expect(markup).not.toContain('Project Memory');
	});

	it('does not let capability preview self-enable developer mode', () => {
		const markup = renderToStaticMarkup(<CapabilityPreviewPage />);

		expect(markup).toContain('Developer Mode is required');
		expect(markup).toContain('internal visual QA');
		expect(markup).not.toContain('Enable Developer Mode');
	});

	it('keeps normal composer copy free of developer setup actions', () => {
		const markup = renderNormalComposer();

		expect(markup).toContain('Runa şu anda mesaj göndermeye hazır değil.');
		expect(markup).not.toContain('Developer Mode');
		expect(markup).not.toContain('/developer');
		expect(markup).not.toContain('Gelistirici ayarlarindaki');
	});
});
