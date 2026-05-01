import type { ReactElement } from 'react';

import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from '../../../components/ai-elements/tool.js';
import type { RenderBlock } from '../../../ws-types.js';

type ToolResultBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'tool_result' }>;
	isDeveloperMode?: boolean;
}>;

function getFriendlyResultCopy(block: ToolResultBlockProps['block']): Readonly<{
	readonly summary: string;
	readonly title: string;
}> {
	if (block.payload.status === 'success') {
		return {
			summary: 'Sonuç sohbet akışına eklendi.',
			title: 'İşlem tamamlandı',
		};
	}

	return {
		summary: 'Bu adım tamamlanamadı. Gerekirse yeniden deneyebilirsin.',
		title: 'İşlem tamamlanamadı',
	};
}

export function ToolResultBlock({
	block,
	isDeveloperMode = false,
}: ToolResultBlockProps): ReactElement {
	const isSuccess = block.payload.status === 'success';
	const friendlyCopy = getFriendlyResultCopy(block);
	const output = block.payload.result_preview ?? friendlyCopy.summary;

	if (!isDeveloperMode) {
		return (
			<Tool className={isSuccess ? 'runa-tool-result--success' : 'runa-tool-result--error'}>
				<ToolHeader
					state={isSuccess ? 'output-available' : 'output-error'}
					title={friendlyCopy.title}
					type={`tool-${block.payload.tool_name}`}
				/>
				<ToolContent>
					<ToolOutput
						errorText={isSuccess ? undefined : (block.payload.error_code ?? friendlyCopy.summary)}
						output={output}
					/>
				</ToolContent>
			</Tool>
		);
	}

	return (
		<Tool defaultOpen>
			<ToolHeader
				state={isSuccess ? 'output-available' : 'output-error'}
				title={block.payload.tool_name}
				type={`tool-${block.payload.tool_name}`}
			/>
			<ToolContent>
				<ToolInput
					input={{
						call_id: block.payload.call_id,
						status: block.payload.status,
						tool_name: block.payload.tool_name,
					}}
					state="input-available"
				/>
				<ToolOutput
					errorText={isSuccess ? undefined : (block.payload.error_code ?? friendlyCopy.summary)}
					output={output}
				/>
			</ToolContent>
		</Tool>
	);
}
