import type { CSSProperties, ReactElement, ReactNode } from 'react';

const shellStyle: CSSProperties = {
	display: 'grid',
	gap: 'clamp(16px, 3vw, 20px)',
	minWidth: 0,
};

type ChatShellProps = Readonly<{
	children: ReactNode;
	embedded?: boolean;
}>;

export function ChatShell({ children, embedded = false }: ChatShellProps): ReactElement {
	if (embedded) {
		return (
			<main
				id="chat-workspace-content"
				className="runa-shell-frame runa-shell-frame--chat"
				style={shellStyle}
			>
				{children}
			</main>
		);
	}

	return (
		<div className="runa-page">
			<main
				id="chat-workspace-content"
				className="runa-shell-frame runa-shell-frame--chat"
				style={shellStyle}
			>
				{children}
			</main>
		</div>
	);
}
