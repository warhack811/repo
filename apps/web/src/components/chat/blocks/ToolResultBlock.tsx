import { ChevronRight } from 'lucide-react';
import type { ReactElement } from 'react';

import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from '../../../components/ai-elements/tool.js';
import type { RenderBlock } from '../../../ws-types.js';
import { formatWorkDetail, formatWorkToolLabel } from '../workNarrationFormat.js';
import styles from './BlockRenderer.module.css';

type ToolResultBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'tool_result' }>;
	isDeveloperMode?: boolean;
}>;

function getFriendlyToolTitle(toolName: string | undefined): string {
	if (!toolName) return 'Islem tamamlandi';
	const map: Record<string, string> = {
		'file.read': 'Dosya okundu',
		'file.write': 'Dosya guncellendi',
		'file.list': 'Dizin listelendi',
		'file.delete': 'Dosya silindi',
		'web.search': 'Web aramasi yapildi',
		'web.fetch': 'Sayfa getirildi',
		'shell.exec': 'Komut calisti',
		'search.codebase': 'Kod tarandi',
		'desktop.click': 'Masaustunde tiklandi',
		'desktop.clipboard.read': 'Pano okundu',
		'desktop.clipboard.write': 'Pano guncellendi',
		'desktop.keypress': 'Klavye kisayolu calisti',
		'desktop.launch': 'Uygulama baslatildi',
		'desktop.scroll': 'Masaustu kaydirildi',
		'desktop.screenshot': 'Ekran goruntusu alindi',
		'desktop.type': 'Masaustune yazildi',
		'memory.write': 'Bilgi kaydedildi',
		'memory.read': 'Bellek okundu',
	};
	return map[toolName] ?? `${formatWorkToolLabel(toolName)} tamamlandi`;
}

function getFriendlyResultCopy(block: ToolResultBlockProps['block']): Readonly<{
	readonly summary: string;
	readonly title: string;
}> {
	if (block.payload.status === 'success') {
		return {
			summary: 'Sonuc sohbet akisina eklendi.',
			title: getFriendlyToolTitle(block.payload.tool_name),
		};
	}

	return {
		summary: 'Bu adim tamamlanamadi. Gerekirse yeniden deneyebilirsin.',
		title: 'Islem tamamlanamadi',
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
			<details className={styles['toolLine']}>
				<summary className={styles['toolLineSummary']}>
					<span className={styles['toolLineIcon']} aria-hidden>
						{isSuccess ? '•' : '!'}
					</span>
					<span className={styles['toolLineLabel']}>{friendlyToolLabel}</span>
					<ChevronRight aria-hidden size={14} className={styles['toolLineChevron']} />
				</summary>
				<div className={styles['toolLineDetail']}>
					<p>{friendlySummary}</p>
				</div>
			</details>
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
