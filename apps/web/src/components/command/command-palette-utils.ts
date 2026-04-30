export type CommandPaletteCommand = Readonly<{
	description: string;
	id: string;
	keywords: readonly string[];
	label: string;
	run: () => void;
}>;

function normalizeSearchValue(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLocaleLowerCase('tr-TR')
		.trim();
}

export function filterCommandPaletteCommands(
	commands: readonly CommandPaletteCommand[],
	query: string,
): readonly CommandPaletteCommand[] {
	const normalizedQuery = normalizeSearchValue(query);

	if (normalizedQuery.length === 0) {
		return commands;
	}

	return commands.filter((command) => {
		const haystack = normalizeSearchValue(
			[command.label, command.description, ...command.keywords].join(' '),
		);

		return haystack.includes(normalizedQuery);
	});
}

export function moveCommandPaletteSelection(input: {
	currentIndex: number;
	direction: 'down' | 'up';
	itemCount: number;
}): number {
	if (input.itemCount <= 0) {
		return 0;
	}

	const offset = input.direction === 'down' ? 1 : -1;

	return (input.currentIndex + offset + input.itemCount) % input.itemCount;
}
