import type { ReactElement } from 'react';

import { useConversations } from '../hooks/useConversations.js';
import { HistoryPage } from './HistoryPage.js';

type HistoryRouteProps = Readonly<{
	bearerToken: string | null;
}>;

export function HistoryRoute({ bearerToken }: HistoryRouteProps): ReactElement {
	const conversations = useConversations({
		accessToken: bearerToken,
	});

	return <HistoryPage conversations={conversations} />;
}
