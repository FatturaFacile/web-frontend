import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core';
import { RmaNotifier } from '../../state/action-result';
import { TokenReveal } from '../../state/rma-detail.store';
import { i18nStub } from '../../testing/rma-fixtures';
import { TokenRevealDialogComponent } from './token-reveal-dialog.component';

@Component({
  imports: [TokenRevealDialogComponent],
  template: `<app-token-reveal-dialog [reveal]="reveal()" (closed)="reveal.set(null)" />`,
})
class HostComponent {
  readonly reveal = signal<TokenReveal | null>(null);
}

describe('TokenRevealDialogComponent', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => (el.innerHTML = ''));
  });

  it('shows the estimate link once with a copy button and drops it when closed', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: I18nService, useValue: i18nStub() },
        { provide: RmaNotifier, useValue: { success: vi.fn(), conflict: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.reveal.set({
      kind: 'estimate',
      url: 'https://app.test/rma-estimate/raw',
      token: null,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = document.body.querySelector('#reveal-url') as HTMLInputElement;
    expect(input.value).toBe('https://app.test/rma-estimate/raw');
    expect(document.body.textContent).toContain('RMA.REVEAL.ONCE_WARNING');
    expect(document.body.textContent).toContain('RMA.REVEAL.COPY');

    const done = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('RMA.REVEAL.DONE'),
    ) as HTMLButtonElement;
    done.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.reveal()).toBeNull();
  });
});
