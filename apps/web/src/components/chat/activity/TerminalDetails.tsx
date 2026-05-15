import { Copy } from 'lucide-react';
import { type ReactElement, useMemo, useState } from 'react';

import { RunaButton } from '../../ui/RunaButton.js';
import styles from './RunActivityFeed.module.css';
import type { RunActivityRow } from './runActivityAdapter.js';
import {
	type TerminalOutputSection,
	formatDurationLabel,
	formatTerminalCopyText,
	formatTerminalOutputSection,
} from './terminalOutput.js';

type TerminalDetailsProps = Readonly<{
	row: Extract<RunActivityRow, { kind: 'tool' }>;
}>;

type ExpandableKind = 'preview' | 'stderr' | 'stdout';

type SectionState = Readonly<{
	collapsed: TerminalOutputSection;
	display: TerminalOutputSection;
}>;

const FULL_SECTION_LIMITS = {
	maxChars: Number.MAX_SAFE_INTEGER,
	maxLines: Number.MAX_SAFE_INTEGER,
} as const;

function getSectionState(
	kind: ExpandableKind,
	value: string | undefined,
	expanded: boolean,
): SectionState | null {
	const collapsed = formatTerminalOutputSection(kind, value);
	if (!collapsed) {
		return null;
	}

	if (!expanded) {
		return { collapsed, display: collapsed };
	}

	const full = formatTerminalOutputSection(kind, value, FULL_SECTION_LIMITS);
	return { collapsed, display: full ?? collapsed };
}

function getTruncationNote(section: TerminalOutputSection): string | undefined {
	if (!section.truncated) {
		return undefined;
	}

	if (section.visibleLineCount < section.originalLineCount) {
		return `${section.visibleLineCount} / ${section.originalLineCount} satır gösteriliyor`;
	}

	return 'Çıktı uzun olduğu için kısaltıldı';
}

function ExpandableTerminalSection({
	section,
	onToggle,
	expanded,
}: Readonly<{
	section: SectionState;
	onToggle: () => void;
	expanded: boolean;
}>): ReactElement {
	const truncationNote = getTruncationNote(section.collapsed);
	const showToggle = section.collapsed.truncated;

	return (
		<section className={styles['terminalSection']}>
			<h5 className={styles['terminalSectionHeader']}>{section.display.label}</h5>
			<pre
				className={styles['terminalOutput']}
				data-terminal-kind={section.display.kind}
				data-terminal-truncated={section.collapsed.truncated ? 'true' : 'false'}
			>
				{section.display.value}
			</pre>
			{truncationNote ? <p className={styles['terminalTruncationNote']}>{truncationNote}</p> : null}
			{showToggle ? (
				<button className={styles['terminalShowMore']} onClick={onToggle} type="button">
					{expanded ? 'Kısalt' : 'Tamamını göster'}
				</button>
			) : null}
		</section>
	);
}

export function TerminalDetails({ row }: TerminalDetailsProps): ReactElement {
	const [copyState, setCopyState] = useState<'copied' | 'failed' | 'idle'>('idle');
	const [expanded, setExpanded] = useState<Record<ExpandableKind, boolean>>({
		preview: false,
		stderr: false,
		stdout: false,
	});

	const commandSection = useMemo(
		() => formatTerminalOutputSection('command', row.command, { maxChars: 2000, maxLines: 24 }),
		[row.command],
	);
	const commandCopyValue = useMemo(() => formatTerminalCopyText(row.command), [row.command]);
	const previewSection = useMemo(
		() => getSectionState('preview', row.preview, expanded.preview),
		[expanded.preview, row.preview],
	);
	const stdoutSection = useMemo(
		() => getSectionState('stdout', row.stdout, expanded.stdout),
		[expanded.stdout, row.stdout],
	);
	const stderrSection = useMemo(
		() => getSectionState('stderr', row.stderr, expanded.stderr),
		[expanded.stderr, row.stderr],
	);

	const durationLabel = formatDurationLabel(row.durationMs);
	const terminalMeta = useMemo(() => {
		const parts: string[] = [];
		if (row.exitCode !== undefined) {
			parts.push(`Çıkış kodu: ${row.exitCode}`);
		}
		if (durationLabel) {
			parts.push(`Süre: ${durationLabel}`);
		}
		return parts;
	}, [durationLabel, row.exitCode]);

	const hasVisibleContent = Boolean(
		commandSection ||
			previewSection ||
			stdoutSection ||
			stderrSection ||
			row.exitCode !== undefined ||
			durationLabel,
	);

	return (
		<div className={styles['terminalDetails']}>
			{hasVisibleContent ? (
				<>
					{commandSection ? (
						<div className={styles['terminalToolbar']}>
							<section className={styles['terminalSection']}>
								<h5 className={styles['terminalSectionHeader']}>{commandSection.label}</h5>
								<pre
									className={styles['terminalOutput']}
									data-terminal-kind={commandSection.kind}
									data-terminal-truncated={commandSection.truncated ? 'true' : 'false'}
								>
									{commandSection.value}
								</pre>
							</section>
							{commandCopyValue ? (
								<RunaButton
									aria-label={
										copyState === 'copied'
											? 'Komut kopyalandı'
											: copyState === 'failed'
												? 'Komut kopyalanamadı'
												: 'Komutu kopyala'
									}
									onClick={async () => {
										if (!globalThis.navigator?.clipboard?.writeText) {
											setCopyState('failed');
											globalThis.setTimeout(() => setCopyState('idle'), 1000);
											return;
										}

										try {
											await globalThis.navigator.clipboard.writeText(commandCopyValue);
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
							) : null}
						</div>
					) : null}
					{terminalMeta.length > 0 ? (
						<section className={styles['terminalSection']}>
							<h5 className={styles['terminalSectionHeader']}>Komut bilgisi</h5>
							<p className={styles['rowMeta']}>{terminalMeta.join(' • ')}</p>
						</section>
					) : null}
					{previewSection ? (
						<ExpandableTerminalSection
							expanded={expanded.preview}
							onToggle={() => {
								setExpanded((current) => ({ ...current, preview: !current.preview }));
							}}
							section={previewSection}
						/>
					) : null}
					{stdoutSection ? (
						<ExpandableTerminalSection
							expanded={expanded.stdout}
							onToggle={() => {
								setExpanded((current) => ({ ...current, stdout: !current.stdout }));
							}}
							section={stdoutSection}
						/>
					) : null}
					{stderrSection ? (
						<ExpandableTerminalSection
							expanded={expanded.stderr}
							onToggle={() => {
								setExpanded((current) => ({ ...current, stderr: !current.stderr }));
							}}
							section={stderrSection}
						/>
					) : null}
				</>
			) : (
				<p className={styles['terminalEmpty']}>Bu araç için gösterilecek teknik çıktı yok.</p>
			)}
		</div>
	);
}
