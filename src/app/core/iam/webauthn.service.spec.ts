import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromBase64Url, PasskeyUnavailableError, toBase64Url, WebAuthnService } from './webauthn.service';

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe('base64url', () => {
  it('round-trips binary data without padding or url-unsafe characters', () => {
    const encoded = toBase64Url(bytes(251, 255, 190, 0, 1, 2, 3));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(Array.from(new Uint8Array(fromBase64Url(encoded)))).toEqual([251, 255, 190, 0, 1, 2, 3]);
  });
});

describe('WebAuthnService (mocked navigator.credentials)', () => {
  const service = new WebAuthnService();
  const create = vi.fn();
  const get = vi.fn();

  beforeEach(() => {
    create.mockReset();
    get.mockReset();
    vi.stubGlobal('PublicKeyCredential', class {});
    vi.stubGlobal('navigator', { credentials: { create, get } });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates a credential from the JSON options and returns base64url JSON', async () => {
    create.mockResolvedValue({
      id: 'abc',
      type: 'public-key',
      rawId: bytes(1, 2, 3),
      response: { clientDataJSON: bytes(4), attestationObject: bytes(5, 6), getTransports: () => ['internal'] },
    });

    const result = (await service.create({
      challenge: toBase64Url(bytes(9, 9)),
      user: { id: toBase64Url(bytes(7)), name: 'a@b.test', displayName: 'A' },
      excludeCredentials: [{ id: toBase64Url(bytes(8)), type: 'public-key' }],
    })) as { id: string; rawId: string; response: { attestationObject: string; transports: string[] } };

    const passed = create.mock.calls[0][0].publicKey;
    expect(new Uint8Array(passed.challenge)).toEqual(new Uint8Array([9, 9]));
    expect(new Uint8Array(passed.user.id)).toEqual(new Uint8Array([7]));
    expect(new Uint8Array(passed.excludeCredentials[0].id)).toEqual(new Uint8Array([8]));
    expect(result.id).toBe('abc');
    expect(result.rawId).toBe(toBase64Url(bytes(1, 2, 3)));
    expect(result.response.attestationObject).toBe(toBase64Url(bytes(5, 6)));
    expect(result.response.transports).toEqual(['internal']);
  });

  it('gets an assertion, with conditional mediation when asked', async () => {
    get.mockResolvedValue({
      id: 'abc',
      type: 'public-key',
      rawId: bytes(1),
      response: { clientDataJSON: bytes(2), authenticatorData: bytes(3), signature: bytes(4), userHandle: bytes(5) },
    });

    const result = (await service.get({ challenge: toBase64Url(bytes(1)) }, true)) as { response: { userHandle: string } };

    expect(get.mock.calls[0][0].mediation).toBe('conditional');
    expect(result.response.userHandle).toBe(toBase64Url(bytes(5)));
  });

  it('maps a cancelled prompt and a missing credential to errors the UI can tell apart', async () => {
    get.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await expect(service.get({ challenge: 'AA' })).rejects.toMatchObject({ reason: 'cancelled' });

    create.mockResolvedValue(null);
    await expect(service.create({ challenge: 'AA', user: { id: 'AA', name: 'n', displayName: 'n' } })).rejects.toBeInstanceOf(
      PasskeyUnavailableError,
    );
  });

  it('reports an unsupported browser', async () => {
    vi.stubGlobal('navigator', {});
    expect(service.isSupported()).toBe(false);
    await expect(service.get({ challenge: 'AA' })).rejects.toMatchObject({ reason: 'unsupported' });
    expect(await service.isConditionalSupported()).toBe(false);
  });
});
