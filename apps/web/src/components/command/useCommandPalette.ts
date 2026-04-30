import { useEffect, useRef, useState } from 'react';

type UseCommandPaletteResult = Readonly<{
	closePalette: () => void;
	isOpen: boolean;
	openPalette: () => void;
}>;

export function isCommandPaletteKeyboardShortcut(
	event: Pick<KeyboardEvent, 'ctrlKey' | 'key' | 'metaKey'>,
): boolean {
	return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey);
}

export function useCommandPalette(): UseCommandPaletteResult {
	const [isOpen, setIsOpen] = useState(false);
	const triggerElementRef = useRef<HTMLElement | null>(null);

	function openPalette(): void {
		if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
			triggerElementRef.current = document.activeElement;
		}

		setIsOpen(true);
	}

	function closePalette(): void {
		setIsOpen(false);

		if (typeof window !== 'undefined') {
			window.requestAnimationFrame(() => {
				triggerElementRef.current?.focus();
				triggerElementRef.current = null;
			});
		}
	}

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		function handleKeyDown(event: KeyboardEvent): void {
			if (!isCommandPaletteKeyboardShortcut(event)) {
				return;
			}

			event.preventDefault();

			if (document.activeElement instanceof HTMLElement) {
				triggerElementRef.current = document.activeElement;
			}

			setIsOpen(true);
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	}, []);

	return {
		closePalette,
		isOpen,
		openPalette,
	};
}
