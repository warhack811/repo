import type { DesktopDevicePresenceSnapshot } from '@runa/types';
import { Activity, FolderOpen, Monitor, Paperclip, Sparkles } from 'lucide-react';
import type { ReactElement } from 'react';

import type { CurrentRunProgressSurface } from '../../lib/chat-runtime/current-run-progress.js';
import styles from './WorkInsightPanel.module.css';
import { formatWorkStateLabel, formatWorkTimelineLabel } from './workNarrationFormat.js';

type WorkInsightPanelProps = Readonly<{
	activeConversationTitle?: string | null;
	attachmentCount: number;
	currentRunProgress: CurrentRunProgressSurface | null;
	desktopDevices: readonly DesktopDevicePresenceSnapshot[];
	isDesktopDevicesLoading: boolean;
	presentationRunSurfaceCount: number;
	selectedDesktopTargetConnectionId: string | null;
}>;

function getSelectedDesktopDevice(
	devices: readonly DesktopDevicePresenceSnapshot[],
	selectedConnectionId: string | null,
): DesktopDevicePresenceSnapshot | null {
	if (!selectedConnectionId) {
		return devices[0] ?? null;
	}

	return devices.find((device) => device.connection_id === selectedConnectionId) ?? null;
}

export function WorkInsightPanel({
	activeConversationTitle,
	attachmentCount,
	currentRunProgress,
	desktopDevices,
	isDesktopDevicesLoading,
	presentationRunSurfaceCount,
	selectedDesktopTargetConnectionId,
}: WorkInsightPanelProps): ReactElement {
	const selectedDevice = getSelectedDesktopDevice(
		desktopDevices,
		selectedDesktopTargetConnectionId,
	);
	const visibleSteps = currentRunProgress?.step_items.slice(-4) ?? [];
	const progressTone = currentRunProgress?.status_tone ?? 'neutral';

	return (
		<aside className={styles['root']} aria-label="Çalışma ayrıntıları">
			<section className={styles['panel']}>
				<div className={styles['panelHeader']}>
					<span className={styles['iconWrap']}>
						<Activity size={16} />
					</span>
					<div>
						<h2 className={styles['title']}>İlerleme</h2>
						<p className={styles['muted']}>
							{currentRunProgress?.headline ?? 'Yeni bir görev bekleniyor'}
						</p>
					</div>
					<span className={`${styles['tone']} ${styles[`tone-${progressTone}`]}`}>
						{formatWorkStateLabel(currentRunProgress?.status_tone)}
					</span>
				</div>
				{visibleSteps.length > 0 ? (
					<ol className={styles['stepList']}>
						{visibleSteps.map((step, index) => (
							<li
								className={styles['step']}
								key={`${step.kind}:${step.call_id ?? step.label}:${index}`}
							>
								<span className={styles['stepDot']} aria-hidden="true" />
								<div className={styles['stepCopy']}>
									<strong>{formatWorkTimelineLabel(step.label)}</strong>
									<span>{formatWorkStateLabel(step.state)}</span>
								</div>
							</li>
						))}
					</ol>
				) : (
					<p className={styles['empty']}>Görev başladığında canlı adımlar burada birikir.</p>
				)}
			</section>

			<section className={styles['panel']}>
				<div className={styles['panelHeader']}>
					<span className={styles['iconWrap']}>
						<Monitor size={16} />
					</span>
					<div>
						<h2 className={styles['title']}>Masaüstü</h2>
						<p className={styles['muted']}>
							{isDesktopDevicesLoading
								? 'Bağlantılar kontrol ediliyor'
								: `${desktopDevices.length} cihaz çevrimiçi`}
						</p>
					</div>
				</div>
				<div className={styles['contextRow']}>
					<span>Hedef</span>
					<strong>
						{selectedDevice?.machine_label ?? selectedDevice?.agent_id ?? 'Seçilmedi'}
					</strong>
				</div>
				<div className={styles['contextRow']}>
					<span>Yetenek</span>
					<strong>
						{selectedDevice ? `${selectedDevice.capabilities.length} araç` : 'Beklemede'}
					</strong>
				</div>
			</section>

			<section className={styles['panel']}>
				<div className={styles['panelHeader']}>
					<span className={styles['iconWrap']}>
						<FolderOpen size={16} />
					</span>
					<div>
						<h2 className={styles['title']}>Bağlam</h2>
						<p className={styles['muted']}>{activeConversationTitle ?? 'Taslak sohbet'}</p>
					</div>
				</div>
				<div className={styles['metricGrid']}>
					<div className={styles['metric']}>
						<Sparkles size={15} />
						<strong>{presentationRunSurfaceCount}</strong>
						<span>çalışma yüzeyi</span>
					</div>
					<div className={styles['metric']}>
						<Paperclip size={15} />
						<strong>{attachmentCount}</strong>
						<span>ek</span>
					</div>
				</div>
			</section>
		</aside>
	);
}
