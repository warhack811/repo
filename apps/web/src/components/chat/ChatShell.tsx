import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { designTokens } from '../../lib/design-tokens.js';
import { RunaSurface } from '../ui/index.js';

const shellStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.shellGap,
	minWidth: 0,
};

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
				className="runa-shell-frame runa-shell-frame--chat"
				style={shellStyle}
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
				className="runa-shell-frame runa-shell-frame--chat"
				style={shellStyle}
				tone="plain"
			>
				{children}
			</RunaSurface>
		</RunaSurface>
	);
}
