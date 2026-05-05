import { AlertTriangle, CheckCircle2, TerminalSquare } from 'lucide-react';
import type { ReactElement } from 'react';

import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from '../../../components/ai-elements/tool.js';
import type { RenderBlock } from '../../../ws-types.js';
import { cx } from '../../ui/ui-utils.js';
import { formatWorkDetail, formatWorkToolLabel } from '../workNarrationFormat.js';
import styles from './BlockRenderer.module.css';

type ToolResultBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'tool_result' }>;
	isDeveloperMode?: boolean;
}>;

function getFriendlyToolTitle(toolName: string | undefined): string {
	if (!toolName) return 'İşlem tamamlandı';
	const map: Record<string, string> = {
		'file.read': 'Dosya okundu',
		'file.write': 'Dosya güncellendi',
		'file.list': 'Dizin listelendi',
		'file.delete': 'Dosya silindi',
		'web.search': 'Web araması yapıldı',
		'web.fetch': 'Sayfa getirildi',
		'shell.exec': 'Komut çalıştı',
		'search.codebase': 'Kod tarandı',
		'desktop.click': 'Masaüstünde tıklandı',
		'desktop.clipboard.read': 'Pano okundu',
		'desktop.clipboard.write': 'Pano güncellendi',
		'desktop.keypress': 'Klavye kısayolu çalıştı',
		'desktop.launch': 'Uygulama başlatıldı',
		'desktop.scroll': 'Masaüstü kaydırıldı',
		'desktop.screenshot': 'Ekran görüntüsü alındı',
		'desktop.type': 'Masaüstüne yazıldı',
		'memory.write': 'Bilgi kaydedildi',
		'memory.read': 'Bellek okundu',
	};
	return map[toolName] ?? `${formatWorkToolLabel(toolName)} tamamlandı`;
}

function getFriendlyResultCopy(block: ToolResultBlockProps['block']): Readonly<{
	readonly summary: string;
	readonly title: string;
}> {
	if (block.payload.status === 'success') {
		return {
			summary: 'Sonuç sohbet akışına eklendi.',
			title: getFriendlyToolTitle(block.payload.tool_name),
		};
	}

	return {
		summary: 'Bu adım tamamlanamadı. Gerekirse yeniden deneyebilirsin.',
		title: 'İşlem tamamlanamadı',
	};
}

function normalizeText(value: string | undefined): string | null {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : null;
}

function isTechnicalPreview(value: string): boolean {
	return (
		value.startsWith('Object{') ||
		value.startsWith('Array[') ||
		value === '[object Object]' ||
		value === '{}'
	);
}

function getFriendlyOutputSummary(block: ToolResultBlockProps['block'], fallback: string): string {
	const preview = normalizeText(block.payload.result_preview?.summary_text);
	const summary = normalizeText(block.payload.summary);
	const selected =
		preview && !isTechnicalPreview(preview) ? preview : (summary ?? preview ?? fallback);
	return formatWorkDetail(selected) ?? selected;
}

export function ToolResultBlock({
	block,
	isDeveloperMode = false,
}: ToolResultBlockProps): ReactElement {
	const isSuccess = block.payload.status === 'success';
	const friendlyCopy = getFriendlyResultCopy(block);
	const output = block.payload.result_preview ?? friendlyCopy.summary;
	const friendlySummary = getFriendlyOutputSummary(block, friendlyCopy.summary);
	const friendlyToolLabel = formatWorkToolLabel(block.payload.tool_name);

	if (!isDeveloperMode) {
		return (
			<article
				className={cx(
					styles['toolResultCard'],
					isSuccess ? styles['toolResultSuccess'] : styles['toolResultError'],
				)}
			>
				<div className={styles['toolResultHeader']}>
					<div className={styles['headerStack']}>
						<span className={styles['eyebrow']}>İşlem sonucu</span>
						<h3 className={styles['title']}>{friendlyCopy.title}</h3>
					</div>
					<span className={styles['toolResultStatus']}>
						{isSuccess ? (
							<CheckCircle2 aria-hidden="true" size={16} />
						) : (
							<AlertTriangle aria-hidden="true" size={16} />
						)}
						{isSuccess ? 'tamamlandı' : 'hata'}
					</span>
				</div>
				<div className={styles['toolResultBody']}>
					<p className={styles['summary']}>{friendlySummary}</p>
					<div className={styles['chipRow']}>
						<span className={styles['chip']}>
							<TerminalSquare aria-hidden="true" size={14} />
							{friendlyToolLabel}
						</span>
						{isSuccess ? null : (
							<span className={styles['chip']}>
								{block.payload.error_code
									? `Hata kodu: ${block.payload.error_code}`
									: 'Tekrar denenebilir'}
							</span>
						)}
					</div>
				</div>
			</article>
		);
	}

	return (
		<Tool defaultOpen>
			<ToolHeader
				state={isSuccess ? 'output-available' : 'output-error'}
				title={block.payload.tool_name}
				type={`tool-${block.payload.tool_name}`}
			/>
			<ToolContent>
				<ToolInput
					input={{
						call_id: block.payload.call_id,
						status: block.payload.status,
						tool_name: block.payload.tool_name,
					}}
					state="input-available"
				/>
				<ToolOutput
					errorText={isSuccess ? undefined : (block.payload.error_code ?? friendlyCopy.summary)}
					output={output}
				/>
			</ToolContent>
		</Tool>
	);
}
