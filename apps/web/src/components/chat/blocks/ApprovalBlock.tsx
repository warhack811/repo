import { Check, X } from 'lucide-react';
import type { ReactElement } from 'react';

import { uiCopy } from '../../../localization/copy.js';
import type { ApprovalResolveDecision, RenderBlock } from '../../../ws-types.js';
import type { RunaButtonVariant } from '../../ui/RunaButton.js';
import { RunaButton } from '../../ui/RunaButton.js';
import { RunaDisclosure } from '../../ui/RunaDisclosure.js';
import { cx } from '../../ui/ui-utils.js';
import styles from './BlockRenderer.module.css';

type ApprovalRenderBlock = Extract<RenderBlock, { type: 'approval_block' }>;
type ApprovalStatus = ApprovalRenderBlock['payload']['status'];

type ApprovalBlockProps = Readonly<{
	block: ApprovalRenderBlock;
	isDeveloperMode?: boolean;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
}>;

type DecisionCopy = Readonly<{
	action: string;
	outcome: string;
	risk: string;
}>;

function normalizeText(value: string | undefined): string | null {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : null;
}

function isKnownToolName(
	toolName: ApprovalRenderBlock['payload']['tool_name'],
	expected: string,
): boolean {
	return toolName === expected;
}

function getDecisionCopy(block: ApprovalRenderBlock): DecisionCopy {
	if (isKnownToolName(block.payload.tool_name, 'file.write')) {
		return {
			action: 'Dosyaya yazma isteği',
			outcome: 'Onaylarsan yazma adımı çalışır ve sohbet akışı devam eder.',
			risk: 'Bu işlem bir dosyanın içeriğini değiştirebilir.',
		};
	}

	if (isKnownToolName(block.payload.tool_name, 'file.read')) {
		return {
			action: 'Dosya okuma isteği',
			outcome: 'Onaylarsan dosya okunur ve sonuç sohbet akışına eklenir.',
			risk: 'Bu işlem dosya içeriğini okuyabilir; dosyayı değiştirmez.',
		};
	}

	if (isKnownToolName(block.payload.tool_name, 'desktop.screenshot')) {
		return {
			action: 'Ekran görüntüsü alma isteği',
			outcome: 'Onaylarsan mevcut ekrandan görüntü alınır ve sonuç paylaşılır.',
			risk: 'Ekrandaki görünür bilgiler yakalanabilir.',
		};
	}

	switch (block.payload.action_kind) {
		case 'file_write':
			return {
				action: 'Dosyaya yazma isteği',
				outcome: 'Onaylarsan yazma adımı çalışır ve sohbet akışı devam eder.',
				risk: 'Bu işlem bir dosyanın içeriğini değiştirebilir.',
			};
		case 'shell_execution':
			return {
				action: 'Komut çalıştırma isteği',
				outcome: 'Onaylarsan komut çalışır ve sonuç sohbet akışına eklenir.',
				risk: 'Komutlar sistemde yan etki oluşturabilir; hedefi kontrol et.',
			};
		case 'tool_execution':
			return {
				action: 'Araç çalıştırma isteği',
				outcome: 'Onaylarsan adım çalışır ve sonuç güncellenir.',
				risk: 'Bu adım izin gerektiriyor; ayrıntıları kontrol edebilirsin.',
			};
	}
}

function getApprovalActionVariant(block: ApprovalRenderBlock): RunaButtonVariant {
	if (isKnownToolName(block.payload.tool_name, 'file.read')) {
		return 'primary';
	}

	return 'secondary';
}

function formatActionKind(actionKind: ApprovalRenderBlock['payload']['action_kind']): string {
	switch (actionKind) {
		case 'file_write':
			return 'Dosyaya yazma';
		case 'shell_execution':
			return 'Komut çalıştırma';
		case 'tool_execution':
			return 'Araç çalıştırma';
	}
}

function formatStatusLabel(status: ApprovalStatus): string {
	switch (status) {
		case 'approved':
			return uiCopy.approval.approved;
		case 'cancelled':
			return uiCopy.approval.cancelled;
		case 'expired':
			return uiCopy.approval.expired;
		case 'pending':
			return uiCopy.approval.pending;
		case 'rejected':
			return uiCopy.approval.rejected;
	}
}

function getStatusClassName(status: ApprovalStatus): string | undefined {
	switch (status) {
		case 'approved':
			return styles['approvalApproved'];
		case 'rejected':
			return styles['approvalRejected'];
		case 'cancelled':
		case 'expired':
			return styles['approvalClosed'];
		case 'pending':
			return styles['approvalPending'];
	}
}

function getStateMessage(status: ApprovalStatus): string {
	switch (status) {
		case 'approved':
			return 'İzin verildi. Akış devam ediyor.';
		case 'rejected':
			return 'Bu adım reddedildi. İşlem çalıştırılmadı.';
		case 'cancelled':
			return 'Bu onay artık aktif değil.';
		case 'expired':
			return 'Bu onayın süresi doldu; yeniden istek gerekebilir.';
		case 'pending':
			return 'Devam etmek için kararın bekleniyor.';
	}
}

function getTargetLabel(block: ApprovalRenderBlock): string {
	const target = normalizeText(block.payload.target_label);
	const toolName = normalizeText(block.payload.tool_name);
	const internalTargetLabels = new Set(['file.write', 'file.read', 'desktop.screenshot']);

	if (
		!target ||
		target === toolName ||
		target === block.payload.action_kind ||
		internalTargetLabels.has(target)
	) {
		return 'Bu onayda net hedef bilgisi gönderilmedi.';
	}

	return target;
}

function getTargetHeading(targetKind: ApprovalRenderBlock['payload']['target_kind']): string {
	switch (targetKind) {
		case 'file_path':
			return 'Hedef dosya';
		case 'shell_command':
			return 'Hedef komut';
		case 'tool_call':
			return 'Hedef';
		default:
			return 'Hedef';
	}
}

function shouldShowOriginalTitle(block: ApprovalRenderBlock, decisionCopy: DecisionCopy): boolean {
	const title = normalizeText(block.payload.title);
	return Boolean(title && title !== decisionCopy.action && title !== 'Runa şunu yapmak istiyor');
}

export function ApprovalBlock({
	block,
	isDeveloperMode = false,
	onResolveApproval,
}: ApprovalBlockProps): ReactElement {
	const isPending = block.payload.status === 'pending';
	const createdAtLabel = new Date(block.created_at).toLocaleString('tr-TR');
	const decisionCopy = getDecisionCopy(block);
	const statusLabel = formatStatusLabel(block.payload.status);
	const summary = normalizeText(block.payload.summary);
	const targetLabel = getTargetLabel(block);
	const approveVariant = getApprovalActionVariant(block);

	return (
		<article
			aria-busy={isPending}
			className={cx(
				styles['block'],
				styles['approvalCard'],
				getStatusClassName(block.payload.status),
			)}
		>
			<div className={styles['approvalHeader']}>
				<div className={styles['headerStack']}>
					<span className={styles['eyebrow']}>Güven kararı</span>
					<strong className={styles['approvalTitle']}>{decisionCopy.action}</strong>
				</div>
				<span className={styles['approvalStatusChip']}>{statusLabel}</span>
			</div>

			{targetLabel ? (
				<div className={styles['approvalInlineTarget']}>
					<span className={styles['metaLabel']}>{getTargetHeading(block.payload.target_kind)}</span>
					<span className={styles['approvalValue']}>{targetLabel}</span>
					<span className={styles['approvalRisk']}>{decisionCopy.risk}</span>
				</div>
			) : (
				<p className={styles['approvalRisk']}>{decisionCopy.risk}</p>
			)}

			<output aria-live="polite" className={styles['approvalStateFeedback']}>
				{getStateMessage(block.payload.status)}
			</output>

			{isPending && onResolveApproval ? (
				<div className={styles['approvalActions']}>
					<RunaButton
						aria-label={`Onayla: ${decisionCopy.action}`}
						className={styles['approvalActionButton']}
						onClick={() => onResolveApproval(block.payload.approval_id, 'approved')}
						variant={approveVariant}
					>
						<Check size={16} />
						{uiCopy.approval.approve}
					</RunaButton>
					<RunaButton
						aria-label={`Reddet: ${decisionCopy.action}`}
						className={styles['approvalActionButton']}
						onClick={() => onResolveApproval(block.payload.approval_id, 'rejected')}
						variant="secondary"
					>
						<X size={16} />
						{uiCopy.approval.reject}
					</RunaButton>
				</div>
			) : (
				<p className={styles['muted']}>
					{createdAtLabel} tarihinde {statusLabel.toLocaleLowerCase('tr-TR')}.
				</p>
			)}
			{isDeveloperMode ? (
				<RunaDisclosure title={uiCopy.approval.details}>
					<div className={styles['metaGrid']}>
						{shouldShowOriginalTitle(block, decisionCopy) ? (
							<div className={styles['metaBox']}>
								<span className={styles['metaLabel']}>Orijinal istek</span>
								<span>{block.payload.title}</span>
							</div>
						) : null}
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>Sonuç</span>
							<span>{decisionCopy.outcome}</span>
						</div>
						{summary ? (
							<div className={styles['metaBox']}>
								<span className={styles['metaLabel']}>Özet</span>
								<p>{summary}</p>
							</div>
						) : null}
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>{uiCopy.approval.action}</span>
							<span>{formatActionKind(block.payload.action_kind)}</span>
						</div>
						{block.payload.target_label ? (
							<div className={styles['metaBox']}>
								<span className={styles['metaLabel']}>Ham hedef</span>
								<span>{block.payload.target_label}</span>
							</div>
						) : null}
						{block.payload.tool_name ? (
							<div className={styles['metaBox']}>
								<span className={styles['metaLabel']}>{uiCopy.approval.tool}</span>
								<code>{block.payload.tool_name}</code>
							</div>
						) : null}
						{block.payload.call_id ? (
							<div className={styles['metaBox']}>
								<span className={styles['metaLabel']}>{uiCopy.approval.callId}</span>
								<code>{block.payload.call_id}</code>
							</div>
						) : null}
						{block.payload.note ? (
							<div className={styles['metaBox']}>
								<span className={styles['metaLabel']}>{uiCopy.approval.note}</span>
								<span>{block.payload.note}</span>
							</div>
						) : null}
					</div>
				</RunaDisclosure>
			) : null}
		</article>
	);
}
