import { useEffect, useId, useState } from 'react';
import { CodeBlock } from './CodeBlock';

type MermaidRendererProps = {
	code: string;
};

let mermaidInit: Promise<typeof import('mermaid').default> | undefined;

const getMermaid = async () => {
	mermaidInit ??= import('mermaid').then((module) => {
		module.default.initialize({
			fontFamily: 'Geist Variable, system-ui, sans-serif',
			securityLevel: 'strict',
			startOnLoad: false,
			theme: 'dark',
		});
		return module.default;
	});

	return mermaidInit;
};

export default function MermaidRenderer({ code }: MermaidRendererProps) {
	const id = useId().replace(/:/g, '');
	const [svg, setSvg] = useState<string>();
	const [error, setError] = useState<string>();

	useEffect(() => {
		let cancelled = false;

		if (typeof window === 'undefined') {
			return undefined;
		}

		window.setTimeout(() => {
			if (!cancelled) {
				setSvg(undefined);
				setError(undefined);
			}
		}, 0);

		getMermaid()
			.then((mermaid) => mermaid.render(`runa-mermaid-${id}`, code))
			.then(({ svg: nextSvg }) => {
				if (!cancelled) {
					setSvg(nextSvg);
				}
			})
			.catch((nextError: unknown) => {
				if (!cancelled) {
					setError(nextError instanceof Error ? nextError.message : 'Unknown Mermaid error');
				}
			});

		return () => {
			cancelled = true;
		};
	}, [code, id]);

	if (error) {
		return (
			<div className="mermaid-fallback">
				<p>diagram render edilemedi</p>
				<CodeBlock code={code} language="mermaid" />
			</div>
		);
	}

	if (!svg) {
		return <div className="diagram-skeleton">Loading diagram...</div>;
	}

	// Mermaid returns an SVG string after parsing; keeping injection local lets us audit one renderer.
	// biome-ignore lint/security/noDangerouslySetInnerHtml: Mermaid render output is scoped to this lazy diagram surface.
	return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
