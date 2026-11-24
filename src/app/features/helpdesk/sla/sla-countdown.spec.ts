import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { I18nService } from '@core';
import { SlaCountdownComponent } from './sla-countdown.component';
import {
  countdownParts,
  durationKey,
  elapsedPercent,
  riskColor,
  riskLevel,
  SlaClock,
} from './sla-countdown';

const NOW = Date.parse('2027-03-01T10:00:00Z');

describe('countdownParts', () => {
  it('splits the time left in days, hours and minutes', () => {
    expect(countdownParts('2027-03-03T12:30:00Z', NOW)).toEqual({
      overdue: false,
      days: 2,
      hours: 2,
      minutes: 30,
    });
  });

  it('measures how late a due date passed', () => {
    expect(countdownParts('2027-03-01T08:45:00Z', NOW)).toEqual({
      overdue: true,
      days: 0,
      hours: 1,
      minutes: 15,
    });
  });

  it('has no countdown without a usable due date', () => {
    expect(countdownParts(null, NOW)).toBeNull();
    expect(countdownParts('not a date', NOW)).toBeNull();
  });
});

describe('durationKey', () => {
  it('picks the most compact translation for the parts', () => {
    expect(durationKey({ overdue: false, days: 1, hours: 0, minutes: 0 })).toBe(
      'HELPDESK_SLA.TIME_DAYS',
    );
    expect(durationKey({ overdue: false, days: 0, hours: 3, minutes: 4 })).toBe(
      'HELPDESK_SLA.TIME_HOURS',
    );
    expect(durationKey({ overdue: false, days: 0, hours: 0, minutes: 9 })).toBe(
      'HELPDESK_SLA.TIME_MINUTES',
    );
    expect(durationKey({ overdue: true, days: 0, hours: 0, minutes: 0 })).toBe(
      'HELPDESK_SLA.TIME_LESS_THAN_MINUTE',
    );
  });
});

describe('risk helpers', () => {
  it('maps the share of time spent to a level and a tag colour', () => {
    expect(riskLevel(40)).toBe('ok');
    expect(riskLevel(75)).toBe('warning');
    expect(riskLevel(100)).toBe('critical');
    expect(riskColor('ok')).toBe('success');
    expect(riskColor('warning')).toBe('warning');
    expect(riskColor('critical')).toBe('error');
  });

  it('computes the share spent between the start and the due date', () => {
    expect(elapsedPercent('2027-03-01T08:00:00Z', '2027-03-01T12:00:00Z', NOW)).toBe(50);
    expect(elapsedPercent(null, '2027-03-01T12:00:00Z', NOW)).toBeNull();
    expect(elapsedPercent('2027-03-01T12:00:00Z', '2027-03-01T08:00:00Z', NOW)).toBeNull();
  });
});

describe('SlaCountdownComponent', () => {
  function create(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: SlaClock, useValue: { now: () => NOW } },
      ],
    });
    const fixture = TestBed.createComponent(SlaCountdownComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the time left without a breach badge', () => {
    const element = create({ dueAt: '2027-03-01T12:00:00Z' });

    expect(element.textContent).toContain('HELPDESK_SLA.LEFT');
    expect(element.querySelector('[data-testid="sla-breach-badge"]')).toBeNull();
  });

  it('flags a due date in the past with the breach badge', () => {
    const element = create({ dueAt: '2027-03-01T09:00:00Z' });

    expect(element.textContent).toContain('HELPDESK_SLA.OVERDUE');
    expect(element.querySelector('[data-testid="sla-breach-badge"]')).not.toBeNull();
  });

  it('shows the pause of the clock instead of a figure', () => {
    const element = create({ dueAt: '2027-03-01T09:00:00Z', paused: true });

    expect(element.querySelector('[data-testid="sla-paused"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="sla-breach-badge"]')).toBeNull();
  });
});
