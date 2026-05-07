export const supportedLocales = ['en', 'tr'] as const;

export type SupportedLocale = (typeof supportedLocales)[number];
