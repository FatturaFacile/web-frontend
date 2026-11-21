import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '@env';
import { DsarWizardComponent } from './dsar-wizard.component';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(DsarWizardComponent);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    http: TestBed.inject(HttpTestingController),
  };
}

const dsarResponse = {
  data: {
    id: 'd-1',
    request_number: 'DSAR-0001',
    request_type: 'erasure',
    identity_verified_at: null,
    package_status: null,
  },
};

describe('DsarWizardComponent request form', () => {
  it('is invalid until the name and a valid e-mail address are given', () => {
    const { component } = setup();
    expect(component.form.valid).toBe(false);

    component.form.patchValue({ subject_full_name: 'A', subject_email: 'not-an-email' });
    expect(component.form.controls.subject_full_name.hasError('minlength')).toBe(true);
    expect(component.form.controls.subject_email.hasError('email')).toBe(true);

    component.form.patchValue({
      subject_full_name: 'Mario Rossi',
      subject_email: 'mario@example.test',
    });
    expect(component.form.valid).toBe(true);
  });

  it('does not call the API while the form is invalid', () => {
    const { component, http } = setup();
    component.create();
    http.expectNone(`${environment.apiBaseUrl}/privacy/dsar`);
    expect(component.step()).toBe(0);
  });

  it('creates the request and moves to the fulfilment step', () => {
    const { component, http } = setup();
    component.form.patchValue({
      subject_full_name: ' Mario Rossi ',
      subject_email: 'mario@example.test',
      request_type: 'erasure',
    });

    component.create();

    const request = http.expectOne(`${environment.apiBaseUrl}/privacy/dsar`);
    expect(request.request.body).toMatchObject({
      subject_full_name: 'Mario Rossi',
      subject_email: 'mario@example.test',
      request_type: 'erasure',
      audit_notes: null,
    });
    request.flush(dsarResponse);

    expect(component.step()).toBe(1);
    expect(component.dsar()?.request_number).toBe('DSAR-0001');
  });
});

describe('DsarWizardComponent erasure', () => {
  it('requires the legal-hold acknowledgement before the erasure runs', () => {
    const { component, http } = setup();
    component.dsar.set({ id: 'd-1', request_type: 'erasure' } as never);
    expect(component.erasureForm.invalid).toBe(true);

    component.executeErasure();
    http.expectNone(`${environment.apiBaseUrl}/privacy/dsar/d-1/execute-erasure`);

    component.erasureForm.patchValue({ acknowledged: true });
    component.executeErasure();
    const request = http.expectOne(`${environment.apiBaseUrl}/privacy/dsar/d-1/execute-erasure`);
    expect(request.request.params.has('dry_run')).toBe(false);
    request.flush({
      data: {
        dry_run: false,
        status: 'completed',
        fiscal_lock: { is_locked: false, retention_ends_at: null, records: [] },
        to_anonymize: [],
        protected: [],
        refusal_legal_justification: null,
      },
    });
    expect(component.step()).toBe(2);
  });

  it('evaluates the erasure as a dry run and exposes the legal hold', () => {
    const { component, http } = setup();
    component.dsar.set({ id: 'd-1', request_type: 'erasure' } as never);

    component.evaluateErasure();
    const request = http.expectOne(
      (req) => req.url === `${environment.apiBaseUrl}/privacy/dsar/d-1/execute-erasure`,
    );
    expect(request.request.params.get('dry_run')).toBe('true');
    request.flush({
      data: {
        dry_run: true,
        status: 'open',
        fiscal_lock: { is_locked: true, retention_ends_at: '2035-12-31', records: [] },
        to_anonymize: [],
        protected: [],
        refusal_legal_justification: null,
      },
    });

    expect(component.hasLegalHold()).toBe(true);
  });
});
