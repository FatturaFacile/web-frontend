import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NzMessageService, useValue: { error: () => {} } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // The clock loads today's events and the clock settings together; the dictionary request of the real I18nService is
  // answered too, so that no request stays open.
  function loadToday(events: unknown, inspect?: (req: TestRequest) => void): void {
    const req = httpMock.expectOne((r) => r.url === `${me}/time/events`);
    inspect?.(req);
    req.flush(events);
    httpMock
      .expectOne(`${me}/clock-settings`)
      .flush({ success: true, message: '', data: { geolocation_enabled: false, privacy_notice_acknowledged: false } });
    httpMock.match((r) => r.url.includes('/translations/')).forEach((t) => t.flush({ locale: 'en', translations: {} }));
  }

  it('loads today events on init and derives Off state when no events', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    loadToday(page([]), (req) => expect(req.request.params.get('per_page')).toBe('50'));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-state="Off"]')).toBeTruthy();
    expect(el.querySelector('button')).toBeTruthy();
  });

  it('derives Working state from last In event and shows break/out buttons', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    loadToday(page([makeEvent('e1', 'In')]));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-state="Working"]')).toBeTruthy();
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBe(2);
  });

  it('derives OnBreak state from last BreakStart event', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    loadToday(page([makeEvent('e1', 'In'), makeEvent('e2', 'BreakStart')]));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-state="OnBreak"]')).toBeTruthy();
  });

  it('calls clockNow and appends result to events on punch', () => {
    Object.defineProperty(global.navigator, 'geolocation', { value: undefined, configurable: true });

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    loadToday(page([]));
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
