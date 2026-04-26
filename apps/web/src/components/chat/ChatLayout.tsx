import type { ReactElement, ReactNode } from 'react';

type ChatLayoutProps = Readonly<{
	composer: ReactNode;
	isSidebarOpen: boolean;
	messages: ReactNode;
	onCloseSidebar: () => void;
	onToggleSidebar: () => void;
	sidebar: ReactNode;
}>;

export function ChatLayout({
	composer,
	isSidebarOpen,
	messages,
	onCloseSidebar,
	onToggleSidebar,
	sidebar,
}: ChatLayoutProps): ReactElement {
	void isSidebarOpen;
	void onCloseSidebar;
	void onToggleSidebar;

	return (
		<div className="runa-chat-layout">
			<div className="runa-chat-layout__sidebar">{sidebar}</div>
			<div className="runa-chat-layout__main">
				{messages}
				<div className="runa-chat-layout__composer">{composer}</div>
			</div>
		</div>
	);
}
