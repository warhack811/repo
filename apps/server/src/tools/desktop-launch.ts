import type {
	ToolArguments,
	ToolCallInput,
	ToolDefinition,
	ToolExecutionContext,
	ToolResult,
	ToolResultError,
	ToolResultSuccess,
} from '@runa/types';

const LAUNCH_WHITELIST = [
	'calc',
	'chrome',
	'code',
	'edge',
	'explorer',
	'firefox',
	'notepad',
] as const;

type LaunchAppName = (typeof LAUNCH_WHITELIST)[number];

export type DesktopLaunchArguments = ToolArguments & {
	readonly app_name?: string;
};

export interface DesktopLaunchSuccessData {
	readonly launched: boolean;
	readonly pid?: number;
	readonly process_name: string;
}

export type DesktopLaunchInput = ToolCallInput<'desktop.launch', DesktopLaunchArguments>;

export type DesktopLaunchSuccessResult = ToolResultSuccess<
	'desktop.launch',
	DesktopLaunchSuccessData
>;

export type DesktopLaunchErrorResult = ToolResultError<'desktop.launch'>;

export type DesktopLaunchResult = ToolResult<'desktop.launch', DesktopLaunchSuccessData>;

function createErrorResult(
	input: DesktopLaunchInput,
	error_code: DesktopLaunchErrorResult['error_code'],
	error_message: string,
	details?: DesktopLaunchErrorResult['details'],
	retryable?: boolean,
): DesktopLaunchErrorResult {
	return {
		call_id: input.call_id,
		details,
		error_code,
		error_message,
		retryable,
		status: 'error',
		tool_name: 'desktop.launch',
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isLaunchAppName(value: string): value is LaunchAppName {
	return LAUNCH_WHITELIST.includes(value as LaunchAppName);
}

function normalizeAppName(value: string): string {
	return value.trim().toLowerCase();
}

function validateDesktopLaunchArguments(
	input: DesktopLaunchInput,
): LaunchAppName | DesktopLaunchErrorResult {
	const allowedKeys = new Set(['app_name']);

	for (const key of Object.keys(input.arguments)) {
		if (!allowedKeys.has(key)) {
			return createErrorResult(
				input,
				'INVALID_INPUT',
				`desktop.launch does not accept the "${key}" argument.`,
				{
					argument: key,
					reason: 'unexpected_argument',
				},
				false,
			);
		}
	}

	const { app_name: appName } = input.arguments;

	if (typeof appName !== 'string' || appName.trim().length === 0) {
		return createErrorResult(
			input,
			'INVALID_INPUT',
			'desktop.launch requires an app_name string.',
			{
				argument: 'app_name',
				reason: 'invalid_app_name',
			},
			false,
		);
	}

	const normalizedAppName = normalizeAppName(appName);

	if (!isLaunchAppName(normalizedAppName)) {
		return createErrorResult(
			input,
			'PERMISSION_DENIED',
			`desktop.launch does not allow launching "${normalizedAppName}".`,
			{
				allowed_apps: LAUNCH_WHITELIST,
				app_name: normalizedAppName,
				reason: 'app_not_whitelisted',
			},
			false,
		);
	}

	return normalizedAppName;
}

function isDesktopLaunchSuccessData(value: unknown): value is DesktopLaunchSuccessData {
	if (!isRecord(value)) {
		return false;
	}

	const candidate = value as {
		readonly launched?: unknown;
		readonly pid?: unknown;
		readonly process_name?: unknown;
	};

	return (
		candidate.launched === true &&
		typeof candidate.process_name === 'string' &&
		(candidate.pid === undefined ||
			(typeof candidate.pid === 'number' && Number.isInteger(candidate.pid) && candidate.pid > 0))
	);
}

function createMissingBridgeError(
	input: DesktopLaunchInput,
	context: ToolExecutionContext,
): DesktopLaunchErrorResult {
	return createErrorResult(
		input,
		'EXECUTION_FAILED',
		context.desktop_bridge
			? 'Connected desktop agent does not advertise desktop.launch support.'
			: 'desktop.launch requires a connected desktop agent bridge.',
		{
			reason: context.desktop_bridge
				? 'desktop_agent_capability_unavailable'
				: 'desktop_agent_required',
		},
		!context.desktop_bridge,
	);
}

export function createDesktopLaunchTool(): ToolDefinition<DesktopLaunchInput, DesktopLaunchResult> {
	return {
		callable_schema: {
			parameters: {
				app_name: {
					description:
						'Whitelisted app to launch: chrome, edge, firefox, notepad, code, explorer, or calc.',
					required: true,
					type: 'string',
				},
			},
		},
		description:
			'Launches a whitelisted desktop app through the connected desktop agent bridge after explicit approval.',
		async execute(input, context): Promise<DesktopLaunchResult> {
			const appName = validateDesktopLaunchArguments(input);

			if (typeof appName !== 'string') {
				return appName;
			}

			if (context.signal?.aborted) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop app launch was aborted before execution.',
					{
						reason: 'aborted',
					},
					true,
				);
			}

			if (!context.desktop_bridge?.supports('desktop.launch')) {
				return createMissingBridgeError(input, context);
			}

			const bridgeResult = await context.desktop_bridge.invoke(input, context);

			if (bridgeResult.status === 'success' && !isDesktopLaunchSuccessData(bridgeResult.output)) {
				return createErrorResult(
					input,
					'EXECUTION_FAILED',
					'Desktop agent returned an invalid launch payload.',
					{
						reason: 'desktop_agent_invalid_result',
					},
					false,
				);
			}

			return bridgeResult as DesktopLaunchResult;
		},
		metadata: {
			capability_class: 'desktop',
			requires_approval: true,
			risk_level: 'high',
			side_effect_level: 'execute',
			tags: ['app', 'desktop', 'host', 'launch', 'whitelist'],
		},
		name: 'desktop.launch',
	};
}

export const desktopLaunchTool = createDesktopLaunchTool();
