// @vitest-environment node

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webRoot = join(fileURLToPath(new URL('../../', import.meta.url)));
const sourceRoot = join(webRoot, 'src');

const cssScanRoots = ['styles', 'components/ui', 'components/chat', 'pages'] as const;

const userSurfaceTsxFiles = [
	'components/app/AppNav.tsx',
	'components/app/AppShell.tsx',
	'components/auth/OAuthButtons.tsx',
	'components/auth/ProfileCard.tsx',
	'pages/DevicesPage.tsx',
	'pages/HistoryPage.tsx',
	'pages/HistoryRoute.tsx',
	'pages/LoginPage.tsx',
	'pages/SettingsPage.tsx',
] as const;

const allowedFontSizes = new Set(['12px', '14px', '16px', '20px', '28px']);
const allowedTokenFontSizes = new Set(['var(--text-xs)', 'var(--text-sm)', 'var(--text-md)']);
const allowedRemFontSizes = new Set(['0.75rem', '0.875rem', '1rem', '1.25rem', '1.75rem']);

function walkFiles(root: string, predicate: (path: string) => boolean): string[] {
	const files: string[] = [];

	function visit(dir: string): void {
		for (const entry of readdirSync(dir)) {
			const fullPath = join(dir, entry);
			const info = statSync(fullPath);

			if (info.isDirectory()) {
				visit(fullPath);
				continue;
			}

			if (info.isFile() && predicate(fullPath)) {
				files.push(fullPath);
			}
		}
	}

	visit(root);
	return files;
}

function toRepoPath(path: string): string {
	return relative(webRoot, path).split(sep).join('/');
}

function readCssFiles(): readonly { content: string; path: string }[] {
	return cssScanRoots.flatMap((root) =>
		walkFiles(join(sourceRoot, root), (filePath) => filePath.endsWith('.css')).map((filePath) => ({
			content: readFileSync(filePath, 'utf8'),
			path: toRepoPath(filePath),
		})),
	);
}

function readUserFacingTsxFiles(): readonly { content: string; path: string }[] {
	return userSurfaceTsxFiles.map((filePath) => {
		const absolutePath = join(sourceRoot, filePath);

		return {
			content: readFileSync(absolutePath, 'utf8'),
			path: toRepoPath(absolutePath),
		};
	});
}

describe('visual discipline guardrails', () => {
	it('keeps CTA backgrounds flat instead of gradient-driven', () => {
		const violations = readCssFiles().flatMap(({ content, path }) => {
			const matches = [
				...content.matchAll(/background:\s*(?:linear-gradient|radial-gradient)\b/gu),
			];

			return matches.map((match) => `${path}:${content.slice(0, match.index).split('\n').length}`);
		});

		expect(violations).toEqual([]);

		const buttonCss = readFileSync(join(sourceRoot, 'components/ui/RunaButton.module.css'), 'utf8');
		expect(buttonCss).not.toMatch(/gradient-primary-button|linear-gradient|radial-gradient/u);
	});

	it('limits user-facing CSS typography to the 7.6 size and weight scale', () => {
		const weightViolations = readCssFiles().flatMap(({ content, path }) =>
			[...content.matchAll(/font-weight:\s*(\d+)\s*;/gu)]
				.filter((match) => Number(match[1]) > 600)
				.map((match) => `${path}:${content.slice(0, match.index).split('\n').length}`),
		);
		const sizeViolations = readCssFiles().flatMap(({ content, path }) =>
			[...content.matchAll(/font-size:\s*([^;]+);/gu)]
				.filter((match) => {
					const value = (match[1] ?? '').trim();

					return (
						!allowedFontSizes.has(value) &&
						!allowedTokenFontSizes.has(value) &&
						!allowedRemFontSizes.has(value)
					);
				})
				.map((match) => `${path}:${content.slice(0, match.index).split('\n').length}`),
		);

		expect(weightViolations).toEqual([]);
		expect(sizeViolations).toEqual([]);
	});

	it('keeps normal user surfaces free of card-within-card class patterns and internal leaks', () => {
		const nestedCardViolations = readUserFacingTsxFiles().flatMap(({ content, path }) =>
			[...content.matchAll(/className="[^"]*runa-card[^"]*runa-card--subtle/gu)].map(
				(match) => `${path}:${content.slice(0, match.index).split('\n').length}`,
			),
		);
		const leakageViolations = readUserFacingTsxFiles().flatMap(({ content, path }) =>
			['Developer', 'Project Memory', 'raw transport', 'raw connection'].flatMap((term) =>
				content.includes(term) ? [`${path}:${term}`] : [],
			),
		);

		expect(nestedCardViolations).toEqual([]);
		expect(leakageViolations).toEqual([]);
	});

	it('keeps decorative orb and ambient blob pseudos out of normal surfaces', () => {
		const decorativePseudoViolations = readCssFiles().flatMap(({ content, path }) =>
			['.runa-ambient-panel::before', '.runa-chat-surface::after'].flatMap((selector) =>
				content.includes(selector) ? [`${path}:${selector}`] : [],
			),
		);

		expect(decorativePseudoViolations).toEqual([]);
	});
});
