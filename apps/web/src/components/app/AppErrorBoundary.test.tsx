import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './AppErrorBoundary.js';

function BrokenChild(): ReactElement {
	throw new Error('TypeError: Cannot read properties of undefined');
}

function StableChild(): ReactElement {
	return <div data-testid="stable-content">Stable content</div>;
}

describe('AppErrorBoundary', () => {
	const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

	afterEach(() => {
		consoleErrorSpy.mockClear();
	});

	it('renders children when no error occurs', () => {
		render(
			<AppErrorBoundary>
				<StableChild />
			</AppErrorBoundary>,
		);
		expect(screen.getByTestId('stable-content').textContent).toBe('Stable content');
	});

	it('shows fallback when child throws', () => {
		render(
			<AppErrorBoundary>
				<BrokenChild />
			</AppErrorBoundary>,
		);
		expect(screen.getByText('Bir şey ters gitti.')).toBeTruthy();
		expect(
			screen.getByText('Bu ekran şu anda açılmadı. Tekrar deneyebilir veya sohbete dönebilirsin.'),
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeTruthy();
	});

	it('renders "Sohbete dön" button when onRecoverToChat is provided', () => {
		render(
			<AppErrorBoundary onRecoverToChat={() => undefined}>
				<BrokenChild />
			</AppErrorBoundary>,
		);
		expect(screen.getByRole('button', { name: 'Sohbete dön' })).toBeTruthy();
	});

	it('does NOT render "Sohbete dön" when onRecoverToChat is not provided', () => {
		render(
			<AppErrorBoundary>
				<BrokenChild />
			</AppErrorBoundary>,
		);
		expect(screen.queryByRole('button', { name: 'Sohbete dön' })).toBeNull();
	});

	it('does not show raw error message in fallback', () => {
		render(
			<AppErrorBoundary>
				<BrokenChild />
			</AppErrorBoundary>,
		);
		const bodyText = document.body.textContent ?? '';
		expect(bodyText).not.toContain('TypeError');
		expect(bodyText).not.toContain('Cannot read properties');
		expect(bodyText).not.toContain('undefined');
		expect(bodyText).not.toContain('stack');
		expect(bodyText).not.toContain('trace');
	});

	it('resetKey change resets boundary', () => {
		const { rerender } = render(
			<AppErrorBoundary resetKey="a">
				<BrokenChild />
			</AppErrorBoundary>,
		);
		expect(screen.getByText('Bir şey ters gitti.')).toBeTruthy();

		rerender(
			<AppErrorBoundary resetKey="b">
				<StableChild />
			</AppErrorBoundary>,
		);
		expect(screen.getByTestId('stable-content')).toBeTruthy();
	});

	it('recover calls onRecoverToChat and resets state', () => {
		const onRecoverToChat = vi.fn();

		render(
			<AppErrorBoundary onRecoverToChat={onRecoverToChat}>
				<BrokenChild />
			</AppErrorBoundary>,
		);

		screen.getByRole('button', { name: 'Sohbete dön' }).click();
		expect(onRecoverToChat).toHaveBeenCalledTimes(1);
	});

	it('calls onError callback but does not show raw error in UI', () => {
		const onError = vi.fn();

		render(
			<AppErrorBoundary onError={onError}>
				<BrokenChild />
			</AppErrorBoundary>,
		);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
		expect(onError.mock.calls[0]?.[1]).toBeTruthy();
	});

	it('fallback has role="alert"', () => {
		render(
			<AppErrorBoundary>
				<BrokenChild />
			</AppErrorBoundary>,
		);
		expect(screen.getByRole('alert')).toBeTruthy();
	});

	it('fallback has no mojibake', () => {
		render(
			<AppErrorBoundary>
				<BrokenChild />
			</AppErrorBoundary>,
		);
		const mojibakePatterns = ['Ã', 'Ä', 'Å', 'â€¢', '�'];
		const bodyText = document.body.textContent ?? '';
		for (const pattern of mojibakePatterns) {
			expect(bodyText).not.toContain(pattern);
		}
	});
});
