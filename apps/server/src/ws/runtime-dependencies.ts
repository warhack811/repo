import { readMcpServerConfigsFromEnvironment } from '../mcp/config.js';
import { discoverMcpToolsSync } from '../mcp/registry-bridge.js';
import { discoverPluginToolsSync } from '../plugins/loader.js';
import { readPluginDirsFromEnvironment } from '../plugins/manifest.js';
import { type ToolRegistry, createBuiltInToolRegistry } from '../tools/registry.js';
import { type WebSocketPolicyWiring, createWebSocketPolicyWiring } from './policy-wiring.js';

let defaultToolRegistry: ToolRegistry | undefined;
let defaultPolicyWiring: WebSocketPolicyWiring | undefined;

export function createToolRegistryFromEnvironment(
	env: NodeJS.ProcessEnv = process.env,
): ToolRegistry {
	const registry = createBuiltInToolRegistry();
	const pluginDirs = readPluginDirsFromEnvironment(env);
	const mcpServerConfigs = readMcpServerConfigsFromEnvironment(env);

	if (pluginDirs.length > 0) {
		registry.registerMany(discoverPluginToolsSync(pluginDirs));
	}

	if (mcpServerConfigs.length === 0) {
		return registry;
	}

	registry.registerMany(discoverMcpToolsSync(mcpServerConfigs));
	return registry;
}

export function getDefaultToolRegistry(): ToolRegistry {
	if (!defaultToolRegistry) {
		defaultToolRegistry = createToolRegistryFromEnvironment();
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
