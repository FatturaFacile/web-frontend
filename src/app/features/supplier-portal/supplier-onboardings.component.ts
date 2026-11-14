import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  ProcurementApiService,
  ProcurementSupplier,
  serverErrorMessage,
  SupplierCountry,
  SupplierOnboarding,
  SupplierOnboardingDetail,
  SupplierOnboardingStatus,
  SupplierPortalApiService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { validationTipKey } from '@shared/utils/validation-tip';
import {
  DOCUMENT_STATUS_COLORS,
  DOCUMENT_STATUS_LABELS,
  expiryColor,
  ONBOARDING_STATUS_COLORS,
  ONBOARDING_STATUS_LABELS,
  reasonLabel,
  RISK_LEVEL_COLORS,
  RISK_LEVEL_LABELS,
} from './supplier-portal.utils';

/** The review steps of an onboarding that ask the reviewer for a text. */
type ReviewAction = 'request-documents' | 'approve' | 'reject' | 'block';

/** Onboarding review: the pipeline of invited suppliers, the checklist of the one under review and the decision. */
@Component({
  selector: 'app-supplier-onboardings',
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    ModalActionsDirective,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'SUPPLIER_PORTAL.PAGE_ONBOARDINGS' | translate" [subtitle]="'SUPPLIER_PORTAL.ONBOARDINGS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openInvite()">{{ 'SUPPLIER_PORTAL.INVITE_SUPPLIER' | translate }}</button>
    </app-page-header>

    <nz-card>
      <div class="toolbar">
        <nz-select [ngModel]="statusFilter()" (ngModelChange)="setStatusFilter($event)" nzAllowClear [nzPlaceHolder]="'SUPPLIER_PORTAL.ALL_STATUSES' | translate" class="filter">
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="statusLabels[status] | translate"></nz-option>
          }
        </nz-select>
        <nz-select [ngModel]="countryFilter()" (ngModelChange)="setCountryFilter($event)" nzAllowClear [nzPlaceHolder]="'SUPPLIER_PORTAL.ALL_COUNTRIES' | translate" class="filter">
          <nz-option nzValue="IT" [nzLabel]="'SUPPLIER_PORTAL.COUNTRY_IT' | translate"></nz-option>
          <nz-option nzValue="CH" [nzLabel]="'SUPPLIER_PORTAL.COUNTRY_CH' | translate"></nz-option>
        </nz-select>
        <input nz-input class="search" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" [placeholder]="'SUPPLIER_PORTAL.SEARCH_SUPPLIER' | translate" />
        <button nz-button (click)="load()">{{ 'SUPPLIER_PORTAL.SEARCH' | translate }}</button>
      </div>

      <nz-table #table [nzData]="onboardings()" [nzLoading]="loading()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.VAT_NUMBER' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.COUNTRY' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.STATUS' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.INVITED_AT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (item of table.data; track item.id) {
            <tr>
              <td>{{ item.supplier_name }}</td>
              <td>{{ item.supplier_vat_number }}</td>
              <td>{{ item.country }}</td>
              <td>
                <nz-tag [nzColor]="statusColors[item.status]">{{ statusLabels[item.status] | translate }}</nz-tag>
              </td>
              <td>{{ item.invited_at | date: 'dd/MM/yyyy' }}</td>
              <td>
                <button nz-button nzSize="small" (click)="openDetail(item)">{{ 'SUPPLIER_PORTAL.REVIEW' | translate }}</button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer [nzVisible]="drawerVisible()" nzWidth="760" [nzTitle]="'SUPPLIER_PORTAL.ONBOARDING_REVIEW' | translate" (nzOnClose)="closeDetail()">
      <ng-container *nzDrawerContent>
        @if (detail(); as data) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
            <nz-descriptions-item [nzTitle]="'SUPPLIER_PORTAL.SUPPLIER' | translate">{{ data.onboarding.supplier_name }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'SUPPLIER_PORTAL.STATUS' | translate">
              <nz-tag [nzColor]="statusColors[data.onboarding.status]">{{ statusLabels[data.onboarding.status] | translate }}</nz-tag>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'SUPPLIER_PORTAL.COUNTRY' | translate">{{ data.onboarding.country }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'SUPPLIER_PORTAL.QUALIFICATION_STATUS' | translate">{{ data.onboarding.qualification_status }}</nz-descriptions-item>
            @if (data.risk; as risk) {
              <nz-descriptions-item [nzTitle]="'SUPPLIER_PORTAL.RISK' | translate" [nzSpan]="2">
                <nz-tag [nzColor]="levelColors[risk.level]">{{ levelLabels[risk.level] | translate }}</nz-tag>
                @for (reason of risk.reasons; track $index) {
                  <nz-tag>{{ reasonLabel(reason.code) | translate }}</nz-tag>
                }
              </nz-descriptions-item>
            }
            @if (data.assessment; as assessment) {
              <nz-descriptions-item [nzTitle]="'SUPPLIER_PORTAL.QUALIFICATION_SCORE' | translate" [nzSpan]="2">
                {{ assessment.total_score }} / 100 ({{ assessment.band }})
              </nz-descriptions-item>
            }
            @if (data.onboarding.status_reason) {
              <nz-descriptions-item [nzTitle]="'SUPPLIER_PORTAL.STATUS_REASON' | translate" [nzSpan]="2">{{ data.onboarding.status_reason }}</nz-descriptions-item>
            }
          </nz-descriptions>

          @if (registrationEntries().length > 0) {
            <h4 class="section-title">{{ 'SUPPLIER_PORTAL.REGISTRATION_DATA' | translate }}</h4>
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
              @for (entry of registrationEntries(); track entry.key) {
                <nz-descriptions-item [nzTitle]="entry.label">{{ entry.value }}</nz-descriptions-item>
              }
            </nz-descriptions>
          }

          <h4 class="section-title">{{ 'SUPPLIER_PORTAL.DOCUMENT_CHECKLIST' | translate }}</h4>
          <nz-table #checklist [nzData]="data.requirements" [nzShowPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'SUPPLIER_PORTAL.DOCUMENT' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.MANDATORY' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.STATUS' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.EXPIRES_AT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (requirement of checklist.data; track requirement.id) {
                <tr>
                  <td>{{ requirement.name }}</td>
                  <td>{{ (requirement.is_mandatory ? 'SUPPLIER_PORTAL.YES' : 'SUPPLIER_PORTAL.NO') | translate }}</td>
                  <td>
                    @if (requirement.submission; as submission) {
                      <nz-tag [nzColor]="documentColors[submission.status]">{{ documentLabels[submission.status] | translate }}</nz-tag>
                    } @else {
                      <nz-tag>{{ 'SUPPLIER_PORTAL.NOT_SENT' | translate }}</nz-tag>
                    }
                  </td>
                  <td>
                    @if (requirement.submission?.expires_at; as expiresAt) {
                      <nz-tag [nzColor]="expiryColor(requirement.submission?.days_to_expiry)">{{ expiresAt | date: 'dd/MM/yyyy' }}</nz-tag>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (data.blockers.length > 0) {
            <nz-alert class="blockers" nzType="warning" nzShowIcon [nzMessage]="'SUPPLIER_PORTAL.APPROVAL_BLOCKERS' | translate" [nzDescription]="blockersText"></nz-alert>
            <ng-template #blockersText>
              @for (blocker of data.blockers; track $index) {
                <nz-tag>{{ reasonLabel(blocker.code) | translate }}@if (blocker.detail) { ({{ blocker.detail }}) }</nz-tag>
              }
            </ng-template>
          }

          <div class="actions">
            <button nz-button (click)="sendAccess(data.onboarding)">{{ 'SUPPLIER_PORTAL.SEND_PORTAL_LINK' | translate }}</button>
            @if (can('documents_required')) {
              <button nz-button (click)="openAction('request-documents')">{{ 'SUPPLIER_PORTAL.REQUEST_DOCUMENTS' | translate }}</button>
            }
            @if (can('under_review')) {
              <button nz-button (click)="startReview(data.onboarding)">{{ 'SUPPLIER_PORTAL.START_REVIEW' | translate }}</button>
            }
            @if (can('approved')) {
              <button nz-button nzType="primary" [disabled]="data.blockers.length > 0" (click)="openAction('approve')">{{ 'SUPPLIER_PORTAL.APPROVE' | translate }}</button>
            }
            @if (can('rejected')) {
              <button nz-button nzDanger (click)="openAction('reject')">{{ 'SUPPLIER_PORTAL.REJECT' | translate }}</button>
            }
            @if (can('blocked')) {
              <button nz-button nzDanger (click)="openAction('block')">{{ 'SUPPLIER_PORTAL.BLOCK' | translate }}</button>
            }
          </div>
        } @else {
          <nz-empty></nz-empty>
        }
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="inviteVisible()"
      [nzTitle]="'SUPPLIER_PORTAL.INVITE_SUPPLIER' | translate"
      (nzOnCancel)="inviteVisible.set(false)"
      (nzOnOk)="saveInvite()"
      okAction="create"
      [nzOkDisabled]="inviteForm.invalid"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="inviteForm">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(inviteForm, 'supplier_id')">
              <nz-select formControlName="supplier_id" nzShowSearch>
                @for (supplier of suppliers(); track supplier.id) {
                  <nz-option [nzValue]="supplier.id" [nzLabel]="supplier.company_name + ' (' + supplier.supplier_code + ')'"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'SUPPLIER_PORTAL.COUNTRY' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="country">
                <nz-option nzValue="IT" [nzLabel]="'SUPPLIER_PORTAL.COUNTRY_IT' | translate"></nz-option>
                <nz-option nzValue="CH" [nzLabel]="'SUPPLIER_PORTAL.COUNTRY_CH' | translate"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'SUPPLIER_PORTAL.INVITATION_EMAIL' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(inviteForm, 'invitation_email')">
              <input nz-input type="email" formControlName="invitation_email" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="actionVisible()"
      [nzTitle]="actionTitleKey() | translate"
      (nzOnCancel)="actionVisible.set(false)"
      (nzOnOk)="confirmAction()"
      [nzOkDisabled]="actionForm.invalid"
      [nzOkDanger]="action() === 'reject' || action() === 'block'"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="actionForm">
          <nz-form-item>
            <nz-form-label [nzRequired]="needsReason()">{{ (needsReason() ? 'SUPPLIER_PORTAL.REASON' : 'SUPPLIER_PORTAL.NOTES') | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip(actionForm, 'text')">
              <textarea nz-input rows="4" formControlName="text"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .filter {
      min-width: 200px;
    }
    .search {
      max-width: 260px;
    }
    .section-title {
      margin: 20px 0 8px;
    }
    .blockers {
      margin-top: 16px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 20px;
    }
  `,
})
export class SupplierOnboardingsComponent implements OnInit {
  private readonly api = inject(SupplierPortalApiService);
  private readonly procurement = inject(ProcurementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly onboardings = signal<SupplierOnboarding[]>([]);
  readonly loading = signal(false);
  readonly statusFilter = signal<SupplierOnboardingStatus | null>(null);
  readonly countryFilter = signal<SupplierCountry | null>(null);
  readonly search = signal('');

  readonly drawerVisible = signal(false);
  readonly detail = signal<SupplierOnboardingDetail | null>(null);
  readonly registrationEntries = computed(() =>
    Object.entries(this.detail()?.onboarding.registration ?? {})
      .filter(([, value]) => value !== null && value !== '')
      .map(([key, value]) => ({ key, label: key.replaceAll('_', ' '), value })),
  );

  readonly inviteVisible = signal(false);
  readonly suppliers = signal<ProcurementSupplier[]>([]);
  readonly actionVisible = signal(false);
  readonly action = signal<ReviewAction>('approve');
  readonly needsReason = computed(() => this.action() === 'reject' || this.action() === 'block');
  readonly actionTitleKey = computed(() => {
    const titles: Record<ReviewAction, string> = {
      'request-documents': 'SUPPLIER_PORTAL.REQUEST_DOCUMENTS',
      approve: 'SUPPLIER_PORTAL.APPROVE',
      reject: 'SUPPLIER_PORTAL.REJECT',
      block: 'SUPPLIER_PORTAL.BLOCK',
    };
    return titles[this.action()];
  });

  readonly inviteForm = this.fb.group({
    supplier_id: ['', Validators.required],
    country: ['IT' as SupplierCountry, Validators.required],
    invitation_email: ['', Validators.email],
  });
  readonly actionForm = this.fb.group({ text: [''] });

  readonly statuses = Object.keys(ONBOARDING_STATUS_LABELS) as SupplierOnboardingStatus[];
  readonly statusLabels = ONBOARDING_STATUS_LABELS;
  readonly statusColors = ONBOARDING_STATUS_COLORS;
  readonly documentLabels = DOCUMENT_STATUS_LABELS;
  readonly documentColors = DOCUMENT_STATUS_COLORS;
  readonly levelLabels = RISK_LEVEL_LABELS;
  readonly levelColors = RISK_LEVEL_COLORS;
  readonly reasonLabel = reasonLabel;
  readonly expiryColor = expiryColor;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getOnboardings({ status: this.statusFilter() ?? undefined, country: this.countryFilter() ?? undefined, search: this.search().trim(), per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.onboardings.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
        },
      });
  }

  setStatusFilter(status: SupplierOnboardingStatus | null): void {
    this.statusFilter.set(status);
    this.load();
  }

  setCountryFilter(country: SupplierCountry | null): void {
    this.countryFilter.set(country);
    this.load();
  }

  can(target: SupplierOnboardingStatus): boolean {
    return this.detail()?.onboarding.allowed_transitions.includes(target) ?? false;
  }

  openDetail(item: SupplierOnboarding): void {
    this.drawerVisible.set(true);
    this.loadDetail(item.id);
  }

  closeDetail(): void {
    this.drawerVisible.set(false);
    this.detail.set(null);
  }

  openInvite(): void {
    this.inviteForm.reset({ supplier_id: '', country: 'IT', invitation_email: '' });
    this.inviteVisible.set(true);
    if (this.suppliers().length === 0) {
      this.procurement
        .getSuppliers({ per_page: 100 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (response) => this.suppliers.set(response.data) });
    }
  }

  saveInvite(): void {
    if (this.inviteForm.invalid) {
      return;
    }
    const value = this.inviteForm.getRawValue();
    this.api
      .inviteSupplier({ supplier_id: value.supplier_id, country: value.country, invitation_email: value.invitation_email || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.inviteVisible.set(false);
          this.message.success(this.translate.instant('SUPPLIER_PORTAL.SUPPLIER_INVITED'));
          this.load();
        },
        error: (error: unknown) => this.fail(this.inviteForm, error),
      });
  }

  sendAccess(onboarding: SupplierOnboarding): void {
    this.api
      .sendPortalAccess(onboarding.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.message.success(this.translate.instant('SUPPLIER_PORTAL.PORTAL_LINK_SENT')),
        error: () => this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR')),
      });
  }

  startReview(onboarding: SupplierOnboarding): void {
    this.api
      .startReview(onboarding.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refreshAfterStep('SUPPLIER_PORTAL.REVIEW_STARTED', onboarding.id),
        error: () => this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR')),
      });
  }

  openAction(action: ReviewAction): void {
    this.action.set(action);
    this.actionForm.reset({ text: '' });
    this.actionForm.controls.text.setValidators(action === 'reject' || action === 'block' ? [Validators.required] : []);
    this.actionForm.controls.text.updateValueAndValidity();
    this.actionVisible.set(true);
  }

  confirmAction(): void {
    const onboarding = this.detail()?.onboarding;
    if (!onboarding || this.actionForm.invalid) {
      return;
    }
    const text = this.actionForm.getRawValue().text.trim();
    const request$ = {
      'request-documents': () => this.api.requestDocuments(onboarding.id, { notes: text || null }),
      approve: () => this.api.approveOnboarding(onboarding.id, { notes: text || null }),
      reject: () => this.api.rejectOnboarding(onboarding.id, { reason: text }),
      block: () => this.api.blockOnboarding(onboarding.id, { reason: text }),
    }[this.action()]();

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.actionVisible.set(false);
        this.refreshAfterStep('SUPPLIER_PORTAL.STEP_DONE', onboarding.id);
      },
      error: (error: unknown) => this.fail(this.actionForm, error),
    });
  }

  errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }

  private refreshAfterStep(messageKey: string, onboardingId: string): void {
    this.message.success(this.translate.instant(messageKey));
    this.load();
    this.loadDetail(onboardingId);
  }

  private loadDetail(id: string): void {
    this.api
      .getOnboarding(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.detail.set(response.data), error: () => this.detail.set(null) });
  }

  private fail(form: FormGroup, error: unknown): void {
    const detail = (error as { error?: { detail?: string; message?: string } })?.error;
    this.message.error(detail?.detail ?? detail?.message ?? this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
    form.markAllAsTouched();
  }
}
