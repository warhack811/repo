import readline from 'node:readline';

const tools = [
	{
		name: 'echo_text',
		description: 'Echoes a text message back to the client.',
		inputSchema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					description: 'Message to echo',
				},
			},
			required: ['message'],
		},
	},
	{
		name: 'unsupported_object',
		description: 'Uses a nested object schema that the bridge should skip for now.',
		inputSchema: {
			type: 'object',
			properties: {
				payload: {
					type: 'object',
				},
			},
			required: ['payload'],
		},
	},
];

function writeMessage(message) {
	process.stdout.write(`${JSON.stringify(message)}\n`);
}

const rl = readline.createInterface({
	crlfDelay: Number.POSITIVE_INFINITY,
	input: process.stdin,
});

rl.on('line', (line) => {
	if (!line.trim()) {
		return;
	}

	const message = JSON.parse(line);

	if (message.method === 'initialize') {
		writeMessage({
			jsonrpc: '2.0',
			id: message.id,
			result: {
				capabilities: {
					tools: {
						listChanged: false,
					},
				},
				protocolVersion: '2025-03-26',
				serverInfo: {
					name: 'fake-mcp',
					version: '0.1.0',
				},
			},
		});
		return;
	}

	if (message.method === 'tools/list') {
		writeMessage({
			jsonrpc: '2.0',
			id: message.id,
			result: {
				tools,
			},
		});
		return;
	}

	if (message.method === 'tools/call') {
		if (message.params?.name === 'echo_text') {
			writeMessage({
				jsonrpc: '2.0',
				id: message.id,
				result: {
					content: [
						{
							type: 'text',
							text: `echo:${message.params.arguments?.message ?? ''}`,
						},
					],
					isError: false,
					structuredContent: {
						echoed: message.params.arguments?.message ?? '',
					},
				},
			});
			return;
		}

		writeMessage({
			jsonrpc: '2.0',
			id: message.id,
			result: {
				content: [
					{
						type: 'text',
						text: `unknown tool:${message.params?.name ?? 'missing'}`,
					},
				],
				isError: true,
			},
		});
	}
});
