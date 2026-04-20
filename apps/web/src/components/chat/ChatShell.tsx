import type { CSSProperties, ReactElement, ReactNode } from 'react';

const pageStyle: CSSProperties = {
	minHeight: '100vh',
	background:
		'radial-gradient(circle at top left, rgba(245, 158, 11, 0.18), transparent 28%), linear-gradient(180deg, #0f172a 0%, #111827 100%)',
	color: '#e5e7eb',
	fontFamily: '"Segoe UI", sans-serif',
	padding: 'clamp(18px, 4vw, 32px) clamp(12px, 3vw, 16px)',
};

const shellStyle: CSSProperties = {
	margin: '0 auto',
	maxWidth: '1080px',
	width: 'min(100%, 1080px)',
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
			<main id="chat-workspace-content" style={shellStyle}>
				{children}
			</main>
		);
	}

	return (
		<div style={pageStyle}>
			<main id="chat-workspace-content" style={shellStyle}>
				{children}
			</main>
		</div>
	);
}
