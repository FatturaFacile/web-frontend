import { Injectable } from '@angular/core';

/** Base64url without padding, the encoding of every binary member of the WebAuthn JSON the API speaks. */
export function toBase64Url(buffer: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

interface CreationOptionsJson {
  challenge: string;
  user: { id: string; name: string; displayName: string };
  excludeCredentials?: { id: string; type: string; transports?: string[] }[];
  [key: string]: unknown;
}

interface RequestOptionsJson {
  challenge: string;
  allowCredentials?: { id: string; type: string; transports?: string[] }[];
  [key: string]: unknown;
}

/** The raised error when the browser has no WebAuthn or the person cancels the prompt. */
export class PasskeyUnavailableError extends Error {
  constructor(readonly reason: 'unsupported' | 'cancelled' | 'failed') {
    super(reason);
  }
}

/**
 * Thin wrapper over navigator.credentials for passkeys. It converts the base64url JSON of the API into the binary
 * options of the browser and the result back into JSON, and keeps every secret out of this app: only the public
 * attestation or the signed assertion is sent to the server.
 */
@Injectable({ providedIn: 'root' })
export class WebAuthnService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials;
  }

  /** Whether the browser can offer passkeys in the autofill of the login field (conditional mediation). */
  async isConditionalSupported(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }
    const pkc = window.PublicKeyCredential as typeof PublicKeyCredential & {
      isConditionalMediationAvailable?: () => Promise<boolean>;
    };
    return (await pkc.isConditionalMediationAvailable?.()) ?? false;
  }

  /** navigator.credentials.create() for the creation options of the API; resolves to the JSON to post back. */
  async create(options: CreationOptionsJson): Promise<unknown> {
    const credential = await this.run(() =>
      navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: fromBase64Url(options.challenge),
          user: { ...options.user, id: fromBase64Url(options.user.id) },
          excludeCredentials: options.excludeCredentials?.map((c) => ({ ...c, id: fromBase64Url(c.id) })),
        } as unknown as PublicKeyCredentialCreationOptions,
      }),
    );

    const response = credential.response as AuthenticatorAttestationResponse;

    return {
      id: credential.id,
      rawId: toBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: toBase64Url(response.clientDataJSON),
        attestationObject: toBase64Url(response.attestationObject),
        transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
      },
    };
  }

  /**
   * navigator.credentials.get() for the request options of the API. With `conditional` the browser shows the passkeys
   * in the autofill of the login field and the promise stays pending until the person picks one (or `signal` aborts).
   */
  async get(options: RequestOptionsJson, conditional = false, signal?: AbortSignal): Promise<unknown> {
    const credential = await this.run(() =>
      navigator.credentials.get({
        publicKey: {
          ...options,
          challenge: fromBase64Url(options.challenge),
          allowCredentials: options.allowCredentials?.map((c) => ({ ...c, id: fromBase64Url(c.id) })),
        } as unknown as PublicKeyCredentialRequestOptions,
        ...(conditional ? { mediation: 'conditional' as CredentialMediationRequirement } : {}),
        signal,
      }),
    );

    const response = credential.response as AuthenticatorAssertionResponse;

    return {
      id: credential.id,
      rawId: toBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: toBase64Url(response.clientDataJSON),
        authenticatorData: toBase64Url(response.authenticatorData),
        signature: toBase64Url(response.signature),
        userHandle: response.userHandle ? toBase64Url(response.userHandle) : null,
      },
    };
  }

  private async run(action: () => Promise<Credential | null>): Promise<PublicKeyCredential> {
    if (!this.isSupported()) {
      throw new PasskeyUnavailableError('unsupported');
    }
    try {
      const credential = await action();
      if (credential === null) {
        throw new PasskeyUnavailableError('cancelled');
      }
      return credential as PublicKeyCredential;
    } catch (error) {
      if (error instanceof PasskeyUnavailableError) {
        throw error;
      }
      const name = (error as { name?: string }).name;
      throw new PasskeyUnavailableError(name === 'NotAllowedError' || name === 'AbortError' ? 'cancelled' : 'failed');
    }
  }
}
