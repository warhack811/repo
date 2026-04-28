import { type PointerEvent, type ReactElement, type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import styles from './RunaSheet.module.css';
import { cx } from './ui-utils.js';

export type RunaSheetSide = 'bottom' | 'right';

export type RunaSheetProps = Readonly<{
	children: ReactNode;
	isOpen: boolean;
	onClose: () => void;
	title: string;
	className?: string;
	side?: RunaSheetSide;
}>;

export function RunaSheet({
	children,
	className,
	isOpen,
	onClose,
	side = 'right',
	title,
}: RunaSheetProps): ReactElement | null {
	const dragStartYRef = useRef<number | null>(null);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		document.body.classList.add('runa-sidebar-lock');

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === 'Escape') {
				onClose();
			}
		}

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.body.classList.remove('runa-sidebar-lock');
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen, onClose]);

	if (!isOpen) {
		return null;
	}

	function handlePointerDown(event: PointerEvent<HTMLSpanElement>): void {
		dragStartYRef.current = event.clientY;
	}

	function handlePointerUp(event: PointerEvent<HTMLSpanElement>): void {
		const startY = dragStartYRef.current;
		dragStartYRef.current = null;

		if (side === 'bottom' && startY !== null && event.clientY - startY > 60) {
			onClose();
		}
	}

	return createPortal(
		<>
			<button
				aria-label="Close panel"
				className={styles['backdrop']}
				onClick={onClose}
				type="button"
			/>
			<section aria-label={title} className={cx(styles['sheet'], styles[side], className)}>
				{side === 'bottom' ? (
					<span
						aria-hidden="true"
						className={styles['handle']}
						onPointerDown={handlePointerDown}
						onPointerUp={handlePointerUp}
					/>
				) : null}
				{children}
			</section>
		</>,
		document.body,
	);
}
