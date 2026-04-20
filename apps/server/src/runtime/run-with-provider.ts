import { createModelGateway } from '../gateway/factory.js';
import type { GatewayProvider, GatewayProviderConfig } from '../gateway/providers.js';
import { runModelStep } from './run-model-step.js';

type RunModelStepInput = Parameters<typeof runModelStep>[0];

export interface RunWithProviderInput extends Omit<RunModelStepInput, 'gateway'> {
	readonly provider: GatewayProvider;
	readonly provider_config: GatewayProviderConfig;
}

export type RunWithProviderResult = Awaited<ReturnType<typeof runModelStep>>;

export async function runWithProvider({
	initial_state,
	metadata,
	provider,
	provider_config,
	request,
	run_id,
	trace_id,
}: RunWithProviderInput): Promise<RunWithProviderResult> {
	const gateway = createModelGateway({
		config: provider_config,
		provider,
	});

	return runModelStep({
		gateway,
		initial_state,
		metadata,
		request,
		run_id,
		trace_id,
	});
}
