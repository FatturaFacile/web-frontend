import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  GeneralLedgerApiService,
  LedgerSettings,
  PermissionsService,
  POSTING_ACCOUNT_ROLES,
  PostingAccountRole,
  UpdateLedgerSettingsPayload,
} from '@core';
import { TranslatePipe, IconActionDirective } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';

@Component({
  selector: 'app-gl-settings',
  styleUrl: './gl-settings.component.scss',
  imports: [
    IconActionDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './gl-settings.component.html',
})
export class GlSettingsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  protected readonly lookups = inject(GlLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly roles = POSTING_ACCOUNT_ROLES;
  protected readonly settings = signal<LedgerSettings | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly formErrors = signal<string[]>([]);

  protected readonly form = this.fb.group({
    posting_accounts: this.fb.group(
      Object.fromEntries(POSTING_ACCOUNT_ROLES.map((role) => [role, this.fb.control<string | null>(null)])) as Record<
        PostingAccountRole,
        ReturnType<typeof this.fb.control<string | null>>
      >,
    ),
    manual_journal_approval_required: this.fb.control(false),
    manual_journal_approval_threshold: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    this.lookups.load();
    this.load();
  }

  protected roleLabelKey(role: PostingAccountRole): string {
    return `GL.ROLE_${role.toUpperCase()}`;
  }

  protected sourceOf(role: PostingAccountRole): string | null {
    return this.settings()?.posting_accounts[role]?.source ?? null;
  }

  protected save(): void {
    this.saving.set(true);
    this.formErrors.set([]);
    const value = this.form.getRawValue();
    const payload: UpdateLedgerSettingsPayload = {
      posting_accounts: value.posting_accounts,
      manual_journal_approval_required: value.manual_journal_approval_required,
      manual_journal_approval_threshold: value.manual_journal_approval_required
        ? value.manual_journal_approval_threshold
        : null,
    };
    this.api.updateSettings(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.applySettings(res.data);
        this.message.success(res.message);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getSettings().subscribe({
      next: (res) => {
        this.loading.set(false);
        this.applySettings(res.data);
      },
      error: () => this.loading.set(false),
    });
  }

  private applySettings(settings: LedgerSettings): void {
    this.settings.set(settings);
    const accounts = Object.fromEntries(
      POSTING_ACCOUNT_ROLES.map((role) => [role, settings.posting_accounts[role]?.account_id ?? null]),
    );
    this.form.patchValue({
      posting_accounts: accounts,
      manual_journal_approval_required: settings.manual_journal_approval_required,
      manual_journal_approval_threshold:
        settings.manual_journal_approval_threshold === null ? null : Number(settings.manual_journal_approval_threshold),
    });
    if (!this.canWrite) {
      this.form.disable();
    }
  }
}
