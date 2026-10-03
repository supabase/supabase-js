import { describe, it, expect } from 'vitest';

/**
 * Isolated unit tests for Supabase Auth localStorage key prefix formatting.
 */

function formatStorageKey(storageKey: string, suffix?: string): string {
  if (!storageKey) return 'sb-auth-token';
  const cleanKey = storageKey.trim();
  return suffix ? `${cleanKey}-${suffix.trim()}` : cleanKey;
}

describe('Storage Key Prefix Formatter', () => {
  it('should format default storage key fallback when key is empty', () => {
    expect(formatStorageKey('')).toBe('sb-auth-token');
  });

  it('should format custom storage key with suffix', () => {
    expect(formatStorageKey('my-app-auth', 'token')).toBe('my-app-auth-token');
  });

  it('should trim surrounding whitespace from key and suffix', () => {
    expect(formatStorageKey('  app_session  ', '  refresh  ')).toBe('app_session-refresh');
  });
});
