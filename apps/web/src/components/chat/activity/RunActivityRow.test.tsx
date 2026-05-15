import type { RenderBlock } from '@runa/types';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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
		expect(screen.getByText('160 / 420 satır gösteriliyor')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Tamamını göster' }));
		expect(screen.getByText(/line-420/)).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Kısalt' }));
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
		expect(screen.getByText('Bu araç için gösterilecek teknik çıktı yok.')).toBeTruthy();
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
