import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';
import type { BlockComponentProps } from './block-types.js';
import {
	getPresentationBlockDomId,
	getPresentationBlockSummaryDomId,
	getPresentationBlockTitleDomId,
	renderInspectionAction,
	renderInspectionCorrelationContext,
} from './block-utils.js';

type RunTimelineBlockProps = BlockComponentProps<
	Extract<RenderBlock, { type: 'run_timeline_block' }>
> &
	Readonly<{
		isDeveloperMode?: boolean;
	}>;

const technicalToolLabels = new Map<string, string>([
	['agent.delegate', 'Alt görev'],
	['browser.click', 'Tarayıcı tıklaması'],
	['browser.extract', 'Sayfa okuma'],
	['browser.fill', 'Form doldurma'],
	['browser.navigate', 'Tarayıcı gezintisi'],
	['desktop.click', 'Masaüstü tıklaması'],
	['desktop.clipboard.read', 'Pano okuma'],
	['desktop.clipboard.write', 'Pano yazma'],
	['desktop.keypress', 'Klavye kısayolu'],
	['desktop.launch', 'Uygulama başlatma'],
	['desktop.scroll', 'Masaüstü kaydırma'],
	['desktop.screenshot', 'Ekran görüntüsü'],
	['desktop.type', 'Masaüstüne yazma'],
	['desktop.verify_state', 'Masaüstü doğrulama'],
	['desktop.vision_analyze', 'Ekran analizi'],
	['edit.patch', 'Kod değişikliği'],
	['file.list', 'Dosya listeleme'],
	['file.read', 'Dosya okuma'],
	['file.write', 'Dosya yazma'],
	['file.share', 'Dosya paylaşımı'],
	['file.watch', 'Dosya takibi'],
	['git.diff', 'Değişiklik inceleme'],
	['git.status', 'Git durum kontrolü'],
	['memory.delete', 'Bellek silme'],
	['memory.list', 'Bellek listeleme'],
	['memory.save', 'Belleğe kaydetme'],
	['memory.search', 'Bellek araması'],
	['search.codebase', 'Kod arama'],
	['search.grep', 'Dosya arama'],
	['search.memory', 'Bellek araması'],
	['shell.exec', 'Terminal komutu'],
	['web.search', 'Web arama'],
]);

function formatTimelineToolLabel(toolName: string): string {
	return technicalToolLabels.get(toolName) ?? toolName.replace(/\./gu, ' ');
}

function formatTimelineDetail(detail: string): string {
	let formattedDetail = detail;

	for (const [technicalLabel, friendlyLabel] of technicalToolLabels) {
		formattedDetail = formattedDetail.replaceAll(technicalLabel, friendlyLabel);
	}

	return formattedDetail;
}

function formatTimelineState(state: string): string {
	switch (state) {
		case 'active':
			return 'sürüyor';
		case 'approved':
			return 'onaylandı';
		case 'completed':
		case 'success':
			return 'tamamlandı';
		case 'error':
		case 'failed':
			return 'hata';
		case 'pending':
			return 'bekliyor';
		case 'rejected':
			return 'reddedildi';
		case 'requested':
			return 'isteniyor';
		default:
			return state;
	}
}

export function RunTimelineBlock({
	block,
	getInspectionActionState,
	isDeveloperMode = false,
	onRequestInspection,
	presentationCorrelationLabel,
}: RunTimelineBlockProps): ReactElement {
	return (
		<article
			aria-describedby={getPresentationBlockSummaryDomId(block.id)}
			aria-labelledby={getPresentationBlockTitleDomId(block.id)}
			className={styles['block']}
			id={getPresentationBlockDomId(block.id)}
			tabIndex={-1}
		>
			<div className={styles['header']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Canlı çalışma notları</span>
					<h3 className={styles['title']} id={getPresentationBlockTitleDomId(block.id)}>
						{block.payload.title}
					</h3>
				</div>
				{isDeveloperMode
					? renderInspectionAction(
							block,
							'timeline',
							onRequestInspection,
							getInspectionActionState,
						)
					: null}
			</div>
			<p className={styles['summary']} id={getPresentationBlockSummaryDomId(block.id)}>
				{block.payload.summary}
			</p>
			{isDeveloperMode
				? renderInspectionCorrelationContext(presentationCorrelationLabel ?? null)
				: null}
			<div className={styles['grid']}>
				{block.payload.items.map((item, index) => (
					<div className={styles['metaBox']} key={`${block.id}:${index}:${item.kind}`}>
						<div className={styles['header']}>
							<strong>{item.label}</strong>
							{item.state ? (
								<span className={styles['chip']}>{formatTimelineState(item.state)}</span>
							) : null}
						</div>
						{item.detail ? (
							<p className={styles['summary']}>{formatTimelineDetail(item.detail)}</p>
						) : null}
						<div className={styles['chipRow']}>
							{item.tool_name ? (
								<span className={styles['chip']}>{formatTimelineToolLabel(item.tool_name)}</span>
							) : null}
							{isDeveloperMode && item.call_id ? (
								<code className={styles['chip']}>{item.call_id}</code>
							) : null}
						</div>
					</div>
				))}
			</div>
		</article>
	);
}
