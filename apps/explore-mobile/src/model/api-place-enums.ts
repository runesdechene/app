export const accessibilityKeys = ['easy', 'medium', 'hard'] as const

export type Accessibility = (typeof accessibilityKeys)[number]
