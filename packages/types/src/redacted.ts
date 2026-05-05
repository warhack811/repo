const REDACTED_BRAND: unique symbol = Symbol('runa.redacted.brand');
const REDACTED_VALUE: unique symbol = Symbol('runa.redacted.value');

export type Redacted<T> = {
	readonly [REDACTED_BRAND]: true;
	readonly [REDACTED_VALUE]: T;
};

export function redact<T>(value: T): Redacted<T> {
	const redactedValue = {};

	Object.defineProperties(redactedValue, {
		[REDACTED_BRAND]: {
			enumerable: false,
			value: true,
		},
		[REDACTED_VALUE]: {
			enumerable: false,
			value,
		},
	});

	return redactedValue as Redacted<T>;
}

export function unwrapRedacted<T>(value: Redacted<T>): T {
	return value[REDACTED_VALUE];
}
