import type { AuthContext } from '@runa/types';
import type { ReactElement } from 'react';

import { RunaSkeleton } from '../components/ui/RunaSkeleton.js';
import { useConversationBackedChatRuntime } from '../hooks/useConversationBackedChatRuntime.js';
import { DeveloperPage } from './DeveloperPage.js';

type DeveloperRuntimePageProps = Readonly<{
	authContext: AuthContext;
	authError: string | null;
	bearerToken: string | null;
	hasStoredBearerToken: boolean;
	isAuthPending: boolean;
	onClearAuthToken: () => Promise<void>;
	onRefreshAuthContext: () => Promise<void>;
}>;

export function DeveloperRuntimePage({
	authContext,
	authError,
	bearerToken,
	hasStoredBearerToken,
	isAuthPending,
	onClearAuthToken,
	onRefreshAuthContext,
}: DeveloperRuntimePageProps): ReactElement {
	const { conversations, runtime } = useConversationBackedChatRuntime(bearerToken);

	if (conversations.isConversationLoading) {
		return (
			<section className="runa-settings-panel-grid" aria-label="Developer loading">
				<RunaSkeleton className="runa-conversation-skeleton" variant="rect" />
				<RunaSkeleton variant="text" />
			</section>
		);
	}

	return (
		<DeveloperPage
			authContext={authContext}
			authError={authError}
			hasStoredBearerToken={hasStoredBearerToken}
			isAuthPending={isAuthPending}
			onClearAuthToken={onClearAuthToken}
			onRefreshAuthContext={onRefreshAuthContext}
			runtime={runtime}
		/>
	);
}
