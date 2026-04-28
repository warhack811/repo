import type { ReactElement, ReactNode } from 'react';
import { useEffect } from 'react';

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
	void onToggleSidebar;

	useEffect(() => {
		if (!isSidebarOpen) {
			return;
		}

		document.body.classList.add('runa-sidebar-lock');

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === 'Escape') {
				onCloseSidebar();
			}
		}

		window.addEventListener('keydown', handleKeyDown);
		return () => {
			document.body.classList.remove('runa-sidebar-lock');
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, [isSidebarOpen, onCloseSidebar]);

	return (
		<div
			className={`runa-chat-layout${isSidebarOpen ? ' runa-chat-layout--sidebar-open' : ''}`}
			data-sidebar-open={isSidebarOpen ? 'true' : 'false'}
		>
			<div className="runa-chat-layout__sidebar">{sidebar}</div>
			<div className="runa-chat-layout__main">
				<div className="runa-chat-layout__composer">{composer}</div>
				<div className="runa-chat-layout__work">{messages}</div>
			</div>
		</div>
	);
}
