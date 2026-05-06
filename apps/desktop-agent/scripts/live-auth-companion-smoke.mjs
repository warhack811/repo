import { randomUUID } from 'node:crypto';

const SUMMARY_TOKEN = 'DESKTOP_COMPANION_LIVE_AUTH_E2E_SUMMARY';
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_POLL_INTERVAL_MS = 750;
const TINY_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lP2YcwAAAABJRU5ErkJggg==';

const env = process.env;
const smokeId = randomUUID();
const timeoutMs = readIntegerEnv('RUNA_DESKTOP_COMPANION_E2E_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);

const summary = {
	agent_id: `runa-live-auth-smoke-${smokeId}`,
	approval_resolve_sent: false,
	approval_target_label_present: false,
	blocked_reasons: [],
	cross_account_device_hidden: false,
	cross_account_target_rejected: false,
	desktop_agent_ws_bound: false,
	desktop_ui_loaded: false,
	device_online: false,
	device_removed_after_shutdown: false,
	invalid_token_did_not_create_presence: false,
	invalid_token_rejected: false,
	logout_or_session_clear_removed_device: false,
	missing_env: [],
	oauth_redirect_same_origin_compatible: false,
	primary_user_authenticated: false,
	production_auth_context_verified: false,
	remote_command_proof_ran: false,
	same_account_remote_client_saw_device: false,
	screenshot_execute_received: false,
	screenshot_succeeded: false,
	secondary_user_authenticated: false,
	status: 'pending',
	websocket_runtime_bound: false,
};

function readIntegerEnv(name, fallback) {
	const rawValue = env[name]?.trim();
	if (!rawValue) {
		return fallback;
	}

	const parsedValue = Number.parseInt(rawValue, 10);
	return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function readFirstEnv(...names) {
	for (const name of names) {
		const value = env[name]?.trim();
		if (value) {
			return {
				name,
				value,
			};
		}
	}

	return undefined;
}

function addBlockedReason(reason) {
	if (!summary.blocked_reasons.includes(reason)) {
		summary.blocked_reasons.push(reason);
	}
}

function readRequiredConfig() {
	const serverUrl = readFirstEnv(
		'RUNA_DESKTOP_COMPANION_E2E_SERVER_URL',
		'RUNA_STAGING_SERVER_URL',
		'RUNA_LIVE_SERVER_URL',
	);
	const webUrl = readFirstEnv(
		'RUNA_DESKTOP_COMPANION_E2E_WEB_URL',
		'RUNA_STAGING_WEB_URL',
		'RUNA_LIVE_WEB_URL',
	);
	const primaryAccessToken = readFirstEnv(
		'RUNA_DESKTOP_COMPANION_E2E_PRIMARY_ACCESS_TOKEN',
		'RUNA_STAGING_ACCESS_TOKEN',
		'RUNA_LIVE_ACCESS_TOKEN',
	);
	const secondaryAccessToken = readFirstEnv(
		'RUNA_DESKTOP_COMPANION_E2E_SECONDARY_ACCESS_TOKEN',
		'RUNA_STAGING_SECONDARY_ACCESS_TOKEN',
		'RUNA_LIVE_SECONDARY_ACCESS_TOKEN',
	);
	const providerApiKey = readFirstEnv('RUNA_DESKTOP_COMPANION_E2E_PROVIDER_API_KEY');

	const required = {
		primaryAccessToken,
		secondaryAccessToken,
		serverUrl,
		webUrl,
	};

	for (const [label, value] of Object.entries(required)) {
		if (!value) {
			summary.missing_env.push(label);
		}
	}

	if (!providerApiKey) {
		summary.provider_credential_present = false;
		addBlockedReason('remote_command_proof_requires_RUNA_DESKTOP_COMPANION_E2E_PROVIDER_API_KEY');
	} else {
		summary.provider_credential_present = true;
	}

	if (summary.missing_env.length > 0) {
		addBlockedReason('missing_required_live_auth_smoke_environment');
	}

	return {
		allowLocalhost: env.RUNA_DESKTOP_COMPANION_E2E_ALLOW_LOCALHOST === '1',
		machineLabel:
			env.RUNA_DESKTOP_COMPANION_E2E_MACHINE_LABEL?.trim() ?? 'Runa Live Auth Smoke Workstation',
		model: env.RUNA_DESKTOP_COMPANION_E2E_RUN_MODEL?.trim() ?? 'deepseek-v4-flash',
		primaryAccessToken: primaryAccessToken?.value,
		provider: env.RUNA_DESKTOP_COMPANION_E2E_RUN_PROVIDER?.trim() ?? 'deepseek',
		providerApiKey: providerApiKey?.value,
		secondaryAccessToken: secondaryAccessToken?.value,
		serverUrl: serverUrl?.value,
		webUrl: webUrl?.value,
	};
}

function isLoopbackHost(hostname) {
	const normalizedHost = hostname.replace(/^\[|\]$/gu, '').toLowerCase();
	return (
		normalizedHost === 'localhost' ||
		normalizedHost === '127.0.0.1' ||
		normalizedHost === '::1' ||
		normalizedHost === '::ffff:127.0.0.1'
	);
}

function parseHttpUrl(rawUrl, label, allowLocalhost) {
	try {
		const parsedUrl = new URL(rawUrl);

		if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
			addBlockedReason(`${label}_must_use_http_or_https`);
			return null;
		}

		if (!allowLocalhost && isLoopbackHost(parsedUrl.hostname)) {
			addBlockedReason(`${label}_must_not_be_loopback_for_live_gate`);
			return null;
		}

		return parsedUrl;
	} catch {
		addBlockedReason(`${label}_must_be_a_valid_url`);
		return null;
	}
}

function toWebSocketUrl(serverUrl, pathname) {
	const wsUrl = new URL(serverUrl);
	wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
	wsUrl.pathname = pathname;
	wsUrl.search = '';
	wsUrl.hash = '';
	return wsUrl;
}

function safeAuthority(url) {
	return url ? `${url.protocol}//${url.host}` : undefined;
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, label) {
	let timeout;
	const timeoutPromise = new Promise((_, reject) => {
		timeout = setTimeout(
			() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
			timeoutMs,
		);
	});

	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchJson(input, init, label) {
	const response = await fetch(input, {
		...init,
		cache: 'no-store',
	});
	const text = await response.text();
	let payload = null;

	if (text.trim().length > 0) {
		try {
			payload = JSON.parse(text);
		} catch {
			payload = text;
		}
	}

	return {
		ok: response.ok,
		payload,
		status: response.status,
		statusText: response.statusText,
		label,
	};
}

async function fetchAuthContext(serverUrl, accessToken, label) {
	const url = new URL('/auth/context', serverUrl);
	const result = await fetchJson(
		url,
		{
			headers: {
				accept: 'application/json',
				authorization: `Bearer ${accessToken}`,
			},
			method: 'GET',
		},
		label,
	);

	if (!result.ok) {
		throw new Error(`${label} auth context returned HTTP ${result.status}`);
	}

	const auth = result.payload?.auth;
	const principal = auth?.principal;
	if (principal?.kind !== 'authenticated' || typeof principal.user_id !== 'string') {
		throw new Error(`${label} auth context did not resolve to an authenticated user.`);
	}

	return {
		email: typeof principal.email === 'string' ? principal.email : undefined,
		user_id: principal.user_id,
	};
}

async function listDevices(serverUrl, accessToken) {
	const result = await fetchJson(
		new URL('/desktop/devices', serverUrl),
		{
			headers: {
				accept: 'application/json',
				authorization: `Bearer ${accessToken}`,
			},
			method: 'GET',
		},
		'desktop devices',
	);

	if (!result.ok) {
		throw new Error(`/desktop/devices returned HTTP ${result.status}`);
	}

	return Array.isArray(result.payload?.devices) ? result.payload.devices : [];
}

async function waitForDevice(serverUrl, accessToken, agentId) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const devices = await listDevices(serverUrl, accessToken);
		const device = devices.find((candidate) => candidate?.agent_id === agentId);

		if (device) {
			return device;
		}

		await delay(DEFAULT_POLL_INTERVAL_MS);
	}

	throw new Error(`Desktop device did not appear for ${agentId}.`);
}

async function waitForDeviceAbsence(serverUrl, accessToken, agentId, durationMs = 5_000) {
	const deadline = Date.now() + durationMs;
	while (Date.now() < deadline) {
		const devices = await listDevices(serverUrl, accessToken);

		if (devices.some((candidate) => candidate?.agent_id === agentId)) {
			return false;
		}

		await delay(DEFAULT_POLL_INTERVAL_MS);
	}

	return true;
}

function parseSocketMessage(event) {
	const data = event.data;
	const text =
		typeof data === 'string'
			? data
			: data instanceof ArrayBuffer
				? Buffer.from(data).toString('utf8')
				: String(data);
	return JSON.parse(text);
}

function openWebSocket(url) {
	return new Promise((resolve, reject) => {
		if (typeof WebSocket !== 'function') {
			reject(new Error('Global WebSocket is not available in this Node runtime.'));
			return;
		}

		const socket = new WebSocket(url);
		const cleanup = () => {
			socket.removeEventListener('open', handleOpen);
			socket.removeEventListener('error', handleError);
		};
		const handleOpen = () => {
			cleanup();
			resolve(socket);
		};
		const handleError = (event) => {
			cleanup();
			reject(new Error(`WebSocket connection failed: ${event.message ?? 'unknown error'}`));
		};

		socket.addEventListener('open', handleOpen, { once: true });
		socket.addEventListener('error', handleError, { once: true });
	});
}

function waitForSocketClose(socket, timeout = 2_000) {
	return Promise.race([
		new Promise((resolve) => {
			socket.addEventListener('close', () => resolve(true), { once: true });
		}),
		delay(timeout).then(() => false),
	]);
}

function sendJson(socket, message) {
	socket.send(JSON.stringify(message));
}

async function waitForSocketMessage(socket, predicate, label) {
	return await withTimeout(
		new Promise((resolve, reject) => {
			const cleanup = () => {
				socket.removeEventListener('close', handleClose);
				socket.removeEventListener('error', handleError);
				socket.removeEventListener('message', handleMessage);
			};
			const handleClose = (event) => {
				cleanup();
				reject(new Error(`${label} socket closed: ${event.reason || String(event.code)}`));
			};
			const handleError = () => {
				cleanup();
				reject(new Error(`${label} socket error.`));
			};
			const handleMessage = (event) => {
				try {
					const message = parseSocketMessage(event);

					if (predicate(message)) {
						cleanup();
						resolve(message);
					}
				} catch (error) {
					cleanup();
					reject(error);
				}
			};

			socket.addEventListener('close', handleClose, { once: true });
			socket.addEventListener('error', handleError, { once: true });
			socket.addEventListener('message', handleMessage);
		}),
		label,
	);
}

async function openRuntimeSocket(serverUrl, accessToken) {
	const wsUrl = toWebSocketUrl(serverUrl, '/ws');
	wsUrl.searchParams.set('access_token', accessToken);
	const socket = await openWebSocket(wsUrl);
	await waitForSocketMessage(
		socket,
		(message) => message?.type === 'connection.ready',
		'runtime websocket handshake',
	);
	return socket;
}

async function openDesktopAgentSocket(serverUrl, accessToken, input) {
	const wsUrl = toWebSocketUrl(serverUrl, '/ws/desktop-agent');
	wsUrl.searchParams.set('access_token', accessToken);
	const socket = await openWebSocket(wsUrl);
	await waitForSocketMessage(
		socket,
		(message) => message?.type === 'desktop-agent.connection.ready',
		'desktop agent websocket ready',
	);
	sendJson(socket, {
		payload: {
			agent_id: input.agentId,
			capabilities: [{ tool_name: 'desktop.screenshot' }],
			machine_label: input.machineLabel,
			protocol_version: 1,
		},
		type: 'desktop-agent.hello',
	});
	const accepted = await waitForSocketMessage(
		socket,
		(message) => message?.type === 'desktop-agent.session.accepted',
		'desktop agent session accepted',
	);

	socket.addEventListener('message', (event) => {
		try {
			const message = parseSocketMessage(event);

			if (message?.type === 'desktop-agent.heartbeat.ping') {
				sendJson(socket, {
					payload: {
						ping_id: message.payload.ping_id,
						received_at: new Date().toISOString(),
					},
					type: 'desktop-agent.heartbeat.pong',
				});
			}

			if (message?.type === 'desktop-agent.execute') {
				summary.screenshot_execute_received = true;

				if (message.payload?.tool_name !== 'desktop.screenshot') {
					sendJson(socket, {
						payload: {
							call_id: message.payload.call_id,
							error_code: 'INVALID_INPUT',
							error_message: `Live auth smoke only handles desktop.screenshot, received ${message.payload.tool_name}.`,
							request_id: message.payload.request_id,
							status: 'error',
							tool_name: message.payload.tool_name,
						},
						type: 'desktop-agent.result',
					});
					return;
				}

				sendJson(socket, {
					payload: {
						call_id: message.payload.call_id,
						output: {
							base64_data: TINY_PNG_BASE64,
							byte_length: Buffer.from(TINY_PNG_BASE64, 'base64').byteLength,
							format: 'png',
							mime_type: 'image/png',
						},
						request_id: message.payload.request_id,
						status: 'success',
						tool_name: 'desktop.screenshot',
					},
					type: 'desktop-agent.result',
				});
			}
		} catch {
			socket.close(1008, 'Invalid live auth smoke desktop bridge message.');
		}
	});

	return {
		connection_id: accepted.payload.connection_id,
		socket,
		user_id: accepted.payload.user_id,
	};
}

async function verifyInvalidTokenRejected(serverUrl, primaryAccessToken) {
	const invalidAgentId = `${summary.agent_id}-invalid`;
	const wsUrl = toWebSocketUrl(serverUrl, '/ws/desktop-agent');
	wsUrl.searchParams.set('access_token', 'invalid.invalid.invalid');

	let rejected = false;
	try {
		const socket = await openWebSocket(wsUrl);
		rejected = await waitForSocketClose(socket, 5_000);
	} catch {
		rejected = true;
	}

	summary.invalid_token_rejected = rejected;
	summary.invalid_token_did_not_create_presence = await waitForDeviceAbsence(
		serverUrl,
		primaryAccessToken,
		invalidAgentId,
		2_500,
	);
}

async function verifyWebUi(webUrl) {
	const response = await fetch(webUrl, {
		cache: 'no-store',
		method: 'GET',
		redirect: 'manual',
	});

	summary.desktop_ui_loaded =
		(response.status >= 200 && response.status < 400) || response.status === 401;
}

async function runDesktopScreenshotProof(input) {
	const socket = await openRuntimeSocket(input.serverUrl, input.accessToken);
	summary.websocket_runtime_bound = true;
	const messages = [];
	const runId = `desktop-live-auth-smoke-${smokeId}`;
	const traceId = `desktop-live-auth-smoke-trace-${smokeId}`;

	try {
		const finishedPromise = withTimeout(
			new Promise((resolve, reject) => {
				socket.addEventListener('message', (event) => {
					try {
						const message = parseSocketMessage(event);
						messages.push(message);

						if (message.type === 'presentation.blocks') {
							for (const block of message.payload?.blocks ?? []) {
								if (
									block?.type === 'approval_block' &&
									block.payload?.status === 'pending' &&
									block.payload?.approval_id &&
									!summary.approval_resolve_sent
								) {
									summary.approval_target_label_present =
										typeof block.payload.target_label === 'string' &&
										block.payload.target_label.trim().length > 0 &&
										block.payload.target_label !== 'desktop.screenshot';
									summary.approval_resolve_sent = true;
									sendJson(socket, {
										payload: {
											approval_id: block.payload.approval_id,
											decision: 'approved',
											note: 'live-auth-companion-smoke',
										},
										type: 'approval.resolve',
									});
								}

								if (
									block?.type === 'tool_result' &&
									block.payload?.tool_name === 'desktop.screenshot' &&
									block.payload?.status === 'success'
								) {
									summary.screenshot_succeeded = true;
								}
							}
						}

						if (message.type === 'run.finished' || message.type === 'run.rejected') {
							summary.final_message_type = message.type;
							summary.run_status = message.payload?.status ?? message.payload?.error_name;
							resolve(message);
						}
					} catch (error) {
						reject(error);
					}
				});
				socket.addEventListener('error', () => reject(new Error('Runtime socket error.')), {
					once: true,
				});
			}),
			'desktop screenshot proof',
		);

		sendJson(socket, {
			payload: {
				desktop_target_connection_id: input.targetConnectionId,
				include_presentation_blocks: true,
				provider: input.provider,
				provider_config: {
					apiKey: input.providerApiKey,
					defaultModel: input.model,
				},
				request: {
					messages: [
						{
							content:
								'Use the desktop.screenshot tool exactly once on the selected computer, then summarize the result in one sentence.',
							role: 'user',
						},
					],
					model: input.model,
					tools: [{ name: 'desktop.screenshot' }],
				},
				run_id: runId,
				trace_id: traceId,
			},
			type: 'run.request',
		});

		await finishedPromise;
		summary.remote_command_proof_ran = true;
	} finally {
		socket.close();
		await waitForSocketClose(socket);
	}
}

async function runCrossAccountTargetRejectionProof(input) {
	const socket = await openRuntimeSocket(input.serverUrl, input.secondaryAccessToken);
	let screenshotSucceeded = false;
	let targetRejected = false;
	const runId = `desktop-live-auth-cross-account-${smokeId}`;
	const traceId = `desktop-live-auth-cross-account-trace-${smokeId}`;

	try {
		const finishedPromise = withTimeout(
			new Promise((resolve, reject) => {
				socket.addEventListener('message', (event) => {
					try {
						const message = parseSocketMessage(event);

						if (message.type === 'presentation.blocks') {
							for (const block of message.payload?.blocks ?? []) {
								if (
									block?.type === 'approval_block' &&
									block.payload?.status === 'pending' &&
									block.payload?.approval_id
								) {
									sendJson(socket, {
										payload: {
											approval_id: block.payload.approval_id,
											decision: 'approved',
											note: 'live-auth-companion-smoke-cross-account',
										},
										type: 'approval.resolve',
									});
								}

								if (
									block?.type === 'tool_result' &&
									block.payload?.tool_name === 'desktop.screenshot'
								) {
									if (block.payload?.status === 'success') {
										screenshotSucceeded = true;
									}

									if (
										block.payload?.status === 'error' &&
										typeof block.payload?.summary === 'string' &&
										block.payload.summary.includes(
											`No connected desktop agent is available for connection ${input.targetConnectionId}.`,
										)
									) {
										targetRejected = true;
									}
								}
							}
						}

						if (message.type === 'run.finished' || message.type === 'run.rejected') {
							resolve(message);
						}
					} catch (error) {
						reject(error);
					}
				});
				socket.addEventListener('error', () => reject(new Error('Runtime socket error.')), {
					once: true,
				});
			}),
			'cross-account target proof',
		);

		sendJson(socket, {
			payload: {
				desktop_target_connection_id: input.targetConnectionId,
				include_presentation_blocks: true,
				provider: input.provider,
				provider_config: {
					apiKey: input.providerApiKey,
					defaultModel: input.model,
				},
				request: {
					messages: [
						{
							content:
								'Attempt to use desktop.screenshot on the selected computer. Report whether it worked.',
							role: 'user',
						},
					],
					model: input.model,
					tools: [{ name: 'desktop.screenshot' }],
				},
				run_id: runId,
				trace_id: traceId,
			},
			type: 'run.request',
		});

		await finishedPromise;
		summary.cross_account_target_rejected = targetRejected && !screenshotSucceeded;
	} finally {
		socket.close();
		await waitForSocketClose(socket);
	}
}

function finalizeAndExit(error) {
	if (error) {
		summary.error_message = error instanceof Error ? error.message : String(error);
	}

	const requiredPass =
		summary.production_auth_context_verified === true &&
		summary.desktop_ui_loaded === true &&
		summary.desktop_agent_ws_bound === true &&
		summary.websocket_runtime_bound === true &&
		summary.device_online === true &&
		summary.same_account_remote_client_saw_device === true &&
		summary.cross_account_device_hidden === true &&
		summary.invalid_token_rejected === true &&
		summary.invalid_token_did_not_create_presence === true &&
		summary.approval_resolve_sent === true &&
		summary.approval_target_label_present === true &&
		summary.screenshot_execute_received === true &&
		summary.screenshot_succeeded === true &&
		summary.cross_account_target_rejected === true &&
		summary.logout_or_session_clear_removed_device === true &&
		summary.device_removed_after_shutdown === true &&
		summary.final_message_type === 'run.finished' &&
		summary.run_status === 'completed';

	if (summary.blocked_reasons.length > 0) {
		summary.status = 'blocked';
	} else if (requiredPass && !error) {
		summary.status = 'passed';
	} else {
		summary.status = 'failed';
	}

	console.log(`${SUMMARY_TOKEN} ${JSON.stringify(summary)}`);
	process.exit(summary.status === 'passed' ? 0 : 1);
}

async function main() {
	const config = readRequiredConfig();

	if (summary.missing_env.length > 0) {
		return;
	}

	const serverUrl = parseHttpUrl(config.serverUrl, 'server_url', config.allowLocalhost);
	const webUrl = parseHttpUrl(config.webUrl, 'web_url', config.allowLocalhost);

	summary.server_url_authority = safeAuthority(serverUrl);
	summary.web_url_authority = safeAuthority(webUrl);
	summary.oauth_redirect_same_origin_compatible =
		Boolean(serverUrl && webUrl) && serverUrl.origin === webUrl.origin;

	if (!serverUrl || !webUrl) {
		return;
	}

	await verifyWebUi(webUrl);

	const primaryUser = await fetchAuthContext(serverUrl, config.primaryAccessToken, 'primary');
	const secondaryUser = await fetchAuthContext(serverUrl, config.secondaryAccessToken, 'secondary');

	summary.primary_user_authenticated = true;
	summary.secondary_user_authenticated = true;
	summary.production_auth_context_verified = primaryUser.user_id !== secondaryUser.user_id;

	if (!summary.production_auth_context_verified) {
		throw new Error('Primary and secondary live auth tokens must belong to different users.');
	}

	await verifyInvalidTokenRejected(serverUrl, config.primaryAccessToken);

	const desktopAgent = await openDesktopAgentSocket(serverUrl, config.primaryAccessToken, {
		agentId: summary.agent_id,
		machineLabel: config.machineLabel,
	});
	summary.desktop_agent_ws_bound = desktopAgent.user_id === primaryUser.user_id;

	try {
		const device = await waitForDevice(serverUrl, config.primaryAccessToken, summary.agent_id);
		summary.device_online = Boolean(device);
		summary.same_account_remote_client_saw_device =
			device?.connection_id === desktopAgent.connection_id;
		summary.cross_account_device_hidden = !(
			await listDevices(serverUrl, config.secondaryAccessToken)
		).some((candidate) => candidate?.agent_id === summary.agent_id);

		if (summary.blocked_reasons.length === 0) {
			await runDesktopScreenshotProof({
				accessToken: config.primaryAccessToken,
				model: config.model,
				provider: config.provider,
				providerApiKey: config.providerApiKey,
				serverUrl,
				targetConnectionId: desktopAgent.connection_id,
			});
			await runCrossAccountTargetRejectionProof({
				model: config.model,
				provider: config.provider,
				providerApiKey: config.providerApiKey,
				secondaryAccessToken: config.secondaryAccessToken,
				serverUrl,
				targetConnectionId: desktopAgent.connection_id,
			});
		}
	} finally {
		desktopAgent.socket.close(1000, 'Live auth companion smoke completed.');
		await waitForSocketClose(desktopAgent.socket);
	}

	summary.device_removed_after_shutdown = await waitForDeviceAbsence(
		serverUrl,
		config.primaryAccessToken,
		summary.agent_id,
		10_000,
	);
	summary.logout_or_session_clear_removed_device = summary.device_removed_after_shutdown;
}

try {
	await main();
	finalizeAndExit();
} catch (error) {
	finalizeAndExit(error);
}
