import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '@env';
import { AuthStore } from '@core';
import { justificationValidator, PiiRevealComponent } from './pii-reveal.component';
import { SecurityCenterApiService } from './security-center-api.service';
import { PII_UNMASK_PERMISSION } from './security-center.model';

function setup(allowed: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AuthStore,
        useValue: { can: (p: string) => allowed && p === PII_UNMASK_PERMISSION },
      },
    ],
  });
  const fixture = TestBed.createComponent(PiiRevealComponent);
  fixture.componentRef.setInput('entityType', 'Client');
  fixture.componentRef.setInput('entityId', 'c-1');
  fixture.componentRef.setInput('field', 'iban');
  fixture.componentRef.setInput('maskedValue', 'CH93 **** 2957');
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  const http = TestBed.inject(HttpTestingController);
  return { fixture, element, http };
}

function type(element: HTMLElement, value: string): void {
  const area = element.querySelector<HTMLTextAreaElement>('[data-testid="justification"]');
  area!.value = value;
  area!.dispatchEvent(new Event('input'));
}

describe('PiiRevealComponent', () => {
  it('shows the masked value and no button without the unmask permission', () => {
    const { element } = setup(false);
    expect(element.querySelector('[data-testid="pii-value"]')?.textContent).toContain(
      'CH93 **** 2957',
    );
    expect(element.querySelector('[data-testid="reveal-button"]')).toBeNull();
  });

  it('keeps the confirm button disabled until the justification has 10 characters', () => {
    const { fixture, element } = setup(true);
    element.querySelector<HTMLButtonElement>('[data-testid="reveal-button"]')!.click();
    fixture.detectChanges();

    type(element, 'too short');
    fixture.detectChanges();
    expect(
      element.querySelector<HTMLButtonElement>('[data-testid="confirm-reveal"]')!.disabled,
    ).toBe(true);

    type(element, 'Audit request 4711');
    fixture.detectChanges();
    expect(
      element.querySelector<HTMLButtonElement>('[data-testid="confirm-reveal"]')!.disabled,
    ).toBe(false);
  });

  it('posts the justification with the entity reference and shows the clear value', () => {
    const { fixture, element, http } = setup(true);
    element.querySelector<HTMLButtonElement>('[data-testid="reveal-button"]')!.click();
    fixture.detectChanges();
    type(element, '  Audit request 4711  ');
    fixture.detectChanges();

    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne(`${environment.apiBaseUrl}/security/pii/unmask`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      entity_type: 'Client',
      entity_id: 'c-1',
      field: 'iban',
      justification: 'Audit request 4711',
    });
    request.flush({ data: { value: 'CH9300762011623852957' } });
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="pii-value"]')?.textContent).toContain(
      'CH9300762011623852957',
    );
    expect(element.querySelector('[data-testid="hide-button"]')).not.toBeNull();
  });

  it('keeps the value masked and reports an error when the API refuses', () => {
    const { fixture, element, http } = setup(true);
    element.querySelector<HTMLButtonElement>('[data-testid="reveal-button"]')!.click();
    fixture.detectChanges();
    type(element, 'Audit request 4711');
    fixture.detectChanges();
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));

    http
      .expectOne(`${environment.apiBaseUrl}/security/pii/unmask`)
      .flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(element.querySelector('[data-testid="pii-error"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="pii-value"]')?.textContent).toContain(
      'CH93 **** 2957',
    );
  });
});

describe('justificationValidator', () => {
  const control = (value: string) => ({ value }) as never;

  it('counts the trimmed length', () => {
    expect(justificationValidator(control('         x'))).not.toBeNull();
    expect(justificationValidator(control('0123456789'))).toBeNull();
  });
});

describe('SecurityCenterApiService', () => {
  it('reads the posture from GET /security/posture', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(SecurityCenterApiService);
    let readiness = 0;
    api.posture().subscribe((response) => (readiness = response.data.readiness_score));

    const request = TestBed.inject(HttpTestingController).expectOne(
      `${environment.apiBaseUrl}/security/posture`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: { readiness_score: 91 } });
    expect(readiness).toBe(91);
  });
});
