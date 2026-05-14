import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type NotificationType = 'approval' | 'device' | 'reminder' | 'system';
type NotificationFilter = NotificationType | 'all';

type NotificationItem = Readonly<{
	body: string;
	id: string;
	timeLabel: string;
	title: string;
	type: NotificationType;
	unread: boolean;
}>;

const notificationsSeed: readonly NotificationItem[] = [
	{
		body: 'Runa provider-health.ts dosyasini okumak istiyor.',
		id: 'n-approval-1',
		timeLabel: 'Simdi',
		title: 'Onay bekliyor',
		type: 'approval',
		unread: true,
	},
	{
		body: 'Windows PC cevrimici oldugunda tekrar denenecek.',
		id: 'n-device-1',
		timeLabel: '11 dk',
		title: 'Cihaz izleniyor',
		type: 'device',
		unread: true,
	},
	{
		body: 'Taslak denetimini 14:30 icin hatirlat.',
		id: 'n-reminder-1',
		timeLabel: '24 dk',
		title: 'Hatirlatma',
		type: 'reminder',
		unread: false,
	},
	{
		body: 'Son calisma basariyla tamamlandi.',
		id: 'n-system-1',
		timeLabel: '1 sa',
		title: 'Sistem',
		type: 'system',
		unread: false,
	},
];

function getFilterLabel(filter: NotificationFilter): string {
	switch (filter) {
		case 'approval':
			return 'Onaylar';
		case 'device':
			return 'Cihaz';
		case 'reminder':
			return 'Hatirlatma';
		case 'system':
			return 'Sistem';
		default:
			return 'Tumu';
	}
}

export function NotificationsPage(): ReactElement {
	const navigate = useNavigate();
	const [filter, setFilter] = useState<NotificationFilter>('all');
	const [items, setItems] = useState<readonly NotificationItem[]>(notificationsSeed);

	const unreadCount = useMemo(
		() => items.reduce((count, item) => (item.unread ? count + 1 : count), 0),
		[items],
	);
	const filteredItems = useMemo(
		() => items.filter((item) => filter === 'all' || item.type === filter),
		[filter, items],
	);

	function markAllRead(): void {
		setItems((current) => current.map((item) => ({ ...item, unread: false })));
	}

	function markRead(id: string): void {
		setItems((current) =>
			current.map((item) => (item.id === id ? { ...item, unread: false } : item)),
		);
	}

	function snooze(id: string): void {
		setItems((current) =>
			current.map((item) =>
				item.id === id ? { ...item, timeLabel: '1 sa sonra', unread: false } : item,
			),
		);
	}

	function openNotification(item: NotificationItem): void {
		markRead(item.id);
		if (item.type === 'approval') {
			navigate('/chat');
		}
	}

	return (
		<section className="runa-settings-panel-grid" aria-labelledby="notifications-heading">
			<header className="runa-settings-preference-section">
				<h1 id="notifications-heading" className="runa-page-title">
					Bildirimler
				</h1>
				<p className="runa-subtle-copy">
					Onaylar, hatirlatmalar ve cihaz olaylari tek listede kalir.
				</p>
				<div className="runa-inline-cluster">
					{(['all', 'approval', 'reminder', 'system', 'device'] as const).map((nextFilter) => (
						<button
							key={nextFilter}
							type="button"
							className={
								filter === nextFilter
									? 'runa-button runa-button--primary'
									: 'runa-button runa-button--secondary'
							}
							onClick={() => setFilter(nextFilter)}
						>
							{getFilterLabel(nextFilter)}
						</button>
					))}
					<button
						type="button"
						className="runa-button runa-button--secondary"
						onClick={markAllRead}
					>
						Tumunu okundu yap
					</button>
				</div>
				<div className="runa-subtle-copy">Okunmamis: {unreadCount}</div>
			</header>

			<ul className="runa-settings-preference-section" aria-label="Bildirim listesi">
				{filteredItems.length === 0 ? (
					<li className="runa-subtle-copy">Bu filtrede bildirim yok.</li>
				) : null}
				{filteredItems.map((item) => (
					<li
						key={item.id}
						className={`runa-surface-card ${item.unread ? 'runa-surface-card--active' : ''}`}
					>
						<div className="runa-settings-row runa-settings-row--stacked">
							<div className="runa-inline-cluster">
								<strong>{item.title}</strong>
								<span className="runa-subtle-copy">{item.timeLabel}</span>
							</div>
							<div>{item.body}</div>
							<div className="runa-inline-cluster">
								<button
									type="button"
									className="runa-button runa-button--secondary"
									onClick={() => openNotification(item)}
								>
									Ac
								</button>
								<button
									type="button"
									className="runa-button runa-button--secondary"
									onClick={() => snooze(item.id)}
								>
									Ertele
								</button>
							</div>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}
