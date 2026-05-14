import { useEffect } from 'react';

export function useVisualViewport(): void {
	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) {
			return;
		}

		const onResize = (): void => {
			const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
			document.documentElement.style.setProperty('--keyboard-offset', `${offset}px`);
		};

		vv.addEventListener('resize', onResize);
		vv.addEventListener('scroll', onResize);
		onResize();

		return () => {
			vv.removeEventListener('resize', onResize);
			vv.removeEventListener('scroll', onResize);
			document.documentElement.style.removeProperty('--keyboard-offset');
		};
	}, []);
}
