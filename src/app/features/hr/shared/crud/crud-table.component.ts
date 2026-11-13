import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { applyServerErrors, I18nService, isValidationError } from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../hr-http.util';
import { ReasonButtonComponent } from '../reason-button.component';
import { Observable } from 'rxjs';
import { CrudConfig, CrudField, CrudOption, CrudRowAction } from './crud.types';
import { fieldErrorTip, fieldValidators, isFieldRequired, wireConditionalRequired } from './crud-validation';

type Row = { id: string } & Record<string, unknown>;

/**
 * Table + create/edit modal driven by a config. Used by every flat HR/payroll resource
 * (departments, positions, leave types, wage types ...) so each page stays a few lines.
 */
@Component({
  selector: 'app-crud-table',
  styleUrl: './crud-table.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
    ReasonButtonComponent,
  ],
  templateUrl: './crud-table.component.html',
})
export class CrudTableComponent {
  readonly config = input.required<CrudConfig<Row>>();

  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly rows = signal<Row[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Row | null>(null);
  protected readonly formOpen = signal(false);
  protected form = new FormGroup<Record<string, FormControl>>({});

  protected readonly columns = computed(() => this.config().fields.filter((f) => f.column !== false));
  protected readonly formFields = computed(() =>
    this.config().fields.filter((f) => !f.noForm && !(f.createOnly && this.editing() !== null)),
  );

  constructor() {
    effect(() => {
      this.config();
      untracked(() => this.reload());
    });
  }

  reload(): void {
    this.loading.set(true);
    this.config()
      .list()
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          reportHttpError(err, this.message, this.i18n);
          this.loading.set(false);
        },
      });
  }

  protected optionLabel(field: CrudField, value: unknown): string {
    const option = field.options?.().find((o) => o.value === value);
    return option ? this.optionText(option) : String(value ?? '');
  }

  protected optionText(option: CrudOption): string {
    return option.labelKey ? this.i18n.translate(option.labelKey) : (option.label ?? option.value);
  }

  protected cell(row: Row, field: CrudField): string {
    const value = row[field.key];
    if (field.type === 'boolean') {
      return this.i18n.translate(value ? 'hrmCommon.yes' : 'hrmCommon.no');
    }
    if (field.type === 'select') {
      return value ? this.optionLabel(field, value) : '';
    }
    return value === null || value === undefined ? '' : String(value);
  }

  protected isReadonly(row: Row): boolean {
    return this.config().isReadonly?.(row) ?? false;
  }

  protected openForm(row: Row | null): void {
    this.editing.set(row);
    const controls: Record<string, FormControl> = {};
    for (const field of this.config().fields) {
      if (field.noForm || (field.createOnly && row)) {
        continue;
      }
      const raw = row ? row[field.key] : field.defaultValue;
      const initial =
        field.type === 'boolean'
          ? Boolean(raw ?? false)
          : field.type === 'datetime'
            ? String(raw ?? '').slice(0, 16)
            : String(raw ?? '');
      controls[field.key] = new FormControl(initial, { nonNullable: true, validators: fieldValidators(field, row !== null) });
    }
    this.form = new FormGroup(controls);
    wireConditionalRequired(this.form, this.formFields());
    this.formOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.buildPayload();
    const target = this.editing();
    const request = target ? this.config().update?.(target.id, payload) : this.config().create?.(payload);
    if (!request) {
      return;
    }
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.message.success(this.i18n.translate('hrmCommon.saved'));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isValidationError(err)) {
          applyServerErrors(this.form, err);
        } else {
          reportHttpError(err, this.message, this.i18n);
        }
      },
    });
  }

  /** Runs a row action; an returned Observable is subscribed (toast, reload, error report). */
  protected runAction(action: CrudRowAction<Row>, row: Row, value?: string): void {
    const result = action.run(row, value);
    if (result instanceof Observable) {
      result.subscribe({
        next: () => {
          this.message.success(this.i18n.translate('hrmCommon.saved'));
          this.reload();
        },
        error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
      });
    }
  }

  protected remove(row: Row, reason?: string): void {
    this.config()
      .remove?.(row.id, reason)
      .subscribe({
        next: () => {
          this.message.success(this.i18n.translate('hrmCommon.deleted'));
          this.reload();
        },
        error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
      });
  }

  protected errorTip(key: string): string {
    return fieldErrorTip(this.form.get(key), this.i18n);
  }

  protected isRequired(field: CrudField): boolean {
    return isFieldRequired(field, this.form, this.editing() !== null);
  }

  private buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const values = this.form.getRawValue();
    for (const field of this.config().fields) {
      if (!(field.key in values)) {
        continue;
      }
      const value = values[field.key];
      if (field.type === 'boolean') {
        payload[field.key] = Boolean(value);
        continue;
      }
      const text = String(value ?? '').trim();
      if (text === '') {
        if (field.nullable) {
          payload[field.key] = null;
        }
        continue;
      }
      payload[field.key] =
        field.type === 'integer' ? Number(text) : field.type === 'datetime' && text.length === 16 ? text + ':00' : text;
    }
    return payload;
  }
}
