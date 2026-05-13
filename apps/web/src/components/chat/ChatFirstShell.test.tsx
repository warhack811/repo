import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ChatHeader } from './ChatHeader.js';
import { ChatLayout } from './ChatLayout.js';
import { EmptyState } from './EmptyState.js';

describe('chat-first shell pieces', () => {
	it('renders a compact product header without developer language', () => {
		const markup = renderToStaticMarkup(
			<MemoryRouter>
				<ChatHeader
					connectionStatus="open"
					desktopDevices={[]}
					onToggleSidebar={() => undefined}
					statusLabel="Canlı"
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

		expect(markup).toContain('Kod yaz veya gözden geçir');
		expect(markup).toContain('Araştır ve özetle');
		expect(markup).toContain('Doküman hazırla');
		expect(markup).not.toContain('Bir dosyayı analiz et');
		expect(markup).toContain('Ctrl+K ile komut paleti açılır');
		expect(markup).not.toContain('operator');
		expect(markup).not.toContain('Masaüstü hedefi');
		expect(markup).not.toContain('burada görünür');
	});

	it('keeps the work surface before the composer and treats history as a drawer', () => {
		const markup = renderToStaticMarkup(
			<ChatLayout
				composer={<div data-testid="composer">Composer</div>}
				isSidebarOpen={false}
				messages={<div data-testid="work">Work</div>}
				onCloseSidebar={() => undefined}
				onToggleSidebar={() => undefined}
				sidebar={<div data-testid="history">History</div>}
			/>,
		);

		expect(markup.indexOf('data-testid="work"')).toBeLessThan(
			markup.indexOf('data-testid="composer"'),
		);
		expect(markup).toContain('runa-chat-layout__sidebar');
		expect(markup).not.toContain('runa-chat-layout--sidebar-open');
	});
});
