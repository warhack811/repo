import type { CSSProperties, ReactElement } from 'react';
import { useMemo, useState } from 'react';

import {
	ActionDetailModal,
	ActionRiskBadge,
	ActiveTaskQueue,
	ApprovalDecisionCard,
	AssetGrid,
	AssetModal,
	AssetPreviewCard,
	BeforeAfterCompare,
	CapabilityCard,
	CapabilityProgressList,
	CapabilityResultActions,
} from '../components/chat/capability/index.js';
import type {
	ActionDetailItem,
	AssetPreviewItem,
	CapabilityProgressStep,
	CapabilityResultAction,
} from '../components/chat/capability/index.js';
import { RunaBadge, RunaButton, RunaCard } from '../components/ui/index.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import { designTokens } from '../lib/design-tokens.js';

const pageStackStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.xl,
	minWidth: 0,
};

const panelStyle: CSSProperties = {
	background: designTokens.color.background.panel,
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.card,
	boxShadow: designTokens.shadow.panel,
	padding: designTokens.spacing.xl,
};

const mutedTextStyle: CSSProperties = {
	color: designTokens.color.foreground.muted,
	lineHeight: 1.6,
	margin: 0,
};

const secondaryLabelStyle: CSSProperties = {
	color: designTokens.color.foreground.soft,
	fontSize: '12px',
	fontWeight: 700,
	letterSpacing: '0.08em',
	textTransform: 'uppercase',
};

const headerStyle: CSSProperties = {
	...panelStyle,
	background:
		'radial-gradient(circle at top right, rgba(56, 189, 248, 0.12), transparent 28%), linear-gradient(180deg, rgba(20, 26, 40, 0.92) 0%, rgba(15, 23, 42, 0.8) 100%)',
};

const sectionStyle: CSSProperties = {
	...panelStyle,
	display: 'grid',
	gap: designTokens.spacing.lg,
};

const sectionHeaderStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.xs,
	minWidth: 0,
};

const sectionTitleStyle: CSSProperties = {
	color: designTokens.color.foreground.strong,
	fontSize: '20px',
	lineHeight: 1.35,
	margin: 0,
};

const twoColumnGridStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.lg,
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
	minWidth: 0,
};

const compactGridStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.md,
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
	minWidth: 0,
};

const riskRowStyle: CSSProperties = {
	alignItems: 'center',
	display: 'flex',
	flexWrap: 'wrap',
	gap: designTokens.spacing.sm,
};

const metaGridStyle: CSSProperties = {
	display: 'grid',
	gap: designTokens.spacing.sm,
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
};

const metaItemStyle: CSSProperties = {
	background: 'rgba(7, 11, 20, 0.56)',
	border: `1px solid ${designTokens.color.border.soft}`,
	borderRadius: designTokens.radius.soft,
	display: 'grid',
	gap: designTokens.spacing.xs,
	padding: designTokens.spacing.md,
};

const detailTextStyle: CSSProperties = {
	color: designTokens.color.foreground.muted,
	lineHeight: designTokens.typography.text.lineHeight,
	margin: 0,
};

const selectedNoteStyle: CSSProperties = {
	color: designTokens.color.foreground.info,
	fontSize: designTokens.typography.small.fontSize,
	lineHeight: designTokens.typography.small.lineHeight,
};

function createPreviewDataUri(label: string, primary: string, secondary: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600" role="img" aria-label="${label}"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient></defs><rect width="960" height="600" fill="#020617"/><rect x="56" y="56" width="848" height="488" rx="34" fill="url(#g)" opacity="0.9"/><circle cx="760" cy="156" r="82" fill="rgba(255,255,255,0.22)"/><rect x="112" y="380" width="420" height="28" rx="14" fill="rgba(255,255,255,0.72)"/><rect x="112" y="432" width="300" height="22" rx="11" fill="rgba(255,255,255,0.46)"/><text x="112" y="180" fill="white" font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="700">${label}</text></svg>`;

	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const progressSteps: readonly CapabilityProgressStep[] = [
	{
		description: 'Query plan and source scope are locked for review.',
		id: 'scope',
		label: 'Scope source set',
		status: 'completed',
	},
	{
		description: 'Desktop target is checked before a guarded action.',
		id: 'device',
		label: 'Check device state',
		status: 'running',
	},
	{
		description: 'Risk copy waits for the user decision layer.',
		id: 'approval',
		label: 'Prepare approval copy',
		status: 'waiting',
	},
	{
		description: 'Result assets stay local to this preview surface.',
		id: 'asset',
		label: 'Stage visual asset',
		status: 'queued',
	},
] as const;

const actionDetails: readonly ActionDetailItem[] = [
	{
		id: 'target-app',
		label: 'Target app',
		value: 'Desktop companion preview',
	},
	{
		id: 'action-type',
		label: 'Action type',
		value: 'Open application and capture state',
	},
	{
		id: 'risk',
		label: 'Risk',
		tone: 'warning',
		value: 'Medium review required before execution',
	},
	{
		id: 'files',
		label: 'Files affected',
		value: 'No files are written from this harness',
	},
	{
		id: 'approval',
		label: 'Requires approval',
		tone: 'info',
		value: 'Yes. Preview buttons update local state only.',
	},
] as const;

const sourceAsset: AssetPreviewItem = {
	alt: 'Research source preview placeholder',
	id: 'source-card',
	kind: 'image',
	previewUrl: createPreviewDataUri('Source Map', '#0ea5e9', '#f59e0b'),
	subtitle: 'Research board',
	title: 'Source cluster',
};

const desktopAsset: AssetPreviewItem = {
	alt: 'Desktop screenshot preview placeholder',
	id: 'desktop-shot',
	kind: 'screenshot',
	previewUrl: createPreviewDataUri('Desktop', '#22c55e', '#0f172a'),
	subtitle: 'Captured state',
	title: 'Desktop snapshot',
};

const baseAssets: readonly AssetPreviewItem[] = [
	sourceAsset,
	desktopAsset,
	{
		id: 'patch-note',
		kind: 'document',
		subtitle: 'Approval brief',
		title: 'Change note',
	},
	{
		id: 'code-diff',
		kind: 'code',
		subtitle: 'Generated preview',
		title: 'Patch outline',
	},
] as const;

function renderSectionHeader(eyebrow: string, title: string, description: string): ReactElement {
	return (
		<div style={sectionHeaderStyle}>
			<div style={secondaryLabelStyle}>{eyebrow}</div>
			<h2 style={sectionTitleStyle}>{title}</h2>
			<p style={mutedTextStyle}>{description}</p>
		</div>
	);
}

export function CapabilityPreviewPage(): ReactElement {
	const { isDeveloperMode, setDeveloperMode } = useDeveloperMode();
	const [selectedAssetId, setSelectedAssetId] = useState(sourceAsset.id);
	const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
	const [isActionDetailOpen, setIsActionDetailOpen] = useState(false);
	const [decisionState, setDecisionState] = useState<'approved' | 'idle' | 'rejected'>('idle');

	const assets = useMemo(
		() =>
			baseAssets.map((asset) => ({
				...asset,
				isSelected: asset.id === selectedAssetId,
			})),
		[selectedAssetId],
	);
	const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? assets[0] ?? null;

	const assetActions: readonly CapabilityResultAction[] = [
		{
			id: 'open-asset',
			label: 'Open preview',
			onClick: () => setIsAssetModalOpen(true),
			tone: 'primary',
		},
		{
			id: 'mark-asset',
			label: 'Mark selected',
			onClick: () => {
				if (selectedAsset) {
					setSelectedAssetId(selectedAsset.id);
				}
			},
		},
	];

	const detailActions: readonly CapabilityResultAction[] = [
		{
			id: 'approve-local',
			label: 'Approve locally',
			onClick: () => {
				setDecisionState('approved');
				setIsActionDetailOpen(false);
			},
			tone: 'primary',
		},
		{
			id: 'reject-local',
			label: 'Reject locally',
			onClick: () => {
				setDecisionState('rejected');
				setIsActionDetailOpen(false);
			},
			tone: 'danger',
		},
	];

	if (!isDeveloperMode) {
		return (
			<section style={sectionStyle} aria-labelledby="capability-preview-disabled-heading">
				<div style={sectionHeaderStyle}>
					<div style={secondaryLabelStyle}>Internal preview</div>
					<h2 id="capability-preview-disabled-heading" style={sectionTitleStyle}>
						Developer Mode is required
					</h2>
					<p style={mutedTextStyle}>
						This route is reserved for internal visual QA. Enable Developer Mode to inspect
						capability UI states.
					</p>
				</div>
				<div style={{ width: 'fit-content' }}>
					<RunaButton onClick={() => setDeveloperMode(true)}>Enable Developer Mode</RunaButton>
				</div>
			</section>
		);
	}

	return (
		<div style={pageStackStyle}>
			<section style={headerStyle} aria-labelledby="capability-preview-heading">
				<div style={sectionHeaderStyle}>
					<div style={secondaryLabelStyle}>Internal visual QA</div>
					<h2 id="capability-preview-heading" style={{ ...sectionTitleStyle, fontSize: '24px' }}>
						Capability component harness
					</h2>
					<p style={mutedTextStyle}>
						Static scenarios for the capability UI foundation. Controls update local preview state
						only and do not call runtime, approval, file, desktop, or upload paths.
					</p>
				</div>
				<div style={riskRowStyle}>
					<RunaBadge tone="info">Developer route</RunaBadge>
					<RunaBadge tone="neutral">Local state only</RunaBadge>
					<RunaBadge tone="success">No runtime wiring</RunaBadge>
				</div>
			</section>

			<section style={sectionStyle} aria-labelledby="capability-cards-heading">
				{renderSectionHeader(
					'Cards',
					'Capability card states',
					'Research, desktop, file, success, warning, and error examples share one visual rhythm.',
				)}
				<div style={compactGridStyle}>
					<CapabilityCard
						description="Summarizes source scope, confidence, and next inspection affordance."
						eyebrow="Research"
						status="completed"
						title="Source brief ready"
						tone="success"
					>
						<CapabilityResultActions
							actions={[
								{
									id: 'inspect-source',
									label: 'Inspect',
									onClick: () => setIsActionDetailOpen(true),
									tone: 'primary',
								},
								{
									id: 'copy-source',
									label: 'Copy note',
									onClick: () => setDecisionState('idle'),
								},
							]}
						/>
					</CapabilityCard>
					<CapabilityCard
						description="Shows a guarded desktop action before execution is available."
						eyebrow="Desktop"
						status="waiting"
						title="Open target app"
						tone="warning"
					>
						<div style={detailTextStyle}>Device: Windows preview companion</div>
					</CapabilityCard>
					<CapabilityCard
						description="Frames a file operation without exposing raw payloads."
						eyebrow="File operation"
						status="queued"
						title="Stage report patch"
					>
						<div style={detailTextStyle}>Files affected: 2 preview entries</div>
					</CapabilityCard>
					<CapabilityCard
						description="Developer-facing failure tone for a blocked capability."
						eyebrow="Error"
						status="failed"
						title="Connection unavailable"
						tone="danger"
					/>
				</div>
			</section>

			<section style={sectionStyle} aria-labelledby="progress-preview-heading">
				{renderSectionHeader(
					'Progress',
					'Progress list and active queue',
					'The queue uses completed, running, waiting, and queued states without live transport.',
				)}
				<div style={twoColumnGridStyle}>
					<CapabilityCard
						description="A compact ordered list for multi-step capability work."
						eyebrow="Progress"
						status="running"
						title="Capability preparation"
						tone="info"
					>
						<CapabilityProgressList steps={progressSteps} />
					</CapabilityCard>
					<ActiveTaskQueue
						items={[
							{
								description: 'Collect preview states for the design QA pass.',
								id: 'qa-pass',
								status: 'running',
								title: 'Visual QA pass',
							},
							{
								description: 'Keep the chat route untouched during this preview.',
								id: 'chat-guard',
								status: 'completed',
								title: 'Chat flow guard',
							},
							{
								description: 'Review approval copy before real adapter work.',
								id: 'adapter-next',
								status: 'queued',
								title: 'Adapter follow-up',
							},
						]}
						title="Preview task queue"
					/>
				</div>
			</section>

			<section style={sectionStyle} aria-labelledby="asset-preview-heading">
				{renderSectionHeader(
					'Assets',
					'Asset grid, preview card, modal, and compare',
					'Inline placeholders keep the harness self-contained while exercising selection and modal flows.',
				)}
				<div style={twoColumnGridStyle}>
					<div style={{ display: 'grid', gap: designTokens.spacing.md, minWidth: 0 }}>
						<AssetGrid
							items={assets}
							onSelect={(asset) => {
								setSelectedAssetId(asset.id);
							}}
						/>
						{selectedAsset ? (
							<div style={selectedNoteStyle}>Selected asset: {selectedAsset.title}</div>
						) : null}
					</div>
					{selectedAsset ? (
						<AssetPreviewCard
							actionSlot={<CapabilityResultActions actions={assetActions} />}
							alt={selectedAsset.alt}
							isSelected
							kind={selectedAsset.kind}
							metaSlot="Modal and selection are preview-local."
							previewUrl={selectedAsset.previewUrl}
							subtitle={selectedAsset.subtitle}
							title={selectedAsset.title}
						/>
					) : null}
				</div>
				<BeforeAfterCompare before={sourceAsset} after={desktopAsset} />
			</section>

			<section style={sectionStyle} aria-labelledby="approval-preview-heading">
				{renderSectionHeader(
					'Approval',
					'Risk badges and approval detail',
					'Approval buttons are no-op UI controls that only update the preview status below.',
				)}
				<div style={riskRowStyle}>
					<ActionRiskBadge riskLevel="low" />
					<ActionRiskBadge riskLevel="medium" />
					<ActionRiskBadge riskLevel="high" />
				</div>
				<div style={twoColumnGridStyle}>
					<ApprovalDecisionCard
						description="Preview of the chat-native decision card for guarded actions."
						onApprove={() => setDecisionState('approved')}
						onReject={() => setDecisionState('rejected')}
						riskLevel="medium"
						title="Approve desktop inspection"
					>
						<div style={metaGridStyle}>
							{actionDetails.slice(0, 3).map((detail) => (
								<div key={detail.id} style={metaItemStyle}>
									<div style={secondaryLabelStyle}>{detail.label}</div>
									<div style={detailTextStyle}>{detail.value}</div>
								</div>
							))}
						</div>
						<div style={{ width: 'fit-content' }}>
							<RunaButton onClick={() => setIsActionDetailOpen(true)} variant="secondary">
								Open action detail
							</RunaButton>
						</div>
					</ApprovalDecisionCard>
					<RunaCard tone="subtle">
						<div style={sectionHeaderStyle}>
							<div style={secondaryLabelStyle}>Decision state</div>
							<h3 style={{ ...sectionTitleStyle, fontSize: '18px' }}>
								{decisionState === 'idle' ? 'No local decision yet' : `Locally ${decisionState}`}
							</h3>
							<p style={detailTextStyle}>
								This text proves the controls are wired only to this harness state.
							</p>
						</div>
						<CapabilityResultActions
							actions={[
								{
									id: 'reset-decision',
									label: 'Reset state',
									onClick: () => setDecisionState('idle'),
								},
								{
									id: 'open-detail',
									label: 'Open detail',
									onClick: () => setIsActionDetailOpen(true),
									tone: 'primary',
								},
							]}
						/>
					</RunaCard>
				</div>
			</section>

			<AssetModal
				actions={assetActions}
				asset={selectedAsset}
				isOpen={isAssetModalOpen}
				onClose={() => setIsAssetModalOpen(false)}
			/>
			<ActionDetailModal
				actions={detailActions}
				description="Internal preview of a guarded action detail modal. It is not connected to approval execution."
				details={actionDetails}
				isOpen={isActionDetailOpen}
				onClose={() => setIsActionDetailOpen(false)}
				riskLevel="medium"
				title="Desktop inspection detail"
			/>
		</div>
	);
}
