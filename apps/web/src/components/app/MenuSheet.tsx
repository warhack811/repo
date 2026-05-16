import { Bell, HelpCircle, History, Laptop, Settings, SlidersHorizontal, User } from 'lucide-react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { RunaSheet } from '../ui/RunaSheet.js';
import { useRunaToast } from '../ui/RunaToast.js';
import styles from './MenuSheet.module.css';

type MenuSheetProps = Readonly<{
	isDeveloperMode: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onOpenHistorySheet: () => void;
	onToggleDeveloperMode: () => void;
}>;

type MenuAction = Readonly<{
	icon: ReactElement;
	id: string;
	label: string;
	onSelect: () => void;
	suffix?: string;
}>;

export function MenuSheet({
	isDeveloperMode,
	open,
	onOpenChange,
	onOpenHistorySheet,
	onToggleDeveloperMode,
}: MenuSheetProps): ReactElement | null {
	const navigate = useNavigate();
	const { pushToast } = useRunaToast();

	function closeSheet(): void {
		onOpenChange(false);
	}

	function showComingSoon(): void {
		const messageByAction = {
			help: 'Yardım ve geri bildirim akışı hazırlanıyor. Bu alan kısa süre içinde aktif olacak.',
		} as const;

		pushToast({
			message: messageByAction.help,
			title: 'Yakında',
			tone: 'info',
		});
	}

	const actions: readonly MenuAction[] = [
		{
			icon: <Laptop aria-hidden="true" size={17} />,
			id: 'devices',
			label: 'Cihazlar',
			onSelect: () => {
				navigate('/devices');
				closeSheet();
			},
		},
		{
			icon: <History aria-hidden="true" size={17} />,
			id: 'history',
			label: 'Geçmiş',
			onSelect: () => {
				closeSheet();
				onOpenHistorySheet();
			},
		},
		{
			icon: <User aria-hidden="true" size={17} />,
			id: 'account',
			label: 'Hesap',
			onSelect: () => {
				navigate('/account');
				closeSheet();
			},
		},
		{
			icon: <Settings aria-hidden="true" size={17} />,
			id: 'settings',
			label: 'Ayarlar',
			onSelect: () => {
				navigate('/account');
				closeSheet();
			},
		},
		{
			icon: <SlidersHorizontal aria-hidden="true" size={17} />,
			id: 'advanced',
			label: 'Gelişmiş görünüm',
			onSelect: () => {
				onToggleDeveloperMode();
				closeSheet();
			},
			suffix: isDeveloperMode ? 'Açık' : 'Kapalı',
		},
		{
			icon: <Bell aria-hidden="true" size={17} />,
			id: 'notifications',
			label: 'Bildirimler',
			onSelect: () => {
				navigate('/notifications');
				closeSheet();
			},
		},
		{
			icon: <HelpCircle aria-hidden="true" size={17} />,
			id: 'help',
			label: 'Yardım ve geri bildirim',
			onSelect: () => {
				showComingSoon();
				closeSheet();
			},
			suffix: 'Yakında',
		},
	];

	return (
		<RunaSheet
			className={styles['sheet']}
			isOpen={open}
			onClose={closeSheet}
			side="bottom"
			title="Hızlı menü"
		>
			<section aria-labelledby="menu-sheet-title" className={styles['content']} id="menu-sheet">
				<header className={styles['header']}>
					<h2 id="menu-sheet-title" className={styles['title']}>
						Menü
					</h2>
					<button
						type="button"
						className="runa-chat-icon-button"
						onClick={closeSheet}
						aria-label="Menüyü kapat"
					>
						×
					</button>
				</header>
				<ul className={styles['list']}>
					{actions.map((action) => (
						<li key={action.id}>
							<button type="button" className={styles['item']} onClick={action.onSelect}>
								<span className={styles['itemMain']}>
									{action.icon}
									<span>{action.label}</span>
								</span>
								{action.suffix ? (
									<span className={styles['itemSuffix']}>{action.suffix}</span>
								) : null}
							</button>
						</li>
					))}
				</ul>
			</section>
		</RunaSheet>
	);
}
