import type { DialogHTMLAttributes, MouseEvent, ReactElement, ReactNode } from 'react';
import { useId } from 'react';
import { RunaButton } from '../../ui/RunaButton.js';
import { ActionRiskBadge } from './ActionRiskBadge.js';
import { CapabilityResultActions } from './CapabilityResultActions.js';
import type {
	ActionDetailItem,
	ActionRiskLevel,
	CapabilityResultAction,
	CapabilityTone,
} from './types.js';
import styles from './ActionDetailModal.module.css';

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

export function ActionDetailModal({
	actions = [],
	children,
	className,
	description,
	details = [],
	isOpen,
	onClose,
	riskLevel,
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
			className={`runa-action-detail-modal-overlay ${styles['overlay']}`}
			onMouseDown={handleOverlayMouseDown}
		>
			<dialog
				{...dialogProps}
				aria-describedby={description ? descriptionId : dialogProps['aria-describedby']}
				aria-labelledby={titleId}
				aria-modal="true"
				className={[
					['runa-action-detail-modal', className].filter(Boolean).join(' '),
					styles['dialog'],
				]
					.filter(Boolean)
					.join(' ')}
				open={true}
			>
				<div className={styles['header']}>
					<div className={styles['titleGroup']}>
						<div className={styles['title']}>
							<h2
								id={titleId}
							>
								{title}
							</h2>
							{riskLevel ? <ActionRiskBadge riskLevel={riskLevel} /> : null}
						</div>
						{description ? (
							<p
								id={descriptionId}
								className={styles['description']}
							>
								{description}
							</p>
						) : null}
					</div>
					<RunaButton onClick={onClose} type="button" variant="ghost">
						Close
					</RunaButton>
				</div>
				{details.length > 0 ? (
					<dl className={styles['detailsList']}>
						{details.map((detail) => (
							<div
								key={detail.id}
								className={styles['detailItem']}
							>
								<dt className={styles['detailKey']}>
									{detail.label}
								</dt>
								<dd className={styles['detailValue']}>
									{detail.value}
								</dd>
							</div>
						))}
					</dl>
				) : null}
				{children}
				{hasActions ? (
					<div className={styles['actions']}>
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
