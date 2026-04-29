import type { HTMLAttributes, ReactElement } from 'react';
import { RunaButton } from '../../ui/RunaButton.js';
import type { CapabilityResultAction, CapabilityResultActionTone } from './types.js';

export type CapabilityResultActionsProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		actions: readonly CapabilityResultAction[];
	}
>;

function getButtonVariant(
	tone: CapabilityResultActionTone | undefined,
): 'danger' | 'primary' | 'secondary' {
	switch (tone) {
		case 'danger':
			return 'danger';
		case 'primary':
			return 'primary';
		default:
			return 'secondary';
	}
}

export function CapabilityResultActions({
	actions,
	className,
	style,
	...rowProps
}: CapabilityResultActionsProps): ReactElement | null {
	if (actions.length === 0) {
		return null;
	}

	return (
		<div
			{...rowProps}
			className={[
				['runa-capability-result-actions', className].filter(Boolean).join(' '),
				'runa-migrated-components-chat-capability-capabilityresultactions-1',
			]
				.filter(Boolean)
				.join(' ')}
		>
			{actions.map((action) => (
				<RunaButton
					key={action.id}
					disabled={action.disabled}
					onClick={action.onClick}
					type="button"
					variant={getButtonVariant(action.tone)}
				>
					{action.label}
				</RunaButton>
			))}
		</div>
	);
}
