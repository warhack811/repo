import type { ReactElement } from 'react';
import { useState } from 'react';
import type { RenderBlock } from '../../../ws-types.js';
import { getCodeBlockAccent } from '../PresentationBlockRenderer.js';

type CodeBlockCardProps = Readonly<{
	block:
		| Extract<RenderBlock, { type: 'code_artifact' }>
		| Extract<RenderBlock, { type: 'code_block' }>;
}>;

type CopyState = 'copied' | 'failed' | 'idle';

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
		<article key={block.id} className="runa-migrated-components-chat-blocks-codeblockcard-1">
			<div className="runa-migrated-components-chat-blocks-codeblockcard-2">
				<div className="runa-migrated-components-chat-blocks-codeblockcard-3">
					<span className="runa-migrated-components-chat-blocks-codeblockcard-4">code block</span>
					<strong className="runa-migrated-components-chat-blocks-codeblockcard-5">
						{displayTitle}
					</strong>
				</div>
				<div className="runa-migrated-components-chat-blocks-codeblockcard-6">
					<span className="runa-migrated-components-chat-blocks-codeblockcard-7">
						{block.payload.language}
					</span>
					{diffKind ? (
						<span className="runa-migrated-components-chat-blocks-codeblockcard-8">{diffKind}</span>
					) : null}
					<button
						type="button"
						onClick={handleCopy}
						aria-live="polite"
						className="runa-migrated-components-chat-blocks-codeblockcard-9"
					>
						{getCopyButtonLabel(copyState)}
					</button>
				</div>
			</div>
			{block.type === 'code_block' && block.payload.summary ? (
				<div className="runa-migrated-components-chat-blocks-codeblockcard-10">
					{block.payload.summary}
				</div>
			) : null}
			{displayPath ? (
				<div className="runa-migrated-components-chat-blocks-codeblockcard-11">
					<span className="runa-migrated-components-chat-blocks-codeblockcard-12">path</span>
					<div className="runa-migrated-components-chat-blocks-codeblockcard-13">{displayPath}</div>
				</div>
			) : null}
			<div className="runa-migrated-components-chat-blocks-codeblockcard-14">
				<pre className="runa-migrated-components-chat-blocks-codeblockcard-15">
					{codeLines.map((line, index) => (
						<span
							key={`${block.id}:line:${index}`}
							className="runa-migrated-components-chat-blocks-codeblockcard-16"
						>
							<span className="runa-migrated-components-chat-blocks-codeblockcard-17">
								{index + 1}
							</span>
							<span>{line || ' '}</span>
						</span>
					))}
				</pre>
			</div>
		</article>
	);
}
