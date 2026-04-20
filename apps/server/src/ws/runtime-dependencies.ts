import { type ToolRegistry, createBuiltInToolRegistry } from '../tools/registry.js';
import { type WebSocketPolicyWiring, createWebSocketPolicyWiring } from './policy-wiring.js';

let defaultToolRegistry: ToolRegistry | undefined;
let defaultPolicyWiring: WebSocketPolicyWiring | undefined;

export function getDefaultToolRegistry(): ToolRegistry {
	if (!defaultToolRegistry) {
		defaultToolRegistry = createBuiltInToolRegistry();
	}

	return defaultToolRegistry;
}

export function getPolicyWiring(
	options: Readonly<{
		readonly policy_wiring?: WebSocketPolicyWiring;
	}> = {},
): WebSocketPolicyWiring {
	if (options.policy_wiring !== undefined) {
		return options.policy_wiring;
	}

	defaultPolicyWiring ??= createWebSocketPolicyWiring();
	return defaultPolicyWiring;
}
