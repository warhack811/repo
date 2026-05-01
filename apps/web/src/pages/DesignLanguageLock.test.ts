// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const designLanguagePath = join(repoRoot, 'docs', 'RUNA-DESIGN-LANGUAGE.md');

describe('Runa design language lock', () => {
	it('documents the final UI guardrails for future work', () => {
		const content = readFileSync(designLanguagePath, 'utf8');
		const requiredHeadings = [
			'## Product Feel',
			'## Surface Hierarchy',
			'## Layout Rules',
			'## Color & Tone',
			'## Typography',
			'## Motion & Microinteraction',
			'## Loading',
			'## Accessibility & Keyboard',
			'## Mobile Rules',
			'## Copy Voice',
			'## Checklist For Future UI Tasks',
		];

		for (const heading of requiredHeadings) {
			expect(content).toContain(heading);
		}

		expect(content).toContain('12 / 14 / 16 / 20 / 28');
		expect(content).toContain('400 / 500 / 600');
		expect(content).toContain('Cmd+K');
		expect(content).toContain('Ctrl+K');
		expect(content).toContain('Top navigation intentionally uses compact route tiles');
		expect(content).toContain('Approval actions are risk-aware');
		expect(content).toContain('320');
		expect(content).toContain('390');
		expect(content).toContain('414');
		expect(content.toLocaleLowerCase('en-US')).toContain('skeleton');
		expect(content).toContain('developer');
		expect(content).toContain('operator');
	});
});
