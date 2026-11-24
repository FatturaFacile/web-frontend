import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { GridKeyboardNavDirective } from './grid-keyboard-nav.directive';

@Component({
  imports: [GridKeyboardNavDirective],
  template: `
    <table
      appGridKeyboardNav
      (requestAddRow)="added = added + 1"
      (requestDeleteRow)="deleted = $event"
      (requestBulkSave)="saved = saved + 1"
    >
      <tbody>
        <tr id="r0"><td><input id="a0" /></td><td><input id="b0" /></td></tr>
        <tr id="r1"><td><input id="a1" /></td><td><input id="b1" /></td></tr>
      </tbody>
    </table>
  `,
})
class HostComponent {
  added = 0;
  saved = 0;
  deleted: HTMLElement | null = null;
}

describe('GridKeyboardNavDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const el = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

  function press(id: string, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    el(id).dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.autoDetectChanges();
    document.body.appendChild(fixture.nativeElement);
  });

  it('moves with arrow keys across cells and rows', () => {
    el('a0').focus();
    press('a0', 'ArrowRight');
    expect(document.activeElement).toBe(el('b0'));
    press('b0', 'ArrowDown');
    expect(document.activeElement).toBe(el('b1'));
    press('b1', 'ArrowLeft');
    expect(document.activeElement).toBe(el('a1'));
    press('a1', 'ArrowUp');
    expect(document.activeElement).toBe(el('a0'));
  });

  it('Enter advances to the next cell, then wraps to the next row', () => {
    el('a0').focus();
    press('a0', 'Enter');
    expect(document.activeElement).toBe(el('b0'));
    press('b0', 'Enter');
    expect(document.activeElement).toBe(el('a1'));
  });

  it('Enter on the last cell of the last row requests a new row', () => {
    el('b1').focus();
    press('b1', 'Enter');
    expect(host.added).toBe(1);
  });

  it('Alt+N requests a new row', () => {
    const event = press('a0', 'n', { altKey: true });
    expect(host.added).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Ctrl+Backspace requests deletion of the active row', () => {
    el('a1').focus();
    press('a1', 'Backspace', { ctrlKey: true });
    expect(host.deleted?.id).toBe('r1');
  });

  it('Ctrl+S requests bulk save and prevents the browser save dialog', () => {
    const event = press('a0', 's', { ctrlKey: true });
    expect(host.saved).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });
});
