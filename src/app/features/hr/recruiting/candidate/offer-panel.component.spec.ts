import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { CandidateApplication, HireResult, I18nService } from '@core';
import { application, i18nStub, offer, opening } from '../testing/recruiting-fixtures';
import { OfferPanelComponent } from './offer-panel.component';

const API = 'https://api.fatturafacile.eu/api/v1';
const HIRE_URL = `${API}/hr/recruiting/applications/a1/hire`;

describe('OfferPanelComponent (offer & hire)', () => {
  let fixture: ComponentFixture<OfferPanelComponent>;
  let component: OfferPanelComponent;
  let http: HttpTestingController;
  let message: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const originalApiBaseUrl = environment.apiBaseUrl;

  function render(app: CandidateApplication): void {
    fixture = TestBed.createComponent(OfferPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('application', app);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    environment.apiBaseUrl = API;
    message = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [OfferPanelComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nStub() },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('shows the hire button only when the offer is signed and the stage is not terminal', () => {
    render(application());
    expect(component.canHire()).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.hire-button')?.textContent,
    ).toContain('hr.recruiting.hire.button');

    render(application({ offer: offer({ status: 'sent', signature_status: 'pending' }) }));
    expect(component.canHire()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.hire-button')).toBeNull();

    render(application({ stage: 'hired' }));
    expect(component.canHire()).toBe(false);
  });

  it('hires once even on double click and reports the employee number', () => {
    render(application());
    const hired = vi.fn();
    component.hired.subscribe(hired);

    component.openHireConfirm();
    expect(component.hireConfirmOpen()).toBe(true);
    component.confirmHire();
    component.confirmHire();

    const reqs = http.match(HIRE_URL);
    expect(reqs.length).toBe(1);
    expect(reqs[0].request.method).toBe('POST');

    const result: HireResult = {
      application: application({ stage: 'hired', hired_employee_id: 'e1' }),
      employee: {
        id: 'e1',
        employee_number: 'EMP-0042',
        full_name: 'Anna a1',
        hire_date: '2027-01-01',
      },
      job_opening: opening({ hires_count: 1, status: 'closed_filled' }),
      onboarding: { status: 'not_available', checklist_id: null },
    };
    reqs[0].flush({ data: result }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(hired).toHaveBeenCalledWith(result);
    expect(component.hireResult()).toEqual(result);
    expect(message.success).toHaveBeenCalledWith(
      'hr.recruiting.hire.success {"number":"EMP-0042"}',
    );
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('hr.recruiting.hire.onboardingNotAvailable');
  });

  it('prompts to record the signature on offer_not_signed and asks for a reload', () => {
    render(application());
    const reload = vi.fn();
    component.reloadRequested.subscribe(reload);
    component.confirmHire();
    http
      .expectOne(HIRE_URL)
      .flush(
        { message: 'Offer not signed', error_code: 'offer_not_signed' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.needsSignature()).toBe(true);
    expect(message.error).toHaveBeenCalledWith('hr.recruiting.errors.codes.offer_not_signed');
    expect(reload).toHaveBeenCalled();
    expect(component.hiring()).toBe(false);
  });

  it('records a signature and a decline through the offer endpoints', () => {
    render(application({ offer: offer({ status: 'sent', signature_status: 'pending' }) }));
    expect(component.canSign()).toBe(true);
    component.markSigned();
    http
      .expectOne(`${API}/hr/recruiting/offers/of1/mark-signed`)
      .flush({ data: offer({ status: 'signed', signature_status: 'signed' }) });
    expect(component.offer()?.status).toBe('signed');
    expect(component.canHire()).toBe(true);
  });

  it('creates and sends an offer from the form', () => {
    render(application({ offer: null, stage: 'manager_interview' }));
    expect(component.canCreate()).toBe(true);
    component.model.update((m) => ({ ...m, proposed_salary: 95000, start_date: '2027-02-01' }));
    component.createOffer();
    const req = http.expectOne(`${API}/hr/recruiting/applications/a1/offer`);
    expect(req.request.body).toMatchObject({
      proposed_salary: 95000,
      start_date: '2027-02-01',
      currency: 'CHF',
      send: true,
    });
    req.flush(
      { data: offer({ status: 'sent', signature_status: 'pending' }) },
      { status: 201, statusText: 'Created' },
    );
    expect(component.offer()?.status).toBe('sent');
  });

  it('does not submit an offer without salary and start date', () => {
    render(application({ offer: null, stage: 'manager_interview' }));
    component.createOffer();
    http.expectNone(`${API}/hr/recruiting/applications/a1/offer`);
    expect(component.submitted()).toBe(true);
  });

  it('disables all offer actions for anonymized candidates', () => {
    render(
      application({
        is_anonymized: true,
        offer: offer({ status: 'sent', signature_status: 'pending' }),
      }),
    );
    expect(component.canSign()).toBe(false);
    expect(component.canHire()).toBe(false);
    expect(component.canCreate()).toBe(false);
  });
});
