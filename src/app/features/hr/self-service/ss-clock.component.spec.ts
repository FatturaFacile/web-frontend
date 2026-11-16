import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nService } from '@core/i18n/i18n.service';
import { environment } from '@env';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SsClockComponent } from './ss-clock.component';

const me = `${environment.apiBaseUrl}/hr/me`;

const makeEvent = (id: string, type: 'In' | 'Out' | 'BreakStart' | 'BreakEnd') => ({
  id,
  employee_id: 'emp-1',
  occurred_at: new Date().toISOString(),
  event_type: type,
  source: 'web' as const,
  note: null,
  created_by: null,
  deleted_at: null,
  deleted_by: null,
  deletion_reason: null,
  amended_from_id: null,
});

const page = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 1, per_page: 50, total: data.length } });

@Component({ template: '<app-ss-clock />', imports: [SsClockComponent] })
class HostComponent {}

describe('SsClockComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NzMessageService, useValue: { error: () => undefined } },
        { provide: I18nService, useValue: { translate: (key: string) => key, currentLanguage: () => 'it' } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads today events on init and derives Off state when no events', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === `${me}/time/events`);
    expect(req.request.params.get('per_page')).toBe('50');
    req.flush(page([]));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-state="Off"]')).toBeTruthy();
    expect(el.querySelector('button')).toBeTruthy();
  });

  it('derives Working state from last In event and shows break/out buttons', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${me}/time/events`).flush(page([makeEvent('e1', 'In')]));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-state="Working"]')).toBeTruthy();
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('derives OnBreak state from last BreakStart event', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url === `${me}/time/events`)
      .flush(page([makeEvent('e1', 'In'), makeEvent('e2', 'BreakStart')]));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-state="OnBreak"]')).toBeTruthy();
  });

  it('calls clockNow and appends result to events on punch', () => {
    Object.defineProperty(global.navigator, 'geolocation', { value: undefined, configurable: true });

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${me}/time/events`).flush(page([]));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const clockReq = httpMock.expectOne(`${me}/clock`);
    expect(clockReq.request.method).toBe('POST');
    expect(clockReq.request.body.event_type).toBe('In');
    clockReq.flush({ success: true, message: '', data: makeEvent('e-new', 'In') });
    fixture.detectChanges();

    expect(el.querySelector('[data-state="Working"]')).toBeTruthy();
  });
});
