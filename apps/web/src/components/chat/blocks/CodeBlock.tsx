import { Check, ChevronDown, Clipboard, WrapText } from 'lucide-react';
import type { ReactElement } from 'react';
import { useState } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import { RunaButton } from '../../ui/RunaButton.js';
import { cx } from '../../ui/ui-utils.js';
import styles from './BlockRenderer.module.css';

type CodeBlockProps = Readonly<{
	block:
		| Extract<RenderBlock, { type: 'code_artifact' }>
		| Extract<RenderBlock, { type: 'code_block' }>;
}>;

type CopyState = 'copied' | 'failed' | 'idle';

const COLLAPSED_LINE_LIMIT = 8;

function getCopyButtonLabel(copyState: CopyState): string {
	switch (copyState) {
		case 'copied':
			return 'Kopyalandı';
		case 'failed':
			return 'Kopyalama başarısız';
		case 'idle':
			return 'Kopyala';
	}
}

function getDisplayTitle(block: CodeBlockProps['block']): string {
	return block.type === 'code_block'
		? (block.payload.title ?? block.payload.path ?? 'inline preview')
		: (block.payload.filename ?? 'code artifact');
}

function getDisplayPath(block: CodeBlockProps['block']): string | undefined {
	return block.type === 'code_block' ? block.payload.path : block.payload.filename;
}

export function CodeBlock({ block }: CodeBlockProps): ReactElement {
	const lines = block.payload.content.length > 0 ? block.payload.content.split('\n') : [''];
	const isLongBlock = lines.length > COLLAPSED_LINE_LIMIT;
	const [copyState, setCopyState] = useState<CopyState>('idle');
	const [isExpanded, setIsExpanded] = useState(!isLongBlock);
	const [isWrapped, setIsWrapped] = useState(false);
	const displayPath = getDisplayPath(block);

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
		<article className={styles['block']}>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Code block</span>
					<strong className={styles['title']}>{getDisplayTitle(block)}</strong>
				</div>
				<div className={styles['chipRow']}>
					<span className={styles['chip']}>{block.payload.language || 'text'}</span>
					<span className={styles['chip']}>{lines.length} lines</span>
					{block.type === 'code_block' && block.payload.diff_kind ? (
						<span className={styles['chip']}>{block.payload.diff_kind}</span>
					) : null}
				</div>
			</div>
			{block.type === 'code_block' && block.payload.summary ? (
				<p className={styles['summary']}>{block.payload.summary}</p>
			) : null}
			{displayPath ? (
				<div className={styles['metaBox']}>
					<span className={styles['metaLabel']}>Path</span>
					<code>{displayPath}</code>
				</div>
			) : null}
			<div className={styles['codePanel']}>
				<div className={styles['codeToolbar']}>
					<div className={styles['chipRow']}>
						<span className={styles['chip']}>{block.payload.language || 'plain text'}</span>
						{isLongBlock && !isExpanded ? (
							<span className={styles['muted']}>
								{lines.length} satırın ilk {COLLAPSED_LINE_LIMIT} satırı gösteriliyor
							</span>
						) : null}
					</div>
					<div className={styles['chipRow']}>
						<RunaButton
							aria-pressed={isWrapped}
							onClick={() => setIsWrapped((current) => !current)}
							variant="ghost"
						>
							<WrapText size={16} /> Kaydır
						</RunaButton>
						<RunaButton aria-live="polite" onClick={handleCopy} variant="secondary">
							{copyState === 'copied' ? <Check size={16} /> : <Clipboard size={16} />}
							{getCopyButtonLabel(copyState)}
						</RunaButton>
					</div>
				</div>
				<div
					className={cx(
						styles['codeScroller'],
						isLongBlock && !isExpanded ? styles['codeScrollerCollapsed'] : undefined,
					)}
				>
					<pre className={cx(styles['pre'], isWrapped ? styles['preWrap'] : styles['preNoWrap'])}>
						{lines.map((line, index) => (
							<span className={styles['codeLine']} key={`${block.id}:line:${index}`}>
								<span className={styles['lineNumber']}>{index + 1}</span>
								<span>{line || ' '}</span>
							</span>
						))}
					</pre>
				</div>
				{isLongBlock ? (
					<RunaButton
						aria-expanded={isExpanded}
						onClick={() => setIsExpanded((current) => !current)}
						variant="ghost"
					>
						<ChevronDown size={16} />
						{isExpanded ? 'Daralt' : `Tümünü göster (${lines.length} satır)`}
					</RunaButton>
				) : null}
			</div>
		</article>
	);
}
