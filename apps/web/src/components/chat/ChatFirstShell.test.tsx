import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ChatHeader } from './ChatHeader.js';
import { EmptyState } from './EmptyState.js';

describe('chat-first shell pieces', () => {
	it('renders a compact product header without developer language', () => {
		const markup = renderToStaticMarkup(
			<MemoryRouter>
				<ChatHeader
					connectionStatus="open"
					desktopDevices={[]}
					onToggleSidebar={() => undefined}
					statusLabel="Canli"
				/>
			</MemoryRouter>,
		);

		expect(markup).toContain('Runa');
		expect(markup).toContain('Yeni sohbet');
		expect(markup).toContain('Hesap ve ayarlar');
		expect(markup).not.toContain('Developer');
		expect(markup).not.toContain('runtime');
	});

	it('renders honest first-impression suggestions', () => {
		const markup = renderToStaticMarkup(<EmptyState onSubmitSuggestion={() => undefined} />);

		expect(markup).toContain('Bugun neyi birlikte ilerletelim?');
		expect(markup).toContain('kaynaklariyla toparla');
		expect(markup).toContain('onay isteyen');
		expect(markup).not.toContain('operator');
	});
});
