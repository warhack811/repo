import type { CSSProperties, ReactElement, ReactNode } from 'react';

import { uiCopy } from '../../localization/copy.js';
import type { RenderBlock } from '../../ws-types.js';

type ApprovalBlock = Extract<RenderBlock, { type: 'approval_block' }>;

export type ApprovalSummaryCardProps = Readonly<{
	block: ApprovalBlock;
	children?: ReactNode;
	emphasis?: string;
	eyebrow?: string;
}>;

const cardStyle: CSSProperties = {
	borderRadius: '22px',
	border: '1px solid rgba(148, 163, 184, 0.2)',
	background:
		'linear-gradient(180deg, rgba(34, 23, 8, 0.84) 0%, rgba(12, 18, 31, 0.9) 56%, rgba(6, 11, 21, 0.92) 100%)',
	padding: '20px',
	display: 'grid',
	gap: '16px',
	minWidth: 0,
	boxShadow: '0 24px 54px rgba(2, 6, 23, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
	backdropFilter: 'blur(18px)',
	transition:
		'opacity 220ms ease, transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
};

const secondaryLabelStyle: CSSProperties = {
	fontSize: '11px',
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
	color: 'hsl(var(--color-text-soft))',
};

const detailsCardStyle: CSSProperties = {
	padding: '14px 16px',
	borderRadius: '16px',
	border: '1px solid rgba(148, 163, 184, 0.18)',
	background: 'rgba(8, 14, 24, 0.72)',
	display: 'grid',
	gap: '8px',
	minWidth: 0,
	transition: 'opacity 220ms ease, transform 220ms ease, border-color 220ms ease',
};

function getApprovalAccent(status: ApprovalBlock['payload']['status']): {
	readonly borderColor: string;
	readonly chipBackground: string;
	readonly chipColor: string;
	readonly emphasisBackground: string;
	readonly emphasisColor: string;
} {
	switch (status) {
		case 'approved':
			return {
				borderColor: 'rgba(34, 197, 94, 0.36)',
				chipBackground: 'rgba(20, 83, 45, 0.45)',
				chipColor: '#86efac',
				emphasisBackground: 'rgba(8, 34, 23, 0.72)',
				emphasisColor: '#dcfce7',
			};
		case 'rejected':
			return {
				borderColor: 'rgba(248, 113, 113, 0.36)',
				chipBackground: 'rgba(127, 29, 29, 0.42)',
				chipColor: '#fca5a5',
				emphasisBackground: 'rgba(58, 17, 17, 0.72)',
				emphasisColor: '#fee2e2',
			};
		case 'cancelled':
		case 'expired':
			return {
				borderColor: 'rgba(148, 163, 184, 0.28)',
				chipBackground: 'rgba(51, 65, 85, 0.38)',
				chipColor: '#cbd5e1',
				emphasisBackground: 'rgba(15, 23, 42, 0.68)',
				emphasisColor: '#e2e8f0',
			};
		default:
			return {
				borderColor: 'rgba(245, 158, 11, 0.38)',
				chipBackground: 'rgba(120, 53, 15, 0.44)',
				chipColor: '#fcd34d',
				emphasisBackground: 'rgba(56, 37, 7, 0.72)',
				emphasisColor: '#fef3c7',
			};
	}
}

function formatActionKind(actionKind: ApprovalBlock['payload']['action_kind']): string {
	switch (actionKind) {
		case 'file_write':
			return 'Dosya yazma';
		case 'shell_execution':
			return 'Kabuk komutu';
		case 'tool_execution':
			return 'Arac calistirma';
	}
}

function formatStatusLabel(status: ApprovalBlock['payload']['status']): string {
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

function getDefaultEmphasis(block: ApprovalBlock): string {
	switch (block.payload.status) {
		case 'approved':
			return 'Karar kaydedildi ve calisma kabul edilen yol uzerinden devam edebilir.';
		case 'rejected':
			return 'Karar kaydedildi ve bu yol reddedildigi icin calisma buradan devam edemez.';
		case 'cancelled':
			return 'Bu onay artik aktif degil.';
		case 'expired':
			return 'Bu onayin suresi doldu.';
		default:
			return uiCopy.approval.pendingEmphasis;
	}
}

export function ApprovalSummaryCard({
	block,
	children,
	emphasis,
	eyebrow = uiCopy.approval.pending,
}: ApprovalSummaryCardProps): ReactElement {
	const accent = getApprovalAccent(block.payload.status);

	return (
		<article
			style={{
				...cardStyle,
				borderColor: accent.borderColor,
				transform: 'translateY(0)',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
					gap: '12px',
					flexWrap: 'wrap',
				}}
			>
				<div style={{ display: 'grid', gap: '4px', minWidth: 0 }}>
					<span style={secondaryLabelStyle}>{eyebrow}</span>
					<strong style={{ fontSize: '18px', color: 'hsl(var(--color-text))' }}>
						{block.payload.title}
					</strong>
				</div>
				<span
					style={{
						padding: '5px 11px',
						borderRadius: '999px',
						background: accent.chipBackground,
						border: `1px solid ${accent.borderColor}`,
						color: accent.chipColor,
						fontSize: '11px',
						fontWeight: 700,
						letterSpacing: '0.08em',
						textTransform: 'uppercase',
					}}
				>
					{formatStatusLabel(block.payload.status)}
				</span>
			</div>

			<div style={{ color: 'hsl(var(--color-text))', lineHeight: 1.7 }}>
				{block.payload.summary}
			</div>

			<div
				style={{
					padding: '14px 16px',
					borderRadius: '16px',
					background: accent.emphasisBackground,
					color: accent.emphasisColor,
					lineHeight: 1.6,
					boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.03)',
				}}
			>
				{emphasis ?? getDefaultEmphasis(block)}
			</div>

			<details style={detailsCardStyle}>
				<summary
					style={{
						cursor: 'pointer',
						color: 'hsl(var(--color-text))',
						fontWeight: 600,
						transition: 'opacity 180ms ease, transform 180ms ease',
					}}
				>
					{uiCopy.approval.details}
				</summary>
				<div style={{ display: 'grid', gap: '10px' }}>
					<div>
						<div style={secondaryLabelStyle}>{uiCopy.approval.action}</div>
						<div style={{ color: 'hsl(var(--color-text))' }}>
							{formatActionKind(block.payload.action_kind)}
						</div>
					</div>
					{block.payload.tool_name ? (
						<div>
							<div style={secondaryLabelStyle}>{uiCopy.approval.tool}</div>
							<code style={{ color: '#fde68a', fontSize: '12px' }}>{block.payload.tool_name}</code>
						</div>
					) : null}
					{block.payload.call_id ? (
						<div>
							<div style={secondaryLabelStyle}>{uiCopy.approval.callId}</div>
							<code style={{ color: 'hsl(var(--color-text-muted))', fontSize: '12px' }}>
								{block.payload.call_id}
							</code>
						</div>
					) : null}
					{block.payload.note ? (
						<div>
							<div style={secondaryLabelStyle}>{uiCopy.approval.note}</div>
							<div style={{ color: 'hsl(var(--color-text-muted))', lineHeight: 1.6 }}>
								{block.payload.note}
							</div>
						</div>
					) : null}
				</div>
			</details>

			{children}
		</article>
	);
}
