import { Search } from 'lucide-react';
import type { ChangeEvent, KeyboardEvent, ReactElement } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { RunaModal } from '../ui/RunaModal.js';
import {
	type CommandPaletteCommand,
	filterCommandPaletteCommands,
	moveCommandPaletteSelection,
} from './command-palette-utils.js';

type CommandPaletteProps = Readonly<{
	commands: readonly CommandPaletteCommand[];
	isOpen: boolean;
	onClose: () => void;
}>;

export function CommandPalette({
	commands,
	isOpen,
	onClose,
}: CommandPaletteProps): ReactElement | null {
	const inputId = useId();
	const listboxId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [query, setQuery] = useState('');
	const [selectedIndex, setSelectedIndex] = useState(0);
	const filteredCommands = useMemo(
		() => filterCommandPaletteCommands(commands, query),
		[commands, query],
	);
	const selectedCommand = filteredCommands[selectedIndex] ?? filteredCommands[0] ?? null;

	useEffect(() => {
		if (!isOpen) {
			return;
		}

		setQuery('');
		setSelectedIndex(0);

		const animationFrame = window.requestAnimationFrame(() => {
			inputRef.current?.focus();
		});

		return () => {
			window.cancelAnimationFrame(animationFrame);
		};
	}, [isOpen]);

	useEffect(() => {
		if (selectedIndex < filteredCommands.length) {
			return;
		}

		setSelectedIndex(0);
	}, [filteredCommands.length, selectedIndex]);

	if (!isOpen) {
		return null;
	}

	function runCommand(command: CommandPaletteCommand): void {
		command.run();
		onClose();
	}

	function handleQueryChange(event: ChangeEvent<HTMLInputElement>): void {
		setQuery(event.target.value);
		setSelectedIndex(0);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setSelectedIndex((currentIndex) =>
				moveCommandPaletteSelection({
					currentIndex,
					direction: 'down',
					itemCount: filteredCommands.length,
				}),
			);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			setSelectedIndex((currentIndex) =>
				moveCommandPaletteSelection({
					currentIndex,
					direction: 'up',
					itemCount: filteredCommands.length,
				}),
			);
			return;
		}

		if (event.key === 'Enter' && selectedCommand) {
			event.preventDefault();
			runCommand(selectedCommand);
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	return (
		<RunaModal
			className="runa-command-palette"
			isOpen={isOpen}
			onClose={onClose}
			size="lg"
			title="Komut paleti"
		>
			<div className="runa-command-palette__search">
				<Search aria-hidden="true" size={18} />
				<label className="runa-sr-only" htmlFor={inputId}>
					Komut ara
				</label>
				<input
					ref={inputRef}
					aria-activedescendant={selectedCommand ? `runa-command-${selectedCommand.id}` : undefined}
					aria-controls={listboxId}
					aria-expanded="true"
					aria-label="Komut ara"
					className="runa-command-palette__input"
					id={inputId}
					onChange={handleQueryChange}
					onKeyDown={handleKeyDown}
					placeholder="Komut veya sayfa ara"
					type="search"
					value={query}
				/>
				<kbd className="runa-command-palette__key">Esc</kbd>
			</div>

			<div className="runa-command-palette__body">
				{filteredCommands.length > 0 ? (
					<div aria-label="Komutlar" className="runa-command-palette__list" id={listboxId}>
						{filteredCommands.map((command, index) => {
							const isSelected = index === selectedIndex;

							return (
								<button
									key={command.id}
									className={`runa-command-palette__item${
										isSelected ? ' runa-command-palette__item--selected' : ''
									}`}
									id={`runa-command-${command.id}`}
									onClick={() => runCommand(command)}
									aria-current={isSelected ? 'true' : undefined}
									type="button"
								>
									<span className="runa-command-palette__item-label">{command.label}</span>
									<span className="runa-command-palette__item-description">
										{command.description}
									</span>
								</button>
							);
						})}
					</div>
				) : (
					<output className="runa-command-palette__empty">Bu aramayla eşleşen komut yok.</output>
				)}
			</div>
		</RunaModal>
	);
}
