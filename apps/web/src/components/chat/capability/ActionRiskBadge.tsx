import type { ReactElement } from 'react';

import { RunaBadge } from '../../ui/RunaBadge.js';
import type { ActionRiskLevel, CapabilityTone } from './types.js';

export type ActionRiskBadgeProps = Readonly<{
	riskLevel: ActionRiskLevel;
}>;

const riskToneByLevel: Record<ActionRiskLevel, CapabilityTone> = {
	high: 'danger',
	low: 'success',
	medium: 'warning',
};

const riskLabelByLevel: Record<ActionRiskLevel, string> = {
	high: 'High attention',
	low: 'Low risk',
	medium: 'Review first',
};

export function ActionRiskBadge({ riskLevel }: ActionRiskBadgeProps): ReactElement {
	return <RunaBadge tone={riskToneByLevel[riskLevel]}>{riskLabelByLevel[riskLevel]}</RunaBadge>;
}
