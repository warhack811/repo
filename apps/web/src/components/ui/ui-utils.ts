export function cx(...parts: readonly (false | null | string | undefined)[]): string | undefined {
	const className = parts.filter(Boolean).join(' ');
	return className.length > 0 ? className : undefined;
}
