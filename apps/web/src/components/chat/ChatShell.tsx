import type { ReactElement, ReactNode } from 'react';
import { RunaSurface } from '../ui/index.js';

type ChatShellProps = Readonly<{
	children: ReactNode;
	embedded?: boolean;
}>;

export function ChatShell({ children, embedded = false }: ChatShellProps): ReactElement {
	if (embedded) {
		return (
			<RunaSurface
				as="main"
				id="chat-workspace-content"
				className="runa-shell-frame runa-shell-frame--chat runa-migrated-components-chat-chatshell-1"
				tone="plain"
			>
				{children}
			</RunaSurface>
		);
	}

	return (
		<RunaSurface className="runa-page" tone="plain">
			<RunaSurface
				as="main"
				id="chat-workspace-content"
				className="runa-shell-frame runa-shell-frame--chat runa-migrated-components-chat-chatshell-2"
				tone="plain"
			>
				{children}
			</RunaSurface>
		</RunaSurface>
	);
}
