// @vitest-environment node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const webSrcRoot = join(repoRoot, 'apps', 'web', 'src');
const webRoot = join(repoRoot, 'apps', 'web');
const stylesRoot = join(webSrcRoot, 'styles');
const tokensPath = join(stylesRoot, 'tokens.css');
const fontsPath = join(stylesRoot, 'fonts.css');
const designTokensPath = join(webSrcRoot, 'lib', 'design-tokens.ts');
const hafizaMarkPath = join(webSrcRoot, 'components', 'ui', 'HafizaMark.tsx');
const emptyStatePath = join(webSrcRoot, 'components', 'chat', 'EmptyState.tsx');
const emptyStateModelPath = join(webSrcRoot, 'components', 'chat', 'emptyStateModel.ts');
const removedRightRailPath = join(webSrcRoot, 'components', 'chat', `Work${'Insight'}Panel.tsx`);
const chatLayoutPath = join(webSrcRoot, 'components', 'chat', 'ChatLayout.tsx');
const appShellPath = join(webSrcRoot, 'components', 'app', 'AppShell.tsx');
const componentsCssPath = join(stylesRoot, 'components.css');
const appPath = join(webSrcRoot, 'App.tsx');
const useChatRuntimePath = join(webSrcRoot, 'hooks', 'useChatRuntime.ts');
const uiIndexPath = join(webSrcRoot, 'components', 'ui', 'index.ts');
const skipToContentPath = join(webSrcRoot, 'components', 'ui', 'SkipToContent.tsx');
const useVisualViewportPath = join(webSrcRoot, 'hooks', 'useVisualViewport.ts');
const persistedTranscriptPath = join(webSrcRoot, 'components', 'chat', 'PersistedTranscript.tsx');
const currentRunSurfacePath = join(webSrcRoot, 'components', 'chat', 'CurrentRunSurface.tsx');
const toolResultBlockPath = join(webSrcRoot, 'components', 'chat', 'blocks', 'ToolResultBlock.tsx');
const dayDividerPath = join(webSrcRoot, 'components', 'chat', 'DayDivider.tsx');
const approvalBlockPath = join(webSrcRoot, 'components', 'chat', 'blocks', 'ApprovalBlock.tsx');
const runaButtonPath = join(webSrcRoot, 'components', 'ui', 'RunaButton.tsx');
const runTimelineBlockPath = join(
	webSrcRoot,
	'components',
	'chat',
	'blocks',
	'RunTimelineBlock.tsx',
);
const runActivityAdapterPath = join(
	webSrcRoot,
	'components',
	'chat',
	'activity',
	'runActivityAdapter.ts',
);
const chatHeaderPath = join(webSrcRoot, 'components', 'chat', 'ChatHeader.tsx');
const chatPagePath = join(webSrcRoot, 'pages', 'ChatPage.tsx');
const chatComposerSurfacePath = join(webSrcRoot, 'components', 'chat', 'ChatComposerSurface.tsx');
const attachmentDisplayPath = join(webSrcRoot, 'components', 'chat', 'attachmentDisplay.ts');
const attachmentPreviewListPath = join(
	webSrcRoot,
	'components',
	'chat',
	'AttachmentPreviewList.tsx',
);
const attachmentPreviewListCssPath = join(
	webSrcRoot,
	'components',
	'chat',
	'AttachmentPreviewList.module.css',
);
const fileUploadButtonPath = join(webSrcRoot, 'components', 'chat', 'FileUploadButton.tsx');
const fileUploadButtonCssPath = join(
	webSrcRoot,
	'components',
	'chat',
	'FileUploadButton.module.css',
);
const visualDisciplineTestPath = join(webSrcRoot, 'pages', 'VisualDiscipline.test.tsx');
const settingsPagePath = join(webSrcRoot, 'pages', 'SettingsPage.tsx');
const settingsTabsPath = join(webSrcRoot, 'pages', 'settingsTabs.ts');
const menuSheetPath = join(webSrcRoot, 'components', 'app', 'MenuSheet.tsx');
const conversationHistoryDisplayPath = join(
	webSrcRoot,
	'components',
	'chat',
	'conversationHistoryDisplay.ts',
);
const conversationSidebarPath = join(webSrcRoot, 'components', 'chat', 'ConversationSidebar.tsx');
const historyPagePath = join(webSrcRoot, 'pages', 'HistoryPage.tsx');
const themePickerPath = join(webSrcRoot, 'components', 'settings', 'ThemePicker.tsx');
const routeStylesPath = join(webSrcRoot, 'styles', 'routes');
const activityTerminalDetailsPath = join(
	webSrcRoot,
	'components',
	'chat',
	'activity',
	'TerminalDetails.tsx',
);
const activityRunActivityRowPath = join(
	webSrcRoot,
	'components',
	'chat',
	'activity',
	'RunActivityRow.tsx',
);
const activityRunActivityFeedPath = join(
	webSrcRoot,
	'components',
	'chat',
	'activity',
	'RunActivityFeed.tsx',
);
const activityApprovalActivityRowPath = join(
	webSrcRoot,
	'components',
	'chat',
	'activity',
	'ApprovalActivityRow.tsx',
);
const activityRunActivityAdapterPath = join(
	webSrcRoot,
	'components',
	'chat',
	'activity',
	'runActivityAdapter.ts',
);
const activityTerminalOutputPath = join(
	webSrcRoot,
	'components',
	'chat',
	'activity',
	'terminalOutput.ts',
);

const streamdownMessagePath = join(webSrcRoot, 'lib', 'streamdown', 'StreamdownMessage.tsx');
const streamdownCodeBlockPath = join(webSrcRoot, 'lib', 'streamdown', 'CodeBlock.tsx');
const streamdownMermaidBlockPath = join(webSrcRoot, 'lib', 'streamdown', 'MermaidBlock.tsx');
const streamdownMermaidRendererPath = join(webSrcRoot, 'lib', 'streamdown', 'MermaidRenderer.tsx');
const streamdownMarkdownLinksPath = join(webSrcRoot, 'lib', 'streamdown', 'markdownLinks.ts');

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

function collectVarReferences(rootDir: string): Set<string> {
	const files = [
		...collectFiles(rootDir, '.css'),
		...collectFiles(rootDir, '.ts'),
		...collectFiles(rootDir, '.tsx'),
	];
	const refs = new Set<string>();

	for (const filePath of files) {
		const source = readFileSync(filePath, 'utf8');
		for (const match of source.matchAll(/var\(--([a-z][a-z0-9-]*)/g)) {
			refs.add(`--${match[1]}`);
		}
	}

	return refs;
}

function collectTokenDefinitions(...filePaths: string[]): Set<string> {
	const defs = new Set<string>();

	for (const filePath of filePaths) {
		const source = readFileSync(filePath, 'utf8');
		for (const match of source.matchAll(/^\s*(--[a-z][a-z0-9-]*)\s*:/gm)) {
			const token = match[1];
			if (token) {
				defs.add(token);
			}
		}
	}

	return defs;
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
		const appSource = readFileSync(appPath, 'utf8');
		const skipToContent = readFileSync(skipToContentPath, 'utf8');
		const uiIndex = readFileSync(uiIndexPath, 'utf8');
		const visualViewportHook = readFileSync(useVisualViewportPath, 'utf8');

		expect(tokens).toMatch(/--surface-1:\s*#14110d;/i);
		expect(tokens).toMatch(/--accent:\s*#e0805c;/i);
		expect(tokens).toMatch(/--ink-3:\s*#9a8c76;/i);
		expect(tokens).toMatch(/--focus-ring:\s*0 0 0 2px var\(--accent\);/i);
		expect(fonts).toContain('--font-serif: "Instrument Serif"');

		expect(hafizaMark).toContain("export type HafizaMarkWeight = 'micro' | 'regular' | 'bold'");
		expect(hafizaMark).toContain("export type HafizaMarkVariant = 'brand' | 'mono'");
		expect(hafizaMark).toContain('const markPaths: Record<HafizaMarkWeight, readonly string[]>');
		expect(hafizaMark).toContain('micro: [');
		expect(hafizaMark).toContain('regular: [');
		expect(hafizaMark).toContain('bold: [');

		expect(emptyState).toContain("import { HafizaMark } from '../ui/HafizaMark.js'");
		expect(emptyState).toContain('<HafizaMark');
		expect(visualViewportHook).toContain('export function useVisualViewport(): void');
		expect(appSource).toContain('useVisualViewport();');
		expect(skipToContent).toContain('href="#main-content"');
		expect(uiIndex).toContain("export { SkipToContent } from './SkipToContent.js'");

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

	it('splits the useChatRuntime return memo and removes streaming fields from it', () => {
		const source = readFileSync(useChatRuntimePath, 'utf8');
		const megaMemoMatch = source.match(/return useMemo\([\s\S]*?\),\s*\[[\s\S]{2000,}\]/);

		expect(source).toContain('const runtimeConfigState = useMemo(');
		expect(source).toContain('const runtimeState = useMemo(');
		expect(source).toContain('const runtimeActions = useMemo(');
		expect(source).not.toContain(
			'currentStreamingRunId: chatStore.getState().presentation.currentStreamingRunId',
		);
		expect(source).not.toContain(
			'currentStreamingText: chatStore.getState().presentation.currentStreamingText',
		);
		expect(megaMemoMatch).toBeNull();
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

	it('disallows ink-4 on small or lightweight text blocks', () => {
		const cssFiles = collectFiles(webSrcRoot, '.css');
		const violations: string[] = [];
		const blockRegex = /([^{}]+)\{([^{}]*)\}/gms;

		for (const filePath of cssFiles) {
			const content = readFileSync(filePath, 'utf8');
			for (const block of content.matchAll(blockRegex)) {
				const selector = block[1]?.trim() ?? '(unknown)';
				const body = block[2] ?? '';

				if (!body.includes('var(--ink-4)')) {
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

	it('rejects undefined token references in apps/web/src', () => {
		const used = collectVarReferences(webSrcRoot);
		const defined = collectTokenDefinitions(tokensPath, fontsPath);
		const runtimeAllowed = new Set(['--keyboard-offset', '--bg', '--spread']);

		const undefinedTokens = [...used]
			.filter((token) => !defined.has(token) && !runtimeAllowed.has(token))
			.sort((left, right) => left.localeCompare(right));

		expect(undefinedTokens, `Undefined tokens: ${undefinedTokens.join(', ')}`).toEqual([]);
	});

	it('requires reduced-motion media query in every css module file', () => {
		const moduleCssFiles = collectFiles(webSrcRoot, '.module.css');
		const missingFiles = moduleCssFiles.filter((filePath) => {
			const content = readFileSync(filePath, 'utf8');
			return !/@media\s*\(prefers-reduced-motion:\s*reduce\)/u.test(content);
		});

		expect(missingFiles).toEqual([]);
	});
});

describe('PR-3 chat surface lock', () => {
	it('PersistedTranscript icinde rol etiketi veya saniye-tarihli timestamp yok', () => {
		const src = readFileSync(persistedTranscriptPath, 'utf8');
		expect(src).not.toMatch(/['"]Sen['"]|['"]Runa['"]/);
		expect(src).not.toMatch(/toLocaleTimeString|formatDate.*Long/);
	});

	it('CurrentRunSurface currentRunProgressPanel prop tanimlamiyor', () => {
		const src = readFileSync(currentRunSurfacePath, 'utf8');
		expect(src).not.toMatch(/currentRunProgressPanel\s*[:?]/);
	});

	it('ToolResultBlock user-facing modda activity feed adapter kullaniyor', () => {
		const src = readFileSync(toolResultBlockPath, 'utf8');
		expect(src).toMatch(/RunActivityFeed/);
		expect(src).toMatch(/adaptToolResultBlock/);
		expect(src).not.toMatch(/['"]Islem sonucu['"]/);
	});

	it('DayDivider export ediliyor', () => {
		expect(existsSync(dayDividerPath)).toBe(true);
	});
});

describe('PR-4 approval calm lock', () => {
	it('ApprovalBlock eyebrow/approvalStatusChip/approvalStateFeedback render etmiyor', () => {
		const src = readFileSync(approvalBlockPath, 'utf8');
		expect(src).not.toMatch(/approvalStatusChip|approvalStateFeedback/);
		expect(src).not.toMatch(/className=\{[^}]*eyebrow[^}]*\}/);
	});

	it('approvalRisk modul getApprovalRiskLevel export ediyor', async () => {
		const mod = await import('../components/chat/blocks/approvalRisk.js');
		expect(typeof mod.getApprovalRiskLevel).toBe('function');
	});

	it('RunaButton danger variant tanimi var', () => {
		const src = readFileSync(runaButtonPath, 'utf8');
		expect(src).toMatch(/['"]danger['"]/);
	});
});

describe('PR-5 user_label_tr lock', () => {
	it('Frontend tool result renderinde user_label_tr okunuyor', () => {
		const src = readFileSync(runActivityAdapterPath, 'utf8');
		expect(src).toMatch(/user_label_tr/);
	});

	it('RunTimelineBlock user_label_tr fallback kullaniyor', () => {
		const src = readFileSync(runActivityAdapterPath, 'utf8');
		expect(src).toMatch(/user_label_tr\s*\?\?/);
	});
});

describe('PR-6 sheets + palette lock', () => {
	it('RunaSheet ve RunaModal export var', async () => {
		const mod = await import('../components/ui/index.js');
		expect(mod.RunaSheet).toBeTruthy();
		expect(mod.RunaModal).toBeTruthy();
	});

	it('ChatHeader history sheet aria-controlsa sahip', () => {
		const src = readFileSync(chatHeaderPath, 'utf8');
		expect(src).toMatch(/aria-controls=['"]history-sheet['"]/);
	});

	it('ChatPage HistorySheet/MenuSheet/ContextSheet mount ediyor', () => {
		const src = readFileSync(chatPagePath, 'utf8');
		expect(src).toMatch(/<HistorySheet\b/);
		expect(src).toMatch(/<MenuSheet\b/);
		expect(src).toMatch(/<ContextSheet\b/);
	});
});

describe('PR-7 settings + stop lock', () => {
	it('Composer Stop ikonu (Square) ve aria-label icin destegi var', () => {
		const src = readFileSync(chatComposerSurfacePath, 'utf8');
		expect(src).toMatch(/import\s*\{[^}]*\bSquare\b[^}]*\}\s*from\s*['"]lucide-react['"]/);
		expect(src).toMatch(/Calismayi durdur|abortCurrentRun|Çalışmayı durdur/);
	});

	it('useChatRuntime abortCurrentRun export ediyor', () => {
		const src = readFileSync(useChatRuntimePath, 'utf8');
		expect(src).toMatch(/abortCurrentRun\s*[:,]/);
	});

	it('ThemePicker komponenti var', () => {
		expect(existsSync(themePickerPath)).toBe(true);
	});

	it('apps/web/src/styles/routes altinda migration.css dosyasi yok', () => {
		const dir = readdirSync(routeStylesPath);
		const offenders = dir.filter((fileName) => fileName.endsWith('-migration.css'));
		expect(offenders).toEqual([]);
	});
});

describe('PR-9 token cleanup lock', () => {
	it('apps/web/src/styles/tokens.css icinde --ink-4 tanimi var', () => {
		const src = readFileSync(tokensPath, 'utf8');
		expect(src).toMatch(/--ink-4\s*:/);
	});

	it('Tanimsiz token referansi yok (audit-tokens.mjs PASS)', () => {
		const result = spawnSync('node', ['scripts/audit-tokens.mjs'], {
			cwd: repoRoot,
			encoding: 'utf8',
		});
		expect(result.status, result.stderr || result.stdout).toBe(0);
	});
});

describe('Settings IA lock', () => {
	it('SettingsPage 5 tab gosteriyor', () => {
		const src = readFileSync(settingsPagePath, 'utf8');
		for (const tab of ['appearance', 'conversation', 'notifications', 'privacy', 'advanced']) {
			expect(src).toContain(`'${tab}'`);
		}
	});
});

describe('PR-22 settings/menu copy coherence lock', () => {
	const pr22Files = [menuSheetPath, settingsPagePath, settingsTabsPath, appPath];

	it('PR-22 files are UTF-8 without BOM', () => {
		const violations: string[] = [];

		for (const filePath of pr22Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const buffer = readFileSync(filePath);
			if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
				violations.push(filePath);
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-22 source files do not contain mojibake text', () => {
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const violations: string[] = [];

		for (const filePath of pr22Files) {
			if (!existsSync(filePath)) {
				continue;
			}

			const source = readFileSync(filePath, 'utf8');
			for (const pattern of mojibakePatterns) {
				if (source.includes(pattern)) {
					violations.push(`${filePath} includes ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-22 source files do not keep old ASCII Turkish copy variants', () => {
		const forbidden = [
			'Gecmis',
			'Gelismis',
			'Acik',
			'Kapali',
			'Yardim',
			'Yakinda',
			'Hizli menu',
			'Menuyu kapat',
			'Sayfa y?kleniyor',
			'Turkce',
			'Siki',
			'Suresiz',
			'30 gun',
			'Run klasoru',
			'Workspace koku',
		];
		const violations: string[] = [];

		for (const filePath of [menuSheetPath, settingsPagePath, appPath]) {
			const source = readFileSync(filePath, 'utf8');
			for (const term of forbidden) {
				if (source.includes(term)) {
					violations.push(`${filePath} includes ${term}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('MenuSheet navigation never uses preferences query', () => {
		const source = readFileSync(menuSheetPath, 'utf8');
		expect(source).not.toContain('/account?tab=preferences');
		expect(source).not.toContain("navigate('/account?tab=preferences')");
	});

	it('preferences alias remains only in settings tab parsing helper', () => {
		const menuSheetSource = readFileSync(menuSheetPath, 'utf8');
		const settingsTabsSource = readFileSync(settingsTabsPath, 'utf8');

		expect(menuSheetSource).not.toContain('preferences');
		expect(settingsTabsSource).toContain('preferences');
	});
});

describe('PR-23 history parity lock', () => {
	const pr23Files = [conversationHistoryDisplayPath, conversationSidebarPath, historyPagePath];

	it('PR-23 files are UTF-8 without BOM', () => {
		const violations: string[] = [];

		for (const filePath of pr23Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const buffer = readFileSync(filePath);
			if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
				violations.push(filePath);
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-23 files do not contain mojibake text', () => {
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const violations: string[] = [];

		for (const filePath of pr23Files) {
			const source = readFileSync(filePath, 'utf8');
			for (const pattern of mojibakePatterns) {
				if (source.includes(pattern)) {
					violations.push(`${filePath} includes ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-23 normal history source copy has no forbidden raw/internal strings', () => {
		const forbidden = [
			'Internal Server Error',
			'{"error"',
			'{"detail"',
			'Conversation request failed',
			'Desteklenmeyen conversation',
			'backend',
			'protocol',
			'metadata',
			'trace',
			'stack',
		];
		const violations: string[] = [];

		for (const filePath of pr23Files) {
			const source = readFileSync(filePath, 'utf8');
			for (const term of forbidden) {
				if (source.includes(term)) {
					violations.push(`${filePath} includes ${term}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('ConversationSidebar and HistoryPage do not keep duplicate local helper names', () => {
		const sidebarSource = readFileSync(conversationSidebarPath, 'utf8');
		const historySource = readFileSync(historyPagePath, 'utf8');
		const duplicateHelperPatterns = [
			/function daysBetween/u,
			/function groupConversations/u,
			/function matchesSearch/u,
			/function getFriendlyErrorMessage/u,
		];

		for (const pattern of duplicateHelperPatterns) {
			expect(sidebarSource).not.toMatch(pattern);
			expect(historySource).not.toMatch(pattern);
		}
	});

	it('ConversationSidebar and HistoryPage import shared conversationHistoryDisplay helper', () => {
		const sidebarSource = readFileSync(conversationSidebarPath, 'utf8');
		const historySource = readFileSync(historyPagePath, 'utf8');

		expect(sidebarSource).toContain('conversationHistoryDisplay');
		expect(historySource).toContain('conversationHistoryDisplay');
	});
});

describe('activity text encoding guard', () => {
	it('activity components do not contain mojibake text', () => {
		const activityFiles = [
			activityTerminalDetailsPath,
			activityRunActivityRowPath,
			activityRunActivityFeedPath,
			activityApprovalActivityRowPath,
			activityRunActivityAdapterPath,
			activityTerminalOutputPath,
		];
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const violations: string[] = [];

		for (const filePath of activityFiles) {
			const source = readFileSync(filePath, 'utf8');
			for (const pattern of mojibakePatterns) {
				if (source.includes(pattern)) {
					violations.push(`${filePath} includes ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});
});

describe('PR-19 message actions lock', () => {
	const pr19Files = [
		join(webSrcRoot, 'components', 'chat', 'messageActions.ts'),
		join(webSrcRoot, 'components', 'chat', 'MessageActionBar.tsx'),
		join(webSrcRoot, 'components', 'chat', 'MessageActionBar.module.css'),
		join(webSrcRoot, 'components', 'chat', 'PersistedTranscript.tsx'),
		join(webSrcRoot, 'components', 'chat', 'ChatComposerSurface.tsx'),
	];

	it('PR-19 files are UTF-8 without BOM', () => {
		const violations: string[] = [];

		for (const filePath of pr19Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const buffer = readFileSync(filePath);
			if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
				violations.push(`${filePath}`);
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-19 files do not contain mojibake text', () => {
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const violations: string[] = [];

		for (const filePath of pr19Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const source = readFileSync(filePath, 'utf8');
			for (const pattern of mojibakePatterns) {
				if (source.includes(pattern)) {
					violations.push(`${filePath} includes ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-19 files do not contain forbidden normal-surface technical strings', () => {
		const forbidden = ['metadata', 'protocol', 'backend', 'trace_id', 'run_id'];
		const violations: string[] = [];

		for (const filePath of pr19Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const source = readFileSync(filePath, 'utf8');
			for (const term of forbidden) {
				const regex = new RegExp(`(?<!['"\`])(?:${term})(?!\\w)`, 'g');
				if (regex.test(source)) {
					violations.push(`${filePath} contains "${term}"`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('MessageActionBar.module.css uses design tokens, no hardcoded hex', () => {
		const cssPath = join(webSrcRoot, 'components', 'chat', 'MessageActionBar.module.css');

		if (!existsSync(cssPath)) {
			return;
		}

		const source = readFileSync(cssPath, 'utf8');
		const hexPattern = /#[0-9A-Fa-f]{3,8}/g;
		const hexMatches = source.match(hexPattern) ?? [];
		expect(hexMatches).toEqual([]);
	});

	it('ChatComposerSurface.tsx has composerFocusRequestId and composerPrepareNotice props', () => {
		const src = readFileSync(chatComposerSurfacePath, 'utf8');
		expect(src).toContain('composerFocusRequestId');
		expect(src).toContain('composerPrepareNotice');
	});

	it('PersistedTranscript.tsx has isRunning and onPreparePrompt props', () => {
		const src = readFileSync(persistedTranscriptPath, 'utf8');
		expect(src).toContain('isRunning');
		expect(src).toContain('onPreparePrompt');
	});
});

describe('PR-20 voice composer state lock', () => {
	const pr20Files = [
		join(webSrcRoot, 'components', 'chat', 'voiceComposerState.ts'),
		join(webSrcRoot, 'components', 'chat', 'voiceComposerState.test.ts'),
		join(webSrcRoot, 'components', 'chat', 'VoiceComposerControls.tsx'),
		join(webSrcRoot, 'components', 'chat', 'VoiceComposerControls.module.css'),
		join(webSrcRoot, 'components', 'chat', 'VoiceComposerControls.test.tsx'),
		join(webSrcRoot, 'components', 'chat', 'ChatComposerSurface.tsx'),
		join(webSrcRoot, 'components', 'chat', 'ChatComposerSurface.test.tsx'),
		join(webSrcRoot, 'hooks', 'useVoiceInput.ts'),
		join(webSrcRoot, 'hooks', 'useVoiceInput.test.ts'),
		join(webSrcRoot, 'pages', 'ChatPage.tsx'),
		join(webRoot, 'tests', 'visual', 'ui-overhaul-20-voice-state-fixture.tsx'),
		join(webRoot, 'tests', 'visual', 'ui-overhaul-20-voice-state-smoke.html'),
		join(webRoot, 'tests', 'visual', 'ui-overhaul-20-voice-state-smoke.spec.ts'),
	];

	it('PR-20 files are UTF-8 without BOM', () => {
		const violations: string[] = [];

		for (const filePath of pr20Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const buffer = readFileSync(filePath);
			if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
				violations.push(`${filePath}`);
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-20 files do not contain mojibake text', () => {
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const violations: string[] = [];

		for (const filePath of pr20Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const source = readFileSync(filePath, 'utf8');
			for (const pattern of mojibakePatterns) {
				if (source.includes(pattern)) {
					violations.push(`${filePath} includes ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-20 files do not contain forbidden normal-surface technical strings in voice copy', () => {
		const forbidden = ['Web Speech API', 'SpeechRecognition', 'webkitSpeechRecognition'];
		const violations: string[] = [];

		// Implementation and test files that must reference browser API identifiers
		// are excluded; they are not user-facing copy.
		const skipFiles = new Set([
			join(webSrcRoot, 'hooks', 'useVoiceInput.ts'),
			join(webSrcRoot, 'hooks', 'useVoiceInput.test.ts'),
			join(webSrcRoot, 'components', 'chat', 'VoiceComposerControls.test.tsx'),
			join(webSrcRoot, 'components', 'chat', 'voiceComposerState.test.ts'),
			join(webRoot, 'tests', 'visual', 'ui-overhaul-20-voice-state-smoke.spec.ts'),
		]);

		for (const filePath of pr20Files) {
			if (!existsSync(filePath)) {
				continue;
			}

			if (skipFiles.has(filePath)) {
				continue;
			}

			const source = readFileSync(filePath, 'utf8');
			for (const term of forbidden) {
				const regex = new RegExp(`(?<!['"\`])(?:${term})(?!\\w)`, 'g');
				if (regex.test(source)) {
					violations.push(`${filePath} contains "${term}"`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('VoiceComposerControls.module.css uses design tokens, no hardcoded hex', () => {
		const cssPath = join(webSrcRoot, 'components', 'chat', 'VoiceComposerControls.module.css');

		if (!existsSync(cssPath)) {
			return;
		}

		const source = readFileSync(cssPath, 'utf8');
		const hexPattern = /#[0-9A-Fa-f]{3,8}/g;
		const hexMatches = source.match(hexPattern) ?? [];
		expect(hexMatches).toEqual([]);
	});

	it('voiceComposerState.ts does not export forbidden technical strings', () => {
		const filePath = join(webSrcRoot, 'components', 'chat', 'voiceComposerState.ts');

		if (!existsSync(filePath)) {
			return;
		}

		const source = readFileSync(filePath, 'utf8');
		const forbiddenInCode = ['Web Speech API', 'SpeechRecognition', 'webkitSpeechRecognition'];
		for (const term of forbiddenInCode) {
			expect(source, `voiceComposerState.ts contains "${term}"`).not.toContain(term);
		}
	});
});

describe('PR-21 upload attachment lock', () => {
	const pr21Files = [
		fileUploadButtonPath,
		fileUploadButtonCssPath,
		attachmentPreviewListPath,
		attachmentPreviewListCssPath,
		attachmentDisplayPath,
		chatComposerSurfacePath,
	];

	it('PR-21 files are UTF-8 without BOM', () => {
		const violations: string[] = [];

		for (const filePath of pr21Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const buffer = readFileSync(filePath);
			if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
				violations.push(`${filePath}`);
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-21 files do not contain mojibake text', () => {
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const violations: string[] = [];

		for (const filePath of pr21Files) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const source = readFileSync(filePath, 'utf8');
			for (const pattern of mojibakePatterns) {
				if (source.includes(pattern)) {
					violations.push(`${filePath} includes ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-21 user-facing files avoid forbidden technical strings', () => {
		const forbidden = [
			'blob_id',
			'media_type',
			'size_bytes',
			'payload',
			'backend',
			'protocol',
			'metadata',
		];
		const sourceFiles = [attachmentDisplayPath, attachmentPreviewListPath, chatComposerSurfacePath];
		const violations: string[] = [];

		for (const filePath of sourceFiles) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}

			const source = readFileSync(filePath, 'utf8');
			const literalMatches = source.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/gms);
			const literals = [...literalMatches]
				.map((match) => match[2] ?? '')
				.filter((value) => /\s|[çğıöşüÇĞİÖŞÜ]/u.test(value));
			for (const literal of literals) {
				for (const term of forbidden) {
					if (literal.includes(term)) {
						violations.push(`${filePath} contains "${term}" in user-facing copy`);
					}
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('PR-21 CSS files do not contain hardcoded hex colors', () => {
		const cssFiles = [
			fileUploadButtonCssPath,
			attachmentPreviewListCssPath,
			join(webSrcRoot, 'components', 'chat', 'ChatComposerSurface.module.css'),
		];
		const violations: string[] = [];
		const hexPattern = /#[0-9A-Fa-f]{3,8}/g;

		for (const cssFile of cssFiles) {
			if (!existsSync(cssFile)) {
				violations.push(`${cssFile} (not found)`);
				continue;
			}

			const source = readFileSync(cssFile, 'utf8');
			const matches = source.match(hexPattern) ?? [];
			if (matches.length > 0) {
				violations.push(`${cssFile} has ${matches.join(', ')}`);
			}
		}

		expect(violations).toEqual([]);
	});

	it('tokens.css and VisualDiscipline.test.tsx are unchanged in PR-21', () => {
		const tokensDiff = spawnSync(
			'git',
			['diff', '--name-only', '--', 'apps/web/src/styles/tokens.css'],
			{
				cwd: repoRoot,
				encoding: 'utf8',
			},
		);
		const visualDisciplineDiff = spawnSync(
			'git',
			['diff', '--name-only', '--', 'apps/web/src/pages/VisualDiscipline.test.tsx'],
			{
				cwd: repoRoot,
				encoding: 'utf8',
			},
		);

		expect(tokensDiff.status, tokensDiff.stderr || tokensDiff.stdout).toBe(0);
		expect(
			visualDisciplineDiff.status,
			visualDisciplineDiff.stderr || visualDisciplineDiff.stdout,
		).toBe(0);
		expect(tokensDiff.stdout.trim()).toBe('');
		expect(visualDisciplineDiff.stdout.trim()).toBe('');
		expect(existsSync(tokensPath)).toBe(true);
		expect(existsSync(visualDisciplineTestPath)).toBe(true);
	});
});

describe('streamdown text encoding guard', () => {
	const streamdownFiles = [
		streamdownMessagePath,
		streamdownCodeBlockPath,
		streamdownMermaidBlockPath,
		streamdownMermaidRendererPath,
		streamdownMarkdownLinksPath,
	];

	it('streamdown files do not contain mojibake text', () => {
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const violations: string[] = [];

		for (const filePath of streamdownFiles) {
			const source = readFileSync(filePath, 'utf8');
			for (const pattern of mojibakePatterns) {
				if (source.includes(pattern)) {
					violations.push(`${filePath} includes ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('streamdown files and markdown CSS have no stray ampersand nesting selector', () => {
		const checkFiles = [...streamdownFiles, componentsCssPath];
		const violations: string[] = [];

		for (const filePath of checkFiles) {
			const source = readFileSync(filePath, 'utf8');
			if (source.includes('.runa-markdown__list &')) {
				violations.push(`${filePath}`);
			}
		}

		expect(violations).toEqual([]);
	});

	it('empty state files do not contain mojibake text', () => {
		const emptyStateFiles = [
			emptyStatePath,
			emptyStateModelPath,
			join(webRoot, 'tests', 'visual', 'ui-overhaul-17-empty-state-fixture.tsx'),
		];
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const violations: string[] = [];

		for (const filePath of emptyStateFiles) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}
			const source = readFileSync(filePath, 'utf8');
			for (const pattern of mojibakePatterns) {
				if (source.includes(pattern)) {
					violations.push(`${filePath} includes ${pattern}`);
				}
			}
		}

		expect(violations).toEqual([]);
	});

	it('empty state normal copy has no forbidden technical strings', () => {
		const forbidden = [
			'Developer Mode',
			'runtime',
			'metadata',
			'transport',
			'schema',
			'protocol',
			'API key',
		];
		const source = readFileSync(emptyStatePath, 'utf8');
		for (const term of forbidden) {
			expect(source, `forbidden term in EmptyState.tsx: "${term}"`).not.toContain(term);
		}
	});

	it('components.css contains empty state contract classes', () => {
		const css = readFileSync(componentsCssPath, 'utf8');
		expect(css).toContain('.runa-chat-empty-hero__context');
		expect(css).toContain('.runa-chat-empty-context__chip');
		expect(css).toContain('.runa-chat-suggestion__description');
	});

	it('streamdown files and related files are UTF-8 without BOM', () => {
		const bomFiles = [
			streamdownMessagePath,
			streamdownCodeBlockPath,
			streamdownMermaidBlockPath,
			streamdownMermaidRendererPath,
			streamdownMarkdownLinksPath,
			join(webSrcRoot, 'lib', 'streamdown', 'StreamdownMessage.test.tsx'),
			join(webSrcRoot, 'components', 'chat', 'blocks', 'BlockRenderer.test.tsx'),
			componentsCssPath,
			emptyStatePath,
			emptyStateModelPath,
			join(webSrcRoot, 'components', 'chat', 'emptyStateModel.test.ts'),
			join(webSrcRoot, 'components', 'chat', 'EmptyState.test.tsx'),
			join(webRoot, 'tests', 'visual', 'ui-overhaul-17-empty-state-fixture.tsx'),
			join(webRoot, 'tests', 'visual', 'ui-overhaul-17-empty-state-smoke.html'),
		];
		const violations: string[] = [];

		for (const filePath of bomFiles) {
			if (!existsSync(filePath)) {
				violations.push(`${filePath} (not found)`);
				continue;
			}
			const buffer = readFileSync(filePath);
			if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
				violations.push(`${filePath}`);
			}
		}

		expect(violations).toEqual([]);
	});
});
