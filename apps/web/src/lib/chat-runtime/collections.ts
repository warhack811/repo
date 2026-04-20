export function toSortedStringArray(values: Iterable<string>): readonly string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
