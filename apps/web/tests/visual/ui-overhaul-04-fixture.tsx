import { createRoot } from 'react-dom/client';

import '../../src/styles/index.css';
import { EmptyState } from '../../src/components/chat/EmptyState.js';
import { BlockRenderer } from '../../src/components/chat/blocks/BlockRenderer.js';
import type { RenderBlock } from '../../src/ws-types.js';

const createdAt = '2026-04-29T00:00:00.000Z';

const longCode = Array.from(
	{ length: 28 },
	(_, index) => `export const line${index + 1} = ${index + 1};`,
).join('\n');

const codeBlock = {
	created_at: createdAt,
	id: 'fixture:code',
	payload: {
		content: longCode,
		language: 'typescript',
		path: 'apps/web/src/example.ts',
		summary: 'Long code block fixture with collapse, copy and wrapping controls.',
		title: 'example.ts',
	},
	schema_version: 1,
	type: 'code_block',
} satisfies RenderBlock;

const approvalBlock = {
	created_at: createdAt,
	id: 'fixture:approval',
	payload: {
		action_kind: 'tool_execution',
		approval_id: 'approval_fixture',
		status: 'pending',
		summary: 'Runa bu adimi uygulamadan once net onay bekliyor.',
		title: 'Onay gereken adim',
		tool_name: 'file.write',
	},
	schema_version: 1,
	type: 'approval_block',
} satisfies RenderBlock;

const toolBlock = {
	created_at: createdAt,
	id: 'fixture:tool',
	payload: {
		call_id: 'call_fixture',
		result_preview: {
			kind: 'object',
			summary_text: 'Dosya okundu ve kullanilabilir sonuc hazirlandi.',
		},
		status: 'success',
		summary: 'file.read tamamlandi.',
		tool_name: 'file.read',
	},
	schema_version: 1,
	type: 'tool_result',
} satisfies RenderBlock;

function Fixture(): JSX.Element {
	return (
		<main className="runa-page">
			<div className="runa-shell-frame runa-shell-frame--chat">
				<section className="runa-card runa-card--chat">
					<EmptyState onSubmitSuggestion={() => undefined} />
				</section>
				<BlockRenderer block={codeBlock} />
				<BlockRenderer block={approvalBlock} onResolveApproval={() => undefined} />
				<BlockRenderer block={toolBlock} />
			</div>
		</main>
	);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(<Fixture />);
