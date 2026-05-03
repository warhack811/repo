import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatRuntime } from './useChatRuntime.js';

class MockWebSocket {
	static readonly OPEN = 1;
	static instances: MockWebSocket[] = [];

	readonly sentMessages: string[] = [];
	readyState = MockWebSocket.OPEN;

	constructor() {
		MockWebSocket.instances.push(this);
	}

	addEventListener(): void {}

	close(): void {}

	send(message: string): void {
		this.sentMessages.push(message);
	}
}

function RuntimeHarness(): ReactElement {
	const runtime = useChatRuntime();

	return (
		<form onSubmit={runtime.submitRunRequest}>
			<button
				type="button"
				onClick={() => {
					runtime.setApprovalMode('trusted-session');
					runtime.setPrompt('Read the workspace notes.');
				}}
			>
				prepare
			</button>
			<button type="submit">submit</button>
		</form>
	);
}

describe('useChatRuntime approval mode payload', () => {
	beforeEach(() => {
		MockWebSocket.instances = [];
		window.localStorage.clear();
		vi.stubGlobal('WebSocket', MockWebSocket);
	});

	it('sends the selected approval mode in new run requests', () => {
		render(<RuntimeHarness />);

		fireEvent.click(screen.getByText('prepare'));
		fireEvent.click(screen.getByText('submit'));

		const sentMessage = MockWebSocket.instances[0]?.sentMessages[0];

		expect(sentMessage).toBeDefined();
		expect(JSON.parse(sentMessage ?? '{}')).toMatchObject({
			payload: {
				approval_policy: {
					mode: 'trusted-session',
				},
			},
			type: 'run.request',
		});
	});
});
