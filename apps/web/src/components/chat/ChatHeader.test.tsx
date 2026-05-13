import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CommandPaletteProvider } from '../command/CommandPaletteContext.js';
import { ChatHeader } from './ChatHeader.js';

describe('ChatHeader', () => {
	it('wires mobile action buttons to history and menu sheets', () => {
		const openHistory = vi.fn();
		const openMenu = vi.fn();

		render(
			<MemoryRouter>
				<CommandPaletteProvider openPalette={() => undefined}>
					<ChatHeader
						activeConversationTitle="Demo"
						isHistorySheetOpen={false}
						isMenuSheetOpen={false}
						onOpenHistorySheet={openHistory}
						onOpenMenuSheet={openMenu}
					/>
				</CommandPaletteProvider>
			</MemoryRouter>,
		);

		const historyButton = screen.getByRole('button', { name: 'Sohbet gecmisini ac' });
		const menuButton = screen.getByRole('button', { name: 'Menuyu ac' });

		expect(historyButton.getAttribute('aria-controls')).toBe('history-sheet');
		expect(menuButton.getAttribute('aria-controls')).toBe('menu-sheet');

		fireEvent.click(historyButton);
		fireEvent.click(menuButton);

		expect(openHistory).toHaveBeenCalledTimes(1);
		expect(openMenu).toHaveBeenCalledTimes(1);
	});
});
