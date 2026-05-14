import { Button } from '@/components/ui/button';
import { uiText } from '@/lib/i18n/strings';
import { CheckIcon, ClipboardIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { highlightCode, normalizeLanguage } from './shiki-highlighter';

type CodeBlockProps = {
	code: string;
	language?: string;
	className?: string;
};

type CopyState = 'copied' | 'failed' | 'idle';

const extractLanguage = (language?: string, className?: string) => {
	if (language) {
		return language;
	}

	return /language-([^\s]+)/.exec(className ?? '')?.[1];
};

function getCopyLabel(copyState: CopyState): string {
	switch (copyState) {
		case 'copied':
			return uiText.code.copied;
		case 'failed':
			return uiText.code.copyFailed;
		case 'idle':
			return uiText.code.copy;
	}
}

export function CodeBlock({ className, code, language }: CodeBlockProps) {
	const resolvedLanguage = extractLanguage(language, className);
	const normalizedLanguage = normalizeLanguage(resolvedLanguage);
	const [html, setHtml] = useState<string | undefined>();
	const [failed, setFailed] = useState(false);
	const [copyState, setCopyState] = useState<CopyState>('idle');

	useEffect(() => {
		let cancelled = false;

		setHtml(undefined);
		setFailed(false);

		if (!normalizedLanguage) {
			return undefined;
		}

		highlightCode(code, normalizedLanguage)
			.then((nextHtml) => {
				if (!cancelled) {
					setHtml(nextHtml);
				}
			})
			.catch((error: unknown) => {
				console.error('[Runa Shiki] Failed to highlight code block.', {
					error,
					language: normalizedLanguage,
				});
				if (!cancelled) {
					setFailed(true);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [code, normalizedLanguage]);

	const label = useMemo(() => resolvedLanguage ?? 'text', [resolvedLanguage]);
	const copyLabel = getCopyLabel(copyState);

	function resetCopyStateSoon(): void {
		window.setTimeout(() => setCopyState('idle'), 2000);
	}

	function handleCopy(): void {
		if (!navigator.clipboard) {
			setCopyState('failed');
			resetCopyStateSoon();
			return;
		}

		void navigator.clipboard
			.writeText(code)
			.then(() => {
				setCopyState('copied');
				resetCopyStateSoon();
			})
			.catch(() => {
				setCopyState('failed');
				resetCopyStateSoon();
			});
	}

	const toolbar = (
		<div className="runa-code-block__toolbar">
			<figcaption>{failed ? uiText.code.highlightingFailed(label) : label}</figcaption>
			<Button
				aria-label={copyLabel}
				aria-live="polite"
				onClick={handleCopy}
				size="sm"
				type="button"
				variant="secondary"
			>
				{copyState === 'copied' ? (
					<CheckIcon className="size-4" />
				) : (
					<ClipboardIcon className="size-4" />
				)}
				{copyLabel}
			</Button>
		</div>
	);

	if (html) {
		return (
			<figure className="runa-code-block" data-language={label}>
				{toolbar}
				{/* Shiki emits escaped, themed HTML; keeping this here isolates highlighter upgrades to this renderer. */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki owns escaping before HTML reaches React. */}
				<div dangerouslySetInnerHTML={{ __html: html }} />
			</figure>
		);
	}

	return (
		<figure className="runa-code-block plain" data-language={label}>
			{toolbar}
			{normalizedLanguage && !failed && <p className="code-loading">{uiText.code.highlighting}</p>}
			<pre>
				<code>{code}</code>
			</pre>
		</figure>
	);
}
