import {
	InlineCitation,
	InlineCitationCard,
	InlineCitationCardBody,
	InlineCitationCardTrigger,
	InlineCitationSource,
	InlineCitationText,
} from '@/components/ai-elements/inline-citation';
import { Reasoning, ReasoningContent, ReasoningTrigger } from '@/components/ai-elements/reasoning';
import type { ToolPart } from '@/components/ai-elements/tool';
import {
	Tool,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from '@/components/ai-elements/tool';
import { StreamdownMessage } from '@/lib/streamdown/StreamdownMessage';
import { MessagePrimitive } from '@assistant-ui/react';
import type {
	EmptyMessagePartProps,
	ReasoningMessagePartProps,
	SourceMessagePartProps,
	TextMessagePartProps,
	ToolCallMessagePartProps,
} from '@assistant-ui/react';

const toToolState = (status: ToolCallMessagePartProps<unknown, unknown>['status']['type']) => {
	const states: Record<typeof status, ToolPart['state']> = {
		complete: 'output-available',
		incomplete: 'output-error',
		running: 'input-streaming',
		'requires-action': 'approval-requested',
	};

	return states[status];
};

function TextPart({ status, text }: TextMessagePartProps) {
	return (
		<StreamdownMessage
			className="markdown"
			mode={status.type === 'running' ? 'streaming' : 'static'}
		>
			{text}
		</StreamdownMessage>
	);
}

function ReasoningPart({ status, text }: ReasoningMessagePartProps) {
	return (
		<Reasoning defaultOpen={false} isStreaming={status.type === 'running'}>
			<ReasoningTrigger />
			<ReasoningContent>{text}</ReasoningContent>
		</Reasoning>
	);
}

function ToolCallPart(props: ToolCallMessagePartProps<unknown, unknown>) {
	const toolType = `tool-${props.toolName}` as Exclude<ToolPart['type'], 'dynamic-tool'>;
	const errorText = props.isError ? 'Tool call failed' : undefined;

	return (
		<Tool className="tool-shell" defaultOpen>
			<ToolHeader state={toToolState(props.status.type)} title={props.toolName} type={toolType} />
			<ToolContent>
				<ToolInput input={props.args} state={toToolState(props.status.type)} />
				<ToolOutput errorText={errorText} output={props.result} />
			</ToolContent>
		</Tool>
	);
}

function SourcePart({ title, url }: SourceMessagePartProps) {
	return (
		<span className="assistant-renderer-source">
			<InlineCitation>
				<InlineCitationText>{title ?? url}</InlineCitationText>
				<InlineCitationCard>
					<InlineCitationCardTrigger sources={[url]} />
					<InlineCitationCardBody>
						<InlineCitationSource title={title ?? url} url={url} />
					</InlineCitationCardBody>
				</InlineCitationCard>
			</InlineCitation>
		</span>
	);
}

function EmptyPart({ status }: EmptyMessagePartProps) {
	if (status.type !== 'running') {
		return null;
	}

	return <div className="assistant-renderer-empty">thinking...</div>;
}

export function MessageRenderer() {
	return (
		<MessagePrimitive.Content
			components={{
				Empty: EmptyPart,
				Reasoning: ReasoningPart,
				Source: SourcePart,
				Text: TextPart,
				tools: {
					Override: ToolCallPart,
				},
			}}
		/>
	);
}

// Future: an 'image-generation' part should route to a lazy MediaJobBlock that follows
// src/lib/media/types.ts and the same progressive state pattern used by tool parts.
