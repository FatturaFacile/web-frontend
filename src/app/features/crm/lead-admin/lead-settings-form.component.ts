import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  applyServerErrors,
  I18nService,
  LeadApiService,
  LeadDedupMode,
  LeadSetting,
  serverErrorMessage,
} from '@core';
import { apiErrorMessage, httpStatus } from '../leads/lead-i18n';

/** Cross-field rule mirrored from the backend: warm_threshold must stay below hot_threshold. */
import { TranslatePipe } from '@shared';

export function thresholdOrderValidator(group: AbstractControl): ValidationErrors | null {
  const warm = Number(group.get('warm_threshold')?.value);
  const hot = Number(group.get('hot_threshold')?.value);
  if (!Number.isFinite(warm) || !Number.isFinite(hot)) {
    return null;
  }
  return warm >= hot ? { thresholdOrder: true } : null;
}

const DEFAULTS: LeadSetting = {
  warm_threshold: 40,
  hot_threshold: 70,
  auto_qualify_threshold: 80,
  dedup_mode: 'notify',
  dedup_levenshtein_max: 2,
  dedup_similarity_min: 0.85,
  default_country: 'IT',
};

@Component({
  selector: 'app-lead-settings-form',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    TranslatePipe,
  ],
  templateUrl: './lead-settings-form.component.html',
  styleUrl: './lead-admin.scss',
})
export class LeadSettingsFormComponent {
  private readonly api = inject(LeadApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly forbidden = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.group(
    {
      warm_threshold: this.fb.control(DEFAULTS.warm_threshold, [
        Validators.required,
        Validators.min(0),
        Validators.max(100),
      ]),
      hot_threshold: this.fb.control(DEFAULTS.hot_threshold, [
        Validators.required,
        Validators.min(0),
        Validators.max(100),
      ]),
      auto_qualify_threshold: this.fb.control(DEFAULTS.auto_qualify_threshold, [
        Validators.required,
        Validators.min(0),
        Validators.max(100),
      ]),
      dedup_mode: this.fb.control<LeadDedupMode>(DEFAULTS.dedup_mode),
      dedup_levenshtein_max: this.fb.control(DEFAULTS.dedup_levenshtein_max, [
        Validators.required,
        Validators.min(0),
      ]),
      dedup_similarity_min: this.fb.control(DEFAULTS.dedup_similarity_min, [
        Validators.required,
        Validators.min(0),
        Validators.max(1),
      ]),
      default_country: this.fb.control(DEFAULTS.default_country, [
        Validators.required,
        Validators.pattern(/^[A-Za-z]{2}$/),
      ]),
    },
    { validators: [thresholdOrderValidator] },
  );

  protected readonly dedupModes: { value: LeadDedupMode; key: string }[] = [
    { value: 'notify', key: 'CRM.LEAD_SCORING.SETTINGS.DEDUP_NOTIFY' },
    { value: 'auto_merge', key: 'CRM.LEAD_SCORING.SETTINGS.DEDUP_AUTO_MERGE' },
  ];

  /** True when the current settings could not be read: saving would overwrite them with defaults. */
  readonly loadError = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.getSettings().subscribe({
      next: (s) => {
        this.form.reset({ ...DEFAULTS, ...s });
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.forbidden.set(httpStatus(err) === 403);
        this.loadError.set(httpStatus(err) !== 403);
      },
    });
  }

  protected get thresholdError(): boolean {
    return this.form.hasError('thresholdOrder');
  }

  protected fieldError(path: string): string | null {
    return serverErrorMessage(this.form, path);
  }

  save(): void {
    if (this.loadError() || this.loading()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsDirty();
      return;
    }
    if (this.saving()) {
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.api.updateSettings({ ...v, default_country: v.default_country.toUpperCase() }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        if (saved && typeof saved === 'object' && 'warm_threshold' in saved) {
          this.form.reset({ ...v, ...saved });
        }
        this.message.success(this.i18n.translate('CRM.LEAD_SCORING.SETTINGS.SAVED'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        this.formError.set(unmapped.join(' ') || apiErrorMessage(err));
      },
    });
  }
}
