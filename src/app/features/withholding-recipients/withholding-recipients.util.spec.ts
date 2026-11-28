import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { WrInlNotification } from '@core';
import { inlNotice, recipient } from './withholding-recipients.testing';
import {
  canCancelInl,
  canMarkInlSent,
  certificatePayloadOf,
  declaresThirdPartyIncome,
  defaultSimulatorForm,
  emptyCertificateForm,
  emptyPaymentForm,
  errorKey,
  failureOf,
  formatRate,
  inlCoverage,
  inlCoverageKey,
  inlPayloadOf,
  isBatchValid,
  isCertificateFormValid,
  isInlBlocking,
  isInlFormValid,
  isMonthParam,
  isPaymentFormValid,
  isRecipientFormValid,
  isSimulatorFormReady,
  MAX_BATCH_ROWS,
  paymentPayloadOf,
  problemOf,
  progressStatus,
  recipientFormOf,
  recipientPayloadOf,
  selectableYears,
  simulatePayloadOf,
  thresholdBars,
  toNumber,
} from './withholding-recipients.util';

describe('errors', () => {
  it('maps the code of a problem to its key, with a generic fallback', () => {
    expect(errorKey('inl_notification_missing')).toBe(
      'withholdingRecipients.error.inl_notification_missing',
    );
    expect(errorKey(null)).toBe('withholdingRecipients.error.generic');
    expect(errorKey(undefined)).toBe('withholdingRecipients.error.generic');
  });

  it('reads the problem of a failed call, also from the Blob of a failed download', async () => {
    const plain = new HttpErrorResponse({ status: 422, error: { code: 'regime_locked' } });
    expect((await problemOf(plain))?.code).toBe('regime_locked');

    const blob = new HttpErrorResponse({
      status: 409,
      error: new Blob([JSON.stringify({ code: 'inl_cancelled', detail: 'x' })]),
    });
    expect((await failureOf(blob)).errorKey).toBe('withholdingRecipients.error.inl_cancelled');

    expect(await problemOf(new Error('boom'))).toBeNull();
  });

  it('binds the field errors of a validation failure', async () => {
    const outcome = await failureOf(
      new HttpErrorResponse({
        status: 422,
        error: { errors: { tax_code: ['Already used.'] }, detail: 'Invalid' },
      }),
    );

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('withholdingRecipients.error.generic');
    expect(outcome.detail).toBe('Already used.');
    expect(outcome.errors['tax_code']).toEqual(['Already used.']);
  });
});

describe('numbers and rates', () => {
  it('parses decimal strings and drops what is not a number', () => {
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber('')).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });

  it('shows a rate without trailing zeros', () => {
    expect(formatRate('23.0000')).toBe('23%');
    expect(formatRate('8.7500')).toBe('8.75%');
    expect(formatRate(null)).toBe('');
  });

  it('lists five years ending with the current one and recognises a month', () => {
    expect(selectableYears(new Date(2026, 4, 1))).toEqual([2026, 2025, 2024, 2023, 2022]);
    expect(isMonthParam('2026-05')).toBe(true);
    expect(isMonthParam('2026-13')).toBe(false);
    expect(isMonthParam('')).toBe(false);
  });
});

describe('threshold bars', () => {
  it('colours a bar by how close it is to the limit', () => {
    expect(progressStatus(40)).toBe('normal');
    expect(progressStatus(80)).toBe('active');
    expect(progressStatus(100)).toBe('exception');
  });

  it('puts the two amateur sports thresholds on one bar', () => {
    const bars = thresholdBars([
      { key: 'sports_5000', current: '6000.00', limit: '5000.00', percent: 100 },
      { key: 'sports_15000', current: '6000.00', limit: '15000.00', percent: 40 },
      { key: 'avs_2300', current: '100.00', limit: '2300.00', percent: 4 },
    ]);

    expect(bars.map((bar) => bar.key)).toEqual(['sports_5000', 'avs_2300']);
    expect(bars[0].tier?.key).toBe('sports_15000');
    expect(bars[1].tier).toBeNull();
  });

  it('keeps a lone IRPEF tier as a bar of its own', () => {
    const bars = thresholdBars([
      { key: 'sports_15000', current: '1.00', limit: '15000.00', percent: 0 },
    ]);

    expect(bars.map((bar) => bar.key)).toEqual(['sports_15000']);
  });
});

describe('INL coverage', () => {
  const sent = (overrides: Partial<WrInlNotification>) =>
    inlNotice('n', {
      status: 'sent',
      work_start_date: '2026-05-01',
      work_end_date: '2026-05-31',
      sent_before_start: true,
      ...overrides,
    });

  it('applies only to occasional workers', () => {
    expect(inlCoverage('agent_25bis', [], '2026-05-10')).toBe('not_required');
    expect(inlCoverage('amateur_sports', [], '2026-05-10')).toBe('not_required');
  });

  it('is covered by a sent notice that reached the inspectorate before the start', () => {
    expect(inlCoverage('occasional_worker', [sent({})], '2026-05-10')).toBe('covered');
  });

  it('is late when the notice was sent after the start', () => {
    expect(
      inlCoverage('occasional_worker', [sent({ sent_before_start: false })], '2026-05-10'),
    ).toBe('late');
  });

  it('ignores drafts and cancelled notices', () => {
    const notices = [sent({ status: 'draft' }), sent({ status: 'cancelled' })];

    expect(inlCoverage('occasional_worker', notices, '2026-05-10')).toBe('missing');
  });

  it('is expired when the sent notice ended before the date, missing when the date is not covered at all', () => {
    expect(inlCoverage('occasional_worker', [sent({})], '2026-06-10')).toBe('expired');
    expect(inlCoverage('occasional_worker', [], '2026-06-10')).toBe('missing');
  });

  it('blocks the posting unless covered or not required, with the key of the reason', () => {
    expect(isInlBlocking('covered')).toBe(false);
    expect(isInlBlocking('not_required')).toBe(false);
    expect(isInlBlocking('missing')).toBe(true);
    expect(inlCoverageKey('late')).toBe('withholdingRecipients.error.inl_notification_late');
    expect(inlCoverageKey('expired')).toBe('withholdingRecipients.error.inl_notification_expired');
    expect(inlCoverageKey('missing')).toBe('withholdingRecipients.error.inl_notification_missing');
  });

  it('allows marking sent only a draft and cancelling anything not cancelled', () => {
    expect(canMarkInlSent({ status: 'draft' })).toBe(true);
    expect(canMarkInlSent({ status: 'sent' })).toBe(false);
    expect(canCancelInl({ status: 'sent' })).toBe(true);
    expect(canCancelInl({ status: 'cancelled' })).toBe(false);
  });
});

describe('recipient form', () => {
  it('round-trips a recipient and sends only the fields of its regime', () => {
    const agent = recipient('r-1', {
      regime: 'agent_25bis',
      enasarco_mandate: 'pluri',
      firr_enabled: true,
      tax_code: 'rssmra85t10a562s',
    });
    const payload = recipientPayloadOf(recipientFormOf(agent));

    expect(payload.enasarco_mandate).toBe('pluri');
    expect(payload.firr_enabled).toBe(true);
    expect(payload.tax_code).toBe('RSSMRA85T10A562S');
    expect(payload.avs_number).toBeNull();
    expect(payload.third_party_ytd_income).toBeNull();
  });

  it('drops the agent fields of another regime and the Italian ones of a Swiss recipient', () => {
    const swiss = recipientFormOf(
      recipient('r-2', {
        regime: 'swiss_foreign_artist',
        jurisdiction: 'CH',
        currency: 'CHF',
        enasarco_mandate: 'mono',
        firr_enabled: true,
        tax_code: 'X',
        avs_number: '756.1234.5678.97',
        canton: 'ti',
        activity_type: 'artist',
        cu_causal: 'A',
      }),
    );
    const payload = recipientPayloadOf(swiss);

    expect(payload.enasarco_mandate).toBeNull();
    expect(payload.firr_enabled).toBe(false);
    expect(payload.tax_code).toBeNull();
    expect(payload.avs_number).toBe('756.1234.5678.97');
    expect(payload.canton).toBe('TI');
    expect(payload.activity_type).toBe('artist');
    expect(payload.cu_causal).toBeNull();
  });

  it('sends the third party income with its year only for the regimes that declare it', () => {
    const form = recipientFormOf(recipient('r-3', { regime: 'occasional_worker' }));
    form.third_party_ytd_income = 1200;
    form.third_party_income_year = 2026;
    form.third_party_declared_on = '2026-03-01';

    expect(declaresThirdPartyIncome('occasional_worker')).toBe(true);
    expect(declaresThirdPartyIncome('author_royalty')).toBe(false);
    expect(recipientPayloadOf(form)).toMatchObject({
      third_party_ytd_income: 1200,
      third_party_income_year: 2026,
      third_party_declared_on: '2026-03-01',
    });
    expect(
      recipientPayloadOf({ ...form, regime: 'author_royalty' }).third_party_ytd_income,
    ).toBeNull();
  });

  it('validates the name, the year of a declared income, the canton and the activity', () => {
    const form = recipientFormOf(recipient('r-4', { regime: 'occasional_worker' }));
    expect(isRecipientFormValid(form)).toBe(true);
    expect(isRecipientFormValid({ ...form, display_name: '  ' })).toBe(false);
    expect(isRecipientFormValid({ ...form, third_party_ytd_income: 10 })).toBe(false);
    expect(
      isRecipientFormValid({ ...form, third_party_ytd_income: 10, third_party_income_year: 2026 }),
    ).toBe(true);
    expect(
      isRecipientFormValid({ ...form, regime: 'swiss_foreign_artist', activity_type: null }),
    ).toBe(false);
    expect(
      isRecipientFormValid({
        ...form,
        regime: 'swiss_de_minimis',
        canton: 'Tic',
      }),
    ).toBe(false);
  });
});

describe('declaration and INL forms', () => {
  it('proposes the next calendar year for a declaration and validates its dates', () => {
    const form = emptyCertificateForm(new Date(2026, 10, 28));

    expect(form.fiscal_year).toBe(2027);
    expect(form.valid_from).toBe('2027-01-01');
    expect(form.valid_to).toBe('2027-12-31');
    expect(form.received_on).toBe('2026-11-28');
    expect(isCertificateFormValid(form)).toBe(true);
    expect(isCertificateFormValid({ ...form, valid_to: '2026-12-31' })).toBe(false);
    expect(certificatePayloadOf({ ...form, pec_message_id: ' ' }).pec_message_id).toBeNull();
  });

  it('needs an activity and an end date that is not before the start', () => {
    const form = {
      work_start_date: '2026-05-01',
      work_end_date: '2026-05-03',
      activity_description: ' Talk ',
      work_place: '',
      estimated_compensation: 300,
    };

    expect(isInlFormValid(form)).toBe(true);
    expect(isInlFormValid({ ...form, work_end_date: '2026-04-30' })).toBe(false);
    expect(isInlFormValid({ ...form, activity_description: '' })).toBe(false);
    expect(inlPayloadOf(form)).toEqual({
      work_start_date: '2026-05-01',
      work_end_date: '2026-05-03',
      activity_description: 'Talk',
      work_place: null,
      estimated_compensation: 300,
    });
  });
});

describe('simulator form', () => {
  const now = new Date(2026, 4, 10);

  it('is ready with a positive amount and a payment date that does not precede the service', () => {
    const form = defaultSimulatorForm(now);

    expect(isSimulatorFormReady(form)).toBe(false);
    expect(isSimulatorFormReady({ ...form, gross_amount: 0 })).toBe(false);
    expect(isSimulatorFormReady({ ...form, gross_amount: 100 })).toBe(true);
    expect(isSimulatorFormReady({ ...form, gross_amount: 100, service_date: '2026-06-01' })).toBe(
      false,
    );
  });

  it('sends only the payment facts for a registered recipient', () => {
    const payload = simulatePayloadOf({
      ...defaultSimulatorForm(now),
      recipient_profile_id: 'r-1',
      gross_amount: 500,
      third_party_income: 99,
    });

    expect(payload).toEqual({
      gross_amount: 500,
      payment_date: '2026-05-10',
      service_date: null,
      performance_days: null,
      acquisition_expenses: null,
      recipient_profile_id: 'r-1',
    });
  });

  it('sends the facts of the regime for an ad-hoc simulation', () => {
    const occasional = simulatePayloadOf({
      ...defaultSimulatorForm(now),
      gross_amount: 500,
      third_party_income: 4000,
      prior_company_income: 800,
      has_reduced_certificate: true,
      canton: 'ti',
    });
    expect(occasional).toMatchObject({
      regime: 'occasional_worker',
      third_party_income: 4000,
      prior_company_income: 800,
      has_reduced_certificate: false,
      canton: null,
    });
    expect(occasional).not.toHaveProperty('recipient_profile_id');

    const agent = simulatePayloadOf({
      ...defaultSimulatorForm(now),
      regime: 'agent_25bis',
      gross_amount: 1000,
      enasarco_mandate: 'mono',
      firr_enabled: true,
      has_reduced_certificate: true,
    });
    expect(agent).toMatchObject({
      enasarco_mandate: 'mono',
      firr_enabled: true,
      has_reduced_certificate: true,
      third_party_income: null,
    });

    const swiss = simulatePayloadOf({
      ...defaultSimulatorForm(now),
      regime: 'swiss_de_minimis',
      gross_amount: 1000,
      is_cultural_sector: true,
      prior_avs_base: 2000,
      canton: 'ge',
      tax_code: 'x',
    });
    expect(swiss).toMatchObject({
      is_cultural_sector: true,
      prior_avs_base: 2000,
      canton: 'GE',
      tax_code: null,
    });
  });
});

describe('payments', () => {
  const now = new Date(2026, 4, 10);
  const valid = { ...emptyPaymentForm(now), recipient_profile_id: 'r-1', gross_amount: 100 };

  it('needs a recipient, a positive amount and a service that is not after the payment', () => {
    expect(isPaymentFormValid(emptyPaymentForm(now))).toBe(false);
    expect(isPaymentFormValid(valid)).toBe(true);
    expect(isPaymentFormValid({ ...valid, service_date: '2026-05-11' })).toBe(false);
    expect(isPaymentFormValid({ ...valid, gross_amount: -1 })).toBe(false);
  });

  it('builds the request, blank texts becoming null', () => {
    expect(paymentPayloadOf({ ...valid, document_number: ' N1 ', notes: ' ' })).toEqual({
      recipient_profile_id: 'r-1',
      gross_amount: 100,
      payment_date: '2026-05-10',
      service_date: null,
      document_number: 'N1',
      payment_reference: null,
      performance_days: null,
      acquisition_expenses: null,
      notes: null,
    });
  });

  it('accepts a batch of 1 to 200 valid rows', () => {
    expect(isBatchValid([])).toBe(false);
    expect(isBatchValid([valid])).toBe(true);
    expect(isBatchValid([valid, emptyPaymentForm(now)])).toBe(false);
    expect(isBatchValid(Array.from({ length: MAX_BATCH_ROWS }, () => valid))).toBe(true);
    expect(isBatchValid(Array.from({ length: MAX_BATCH_ROWS + 1 }, () => valid))).toBe(false);
  });
});
