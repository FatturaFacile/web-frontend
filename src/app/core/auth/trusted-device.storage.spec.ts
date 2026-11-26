import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearTrustedDeviceToken, getTrustedDeviceToken, storeTrustedDeviceToken } from './trusted-device.storage';

describe('trusted device token storage', () => {
  const token = 't'.repeat(64);

  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('keeps the token of an account and returns it for the same address in any case', () => {
    storeTrustedDeviceToken('Anna@Acme.example', token);

    expect(getTrustedDeviceToken('anna@acme.example')).toBe(token);
    expect(getTrustedDeviceToken(' ANNA@acme.example ')).toBe(token);
  });

  it('does not hand the token of one account to another', () => {
    storeTrustedDeviceToken('anna@acme.example', token);

    expect(getTrustedDeviceToken('bruno@acme.example')).toBeNull();
  });

  it('never writes the address itself in the storage', () => {
    storeTrustedDeviceToken('anna@acme.example', token);

    const keys = Object.keys(window.localStorage).join(' ');
    expect(keys).not.toContain('anna');
    expect(keys).not.toContain('acme');
  });

  it('forgets the token', () => {
    storeTrustedDeviceToken('anna@acme.example', token);

    clearTrustedDeviceToken('anna@acme.example');

    expect(getTrustedDeviceToken('anna@acme.example')).toBeNull();
  });

  it('ignores blank addresses and tokens', () => {
    storeTrustedDeviceToken('  ', token);
    storeTrustedDeviceToken('anna@acme.example', '');

    expect(window.localStorage.length).toBe(0);
    expect(getTrustedDeviceToken('')).toBeNull();
  });
});
