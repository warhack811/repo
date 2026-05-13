import { Plus } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { HafizaMark } from '../ui/HafizaMark.js';
import { AppNav, type AuthenticatedPageId } from './AppNav.js';

type AppSidebarProps = Readonly<{
	activePage: AuthenticatedPageId;
	conversationSidebar?: ReactNode;
}>;

export function AppSidebar({
	activePage,
	conversationSidebar = null,
}: AppSidebarProps): ReactElement {
	return (
		<aside className="runa-app-sidebar" aria-label="Runa gezinme">
			<div className="runa-app-sidebar__chrome">
				<Link className="runa-app-sidebar__brand" to="/chat" aria-label="Runa sohbet">
					<HafizaMark weight="regular" variant="brand" className="runa-app-sidebar__mark" />
					<span>Runa</span>
				</Link>
				<Link className="runa-app-sidebar__new-chat" to="/chat?new=1">
					<Plus aria-hidden="true" size={15} />
					<span>Yeni sohbet</span>
				</Link>
			</div>
			{conversationSidebar ? (
				<div className="runa-app-sidebar__conversations">{conversationSidebar}</div>
			) : null}
			<div className="runa-app-sidebar__nav">
				<AppNav activePage={activePage} variant="sidebar" />
			</div>
		</aside>
	);
}
