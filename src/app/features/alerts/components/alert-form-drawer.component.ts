import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AlertsApiService, AlertResource, AlertSeverity, applyServerErrors, TranslateService } from '@core';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-alert-form-drawer',
  styleUrl: './alert-form-drawer.component.scss',
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    NzDatePickerModule,
    NzButtonModule,
    TranslatePipe,
  ],
  templateUrl: './alert-form-drawer.component.html',
})
export class AlertFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AlertsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly open = model.required<boolean>();
  readonly alert = input<AlertResource | null>(null);
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);

  protected readonly form = this.fb.group({
    title: this.fb.control<string>('', [Validators.required, Validators.maxLength(255)]),
    severity: this.fb.control<AlertSeverity>('info'),
    message: this.fb.control<string>('', [Validators.maxLength(2000)]),
    is_active: this.fb.control<boolean>(true),
  });

  constructor() {
    effect(() => {
      const a = this.alert();
      if (a) {
        this.form.patchValue({
          title: a.title,
          severity: a.severity || 'info',
          message: a.message || '',
          is_active: a.is_active ?? true,
        });
      } else {
        this.form.reset({
          title: '',
          severity: 'info',
          message: '',
          is_active: true,
        });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const val = this.form.getRawValue();

    const payload = {
      title: val.title,
      severity: val.severity,
      message: val.message || null,
      is_active: val.is_active,
    };

    const current = this.alert();
    const req$ = current
      ? this.api.updateAlert(current.id, payload)
      : this.api.createAlert(payload);

    req$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.message.success(
          this.translate.instant(current ? 'alerts.messages.updated' : 'alerts.messages.created'),
        );
        this.open.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        applyServerErrors(this.form, err);
      },
    });
  }
}
