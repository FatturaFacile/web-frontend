import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { webcrypto } from 'node:crypto';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElectronicSignatureApiService } from '@core';
import { PublicVerifyStore } from './public-verify.store';

const FOUND = { data: { found: true, assurance: 'advanced', code: 'AAAAA-BBBBB-CCCCC-DDDDD' } };

describe('PublicVerifyStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof PublicVerifyStore>;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    // jsdom exposes no `crypto.subtle` (browsers do), so the spec provides Node's Web Crypto implementation.
    vi.stubGlobal('crypto', webcrypto);
    api = {
      verifyByCode: vi.fn(() => of(FOUND)),
      verifyByHash: vi.fn(() => of(FOUND)),
      verifyFile: vi.fn(() => of(FOUND)),
    };
    TestBed.configureTestingModule({
      providers: [PublicVerifyStore, { provide: ElectronicSignatureApiService, useValue: api }],
    });
    store = TestBed.inject(PublicVerifyStore);
  });

  it('verifies a code with the whitespace trimmed', async () => {
    const outcome = await store.verifyCode('  AAAAA-BBBBB-CCCCC-DDDDD ');

    expect(outcome.ok).toBe(true);
    expect(api['verifyByCode']).toHaveBeenCalledWith('AAAAA-BBBBB-CCCCC-DDDDD');
    expect(store.result()?.assurance).toBe('advanced');
    expect(store.loading()).toBe(false);
  });

  it('keeps the translation key of a refusal and clears the previous result', async () => {
    await store.verifyCode('AAAAA-BBBBB-CCCCC-DDDDD');
    api['verifyByCode'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 429, error: { code: 'generic' } })),
    );

    const outcome = await store.verifyCode('AAAAA-BBBBB-CCCCC-DDDDD');

    expect(outcome.ok).toBe(false);
    expect(store.error()).toBe('signatures.error.generic');
    expect(store.result()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('hashes a chosen file in the browser and sends only the hash', async () => {
    await store.chooseFile(new File(['abc'], 'contract.pdf'));

    expect(store.fileHash()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );

    await store.verifyHash();

    expect(api['verifyByHash']).toHaveBeenCalledWith(store.fileHash());
    expect(api['verifyFile']).not.toHaveBeenCalled();
  });

  it('uploads the file only when asked for the check of the embedded signatures', async () => {
    const file = new File(['abc'], 'contract.pdf');
    await store.chooseFile(file);
    await store.verifyFile();

    expect(api['verifyFile']).toHaveBeenCalledWith(file);
  });

  it('does nothing without a file and forgets everything when the file is removed', async () => {
    await store.verifyHash();
    await store.verifyFile();

    expect(api['verifyByHash']).not.toHaveBeenCalled();
    expect(api['verifyFile']).not.toHaveBeenCalled();

    await store.chooseFile(new File(['abc'], 'contract.pdf'));
    await store.chooseFile(null);

    expect(store.file()).toBeNull();
    expect(store.fileHash()).toBeNull();
  });
});
