import type { RenderBlock } from '../../../ws-types.js';

type ApprovalRenderBlock = Extract<RenderBlock, { type: 'approval_block' }>;

export type ApprovalRiskLevel = 'low' | 'medium' | 'high';

const HIGH_RISK_TOOLS = new Set([
	'file.delete',
	'memory.delete',
	'shell.exec',
	'shell.session.start',
	'desktop.launch',
	'desktop.keypress',
	'desktop.verify_state',
]);

const MEDIUM_RISK_TOOLS = new Set([
	'file.write',
	'desktop.click',
	'desktop.type',
	'desktop.scroll',
	'desktop.clipboard.write',
	'browser.click',
	'browser.fill',
	'browser.navigate',
	'browser.extract',
	'memory.save',
	'edit.patch',
]);

function parseServerRiskLevel(value: unknown): ApprovalRiskLevel | null {
	if (value === 'high' || value === 'medium' || value === 'low') {
		return value;
	}

	return null;
}

export function getApprovalRiskLevel(block: ApprovalRenderBlock): ApprovalRiskLevel {
	const serverLevel = parseServerRiskLevel(
		(block.payload as ApprovalRenderBlock['payload'] & { risk_level?: unknown }).risk_level,
	);

	if (serverLevel) {
		return serverLevel;
	}

	const toolName = block.payload.tool_name;

	if (toolName && HIGH_RISK_TOOLS.has(toolName)) {
		return 'high';
	}

	if (toolName && MEDIUM_RISK_TOOLS.has(toolName)) {
		return 'medium';
	}

	return 'low';
}
