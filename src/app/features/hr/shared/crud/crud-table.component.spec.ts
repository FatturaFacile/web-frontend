import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../../icons-provider';
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

  it('hides write actions without permission and for read-only rows', async () => {
    configure({ canWrite: false });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button[nz-popconfirm]').length).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('hrmCommon.add');
  });
});
