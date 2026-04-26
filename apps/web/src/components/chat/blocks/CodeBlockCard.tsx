import type { ReactElement } from 'react';
import { useState } from 'react';

import {
	codeBlockContainerStyle,
	inspectionChipStyle,
	preStyle,
	presentationBlockCardStyle,
	presentationSubtleTextStyle,
	secondaryLabelStyle,
} from '../../../lib/chat-styles.js';
import type { RenderBlock } from '../../../ws-types.js';
import { getCodeBlockAccent } from '../PresentationBlockRenderer.js';

type CodeBlockCardProps = Readonly<{
	block:
		| Extract<RenderBlock, { type: 'code_artifact' }>
		| Extract<RenderBlock, { type: 'code_block' }>;
}>;

type CopyState = 'copied' | 'failed' | 'idle';

const lineNumberStyle = {
	color: '#64748b',
	minWidth: '3ch',
	paddingRight: '12px',
	textAlign: 'right',
	userSelect: 'none',
} as const;

const codeLineStyle = {
	display: 'grid',
	gridTemplateColumns: 'auto minmax(0, 1fr)',
	minWidth: 'max-content',
} as const;

function getCopyButtonLabel(copyState: CopyState): string {
	switch (copyState) {
		case 'copied':
			return 'Copied';
		case 'failed':
			return 'Copy failed';
		case 'idle':
			return 'Copy';
	}
}

export function CodeBlockCard({ block }: CodeBlockCardProps): ReactElement {
	const [copyState, setCopyState] = useState<CopyState>('idle');
	const diffKind = block.type === 'code_block' ? block.payload.diff_kind : undefined;
	const displayPath = block.type === 'code_block' ? block.payload.path : block.payload.filename;
	const displayTitle =
		block.type === 'code_block'
			? (block.payload.title ?? block.payload.path ?? 'inline preview')
			: (block.payload.filename ?? 'code artifact');
	const accent = getCodeBlockAccent(diffKind);
	const codeLines = block.payload.content.length > 0 ? block.payload.content.split('\n') : [''];

	function resetCopyStateSoon(): void {
		window.setTimeout(() => setCopyState('idle'), 2000);
	}

	function handleCopy(): void {
		if (!navigator.clipboard) {
			setCopyState('failed');
			resetCopyStateSoon();
			return;
		}

		void navigator.clipboard
			.writeText(block.payload.content)
			.then(() => {
				setCopyState('copied');
				resetCopyStateSoon();
			})
			.catch(() => {
				setCopyState('failed');
				resetCopyStateSoon();
			});
	}

	return (
		<article
			key={block.id}
			style={{
				...presentationBlockCardStyle,
				background: 'linear-gradient(180deg, rgba(7, 16, 32, 0.94) 0%, rgba(2, 6, 23, 0.88) 100%)',
				borderColor: 'rgba(56, 189, 248, 0.28)',
			}}
		>
			<div
				style={{
					alignItems: 'flex-start',
					display: 'flex',
					flexWrap: 'wrap',
					gap: '12px',
					justifyContent: 'space-between',
					marginBottom: '10px',
				}}
			>
				<div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
					<span style={secondaryLabelStyle}>code block</span>
					<strong style={{ color: '#f8fafc', fontSize: '16px', overflowWrap: 'anywhere' }}>
						{displayTitle}
					</strong>
				</div>
				<div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
					<span
						style={{
							border: `1px solid ${accent}`,
							borderRadius: '999px',
							color: accent,
							fontSize: '11px',
							fontWeight: 700,
							letterSpacing: '0.08em',
							padding: '4px 10px',
							textTransform: 'uppercase',
						}}
					>
						{block.payload.language}
					</span>
					{diffKind ? (
						<span style={{ ...secondaryLabelStyle, color: accent }}>{diffKind}</span>
					) : null}
					<button
						type="button"
						onClick={handleCopy}
						aria-live="polite"
						style={{
							...inspectionChipStyle,
							color: copyState === 'failed' ? '#fca5a5' : '#bfdbfe',
							cursor: 'pointer',
						}}
					>
						{getCopyButtonLabel(copyState)}
					</button>
				</div>
			</div>
			{block.type === 'code_block' && block.payload.summary ? (
				<div style={{ ...presentationSubtleTextStyle, marginBottom: '10px' }}>
					{block.payload.summary}
				</div>
			) : null}
			{displayPath ? (
				<div style={{ marginBottom: '10px' }}>
					<span style={secondaryLabelStyle}>path</span>
					<div
						style={{
							color: '#93c5fd',
							lineHeight: 1.6,
							marginTop: '4px',
							overflowWrap: 'anywhere',
						}}
					>
						{displayPath}
					</div>
				</div>
			) : null}
			<div style={codeBlockContainerStyle}>
				<pre style={preStyle}>
					{codeLines.map((line, index) => (
						<span key={`${block.id}:line:${index}`} style={codeLineStyle}>
							<span style={lineNumberStyle}>{index + 1}</span>
							<span>{line || ' '}</span>
						</span>
					))}
				</pre>
			</div>
		</article>
	);
}
