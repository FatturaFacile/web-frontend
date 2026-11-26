import { HttpErrorResponse } from '@angular/common/http';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EsigProviderConfig, EsigTemplate } from '@core';
import {
  authMethodsFor,
  boxAt,
  daysLeft,
  defaultAuthMethod,
  DraftRecipient,
  DEFAULT_BOX_HEIGHT,
  DEFAULT_BOX_WIDTH,
  DEFAULT_PROVIDER_FORM,
  downloadName,
  emptyRecipient,
  errorKey,
  failureOf,
  isE164,
  isEmail,
  isProviderFormValid,
  isTemplateFormValid,
  levelRank,
  maxLevel,
  moveBox,
  providerFormOf,
  providerPayloadOf,
  recipientProblems,
  resizeBox,
  sha256Hex,
  signersProgress,
  templateFormOf,
  templatePayloadOf,
  toRecipientPayload,
} from './e-signature.util';

const draft = (patch: Partial<DraftRecipient> = {}): DraftRecipient => ({
  ...emptyRecipient(1, 'FES'),
  full_name: 'Anna Rossi',
  email: 'anna@example.com',
  ...patch,
});

describe('e-signature util', () => {
  describe('errors', () => {
    it('keys an error by the code of the problem and falls back to the generic text', () => {
      expect(errorKey('level_below_policy')).toBe('signatures.error.level_below_policy');
      expect(errorKey(null)).toBe('signatures.error.generic');
      expect(errorKey('')).toBe('signatures.error.generic');
    });

    it('reads the code and the field errors of a failed call', async () => {
      const outcome = await failureOf(
        new HttpErrorResponse({
          status: 422,
          error: { code: 'no_signer', errors: { recipients: ['Required.'] } },
        }),
      );

      expect(outcome).toEqual({
        ok: false,
        errorKey: 'signatures.error.no_signer',
        detail: 'Required.',
        errors: { recipients: ['Required.'] },
      });
    });

    it('reads the problem of a failed download, which arrives as a blob', async () => {
      const blob = new Blob([JSON.stringify({ code: 'document_not_found' })], {
        type: 'application/json',
      });
      const outcome = await failureOf(new HttpErrorResponse({ status: 404, error: blob }));

      expect(outcome.errorKey).toBe('signatures.error.document_not_found');
    });

    it('answers the generic error for anything that is not an HTTP failure', async () => {
      expect((await failureOf(new Error('boom'))).errorKey).toBe('signatures.error.generic');
    });
  });

  describe('levels', () => {
    it('ranks FES below FEA below FEQ', () => {
      expect(levelRank('FES')).toBeLessThan(levelRank('FEA'));
      expect(levelRank('FEA')).toBeLessThan(levelRank('FEQ'));
      expect(maxLevel('FES', 'FEQ')).toBe('FEQ');
      expect(maxLevel('FEA', 'FES')).toBe('FEA');
    });

    it('asks for an SMS code from the advanced tier on', () => {
      expect(defaultAuthMethod('FES')).toBe('email_link');
      expect(defaultAuthMethod('FEA')).toBe('sms_otp');
      expect(defaultAuthMethod('FEQ')).toBe('sms_otp');
    });

    it('offers the identity checks each provider supports', () => {
      expect(authMethodsFor('native', 'FES')).toEqual(['email_link', 'sms_otp']);
      expect(authMethodsFor('native', 'FEA')).toEqual(['sms_otp']);
      expect(authMethodsFor('swisscom', 'FEQ')).toContain('swiss_id');
      expect(authMethodsFor('infocert', 'FEQ')).toContain('spid_cie');
      expect(authMethodsFor('swisscom', 'FES')).toEqual(['sms_otp']);
    });
  });

  describe('recipients', () => {
    it('validates phone numbers as E.164 and e-mail addresses', () => {
      expect(isE164('+41791234567')).toBe(true);
      expect(isE164('0791234567')).toBe(false);
      expect(isE164('+0123456789')).toBe(false);
      expect(isEmail('anna@example.com')).toBe(true);
      expect(isEmail('anna@')).toBe(false);
    });

    it('accepts a complete recipient list', () => {
      expect(recipientProblems([draft()], 'FES')).toEqual([]);
    });

    it('asks for at least one acting recipient, a name, a valid e-mail and no duplicates', () => {
      expect(recipientProblems([draft({ role: 'CC_RECIPIENT' })], 'FES')).toContain(
        'signatures.error.no_signer',
      );
      expect(recipientProblems([draft({ full_name: ' ' })], 'FES')).toContain(
        'signatures.wizard.problemContact',
      );
      expect(recipientProblems([draft({ email: 'nope' })], 'FES')).toContain(
        'signatures.wizard.problemContact',
      );
      expect(
        recipientProblems([draft(), draft({ email: 'ANNA@example.com', signing_order: 2 })], 'FES'),
      ).toContain('signatures.error.duplicate_recipient');
    });

    it('needs a mobile number for the SMS code and a strong method from the advanced tier', () => {
      expect(recipientProblems([draft({ auth_method: 'sms_otp', phone: '' })], 'FES')).toContain(
        'signatures.wizard.problemPhone',
      );
      expect(
        recipientProblems([draft({ auth_method: 'sms_otp', phone: '+41791234567' })], 'FEA'),
      ).toEqual([]);
      expect(recipientProblems([draft({ auth_method: 'email_link' })], 'FEA')).toContain(
        'signatures.error.strong_authentication_required',
      );
      expect(
        recipientProblems(
          [
            draft({ role: 'CC_RECIPIENT', auth_method: 'email_link' }),
            draft({ email: 'b@example.com', auth_method: 'sms_otp', phone: '+41791234567' }),
          ],
          'FEA',
        ),
      ).toEqual([]);
    });

    it('builds the payload without a box for a copy recipient and without an empty phone', () => {
      const payload = toRecipientPayload(
        draft({ role: 'CC_RECIPIENT', signature_box: boxAt(1, 0.5, 0.5), phone: ' ' }),
      );

      expect(payload.signature_box).toBeNull();
      expect(payload.phone).toBeNull();
      expect(payload.email).toBe('anna@example.com');
    });

    it('counts the signers that have signed, not the copy recipients', () => {
      const recipient = (role: string, status: string) => ({ role, status }) as never;

      expect(
        signersProgress({
          recipients: [
            recipient('SIGNER', 'signed'),
            recipient('SIGNER', 'pending'),
            recipient('CC_RECIPIENT', 'pending'),
          ],
        }),
      ).toEqual({ signed: 1, total: 2 });
    });
  });

  describe('signature boxes', () => {
    it('centres a box on the click and keeps it inside the page', () => {
      const centred = boxAt(2, 0.5, 0.5);

      expect(centred.page).toBe(2);
      expect(centred.x).toBeCloseTo(0.5 - DEFAULT_BOX_WIDTH / 2);
      expect(centred.y).toBeCloseTo(0.5 - DEFAULT_BOX_HEIGHT / 2);

      const corner = boxAt(1, 1, 1);

      expect(corner.x + corner.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(corner.y + corner.height).toBeLessThanOrEqual(1 + 1e-9);
      expect(boxAt(1, 0, 0).x).toBe(0);
    });

    it('moves and resizes a box without leaving the page', () => {
      const box = boxAt(1, 0.5, 0.5);
      const moved = moveBox(box, 5, -5);

      expect(moved.x + moved.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(moved.y).toBe(0);

      const resized = resizeBox(moved, 0.01, 5);

      expect(resized.width).toBe(0.05);
      expect(resized.height).toBe(1);
      expect(resized.y).toBe(0);
    });
  });

  describe('dates and files', () => {
    it('counts the days left until a date', () => {
      const now = new Date('2027-03-01T12:00:00Z');

      expect(daysLeft('2027-03-04T12:00:00Z', now)).toBe(3);
      expect(daysLeft('2027-02-27T12:00:00Z', now)).toBe(-2);
      expect(daysLeft(null, now)).toBeNull();
    });

    it('names a download after the title of the document', () => {
      expect(downloadName({ title: 'Contratto di Lavoro — 2027' }, '-signed.pdf')).toBe(
        'contratto-di-lavoro-2027-signed.pdf',
      );
      expect(downloadName({ title: '***' }, '.pdf')).toBe('document.pdf');
    });

    // jsdom exposes no `crypto.subtle` (browsers do), so the spec provides Node's Web Crypto implementation.
    beforeEach(() => {
      vi.stubGlobal('crypto', webcrypto);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('hashes a file with SHA-256 in the browser', async () => {
      expect(await sha256Hex(new Blob(['abc']))).toBe(
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });

  describe('settings forms', () => {
    const config = {
      id: 'c-1',
      provider: 'infocert',
      jurisdiction: 'EU',
      name: 'InfoCert',
      is_sandbox: false,
      is_active: true,
      is_default: true,
      settings: { base_url: 'https://api.example.com' },
    } as EsigProviderConfig;

    it('never reads a stored secret back into the form', () => {
      const form = providerFormOf(config);

      expect(form.credentials).toEqual({});
      expect(form.base_url).toBe('https://api.example.com');
      expect(providerFormOf(null)).toEqual(DEFAULT_PROVIDER_FORM);
    });

    it('sends only the credentials the provider accepts and leaves the empty ones out', () => {
      const payload = providerPayloadOf({
        ...providerFormOf(config),
        credentials: { client_id: ' id-1 ', client_secret: '', api_key: 'not-for-infocert' },
      });

      expect(payload.credentials).toEqual({ client_id: ' id-1 ' });
      expect(payload.settings).toEqual({ base_url: 'https://api.example.com' });
      expect(payload.certificate_password).toBeNull();
    });

    it('needs a name and, with a certificate, its password', () => {
      expect(isProviderFormValid({ ...DEFAULT_PROVIDER_FORM, name: 'Native' })).toBe(true);
      expect(isProviderFormValid(DEFAULT_PROVIDER_FORM)).toBe(false);
      expect(
        isProviderFormValid({
          ...DEFAULT_PROVIDER_FORM,
          name: 'Native',
          certificate: new File(['x'], 'seal.p12'),
          certificate_password: '',
        }),
      ).toBe(false);
    });

    it('builds the template payload with sorted reminders and the amount as a decimal string', () => {
      const template = {
        name: 'Large orders',
        document_type: 'purchase_order',
        required_level: 'FEA',
        jurisdiction: 'ZertES',
        provider_config_id: null,
        routing_mode: 'sequential',
        expiration_days: 10,
        reminder_days: [1, 5, 3],
        min_amount: '5000.00',
        amount_currency: 'CHF',
        is_active: true,
      } as EsigTemplate;
      const form = templateFormOf(template);
      const payload = templatePayloadOf(form);

      expect(payload.reminder_days).toEqual([5, 3, 1]);
      expect(payload.min_amount).toBe('5000.00');
      expect(payload.amount_currency).toBe('CHF');
      expect(templatePayloadOf({ ...form, min_amount: null })).toMatchObject({
        min_amount: null,
        amount_currency: null,
      });
    });

    it('limits the expiry to 1..90 days and the amount to zero or more', () => {
      const form = { ...templateFormOf(null), name: 'Rule' };

      expect(isTemplateFormValid(form)).toBe(true);
      expect(isTemplateFormValid({ ...form, expiration_days: 0 })).toBe(false);
      expect(isTemplateFormValid({ ...form, expiration_days: 91 })).toBe(false);
      expect(isTemplateFormValid({ ...form, min_amount: -1 })).toBe(false);
      expect(isTemplateFormValid({ ...form, name: '' })).toBe(false);
    });
  });
});
