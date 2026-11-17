import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HubValueComponent, hubCell } from './hub-value.component';

describe('HubValueComponent', () => {
  function render(value: unknown): HTMLElement {
    const fixture = TestBed.createComponent(HubValueComponent);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('unwraps the data of an envelope and shows a list as a table', () => {
    const el = render({ success: true, data: [{ id: 'a', name: 'Uno' }, { id: 'b', name: 'Due' }] });
    expect(el.textContent).toContain('Uno');
    expect(el.textContent).toContain('Due');
  });

  it('shows an object as a description list', () => {
    const el = render({ total: 12, ok: true });
    expect(el.textContent).toContain('12');
    expect(el.textContent).toContain('Sì');
  });

  it('summarises nested values in a cell', () => {
    expect(hubCell([1, 2])).toBe('2 elementi');
    expect(hubCell({ name: 'X' })).toBe('X');
    expect(hubCell(null)).toBe('');
  });
});
