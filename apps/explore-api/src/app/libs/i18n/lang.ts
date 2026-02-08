export const supportedLangs = ['fr'] as const;

export type Lang = (typeof supportedLangs)[number];
