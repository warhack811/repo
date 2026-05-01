const RELATIVE_DATE_PATTERN =
	/(?<amount>\d+)\s*(?<unit>minute|minutes|min|hour|hours|day|days|week|weeks|month|months|year|years|dakika|saat|gun|gün|hafta|ay|yil|yıl)\s*(ago|once|önce)?/iu;

function subtractUtc(now: Date, unit: string, amount: number): Date {
	const date = new Date(now.getTime());
	const normalizedUnit = unit.toLocaleLowerCase('tr-TR');

	if (['minute', 'minutes', 'min', 'dakika'].includes(normalizedUnit)) {
		date.setUTCMinutes(date.getUTCMinutes() - amount);
		return date;
	}

	if (['hour', 'hours', 'saat'].includes(normalizedUnit)) {
		date.setUTCHours(date.getUTCHours() - amount);
		return date;
	}

	if (['day', 'days', 'gun', 'gün'].includes(normalizedUnit)) {
		date.setUTCDate(date.getUTCDate() - amount);
		return date;
	}

	if (['week', 'weeks', 'hafta'].includes(normalizedUnit)) {
		date.setUTCDate(date.getUTCDate() - amount * 7);
		return date;
	}

	if (['month', 'months', 'ay'].includes(normalizedUnit)) {
		date.setUTCMonth(date.getUTCMonth() - amount);
		return date;
	}

	date.setUTCFullYear(date.getUTCFullYear() - amount);
	return date;
}

function parseRelativeDate(value: string, now: Date): string | null {
	const match = RELATIVE_DATE_PATTERN.exec(value);
	const amount = match?.groups?.['amount']
		? Number.parseInt(match.groups['amount'], 10)
		: Number.NaN;
	const unit = match?.groups?.['unit'];

	if (!unit || !Number.isFinite(amount)) {
		return null;
	}

	return subtractUtc(now, unit, amount).toISOString();
}

export function extractPublishedAt(
	rawDate: string | null,
	options: Readonly<{
		readonly now?: Date;
	}> = {},
): string | null {
	if (!rawDate) {
		return null;
	}

	const normalizedDate = rawDate.replace(/\s+/gu, ' ').trim();

	if (!normalizedDate) {
		return null;
	}

	const now = options.now ?? new Date();
	const relativeDate = parseRelativeDate(normalizedDate, now);

	if (relativeDate) {
		return relativeDate;
	}

	const parsedTime = Date.parse(normalizedDate);

	return Number.isFinite(parsedTime) ? new Date(parsedTime).toISOString() : null;
}
