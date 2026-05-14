import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext } from 'react';

type CommandPaletteContextValue = Readonly<{
	openPalette: () => void;
}>;

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

type CommandPaletteProviderProps = Readonly<{
	children: ReactNode;
	openPalette: () => void;
}>;

export function CommandPaletteProvider({
	children,
	openPalette,
}: CommandPaletteProviderProps): ReactElement {
	return (
		<CommandPaletteContext.Provider value={{ openPalette }}>
			{children}
		</CommandPaletteContext.Provider>
	);
}

export function useCommandPaletteTrigger(): (() => void) | null {
	return useContext(CommandPaletteContext)?.openPalette ?? null;
}
