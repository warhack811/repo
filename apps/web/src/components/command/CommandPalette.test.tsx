import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

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

	it('shows expanded command actions and filters with Turkish product labels', () => {
		const commands = createTestCommands();
		const emptyResults = filterCommandPaletteCommands(commands, '');
		const filteredResults = filterCommandPaletteCommands(commands, 'tema');

		expect(emptyResults.map((command) => command.id)).toEqual([
			'go-chat',
			'start-new-chat',
			'open-history-sheet',
			'open-context-sheet',
			'theme-ember-dark',
			'theme-light',
			'theme-rose',
			'theme-system',
			'toggle-advanced-view',
			'show-notifications',
			'go-history-route',
		]);
		expect(filteredResults.map((command) => command.id)).toEqual([
			'theme-ember-dark',
			'theme-light',
			'theme-rose',
			'theme-system',
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

		expect(visitedPaths).toEqual(['/history']);
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
		expect(markup).toContain('Sohbete git');
		expect(markup).toContain('Ctrl+N');
		expect(document.body.textContent).not.toContain('Developer');
	});

	it('runs selected command with keyboard enter', () => {
		const run = vi.fn();
		const commands: readonly CommandPaletteCommand[] = [
			{
				description: 'Test command',
				id: 'test-command',
				keywords: [],
				label: 'Test',
				run,
			},
		];

		render(
			<MemoryRouter>
				<CommandPalette commands={commands} isOpen onClose={() => undefined} />
			</MemoryRouter>,
		);
		const inputs = screen.getAllByRole('searchbox', { name: 'Komut ara' });
		const input = inputs.at(-1);

		expect(input).toBeTruthy();
		if (!input) {
			return;
		}
		fireEvent.keyDown(input, { key: 'Enter' });

		expect(run).toHaveBeenCalledTimes(1);
	});
});
