import { AlertTriangle, ChevronRight } from 'lucide-react';
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
import { getFriendlyErrorMessage } from './errorCopy.js';

type ToolResultBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'tool_result' }>;
	isDeveloperMode?: boolean;
}>;

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

function resolveToolLabel(block: ToolResultBlockProps['block']): string {
	return (
		block.payload.user_label_tr ??
		formatWorkToolLabel(block.payload.tool_name) ??
		block.payload.tool_name ??
		'İşlem'
	);
}

function getFriendlyOutputSummary(block: ToolResultBlockProps['block']): string {
	const preview = normalizeText(block.payload.result_preview?.summary_text);
	const summary = normalizeText(block.payload.summary);
	const selected =
		preview && !isTechnicalPreview(preview)
			? preview
			: (summary ?? preview ?? 'SonuÃ§ sohbet akÄ±ÅŸÄ±na eklendi.');
	const formatted = formatWorkDetail(selected);

	return formatted ?? 'SonuÃ§ sohbet akÄ±ÅŸÄ±na eklendi.';
}

function getDeveloperErrorText(block: ToolResultBlockProps['block']): string | undefined {
	if (block.payload.status !== 'error') {
		return undefined;
	}

	if (block.payload.error_code && block.payload.error_message) {
		return `${block.payload.error_code}: ${block.payload.error_message}`;
	}

	if (block.payload.error_code) {
		return block.payload.error_code;
	}

	return block.payload.error_message;
}

export function ToolResultBlock({
	block,
	isDeveloperMode = false,
}: ToolResultBlockProps): ReactElement {
	const isSuccess = block.payload.status === 'success';
	const friendlyToolLabel = resolveToolLabel(block);

	if (!isDeveloperMode && !isSuccess) {
		return (
			<details className={styles['toolLine']}>
				<summary className={styles['toolLineSummary']}>
					<span className={styles['toolLineIcon']} aria-hidden>
						<AlertTriangle size={12} />
					</span>
					<span className={styles['toolLineLabel']}>{friendlyToolLabel} tamamlanamadÄ±</span>
					<ChevronRight aria-hidden size={14} className={styles['toolLineChevron']} />
				</summary>
				<div className={styles['toolLineDetail']}>
					<p>{getFriendlyErrorMessage(block.payload)}</p>
				</div>
			</details>
		);
	}

	if (!isDeveloperMode) {
		return (
			<details className={styles['toolLine']}>
				<summary className={styles['toolLineSummary']}>
					<span className={styles['toolLineIcon']} aria-hidden>
						â€¢
					</span>
					<span className={styles['toolLineLabel']}>{friendlyToolLabel}</span>
					<ChevronRight aria-hidden size={14} className={styles['toolLineChevron']} />
				</summary>
				<div className={styles['toolLineDetail']}>
					<p>{getFriendlyOutputSummary(block)}</p>
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
					errorText={getDeveloperErrorText(block)}
					output={isSuccess ? (block.payload.result_preview ?? block.payload.summary) : undefined}
				/>
			</ToolContent>
		</Tool>
	);
}


