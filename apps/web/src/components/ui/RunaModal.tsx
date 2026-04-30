import {
	type PointerEvent,
	type ReactElement,
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useRef,
} from 'react';
import { createPortal } from 'react-dom';

import styles from './RunaModal.module.css';
import { cx } from './ui-utils.js';

export type RunaModalSize = 'full' | 'lg' | 'md' | 'sm';

export type RunaModalProps = Readonly<{
	children: ReactNode;
	isOpen: boolean;
	onClose: () => void;
	title: string;
	className?: string;
	size?: RunaModalSize;
}>;

const focusableSelector = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

export function RunaModal({
	children,
	className,
	isOpen,
	onClose,
	size = 'md',
	title,
}: RunaModalProps): ReactElement | null {
	const titleId = useId();
	const panelRef = useRef<HTMLDialogElement | null>(null);
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);
	const dragStartYRef = useRef<number | null>(null);

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		previouslyFocusedRef.current =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		document.body.classList.add('runa-sidebar-lock');
		panelRef.current?.focus();

		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === 'Escape') {
				onClose();
			}
		}

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.body.classList.remove('runa-sidebar-lock');
			document.removeEventListener('keydown', handleKeyDown);
			previouslyFocusedRef.current?.focus();
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

		if (startY !== null && event.clientY - startY > 60) {
			onClose();
		}
	}

	function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>): void {
		if (event.key !== 'Tab') {
			return;
		}

		const panel = panelRef.current;

		if (!panel) {
			return;
		}

		const focusableElements = [...panel.querySelectorAll<HTMLElement>(focusableSelector)].filter(
			(element) => element.offsetParent !== null || element === document.activeElement,
		);

		if (focusableElements.length === 0) {
			event.preventDefault();
			panel.focus();
			return;
		}

		const firstElement = focusableElements[0];
		const lastElement = focusableElements.at(-1);

		if (!firstElement || !lastElement) {
			return;
		}

		if (event.shiftKey && document.activeElement === firstElement) {
			event.preventDefault();
			lastElement.focus();
			return;
		}

		if (!event.shiftKey && document.activeElement === lastElement) {
			event.preventDefault();
			firstElement.focus();
		}
	}

	const modalElement = (
		<div className={styles['backdrop']} onMouseDown={onClose}>
			<dialog
				aria-labelledby={titleId}
				aria-modal="true"
				className={cx(styles['panel'], styles[size], className)}
				onKeyDown={handleDialogKeyDown}
				onMouseDown={(event) => event.stopPropagation()}
				open
				ref={panelRef}
				tabIndex={-1}
			>
				<span
					aria-hidden="true"
					className={styles['handle']}
					onPointerDown={handlePointerDown}
					onPointerUp={handlePointerUp}
				/>
				<h2 className="runa-sr-only" id={titleId}>
					{title}
				</h2>
				{children}
			</dialog>
		</div>
	);

	if (typeof document === 'undefined') {
		return modalElement;
	}

	return createPortal(modalElement, document.body);
}
