import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { parseAbacValue, previewAbacRule } from './abac-preview';
import { RoleMatrixComponent } from './role-matrix.component';
import { buildRows, columnState, rowState, toggleCell, toggleColumn, toggleRow, usedActions } from './role-matrix';

const catalog = {
  crm: { contacts: ['view', 'create', 'update'] },
  invoicing: { invoices: ['view', 'create', 'approve', 'send_sdi'] },
};

describe('role matrix logic', () => {
  const rows = buildRows(catalog);

  it('builds one row per module and resource and the columns in display order', () => {
    expect(rows.map((r) => `${r.module}.${r.resource}`)).toEqual(['crm.contacts', 'invoicing.invoices']);
    expect(usedActions(rows)).toEqual(['view', 'create', 'update', 'approve', 'send_sdi']);
  });

  it('computes tri-state rows and columns', () => {
    const selected = new Set(['crm.contacts.view', 'crm.contacts.create', 'invoicing.invoices.view']);
    expect(rowState(rows[0], selected)).toBe('some');
    expect(rowState(rows[1], new Set())).toBe('none');
    expect(columnState(rows, 'view', selected)).toBe('all');
    expect(columnState(rows, 'create', selected)).toBe('some');
    expect(columnState(rows, 'update', selected)).toBe('none');
  });

  it('turns a partial row fully on, then off', () => {
    const partial = new Set(['crm.contacts.view']);
    const on = toggleRow(rows[0], partial);
    expect([...on].sort()).toEqual(['crm.contacts.create', 'crm.contacts.update', 'crm.contacts.view']);
    expect(toggleRow(rows[0], on).size).toBe(0);
  });

  it('toggles a column only over the rows that offer the action', () => {
    const on = toggleColumn(rows, 'create', new Set());
    expect([...on].sort()).toEqual(['crm.contacts.create', 'invoicing.invoices.create']);
    expect(toggleColumn(rows, 'update', new Set()).has('invoicing.invoices.update')).toBe(false);
  });

  it('toggles one cell', () => {
    expect(toggleCell(new Set(), 'a.b.view').has('a.b.view')).toBe(true);
    expect(toggleCell(new Set(['a.b.view']), 'a.b.view').size).toBe(0);
  });
});

describe('ABAC preview', () => {
  it('writes the rule as text', () => {
    expect(
      previewAbacRule({
        permission: 'invoicing.invoices.approve',
        effect: 'deny',
        conditions: [{ attribute: 'document.total', operator: '>', value: 10000 }],
      }),
    ).toBe('DENY invoicing.invoices.approve WHEN document.total > 10000');
  });

  it('parses numbers and lists', () => {
    expect(parseAbacValue('10000', '>')).toBe(10000);
    expect(parseAbacValue('TI, ZH', 'in')).toEqual(['TI', 'ZH']);
    expect(parseAbacValue('u-1', '==')).toBe('u-1');
  });
});

describe('RoleMatrixComponent', () => {
  it('renders a checkbox per available permission and updates the selection', async () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(RoleMatrixComponent);
    fixture.componentRef.setInput('catalog', catalog);
    fixture.componentRef.setInput('selected', ['crm.contacts.view']);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('[data-testid^="cell-"]').length).toBe(7);
    expect((el.querySelector('[data-testid="cell-crm-contacts-view"] input') as HTMLInputElement).checked).toBe(true);
    expect((el.querySelector('[data-testid="cell-crm-contacts-create"] input') as HTMLInputElement).checked).toBe(false);

    (el.querySelector('[data-testid="cell-crm-contacts-create"] input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual(['crm.contacts.create', 'crm.contacts.view']);
  });
});
