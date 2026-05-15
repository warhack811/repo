import type { ReactNode } from 'react';

import type { ApprovalResolveDecision, RenderBlock } from '../../../ws-types.js';
import { type ApprovalRiskLevel, getApprovalRiskLevel } from '../blocks/approvalRisk.js';
import { getFriendlyErrorMessage } from '../blocks/errorCopy.js';
import {
	formatWorkDetail,
	formatWorkStateLabel,
	formatWorkSummary,
	formatWorkTimelineLabel,
	formatWorkToolLabel,
} from '../workNarrationFormat.js';

export type RunActivityStatus =
	| 'approved'
	| 'cancelled'
	| 'error'
	| 'expired'
	| 'pending'
	| 'rejected'
	| 'running'
	| 'success'
	| 'warning';

type TimelineBlock = Extract<RenderBlock, { type: 'run_timeline_block' }>;
type ToolResultBlock = Extract<RenderBlock, { type: 'tool_result' }>;
type ApprovalBlock = Extract<RenderBlock, { type: 'approval_block' }>;
type ApprovalStatus = ApprovalBlock['payload']['status'];

export type RunActivityRow =
	| {
			readonly kind: 'timeline';
			readonly id: string;
			readonly title: string;
			readonly detail?: string;
			readonly status: RunActivityStatus;
			readonly developerDetail?: ReactNode;
	  }
	| {
			readonly kind: 'tool';
			readonly id: string;
			readonly title: string;
			readonly detail?: string;
			readonly status: RunActivityStatus;
			readonly command?: string;
			readonly developerDetail?: ReactNode;
			readonly durationMs?: number;
			readonly exitCode?: number | string;
			readonly preview?: string;
			readonly stderr?: string;
			readonly stdout?: string;
			readonly toolName?: string;
	  }
	| {
			readonly kind: 'approval';
			readonly id: string;
			readonly approvalId: string;
			readonly title: string;
			readonly detail?: string;
			readonly status: ApprovalStatus;
			readonly canResolve: boolean;
			readonly developerDetail?: ReactNode;
			readonly riskLabel?: string;
			readonly riskLevel: ApprovalRiskLevel;
			readonly summary?: string;
			readonly targetLabel?: string;
			readonly toolName?: string;
	  };

type ToolResultTechnicalPayload = ToolResultBlock['payload'] & {
	readonly command?: unknown;
	readonly command_line?: unknown;
	readonly duration_ms?: unknown;
	readonly exit_code?: unknown;
	readonly stderr?: unknown;
	readonly stdout?: unknown;
};

function asText(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

function asExitCode(value: unknown): number | string | undefined {
	if (typeof value === 'number' || typeof value === 'string') {
		return value;
	}

	return undefined;
}

function asDurationMs(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeComparableText(value: string | undefined): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const normalized = value.trim().toLowerCase();
	return normalized.length > 0 ? normalized : undefined;
}

function mapTimelineStatus(item: TimelineBlock['payload']['items'][number]): RunActivityStatus {
	const state = item.state?.toLowerCase();

	if (state === 'error' || state === 'failed') {
		return 'error';
	}

	if (state === 'success' || state === 'completed') {
		return 'success';
	}

	if (state === 'warning' || state === 'paused') {
		return 'warning';
	}

	if (state === 'pending' || state === 'requested') {
		return 'pending';
	}

	if (state === 'approved') {
		return 'approved';
	}

	if (state === 'rejected') {
		return 'rejected';
	}

	switch (item.kind) {
		case 'run_failed':
		case 'tool_failed':
			return 'error';
		case 'approval_requested':
			return 'pending';
		case 'approval_resolved':
		case 'assistant_completed':
		case 'model_completed':
		case 'tool_completed':
			return 'success';
		default:
			return 'running';
	}
}

function getApprovalActionSummary(block: ApprovalBlock): string {
	const toolName = resolveApprovalToolName(block);

	if (toolName === 'file.write') {
		return 'Dosyaya yazma izni gerekiyor.';
	}

	if (toolName === 'file.read') {
		return 'Dosya okuma izni gerekiyor.';
	}

	if (toolName === 'desktop.click') {
		return 'Masaüstünde tıklama izni gerekiyor.';
	}

	if (toolName === 'desktop.type') {
		return 'Masaüstünde yazma izni gerekiyor.';
	}

	if (toolName === 'desktop.keypress') {
		return 'Masaüstü kısayolu çalıştırma izni gerekiyor.';
	}

	if (toolName === 'desktop.scroll') {
		return 'Masaüstünde kaydırma izni gerekiyor.';
	}

	if (toolName === 'desktop.screenshot') {
		return 'Masaüstü görüntüsü alma izni gerekiyor.';
	}

	if (toolName === 'desktop.clipboard.read') {
		return 'Pano okuma izni gerekiyor.';
	}

	if (toolName === 'desktop.clipboard.write') {
		return 'Panoya yazma izni gerekiyor.';
	}

	if (toolName === 'shell.exec' || toolName === 'shell.session.start') {
		return 'Komut çalıştırma izni gerekiyor.';
	}

	switch (block.payload.action_kind) {
		case 'file_write':
			return 'Dosyaya yazma izni gerekiyor.';
		case 'shell_execution':
			return 'Komut çalıştırma izni gerekiyor.';
		case 'tool_execution':
			if (block.payload.tool_name?.startsWith('desktop.')) {
				return 'Masaüstünde işlem yapma izni gerekiyor.';
			}
			return 'Araç çalıştırma izni gerekiyor.';
	}
}

function getApprovalTargetLabel(block: ApprovalBlock): string | undefined {
	const targetLabel = asText(block.payload.target_label);

	if (targetLabel?.includes('/') || targetLabel?.includes('\\')) {
		return targetLabel;
	}

	if (targetLabel) {
		return formatWorkToolLabel(targetLabel);
	}

	const toolName = resolveApprovalToolName(block);
	if (toolName) {
		return formatWorkToolLabel(toolName);
	}

	return undefined;
}

function resolveApprovalToolName(block: ApprovalBlock): string | undefined {
	const directToolName = block.payload.tool_name;
	if (directToolName) {
		return directToolName;
	}

	const targetLabel = asText(block.payload.target_label);
	if (targetLabel?.includes('.')) {
		return targetLabel;
	}

	return undefined;
}

function getApprovalResolvedTitle(status: ApprovalStatus): string {
	switch (status) {
		case 'approved':
			return 'İzin verildi';
		case 'rejected':
			return 'Reddedildi';
		case 'expired':
			return 'Süresi doldu';
		case 'cancelled':
			return 'Vazgeçildi';
		case 'pending':
			return 'İzin gerekiyor';
	}
}

function getApprovalRiskLabel(level: ApprovalRiskLevel): string {
	switch (level) {
		case 'high':
			return 'Yüksek risk';
		case 'medium':
			return 'Orta risk';
		case 'low':
			return 'Düşük risk';
	}
}

export function adaptRunTimelineBlock(
	block: TimelineBlock,
	isDeveloperMode: boolean,
): readonly RunActivityRow[] {
	return block.payload.items.map((item, index) => {
		const detail =
			item.user_summary_tr ??
			formatWorkDetail(item.detail) ??
			formatWorkDetail(item.label) ??
			undefined;
		const developerDetail =
			isDeveloperMode && (item.call_id || item.tool_name || item.state)
				? [
						item.tool_name ? `Araç: ${item.tool_name}` : null,
						item.call_id ? `Çağrı: ${item.call_id}` : null,
						item.state ? `Durum: ${formatWorkStateLabel(item.state)}` : null,
					]
						.filter((value): value is string => value !== null)
						.join('\n')
				: undefined;

		return {
			developerDetail,
			detail,
			id: `${block.id}:timeline:${index}`,
			kind: 'timeline',
			status: mapTimelineStatus(item),
			title: formatWorkTimelineLabel(item.label),
		};
	});
}

export function adaptToolResultBlock(
	block: ToolResultBlock,
	isDeveloperMode: boolean,
): RunActivityRow {
	const technicalPayload = block.payload as ToolResultTechnicalPayload;
	const toolLabel = block.payload.user_label_tr ?? formatWorkToolLabel(block.payload.tool_name);
	const status: RunActivityStatus = block.payload.status === 'success' ? 'success' : 'error';
	const detail =
		block.payload.user_summary_tr ??
		formatWorkDetail(block.payload.summary) ??
		(block.payload.status === 'error'
			? getFriendlyErrorMessage(block.payload)
			: formatWorkSummary(block.payload.summary));

	const command = asText(technicalPayload.command) ?? asText(technicalPayload.command_line);
	const stdout = asText(technicalPayload.stdout);
	const stderr = asText(technicalPayload.stderr);
	const exitCode = asExitCode(technicalPayload.exit_code);
	const durationMs = asDurationMs(technicalPayload.duration_ms);
	const rawPreview = asText(block.payload.result_preview?.summary_text);
	const normalizedPreview = normalizeComparableText(rawPreview);
	const normalizedSummary = normalizeComparableText(block.payload.summary);
	const normalizedDetail = normalizeComparableText(detail);
	const preview =
		normalizedPreview &&
		(normalizedPreview === normalizedSummary || normalizedPreview === normalizedDetail)
			? undefined
			: rawPreview;
	const developerDetail = isDeveloperMode
		? [`Araç: ${block.payload.tool_name}`, `Çağrı: ${block.payload.call_id}`].join('\n')
		: undefined;

	return {
		command,
		developerDetail,
		detail,
		durationMs,
		exitCode,
		id: block.id,
		kind: 'tool',
		preview,
		status,
		stderr,
		stdout,
		title: status === 'success' ? `${toolLabel} tamamlandı` : `${toolLabel} tamamlanamadı`,
		toolName: block.payload.tool_name,
	};
}

export function adaptApprovalBlock(
	block: ApprovalBlock,
	isDeveloperMode: boolean,
	canResolvePendingApproval: boolean,
): RunActivityRow {
	const riskLevel = getApprovalRiskLevel(block);
	const title =
		block.payload.status === 'pending'
			? 'İzin gerekiyor'
			: getApprovalResolvedTitle(block.payload.status);
	const detail = block.payload.user_summary_tr ?? getApprovalActionSummary(block);
	const targetLabel = getApprovalTargetLabel(block);
	const developerDetail = isDeveloperMode
		? [
				`Araç: ${block.payload.tool_name ?? '-'}`,
				`Çağrı: ${block.payload.call_id ?? '-'}`,
				`Aksiyon: ${block.payload.action_kind}`,
				`Ham durum: ${block.payload.status}`,
			].join('\n')
		: undefined;

	return {
		approvalId: block.payload.approval_id,
		canResolve: canResolvePendingApproval,
		developerDetail,
		detail,
		id: block.id,
		kind: 'approval',
		riskLabel: getApprovalRiskLabel(riskLevel),
		riskLevel,
		status: block.payload.status,
		summary: isDeveloperMode
			? (formatWorkDetail(block.payload.summary) ?? block.payload.summary)
			: undefined,
		targetLabel,
		title,
		toolName: block.payload.tool_name,
	};
}
