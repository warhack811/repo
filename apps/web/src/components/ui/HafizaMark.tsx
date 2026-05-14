import type { ReactElement } from 'react';

export type HafizaMarkWeight = 'micro' | 'regular' | 'bold';
export type HafizaMarkVariant = 'brand' | 'mono';

type HafizaMarkProps = Readonly<{
	weight?: HafizaMarkWeight;
	variant?: HafizaMarkVariant;
	className?: string;
	'aria-label'?: string;
	'aria-hidden'?: boolean;
}>;

const markPaths: Record<HafizaMarkWeight, readonly string[]> = {
	micro: [
		'M24 5 C27.2 5 29.6 7.3 29.6 10.6 C29.6 13.7 27.3 16 24 16 C20.8 16 18.4 13.7 18.4 10.6 C18.4 7.3 20.8 5 24 5 Z',
		'M33.8 10.8 C36.9 11.1 39.1 13.9 38.8 17 C38.5 20 35.8 22.1 32.8 21.8 C29.7 21.5 27.6 18.9 27.9 15.8 C28.2 12.8 30.8 10.6 33.8 10.8 Z',
		'M35 27.1 C37.5 28.7 38.3 31.9 36.8 34.5 C35.2 37.2 32 38 29.4 36.5 C26.8 35 26 31.7 27.6 29.1 C29.1 26.5 32.4 25.6 35 27.1 Z',
		'M24.2 31.6 C27.3 31.7 29.7 34.2 29.6 37.2 C29.5 40.3 27 42.7 24 42.6 C20.9 42.5 18.5 40 18.6 37 C18.7 33.9 21.1 31.5 24.2 31.6 Z',
		'M12.9 27.3 C15.6 25.9 18.8 26.9 20.2 29.6 C21.6 32.3 20.6 35.5 17.9 36.9 C15.2 38.2 12 37.2 10.6 34.5 C9.2 31.8 10.2 28.7 12.9 27.3 Z',
		'M14.3 11 C17.4 10.8 20 13 20.3 16 C20.6 19.1 18.4 21.7 15.3 22 C12.3 22.3 9.6 20.1 9.3 17 C9 14 11.2 11.3 14.3 11 Z',
	],
	regular: [
		'M24 4 C27.9 4 31 7.1 31 11 C31 14.8 27.9 18 24 18 C20.1 18 17 14.8 17 11 C17 7.1 20.1 4 24 4 Z',
		'M34 10 C37.8 10.2 40.6 13.3 40.3 17.2 C40.1 20.8 37 23.6 33.2 23.3 C29.3 23.1 26.5 20 26.8 16.2 C27 12.3 30.1 9.6 34 10 Z',
		'M35 27 C38.2 28.8 39.2 32.8 37.4 36 C35.6 39.2 31.7 40.2 28.5 38.4 C25.3 36.6 24.2 32.7 26 29.5 C27.8 26.3 31.8 25.2 35 27 Z',
		'M24 30 C27.9 30 31 33.1 31 37 C31 40.9 27.9 44 24 44 C20.1 44 17 40.9 17 37 C17 33.1 20.1 30 24 30 Z',
		'M13 27 C16.2 25.2 20.2 26.3 22 29.5 C23.8 32.7 22.7 36.6 19.5 38.4 C16.3 40.2 12.4 39.2 10.6 36 C8.8 32.8 9.8 28.8 13 27 Z',
		'M14 10 C17.9 9.6 21 12.3 21.4 16.2 C21.8 20 19 23.1 15.2 23.5 C11.3 23.9 8.2 21.2 7.8 17.4 C7.4 13.5 10.2 10.4 14 10 Z',
	],
	bold: [
		'M24 3.5 C28.5 3.5 32 7.2 32 11.7 C32 16 28.5 19.6 24 19.6 C19.5 19.6 16 16 16 11.7 C16 7.2 19.5 3.5 24 3.5 Z',
		'M34.3 9.7 C38.6 10 41.8 13.6 41.5 17.9 C41.2 22 37.6 25.1 33.5 24.8 C29.2 24.5 26.1 20.9 26.4 16.6 C26.7 12.5 30.2 9.4 34.3 9.7 Z',
		'M35.6 26.4 C39.2 28.4 40.5 33 38.5 36.7 C36.5 40.3 32 41.5 28.3 39.5 C24.7 37.5 23.4 32.9 25.4 29.3 C27.4 25.6 31.9 24.4 35.6 26.4 Z',
		'M24 29.8 C28.5 29.8 32 33.4 32 37.9 C32 42.4 28.5 46 24 46 C19.5 46 16 42.4 16 37.9 C16 33.4 19.5 29.8 24 29.8 Z',
		'M12.4 26.4 C16.1 24.4 20.6 25.6 22.6 29.3 C24.6 32.9 23.3 37.5 19.7 39.5 C16 41.5 11.5 40.3 9.5 36.7 C7.5 33 8.8 28.4 12.4 26.4 Z',
		'M13.7 9.7 C17.8 9.3 21.3 12.2 21.8 16.4 C22.2 20.5 19.2 24.1 15.1 24.5 C10.9 24.9 7.4 21.9 7 17.8 C6.6 13.6 9.5 10.1 13.7 9.7 Z',
	],
};

const brandPalette = [
	'var(--accent)',
	'var(--accent-2)',
	'#9A9273',
	'var(--accent)',
	'var(--accent-2)',
	'#8E896E',
] as const;

const brandOpacity = [1, 0.94, 0.92, 0.9, 0.88, 0.9] as const;

export function HafizaMark({
	weight = 'regular',
	variant = 'brand',
	className,
	'aria-label': ariaLabel,
	'aria-hidden': ariaHidden,
}: HafizaMarkProps): ReactElement {
	const paths = markPaths[weight];
	const isMono = variant === 'mono';
	const shouldHide = ariaLabel ? false : (ariaHidden ?? true);
	const svgTitle = ariaLabel ?? 'Runa mark';
	const ariaProps = ariaLabel
		? { role: 'img' as const, 'aria-label': ariaLabel }
		: { 'aria-hidden': shouldHide };

	return (
		<span className={className ?? 'runa-mark'} {...ariaProps}>
			<svg viewBox="0 0 48 48" fill="none">
				<title>{svgTitle}</title>
				{paths.map((d, i) => (
					<path
						key={d}
						d={d}
						fill={isMono ? 'currentColor' : brandPalette[i]}
						opacity={isMono ? 1 : brandOpacity[i]}
					/>
				))}
			</svg>
		</span>
	);
}
