import { createRoot } from 'react-dom/client';

import '../../src/styles/index.css';
import { BlockRenderer } from '../../src/components/chat/blocks/BlockRenderer.js';
import type { RenderBlock } from '../../src/ws-types.js';

const webSearchEvidenceBlock = {
	created_at: '2026-05-01T12:00:00.000Z',
	id: 'fixture:evidence-sources',
	payload: {
		evidence: {
			query: 'Runa launch readiness',
			results: 4,
			searches: 2,
			sources: [
				{
					canonical_url: 'https://example.com/runa-launch',
					domain: 'example.com',
					favicon: 'https://example.com/favicon.ico',
					id: 'source_launch_1',
					published_at: '2026-04-30T10:00:00.000Z',
					snippet: 'Canonical evidence source with launch-readiness context.',
					title: 'Runa launch readiness source',
					trust_score: 0.91,
					url: 'https://example.com/runa-launch?utm_source=fixture',
				},
				{
					canonical_url: 'https://docs.example.org/runa/evidence',
					domain: 'docs.example.org',
					favicon: 'https://docs.example.org/favicon.ico',
					id: 'source_launch_2',
					published_at: null,
					snippet: 'Supplemental evidence source rendered from the EvidencePack payload.',
					title: 'Evidence pack source',
					trust_score: 0.74,
					url: 'https://docs.example.org/runa/evidence',
				},
			],
			truncated: true,
			unreliable: true,
		},
		is_truncated: false,
		query: 'Runa launch readiness',
		result_count: 4,
		results: [
			{
				snippet: 'Legacy result remains available for backward compatibility.',
				source: 'legacy.example',
				title: 'Legacy fallback result',
				trust_tier: 'general',
				url: 'https://legacy.example/runa',
			},
		],
		search_provider: 'serper',
		summary: 'Evidence compiler returned two canonical sources from two searches.',
		title: 'Web search',
	},
	schema_version: 1,
	type: 'web_search_result_block',
} satisfies RenderBlock;

function Fixture(): JSX.Element {
	return (
		<main className="runa-page">
			<div className="runa-shell-frame runa-shell-frame--chat">
				<section className="runa-card runa-card--chat" data-testid="evidence-sources-fixture">
					<BlockRenderer block={webSearchEvidenceBlock} />
				</section>
			</div>
		</main>
	);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(<Fixture />);
