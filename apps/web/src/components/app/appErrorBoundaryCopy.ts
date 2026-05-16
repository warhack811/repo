export type AppErrorRecoveryCopy = Readonly<{
	title: string;
	description: string;
	retryLabel: string;
	recoverLabel: string;
	eyebrow: string;
}>;

export function getAppErrorRecoveryCopy(): AppErrorRecoveryCopy {
	return {
		title: 'Bir şey ters gitti.',
		description: 'Bu ekran şu anda açılmadı. Tekrar deneyebilir veya sohbete dönebilirsin.',
		retryLabel: 'Tekrar dene',
		recoverLabel: 'Sohbete dön',
		eyebrow: 'Güvenli kurtarma',
	} as const;
}

const UNSAFE_PATTERNS: readonly string[] = [
	'Error',
	'TypeError',
	'ReferenceError',
	'Cannot read properties',
	'Stack trace',
	'componentDidCatch',
	'getDerivedStateFromError',
	'Internal Server Error',
	'backend',
	'protocol',
	'payload',
	'metadata',
	'trace',
	'stack',
	'undefined',
	'null',
];

export function containsUnsafeErrorCopy(value: string): boolean {
	for (const pattern of UNSAFE_PATTERNS) {
		if (value.includes(pattern)) {
			return true;
		}
	}
	return false;
}
