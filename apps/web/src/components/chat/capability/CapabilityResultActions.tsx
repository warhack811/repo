import type { CSSProperties, HTMLAttributes, ReactElement } from 'react';

import { designTokens } from '../../../lib/design-tokens.js';
import { RunaButton } from '../../ui/index.js';
import type { CapabilityResultAction, CapabilityResultActionTone } from './types.js';

export type CapabilityResultActionsProps = Readonly<
	Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
		actions: readonly CapabilityResultAction[];
	}
>;

const actionRowStyle: CSSProperties = {
	alignItems: 'center',
	display: 'flex',
	flexWrap: 'wrap',
	gap: designTokens.spacing.sm,
};

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
			className={['runa-capability-result-actions', className].filter(Boolean).join(' ')}
			style={{ ...actionRowStyle, ...style }}
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
