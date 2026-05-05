import type {
	EventPayloadMap,
	NarrationCompletedEventPayload,
	NarrationDeltaServerMessage,
	RenderBlock,
	SupportedLocale,
	WorkNarrationBlock,
} from '@runa/types';
import { describe, expectTypeOf, it } from 'vitest';

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
});
