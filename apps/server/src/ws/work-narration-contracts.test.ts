import type {
	EventPayloadMap,
	NarrationCompletedEventPayload,
	NarrationDeltaServerMessage,
	RenderBlock,
	RunRequestModelRequest,
	SupportedLocale,
	WebSocketServerBridgeMessage,
	WorkNarrationBlock,
} from '@runa/types';
import { describe, expectTypeOf, it } from 'vitest';

type ServerPayload<T> = T extends { readonly payload: infer Payload } ? Payload : never;
type ServerPayloads = ServerPayload<WebSocketServerBridgeMessage>;
type HasInternalReasoningKey<T> = T extends unknown
	? 'internal_reasoning' extends keyof T
		? T
		: never
	: never;

describe('work narration shared contracts', () => {
	it('exposes work_narration as a RenderBlock variant', () => {
		expectTypeOf<
			Extract<RenderBlock, { type: 'work_narration' }>
		>().toEqualTypeOf<WorkNarrationBlock>();
		expectTypeOf<WorkNarrationBlock['payload']['locale']>().toEqualTypeOf<SupportedLocale>();
		expectTypeOf<WorkNarrationBlock['payload']['status']>().toEqualTypeOf<
			'completed' | 'streaming' | 'superseded' | 'tool_failed'
		>();
	});

	it('exposes narration payloads through the event and websocket maps', () => {
		expectTypeOf<
			EventPayloadMap['narration.completed']
		>().toEqualTypeOf<NarrationCompletedEventPayload>();
		expectTypeOf<
			NarrationDeltaServerMessage['payload']['locale']
		>().toEqualTypeOf<SupportedLocale>();
	});

	it('keeps internal reasoning out of websocket server payload contracts', () => {
		expectTypeOf<HasInternalReasoningKey<ServerPayloads>>().toEqualTypeOf<never>();
		expectTypeOf<
			HasInternalReasoningKey<RunRequestModelRequest['messages'][number]>
		>().toEqualTypeOf<never>();
	});
});
