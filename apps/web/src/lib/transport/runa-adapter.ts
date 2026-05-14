import type { EvidencePack } from '@/lib/evidence/types';
import type { RenderBlock, WebSocketServerBridgeMessage } from '../../ws-types';

export type RunaUiToolState =
	| 'approval-requested'
	| 'input-available'
	| 'input-streaming'
	| 'output-available'
	| 'output-error';

export type RunaUiPart =
	| Readonly<{
			id: string;
			text: string;
			type: 'text';
	  }>
	| Readonly<{
			id: string;
			evidence: EvidencePack;
			type: 'source';
	  }>
	| Readonly<{
			id: string;
			input: Readonly<Record<string, unknown>> | null;
			output: unknown;
			state: RunaUiToolState;
			toolName: string;
			type: 'tool';
	  }>
	| Readonly<{
			id: string;
			text: string;
			type: 'reasoning';
	  }>
	| Readonly<{
			error: string;
			id: string;
			type: 'error';
	  }>
	| Readonly<{
			finalState: 'COMPLETED' | 'FAILED';
			id: string;
			type: 'completion';
	  }>;

export type RunaUiMessage = Readonly<{
	id: string;
	parts: readonly RunaUiPart[];
	runId: string | null;
	status: 'completed' | 'failed' | 'running';
	traceId: string | null;
}>;

export type RunaUiMessageState = Readonly<{
	message: RunaUiMessage;
}>;

const emptyMessage: RunaUiMessage = {
	id: 'runa-message:pending',
	parts: [],
	runId: null,
	status: 'running',
	traceId: null,
};

export function createRunaUiMessageState(): RunaUiMessageState {
	return {
		message: emptyMessage,
	};
}

function appendTextPart(
	parts: readonly RunaUiPart[],
	runId: string,
	textDelta: string,
): readonly RunaUiPart[] {
	const lastPart = parts.at(-1);

	if (lastPart?.type === 'text') {
		return [
			...parts.slice(0, -1),
			{
				...lastPart,
				text: `${lastPart.text}${textDelta}`,
			},
		];
	}

	return [
		...parts,
		{
			id: `text:${runId}:${parts.length}`,
			text: textDelta,
			type: 'text',
		},
	];
}

function discardTextParts(parts: readonly RunaUiPart[], runId: string): readonly RunaUiPart[] {
	return parts.filter((part) => part.type !== 'text' || !part.id.startsWith(`text:${runId}:`));
}

function webSearchBlockToEvidencePack(
	block: Extract<RenderBlock, { type: 'web_search_result_block' }>,
): EvidencePack {
	return {
		query: block.payload.query,
		results: block.payload.results.length,
		searches: 1,
		sources: block.payload.results.map((result, index) => {
			const url = new URL(result.url);

			return {
				canonical_url: result.url,
				domain: url.hostname,
				favicon: `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`,
				id: `${block.id}:source:${index + 1}`,
				published_at: null,
				snippet: result.snippet,
				title: result.title,
				trust_score: result.trust_tier === 'official' ? 1 : 0.75,
				url: result.url,
			};
		}),
		truncated: block.payload.is_truncated,
	};
}

function blockToPart(block: RenderBlock): RunaUiPart | null {
	switch (block.type) {
		case 'text':
			return {
				id: block.id,
				text: block.payload.text,
				type: 'text',
			};
		case 'file_reference':
			return {
				id: block.id,
				text: block.payload.snippet
					? `[\`${block.payload.path}\`](#)\n\n${block.payload.snippet}`
					: `[\`${block.payload.path}\`](#)`,
				type: 'text',
			};
		case 'web_search_result_block':
			return {
				evidence: webSearchBlockToEvidencePack(block),
				id: block.id,
				type: 'source',
			};
		case 'tool_result':
			return {
				id: block.id,
				input: {
					call_id: block.payload.call_id,
					tool_name: block.payload.tool_name,
				},
				output: block.payload.result_preview ?? block.payload.summary,
				state: block.payload.status === 'success' ? 'output-available' : 'output-error',
				toolName: block.payload.tool_name,
				type: 'tool',
			};
		case 'approval_block':
			return {
				id: block.id,
				input: {
					approval_id: block.payload.approval_id,
					summary: block.payload.summary,
					target_label: block.payload.target_label ?? null,
				},
				output: block.payload.decision ?? null,
				state:
					block.payload.status === 'pending'
						? 'approval-requested'
						: block.payload.status === 'approved'
							? 'output-available'
							: 'output-error',
				toolName: block.payload.tool_name ?? 'approval.resolve',
				type: 'tool',
			};
		case 'run_timeline_block':
		case 'trace_debug_block':
			return {
				id: block.id,
				text: block.payload.summary,
				type: 'reasoning',
			};
		default:
			return null;
	}
}

export function applyRunaBridgeMessage(
	state: RunaUiMessageState,
	message: WebSocketServerBridgeMessage,
): RunaUiMessageState {
	const current = state.message;

	switch (message.type) {
		case 'connection.ready':
			return state;
		case 'run.accepted':
			return {
				message: {
					...current,
					id: `runa-message:${message.payload.run_id}`,
					runId: message.payload.run_id,
					status: 'running',
					traceId: message.payload.trace_id,
				},
			};
		case 'text.delta':
			return {
				message: {
					...current,
					id:
						current.id === emptyMessage.id ? `runa-message:${message.payload.run_id}` : current.id,
					parts: appendTextPart(current.parts, message.payload.run_id, message.payload.text_delta),
					runId: message.payload.run_id,
					status: 'running',
					traceId: message.payload.trace_id,
				},
			};
		case 'text.delta.discard':
			return {
				message: {
					...current,
					id:
						current.id === emptyMessage.id ? `runa-message:${message.payload.run_id}` : current.id,
					parts: discardTextParts(current.parts, message.payload.run_id),
					runId: message.payload.run_id,
					status: 'running',
					traceId: message.payload.trace_id,
				},
			};
		case 'presentation.blocks':
			return {
				message: {
					...current,
					id:
						current.id === emptyMessage.id ? `runa-message:${message.payload.run_id}` : current.id,
					parts: [
						...current.parts,
						...message.payload.blocks.flatMap((block) => {
							const part = blockToPart(block);
							return part ? [part] : [];
						}),
					],
					runId: message.payload.run_id,
					status: 'running',
					traceId: message.payload.trace_id,
				},
			};
		case 'runtime.event':
			return state;
		case 'run.rejected':
			return {
				message: {
					...current,
					parts: [
						...current.parts,
						{
							error: message.payload.error_message,
							id: `error:${message.payload.run_id ?? current.runId ?? 'unknown'}`,
							type: 'error',
						},
					],
					runId: message.payload.run_id ?? current.runId,
					status: 'failed',
					traceId: message.payload.trace_id ?? current.traceId,
				},
			};
		case 'run.finished':
			return {
				message: {
					...current,
					parts: [
						...current.parts,
						{
							finalState: message.payload.final_state,
							id: `completion:${message.payload.run_id}`,
							type: 'completion',
						},
					],
					runId: message.payload.run_id,
					status: message.payload.status,
					traceId: message.payload.trace_id,
				},
			};
		default:
			return state;
	}
}
