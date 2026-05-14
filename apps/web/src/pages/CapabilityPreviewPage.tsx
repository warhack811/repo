import type { ReactElement } from 'react';
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
import { RunaBadge } from '../components/ui/RunaBadge.js';
import { RunaButton } from '../components/ui/RunaButton.js';
import { RunaCard } from '../components/ui/RunaCard.js';
import { useDeveloperMode } from '../hooks/useDeveloperMode.js';
import styles from './CapabilityPreviewPage.module.css';

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
	subtitle: 'Research board',
	title: 'Source cluster',
};

const desktopAsset: AssetPreviewItem = {
	alt: 'Desktop screenshot preview placeholder',
	id: 'desktop-shot',
	kind: 'screenshot',
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
		<div className={styles['sectionHeader']}>
			<div className={styles['eyebrow']}>{eyebrow}</div>
			<h2 className={styles['sectionTitle']}>{title}</h2>
			<p className={styles['mutedText']}>{description}</p>
		</div>
	);
}

export function CapabilityPreviewPage(): ReactElement {
	const { isDeveloperMode } = useDeveloperMode();
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
			<section className={styles['section']} aria-labelledby="capability-preview-disabled-heading">
				<div className={styles['sectionHeader']}>
					<div className={styles['eyebrow']}>Internal preview</div>
					<h2 id="capability-preview-disabled-heading" className={styles['sectionTitle']}>
						Developer Mode is required
					</h2>
					<p className={styles['mutedText']}>
						This route is reserved for internal visual QA and is unavailable in normal user
						sessions.
					</p>
				</div>
			</section>
		);
	}

	return (
		<div className={styles['pageStack']}>
			<section
				className={`${styles['section']} ${styles['header']}`}
				aria-labelledby="capability-preview-heading"
			>
				<div className={styles['sectionHeader']}>
					<div className={styles['eyebrow']}>Internal visual QA</div>
					<h2 id="capability-preview-heading" className={styles['sectionTitleLarge']}>
						Capability component harness
					</h2>
					<p className={styles['mutedText']}>
						Static scenarios for the capability UI foundation. Controls update local preview state
						only and do not call runtime, approval, file, desktop, or upload paths.
					</p>
				</div>
				<div className={styles['riskRow']}>
					<RunaBadge tone="info">Developer route</RunaBadge>
					<RunaBadge tone="neutral">Local state only</RunaBadge>
					<RunaBadge tone="success">No runtime wiring</RunaBadge>
				</div>
			</section>

			<section className={styles['section']} aria-labelledby="capability-cards-heading">
				{renderSectionHeader(
					'Cards',
					'Capability card states',
					'Research, desktop, file, success, warning, and error examples share one visual rhythm.',
				)}
				<div className={styles['compactGrid']}>
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
						<div className={styles['detailText']}>Device: Windows preview companion</div>
					</CapabilityCard>
					<CapabilityCard
						description="Frames a file operation without exposing raw payloads."
						eyebrow="File operation"
						status="queued"
						title="Stage report patch"
					>
						<div className={styles['detailText']}>Files affected: 2 preview entries</div>
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

			<section className={styles['section']} aria-labelledby="progress-preview-heading">
				{renderSectionHeader(
					'Progress',
					'Progress list and active queue',
					'The queue uses completed, running, waiting, and queued states without live transport.',
				)}
				<div className={styles['twoColumnGrid']}>
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

			<section className={styles['section']} aria-labelledby="asset-preview-heading">
				{renderSectionHeader(
					'Assets',
					'Asset grid, preview card, modal, and compare',
					'Inline placeholders keep the harness self-contained while exercising selection and modal flows.',
				)}
				<div className={styles['twoColumnGrid']}>
					<div className={styles['assetStack']}>
						<AssetGrid
							items={assets}
							onSelect={(asset) => {
								setSelectedAssetId(asset.id);
							}}
						/>
						{selectedAsset ? (
							<div className={styles['selectedNote']}>Selected asset: {selectedAsset.title}</div>
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

			<section className={styles['section']} aria-labelledby="approval-preview-heading">
				{renderSectionHeader(
					'Approval',
					'Risk badges and approval detail',
					'Approval buttons are no-op UI controls that only update the preview status below.',
				)}
				<div className={styles['riskRow']}>
					<ActionRiskBadge riskLevel="low" />
					<ActionRiskBadge riskLevel="medium" />
					<ActionRiskBadge riskLevel="high" />
				</div>
				<div className={styles['twoColumnGrid']}>
					<ApprovalDecisionCard
						description="Preview of the chat-native decision card for guarded actions."
						onApprove={() => setDecisionState('approved')}
						onReject={() => setDecisionState('rejected')}
						riskLevel="medium"
						title="Approve desktop inspection"
					>
						<div className={styles['metaGrid']}>
							{actionDetails.slice(0, 3).map((detail) => (
								<div key={detail.id} className={styles['metaItem']}>
									<div className={styles['eyebrow']}>{detail.label}</div>
									<div className={styles['detailText']}>{detail.value}</div>
								</div>
							))}
						</div>
						<div className={styles['fitContent']}>
							<RunaButton onClick={() => setIsActionDetailOpen(true)} variant="secondary">
								Open action detail
							</RunaButton>
						</div>
					</ApprovalDecisionCard>
					<RunaCard tone="subtle">
						<div className={styles['sectionHeader']}>
							<div className={styles['eyebrow']}>Decision state</div>
							<h3 className={styles['sectionTitleSmall']}>
								{decisionState === 'idle' ? 'No local decision yet' : `Locally ${decisionState}`}
							</h3>
							<p className={styles['detailText']}>
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
