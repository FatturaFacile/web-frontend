import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  I18nService,
  PayrollComplianceApiService,
  SwissdecDeclaration,
  SwissdecReadiness,
  SwissdecStatus,
  SwissdecVersion,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../shared/hr-http.util';

/** Swissdec ELM: certification status, what is missing in the data of a year, the declaration and the (unavailable) transmission. */
@Component({
  selector: 'app-swissdec-panel',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (status(); as s) {
      <nz-descriptions nzBordered nzSize="small" [nzColumn]="1" class="mb-3">
        <nz-descriptions-item [nzTitle]="'hrmCompliance.swissdec.certified' | translate">
          <nz-tag [nzColor]="s.is_certified ? 'green' : 'orange'">
            {{ (s.is_certified ? 'hrmCommon.yes' : 'hrmCommon.no') | translate }}
          </nz-tag>
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.swissdec.structureBasis' | translate">{{
          s.structure_basis
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.swissdec.namespace' | translate">{{
          s.schema_namespace
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.swissdec.certificationBasis' | translate">
          {{ s.current_certification_basis }}
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.swissdec.domainsNotBuilt' | translate">
          {{ s.domains_not_built.join(', ') || '-' }}
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.swissdec.missing' | translate">
          {{ s.missing_for_certification.length }}
        </nz-descriptions-item>
      </nz-descriptions>
    }

    <div class="flex items-end gap-2 mb-3 flex-wrap">
      <div>
        <label for="sd-year">{{ 'hrmCommon.year' | translate }}</label>
        <input
          nz-input
          id="sd-year"
          type="number"
          [ngModel]="year()"
          (ngModelChange)="year.set($event)"
        />
      </div>
      <div>
        <label for="sd-version">{{ 'hrmCompliance.swissdec.version' | translate }}</label>
        <nz-select
          id="sd-version"
         
          [ngModel]="version()"
          (ngModelChange)="version.set($event)"
        >
          <nz-option nzValue="5.0" nzLabel="5.0" />
          <nz-option nzValue="6.0" nzLabel="6.0" />
        </nz-select>
      </div>
      <button nz-button type="button" [nzLoading]="loading()" (click)="loadReadiness()">
        {{ 'hrmCompliance.swissdec.checkReadiness' | translate }}
      </button>
      <button nz-button type="button" [nzLoading]="loading()" (click)="loadDeclaration()">
        {{ 'hrmCompliance.swissdec.buildDeclaration' | translate }}
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        [disabled]="!canWrite()"
        (click)="confirmOpen.set(true)"
      >
        {{ 'hrmCompliance.swissdec.transmit' | translate }}
      </button>
    </div>

    @if (readiness(); as r) {
      <nz-alert
        class="mb-3"
        [nzType]="r.is_complete ? 'success' : 'warning'"
        nzShowIcon
        [nzMessage]="
          (r.is_complete ? 'hrmCompliance.swissdec.complete' : 'hrmCompliance.swissdec.incomplete')
            | translate
        "
      />
      @if (r.company.length > 0) {
        <p>
          <strong>{{ 'hrmCompliance.swissdec.companyIssues' | translate }}</strong>
          {{ r.company.length }}
        </p>
      }
      @if (r.persons.length > 0) {
        <nz-table #issues [nzData]="r.persons" [nzFrontPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'hrmCommon.employee' | translate }}</th>
              <th>{{ 'hrmCompliance.swissdec.issues' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (person of issues.data; track person.employee_id) {
              <tr>
                <td>{{ person.employee_name }}</td>
                <td>{{ person.issues.length }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    }

    @if (declaration(); as d) {
      <h4>{{ 'hrmCompliance.swissdec.declarationTitle' | translate }}</h4>
      <pre class="swissdec-json" tabindex="0">{{ declarationText() }}</pre>
      @if (!d.certification.is_certified) {
        <nz-alert
          nzType="info"
          nzShowIcon
          [nzMessage]="'hrmCompliance.swissdec.notCertifiedHint' | translate"
        />
      }
    }

    <nz-modal
      [nzVisible]="confirmOpen()"
      [nzTitle]="'hrmCompliance.swissdec.transmit' | translate"
      [nzOkText]="'hrmCommon.confirm' | translate"
      [nzCancelText]="'hrmCommon.cancel' | translate"
      [nzOkLoading]="loading()"
      (nzOnOk)="transmit()"
      (nzOnCancel)="confirmOpen.set(false)"
    >
      <ng-container *nzModalContent>{{
        'hrmCompliance.swissdec.transmitConfirm' | translate
      }}</ng-container>
    </nz-modal>
  `,
})
export class SwissdecPanelComponent {
  readonly canWrite = input(false);

  private readonly api = inject(PayrollComplianceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly year = signal<number>(new Date().getFullYear());
  protected readonly version = signal<SwissdecVersion>('5.0');
  protected readonly status = signal<SwissdecStatus | null>(null);
  protected readonly readiness = signal<SwissdecReadiness | null>(null);
  protected readonly declaration = signal<SwissdecDeclaration | null>(null);
  protected readonly declarationText = signal('');
  protected readonly loading = signal(false);
  protected readonly confirmOpen = signal(false);

  constructor() {
    this.api.getSwissdecStatus().subscribe({
      next: (res) => this.status.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected loadReadiness(): void {
    this.loading.set(true);
    this.api.getSwissdecReadiness(this.year(), this.version()).subscribe({
      next: (res) => {
        this.readiness.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected loadDeclaration(): void {
    this.loading.set(true);
    this.api.getSwissdecDeclaration(this.year(), this.version()).subscribe({
      next: (res) => {
        this.declaration.set(res.data);
        this.declarationText.set(JSON.stringify(res.data.SalaryDeclaration, null, 2));
        this.loading.set(false);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  /** The transmission is not available yet: the server answers 422 with the reason. */
  protected transmit(): void {
    this.loading.set(true);
    this.api.transmitSwissdec(this.year(), this.version()).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.confirmOpen.set(false);
        this.message.success(
          `${this.i18n.translate('hrmCompliance.swissdec.transmitted')}: ${res.data.declaration_id}`,
        );
      },
      error: (err: unknown) => {
        this.confirmOpen.set(false);
        this.fail(err);
      },
    });
  }

  private fail(err: unknown): void {
    this.loading.set(false);
    reportHttpError(err, this.message, this.i18n);
  }
}
