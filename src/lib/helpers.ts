// helpers.ts

export const stripTrailingSlash = (url: string): string => url.replace(/\/$/, '')

export const isBrowser = (): boolean => typeof window !== 'undefined'
