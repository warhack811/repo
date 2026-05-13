// @vitest-environment node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const webSrcRoot = join(repoRoot, 'apps', 'web', 'src');
const stylesRoot = join(webSrcRoot, 'styles');
const tokensPath = join(stylesRoot, 'tokens.css');
const fontsPath = join(stylesRoot, 'fonts.css');
const designTokensPath = join(webSrcRoot, 'lib', 'design-tokens.ts');
const hafizaMarkPath = join(webSrcRoot, 'components', 'ui', 'HafizaMark.tsx');
const emptyStatePath = join(webSrcRoot, 'components', 'chat', 'EmptyState.tsx');
const removedRightRailPath = join(webSrcRoot, 'components', 'chat', `Work${'Insight'}Panel.tsx`);
const chatLayoutPath = join(webSrcRoot, 'components', 'chat', 'ChatLayout.tsx');
const appShellPath = join(webSrcRoot, 'components', 'app', 'AppShell.tsx');
const componentsCssPath = join(stylesRoot, 'components.css');

function collectFiles(dir: string, extension: string): string[] {
	const entries = readdirSync(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const absolutePath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectFiles(absolutePath, extension));
			continue;
		}

		if (entry.isFile() && absolutePath.endsWith(extension)) {
			files.push(absolutePath);
		}
	}

	return files;
}

function parsePxValue(body: string, propertyName: string): number | null {
	const match = new RegExp(`${propertyName}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)px`, 'i').exec(body);
	if (!match) {
		return null;
	}

	return Number(match[1]);
}

function parseUnitlessValue(body: string, propertyName: string): number | null {
	const match = new RegExp(`${propertyName}\\s*:\\s*([0-9]+)\\s*;`, 'i').exec(body);
	if (!match) {
		return null;
	}

	return Number(match[1]);
}

describe('design language lock', () => {
	it('locks ember token family and typography contract', () => {
		const tokens = readFileSync(tokensPath, 'utf8');
		const fonts = readFileSync(fontsPath, 'utf8');
		const hafizaMark = readFileSync(hafizaMarkPath, 'utf8');
		const emptyState = readFileSync(emptyStatePath, 'utf8');
		const designTokensSource = readFileSync(designTokensPath, 'utf8');

		expect(tokens).toMatch(/--surface-1:\s*#14110d;/i);
		expect(tokens).toMatch(/--accent:\s*#e0805c;/i);
		expect(tokens).toMatch(/--ink-3:\s*#9a8c76;/i);
		expect(fonts).toContain('--font-serif: "Instrument Serif"');

		expect(hafizaMark).toContain("export type HafizaMarkWeight = 'micro' | 'regular' | 'bold'");
		expect(hafizaMark).toContain("export type HafizaMarkVariant = 'brand' | 'mono'");
		expect(hafizaMark).toContain('const markPaths: Record<HafizaMarkWeight, readonly string[]>');
		expect(hafizaMark).toContain('micro: [');
		expect(hafizaMark).toContain('regular: [');
		expect(hafizaMark).toContain('bold: [');

		expect(emptyState).toContain("import { HafizaMark } from '../ui/HafizaMark.js'");
		expect(emptyState).toContain('<HafizaMark');

		expect(designTokensSource).toMatch(/fast:\s*'var\(--duration-fast\)'/);
		expect(designTokensSource).toMatch(/normal:\s*'var\(--duration-normal\)'/);
		expect(designTokensSource).toMatch(/button:\s*'var\(--radius-panel\)'/);
		expect(designTokensSource).toMatch(/control:\s*'var\(--radius-panel\)'/);
		expect(designTokensSource).toMatch(/image:\s*'var\(--radius-panel\)'/);

		const forbiddenLiteralPatterns = [/'180ms'/g, /'220ms'/g, /'14px'/g];
		for (const pattern of forbiddenLiteralPatterns) {
			expect(designTokensSource.match(pattern) ?? []).toHaveLength(0);
		}
	});

	it('rejects legacy token families from source styles', () => {
		const cssFiles = collectFiles(webSrcRoot, '.css');
		const source = cssFiles.map((filePath) => readFileSync(filePath, 'utf8')).join('\n');
		const legacyColorBgRef = `var(--${'color-bg'}`;
		const legacyColorAccentRef = `var(--${'color-accent'}`;
		const legacyGradientPanelRef = `var(--${'gradient-panel'}`;

		expect(source).not.toContain(legacyColorBgRef);
		expect(source).not.toContain(legacyColorAccentRef);
		expect(source).not.toContain(legacyGradientPanelRef);
	});

	it('locks the PR-2 layout shell contract', () => {
		const chatLayout = readFileSync(chatLayoutPath, 'utf8');
		const appShell = readFileSync(appShellPath, 'utf8');
		const componentsCss = readFileSync(componentsCssPath, 'utf8');
		const chatBranchStart = appShell.indexOf("if (activePage === 'chat')");
		const appShellBranchStart = appShell.indexOf(
			'<div className="runa-page runa-page--app-shell',
			chatBranchStart,
		);
		const chatBranch = appShell.slice(chatBranchStart, appShellBranchStart);

		expect(existsSync(removedRightRailPath)).toBe(false);
		expect(chatLayout).not.toContain('insights');
		expect(componentsCss).toContain('grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);');
		expect(chatBranch).not.toContain('runa-command-palette-trigger');
	});

	it('disallows ink-3 on small or lightweight text blocks', () => {
		const cssFiles = collectFiles(webSrcRoot, '.css');
		const violations: string[] = [];
		const blockRegex = /([^{}]+)\{([^{}]*)\}/gms;

		for (const filePath of cssFiles) {
			const content = readFileSync(filePath, 'utf8');
			for (const block of content.matchAll(blockRegex)) {
				const selector = block[1]?.trim() ?? '(unknown)';
				const body = block[2] ?? '';

				if (!body.includes('var(--ink-3)')) {
					continue;
				}

				const fontSize = parsePxValue(body, 'font-size');
				const fontWeight = parseUnitlessValue(body, 'font-weight');
				const isSmallText = fontSize !== null && fontSize < 18;
				const isLightWeight = fontWeight === null || fontWeight < 600;

				if (isSmallText && isLightWeight) {
					violations.push(`${filePath} :: ${selector}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});
});
