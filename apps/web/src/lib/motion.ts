import type { Variants } from 'motion/react';

export const fadeIn: Variants = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
};

export const slideUp: Variants = {
	initial: { opacity: 0, y: 8 },
	animate: { opacity: 1, y: 0 },
	exit: { opacity: 0, y: -4 },
};

export const slideInLeft: Variants = {
	initial: { x: -16, opacity: 0 },
	animate: { x: 0, opacity: 1 },
	exit: { x: -16, opacity: 0 },
};

export const scaleIn: Variants = {
	initial: { opacity: 0, scale: 0.95 },
	animate: { opacity: 1, scale: 1 },
	exit: { opacity: 0, scale: 0.95 },
};

export const staggerContainer: Variants = {
	animate: {
		transition: { staggerChildren: 0.05 },
	},
};

export const springConfig = {
	type: 'spring' as const,
	stiffness: 400,
	damping: 30,
};

export const smoothConfig = {
	duration: 0.2,
	ease: [0.4, 0, 0.2, 1] as const,
};
