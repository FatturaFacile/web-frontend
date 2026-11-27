import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FVR_CLAIM_STATUSES,
  FVR_PERIOD_TYPES,
  FvrClaim,
  FvrClaimPeriodPayload,
  FvrClaimStatus,
  FvrExportType,
  FvrPeriodType,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ForeignVatClaimDetailComponent } from './foreign-vat-claim-detail.component';
import { ForeignVatClaimsStore, ForeignVatReferenceStore } from './foreign-vat-refund.stores';
import {
  claimStatusColor,
  exportFilename,
  FOREIGN_VAT_MODULE,
  FvrOutcome,
  mandateColor,
  saveBlob,
  toNumber,
} from './foreign-vat-refund.util';

/**
 * The refund claims ("Istanze di rimborso"): the list with its filters, the wizard that builds a dossier for a country and period (it selects the
 * eligible ledger lines, checks the threshold, the deadline and, for the Swiss ESTV, the fiscal representative and the certificate of taxable
 * status) and the detail drawer with the timeline, the downloads and the transitions.
 */
@Component({
  selector: 'app-foreign-vat-claims',
  imports: [
    CurrencyPipe,
    DatePipe,
    ForeignVatClaimDetailComponent,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [ForeignVatClaimsStore],
  styleUrl: './foreign-vat-refund.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.FOREIGN_VAT_CLAIMS' | translate"
      [subtitle]="'foreignVat.section.claimsSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <div class="toolbar">
      <label class="field" for="fv-k-status">
        <span>{{ 'foreignVat.filter.status' | translate }}</span>
        <nz-select nzId="fv-k-status" nzAllowClear [(ngModel)]="status" (ngModelChange)="reload()">
          @for (item of statuses; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'foreignVat.claimStatus.' + item | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="fv-k-country">
        <span>{{ 'foreignVat.filter.country' | translate }}</span>
        <nz-select nzId="fv-k-country" nzAllowClear [(ngModel)]="country" (ngModelChange)="reload()">
          @for (code of countries(); track code) {
            <nz-option [nzValue]="code" [nzLabel]="'foreignVat.country.' + code | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="fv-k-year">
        <span>{{ 'foreignVat.filter.year' | translate }}</span>
        <nz-select nzId="fv-k-year" nzAllowClear [(ngModel)]="year" (ngModelChange)="reload()">
          @for (item of years; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'' + item"></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-test="new-claim" (click)="openWizard()">
          {{ 'foreignVat.action.newClaim' | translate }}
        </button>
      }
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #claims nzSize="small" [nzData]="store.claims()" [nzShowPagination]="false" [nzScroll]="{ x: '1000px' }">
        <thead>
          <tr>
            <th scope="col">{{ 'foreignVat.column.claim' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.country' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.regime' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.period' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.deadline' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.requested' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.refunded' | translate }}</th>
            <th scope="col">{{ 'foreignVat.column.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of claims.data; track row.id) {
            <tr [attr.data-test]="'claim-' + row.id">
              <td>{{ row.claim_number }}</td>
              <td>{{ 'foreignVat.country.' + row.target_country_code | translate }}</td>
              <td>{{ 'foreignVat.regime.' + row.regime_type | translate }}</td>
              <td>{{ row.fiscal_year }} · {{ 'foreignVat.periodType.' + row.period_type | translate }}</td>
              <td>{{ row.statutory_deadline_date | date: 'mediumDate' }}</td>
              <td>{{ num(row.total_requested_amount) | currency: row.currency_code }}</td>
              <td>{{ num(row.total_refunded_amount) | currency: row.currency_code }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ 'foreignVat.claimStatus.' + row.status | translate }}</nz-tag></td>
              <td>
                <button nz-button nzSize="small" type="button" data-test="open" (click)="open(row)">
                  {{ 'foreignVat.action.open' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="9"><nz-empty [nzNotFoundContent]="'foreignVat.empty.claims' | translate"></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      nzWidth="760"
      [nzVisible]="wizardOpen()"
      [nzTitle]="'foreignVat.modal.wizardTitle' | translate"
      [nzFooter]="wizardFooter"
      (nzOnCancel)="closeWizard()"
    >
      <ng-container *nzModalContent>
        <nz-steps nzSize="small" [nzCurrent]="wizardStep()" class="claim-steps">
          <nz-step [nzTitle]="'foreignVat.wizard.step.period' | translate"></nz-step>
          <nz-step [nzTitle]="'foreignVat.wizard.step.review' | translate"></nz-step>
        </nz-steps>

        @if (wizardError(); as key) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="key | translate: wizardErrorParams()" data-test="wizard-error"></nz-alert>
        }

        @if (wizardStep() === 0) {
          <div class="form-grid">
            <label class="field" for="fv-w-country">
              <span>{{ 'foreignVat.field.targetCountry' | translate }}</span>
              <nz-select nzId="fv-w-country" name="target_country_code" [(ngModel)]="wCountry">
                @for (code of countries(); track code) {
                  <nz-option [nzValue]="code" [nzLabel]="'foreignVat.country.' + code | translate"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="fv-w-year">
              <span>{{ 'foreignVat.field.fiscalYear' | translate }}</span>
              <nz-select nzId="fv-w-year" name="fiscal_year" [(ngModel)]="wYear">
                @for (item of years; track item) {
                  <nz-option [nzValue]="item" [nzLabel]="'' + item"></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="fv-w-type">
              <span>{{ 'foreignVat.field.periodType' | translate }}</span>
              <nz-select nzId="fv-w-type" name="period_type" [(ngModel)]="wType">
                @for (item of periodTypes; track item) {
                  <nz-option [nzValue]="item" [nzLabel]="'foreignVat.periodType.' + item | translate"></nz-option>
                }
              </nz-select>
            </label>
            @if (wType === 'QUARTERLY') {
              <label class="field" for="fv-w-quarter">
                <span>{{ 'foreignVat.field.quarter' | translate }}</span>
                <nz-select nzId="fv-w-quarter" name="quarter" [(ngModel)]="wQuarter">
                  @for (item of quarters; track item) {
                    <nz-option [nzValue]="item" [nzLabel]="'Q' + item"></nz-option>
                  }
                </nz-select>
              </label>
            }
          </div>
        } @else {
          @if (store.preview(); as preview) {
            <div data-test="wizard-preview">
              @for (blocker of preview.blockers; track blocker) {
                <nz-alert class="feedback" nzType="warning" nzShowIcon [nzMessage]="'foreignVat.error.' + blocker | translate: { country: wCountry ?? '', threshold: preview.threshold ?? '', deadline: preview.statutory_deadline_date ?? '' }"></nz-alert>
              }
              @if (preview.regime_type) {
                <p>
                  <nz-tag nzColor="blue">{{ 'foreignVat.regime.' + preview.regime_type | translate }}</nz-tag>
                  {{ 'foreignVat.field.deadline' | translate }}: {{ preview.statutory_deadline_date | date: 'mediumDate' }}
                </p>
                <p data-test="wizard-total">
                  {{ 'foreignVat.field.requested' | translate }}: <strong>{{ num(preview.total_requested_amount) | currency: preview.currency_code }}</strong>
                  ({{ preview.items_count }})
                  @if (preview.threshold) {
                    · {{ 'foreignVat.monitor.threshold' | translate }}: {{ num(preview.threshold) | currency: preview.currency_code }}
                  }
                </p>
                @if (preview.representative && preview.representative.status !== 'NOT_REQUIRED') {
                  <p>
                    {{ 'foreignVat.monitor.representative' | translate }}:
                    <nz-tag [nzColor]="mandateTag(preview.representative.status)">{{ 'foreignVat.mandateStatus.' + preview.representative.status | translate }}</nz-tag>
                  </p>
                }
              }
              <nz-table #items nzSize="small" [nzData]="preview.items" [nzShowPagination]="false" [nzScroll]="{ y: '220px' }">
                <thead>
                  <tr>
                    <th scope="col">{{ 'foreignVat.column.document' | translate }}</th>
                    <th scope="col">{{ 'foreignVat.column.date' | translate }}</th>
                    <th scope="col">{{ 'foreignVat.column.category' | translate }}</th>
                    <th scope="col">{{ 'foreignVat.column.recoverable' | translate }}</th>
                    <th scope="col">{{ 'foreignVat.column.scan' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of items.data; track item.id) {
                    <tr>
                      <td>{{ item.document_number }}</td>
                      <td>{{ item.document_date | date: 'mediumDate' }}</td>
                      <td>{{ item.expense_category_code }}</td>
                      <td>{{ num(item.recoverable_vat_amount) | currency: preview.currency_code }}</td>
                      <td>{{ (item.has_attachment ? 'foreignVat.scan.yes' : 'foreignVat.scan.no') | translate }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </div>
          } @else {
            <nz-spin [nzSpinning]="store.previewing()"></nz-spin>
          }
        }
      </ng-container>
    </nz-modal>

    <ng-template #wizardFooter>
      <button nz-button type="button" (click)="closeWizard()">{{ 'foreignVat.action.cancel' | translate }}</button>
      @if (wizardStep() === 0) {
        <button nz-button nzType="primary" type="button" data-test="wizard-next" [disabled]="!periodValid()" (click)="reviewPeriod()">
          {{ 'foreignVat.action.review' | translate }}
        </button>
      } @else {
        <button nz-button type="button" (click)="wizardStep.set(0)">{{ 'foreignVat.action.back' | translate }}</button>
        <button nz-button nzType="primary" type="button" data-test="wizard-create" [disabled]="!canCreate()" (click)="createClaim()">
          {{ 'foreignVat.action.createClaim' | translate }}
        </button>
      }
    </ng-template>

    <nz-drawer
      nzWidth="760"
      [nzVisible]="store.selected() !== null"
      [nzTitle]="store.selected()?.claim_number ?? ''"
      (nzOnClose)="store.close()"
    >
      <ng-container *nzDrawerContent>
        @if (store.selected(); as claim) {
          <app-foreign-vat-claim-detail
            [claim]="claim"
            [canWrite]="canWrite"
            [error]="detailError()"
            [errorParams]="detailErrorParams()"
            (ready)="run(store.ready(claim.id), 'foreignVat.toast.claimReady')"
            (draft)="run(store.draft(claim.id), 'foreignVat.toast.claimDrafted')"
            (remove)="removeClaim(claim)"
            (submitClaim)="run(store.submit(claim.id, $event), 'foreignVat.toast.claimSubmitted')"
            (requestInformation)="run(store.requestInformation(claim.id, $event), 'foreignVat.toast.claimInformationRequested')"
            (decide)="run(store.decide(claim.id, $event), 'foreignVat.toast.claimDecided')"
            (reconcile)="run(store.reconcile(claim.id, $event), 'foreignVat.toast.claimReconciled')"
            (download)="download(claim, $event)"
          ></app-foreign-vat-claim-detail>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class ForeignVatClaimsComponent implements OnInit {
  protected readonly store = inject(ForeignVatClaimsStore);
  private readonly reference = inject(ForeignVatReferenceStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(FOREIGN_VAT_MODULE);
  protected readonly statuses = FVR_CLAIM_STATUSES;
  protected readonly periodTypes = FVR_PERIOD_TYPES;
  protected readonly quarters = [1, 2, 3, 4];
  protected readonly years = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index);
  protected readonly num = toNumber;
  protected readonly color = claimStatusColor;
  protected readonly mandateTag = mandateColor;

  protected status: FvrClaimStatus | null = null;
  protected country: string | null = null;
  protected year: number | null = null;

  protected readonly wizardOpen = signal(false);
  protected readonly wizardStep = signal(0);
  protected readonly wizardError = signal<string | null>(null);
  protected readonly wizardErrorParams = signal<Record<string, string>>({});
  protected readonly detailError = signal<string | null>(null);
  protected readonly detailErrorParams = signal<Record<string, string>>({});
  protected wCountry: string | null = null;
  protected wYear = new Date().getFullYear() - 1;
  protected wType: FvrPeriodType = 'ANNUAL';
  protected wQuarter: number | null = null;

  protected readonly countries = computed(() => this.reference.reference()?.refund_countries ?? []);

  ngOnInit(): void {
    void this.reference.load();
    void this.reload();
  }

  protected async reload(): Promise<void> {
    await this.store.load({ status: this.status, country: this.country, fiscal_year: this.year });
  }

  protected async open(row: FvrClaim): Promise<void> {
    this.detailError.set(null);
    await this.store.open(row.id);
  }

  protected openWizard(): void {
    this.wCountry = null;
    this.wType = 'ANNUAL';
    this.wQuarter = null;
    this.wizardStep.set(0);
    this.wizardError.set(null);
    this.store.clearPreview();
    this.wizardOpen.set(true);
  }

  protected closeWizard(): void {
    this.wizardOpen.set(false);
  }

  protected periodValid(): boolean {
    return this.wCountry !== null && (this.wType === 'ANNUAL' || this.wQuarter !== null);
  }

  private periodPayload(): FvrClaimPeriodPayload | null {
    if (this.wCountry === null) {
      return null;
    }
    return {
      target_country_code: this.wCountry,
      fiscal_year: this.wYear,
      period_type: this.wType,
      quarter: this.wType === 'QUARTERLY' ? this.wQuarter : null,
    };
  }

  protected async reviewPeriod(): Promise<void> {
    const payload = this.periodPayload();
    if (payload === null) {
      return;
    }
    this.wizardError.set(null);
    this.wizardStep.set(1);
    await this.store.previewPeriod(payload);
  }

  protected canCreate(): boolean {
    const preview = this.store.preview();
    return preview !== null && preview.blockers.length === 0 && preview.items_count > 0;
  }

  protected async createClaim(): Promise<void> {
    const payload = this.periodPayload();
    if (payload === null || !this.canCreate()) {
      return;
    }
    const outcome = await this.store.create({ ...payload, ledger_ids: this.store.preview()?.items.map((item) => item.id) });
    if (outcome.ok) {
      this.wizardOpen.set(false);
      this.message.success(this.i18n.instant('foreignVat.toast.claimCreated'));
    } else {
      this.wizardError.set(outcome.errorKey);
      this.wizardErrorParams.set(outcome.params);
    }
  }

  protected async run(pending: Promise<FvrOutcome>, successKey: string): Promise<void> {
    const outcome = await pending;
    if (outcome.ok) {
      this.detailError.set(null);
      this.message.success(this.i18n.instant(successKey));
      await this.reload();
    } else {
      this.detailError.set(outcome.errorKey);
      this.detailErrorParams.set(outcome.params);
    }
  }

  protected async removeClaim(claim: FvrClaim): Promise<void> {
    await this.run(this.store.remove(claim.id), 'foreignVat.toast.claimDeleted');
  }

  protected async download(claim: FvrClaim, type: FvrExportType): Promise<void> {
    const result = await this.store.download(claim.id, type);
    if (result.blob) {
      saveBlob(result.blob, exportFilename(claim.claim_number, type));
      this.detailError.set(null);
    } else {
      this.detailError.set(result.outcome.errorKey);
      this.detailErrorParams.set(result.outcome.params);
    }
  }
}
