import type { AuthContext } from '@runa/types';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppNav } from '../components/app/AppNav.js';
import { ChatComposerSurface } from '../components/chat/ChatComposerSurface.js';
import { ChatHeader } from '../components/chat/ChatHeader.js';
import { EmptyState } from '../components/chat/EmptyState.js';
import { DevicePresencePanel } from '../components/desktop/DevicePresencePanel.js';
import type { UseConversationsResult } from '../hooks/useConversations.js';
import { uiCopy } from '../localization/copy.js';
import { HistoryPage } from './HistoryPage.js';
import { SettingsPage } from './SettingsPage.js';

const forbiddenUserCopy = [
	'burada kalır',
	'burada görünür',
	'bu fazda',
	'doğrulanmış evet',
	'Developer Mode',
	'Web Speech API',
	'companion',
	'troubleshooting',
	'metadata',
] as const;

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

function flattenCopy(value: unknown): string[] {
	if (typeof value === 'string') {
		return [value];
	}

	if (typeof value !== 'object' || value === null) {
		return [];
	}

	return Object.values(value).flatMap((nestedValue) => flattenCopy(nestedValue));
}

function createConversations(): UseConversationsResult {
	return {
		activeConversationId: null,
		activeConversationMembers: [],
		activeConversationMessages: [],
		activeConversationRunSurfaces: [],
		activeConversationSummary: null,
		beginDraftConversation: () => undefined,
		buildRequestMessages: () => [],
		conversationError: null,
		conversations: [],
		handleRunAccepted: () => undefined,
		handleRunFinished: () => undefined,
		handleRunFinishing: () => undefined,
		isConversationLoading: false,
		isMemberLoading: false,
		memberError: null,
		removeConversationMember: async () => undefined,
		selectConversation: () => undefined,
		shareConversationMember: async () => undefined,
	};
}

function renderNormalSurfaces(): string {
	return renderToStaticMarkup(
		<MemoryRouter>
			<AppNav activePage="chat" />
			<ChatHeader
				connectionStatus="open"
				desktopDevices={[]}
				onToggleSidebar={() => undefined}
				statusLabel="Canlı"
			/>
			<EmptyState onSubmitSuggestion={() => undefined} />
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
				isRuntimeConfigReady
				isSpeaking={false}
				isSpeechPlaybackSupported={false}
				isSubmitting={false}
				isUploadingAttachment={false}
				isVoiceSupported
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
			<HistoryPage conversations={createConversations()} />
			<DevicePresencePanel devices={[]} />
			<SettingsPage
				accessToken={null}
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
}

describe('copy voice pass', () => {
	it('keeps exported Turkish copy free of self-narrating and internal language', () => {
		const joinedCopy = flattenCopy(uiCopy).join('\n');

		for (const phrase of forbiddenUserCopy) {
			expect(joinedCopy).not.toContain(phrase);
		}
	});

	it('keeps normal user surfaces in one Turkish product voice', () => {
		const markup = renderNormalSurfaces();

		expect(markup).toContain('Neyi ilerletmek istiyorsun?');
		expect(markup).toContain('Kod yaz veya gözden geçir');
		expect(markup).toContain('Bağlı cihaz yok');

		for (const phrase of forbiddenUserCopy) {
			expect(markup).not.toContain(phrase);
		}
	});
});
