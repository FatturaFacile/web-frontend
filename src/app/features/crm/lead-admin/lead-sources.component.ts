import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Clipboard } from '@angular/cdk/clipboard';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  I18nService,
  LEAD_SOURCE_TYPES,
  LeadApiService,
  LeadSource,
  LeadSourcePayload,
  LeadSourceSecrets,
  LeadSourceType,
  serverErrorMessage,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorMessage, httpStatus } from '../leads/lead-i18n';
import { LeadSecretModalComponent } from './lead-secret-modal.component';

/** One-shot credentials carried by a create / rotate-secret response, if any. */
export function extractSecrets(source: LeadSource): LeadSourceSecrets | null {
  if (!source.webhook_secret && !source.api_key) {
    return null;
  }
  return {
    source_name: source.name,
    webhook_url: source.webhook_url ?? null,
    webhook_secret: source.webhook_secret ?? null,
    api_key: source.api_key ?? null,
  };
}

/** Copy of the source without one-shot secrets, safe to keep in list state. */
export function stripSecrets(source: LeadSource): LeadSource {
  const { webhook_secret: _secret, api_key: _key, ...rest } = source;
  return rest;
}

@Component({
  selector: 'app-crm-lead-sources',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    LeadSecretModalComponent,
  ],
  templateUrl: './lead-sources.component.html',
  styleUrl: './lead-admin.scss',
})
export class LeadSourcesComponent {
  private readonly api = inject(LeadApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly clipboard = inject(Clipboard);
  private readonly i18n = inject(I18nService);

  readonly sources = signal<LeadSource[]>([]);
  readonly loading = signal(true);
  readonly forbidden = signal(false);
  readonly loadError = signal(false);
  readonly busyId = signal<string | null>(null);

  /** One-shot secrets; cleared when the secret modal closes. */
  readonly secrets = signal<LeadSourceSecrets | null>(null);

  readonly formOpen = signal(false);
  readonly editing = signal<LeadSource | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.group({
    name: this.fb.control('', { validators: [Validators.required, Validators.maxLength(150)] }),
    code: this.fb.control(''),
    type: this.fb.control<LeadSourceType>('web_form'),
    is_active: this.fb.control(true),
    allowed_origins: this.fb.control<string[]>([]),
    default_product_line: this.fb.control(''),
  });

  protected readonly typeOptions = computed(() => {
    this.i18n.currentLanguage();
    return LEAD_SOURCE_TYPES.map((t) => ({ value: t, label: this.typeLabel(t) }));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listSources().subscribe({
      next: (list) => {
        this.sources.set(list.map(stripSecrets));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.forbidden.set(httpStatus(err) === 403);
        this.loadError.set(httpStatus(err) !== 403);
      },
    });
  }

  protected typeLabel(type: string): string {
    return this.i18n.translate(`CRM.LEAD_SOURCES.TYPES.${type.toUpperCase()}`);
  }

  protected copy(value: string | null | undefined): void {
    if (value && this.clipboard.copy(value)) {
      this.message.success(this.i18n.translate('COMMON.COPIED'));
    }
  }

  openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
    this.form.reset({
      name: '',
      code: '',
      type: 'web_form',
      is_active: true,
      allowed_origins: [],
      default_product_line: '',
    });
    this.formOpen.set(true);
  }

  openEdit(s: LeadSource): void {
    this.editing.set(s);
    this.formError.set(null);
    this.form.reset({
      name: s.name,
      code: s.code ?? '',
      type: s.type,
      is_active: s.is_active ?? true,
      allowed_origins: s.allowed_origins ?? [],
      default_product_line: s.default_product_line ?? '',
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  protected fieldError(path: string): string | null {
    return serverErrorMessage(this.form, path);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsDirty();
      this.form.updateValueAndValidity();
      return;
    }
    if (this.saving()) {
      return;
    }
    const v = this.form.getRawValue();
    const payload: LeadSourcePayload = {
      name: v.name.trim(),
      code: v.code.trim() || null,
      type: v.type,
      is_active: v.is_active,
      allowed_origins: v.allowed_origins,
      default_product_line: v.default_product_line.trim() || null,
    };
    const editing = this.editing();
    const call = editing
      ? this.api.updateSource(editing.id, payload)
      : this.api.createSource(payload);
    this.saving.set(true);
    this.formError.set(null);
    call.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.formOpen.set(false);
        const clean = stripSecrets(saved);
        this.sources.update((list) =>
          editing ? list.map((s) => (s.id === clean.id ? clean : s)) : [...list, clean],
        );
        if (!editing) {
          this.secrets.set(extractSecrets(saved));
        }
        this.message.success(this.i18n.translate('CRM.LEAD_SOURCES.SAVED'));
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.form, err);
        this.formError.set(unmapped.join(' ') || apiErrorMessage(err));
      },
    });
  }

  rotate(s: LeadSource): void {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(s.id);
    this.api.rotateSourceSecret(s.id).subscribe({
      next: (res) => {
        this.busyId.set(null);
        const merged: LeadSource = { ...s, ...res, name: res.name || s.name };
        this.sources.update((list) => list.map((x) => (x.id === s.id ? stripSecrets(merged) : x)));
        this.secrets.set(extractSecrets(merged));
      },
      error: () => this.busyId.set(null),
    });
  }

  remove(s: LeadSource): void {
    if (this.busyId()) {
      return;
    }
    this.busyId.set(s.id);
    this.api.deleteSource(s.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.sources.update((list) => list.filter((x) => x.id !== s.id));
        this.message.success(this.i18n.translate('CRM.LEAD_SOURCES.DELETED'));
      },
      error: () => this.busyId.set(null),
    });
  }
}
