import { Copy } from 'lucide-react';
import { type ReactElement, useMemo, useState } from 'react';

import { RunaButton } from '../../ui/RunaButton.js';
import styles from './RunActivityFeed.module.css';
import type { RunActivityRow } from './runActivityAdapter.js';

type TerminalDetailsProps = Readonly<{
	row: Extract<RunActivityRow, { kind: 'tool' }>;
}>;

function TerminalPane({
	label,
	value,
}: Readonly<{ label: string; value: string | undefined }>): ReactElement | null {
	if (!value) {
		return null;
	}

	return (
		<section className={styles['terminalSection']}>
			<h5 className={styles['terminalHeading']}>{label}</h5>
			<pre className={styles['terminalOutput']}>{value}</pre>
		</section>
	);
}

export function TerminalDetails({ row }: TerminalDetailsProps): ReactElement {
	const [copyState, setCopyState] = useState<'copied' | 'failed' | 'idle'>('idle');
	const copyDisabled = !row.command;
	const terminalMeta = useMemo(() => {
		const parts: string[] = [];
		if (row.exitCode !== undefined) {
			parts.push(`Çıkış kodu: ${row.exitCode}`);
		}
		if (row.durationMs !== undefined) {
			parts.push(`Süre: ${row.durationMs} ms`);
		}
		return parts;
	}, [row.durationMs, row.exitCode]);

	return (
		<div className={styles['terminalDetails']}>
			<div className={styles['terminalToolbar']}>
				{row.command ? <code className={styles['terminalCommand']}>{row.command}</code> : null}
				<RunaButton
					aria-label="Komutu kopyala"
					disabled={copyDisabled}
					onClick={async () => {
						if (!row.command || !globalThis.navigator?.clipboard?.writeText) {
							return;
						}
						try {
							await globalThis.navigator.clipboard.writeText(row.command);
							setCopyState('copied');
						} catch {
							setCopyState('failed');
						} finally {
							globalThis.setTimeout(() => setCopyState('idle'), 1000);
						}
					}}
					variant="secondary"
				>
					<Copy aria-hidden size={14} />
					{copyState === 'copied'
						? 'Kopyalandı'
						: copyState === 'failed'
							? 'Kopyalanamadı'
							: 'Komutu kopyala'}
				</RunaButton>
			</div>
			{terminalMeta.length > 0 ? (
				<p className={styles['rowMeta']} aria-label="Komut bilgisi">
					{terminalMeta.join(' • ')}
				</p>
			) : null}
			<TerminalPane label="stdout" value={row.stdout} />
			<TerminalPane label="stderr" value={row.stderr} />
		</div>
	);
}
