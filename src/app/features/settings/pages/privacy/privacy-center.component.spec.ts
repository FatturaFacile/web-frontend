import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PrivacyApiService } from '@core';
import { PrivacyCenterComponent } from './privacy-center.component';

describe('PrivacyCenterComponent forms', () => {
  const empty = () => of({ data: [] });
  const api = {
    getProcessingActivities: empty,
    getSubprocessors: empty,
    getDataSubjectRequests: empty,
    getBreaches: empty,
    getSensitiveAccessLogs: empty,
    createDataSubjectRequest: vi.fn(() => of({ data: {} })),
    createProcessingActivity: vi.fn(() => of({ data: {} })),
    createSubprocessor: vi.fn(() => of({ data: {} })),
    createBreach: vi.fn(() => of({ data: {} })),
  };

  function create(): PrivacyCenterComponent {
    TestBed.configureTestingModule({
      imports: [PrivacyCenterComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PrivacyApiService, useValue: api }],
    });
    const fixture = TestBed.createComponent(PrivacyCenterComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('does not call the API when the required fields are empty', () => {
    const component = create();

    component['submitDsr']();
    component['submitRopa']();
    component['submitSubprocessor']();
    component['submitBreach']();
    component['subForm'].patchValue({ name: 'Provider', country_code: 'C' });
    component['submitSubprocessor']();

    expect(api.createDataSubjectRequest).not.toHaveBeenCalled();
    expect(api.createProcessingActivity).not.toHaveBeenCalled();
    expect(api.createSubprocessor).not.toHaveBeenCalled();
    expect(api.createBreach).not.toHaveBeenCalled();
  });

  it('requires a UUID for the data subject and does not require the number of records', () => {
    const component = create();

    component['dsrForm'].patchValue({ subject_id: 'not-a-uuid' });
    component['submitDsr']();
    expect(api.createDataSubjectRequest).not.toHaveBeenCalled();

    component['dsrForm'].patchValue({ subject_id: '3f2b8c1e-9d4a-4b6f-8a21-5c7e1d0f9a34' });
    component['submitDsr']();
    expect(api.createDataSubjectRequest).toHaveBeenCalledTimes(1);

    component['breachForm'].patchValue({ title: 'Lost laptop', affected_records_count: null as unknown as number });
    component['submitBreach']();
    expect(api.createBreach).toHaveBeenCalledTimes(1);
  });
});
