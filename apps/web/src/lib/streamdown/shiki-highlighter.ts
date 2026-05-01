import { createHighlighterCore } from '@shikijs/core';
import type { HighlighterCore, LanguageRegistration, ThemeRegistration } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

export const initialLanguages = [
	'typescript',
	'javascript',
	'python',
	'json',
	'bash',
	'tsx',
	'jsx',
	'sql',
	'html',
	'css',
	'markdown',
] as const;

export const shikiThemes = ['github-light', 'github-dark'] as const;

type SupportedLanguage = (typeof initialLanguages)[number] | 'rust';
type SupportedTheme = (typeof shikiThemes)[number];

const languageLoaders: Record<SupportedLanguage, () => Promise<LanguageRegistration[]>> = {
	bash: async () => (await import('shiki/langs/bash.mjs')).default,
	css: async () => (await import('shiki/langs/css.mjs')).default,
	html: async () => (await import('shiki/langs/html.mjs')).default,
	javascript: async () => (await import('shiki/langs/javascript.mjs')).default,
	json: async () => (await import('shiki/langs/json.mjs')).default,
	jsx: async () => (await import('shiki/langs/jsx.mjs')).default,
	markdown: async () => (await import('shiki/langs/markdown.mjs')).default,
	python: async () => (await import('shiki/langs/python.mjs')).default,
	rust: async () => (await import('shiki/langs/rust.mjs')).default,
	sql: async () => (await import('shiki/langs/sql.mjs')).default,
	tsx: async () => (await import('shiki/langs/tsx.mjs')).default,
	typescript: async () => (await import('shiki/langs/typescript.mjs')).default,
};

const themeLoaders: Record<SupportedTheme, () => Promise<ThemeRegistration>> = {
	'github-dark': async () => (await import('shiki/themes/github-dark.mjs')).default,
	'github-light': async () => (await import('shiki/themes/github-light.mjs')).default,
};

const aliases: Record<string, SupportedLanguage> = {
	js: 'javascript',
	md: 'markdown',
	py: 'python',
	sh: 'bash',
	shell: 'bash',
	ts: 'typescript',
};

let highlighterPromise: Promise<HighlighterCore> | undefined;
const loadedLanguages = new Set<string>();
const languageLoadPromises = new Map<SupportedLanguage, Promise<void>>();

export const normalizeLanguage = (language: string | undefined): SupportedLanguage | undefined => {
	const normalized = language?.trim().toLowerCase();
	if (!normalized) {
		return undefined;
	}

	const alias = aliases[normalized] ?? normalized;
	return alias in languageLoaders ? (alias as SupportedLanguage) : undefined;
};

const getHighlighter = async () => {
	highlighterPromise ??= (async () => {
		const [langs, themes] = await Promise.all([
			Promise.all(initialLanguages.map((language) => languageLoaders[language]())).then(
				(registrations) => registrations.flat(),
			),
			Promise.all(shikiThemes.map((theme) => themeLoaders[theme]())),
		]);
		const highlighter = await createHighlighterCore({
			engine: createJavaScriptRegexEngine(),
			langs,
			themes,
		});

		for (const language of initialLanguages) {
			loadedLanguages.add(language);
		}

		return highlighter;
	})();

	return highlighterPromise;
};

export const highlightCode = async (code: string, language: string | undefined) => {
	const highlighter = await getHighlighter();
	const normalized = normalizeLanguage(language);

	if (!normalized) {
		return undefined;
	}

	if (!loadedLanguages.has(normalized)) {
		const loadPromise =
			languageLoadPromises.get(normalized) ??
			(async () => {
				const registrations = await languageLoaders[normalized]();
				await highlighter.loadLanguage(...registrations);
				loadedLanguages.add(normalized);
			})();
		languageLoadPromises.set(normalized, loadPromise);
		await loadPromise;
	}

	return highlighter.codeToHtml(code, {
		lang: normalized,
		themes: {
			dark: 'github-dark',
			light: 'github-light',
		},
	});
};
