import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FsmServiceReport, FsmSignReportPayload } from '@core';
import { FsmApiService, I18nService } from '@core';
import { icons } from '../../../icons-provider';
import { SignReportModalComponent } from './sign-report-modal.component';

interface Harness {
  form: { patchValue(value: object): void; get(path: string): { errors: Record<string, unknown> | null } | null };
  checklist: { length: number; at(index: number): { patchValue(value: object): void } };
  signatureSvg: { (): string | null; set(value: string | null): void };
  saving: () => boolean;
  formError: () => string | null;
  gps: () => { latitude: number; longitude: number } | null;
  gpsFailed: () => boolean;
  canSubmit: () => boolean;
  addRow(): void;
  removeRow(index: number): void;
  captureLocation(): void;
  submit(): void;
  photos: () => { id: string }[];
  uploading: () => boolean;
  photoError: () => string | null;
  onPhotosSelected(event: Event): void;
  removePhoto(id: string): void;
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 180"><path d="M1 1 L2 2"/></svg>';

describe('SignReportModalComponent', () => {
  let fixture: ComponentFixture<SignReportModalComponent>;
  let harness: Harness;

  const api = { signReport: vi.fn(), uploadPhoto: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };
  const signed = vi.fn();

  function fillValid(): void {
    harness.form.patchValue({
      work_performed_summary: ' Replaced the pump ',
      labor_hours: 2,
      travel_hours: 0.5,
      travel_km: 12,
      apply_callout_fee: true,
      customer_signer_name: ' Rossi ',
      customer_signer_role: '',
    });
    harness.checklist.at(0).patchValue({ item: ' Leak test ', result: 'fail', notes: 'drips' });
    harness.signatureSvg.set(SVG);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    api.signReport.mockReturnValue(of({ data: { id: 'r1' } as FsmServiceReport }));
    await TestBed.configureTestingModule({
      imports: [SignReportModalComponent],
      providers: [
        provideNzIcons(icons),
        { provide: FsmApiService, useValue: api },
        { provide: I18nService, useValue: { currentLanguage: () => 'de', translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SignReportModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('workOrderId', 'w1');
    fixture.componentInstance.signed.subscribe(signed);
    harness = fixture.componentInstance as unknown as Harness;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cannot be submitted without a signature and does not call the API for an invalid form', () => {
    expect(harness.canSubmit()).toBe(false);
    harness.submit();
    expect(api.signReport).not.toHaveBeenCalled();

    harness.signatureSvg.set(SVG);
    expect(harness.canSubmit()).toBe(true);
    harness.submit();
    expect(api.signReport).not.toHaveBeenCalled();
  });

  it('posts the report payload matching the backend contract and closes', () => {
    fillValid();
    harness.submit();

    expect(api.signReport).toHaveBeenCalledTimes(1);
    const [id, payload] = api.signReport.mock.calls[0] as [string, FsmSignReportPayload];
    expect(id).toBe('w1');
    expect(payload).toMatchObject({
      work_performed_summary: 'Replaced the pump',
      labor_hours: 2,
      travel_hours: 0.5,
      travel_km: 12,
      apply_callout_fee: true,
      customer_signer_name: 'Rossi',
      customer_signer_role: null,
      signature_svg: SVG,
      gps_latitude: null,
      gps_longitude: null,
      locale: 'de-CH',
      checklist: [{ item: 'Leak test', result: 'fail', notes: 'drips' }],
    });
    expect(payload.client_uuid).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(payload.signed_at))).toBe(false);
    expect(message.success).toHaveBeenCalledWith('FSM.REPORT.SIGN_DONE');
    expect(signed).toHaveBeenCalledWith({ id: 'r1' });
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('drops empty checklist rows and manages the rows', () => {
    expect(harness.checklist.length).toBe(1);
    harness.addRow();
    expect(harness.checklist.length).toBe(2);
    harness.removeRow(1);
    expect(harness.checklist.length).toBe(1);

    fillValid();
    harness.addRow();
    harness.submit();
    const payload = (api.signReport.mock.calls[0] as [string, FsmSignReportPayload])[1];
    expect(payload.checklist).toHaveLength(1);
  });

  it('shows 422 errors on the matching field and the rest in an alert', () => {
    api.signReport.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'invalid', errors: { customer_signer_name: ['Name is required'], signature_svg: ['Invalid signature'] } },
          }),
      ),
    );
    fillValid();
    harness.submit();

    expect(harness.form.get('customer_signer_name')?.errors).toEqual({ serverError: 'Name is required' });
    expect(harness.formError()).toBe('Invalid signature');
    expect(harness.saving()).toBe(false);
    expect(signed).not.toHaveBeenCalled();
    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('falls back to a generic message for a non-validation failure', () => {
    api.signReport.mockReturnValue(throwError(() => new Error('boom')));
    fillValid();
    harness.submit();
    expect(harness.formError()).toBe('FSM.REPORT.SIGN_FAILED');
  });

  it('captures the browser location and sends it with the report', () => {
    const getCurrentPosition = vi.fn((success: (p: { coords: { latitude: number; longitude: number } }) => void) =>
      success({ coords: { latitude: 47.37, longitude: 8.54 } }),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    harness.captureLocation();
    expect(harness.gps()).toEqual({ latitude: 47.37, longitude: 8.54 });

    fillValid();
    harness.submit();
    expect(api.signReport).toHaveBeenCalledWith('w1', expect.objectContaining({ gps_latitude: 47.37, gps_longitude: 8.54 }));
  });

  it('flags a location that cannot be read and keeps the report submittable', () => {
    const getCurrentPosition = vi.fn((_success: unknown, failure: () => void) => failure());
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    harness.captureLocation();
    expect(harness.gpsFailed()).toBe(true);
    expect(harness.gps()).toBeNull();

    vi.stubGlobal('navigator', {});
    harness.captureLocation();
    expect(harness.gpsFailed()).toBe(true);
  });

  function pick(files: File[]): void {
    harness.onPhotosSelected({ target: { files, value: 'x' } } as unknown as Event);
  }

  it('uploads the chosen photos one by one and sends their ids with the report', () => {
    api.uploadPhoto
      .mockReturnValueOnce(of({ data: { id: 'p1', path: 'a/1.jpg' } }))
      .mockReturnValueOnce(of({ data: { id: 'p2', path: 'a/2.jpg' } }));
    pick([new File(['a'], '1.jpg', { type: 'image/jpeg' }), new File(['b'], '2.jpg', { type: 'image/jpeg' })]);

    expect(api.uploadPhoto).toHaveBeenCalledTimes(2);
    expect(api.uploadPhoto.mock.calls[0]?.[0]).toBe('w1');
    expect(api.uploadPhoto.mock.calls[0]?.[2]).toMatchObject({ stage: 'after', clientUuid: expect.any(String) });
    expect(harness.photos().map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(harness.uploading()).toBe(false);

    harness.removePhoto('p1');
    fillValid();
    harness.submit();
    const payload = api.signReport.mock.calls[0]?.[1] as FsmSignReportPayload;
    expect(payload.photo_ids).toEqual(['p2']);
  });

  it('keeps the other photos and shows an error when one upload fails', () => {
    api.uploadPhoto
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of({ data: { id: 'p2', path: 'a/2.jpg' } }));
    pick([new File(['a'], '1.jpg'), new File(['b'], '2.jpg')]);

    expect(harness.photos().map((p) => p.id)).toEqual(['p2']);
    expect(harness.photoError()).toBe('FSM.REPORT.PHOTO_FAILED');
  });

  it('omits photo_ids when no photo was added', () => {
    fillValid();
    harness.submit();
    expect((api.signReport.mock.calls[0]?.[1] as FsmSignReportPayload).photo_ids).toBeUndefined();
  });
});
