import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { OnboardingWizard } from '../components/onboarding/OnboardingWizard.js';
import { useConversationBackedChatRuntime } from '../hooks/useConversationBackedChatRuntime.js';
import { ChatPage } from './ChatPage.js';

type ChatRuntimePageProps = Readonly<{
	bearerToken: string | null;
}>;

export function ChatRuntimePage({ bearerToken }: ChatRuntimePageProps): ReactElement {
	const { conversations, runtime } = useConversationBackedChatRuntime(bearerToken);
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const shouldStartNewConversation = searchParams.get('new') === '1';

	useEffect(() => {
		if (!shouldStartNewConversation) {
			return;
		}

		conversations.beginDraftConversation();
		navigate('/chat', { replace: true });
	}, [conversations.beginDraftConversation, navigate, shouldStartNewConversation]);

	return (
		<>
			<ChatPage conversations={conversations} embedded runtime={runtime} />
			<OnboardingWizard onSubmitPrompt={runtime.setPrompt} />
		</>
	);
}
