import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core';
import { IntercompanyReasonDialogComponent } from './intercompany-reason-dialog.component';

describe('IntercompanyReasonDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { translate: (key: string) => key } }],
    });
  });

  function create(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(IntercompanyReasonDialogComponent);
    fixture.componentRef.setInput('titleKey', 'intercompany.run.reopen');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  function internals(fixture: ReturnType<typeof create>) {
    return fixture.componentInstance as unknown as {
      reason: { set: (value: string) => void };
      amount: { set: (value: string) => void };
      valid: () => boolean;
      confirm: () => void;
    };
  }

  it('does not accept a reason shorter than the minimum', () => {
    const fixture = create({ minLength: 10 });
    const dialog = internals(fixture);

    dialog.reason.set('too short');
    expect(dialog.valid()).toBe(false);

    dialog.reason.set('a correction after the audit');
    expect(dialog.valid()).toBe(true);
  });

  it('asks for a decimal amount only when it is an adjustment', () => {
    const fixture = create({ withAmount: true });
    const dialog = internals(fixture);
    dialog.reason.set('rounding');

    dialog.amount.set('abc');
    expect(dialog.valid()).toBe(false);

    dialog.amount.set('-1.5000');
    expect(dialog.valid()).toBe(true);
  });

  it('emits the trimmed reason and amount, then closes and clears itself', () => {
    const fixture = create({ withAmount: true });
    const dialog = internals(fixture);
    const emitted = vi.fn();
    fixture.componentInstance.confirmed.subscribe(emitted);
    fixture.componentRef.setInput('open', true);
    dialog.reason.set('  rounding difference  ');
    dialog.amount.set(' 2.0000 ');

    dialog.confirm();

    expect(emitted).toHaveBeenCalledWith({ reason: 'rounding difference', amount: '2.0000' });
    expect(fixture.componentInstance.open()).toBe(false);
    expect(dialog.valid()).toBe(false);
  });

  it('does not emit an invalid reason', () => {
    const fixture = create();
    const dialog = internals(fixture);
    const emitted = vi.fn();
    fixture.componentInstance.confirmed.subscribe(emitted);

    dialog.confirm();

    expect(emitted).not.toHaveBeenCalled();
  });
});
