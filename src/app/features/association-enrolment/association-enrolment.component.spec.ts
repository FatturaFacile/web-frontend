import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { I18nService } from '@core';
import { environment } from '@env';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssociationEnrolmentComponent } from './association-enrolment.component';

const FORM = {
  association: 'ASD Lugano',
  title: 'Iscrizione 2027',
  description: null,
  is_open: true,
  fields: [{ code: 'shirt', label: 'Maglia', type: 'select', required: true, options: ['S', 'M'] }],
  documents: [{ id: 'd-1', title: 'Certificato', mode: 'required', has_template: false }],
};

describe('AssociationEnrolmentComponent', () => {
  let fixture: ComponentFixture<AssociationEnrolmentComponent>;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/association-public/enrolment`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AssociationEnrolmentComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ token: 'tok' })) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AssociationEnrolmentComponent);
  });

  afterEach(() => http.verify());

  const instance = () =>
    fixture.componentInstance as unknown as {
      person: { patchValue: (value: Record<string, unknown>) => void };
      extra: { controls: Record<string, { setValue: (value: unknown) => void }> };
      files: { set: (value: Record<string, File>) => void };
      submit: () => void;
      isMinor: () => boolean;
    };

  const load = () => {
    fixture.detectChanges();
    http.expectOne(`${base}/tok`).flush({ data: FORM });
    fixture.detectChanges();
  };

  it('shows the form with the custom field and the document to upload', () => {
    load();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Iscrizione 2027');
    expect(text).toContain('Maglia');
    expect(text).toContain('Certificato');
  });

  it('reports a form that does not exist', () => {
    fixture.detectChanges();
    http.expectOne(`${base}/tok`).flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ASSOC_ENROL.NOT_FOUND');
  });

  it('does not send an incomplete application', () => {
    load();
    instance().submit();
    http.expectNone(`${base}/tok`);
  });

  it('sends the application as multipart data with the extra fields and the documents', () => {
    load();
    instance().person.patchValue({
      first_name: 'Anna',
      last_name: 'Rossi',
      email: 'anna@example.ch',
      birth_date: '1990-04-02',
      tax_code: 'RSSNNA90D42L424X',
      privacy_accepted: true,
    });
    instance().extra.controls['shirt'].setValue('M');
    instance().files.set({ 'd-1': new File(['x'], 'certificate.pdf') });
    expect(instance().isMinor()).toBe(false);

    instance().submit();
    const req = http.expectOne(`${base}/tok`);
    const body = req.request.body as FormData;
    expect(req.request.method).toBe('POST');
    expect(body.get('first_name')).toBe('Anna');
    expect(body.get('privacy_accepted')).toBe('1');
    expect(body.get('extra[shirt]')).toBe('M');
    expect((body.get('documents[d-1]') as File).name).toBe('certificate.pdf');
    expect(body.has('website')).toBe(false);
    req.flush({ data: { tracking_code: 'ABC123', received: true } });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ABC123');
  });

  it('requires the guardian of a minor', () => {
    load();
    instance().person.patchValue({ birth_date: `${new Date().getFullYear() - 10}-01-01` });
    fixture.detectChanges();
    expect(instance().isMinor()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ASSOC_ENROL.GUARDIAN');
  });

  it('follows the status of an application by tracking code', () => {
    load();
    const component = fixture.componentInstance as unknown as { lookupCode: { setValue: (v: string) => void }; track: () => void };
    component.lookupCode.setValue('ABC123');
    component.track();
    http.expectOne(`${base}/tok/applications/ABC123`).flush({ data: { status: 'approved' } });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ASSOC_ENROL.STATUS_approved');
  });
});
