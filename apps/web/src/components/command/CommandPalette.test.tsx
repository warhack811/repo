import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createAppCommands } from '../app/AppShell.js';
import { CommandPalette } from './CommandPalette.js';
import {
	type CommandPaletteCommand,
	filterCommandPaletteCommands,
	moveCommandPaletteSelection,
} from './command-palette-utils.js';
import { isCommandPaletteKeyboardShortcut } from './useCommandPalette.js';

function createTestCommands(): readonly CommandPaletteCommand[] {
	return createAppCommands(() => undefined);
}

describe('command palette', () => {
	it('recognizes Cmd+K and Ctrl+K without matching plain K', () => {
		expect(isCommandPaletteKeyboardShortcut({ ctrlKey: false, key: 'k', metaKey: true })).toBe(
			true,
		);
		expect(isCommandPaletteKeyboardShortcut({ ctrlKey: true, key: 'K', metaKey: false })).toBe(
			true,
		);
		expect(isCommandPaletteKeyboardShortcut({ ctrlKey: false, key: 'k', metaKey: false })).toBe(
			false,
		);
	});

	it('shows core actions when query is empty and filters with Turkish product labels', () => {
		const commands = createTestCommands();
		const emptyResults = filterCommandPaletteCommands(commands, '');
		const filteredResults = filterCommandPaletteCommands(commands, 'cihaz');

		expect(emptyResults.map((command) => command.label)).toEqual([
			'Sohbet’e git',
			'Yeni sohbet başlat',
			'Geçmiş’e git',
			'Sohbet geçmişini aç',
			'Cihazlar’a git',
			'Cihaz bağlantılarını görüntüle',
			'Hesap’a git',
			'Tercihleri aç',
		]);
		expect(filteredResults.map((command) => command.id)).toEqual([
			'go-devices',
			'view-device-connections',
		]);
	});

	it('wraps arrow-key selection and lets Enter run the selected command path', () => {
		const visitedPaths: string[] = [];
		const commands = createAppCommands((path) => visitedPaths.push(path));
		const selectedIndex = moveCommandPaletteSelection({
			currentIndex: 0,
			direction: 'up',
			itemCount: commands.length,
		});

		expect(selectedIndex).toBe(commands.length - 1);

		commands[selectedIndex]?.run();

		expect(visitedPaths).toEqual(['/account?tab=preferences']);
	});

	it('keeps normal palette copy free of internal language', () => {
		const commands = createTestCommands();
		const commandText = commands
			.flatMap((command) => [command.label, command.description, ...command.keywords])
			.join('\n');

		for (const forbiddenPhrase of [
			'Developer',
			'operator',
			'runtime',
			'transport',
			'debug',
			'metadata',
		]) {
			expect(commandText).not.toContain(forbiddenPhrase);
		}
	});

	it('renders an accessible command search surface when open', () => {
		render(
			<MemoryRouter>
				<CommandPalette commands={createTestCommands()} isOpen onClose={() => undefined} />
			</MemoryRouter>,
		);
		const markup = document.body.textContent ?? '';

		expect(screen.getByRole('searchbox', { name: 'Komut ara' })).toBeTruthy();
		expect(screen.getByLabelText('Komutlar')).toBeTruthy();
		expect(markup).toContain('Sohbet’e git');
		expect(document.body.textContent).not.toContain('Developer');
	});
});
