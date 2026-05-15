import type { ReactElement } from 'react';

import { uiCopy } from '../../../localization/copy.js';
import type { ApprovalResolveDecision, RenderBlock } from '../../../ws-types.js';
import { HafizaMark } from '../../ui/HafizaMark.js';
import { RunaButton } from '../../ui/RunaButton.js';
import { RunaDisclosure } from '../../ui/RunaDisclosure.js';
import { cx } from '../../ui/ui-utils.js';
import { formatWorkToolLabel } from '../workNarrationFormat.js';
import styles from './BlockRenderer.module.css';
import { type ApprovalRiskLevel, getApprovalRiskLevel } from './approvalRisk.js';

type ApprovalRenderBlock = Extract<RenderBlock, { type: 'approval_block' }>;
type ApprovalStatus = ApprovalRenderBlock['payload']['status'];

type ApprovalBlockProps = Readonly<{
	block: ApprovalRenderBlock;
	isDeveloperMode?: boolean;
	onResolveApproval?: (approvalId: string, decision: ApprovalResolveDecision) => void;
}>;

type DecisionCopy = Readonly<{
	action: string;
}>;

function normalizeText(value: string | undefined): string | null {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : null;
}

function isKnownToolName(toolName: string | null | undefined, expected: string): boolean {
	return toolName === expected;
}

const approvalToolLabels = new Set([
	'desktop.click',
	'desktop.clipboard.read',
	'desktop.clipboard.write',
	'desktop.keypress',
	'desktop.launch',
	'desktop.scroll',
	'desktop.screenshot',
	'desktop.type',
	'file.read',
	'file.write',
]);

function formatApprovalToolLabel(toolName: string | null): string | null {
	return toolName && approvalToolLabels.has(toolName) ? formatWorkToolLabel(toolName) : null;
}

function getApprovalToolName(block: ApprovalRenderBlock): string | null {
	const toolName = normalizeText(block.payload.tool_name);

	if (toolName && approvalToolLabels.has(toolName)) {
		return toolName;
	}

	const target = normalizeText(block.payload.target_label);
	return target && approvalToolLabels.has(target) ? target : toolName;
}

function getDecisionCopy(block: ApprovalRenderBlock): DecisionCopy {
	const toolName = getApprovalToolName(block);

	if (isKnownToolName(toolName, 'file.write')) {
		return { action: 'Dosyaya yazma isteği' };
	}

	if (isKnownToolName(toolName, 'file.read')) {
		return { action: 'Dosya okuma isteği' };
	}

	if (isKnownToolName(toolName, 'desktop.clipboard.read')) {
		return { action: 'Pano okuma isteği' };
	}

	if (isKnownToolName(toolName, 'desktop.clipboard.write')) {
		return { action: 'Pano yazma isteği' };
	}

	if (isKnownToolName(toolName, 'desktop.click')) {
		return { action: 'Masaüstünde tıklama isteği' };
	}

	if (isKnownToolName(toolName, 'desktop.type')) {
		return { action: 'Masaüstüne yazma isteği' };
	}

	if (isKnownToolName(toolName, 'desktop.keypress')) {
		return { action: 'Klavye kısayolu isteği' };
	}

	if (isKnownToolName(toolName, 'desktop.launch')) {
		return { action: 'Uygulama başlatma isteği' };
	}

	if (isKnownToolName(toolName, 'desktop.scroll')) {
		return { action: 'Masaüstünde kaydırma isteği' };
	}

	if (isKnownToolName(toolName, 'desktop.screenshot')) {
		return { action: 'Ekran görüntüsü alma isteği' };
	}

	switch (block.payload.action_kind) {
		case 'file_write':
			return { action: 'Dosyaya yazma isteği' };
		case 'shell_execution':
			return { action: 'Komut çalıştırma isteği' };
		case 'tool_execution':
			return { action: 'Araç çalıştırma isteği' };
	}
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

function getTargetLabel(block: ApprovalRenderBlock): string | null {
	const target = normalizeText(block.payload.target_label);
	const toolName = normalizeText(block.payload.tool_name);
	const friendlyToolLabel = formatApprovalToolLabel(toolName);

	if (!target || target === toolName || target === block.payload.action_kind) {
		return friendlyToolLabel;
	}

	return formatApprovalToolLabel(target) ?? target;
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

function getResolvedLabel(status: ApprovalStatus): string {
	switch (status) {
		case 'approved':
			return 'İzin verildi';
		case 'rejected':
			return 'Reddedildi';
		case 'cancelled':
			return 'Vazgeçildi';
		case 'expired':
			return 'Süresi doldu';
		case 'pending':
			return 'Onay bekliyor';
	}
}

function ResolvedSummary({ status }: Readonly<{ status: ApprovalStatus }>): ReactElement {
	return (
		<div className={styles['approvalResolved']}>
			<span>{getResolvedLabel(status)}</span>
		</div>
	);
}

function getApproveLabel(riskLevel: ApprovalRiskLevel): string {
	return riskLevel === 'high' ? 'Yine de devam et' : uiCopy.approval.approve;
}

export function ApprovalBlock({
	block,
	isDeveloperMode = false,
	onResolveApproval,
}: ApprovalBlockProps): ReactElement {
	const isPending = block.payload.status === 'pending';
	const decisionCopy = getDecisionCopy(block);
	const targetLabel = getTargetLabel(block);
	const riskLevel = getApprovalRiskLevel(block);
	const resolvePendingApproval = isPending ? onResolveApproval : undefined;
	const canResolvePendingApproval = Boolean(resolvePendingApproval);
	const rawRiskLevel = (block.payload as ApprovalRenderBlock['payload'] & { risk_level?: unknown })
		.risk_level;

	return (
		<article
			aria-busy={canResolvePendingApproval}
			className={cx(styles['approvalCard'], styles[`approvalCard--${riskLevel}`])}
			data-status={block.payload.status}
		>
			<header className={styles['approvalHeader']}>
				<HafizaMark
					aria-hidden
					className={styles['approvalMark']}
					variant="brand"
					weight="regular"
				/>
				<h3 className={styles['approvalTitle']}>{decisionCopy.action}</h3>
			</header>

			{targetLabel ? (
				<div className={styles['approvalTarget']}>
					<code className={styles['approvalTargetChip']}>
						{getTargetHeading(block.payload.target_kind)}: {targetLabel}
					</code>
				</div>
			) : null}

			{resolvePendingApproval ? (
				<div className={styles['approvalActions']}>
					<RunaButton
						className={styles['approvalActionButton']}
						onClick={() => resolvePendingApproval(block.payload.approval_id, 'rejected')}
						variant="secondary"
					>
						{uiCopy.approval.reject}
					</RunaButton>
					<RunaButton
						autoFocus
						className={styles['approvalActionButton']}
						onClick={() => resolvePendingApproval(block.payload.approval_id, 'approved')}
						variant={riskLevel === 'high' ? 'danger' : 'primary'}
					>
						{getApproveLabel(riskLevel)}
					</RunaButton>
				</div>
			) : (
				<ResolvedSummary status={block.payload.status} />
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
							<span>{formatStatusLabel(block.payload.status)}</span>
						</div>
						{block.payload.summary ? (
							<div className={styles['metaBox']}>
								<span className={styles['metaLabel']}>Özet</span>
								<p>{block.payload.summary}</p>
							</div>
						) : null}
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>{uiCopy.approval.action}</span>
							<span>{formatActionKind(block.payload.action_kind)}</span>
						</div>
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>Risk (resolved)</span>
							<span>{riskLevel}</span>
						</div>
						<div className={styles['metaBox']}>
							<span className={styles['metaLabel']}>Risk (raw)</span>
							<span>{typeof rawRiskLevel === 'string' ? rawRiskLevel : '-'}</span>
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
