import type { RenderBlock } from '@runa/types';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RunActivityRow } from './RunActivityRow.js';
import {
	type RunActivityRow as RunActivityRowModel,
	adaptToolResultBlock,
} from './runActivityAdapter.js';

function createToolRow(
	overrides: Partial<Extract<RunActivityRowModel, { kind: 'tool' }>> = {},
): Extract<RunActivityRowModel, { kind: 'tool' }> {
	return {
		command: undefined,
		detail: 'Araç tamamlandı.',
		id: 'tool-row',
		kind: 'tool',
		status: 'success',
		title: 'Araç tamamlandı',
		...overrides,
	} as Extract<RunActivityRowModel, { kind: 'tool' }>;
}

describe('RunActivityRow terminal details', () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('renders preview section when details are opened', () => {
		render(
			<ul>
				<RunActivityRow row={createToolRow({ preview: 'JSON: { ok: true }' })} />
			</ul>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Ayrıntıları göster' }));

		expect(screen.getByText('Sonuç önizlemesi')).toBeTruthy();
		expect(screen.getByText('JSON: { ok: true }')).toBeTruthy();
	});

	it('shows truncation note and supports expand/collapse', () => {
		const longOutput = Array.from({ length: 420 }, (_, index) => `line-${index + 1}`).join('\n');

		render(
			<ul>
				<RunActivityRow row={createToolRow({ stdout: longOutput })} />
			</ul>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Ayrıntıları göster' }));
		expect(screen.getByText(/160 \/ 420 sat/i)).toBeTruthy();
		const showMoreButton = screen
			.getAllByRole('button')
			.find((button) => button.textContent?.toLowerCase().includes('tamam'));
		if (!showMoreButton) {
			throw new Error('Expected show-more button.');
		}
		fireEvent.click(showMoreButton);
		expect(screen.getByText(/line-420/)).toBeTruthy();
		const collapseButton = screen
			.getAllByRole('button')
			.find((button) => button.textContent?.toLowerCase().includes('salt'));
		if (!collapseButton) {
			throw new Error('Expected collapse button.');
		}
		fireEvent.click(collapseButton);
		expect(screen.queryByText(/line-420/)).toBeNull();
	});

	it('redacts sensitive values in terminal output', () => {
		render(
			<ul>
				<RunActivityRow
					row={createToolRow({
						stdout: 'Authorization: Bearer eyJabcde12345.aaaaaaaaaaaa.bbbbbbbbbbbb',
					})}
				/>
			</ul>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Ayrıntıları göster' }));

		expect(screen.getByText('Authorization: Bearer [redacted]')).toBeTruthy();
		expect(screen.queryByText(/eyJabcde12345/)).toBeNull();
	});

	it('does not render copy button without command but renders it when command exists', () => {
		const { rerender } = render(
			<ul>
				<RunActivityRow row={createToolRow({ stdout: 'ok' })} />
			</ul>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Ayrıntıları göster' }));
		expect(screen.queryByRole('button', { name: 'Komutu kopyala' })).toBeNull();

		rerender(
			<ul>
				<RunActivityRow row={createToolRow({ command: 'npm run lint' })} />
			</ul>,
		);

		const toggle = screen.getByRole('button', { name: /Ayrıntıları göster|Ayrıntıları gizle/i });
		if (toggle.getAttribute('aria-expanded') !== 'true') {
			fireEvent.click(toggle);
		}
		expect(screen.getByRole('button', { name: 'Komutu kopyala' })).toBeTruthy();
	});

	it('copies full redacted command even when displayed command is truncated', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(globalThis.navigator, 'clipboard', {
			configurable: true,
			value: { writeText },
		});

		const longCommand = `echo ${'x'.repeat(2400)} access_token=super-secret-token-123456`;
		render(
			<ul>
				<RunActivityRow row={createToolRow({ command: longCommand })} />
			</ul>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Ayrıntıları göster' }));
		expect(screen.getByRole('button', { name: 'Komutu kopyala' })).toBeTruthy();
		expect(screen.queryByText('super-secret-token-123456')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Komutu kopyala' }));
		await waitFor(() => {
			expect(writeText).toHaveBeenCalledTimes(1);
		});

		const copied = writeText.mock.calls[0]?.[0];
		expect(typeof copied).toBe('string');
		expect(copied).toContain('access_token=[redacted]');
		expect(copied).not.toContain('super-secret-token-123456');
		expect((copied as string).length).toBeGreaterThan(2000);
	});

	it('renders empty terminal state when there is no technical output', () => {
		render(
			<ul>
				<RunActivityRow
					row={createToolRow({
						command: undefined,
						developerDetail: 'Araç: file.read',
						durationMs: undefined,
						exitCode: undefined,
						preview: undefined,
						stderr: undefined,
						stdout: undefined,
					})}
				/>
			</ul>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Ayrıntıları göster' }));
		expect(screen.getByText(/teknik/i)).toBeTruthy();
	});

	it('keeps call ids and raw tool ids out of non-dev main surface', () => {
		const block: Extract<RenderBlock, { type: 'tool_result' }> = {
			created_at: '2026-05-15T10:00:00.000Z',
			id: 'tool:block',
			payload: {
				call_id: 'call_raw_123',
				status: 'success',
				summary: 'shell.exec completed successfully.',
				tool_name: 'shell.exec',
				user_label_tr: 'Komut çalıştırma',
			},
			schema_version: 1,
			type: 'tool_result',
		};
		const row = adaptToolResultBlock(block, false);
		if (row.kind !== 'tool') {
			throw new Error('Expected tool row.');
		}

		render(
			<ul>
				<RunActivityRow row={row} />
			</ul>,
		);

		expect(screen.queryByText(/call_raw_123/i)).toBeNull();
		expect(screen.queryByText(/shell\.exec/i)).toBeNull();
		expect(screen.getByText(/Komut çalıştırma tamamlandı/i)).toBeTruthy();
	});
});
