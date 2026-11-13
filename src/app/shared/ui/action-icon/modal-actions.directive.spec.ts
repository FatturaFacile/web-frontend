import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { I18nService } from '@core/i18n/i18n.service';
import { IconActionDirective } from './icon-action.directive';
import { ModalActionsDirective } from './modal-actions.directive';

@Component({
  imports: [NzModalModule, ModalActionsDirective, IconActionDirective],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzOkDisabled]="okDisabled()"
      okAction="save"
      (nzOnOk)="saved()"
      (nzOnCancel)="visible.set(false)"
    >
      <ng-container *nzModalContent>content</ng-container>
    </nz-modal>
    <button id="plain" type="button" appIconAction="delete"></button>
  `,
})
class HostComponent {
  readonly visible = signal(false);
  readonly okDisabled = signal(true);
  readonly saved = vi.fn();
}

describe('icon actions', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: I18nService, useValue: { translate: (key: string) => `t:${key}` } }],
    });
  });

  it('renders an icon button with a translated tooltip', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('#plain') as HTMLButtonElement;

    expect(button.querySelector('i.fa-trash')).not.toBeNull();
    expect(button.getAttribute('title')).toBe('t:COMMON.DELETE');
    expect(button.getAttribute('aria-label')).toBe('t:COMMON.DELETE');
  });

  it('shows icon footer buttons in the modal and honours the disabled state', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.visible.set(true);
    fixture.detectChanges();
    fixture.detectChanges();
    const footer = document.querySelector('.ant-modal-footer') as HTMLElement;
    const [cancel, ok] = Array.from(footer.querySelectorAll('button'));

    expect(cancel.querySelector('i.fa-x')).not.toBeNull();
    expect(cancel.getAttribute('title')).toBe('t:COMMON.CANCEL');
    expect(ok.querySelector('i.fa-floppy-disk')).not.toBeNull();
    expect(ok.getAttribute('title')).toBe('t:COMMON.SAVE');
    expect(ok.disabled).toBe(true);

    fixture.componentInstance.okDisabled.set(false);
    fixture.detectChanges();
    fixture.componentInstance.visible.set(true);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(ok.disabled).toBe(false);
    ok.click();
    expect(fixture.componentInstance.saved).toHaveBeenCalled();
  });

  it('does not close on Esc nor on a click on the mask', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.visible.set(true);
    fixture.detectChanges();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    (document.querySelector('.ant-modal-wrap') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.visible()).toBe(true);
  });
});
