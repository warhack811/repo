import type { ReactElement } from 'react';
import { useState } from 'react';
import type { RenderBlock } from '../../../ws-types.js';
import { getCodeBlockAccent } from '../PresentationBlockRenderer.js';
import styles from './CodeBlockCard.module.css';

type CodeBlockCardProps = Readonly<{
	block:
		| Extract<RenderBlock, { type: 'code_artifact' }>
		| Extract<RenderBlock, { type: 'code_block' }>;
}>;

type CopyState = 'copied' | 'failed' | 'idle';

function getCopyButtonLabel(copyState: CopyState): string {
	switch (copyState) {
		case 'copied':
			return 'KopyalandÄ±';
		case 'failed':
			return 'Kopyalama baÅŸarÄ±sÄ±z';
		case 'idle':
			return 'Kopyala';
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
		<article key={block.id} className={styles['root']}>
			<div className={styles['header']}>
				<div className={styles['titleRow']}>
					<span className={styles['eyebrow']}>code block</span>
					<strong className={styles['title']}>{displayTitle}</strong>
				</div>
				<div className={styles['actions']}>
					<span className={styles['language']}>{block.payload.language}</span>
					{diffKind ? <span className={styles['diffKind']}>{diffKind}</span> : null}
					<button
						type="button"
						onClick={handleCopy}
						aria-live="polite"
						className={styles['copyButton']}
					>
						{getCopyButtonLabel(copyState)}
					</button>
				</div>
			</div>
			{block.type === 'code_block' && block.payload.summary ? (
				<div className={styles['summary']}>{block.payload.summary}</div>
			) : null}
			{displayPath ? (
				<div className={styles['pathRow']}>
					<span className={styles['pathLabel']}>path</span>
					<div className={styles['pathValue']}>{displayPath}</div>
				</div>
			) : null}
			<div className={styles['codeContainer']}>
				<pre className={styles['codePre']}>
					{codeLines.map((line, index) => (
						<span key={`${block.id}:line:${index}`} className={styles['codeLine']}>
							<span className={styles['lineNumber']}>{index + 1}</span>
							<span>{line || ' '}</span>
						</span>
					))}
				</pre>
			</div>
		</article>
	);
}
