import type { RunFeedbackState, RunTransportSummary } from '../../../lib/chat-runtime/types.js';
import type { InspectionTargetKind, RuntimeEventServerMessage } from '../../../ws-types.js';

export interface MutableRunTransportSummary {
	final_state?: RunTransportSummary['final_state'];
	has_accepted: boolean;
	has_presentation_blocks: boolean;
	has_runtime_event: boolean;
	latest_runtime_state?: string;
	last_runtime_event_type?: RuntimeEventServerMessage['payload']['event']['event_type'];
	provider?: RunTransportSummary['provider'];
	run_id: string;
	trace_id?: string;
}

export interface StatusChipDescriptor {
	readonly label: string;
	readonly tone: RunFeedbackState['tone'];
}

export interface InspectionDetailRelation {
	readonly anchor_id?: string;
	readonly summary_label: string;
	readonly summary_title: string;
}

export type InspectionDetailRequestInput = Readonly<{
	detail_level: string;
	run_id: string;
	target_id?: string;
	target_kind: InspectionTargetKind;
}>;
