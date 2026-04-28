import type { DialogHTMLAttributes, MouseEvent, ReactElement, ReactNode } from 'react';
import { useId } from 'react';
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
			className="runa-action-detail-modal-overlay runa-migrated-components-chat-capability-actiondetailmodal-1"
			onMouseDown={handleOverlayMouseDown}
		>
			<dialog
				{...dialogProps}
				aria-describedby={description ? descriptionId : dialogProps['aria-describedby']}
				aria-labelledby={titleId}
				aria-modal="true"
				className={[
					['runa-action-detail-modal', className].filter(Boolean).join(' '),
					'runa-migrated-components-chat-capability-actiondetailmodal-2',
				]
					.filter(Boolean)
					.join(' ')}
				open={true}
			>
				<div className="runa-migrated-components-chat-capability-actiondetailmodal-3">
					<div className="runa-migrated-components-chat-capability-actiondetailmodal-4">
						<div className="runa-migrated-components-chat-capability-actiondetailmodal-5">
							<h2
								id={titleId}
								className="runa-migrated-components-chat-capability-actiondetailmodal-6"
							>
								{title}
							</h2>
							{riskLevel ? <ActionRiskBadge riskLevel={riskLevel} /> : null}
						</div>
						{description ? (
							<p
								id={descriptionId}
								className="runa-migrated-components-chat-capability-actiondetailmodal-7"
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
					<dl className="runa-migrated-components-chat-capability-actiondetailmodal-8">
						{details.map((detail) => (
							<div
								key={detail.id}
								className="runa-migrated-components-chat-capability-actiondetailmodal-9"
							>
								<dt className="runa-migrated-components-chat-capability-actiondetailmodal-10">
									{detail.label}
								</dt>
								<dd className="runa-migrated-components-chat-capability-actiondetailmodal-11">
									{detail.value}
								</dd>
							</div>
						))}
					</dl>
				) : null}
				{children}
				{hasActions ? (
					<div className="runa-migrated-components-chat-capability-actiondetailmodal-12">
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
