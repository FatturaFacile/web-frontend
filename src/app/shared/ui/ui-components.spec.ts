import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '@core/i18n/i18n.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { AlertComponent } from './alert/alert.component';
import { ButtonComponent } from './button/button.component';
import { DataTableComponent } from './data-table/data-table.component';
import { FormFieldComponent } from './form-field/form-field.component';
import { InputComponent } from './input/input.component';
import { ModalComponent } from './modal/modal.component';
import { SelectComponent } from './select/select.component';
import { ToastHostComponent } from './toast/toast-host.component';
import { ToastService } from './toast/toast.service';

@Component({
  imports: [
    FormFieldComponent,
    InputComponent,
    SelectComponent,
    ButtonComponent,
    AlertComponent,
    ModalComponent,
    DataTableComponent,
  ],
  template: `
    <app-form-field label="Company" hint="As on the invoice" [error]="error()" required>
      <app-input [(value)]="name" />
    </app-form-field>
    <app-form-field label="Country">
      <app-select [(value)]="country" [options]="options" placeholder="Choose" />
    </app-form-field>
    <app-button [loading]="loading()" (click)="clicks.set(clicks() + 1)">Send</app-button>
    <app-alert tone="danger" heading="Rejected">Fix the VAT number</app-alert>
    <app-alert tone="success">Done</app-alert>
    <button type="button" id="opener" (click)="open.set(true)">Open</button>
    <app-modal [(open)]="open" heading="Details">
      <input id="inside" aria-label="inside" />
      <div appModalFooter><button type="button" id="last">Done</button></div>
    </app-modal>
    <app-data-table caption="Invoices" [columns]="columns" [rows]="rows()">
      <p appDataTableEmpty>Nothing here</p>
    </app-data-table>
  `,
})
class HostComponent {
  readonly name = signal('');
  readonly country = signal('');
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly clicks = signal(0);
  readonly open = signal(false);
  readonly options = [
    { value: 'IT', label: 'Italy' },
    { value: 'CH', label: 'Switzerland' },
  ];
  readonly columns = [
    { key: 'n', label: 'Number' },
    { key: 'a', label: 'Amount', align: 'end' as const },
  ];
  readonly rows = signal<{ n: string; a: number }[]>([{ n: '1', a: 10 }]);
}

describe('design system components', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { translate: (key: string) => key } }],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  describe('form field', () => {
    it('links the label to the control', () => {
      const label = root.querySelector('label') as HTMLLabelElement;
      const input = root.querySelector('input.app-control') as HTMLInputElement;
      expect(label.htmlFor).toBe(input.id);
      expect(input.id).not.toBe('');
    });

    it('describes the control with the hint and marks it required', () => {
      const input = root.querySelector('input.app-control') as HTMLInputElement;
      const hint = root.querySelector('.hint') as HTMLElement;
      expect(input.getAttribute('aria-describedby')).toBe(hint.id);
      expect(input.getAttribute('aria-required')).toBe('true');
      expect(input.hasAttribute('aria-invalid')).toBe(false);
    });

    it('announces an error through a polite live region and flags the control invalid', async () => {
      const region = root.querySelector('.error') as HTMLElement;
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(region.textContent?.trim()).toBe('');

      host.error.set('Enter the company name');
      fixture.detectChanges();

      const input = root.querySelector('input.app-control') as HTMLInputElement;
      expect(region.textContent).toContain('Enter the company name');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toContain(region.id);
    });

    it('gives every field its own ids', () => {
      const ids = Array.from(root.querySelectorAll('.app-control')).map((control) => control.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('writes typed text and the selected option back to the models', () => {
      const input = root.querySelector('input.app-control') as HTMLInputElement;
      input.value = 'Rossi S.r.l.';
      input.dispatchEvent(new Event('input'));
      expect(host.name()).toBe('Rossi S.r.l.');

      const select = root.querySelector('select.app-control') as HTMLSelectElement;
      select.value = 'CH';
      select.dispatchEvent(new Event('change'));
      expect(host.country()).toBe('CH');
    });
  });

  describe('button', () => {
    it('is busy and inert while loading', () => {
      host.loading.set(true);
      fixture.detectChanges();
      const button = root.querySelector('app-button button') as HTMLButtonElement;
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.querySelector('.spinner')).not.toBeNull();
    });

    it('is a plain button unless told otherwise, so it never submits a form by accident', () => {
      expect((root.querySelector('app-button button') as HTMLButtonElement).type).toBe('button');
    });

    it('raises the click of the host element', () => {
      (root.querySelector('app-button button') as HTMLButtonElement).click();
      expect(host.clicks()).toBe(1);
    });
  });

  describe('alert', () => {
    it('is read at once for danger and politely for the other tones', () => {
      const [danger, success] = Array.from(root.querySelectorAll('app-alert'));
      expect(danger.getAttribute('role')).toBe('alert');
      expect(success.getAttribute('role')).toBe('status');
    });
  });

  describe('modal', () => {
    function open(): HTMLElement {
      const opener = root.querySelector('#opener') as HTMLButtonElement;
      opener.focus();
      opener.click();
      fixture.detectChanges();
      return root.querySelector('[role="dialog"]') as HTMLElement;
    }

    it('is closed until opened', () => {
      expect(root.querySelector('[role="dialog"]')).toBeNull();
    });

    it('is a named modal dialog', () => {
      const dialog = open();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      const title = root.querySelector(`#${dialog.getAttribute('aria-labelledby')}`) as HTMLElement;
      expect(title.textContent).toBe('Details');
    });

    it('closes with Escape and with the close button', () => {
      open();
      (root.querySelector('[role="dialog"]') as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      fixture.detectChanges();
      expect(host.open()).toBe(false);

      open();
      (root.querySelector('.close') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(host.open()).toBe(false);
      expect(root.querySelector('[role="dialog"]')).toBeNull();
    });

    it('closes when the backdrop is clicked but not when the dialog is', () => {
      const dialog = open();
      dialog.click();
      expect(host.open()).toBe(true);
      (root.querySelector('.backdrop') as HTMLElement).click();
      expect(host.open()).toBe(false);
    });

    it('moves the focus into the dialog and returns it to the opener on close', async () => {
      // jsdom has no layout: the CDK focus trap only treats an element as tabbable when it has client rects.
      vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
        {},
      ] as unknown as DOMRectList);
      const dialog = open();
      await fixture.whenStable();
      expect(dialog.contains(document.activeElement)).toBe(true);

      host.open.set(false);
      fixture.detectChanges();
      expect(document.activeElement).toBe(root.querySelector('#opener'));
      vi.restoreAllMocks();
    });
  });

  describe('data table', () => {
    it('names the table, scopes the headers and aligns numbers to the end', () => {
      const table = root.querySelector('table') as HTMLTableElement;
      expect(table.caption?.textContent?.trim()).toBe('Invoices');
      const headers = Array.from(table.querySelectorAll('th'));
      expect(headers.every((th) => th.getAttribute('scope') === 'col')).toBe(true);
      expect(table.querySelectorAll('td')[1].classList.contains('end')).toBe(true);
    });

    it('shows the empty slot across all columns when there are no rows', () => {
      host.rows.set([]);
      fixture.detectChanges();
      const cell = root.querySelector('td.empty') as HTMLTableCellElement;
      expect(cell.colSpan).toBe(2);
      expect(cell.textContent).toContain('Nothing here');
    });
  });
});

describe('toasts', () => {
  let fixture: ComponentFixture<ToastHostComponent>;
  let toasts: ToastService;
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [TranslatePipe],
      providers: [{ provide: I18nService, useValue: { translate: (key: string) => key } }],
    });
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ToastHostComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has a polite status region and an alert region from the start', () => {
    expect(root.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('puts errors in the alert region and everything else in the status region', () => {
    toasts.success('Saved');
    toasts.error('Failed');
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Saved');
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Failed');
  });

  it('closes a normal toast by itself but keeps an error until it is dismissed', () => {
    toasts.success('Saved');
    const errorId = toasts.error('Failed');
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(root.textContent).not.toContain('Saved');
    expect(root.textContent).toContain('Failed');

    toasts.dismiss(errorId);
    fixture.detectChanges();
    expect(root.textContent).not.toContain('Failed');
  });

  it('stops the countdown while the pointer is over the toast', () => {
    toasts.show('Hold on', { duration: 1000 });
    fixture.detectChanges();
    const toast = root.querySelector('.toast') as HTMLElement;

    toast.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(5000);
    expect(toasts.toasts()).toHaveLength(1);

    toast.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(1000);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('dismisses with the labelled button', () => {
    toasts.success('Saved');
    fixture.detectChanges();
    const button = root.querySelector('.dismiss') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('DESIGN_SYSTEM.DISMISS');
    button.click();
    expect(toasts.toasts()).toHaveLength(0);
  });
});
