import { describe, expect, it } from 'vitest';

import { fadeIn, scaleIn, slideInLeft, slideUp, smoothConfig, springConfig } from './motion.js';

const animateKey = 'animate';
const initialKey = 'initial';

describe('motion tokens', () => {
	it('exposes conservative shared animation variants', () => {
		expect(fadeIn[animateKey]).toMatchObject({ opacity: 1 });
		expect(slideUp[initialKey]).toMatchObject({ opacity: 0, y: 8 });
		expect(slideInLeft[initialKey]).toMatchObject({ opacity: 0, x: -16 });
		expect(scaleIn[initialKey]).toMatchObject({ opacity: 0, scale: 0.95 });
		expect(springConfig.damping).toBeGreaterThan(0);
		expect(smoothConfig.duration).toBeLessThanOrEqual(0.2);
	});
});
