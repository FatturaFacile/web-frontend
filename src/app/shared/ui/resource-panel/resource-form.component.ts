import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { applyServerErrors, ResourceRow } from '@core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { Observable, startWith } from 'rxjs';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ResourceLabelsService } from './resource-labels.service';
import { ResourceLookupService, ResourceOption } from './resource-lookup.service';
import { ResourceField } from './resource-panel.types';
import { buildRequestBody, initialFormValue } from './resource-panel.utils';
import { differentFrom, endsNotBefore, inFuture, notInFuture } from '../../utils/date-validators';

function jsonValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  try {
    JSON.parse(value);
    return null;
  } catch {
    return { json: true };
  }
}

function positiveValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return Number(value) > 0 ? null : { notPositive: true };
}

/** Dynamic reactive form generated from a list of `ResourceField`s. */
@Component({
  selector: 'app-resource-form',
  styleUrl: './resource-form.component.scss',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    TranslatePipe,
  ],
  templateUrl: './resource-form.component.html',
})
export class ResourceFormComponent implements OnInit {
  private readonly lookups = inject(ResourceLookupService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly labels = inject(ResourceLabelsService);

  readonly fields = input.required<readonly ResourceField[]>();
  readonly initial = input<ResourceRow | undefined>(undefined);
  readonly submitLabelKey = input('RES.ACTION.SAVE');
  /** Performs the request with the cleaned body; the form handles 422 errors. */
  readonly saveFn = input.required<(body: Record<string, unknown>) => Observable<unknown>>();
  readonly saved = output<unknown>();
  readonly cancelled = output<void>();

  protected readonly saving = signal(false);
  protected readonly unmappedErrors = signal<string[]>([]);
  protected readonly lookupOptions = signal<Record<string, ResourceOption[]>>({});
  protected form = new FormGroup<Record<string, AbstractControl>>({});

  ngOnInit(): void {
    const fields = this.fields();
    const value = initialFormValue(fields, this.initial());
    this.form = new FormGroup(Object.fromEntries(fields.map((f) => [f.key, this.createControl(f, value[f.key])])));
    for (const field of fields) {
      const startKey = field.notBefore;
      if (startKey) {
        this.form.get(startKey)?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
          this.form.get(field.key)?.updateValueAndValidity({ emitEvent: false });
        });
      }
      this.loadLookups(field, true);
      for (const sub of field.fields ?? []) {
        this.loadLookups(sub, false);
      }
    }
  }

  protected linesOf(field: ResourceField): FormArray<FormGroup> {
    return this.form.get(field.key) as FormArray<FormGroup>;
  }

  protected addLine(field: ResourceField): void {
    this.linesOf(field).push(this.createLineGroup(field.fields ?? [], {}));
  }

  protected removeLine(field: ResourceField, index: number): void {
    this.linesOf(field).removeAt(index);
  }

  protected onFileChosen(key: string, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0) ?? '';
    this.form.get(key)?.setValue(file);
  }

  protected options(field: ResourceField): ResourceOption[] {
    if (field.lookup) {
      return this.lookupOptions()[field.key] ?? [];
    }
    return (field.options ?? []).map((value) => ({ value, label: this.labels.value(value) }));
  }

  protected pickFile(event: Event, control: AbstractControl | null): void {
    const input = event.target as HTMLInputElement;
    control?.setValue(input.files?.item(0) ?? '');
    control?.markAsDirty();
  }

  protected errorOf(control: AbstractControl | null): string {
    if (!control || !(control.dirty || control.touched) || !control.errors) {
      return '';
    }
    const errors = control.errors;
    if (typeof errors['serverError'] === 'string') {
      return errors['serverError'];
    }
    if (errors['required']) {
      return this.labels.text('RES.ERR.REQUIRED');
    }
    if (errors['maxlength']) {
      return this.labels.text('RES.ERR.MAX_LENGTH', { max: errors['maxlength'].requiredLength });
    }
    if (errors['min']) {
      return this.labels.text('RES.ERR.MIN', { min: errors['min'].min });
    }
    if (errors['json']) {
      return this.labels.text('RES.ERR.JSON');
    }
    if (errors['endsBeforeStart']) {
      return this.labels.text('COMMON.VALIDATION.END_AFTER_START');
    }
    if (errors['futureDate']) {
      return this.labels.text('COMMON.VALIDATION.DATE_NOT_IN_FUTURE');
    }
    if (errors['pastDate']) {
      return this.labels.text('COMMON.VALIDATION.DATE_NOT_IN_PAST');
    }
    if (errors['sameAsOther']) {
      return this.labels.text('COMMON.VALIDATION.MUST_DIFFER');
    }
    if (errors['notPositive']) {
      return this.labels.text('COMMON.VALIDATION.GREATER_THAN_ZERO');
    }
    return this.labels.text('RES.ERR.INVALID');
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    this.form.markAllAsDirty();
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    this.unmappedErrors.set([]);
    const body = buildRequestBody(this.fields(), this.form.getRawValue());
    this.saveFn()(body).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.saved.emit(result);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        if (unmapped.length > 0) {
          this.unmappedErrors.set(unmapped);
        } else if (!(err instanceof Object && 'status' in err && err.status === 422)) {
          this.message.error(this.labels.text('RES.ERR.REQUEST_FAILED'));
        }
      },
    });
  }

  private createControl(field: ResourceField, value: unknown): AbstractControl {
    if (field.type === 'lines') {
      const lines = (Array.isArray(value) ? value : []) as ResourceRow[];
      const rows = lines.length > 0 || !field.required ? lines : [{}];
      return new FormArray(
        rows.map((line) => this.createLineGroup(field.fields ?? [], line)),
        field.required ? [Validators.required] : [],
      );
    }
    return new FormControl(value, this.validatorsOf(field));
  }

  private createLineGroup(fields: readonly ResourceField[], line: ResourceRow): FormGroup {
    const value = initialFormValue(fields, line);
    return new FormGroup(Object.fromEntries(fields.map((f) => [f.key, new FormControl(value[f.key], this.validatorsOf(f))])));
  }

  private validatorsOf(field: ResourceField) {
    const validators = [];
    if (field.required && field.type !== 'switch') {
      validators.push(Validators.required);
    }
    if (field.maxLength) {
      validators.push(Validators.maxLength(field.maxLength));
    }
    if (field.type === 'integer' && field.min !== undefined) {
      validators.push(Validators.min(field.min));
    }
    if (field.type === 'json') {
      validators.push(jsonValidator);
    }
    if (field.notBefore) {
      validators.push(endsNotBefore(field.notBefore, { strict: field.strictlyAfter }));
    }
    if (field.notInFuture) {
      validators.push(notInFuture);
    }
    if (field.inFuture) {
      validators.push(inFuture);
    }
    if (field.differentFrom) {
      validators.push(differentFrom(field.differentFrom));
    }
    if (field.positive) {
      validators.push(positiveValidator);
    }
    return validators;
  }

  private loadLookups(field: ResourceField, topLevel: boolean): void {
    const lookup = field.lookup;
    if (!lookup) {
      return;
    }
    const store = (options: ResourceOption[]) => this.lookupOptions.update((all) => ({ ...all, [field.key]: options }));
    const dependency = topLevel && field.dependsOn ? this.form.get(field.dependsOn) : null;
    if (!dependency) {
      this.lookups.options(lookup).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(store);
      return;
    }
    dependency.valueChanges.pipe(startWith(dependency.value), takeUntilDestroyed(this.destroyRef)).subscribe((dep) => {
      this.form.get(field.key)?.setValue('');
      this.lookups.options(lookup, String(dep ?? '')).subscribe(store);
    });
  }
}
