// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState.js';

afterEach(() => {
	cleanup();
});

function renderEmptyState(props?: Partial<Parameters<typeof EmptyState>[0]>) {
	return render(<EmptyState onSubmitSuggestion={vi.fn()} {...props} />);
}

describe('EmptyState greeting and lead', () => {
	it('renders greeting and lead', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 4, 15, 9, 0, 0));
		try {
			renderEmptyState();
			expect(screen.getByText('Günaydın')).toBeTruthy();
			expect(screen.getByText('Nereden başlayalım?')).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('EmptyState context', () => {
	it('shows project context as basename, not full path', () => {
		const { container } = renderEmptyState({ workingDirectory: 'D:\\ai\\Runa' });
		expect(screen.getByText('Proje: Runa')).toBeTruthy();
		expect(container.textContent).not.toContain('D:\\ai\\Runa');
		expect(container.textContent).not.toContain('D:\\ai\\Runa');
	});

	it('shows device chip when device label is provided', () => {
		renderEmptyState({ activeDeviceLabel: "Muhammet'in bilgisayarı" });
		expect(screen.getByText('Cihaz hazır')).toBeTruthy();
	});

	it('does not show device chip for empty device label', () => {
		const { container } = renderEmptyState({ activeDeviceLabel: '' });
		expect(container.textContent).not.toContain('Cihaz hazır');
	});

	it('does not show device chip for whitespace device label', () => {
		const { container } = renderEmptyState({ activeDeviceLabel: '   ' });
		expect(container.textContent).not.toContain('Cihaz hazır');
	});

	it('shows conversation chip when count > 0', () => {
		renderEmptyState({ conversationCount: 3 });
		expect(screen.getByText('3 konuşma')).toBeTruthy();
	});

	it('does not show conversation chip when count is 0', () => {
		const { container } = renderEmptyState({ conversationCount: 0 });
		expect(container.textContent).not.toContain('0 konuşma');
	});

	it('does not show conversation chip for negative count', () => {
		const { container } = renderEmptyState({ conversationCount: -1 });
		expect(container.textContent).not.toContain('-1 konuşma');
	});

	it('shows no chips when no context', () => {
		const { container } = renderEmptyState({});
		expect(container.textContent).not.toContain('Proje:');
		expect(container.textContent).not.toContain('Cihaz hazır');
		expect(container.textContent).not.toContain('konuşma');
	});
});

describe('EmptyState suggestions', () => {
	it('renders 4 suggestion buttons', () => {
		renderEmptyState();
		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(4);
	});

	it('renders visible labels and descriptions', () => {
		renderEmptyState();
		expect(screen.getByText('Kod işini güvenle ilerlet')).toBeTruthy();
		expect(
			screen.getByText('İlgili dosyaları bul, değişikliği planla ve test kanıtıyla kapat.'),
		).toBeTruthy();
		expect(screen.getByText('Bir hatayı araştır')).toBeTruthy();
		expect(screen.getByText('Araştırma notu çıkar')).toBeTruthy();
		expect(screen.getByText('Dokümanı netleştir')).toBeTruthy();
	});

	it('calls onSubmitSuggestion with correct prompt on click', () => {
		const onSubmit = vi.fn();
		render(<EmptyState onSubmitSuggestion={onSubmit} />);
		fireEvent.click(screen.getByText('Kod işini güvenle ilerlet'));
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit.mock.calls[0]?.[0]).toContain('Bu kod işini güvenli şekilde ilerlet');
	});

	it('does not auto-submit; only fires callback', () => {
		const onSubmit = vi.fn();
		render(<EmptyState onSubmitSuggestion={onSubmit} />);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('aria-label contains label and description', () => {
		renderEmptyState();
		const codeButton = screen.getByRole('button', {
			name: /Kod işini güvenle ilerlet.*İlgili dosyaları bul/i,
		});
		expect(codeButton).toBeTruthy();
	});
});

describe('EmptyState forbidden technical strings', () => {
	const forbidden = [
		'Developer Mode',
		'runtime',
		'metadata',
		'transport',
		'schema',
		'protocol',
		'API key',
	];

	for (const term of forbidden) {
		it(`does not contain "${term}" in rendered output`, () => {
			const { container } = renderEmptyState();
			expect(container.textContent).not.toContain(term);
		});
	}
});

describe('EmptyState mojibake absence', () => {
	const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];

	for (const pattern of mojibakePatterns) {
		it(`does not contain mojibake "${pattern}" in rendered output`, () => {
			const { container } = renderEmptyState();
			expect(container.textContent).not.toContain(pattern);
		});
	}
});
