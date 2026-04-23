let stdin = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
	stdin += chunk;
});

process.stdin.on('end', () => {
	const payload = JSON.parse(stdin);
	const message = payload.tool_call?.arguments?.message ?? 'missing';

	process.stdout.write(
		JSON.stringify({
			metadata: {
				plugin_id: payload.plugin?.plugin_id,
				received_run_id: payload.context?.run_id,
				received_trace_id: payload.context?.trace_id,
			},
			output: {
				echoed: message,
				plugin_root: process.env.RUNA_PLUGIN_ROOT,
			},
			status: 'success',
		}),
	);
});
