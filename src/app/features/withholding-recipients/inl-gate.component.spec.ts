import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService, WrInlNotification, WrRegime } from '@core';
import { InlGateComponent } from './inl-gate.component';
import { inlNotice, translateSpy } from './withholding-recipients.testing';

const covering = (overrides: Partial<WrInlNotification> = {}) =>
  inlNotice('n-1', {
    status: 'sent',
    work_start_date: '2026-05-01',
    work_end_date: '2026-05-31',
    sent_before_start: true,
    ...overrides,
  });

describe('InlGateComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: translateSpy() }],
    });
  });

  async function render(regime: WrRegime, notifications: WrInlNotification[], date = '2026-05-10') {
    const fixture = TestBed.createComponent(InlGateComponent);
    fixture.componentRef.setInput('regime', regime);
    fixture.componentRef.setInput('notifications', notifications);
    fixture.componentRef.setInput('date', date);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const text = (root: HTMLElement) => root.textContent ?? '';

  it('confirms the covering communication of an occasional worker and does not block', async () => {
    const fixture = await render('occasional_worker', [covering()]);

    expect(fixture.componentInstance.blocking()).toBe(false);
    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.inl.gateCovered');
  });

  it('blocks the posting and explains why when no communication exists', async () => {
    const fixture = await render('occasional_worker', []);

    expect(fixture.componentInstance.blocking()).toBe(true);
    expect(text(fixture.nativeElement)).toContain('withholdingRecipients.inl.gateBlocked');
    expect(text(fixture.nativeElement)).toContain(
      'withholdingRecipients.error.inl_notification_missing',
    );
  });

  it('blocks a communication sent after the start of the work', async () => {
    const fixture = await render('occasional_worker', [covering({ sent_before_start: false })]);

    expect(fixture.componentInstance.blocking()).toBe(true);
    expect(text(fixture.nativeElement)).toContain(
      'withholdingRecipients.error.inl_notification_late',
    );
  });

  it('blocks a communication that ended before the date of the service', async () => {
    const fixture = await render('occasional_worker', [covering()], '2026-07-01');

    expect(fixture.componentInstance.blocking()).toBe(true);
    expect(text(fixture.nativeElement)).toContain(
      'withholdingRecipients.error.inl_notification_expired',
    );
  });

  it('shows nothing for a regime that needs no communication', async () => {
    const fixture = await render('agent_25bis', []);

    expect(fixture.componentInstance.blocking()).toBe(false);
    expect(fixture.nativeElement.querySelector('nz-alert')).toBeNull();
  });
});
