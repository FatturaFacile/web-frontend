import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { TndEnvelopeItem, TndParticipation, TndReadiness, TndVaultDocument } from '@core';
import {
  betreibungsauszugTracker,
  betreibungsauszugValidUntil,
  classifyVerification,
  countdownTo,
  criterionLabel,
  daysUntil,
  documentLight,
  dueWithin,
  envelopeProgress,
  errorKey,
  failureOf,
  groupByStatus,
  issueKey,
  jurisdictionBadge,
  recommendationKey,
  signatureFormatOfFile,
  soaNextMilestone,
  submissionGate,
  summarizeLights,
  trafficLightOf,
  validateEnvelope,
} from './tender-management.util';

const NOW = new Date('2028-03-10T12:00:00Z');

function item(overrides: Partial<TndEnvelopeItem> = {}): TndEnvelopeItem {
  return {
    key: 'doc',
    label: 'Doc',
    required: true,
    signature_required: false,
    file_name: 'doc.pdf',
    sha256: 'abc',
    uploaded_at: '2028-03-01T10:00:00Z',
    status: 'ok',
    signature: null,
    ...overrides,
  };
}

function vaultDoc(overrides: Partial<TndVaultDocument> = {}): TndVaultDocument {
  return {
    id: 'd1',
    doc_type: 'IT_DURC',
    jurisdiction: 'IT',
    title: null,
    document_number: null,
    issuing_body: null,
    soa_categories_classifications: null,
    issue_date: '2028-01-01',
    expiry_date: '2028-06-01',
    intermediate_triennial_check_date: null,
    fvoe20_synced: false,
    fvoe20_synced_at: null,
    numeric_value: null,
    file_name: 'f.pdf',
    has_file: true,
    verification_status: 'Valid',
    days_to_expiry: 83,
    effective_expiry_date: '2028-06-01',
    renewed_from_id: null,
    notes: null,
    ...overrides,
  };
}

describe('deadline countdown', () => {
  it('has no countdown without a deadline', () => {
    expect(countdownTo(null, NOW).urgency).toBe('none');
    expect(countdownTo('not a date', NOW).urgency).toBe('none');
  });

  it('splits the time left and grades the urgency by the alert milestones', () => {
    const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

    expect(countdownTo(at(3), NOW).urgency).toBe('critical');
    expect(countdownTo(at(24), NOW).urgency).toBe('critical');
    expect(countdownTo(at(48), NOW).urgency).toBe('warning');
    expect(countdownTo(at(100), NOW).urgency).toBe('soon');
    expect(countdownTo(at(400), NOW).urgency).toBe('normal');

    const parts = countdownTo(new Date(NOW.getTime() + (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000).toISOString(), NOW);
    expect(parts).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5, expired: false });
  });

  it('expires at the deadline', () => {
    const countdown = countdownTo(NOW.toISOString(), NOW);

    expect(countdown.expired).toBe(true);
    expect(countdown.urgency).toBe('expired');
  });

  it('tells whether a deadline falls within a window', () => {
    const in10h = new Date(NOW.getTime() + 10 * 3_600_000).toISOString();

    expect(dueWithin(in10h, 24, NOW)).toBe(true);
    expect(dueWithin(in10h, 4, NOW)).toBe(false);
    expect(dueWithin(null, 24, NOW)).toBe(false);
    expect(dueWithin(new Date(NOW.getTime() - 1000).toISOString(), 24, NOW)).toBe(false);
  });
});

describe('vault traffic lights', () => {
  it('maps the verification status to a light', () => {
    expect(trafficLightOf('Valid')).toBe('green');
    expect(trafficLightOf('ExpiringSoon')).toBe('amber');
    expect(trafficLightOf('Expired')).toBe('red');
    expect(trafficLightOf('PendingRenewal')).toBe('grey');
  });

  it('classifies a document from its expiry date', () => {
    expect(classifyVerification(null, NOW)).toBe('Valid');
    expect(classifyVerification('2028-03-01', NOW)).toBe('Expired');
    expect(classifyVerification('2028-04-10', NOW)).toBe('ExpiringSoon');
    expect(classifyVerification('2029-01-01', NOW)).toBe('Valid');
    expect(classifyVerification('2028-03-12', NOW, 1)).toBe('Valid');
  });

  it('counts the days to a date', () => {
    expect(daysUntil('2028-03-10', NOW)).toBe(0);
    expect(daysUntil('2028-03-15', NOW)).toBe(5);
    expect(daysUntil('2028-03-01', NOW)).toBe(-9);
  });

  it('keeps the Betreibungsauszug for three months from its issue date', () => {
    expect(betreibungsauszugValidUntil('2028-01-10')).toBe('2028-04-10');
    expect(betreibungsauszugValidUntil('2027-11-30')).toBe('2028-02-29');
    expect(betreibungsauszugValidUntil('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('tracks the rolling window of the Betreibungsauszug', () => {
    expect(betreibungsauszugTracker(null, NOW)).toBeNull();
    expect(betreibungsauszugTracker('2028-03-01', NOW)).toMatchObject({ validUntil: '2028-06-01', light: 'green' });
    expect(betreibungsauszugTracker('2027-12-20', NOW)).toMatchObject({ validUntil: '2028-03-20', daysLeft: 10, light: 'amber' });
    expect(betreibungsauszugTracker('2027-12-01', NOW)).toMatchObject({ validUntil: '2028-03-01', light: 'red' });
  });

  it('turns a Valid Betreibungsauszug red once it is older than three months', () => {
    const old = vaultDoc({
      doc_type: 'CH_EstrattoEsecuzioniFallimenti_Betreibungsauszug',
      jurisdiction: 'CH',
      issue_date: '2027-11-01',
      expiry_date: null,
    });
    const fresh = { ...old, issue_date: '2028-03-01' };
    const nearing = { ...old, issue_date: '2027-12-20' };

    expect(documentLight(old, NOW)).toBe('red');
    expect(documentLight(fresh, NOW)).toBe('green');
    expect(documentLight(nearing, NOW)).toBe('amber');
  });

  it('uses the server status for the other documents', () => {
    expect(documentLight(vaultDoc({ verification_status: 'ExpiringSoon' }), NOW)).toBe('amber');
    expect(documentLight(vaultDoc({ verification_status: 'Expired' }), NOW)).toBe('red');
  });

  it('summarises the lights of a list', () => {
    const summary = summarizeLights(
      [
        vaultDoc({ id: '1' }),
        vaultDoc({ id: '2', verification_status: 'Expired' }),
        vaultDoc({ id: '3', verification_status: 'PendingRenewal' }),
        vaultDoc({ id: '4' }),
      ],
      NOW,
    );

    expect(summary).toEqual({ green: 2, amber: 0, red: 1, grey: 1 });
  });

  it('finds the next SOA milestone: the triennial check before the expiry', () => {
    const doc = vaultDoc({
      doc_type: 'IT_SOA_Attestation',
      intermediate_triennial_check_date: '2028-04-01',
      expiry_date: '2030-01-01',
    });

    expect(soaNextMilestone(doc, NOW)).toMatchObject({ kind: 'intermediate_check', date: '2028-04-01', daysLeft: 22 });
    expect(soaNextMilestone({ ...doc, intermediate_triennial_check_date: '2027-01-01' }, NOW)).toMatchObject({ kind: 'expiry' });
    expect(soaNextMilestone({ ...doc, intermediate_triennial_check_date: null, expiry_date: null }, NOW)).toBeNull();
  });
});

describe('envelope validation', () => {
  it('is complete when every required item holds a file', () => {
    expect(validateEnvelope([item(), item({ key: 'b' })]).complete).toBe(true);
    expect(validateEnvelope([]).complete).toBe(true);
  });

  it('lists the missing required documents and ignores the optional ones', () => {
    const result = validateEnvelope([
      item({ key: 'a', file_name: null, status: 'missing' }),
      item({ key: 'b', required: false, file_name: null, status: 'missing' }),
    ]);

    expect(result.complete).toBe(false);
    expect(result.missingRequired).toEqual(['a']);
  });

  it('refuses an invalid digital signature', () => {
    const result = validateEnvelope([
      item({
        key: 'sig',
        signature_required: true,
        status: 'signature_invalid',
        signature: { format: 'p7m', status: 'invalid', signer: null, signed_at: null, verified_at: null, message_code: 'x' },
      }),
    ]);

    expect(result.invalidSignatures).toEqual(['sig']);
    expect(result.complete).toBe(false);
  });

  it('requires a verified signature where the tender asks for one', () => {
    const unsigned = item({
      key: 'sig',
      signature_required: true,
      signature: { format: 'pades', status: 'unsigned', signer: null, signed_at: null, verified_at: null, message_code: null },
    });
    const signed = item({
      key: 'sig',
      signature_required: true,
      signature: { format: 'p7m', status: 'valid', signer: 'Rossi', signed_at: null, verified_at: null, message_code: null },
    });

    expect(validateEnvelope([unsigned]).unsignedRequired).toEqual(['sig']);
    expect(validateEnvelope([signed]).complete).toBe(true);
  });

  it('measures the progress on the required items', () => {
    expect(envelopeProgress([item(), item({ status: 'missing', file_name: null }), item({ required: false })])).toEqual({
      done: 1,
      total: 2,
      percent: 50,
    });
    expect(envelopeProgress([])).toEqual({ done: 0, total: 0, percent: 100 });
  });

  it('recognises the signature format of a file name', () => {
    expect(signatureFormatOfFile('offerta.PDF.p7m')).toBe('p7m');
    expect(signatureFormatOfFile('offerta.pdf')).toBe('pades');
    expect(signatureFormatOfFile('offerta.docx')).toBe('none');
  });
});

describe('submission gate', () => {
  const envelope = (complete: boolean) => ({ complete, items: [] });
  const readiness = (overrides: Partial<TndReadiness> = {}): TndReadiness => ({
    ready: true,
    envelopes: { administrative: envelope(true), technical: envelope(true), economic: envelope(true) },
    issues: [],
    ...overrides,
  });

  it('is closed without a readiness report', () => {
    expect(submissionGate(null, false).canSubmit).toBe(false);
  });

  it('opens when the envelopes are complete and nothing blocks', () => {
    expect(submissionGate(readiness(), false).canSubmit).toBe(true);
  });

  it('stays closed on an incomplete envelope, a blocking finding or a blocked offer', () => {
    expect(
      submissionGate(readiness({ envelopes: { administrative: envelope(false), technical: envelope(true), economic: envelope(true) } }), false)
        .canSubmit,
    ).toBe(false);
    const blocked = submissionGate(readiness({ issues: [{ code: 'durc_missing', severity: 'blocking' }] }), false);
    expect(blocked.canSubmit).toBe(false);
    expect(blocked.blocking).toHaveLength(1);
    expect(submissionGate(readiness(), true).canSubmit).toBe(false);
    expect(submissionGate(readiness({ ready: false }), false).canSubmit).toBe(false);
  });

  it('does not close on warnings', () => {
    expect(submissionGate(readiness({ issues: [{ code: 'document_expiring', severity: 'warning' }] }), false).canSubmit).toBe(true);
  });
});

describe('labels and keys', () => {
  it('builds the translation keys', () => {
    expect(errorKey('not_awarded')).toBe('tenderManagement.error.not_awarded');
    expect(errorKey(null)).toBe('tenderManagement.error.generic');
    expect(issueKey({ code: 'cig_missing' })).toBe('tenderManagement.compliance.cig_missing');
  });

  it('badges the jurisdictions', () => {
    expect(jurisdictionBadge('CH_SIMAP_LAPub')).toBe('CH simap.ch');
    expect(jurisdictionBadge('IT_Dlgs36_2023_ANAC')).toBe('IT ANAC-MePA');
  });

  it('resolves the labels of the matrix criteria', () => {
    expect(criterionLabel('turnover')).toEqual({ key: 'tenderManagement.criterion.turnover', params: {} });
    expect(criterionLabel('soa_OG1')).toEqual({ key: 'tenderManagement.criterion.soa', params: { category: 'OG1' } });
    expect(criterionLabel('certification_IT_ISO9001').key).toBe('tenderManagement.enum.vaultDocType.IT_ISO9001');
    expect(criterionLabel('compliance_durc_missing').key).toBe('tenderManagement.compliance.durc_missing');
  });

  it('reads the recommendation of the matrix', () => {
    expect(recommendationKey({ can_bid_solo: true, recommended_mode: 'SingleCompany' })).toBe('tenderManagement.compliance.solo_eligible');
    expect(recommendationKey({ can_bid_solo: false, recommended_mode: 'Avvalimento' })).toBe('tenderManagement.compliance.avvalimento_recommended');
    expect(recommendationKey({ can_bid_solo: false, recommended_mode: 'RTI_Consorzio_Mandataria_Mandante' })).toBe(
      'tenderManagement.compliance.rti_recommended',
    );
  });
});

describe('pipeline grouping', () => {
  it('groups the dossiers by status and keeps every column', () => {
    const groups = groupByStatus([
      { id: '1', status: 'Scouting' } as TndParticipation,
      { id: '2', status: 'Submitted' } as TndParticipation,
      { id: '3', status: 'Scouting' } as TndParticipation,
    ]);

    expect(groups.Scouting.map((entry) => entry.id)).toEqual(['1', '3']);
    expect(groups.Submitted).toHaveLength(1);
    expect(groups.AwardedWon).toEqual([]);
    expect(Object.keys(groups)).toHaveLength(7);
  });
});

describe('failures', () => {
  it('reads the code and the params of a problem', async () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { code: 'soa_missing', params: { category: 'OG1' }, detail: 'x' },
    });
    const outcome = await failureOf(error);

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('tenderManagement.error.soa_missing');
    expect(outcome.errorParams).toEqual({ category: 'OG1' });
  });

  it('binds the field errors of a validation failure', async () => {
    const outcome = await failureOf(
      new HttpErrorResponse({ status: 422, error: { errors: { title: ['Required'] } } }),
    );

    expect(outcome.errors).toEqual({ title: ['Required'] });
    expect(outcome.detail).toBe('Required');
    expect(outcome.errorKey).toBe('tenderManagement.error.generic');
  });

  it('falls back to the generic key for an unknown failure', async () => {
    expect((await failureOf(new Error('boom'))).errorKey).toBe('tenderManagement.error.generic');
  });
});
