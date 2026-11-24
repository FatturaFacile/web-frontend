import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
import { TableColumnDef } from '@shared';
import { CrudTableComponent } from './crud-table.component';
import { CrudConfig } from './crud.types';

type Row = { id: string } & Record<string, unknown>;

describe('CrudTableComponent', () => {
  let fixture: ComponentFixture<CrudTableComponent>;
  let component: CrudTableComponent;
  const create = vi.fn();
  const update = vi.fn();

  function configure(extra: Partial<CrudConfig<Row>> = {}): void {
    const config: CrudConfig<Row> = {
      titleKey: 'hrmOrg.departments',
      canWrite: true,
      list: () => of([{ id: '1', code: 'IT', name: 'IT dept', amount: '10.50', is_active: true }]),
      create,
      update,
      fields: [
        { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true },
        { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true },
        { key: 'amount', labelKey: 'hrmEmp.amount', type: 'decimal', nullable: true },
        { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean' },
        { key: 'natural', labelKey: 'hrmCommon.code', type: 'text', createOnly: true, column: false },
      ],
      ...extra,
    };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();
  }

  beforeEach(() => {
    create.mockReset();
    update.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideNzIcons(icons)] });
    fixture = TestBed.createComponent(CrudTableComponent);
    component = fixture.componentInstance;
  });

  it('renders the rows of the list', async () => {
    configure();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('IT dept');
  });

  it('creates with decimal kept as string and empty nullable as null', () => {
    create.mockReturnValue(of({}));
    configure();
    const c = component as unknown as {
      openForm(r: null): void;
      form: { patchValue(v: object): void };
      save(): void;
    };
    c.openForm(null);
    c.form.patchValue({ code: 'HR', name: 'People', amount: '', natural: 'x' });
    c.save();
    expect(create).toHaveBeenCalledWith({ code: 'HR', name: 'People', amount: null, is_active: false, natural: 'x' });
  });

  it('rejects an invalid decimal without calling the API', () => {
    configure();
    const c = component as unknown as { openForm(r: null): void; form: { patchValue(v: object): void }; save(): void };
    c.openForm(null);
    c.form.patchValue({ code: 'HR', name: 'People', amount: '1,5' });
    c.save();
    expect(create).not.toHaveBeenCalled();
  });

  it('omits create-only fields on update and binds 422 errors to the field', () => {
    update.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'x', errors: { code: ['Duplicate code'] } },
          }),
      ),
    );
    configure();
    const c = component as unknown as {
      openForm(r: Row): void;
      form: { get(k: string): { errors: { serverError?: string } | null } | null };
      save(): void;
    };
    c.openForm({ id: '1', code: 'IT', name: 'IT dept', amount: '10.50', is_active: true });
    expect(c.form.get('natural')).toBeNull();
    c.save();
    expect(update).toHaveBeenCalledWith('1', { code: 'IT', name: 'IT dept', amount: '10.50', is_active: true });
    expect(c.form.get('code')?.errors?.serverError).toBe('Duplicate code');
  });

  it('runs a row action that returns an Observable and reloads the list', () => {
    const action = vi.fn().mockReturnValue(of({}));
    const list = vi.fn().mockReturnValue(of([{ id: '1', code: 'IT', name: 'IT dept' }]));
    configure({ list, rowActions: [{ labelKey: 'hrmCommon.view', run: action, writeOnly: true }] });
    const calls = list.mock.calls.length;
    (component as unknown as { runAction(a: unknown, r: Row, v: string): void }).runAction(
      { labelKey: 'x', run: action },
      { id: '1' },
      '95',
    );
    expect(action).toHaveBeenCalledWith({ id: '1' }, '95');
    expect(list.mock.calls.length).toBe(calls + 1);
  });

  it('hides write actions without permission and for read-only rows', async () => {
    configure({ canWrite: false });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button[nz-popconfirm]').length).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('Add');
  });

  it('does not call the API when the form is saved empty and marks the controls touched', () => {
    configure();
    const c = component as unknown as { openForm(r: null): void; form: { get(k: string): { touched: boolean } | null }; save(): void };
    c.openForm(null);
    c.save();
    expect(create).not.toHaveBeenCalled();
    expect(c.form.get('code')?.touched).toBe(true);
  });

  it('requires a field only while its requiredIf / requiredWithout condition holds', () => {
    configure({
      fields: [
        { key: 'flag', labelKey: 'hrmCommon.active', type: 'boolean' },
        { key: 'code', labelKey: 'hrmCommon.code', type: 'text', requiredIf: 'flag' },
        { key: 'gross', labelKey: 'hrmEmp.amount', type: 'decimal', requiredWithout: 'net' },
        { key: 'net', labelKey: 'hrmEmp.amount', type: 'decimal', requiredWithout: 'gross' },
      ],
    });
    const c = component as unknown as {
      openForm(r: null): void;
      form: { patchValue(v: object): void; get(k: string): { valid: boolean } | null };
      isRequired(f: unknown): boolean;
      save(): void;
    };
    c.openForm(null);
    expect(c.form.get('code')?.valid).toBe(true);
    expect(c.form.get('gross')?.valid).toBe(false);
    c.form.patchValue({ net: '10' });
    expect(c.form.get('gross')?.valid).toBe(true);
    c.form.patchValue({ flag: true });
    expect(c.form.get('code')?.valid).toBe(false);
    expect(c.isRequired({ key: 'code', requiredIf: 'flag' })).toBe(true);
    c.form.patchValue({ flag: false });
    expect(c.isRequired({ key: 'code', requiredIf: 'flag' })).toBe(false);
    expect(c.form.get('code')?.valid).toBe(true);
  });

  it('rejects whitespace-only required text and values over maxLength, below min or off pattern', () => {
    configure({
      fields: [
        { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 3, pattern: '^[A-Z]+$' },
        { key: 'qty', labelKey: 'hrmEmp.amount', type: 'integer', min: 1, max: 12 },
      ],
    });
    const c = component as unknown as {
      openForm(r: null): void;
      form: { patchValue(v: object): void; get(k: string): { errors: Record<string, unknown> | null } | null };
      save(): void;
    };
    c.openForm(null);
    c.form.patchValue({ code: '   ' });
    expect(c.form.get('code')?.errors?.['required']).toBeTruthy();
    c.form.patchValue({ code: 'ABCD' });
    expect(c.form.get('code')?.errors?.['maxlength']).toBeTruthy();
    c.form.patchValue({ code: 'ab' });
    expect(c.form.get('code')?.errors?.['format']).toBeTruthy();
    c.form.patchValue({ code: 'AB', qty: '13' });
    expect(c.form.get('qty')?.errors?.['outOfRange']).toBeTruthy();
    c.save();
    expect(create).not.toHaveBeenCalled();
  });

  describe('server-driven grid (gridList)', () => {
    const page = (data: Row[]) => of({ success: true, message: '', data, meta: { total: data.length } });
    const fields: CrudConfig<Row>['fields'] = [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text' },
      { key: 'employee_id', serverKey: 'user_id', labelKey: 'hrmCommon.employee', type: 'select', options: () => [{ value: 'e1', label: 'Mario Rossi' }] },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean' },
      { key: 'secret', labelKey: 'hrmCommon.notes', type: 'text', noGrid: true },
    ];

    it('loads the page from gridList, shows translated cells and maps the columns to the server', async () => {
      const gridList = vi.fn().mockReturnValue(page([{ id: '1', code: 'IT', employee_id: 'e1', is_active: true, secret: 'x' }]));
      configure({ list: undefined, gridList, fields });
      await new Promise((resolve) => setTimeout(resolve, 20));
      fixture.detectChanges();

      expect(gridList).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
      expect(fixture.nativeElement.textContent).toContain('Mario Rossi');

      const columns = (component as unknown as { tableColumns(): TableColumnDef<Row>[] }).tableColumns();
      expect(columns.map((c) => c.serverKey)).toEqual([undefined, 'user_id', undefined, undefined]);
      // raw server values of the filter lists and group headers are translated like the cells
      expect(columns[1].valueLabel?.('e1')).toBe('Mario Rossi');
      expect(columns[2].valueLabel?.('1')).toBe(columns[2].valueLabel?.('true'));
      expect(columns[2].valueLabel?.('1')).not.toBe(columns[2].valueLabel?.('0'));
      // an encrypted column cannot be sorted, filtered or grouped by the server
      expect(columns[3]).toEqual(expect.objectContaining({ sortable: false, filterable: false, groupable: false }));
    });

    it('reloads the grid after a row action instead of calling a client-side list', async () => {
      const gridList = vi.fn().mockReturnValue(page([{ id: '1', code: 'IT' }]));
      configure({ list: undefined, gridList, fields: fields.slice(0, 1) });
      await new Promise((resolve) => setTimeout(resolve, 20));
      const calls = gridList.mock.calls.length;
      (component as unknown as { runAction(a: unknown, r: Row): void }).runAction({ labelKey: 'x', run: () => of({}) }, { id: '1' });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(gridList.mock.calls.length).toBeGreaterThan(calls);
    });
  });
});
