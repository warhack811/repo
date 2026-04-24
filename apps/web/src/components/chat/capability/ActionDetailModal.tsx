import type {
	CSSProperties,
	DialogHTMLAttributes,
	MouseEvent,
	ReactElement,
	ReactNode,
} from 'react';
import { useId } from 'react';

import { designTokens } from '../../../lib/design-tokens.js';
import { RunaButton } from '../../ui/index.js';
import { ActionRiskBadge } from './ActionRiskBadge.js';
import { CapabilityResultActions } from './CapabilityResultActions.js';
import type {
	ActionDetailItem,
	ActionRiskLevel,
	CapabilityResultAction,
	CapabilityTone,
} from './types.js';

export type ActionDetailModalProps = Readonly<
	Omit<DialogHTMLAttributes<HTMLDialogElement>, 'children' | 'open' | 'title'> & {
		actions?: readonly CapabilityResultAction[];
		children?: ReactNode;
		description?: ReactNode;
		details?: readonly ActionDetailItem[];
		isOpen: boolean;
		onClose: () => void;
		riskLevel?: ActionRiskLevel;
		title: ReactNode;
	}
>;

const overlayStyle: CSSProperties = {
	alignItems: 'center',
	background: 'rgba(2, 6, 23, 0.74)',
	display: 'flex',
	inset: 0,
	justifyContent: 'center',
	padding: 'clamp(16px, 4vw, 32px)',
	position: 'fixed',
	zIndex: designTokens.zIndex.modal,
};

const dialogStyle: CSSProperties = {
	background: designTokens.color.background.panelStrong,
	border: `1px solid ${designTokens.color.border.strong}`,
	borderRadius: designTokens.radius.card,
	boxShadow: designTokens.shadow.panel,
	boxSizing: 'border-box',
	color: designTokens.color.foreground.text,
	display: 'grid',
	gap: designTokens.spacing.lg,
	margin: 0,
	maxHeight: 'min(86vh, 780px)',
	maxWidth: 'min(760px, 100%)',
	minWidth: 'min(640px, 100%)',
	overflow: 'auto',
	padding: designTokens.spacing.panel,
	position: 'relative',
	width: '100%',
};

const headerStyle: CSSProperties = {
	alignItems: 'flex-start',
	display: 'flex',
	gap: designTokens.spacing.md,
	justifyContent: 'space-between',
	minWidth: 0,
};

const titleStackStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.xs,
	minWidth: 0,
};

const titleRowStyle: CSSProperties = {
	alignItems: 'center',
	display: 'flex',
	flexWrap: 'wrap',
	gap: designTokens.spacing.sm,
};

const titleStyle: CSSProperties = {
	color: designTokens.color.foreground.strong,
	fontSize: '18px',
	lineHeight: 1.35,
	margin: 0,
};

const descriptionStyle: CSSProperties = {
	color: designTokens.color.foreground.muted,
	fontSize: designTokens.typography.text.fontSize,
	lineHeight: designTokens.typography.text.lineHeight,
	margin: 0,
};

const detailListStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.sm,
};

const detailItemBaseStyle: CSSProperties = {
	background: 'rgba(7, 11, 20, 0.56)',
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.soft,
	display: 'grid',
	gap: designTokens.spacing.xs,
	padding: designTokens.spacing.md,
};

const detailLabelStyle: CSSProperties = {
	...designTokens.typography.label,
	color: designTokens.color.foreground.soft,
};

const detailValueStyle: CSSProperties = {
	color: designTokens.color.foreground.text,
	lineHeight: designTokens.typography.text.lineHeight,
	whiteSpace: 'pre-wrap',
	wordBreak: 'break-word',
};

const footerStyle: CSSProperties = {
	alignItems: 'center',
	display: 'flex',
	flexWrap: 'wrap',
	gap: designTokens.spacing.md,
	justifyContent: 'space-between',
};

const detailToneBorderStyles: Record<CapabilityTone, CSSProperties> = {
	danger: {
		borderColor: designTokens.color.border.danger,
	},
	info: {
		borderColor: designTokens.color.border.info,
	},
	neutral: {
		borderColor: designTokens.color.border.soft,
	},
	success: {
		borderColor: designTokens.color.border.success,
	},
	warning: {
		borderColor: designTokens.color.border.warning,
	},
};

export function ActionDetailModal({
	actions = [],
	children,
	className,
	description,
	details = [],
	isOpen,
	onClose,
	riskLevel,
	style,
	title,
	...dialogProps
}: ActionDetailModalProps): ReactElement | null {
	const titleId = useId();
	const descriptionId = useId();

	if (!isOpen) {
		return null;
	}

	const hasActions = actions.length > 0;

	function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>): void {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	return (
		<div
			className="runa-action-detail-modal-overlay"
			onMouseDown={handleOverlayMouseDown}
			style={overlayStyle}
		>
			<dialog
				{...dialogProps}
				aria-describedby={description ? descriptionId : dialogProps['aria-describedby']}
				aria-labelledby={titleId}
				aria-modal="true"
				className={['runa-action-detail-modal', className].filter(Boolean).join(' ')}
				open={true}
				style={{ ...dialogStyle, ...style }}
			>
				<div style={headerStyle}>
					<div style={titleStackStyle}>
						<div style={titleRowStyle}>
							<h2 id={titleId} style={titleStyle}>
								{title}
							</h2>
							{riskLevel ? <ActionRiskBadge riskLevel={riskLevel} /> : null}
						</div>
						{description ? (
							<p id={descriptionId} style={descriptionStyle}>
								{description}
							</p>
						) : null}
					</div>
					<RunaButton onClick={onClose} type="button" variant="ghost">
						Close
					</RunaButton>
				</div>
				{details.length > 0 ? (
					<dl style={detailListStyle}>
						{details.map((detail) => (
							<div
								key={detail.id}
								style={{
									...detailItemBaseStyle,
									...detailToneBorderStyles[detail.tone ?? 'neutral'],
								}}
							>
								<dt style={detailLabelStyle}>{detail.label}</dt>
								<dd style={detailValueStyle}>{detail.value}</dd>
							</div>
						))}
					</dl>
				) : null}
				{children}
				{hasActions ? (
					<div style={footerStyle}>
						<RunaButton onClick={onClose} type="button" variant="ghost">
							Dismiss
						</RunaButton>
						<CapabilityResultActions actions={actions} />
					</div>
				) : null}
			</dialog>
		</div>
	);
}
